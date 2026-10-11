"""Read-only challenge audit. Reads local CSVs and GETs the local API only."""
import csv
import json
import os
from collections import Counter
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
# WATCHDOG_API checks a hosted API instead (results go to WATCHDOG_RESULTS if set).
API = os.environ.get('WATCHDOG_API', 'http://localhost:3001').rstrip('/')
RESULTS = os.environ.get('WATCHDOG_RESULTS', 'audit/final-check-results.json')
DATA = ROOT / 'SPOT_KnightHacks_Challenge_Kit Part One' / '02_DATA'
def rows(name):
    with (DATA / (name + '.csv')).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))
def get(path):
    with urlopen(API + path, timeout=30) as r:
        return json.load(r)
def rate(items, key='status', success='SUCCESS'):
    n = sum(r[key] == success for r in items)
    return dict(total=len(items), succeeded=n, pct=round(100*n/len(items), 1) if items else 0)
missions, actions, readings, anomalies, locations, assets = [rows(n) for n in ['missions','actions','readings','anomalies','locations','assets']]
events = [json.loads(l) for l in (DATA/'replay.ndjson').read_text().splitlines() if l.strip()]
mission_by_id = {m['mission_id']:m for m in missions}
asset_by_id = {a['asset_id']:a for a in assets}
serious = {'HIGH','CRITICAL'}
hidden = [a for a in anomalies if a['severity'] in serious and mission_by_id[a['mission_id']]['mission_status']=='COMPLETED']
expected = dict(compare={}, byConfigType=[], byLocation=[], batteryBuckets=[], byActionType=[], failureCauses=[], repeatAssets=[], soWhat={})
for v in ['V1','V2']:
    expected['compare'][v] = dict(missions=rate([m for m in missions if m['configuration_version']==v], 'mission_status','COMPLETED'), actions=rate([a for a in actions if a['configuration_version']==v]))
for t in ['NAVIGATION','VISUAL_INSPECTION','THERMAL_INSPECTION','ACOUSTIC_INSPECTION','GAUGE_READING']:
    expected['byConfigType'].append(dict(action_type=t,V1=rate([a for a in actions if a['action_type']==t and a['configuration_version']=='V1']),V2=rate([a for a in actions if a['action_type']==t and a['configuration_version']=='V2'])))
for l in locations:
    local = [a for a in actions if a['location_id']==l['location_id']]
    nav = [a for a in local if a['action_type']=='NAVIGATION']
    expected['byLocation'].append(dict(location_id=l['location_id'],location_name=l['location_name'],actions=rate(local),problems=sum(a['location_id']==l['location_id'] for a in anomalies),nav_failure_pct=round(100*sum(a['status']=='FAILED' for a in nav)/len(nav),1) if nav else None))
for label,lo,hi in [('<20%',0,19),('20-40%',20,39),('40-60%',40,59),('60-80%',60,79),('80-100%',80,100)]:
    expected['batteryBuckets'].append(dict(label=label,min=lo,max=hi,actions=rate([a for a in actions if a['battery_pct'] and lo<=int(a['battery_pct'])<=hi])))
for t in ['NAVIGATION','VISUAL_INSPECTION','THERMAL_INSPECTION','ACOUSTIC_INSPECTION','GAUGE_READING']:
    expected['byActionType'].append(dict(action_type=t,actions=rate([a for a in actions if a['action_type']==t])))
expected['failureCauses']=[dict(failure_type=t,count=n) for t,n in Counter(a['failure_type'] for a in actions if a['status']=='FAILED' and a['failure_type']).most_common()]
expected['repeatAssets']=sorted([dict(asset_id=a['asset_id'],asset_name=a['asset_name'],problems=sum(p['asset_id']==a['asset_id'] for p in anomalies)) for a in assets if sum(p['asset_id']==a['asset_id'] for p in anomalies)>1],key=lambda a:-a['problems'])
def canonical(x):
    if isinstance(x,list): return sorted((canonical(v) for v in x), key=lambda v:json.dumps(v,sort_keys=True))
    if isinstance(x,dict): return {k:canonical(v) for k,v in x.items()}
    return x
api_insights=get('/api/insights')
mock_insights=json.loads((ROOT/'lib/mock/insights.json').read_text())
insight_checks={k:dict(api_matches=canonical(api_insights[k])==canonical(v),fixture_matches=canonical(mock_insights[k])==canonical(v)) for k,v in expected.items()}
errors=[]
score={'LOW':1,'MEDIUM':2,'HIGH':3,'CRITICAL':4}
def same_records(actual, source, id_key, context):
    source_by_id={r[id_key]:r for r in source}
    if set(r[id_key] for r in actual)!=set(source_by_id): errors.append(context+': IDs differ')
    for r in actual:
        s=source_by_id.get(r[id_key])
        if not s: continue
        for k,v in s.items():
            if k=='synthetic' or k not in r: continue
            normalized = str(r[k]) if r[k] is not None else ''
            if k=='operator_review_required': normalized='True' if r[k] else 'False'
            if normalized==v: continue
            try:
                if float(normalized)==float(v): continue
            except ValueError: pass
            errors.append(f'{context}/{r[id_key]}/{k}: {normalized!r} != {v!r}')
api_missions=get('/api/missions')
mock_missions=json.loads((ROOT/'lib/mock/missions-detail.json').read_text())
mock_assets=json.loads((ROOT/'lib/mock/assets.json').read_text())
def strip_state(o):
    # Decisions are application state, not source data; fixtures never carry them.
    return json.loads(json.dumps(o), object_hook=lambda d:{k:v for k,v in d.items() if k not in ('decision','awaiting_review','summary')})
for m in missions:
    mid=m['mission_id']; d=get('/api/missions/'+mid)
    same_records([d],[m],'mission_id',mid)
    aa=[a for a in actions if a['mission_id']==mid]
    rr=[r for r in readings if r['mission_id']==mid]
    pp=[p for p in anomalies if p['mission_id']==mid]
    same_records(d['actions'],aa,'action_id',mid+'/actions')
    same_records(d['readings'],rr,'reading_id',mid+'/readings')
    same_records(d['problems'],pp,'anomaly_id',mid+'/problems')
    for p in d['problems']:
        crit=asset_by_id[p['asset_id']]['criticality']
        if p['priority']!=score[p['severity']]*score[crit]: errors.append(mid+': priority differs')
        if p['hidden_in_completed']!=(m['mission_status']=='COMPLETED' and p['severity'] in serious): errors.append(mid+': hidden flag differs')
    for k,v in dict(failed_actions=sum(a['status']=='FAILED' for a in aa),serious_problems=sum(p['severity'] in serious for p in pp),hidden_problems=sum(p['anomaly_id'] in {h['anomaly_id'] for h in hidden} for p in pp)).items():
        if d[k]!=v: errors.append(mid+': '+k+' differs')
    # Awaiting review = flagged for review with no saved decision (application state, checked for consistency).
    awaiting=sum(p['operator_review_required'] and p['decision'] is None for p in d['problems'])
    if d.get('awaiting_review')!=awaiting: errors.append(mid+': awaiting_review differs from its problems')
    listed=next(x for x in api_missions if x['mission_id']==mid)
    if listed.get('awaiting_review')!=awaiting: errors.append(mid+': /api/missions awaiting_review differs')
    if strip_state(d)!=strip_state(mock_missions[mid]): errors.append(mid+': mock mission fixture differs from API')
asset_actions_present=0
actions_away_from_home=0
for a in assets:
    aid=a['asset_id']; d=get('/api/assets/'+aid)
    same_records([d],[a],'asset_id',aid)
    same_records(d['readings'],[r for r in readings if r['asset_id']==aid and r['measurement_type']!='LOCALIZATION_CONFIDENCE_PCT'],'reading_id',aid+'/readings')
    same_records(d['problems'],[p for p in anomalies if p['asset_id']==aid],'anomaly_id',aid+'/problems')
    asset_actions_present += 'actions' in d
    same_records(d.get('actions',[]),[x for x in actions if x['asset_id']==aid],'action_id',aid+'/actions')
    actions_away_from_home += sum(x['location_id']!=a['location_id'] for x in d.get('actions',[]))
    if strip_state(d)!=strip_state(mock_assets[aid]): errors.append(aid+': asset fixture differs from API')
statuses={}
for path in ['/api/missions/UNKNOWN','/api/assets/UNKNOWN','/api/replay?mission=M014&speed=999','/api/replay?mission=UNKNOWN']:
    try: get(path); statuses[path]=200
    except HTTPError as e: statuses[path]=e.code
pages={}
for path in ['/missions','/missions/M001','/missions/M014','/missions/M027','/assets/PANEL-212','/assets/HX-217','/insights','/live?mission=M014']:
    try:
        with urlopen('http://localhost:3000'+path,timeout=20) as r:
            body=r.read().decode(); pages[path]=dict(status=r.status,placeholder='The mission list is coming next' in body)
            if path=='/missions': pages[path]['mission_links']=sum(f'/missions/{m["mission_id"]}"' in body for m in missions)
    except Exception as e: pages[path]=dict(error=str(e))
result=dict(counts=dict(missions=len(missions),actions=len(actions),readings=len(readings),anomalies=len(anomalies),locations=len(locations),assets=len(assets),replay_events=len(events)),metrics=dict(completed_missions=sum(m['mission_status']=='COMPLETED' for m in missions),completed_with_failed_actions=sum(m['mission_status']=='COMPLETED' and any(a['mission_id']==m['mission_id'] and a['status']=='FAILED' for a in actions) for m in missions),hidden_serious_findings=len(hidden),completed_missions_with_hidden_findings=len({p['mission_id'] for p in hidden}),replay_missions=len({e['mission_id'] for e in events}),failed_actions=sum(a['status']=='FAILED' for a in actions)),insights=expected,insight_checks=insight_checks,api_record_errors=errors,api_mission_count=len(api_missions),asset_endpoints_with_actions=asset_actions_present,asset_actions_away_from_home=actions_away_from_home,error_statuses=statuses,pages=pages)
(ROOT/RESULTS).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

"""
Build data/missions.json (actions + readings) from the challenge kit CSVs.

The kit files stay out of git; this small JSON is what the sandbox and the
scenario code load. Re-run it if the kit data changes:

  python tools/build_missions.py path/to/actions.csv path/to/readings.csv

Checks that every action is at a known stop and every reading belongs to an
action, so a wrong file (e.g. a renamed download) fails loudly.
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "missions.json"
MAP = ROOT / "data" / "map.json"


def read_csv(path, required):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    missing = [c for c in required if not rows or c not in rows[0]]
    if missing:
        sys.exit(f"{path}: missing columns {missing}. Is this the right file?")
    return rows


def num(s, cast):
    return cast(s) if s not in ("", None) else None


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    actions = read_csv(sys.argv[1], ["action_id", "mission_id", "sequence", "timestamp", "location_id",
                                     "asset_id", "action_type", "battery_pct", "status", "failure_type",
                                     "duration_sec", "scenario"])
    readings = read_csv(sys.argv[2], ["reading_id", "action_id", "mission_id", "asset_id", "location_id",
                                      "timestamp", "measurement_type", "value", "unit", "quality"])

    stops = {s["id"] for s in json.loads(MAP.read_text(encoding="utf-8"))["stops"]}
    out_actions = [{
        "action_id": a["action_id"], "mission_id": a["mission_id"], "sequence": int(a["sequence"]),
        "timestamp": a["timestamp"], "location_id": a["location_id"], "asset_id": a["asset_id"],
        "action_type": a["action_type"], "battery_pct": num(a["battery_pct"], int), "status": a["status"],
        "failure_type": a["failure_type"] or None, "duration_sec": num(a["duration_sec"], int),
        "scenario": a["scenario"],
    } for a in actions]
    out_actions.sort(key=lambda a: (a["mission_id"], a["sequence"]))
    out_readings = [{
        "reading_id": r["reading_id"], "action_id": r["action_id"], "mission_id": r["mission_id"],
        "asset_id": r["asset_id"], "location_id": r["location_id"], "timestamp": r["timestamp"],
        "measurement_type": r["measurement_type"], "value": float(r["value"]), "unit": r["unit"],
        "quality": r["quality"],
    } for r in readings]
    out_readings.sort(key=lambda r: r["reading_id"])

    action_ids = {a["action_id"] for a in out_actions}
    bad = [a["action_id"] for a in out_actions if a["location_id"] not in stops]
    bad += [r["reading_id"] for r in out_readings if r["action_id"] not in action_ids]
    if bad:
        sys.exit(f"unknown stop or action for: {bad[:10]}")

    # one record per line: small, readable diffs
    lines = ['{', ' "source": "SPOT KnightHacks challenge kit (synthetic data): actions.csv + readings.csv",',
             ' "actions": [']
    lines += [f'  {json.dumps(a)}{"," if i < len(out_actions) - 1 else ""}' for i, a in enumerate(out_actions)]
    lines += [' ],', ' "readings": [']
    lines += [f'  {json.dumps(r)}{"," if i < len(out_readings) - 1 else ""}' for i, r in enumerate(out_readings)]
    lines += [' ]', '}', '']
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    missions = sorted({a["mission_id"] for a in out_actions})
    print(f"{len(out_actions)} actions, {len(out_readings)} readings, missions {missions[0]}-{missions[-1]} -> {OUT}")


if __name__ == "__main__":
    main()

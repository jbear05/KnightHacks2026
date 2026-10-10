"""Build lib/mock/missions-detail.json (one MissionDetail per mission) from NextEra's kit CSVs.

Mirrors GET /api/missions/:id in backend/src/routes/missions.js: actions by sequence, every reading
(localization telemetry included; the report labels it), problems from the `problems` view sorted by
priority then time, no operator decisions, summary null. Lets mock mode open every mission that the
mission index and asset history link to, not just M014.

Checks that M014 matches the hand-checked lib/mock/mission-M014.json (apart from its editorial
summary and the newer awaiting_review field) before writing.

Usage: python lib/mock/build_missions.py "<kit>/02_DATA"
"""
import csv
import json
import sys
from pathlib import Path

SCORE = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
SERIOUS = ("HIGH", "CRITICAL")


def rows(data: Path, name: str):
    with open(data / name, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def num(s: str):
    if s == "":
        return None
    v = float(s)
    return int(v) if v.is_integer() and "." not in s else v


def main(data: Path) -> None:
    locations = {r["location_id"]: r for r in rows(data, "locations.csv")}
    assets = {r["asset_id"]: r for r in rows(data, "assets.csv")}
    missions = rows(data, "missions.csv")
    actions = rows(data, "actions.csv")
    readings = rows(data, "readings.csv")
    anomalies = rows(data, "anomalies.csv")
    replay = {json.loads(line)["mission_id"] for line in (data / "replay.ndjson").read_text().splitlines() if line.strip()}

    out = {}
    for m in missions:
        mid = m["mission_id"]
        acts = sorted((a for a in actions if a["mission_id"] == mid), key=lambda a: int(a["sequence"]))
        reads = sorted((r for r in readings if r["mission_id"] == mid), key=lambda r: (r["timestamp"], r["reading_id"]))
        probs = []
        for an in (a for a in anomalies if a["mission_id"] == mid):
            asset = assets[an["asset_id"]]
            loc = locations[an["location_id"]]
            probs.append({
                "anomaly_id": an["anomaly_id"],
                "mission_id": mid,
                "action_id": an["action_id"],
                "timestamp": an["timestamp"],
                "location_id": an["location_id"],
                "location": f"{loc['location_id']} {loc['location_name']}",
                "asset_id": an["asset_id"],
                "asset": f"{an['asset_id']} {asset['asset_name']}",
                "anomaly_type": an["anomaly_type"],
                "severity": an["severity"],
                "asset_criticality": asset["criticality"],
                "priority": SCORE[an["severity"]] * SCORE[asset["criticality"]],
                "hidden_in_completed": m["mission_status"] == "COMPLETED" and an["severity"] in SERIOUS,
                "operator_review_required": an["operator_review_required"].lower() == "true",
                "description": an["description"] or None,
                "decision": None,
            })
        probs.sort(key=lambda p: (-p["priority"], p["timestamp"]))
        serious = [p for p in probs if p["severity"] in SERIOUS]
        out[mid] = {
            "mission_id": mid,
            "mission_name": m["mission_name"],
            "scenario": m["scenario"],
            "configuration_version": m["configuration_version"],
            "start_time": m["start_time"],
            "end_time": m["end_time"] or None,
            "duration_min": num(m["duration_min"]),
            "start_battery_pct": num(m["start_battery_pct"]),
            "end_battery_pct": num(m["end_battery_pct"]),
            "mission_status": m["mission_status"],
            "failed_actions": sum(a["status"] == "FAILED" for a in acts),
            "serious_problems": len(serious),
            "hidden_problems": sum(p["hidden_in_completed"] for p in probs),
            "awaiting_review": sum(p["operator_review_required"] for p in probs),
            "in_replay": mid in replay,
            "actions": [
                {
                    "action_id": a["action_id"],
                    "mission_id": mid,
                    "sequence": int(a["sequence"]),
                    "timestamp": a["timestamp"],
                    "location_id": a["location_id"],
                    "asset_id": a["asset_id"],
                    "action_type": a["action_type"],
                    "battery_pct": num(a["battery_pct"]),
                    "status": a["status"],
                    "failure_type": a["failure_type"] or None,
                    "duration_sec": num(a["duration_sec"]),
                }
                for a in acts
            ],
            "readings": [
                {
                    "reading_id": r["reading_id"],
                    "action_id": r["action_id"],
                    "mission_id": mid,
                    "asset_id": r["asset_id"],
                    "location_id": r["location_id"],
                    "timestamp": r["timestamp"],
                    "measurement_type": r["measurement_type"],
                    "value": num(r["value"]),
                    "unit": r["unit"],
                    "quality": r["quality"],
                }
                for r in reads
            ],
            "problems": probs,
            "summary": None,
        }

    checked = json.loads(Path(__file__).with_name("mission-M014.json").read_text())
    ours = {k: v for k, v in out["M014"].items() if k not in ("summary", "awaiting_review")}
    theirs = {k: v for k, v in checked.items() if k != "summary"}
    if ours != theirs:
        sys.exit("M014 differs from lib/mock/mission-M014.json; not writing.")

    dest = Path(__file__).with_name("missions-detail.json")
    dest.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {len(out)} missions to {dest}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))

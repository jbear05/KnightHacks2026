"""Build lib/mock/assets.json (one AssetDetail per asset) from NextEra's kit CSVs.

Mirrors GET /api/assets/:id in backend/src/routes/assets.js: localization readings hidden (D4),
problems from the `problems` view sorted by priority, normal_bands empty (D3). Also adds the
optional `actions` list so step failures can be explained.

Usage: python3 lib/mock/build_assets.py "<kit>/02_DATA"
"""
import csv
import json
import sys
from pathlib import Path

SCORE = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def rows(data: Path, name: str):
    with open(data / name, newline="") as f:
        return list(csv.DictReader(f))


def num(s: str):
    v = float(s)
    return int(v) if v.is_integer() and "." not in s else v


def main(data: Path) -> None:
    locations = {r["location_id"]: r for r in rows(data, "locations.csv")}
    assets = rows(data, "assets.csv")
    missions = {r["mission_id"]: r for r in rows(data, "missions.csv")}
    actions = rows(data, "actions.csv")
    readings = rows(data, "readings.csv")
    anomalies = rows(data, "anomalies.csv")
    asset_by_id = {a["asset_id"]: a for a in assets}

    out = {}
    for a in assets:
        aid = a["asset_id"]
        acts = sorted((r for r in actions if r["asset_id"] == aid), key=lambda r: (r["timestamp"], r["action_id"]))
        reads = sorted(
            (r for r in readings if r["asset_id"] == aid and r["measurement_type"] != "LOCALIZATION_CONFIDENCE_PCT"),
            key=lambda r: (r["timestamp"], r["reading_id"]),
        )
        probs = []
        for an in anomalies:
            if an["asset_id"] != aid:
                continue
            m = missions[an["mission_id"]]
            crit = asset_by_id[aid]["criticality"]
            loc = locations[an["location_id"]]
            probs.append({
                "anomaly_id": an["anomaly_id"],
                "mission_id": an["mission_id"],
                "action_id": an["action_id"],
                "timestamp": an["timestamp"],
                "location_id": an["location_id"],
                "location": f"{loc['location_id']} {loc['location_name']}",
                "asset_id": aid,
                "asset": f"{aid} {a['asset_name']}",
                "anomaly_type": an["anomaly_type"],
                "severity": an["severity"],
                "asset_criticality": crit,
                "priority": SCORE[an["severity"]] * SCORE[crit],
                "hidden_in_completed": m["mission_status"] == "COMPLETED" and an["severity"] in ("HIGH", "CRITICAL"),
                "operator_review_required": an["operator_review_required"] == "True",
                "description": an["description"] or None,
                "decision": None,
            })
        probs.sort(key=lambda p: (-p["priority"], p["timestamp"], p["anomaly_id"]))
        out[aid] = {
            "asset_id": aid,
            "asset_name": a["asset_name"],
            "asset_type": a["asset_type"],
            "location_id": a["location_id"],
            "criticality": a["criticality"],
            "location_name": locations[a["location_id"]]["location_name"],
            "readings": [
                {
                    "reading_id": r["reading_id"],
                    "action_id": r["action_id"],
                    "mission_id": r["mission_id"],
                    "asset_id": aid,
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
            "normal_bands": [],
            "actions": [
                {
                    "action_id": r["action_id"],
                    "mission_id": r["mission_id"],
                    "sequence": int(r["sequence"]),
                    "timestamp": r["timestamp"],
                    "location_id": r["location_id"],
                    "asset_id": aid,
                    "action_type": r["action_type"],
                    "battery_pct": int(r["battery_pct"]),
                    "status": r["status"],
                    "failure_type": r["failure_type"] or None,
                    "duration_sec": int(r["duration_sec"]),
                }
                for r in acts
            ],
        }

    dest = Path(__file__).with_name("assets.json")
    dest.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {len(out)} assets to {dest}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))

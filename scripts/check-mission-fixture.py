"""Check M014's structured fixture against the supplied challenge kit (read-only).

Usage: python scripts/check-mission-fixture.py "<kit>/02_DATA"
The hand-written summary and operator decisions are not challenge CSV fields.
"""
import csv
import json
import sys
from pathlib import Path


def check(data: Path) -> None:
    fixture = json.loads((Path(__file__).resolve().parents[1] / "lib/mock/mission-M014.json").read_text())
    tables = {}
    for name in ("missions", "actions", "readings", "anomalies", "assets", "locations"):
        with (data / f"{name}.csv").open(newline="", encoding="utf-8-sig") as handle:
            tables[name] = list(csv.DictReader(handle))

    mission_id = fixture["mission_id"]
    mission = next(row for row in tables["missions"] if row["mission_id"] == mission_id)
    assets = {row["asset_id"]: row for row in tables["assets"]}
    locations = {row["location_id"]: row for row in tables["locations"]}
    errors = []

    def equal(label, actual, expected):
        if actual != expected:
            errors.append(f"{label}: fixture={actual!r}, challenge={expected!r}")

    def compare(label, actual, row):
        for key, value in actual.items():
            if key not in row:
                errors.append(f"{label}.{key}: no challenge field or documented derivation")
                continue
            raw = row[key]
            if raw == "" or raw is None:
                expected = None
            elif isinstance(value, bool):
                expected = raw == "True" if isinstance(raw, str) else raw
            elif isinstance(value, (int, float)):
                expected = float(raw)
            else:
                expected = raw
            equal(f"{label}.{key}", value, expected)

    selected = {
        name: [row for row in tables[name] if row["mission_id"] == mission_id]
        for name in ("actions", "readings", "anomalies")
    }
    replay_ids = {
        json.loads(line)["mission_id"]
        for line in (data / "replay.ndjson").read_text().splitlines() if line.strip()
    }
    serious = [row for row in selected["anomalies"] if row["severity"] in ("HIGH", "CRITICAL")]
    derived = {
        "failed_actions": sum(row["status"] == "FAILED" for row in selected["actions"]),
        "serious_problems": len(serious),
        "hidden_problems": len(serious) if mission["mission_status"] == "COMPLETED" else 0,
        "in_replay": mission_id in replay_ids,
    }
    compare(mission_id, {key: value for key, value in fixture.items()
                         if key not in ("actions", "readings", "problems", "summary")}, {**mission, **derived})

    score = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    problems = []
    for row in selected["anomalies"]:
        asset = assets[row["asset_id"]]
        location = locations[row["location_id"]]
        problems.append({
            **row,
            "location": f"{location['location_id']} {location['location_name']}",
            "asset": f"{asset['asset_id']} {asset['asset_name']}",
            "asset_criticality": asset["criticality"],
            "priority": score[row["severity"]] * score[asset["criticality"]],
            "hidden_in_completed": mission["mission_status"] == "COMPLETED" and row["severity"] in ("HIGH", "CRITICAL"),
            "decision": None,
        })

    for name, rows, key in (("actions", selected["actions"], "action_id"),
                            ("readings", selected["readings"], "reading_id"),
                            ("problems", problems, "anomaly_id")):
        by_id = {row[key]: row for row in rows}
        equal(f"{name} IDs", sorted(row[key] for row in fixture[name]), sorted(by_id))
        for row in fixture[name]:
            if row[key] in by_id:
                compare(row[key], row, by_id[row[key]])

    if errors:
        raise SystemExit("Challenge data mismatch:\n" + "\n".join(errors))
    print(f"{mission_id} matches challenge CSVs: {len(fixture['actions'])} actions, "
          f"{len(fixture['readings'])} readings, {len(fixture['problems'])} problems; "
          "mission fields, joined labels and derived counts verified.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/check-mission-fixture.py "<kit>/02_DATA"')
    check(Path(sys.argv[1]))

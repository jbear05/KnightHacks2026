from __future__ import annotations

import argparse
import csv
import os
from collections import Counter, defaultdict
from pathlib import Path


DEFAULT_DATA_DIR = Path.home() / "Downloads" / "SPOT_KnightHacks_Challenge_Kit Part One" / "02_DATA"
OUTPUT_PATH = Path(__file__).resolve().parent / "mission_summary_step1.csv"


def read_csv(path: Path):
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def normalize_bool(value):
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def main(data_dir: Path):
    required_files = ("missions.csv", "actions.csv", "readings.csv", "anomalies.csv")
    missing_files = [name for name in required_files if not (data_dir / name).is_file()]
    if missing_files:
        missing = ", ".join(missing_files)
        raise FileNotFoundError(f"Missing required CSV files in {data_dir}: {missing}")

    missions = read_csv(data_dir / "missions.csv")
    actions = read_csv(data_dir / "actions.csv")
    readings = read_csv(data_dir / "readings.csv")
    anomalies = read_csv(data_dir / "anomalies.csv")

    actions_by_mission = defaultdict(list)
    for action in actions:
        actions_by_mission[action["mission_id"]].append(action)

    readings_by_action = defaultdict(list)
    for reading in readings:
        readings_by_action[reading["action_id"]].append(reading)

    anomalies_by_mission = defaultdict(list)
    for anomaly in anomalies:
        anomalies_by_mission[anomaly["mission_id"]].append(anomaly)

    mission_rows = []

    for mission in missions:
        mission_id = mission["mission_id"]
        mission_actions = actions_by_mission.get(mission_id, [])

        failed_actions = [a for a in mission_actions if a["status"] == "FAILED"]
        failed_action_count = len(failed_actions)
        total_action_count = len(mission_actions)
        success_rate = 0.0
        if total_action_count > 0:
            success_rate = round(((total_action_count - failed_action_count) / total_action_count) * 100, 2)

        questionable_readings = 0
        location_failures = Counter()
        asset_failures = Counter()

        for action in mission_actions:
            if action["status"] == "FAILED":
                location_failures[action["location_id"]] += 1
                asset_failures[action["asset_id"]] += 1
            for reading in readings_by_action.get(action["action_id"], []):
                if str(reading.get("quality", "")).strip().upper() == "QUESTIONABLE":
                    questionable_readings += 1

        mission_anomalies = anomalies_by_mission.get(mission_id, [])
        anomaly_count = len(mission_anomalies)
        severe_anomalies = sum(
            1 for a in mission_anomalies if str(a.get("severity", "")).strip().upper() in {"HIGH", "CRITICAL"}
        )
        review_required = sum(1 for a in mission_anomalies if normalize_bool(a.get("operator_review_required")))

        start_battery = int(mission.get("start_battery_pct", 0) or 0)
        end_battery = int(mission.get("end_battery_pct", 0) or 0)
        battery_drop = max(start_battery - end_battery, 0)

        top_failure_type = "NONE"
        if failed_actions:
            failure_counter = Counter(a["failure_type"] for a in failed_actions if a.get("failure_type"))
            if failure_counter:
                top_failure_type = failure_counter.most_common(1)[0][0]

        most_risky_location = location_failures.most_common(1)[0][0] if location_failures else "NONE"
        most_risky_asset = asset_failures.most_common(1)[0][0] if asset_failures else "NONE"

        risk_score = (
            failed_action_count * 8
            + severe_anomalies * 12
            + review_required * 6
            + questionable_readings * 2
            + battery_drop // 10
        )

        hidden_risk = (
            mission["mission_status"] == "COMPLETED"
            and (
                failed_action_count > 0
                or severe_anomalies > 0
                or review_required > 0
                or questionable_readings > 0
            )
        )

        row = {
            "mission_id": mission_id,
            "mission_name": mission.get("mission_name", ""),
            "mission_status": mission.get("mission_status", ""),
            "scenario": mission.get("scenario", ""),
            "configuration_version": mission.get("configuration_version", ""),
            "total_action_count": total_action_count,
            "failed_action_count": failed_action_count,
            "success_rate_pct": success_rate,
            "anomaly_count": anomaly_count,
            "severe_anomaly_count": severe_anomalies,
            "operator_review_required": review_required,
            "questionable_readings": questionable_readings,
            "battery_drop_pct": battery_drop,
            "top_failure_type": top_failure_type,
            "most_risky_location": most_risky_location,
            "most_risky_asset": most_risky_asset,
            "risk_score": risk_score,
            "hidden_risk": str(hidden_risk).lower(),
        }
        mission_rows.append(row)

    ranked = sorted(mission_rows, key=lambda r: (r["risk_score"], r["failed_action_count"]), reverse=True)

    fieldnames = [
        "mission_id",
        "mission_name",
        "mission_status",
        "scenario",
        "configuration_version",
        "total_action_count",
        "failed_action_count",
        "success_rate_pct",
        "anomaly_count",
        "severe_anomaly_count",
        "operator_review_required",
        "questionable_readings",
        "battery_drop_pct",
        "top_failure_type",
        "most_risky_location",
        "most_risky_asset",
        "risk_score",
        "hidden_risk",
    ]

    with OUTPUT_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(ranked)

    print(f"Mission summaries written to: {OUTPUT_PATH}")
    print("Top 10 risky missions:")
    for row in ranked[:10]:
        print(
            f"{row['mission_id']} | status={row['mission_status']} | total={row['total_action_count']} | "
            f"failed={row['failed_action_count']} | success={row['success_rate_pct']}% | "
            f"anomalies={row['anomaly_count']} | severe={row['severe_anomaly_count']} | "
            f"battery_drop={row['battery_drop_pct']} | risk={row['risk_score']} | hidden={row['hidden_risk']}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Summarize mission risk from the challenge-kit CSV files.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(os.environ.get("SPOT_DATA_DIR", str(DEFAULT_DATA_DIR))).expanduser(),
        help="Directory containing missions.csv, actions.csv, readings.csv, and anomalies.csv.",
    )
    main(parser.parse_args().data_dir)

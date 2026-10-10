
/**
 * Watchdog challenge-data loader for Neon PostgreSQL.
 *
 * Run from backend/:
 * node scripts/seed.js "path/to/02_DATA"
 *
 * Install first:
 * npm.cmd install csv-parse
 */

require("dotenv").config({ override: true, quiet: true });

const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const pool = require("../src/db/pool");

// Dataset folder supplied as a command-line argument.
const dataDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "../../data/02_DATA");

// Parent tables must be inserted before their children.
// The synthetic column is intentionally excluded.
const tables = [
  [
    "locations",
    "locations.csv",
    [
      "location_id",
      "location_name",
      "zone_type",
      "floor",
      "x_coord",
      "y_coord",
      "environment"
    ]
  ],
  [
    "assets",
    "assets.csv",
    [
      "asset_id",
      "asset_name",
      "asset_type",
      "location_id",
      "criticality"
    ]
  ],
  [
    "missions",
    "missions.csv",
    [
      "mission_id",
      "mission_name",
      "scenario",
      "configuration_version",
      "start_time",
      "end_time",
      "duration_min",
      "start_battery_pct",
      "end_battery_pct",
      "mission_status",
      "operator_mode"
    ]
  ],
  [
    "actions",
    "actions.csv",
    [
      "action_id",
      "mission_id",
      "sequence",
      "timestamp",
      "location_id",
      "asset_id",
      "action_type",
      "battery_pct",
      "status",
      "failure_type",
      "duration_sec",
      "scenario",
      "configuration_version"
    ]
  ],
  [
    "readings",
    "readings.csv",
    [
      "reading_id",
      "action_id",
      "mission_id",
      "asset_id",
      "location_id",
      "timestamp",
      "measurement_type",
      "value",
      "unit",
      "quality"
    ]
  ],
  [
    "anomalies",
    "anomalies.csv",
    [
      "anomaly_id",
      "action_id",
      "mission_id",
      "location_id",
      "asset_id",
      "timestamp",
      "anomaly_type",
      "severity",
      "operator_review_required",
      "description"
    ]
  ],
  [
    "replay_events",
    "replay.ndjson",
    [
      "event_id",
      "mission_id",
      "timestamp",
      "event_type",
      "details"
    ]
  ]
];

function readRows(filename) {
  const file = path.join(dataDir, filename);

  if (!fs.existsSync(file)) {
    throw new Error(`Missing dataset file: ${file}`);
  }

  const content = fs
    .readFileSync(file, "utf8")
    .replace(/^\uFEFF/, "");

  if (filename.endsWith(".ndjson")) {
    return content
      .split(/\r?\n/)
      .filter(line => line.trim())
      .map((line, i) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(
            `${filename}, line ${i + 1}: ${error.message}`
          );
        }
      });
  }

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  });
}

function normalize(value, column) {
  if (
    value === "" ||
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (column === "details") {
    return JSON.stringify(value);
  }

  if (column === "operator_review_required") {
    if (
      value === true ||
      value === "True" ||
      value === "true"
    ) {
      return true;
    }

    if (
      value === false ||
      value === "False" ||
      value === "false"
    ) {
      return false;
    }

    throw new Error(`Invalid boolean: ${value}`);
  }

  return value;
}

async function main() {
  // Read and validate all source files first.
  const prepared = tables.map(([table, filename, columns]) => {
    const rows = readRows(filename);

    for (const [i, row] of rows.entries()) {
      for (const col of columns) {
        if (!Object.prototype.hasOwnProperty.call(row, col)) {
          throw new Error(
            `${filename}, row ${i + 1}: missing column "${col}"`
          );
        }
      }
    }

    return { table, columns, rows };
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const { table, columns, rows } of prepared) {
      const names = columns
        .map(col => `"${col}"`)
        .join(", ");

      let inserted = 0;

      for (const row of rows) {
        const values = columns.map(col =>
          normalize(row[col], col)
        );

        const placeholders = columns
          .map((_, i) => `$${i + 1}`)
          .join(", ");

        const result = await client.query(
          `INSERT INTO "${table}" (${names})
           VALUES (${placeholders})
           ON CONFLICT DO NOTHING`,
          values
        );

        inserted += result.rowCount;
      }

      console.log(
        `${table}: ${inserted} inserted, ` +
        `${rows.length - inserted} already present`
      );
    }

    await client.query("COMMIT");

    console.log(
      "Watchdog seed completed successfully."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch(error => {
    console.error(
      "Seed failed (transaction rolled back):",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());

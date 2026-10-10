/**
 * Creates the Watchdog schema in the database named by DATABASE_URL.
 *
 * Run from backend/:  npm run migrate
 *
 * Order: sql/schema.sql (tables, only when they don't exist yet), then
 * sql/002_create_problems_view.sql (CREATE OR REPLACE, safe to re-run).
 * Seed afterwards with: npm run seed -- "<kit>/02_DATA"
 */
const fs = require("node:fs");
const path = require("node:path");
const pool = require("../src/db/pool");

const sql = (name) => fs.readFileSync(path.join(__dirname, "../sql", name), "utf8");

async function main() {
  const { rows } = await pool.query("SELECT to_regclass('public.missions') IS NOT NULL AS ready");
  if (rows[0].ready) {
    console.log("schema.sql: tables already exist, skipped");
  } else {
    await pool.query(sql("schema.sql"));
    console.log("schema.sql: tables created");
  }
  await pool.query(sql("002_create_problems_view.sql"));
  console.log("002_create_problems_view.sql: problems view created or replaced");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

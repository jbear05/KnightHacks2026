# Watchdog API

Express + PostgreSQL API for the Watchdog frontend. It serves NextEra's synthetic SPOT data from the KnightHacks 2026 challenge kit and stores operator decisions. Contract: [`../contracts/endpoints.md`](../contracts/endpoints.md).

## Requirements

- Node 20 or newer (CI uses 22).
- PostgreSQL 15 or newer. The team database is Neon; any Postgres works, including a local one for testing.
- The challenge kit's `02_DATA` folder (`missions.csv`, `actions.csv`, `readings.csv`, `anomalies.csv`, `assets.csv`, `locations.csv`, `replay.ndjson`).

## Environment

Copy `.env.example` to `.env` and fill it in. `.env` is gitignored; never commit it or paste the URL into docs, issues or client code.

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string, e.g. `postgresql://USER:PASSWORD@HOST/DB?sslmode=require` for Neon. |
| `PORT` | no | Port to listen on. Default `3001`. |

`src/db/pool.js` loads `.env` with `override: true`, so a value in `backend/.env` wins over a shell variable of the same name. On a host with no `.env` file (Render, Railway, Fly), the platform's environment variables are used.

## First-time setup

Run from `backend/`, in this order:

```bash
npm ci
npm run migrate                                   # sql/schema.sql (tables, skipped if present), then sql/002_create_problems_view.sql
npm run seed -- "../SPOT_KnightHacks_Challenge_Kit Part One/02_DATA"
node scripts/testConnection.js                    # optional: prints the database name and time
npm run dev                                       # http://localhost:3001, restarts on file changes
```

- `migrate` is safe to re-run: tables are only created when `missions` doesn't exist, and the `problems` view is `CREATE OR REPLACE`.
- `seed` loads every CSV plus `replay.ndjson` in one transaction with `ON CONFLICT DO NOTHING`, so re-running it inserts nothing new. It never touches `operator_decisions`.
- Expected seed result on an empty database: 15 locations, 20 assets, 27 missions, 270 actions, 220 readings, 40 anomalies, 500 replay events.

`npm start` runs the server without the file watcher (use this on a host).

## Endpoints

| Method and path | Returns |
|---|---|
| `GET /` | `{ application, status }` liveness check (no database). |
| `GET /api/health` | Database name and time, or 500 if Postgres is unreachable. |
| `GET /api/missions` | Mission summaries with `failed_actions`, `serious_problems`, `hidden_problems`, `awaiting_review`, `in_replay`. |
| `GET /api/missions/:id` | One mission with its actions, readings and problems. |
| `GET /api/assets/:id` | One asset with equipment readings (localization telemetry excluded), problems and its `actions`. |
| `GET /api/insights` | Aggregates for the Insights page, including `byConfigType`. |
| `GET /api/locations` | The 15 waypoints. |
| `GET /api/replay?mission=M014&speed=60` | Server-sent events from `replay.ndjson` (M001–M023 only). |
| `POST /api/problems/:id/decision` | Body `{ "decision": "dispatch" \| "watch" \| "dismiss", "notes"?: string }`. Inserts a row in `operator_decisions` and returns the problem with its latest decision. |

### What a decision means

A decision row records which choice an operator made for a finding. It does not notify a technician, open a work order, or mark the equipment fixed. The `problems` view shows the latest decision per finding; a finding is "awaiting review" when `operator_review_required` is true and it has no decision yet. History is kept: every POST adds a row.

## Deployment

The frontend's `vercel.json` covers only the Next.js app; this API is a separate long-running Node process (it holds SSE connections, so it is not a Vercel function). Any Node host works:

1. Set `DATABASE_URL` (and optionally `PORT`) in the host's environment.
2. Build command `npm ci`, start command `npm start`, root directory `backend`.
3. Run `npm run migrate` and `npm run seed -- <kit>/02_DATA` once against that database.
4. Point the frontend at it with `NEXT_PUBLIC_API_BASE=https://<api-host>` and `NEXT_PUBLIC_USE_MOCK=false` (see the root README).

CORS is open (`cors()` with defaults), so the browser can call the API from any frontend origin.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Database connection failed` on `/api/health`, or `ECONNREFUSED`/timeout | Wrong `DATABASE_URL`, Postgres not running, or Neon compute asleep (first request after idle can take a few seconds). |
| `relation "problems" does not exist` | `npm run migrate` was not run, or ran before `schema.sql` succeeded. |
| `Missing dataset file` from seed | The path after `--` must be the `02_DATA` folder itself. Quote it; it contains spaces. |
| Timestamps end in `Z` or shift by hours | Something bypassed `src/db/pool.js`, which returns `TIMESTAMP` as the raw plant-local string. |
| A shell `DATABASE_URL` seems ignored | `backend/.env` wins (see Environment). Edit or remove `.env`. |
| `EADDRINUSE :3001` | Another API is already running; stop it or set `PORT`. |

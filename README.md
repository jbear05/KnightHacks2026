# Watchdog

KnightHacks 2026 · NextEra Energy SPOT Management Dashboard track. An operator console that tells you what a SPOT inspection mission actually found, not just that it "completed".

All data is synthetic and fictional, supplied by NextEra Energy for KnightHacks 2026.

## Two ways to run it

| Mode | What you need | What you get |
|---|---|---|
| **Mock** (default) | Node only | Pages read the kit fixtures in `lib/mock/` (all 27 missions, 20 assets, Insights). A yellow banner says so. Operator decisions last only until the page reloads; nothing is written anywhere. |
| **Real API** | Node, Postgres, the challenge kit's `02_DATA` | Pages read the Express API in `backend/`. Decisions are saved in Postgres and survive reloads. |

## Frontend

Requires Node 20+ (CI uses 22). Run from the repository root:

```bash
npm ci
npm run dev        # http://localhost:3000 → /live; the mission index is /missions
```

For real-API mode, copy `.env.example` to `.env.local` before `npm run dev`:

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_USE_MOCK` | `false` reads the API. Unset or any other value uses the fixtures. |
| `NEXT_PUBLIC_API_BASE` | The API's origin, e.g. `http://localhost:3001`. Required in real-API mode: this Next app has no `/api` routes, so without it requests go to its own origin and 404. |

Both are `NEXT_PUBLIC_`, so they are compiled into the browser bundle: never put a secret in them. The database URL lives only in `backend/.env`. `NEXT_PUBLIC_*` values are read at build time, so restart `npm run dev` (or rebuild) after changing them.

Checks:

```bash
npm run lint
npx tsc --noEmit
npm test           # vitest: filters, replay sync, review states, Insights wording, summaries, API helpers
npm run build      # stop `npm run dev` first: both write to .next/
```

## Backend and database

See [`backend/README.md`](backend/README.md) for variables, troubleshooting and endpoints. Short version, from `backend/`:

```bash
npm ci
cp .env.example .env                 # then set DATABASE_URL
npm run migrate                      # schema.sql, then 002_create_problems_view.sql
npm run seed -- "../SPOT_KnightHacks_Challenge_Kit Part One/02_DATA"
npm run dev                          # http://localhost:3001
```

Then set `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_BASE=http://localhost:3001` in the root `.env.local` and restart the frontend.

## Deployment

- **API (Railway).** Project `watchdog-api`, service `api`, deployed from `backend/`, at `https://api-production-efbcb.up.railway.app`. It reads the team's Neon database through the service's `DATABASE_URL` variable. Steps in [`backend/README.md`](backend/README.md#deployment).
- **Frontend (Vercel).** `vercel.json` runs `npm ci` and `npm run build`. The Vercel project sets `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_BASE=https://api-production-efbcb.up.railway.app` for Production and Preview, so deployments read the Railway API. Without those variables a deployment runs in mock mode and shows the mock banner. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.
- Decisions saved on the hosted site are written to the shared Neon database.

## How the screens use the data

- **Missions** (`/missions`) lists every run with date, configuration, status, failed steps and serious findings, with search and filters that combine. A run SPOT called "completed" that still had failed steps or high/critical findings is marked "with issues".
- **Mission report** (`/missions/M014`) leads with a summary built from the mission's records: status, each failed step and its cause, serious findings, questionable readings (equipment readings kept apart from robot localization telemetry) and battery endpoints. This summary is the authoritative one.
- **Live** (`/live?mission=M014`, `&at=02:15:00` opens paused) is a reconstructed replay: rebuilt from the mission's recorded actions, timestamps and findings, with walking paths simulated between stops. The kit's original `replay.ndjson` covers M001–M023; M024–M027 have no original log and the page says so. One clock (`components/live/useReplay.ts`) drives the map, status panel, queue and feed.
- **Asset detail** (`/assets/PANEL-212`) shows equipment readings, past findings and failed steps. Localization readings are robot telemetry and are never charted as equipment health.
- **Insights** (`/insights`) shows aggregates with their denominators. Differences between V1 and V2 are observed associations, not causes; the 20% docking line is a suggested heuristic from 11 low-battery steps.

### Findings, review and decisions

- A **recorded finding** is any anomaly row. Historical totals never change.
- A finding is **awaiting review** when the data flags it for operator review (`operator_review_required`, true for exactly the high and critical rows) and no decision has been saved (`decision === null`).
- A **saved decision** (dispatch, watch or dismiss) records the operator's choice. It does not notify a technician or mark the equipment fixed.

### Optional AI wording

The report can also draft prose with `Falconsai/text_summarization` (Apache-2.0) through Transformers.js, in the browser, with no API key. The first draft downloads the model from Hugging Face. The draft is shown under the record summary and never replaces it. Before it is shown, every number and record ID in it must appear in that mission's model input (`lib/mission-summary-grounding.ts`); written-out numbers and fractions are rejected. That check cannot tell whether a number is attached to the right field, so a draft can pass it and still be wrong. If the model fails or the draft is rejected, the record summary is unaffected.

## Fixtures and checks

Regenerate the fixtures from the kit (read-only on the CSVs):

```bash
node scripts/build-insights-mock.mjs "SPOT_KnightHacks_Challenge_Kit Part One/02_DATA"   # insights.json, missions.json
python lib/mock/build_assets.py "SPOT_KnightHacks_Challenge_Kit Part One/02_DATA"        # assets.json
python lib/mock/build_missions.py "SPOT_KnightHacks_Challenge_Kit Part One/02_DATA"      # missions-detail.json (checks M014 first)
python scripts/check-mission-fixture.py "SPOT_KnightHacks_Challenge_Kit Part One/02_DATA" # M014 fixture vs CSVs
python audit/final-check.py          # CSVs vs the running API (localhost:3001) and fixtures
```

## Layout

- `contracts/`: shared types and API contract (`lib/types.ts` re-exports `contracts/types.ts`).
- `app/`: Next.js App Router pages and the app shell (top bar, side nav, synthetic-data footer).
- `components/`: screens by area (`missions/`, `report/`, `live/`, `asset/`, `insights/`, `map/`) and `ui/` design-system pieces.
- `lib/`: API helpers, derived numbers and wording (pure functions with tests), labels (`format.ts`), fixtures.
- `backend/`: Express API, SQL schema, migrate and seed scripts.
- `map-sim/`: route finding and SPOT animation used by the Live map.
- `public/figma/`: SVGs exported from the Figma file; `public/inspections/`: NextEra's sample inspection photos.

Design source of truth: the Watchdog Figma file (Mission Report / Desktop, node 7:161). Colour and type tokens live in `app/globals.css` under the same names as the Figma variables.

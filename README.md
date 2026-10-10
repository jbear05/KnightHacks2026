# Watchdog

KnightHacks 2026 · NextEra Energy SPOT Management Dashboard track. An operator console that tells you what a SPOT inspection mission actually found, not just that it "completed".

## Run the app

```bash
npm install
npm run dev        # http://localhost:3000 (Mission Report: /missions/M014)
npm run lint
npm test           # vitest: decision saves and API URL resolution
npm run build
```

The frontend reads data only through `lib/api.ts`. Until Backend's API is live it uses the fixtures in `lib/mock/` (`NEXT_PUBLIC_USE_MOCK` defaults to mock; set it to `false` to use the real API. Requests go to `NEXT_PUBLIC_API_BASE` if set, otherwise to the app's own origin: `VERCEL_URL` on Vercel, `http://localhost:$PORT` locally).

## Mission summaries

Mission reports can generate a fresh summary with `Falconsai/text_summarization` (Apache-2.0). Inference runs in the browser through Transformers.js; no inference API or token is used. The first generation downloads the model from Hugging Face. The summary input is built from the selected mission's status, actions, problems, and questionable readings; operators should verify the summary against the evidence shown on the report.

Summary facts come only from the selected `MissionDetail` returned by `lib/api.ts`. In mock mode, M014's structured records match the supplied challenge kit's `02_DATA/missions.csv`, `actions.csv`, `readings.csv`, and `anomalies.csv`, with asset and location labels joined from `assets.csv` and `locations.csv`. In API mode, the backend reads the tables populated from those same CSVs by `backend/scripts/seed.js`. The existing prose `summary` field is not fed to the model; counts are computed from the selected mission's records.

Run `python scripts/check-mission-fixture.py "<kit>/02_DATA"` to verify M014's structured fixture against the original CSVs, joined labels, derived counts, and replay membership. This read-only check uses Python's standard library; it does not rewrite the fixture or load the editorial `summary` as input data.

The grounding check requires numeric values and IDs to occur in that mission's model input, preserving signs and comparing ID casing consistently. Written-out numbers and fractions trigger the deterministic summary built from the same records, because their numeric meaning is ambiguous. This check does not verify every semantic claim or the relationship between a number and a field; operators should still compare generated prose with the evidence.

## Layout

- `contracts/`: shared types and API contract agreed by the team (`lib/types.ts` re-exports `contracts/types.ts`).
- `app/`: Next.js App Router pages and the app shell (top bar, side nav, synthetic-data footer).
- `components/ui/`: design-system components matching the Figma "Design System" page.
- `components/report/`: Mission Report sections.
- `lib/`: API helpers, plain-English labels (`format.ts`), static kit reference tables, mock fixtures.
- `public/figma/`: SVGs exported from the Figma file; `public/inspections/`: NextEra's sample inspection photos.

Design source of truth: the Watchdog Figma file (Mission Report / Desktop, node 7:161). Colour and type tokens live in `app/globals.css` under the same names as the Figma variables.

All data is synthetic and fictional, supplied by NextEra Energy for KnightHacks 2026.

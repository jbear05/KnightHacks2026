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

## Layout

- `contracts/`: shared types and API contract agreed by the team (`lib/types.ts` re-exports `contracts/types.ts`).
- `app/`: Next.js App Router pages and the app shell (top bar, side nav, synthetic-data footer).
- `components/ui/`: design-system components matching the Figma "Design System" page.
- `components/report/`: Mission Report sections.
- `lib/`: API helpers, plain-English labels (`format.ts`), static kit reference tables, mock fixtures.
- `public/figma/`: SVGs exported from the Figma file; `public/inspections/`: NextEra's sample inspection photos.

Design source of truth: the Watchdog Figma file (Mission Report / Desktop, node 7:161). Colour and type tokens live in `app/globals.css` under the same names as the Figma variables.

All data is synthetic and fictional, supplied by NextEra Energy for KnightHacks 2026.

# Watchdog final challenge review

Reviewed October 10, 2026. Verdict: **hits the baseline overall; clearly exceeds the kit's literal minimum; does not yet justify a strong overperformance claim.** Independent audit score: **20/30 (66.7% of available audit points)**. This is not an official judging score, competition percentile, probability of winning, or measured operator productivity improvement.

## Standard used

The authoritative brief is `SPOT_KnightHacks_Challenge_Kit Part One/00_START_HERE/Challenge_Brief.md`. Its explicit minimum is to demonstrate more than raw tables and surface relationships or operational insights requiring manual investigation. It lists six evaluation themes but supplies no weights, numeric thresholds, required feature list, or definition of overperformance. The suggested questions are examples, not a mandatory checklist. The Orbit screenshots are reference material, not a requirement to reproduce Orbit.

For this review, each theme receives equal weight, 0–5 points: 0 absent; 1 superficial; 2 partially functional or materially unsupported; 3 useful, functional baseline; 4 demonstrated strength beyond baseline with remaining limitations; 5 exceptional execution supported by comprehensive validation. Baseline overall requires at least 18/30, no theme below 2, and passing the explicit minimum. Overperformance requires at least 24/30, every theme at least 3, and a coherent operator workflow without a major reproducible inconsistency. These are reviewer-defined thresholds, chosen to make this assessment explicit rather than imply an official rubric.

| Kit theme | Score | Evidence and limit |
|---|---:|---|
| Operational usefulness | 3/5 | Separates completed missions from failed steps; prioritizes findings by severity × asset criticality; offers report-to-asset investigation and operator choices. Mission discovery is unfinished and attention counts do not account for saved decisions. |
| Insight | 3/5 | Accurate configuration, location, battery, inspection-type, cause, and repeat-asset aggregates. Mostly descriptive analysis of the suggested questions; no adjustment for differing routes, inspection mixes, or battery exposure. Repeat-asset rankings are computed but not presented on Insights. |
| Usability | 3/5 | Readable report, visible severity, explicit units and denominators, keyboard/ARIA support in source, and consistent visual language. The mission index is a placeholder; no timed operator study or full mobile/accessibility audit establishes quick task completion. |
| Technical execution | 3/5 | Real local API/database integration works; exposed records agree with CSVs; 93 automated tests, lint, and build pass. Paused replay map and status disagree; asset API omits action context available in fixtures; no fresh write/persistence round trip was exercised. |
| Creativity | 4/5 | Distinctive interface, animated SPOT with routes around walls and across floors, and browser-based mission summaries form a coherent demonstration. No claim of originality relative to other submissions or empirical advantage is possible. |
| Explainability | 4/5 | Source evidence, sample-size denominators, failure causes, questionable-reading flags, synthetic-data disclosure, priority formula, and sample-photo labels are explicit. AI numeric/ID membership checks do not prove semantic correctness; battery docking and first-investigation recommendations need clearer qualification. |
| **Total** | **20/30** | **Baseline overall.** |

## Verified evidence

The audit read the challenge brief, start instructions, assumptions, dictionary, validation results, asset information, starter examples, and a representative approved Orbit screenshot. It reviewed frontend/backend source and the running local UI. `.env.local` explicitly selects real API mode and `http://localhost:3001`; the findings are not based solely on the default fixtures.

`audit/final-check.py` independently parses the supplied CSVs using Python's CSV reader. It recomputes the six substantive Insights groups and compares them with both the running API and stored Insights fixtures, ignoring array order. It checks all 27 mission detail endpoints and all 20 asset endpoints against source ID membership and exposed source fields, including numeric readings, anomaly severity, priority, and hidden-completion flags. Deliberately excluded localization readings are accounted for on asset endpoints. It does not compare saved operator decisions with CSVs because decisions are application state. No record discrepancy was found. Full results are in `audit/final-check-results.json`.

| Check | Result |
|---|---|
| Root Vitest tests | 64/64 passed across 9 test files |
| Map/simulation tests | 29/29 passed; includes all 210 directed waypoint pairs, blocked-cell avoidance and independent shortest-path comparisons |
| ESLint | Passed |
| Next.js production build | Passed compilation, lint/types, page generation and tracing; workspace-root warning remains |
| M014 fixture/source check | Passed: 10 actions, 8 readings, 2 problems, joined labels and derived counts |
| Independently recomputed Insights groups | 6/6 substantive groups match both API and fixtures |
| Mission and asset API records | 27/27 mission details and 20/20 asset endpoints checked; no exposed-source-field discrepancy |
| Representative frontend routes | 8/8 HTTP 200 after server recovery, including M001, M014, M027, two assets, Live, Insights, and Missions; Missions still contains placeholder content |
| Invalid-ID/input GET checks | Expected 404/400 on four probes |
| Browser AI inference | Generated an M014 summary successfully; output accurately named mission, configuration, battery endpoints and review counts, but omitted failed-step detail |
| Operator decision persistence | Existing “Tech sent” choice was visible on a fresh M014 page load; source implements database inserts and latest-decision reads. No new audit decision was submitted; no complete new POST → reload test credit assigned |
| Deployment | Not tested; local success does not establish a working hosted frontend/backend |

Dataset size: **27 missions, 270 actions, 220 readings, 40 anomalies, 15 locations, 20 assets, 500 replay events**. Original replay logs cover **23/27 missions**.

## Actual operational findings

These quantities were independently recomputed from source records, not inferred from UI copy:

- **26/27 missions completed; 21/26 completed missions (80.8%) still contained failed actions.** Mission completion alone is a poor quality summary.
- **14 high/critical findings occurred in 13/26 completed missions (50.0%).** “Hidden” here means serious findings inside completed missions; it does not mean every anomaly, unreviewed work, or previously invisible data.
- V1 action success was **139/180 = 77.2%**, versus **82/90 = 91.1%** on V2: **+13.9 percentage points** using underlying counts. Mission completion was **17/18 = 94.4%** versus **9/9 = 100%**. This supports an observed difference, not proof that the unspecified configuration change caused it.
- Below 20% battery, **3/11 actions succeeded (27.3%)**; at or above 20%, **218/259 succeeded (84.2%)**. Only 11 low-battery actions support the low-battery estimate. The dataset does not establish an optimal docking cutoff or isolate battery from mission progression, configuration, and action type.
- Acoustic checks were least reliable: **30/43 = 69.8%**, followed by gauge readings at **28/38 = 73.7%**.
- Unreliable readings and sensor timeouts explain **26/49 failed actions (53.1%)** by recorded cause category.
- WP05 has the most anomaly records: **8 across 43 actions**. WP09 has **6 across 22 actions** and lower step success (**63.6% versus 74.4%**). Highest raw count is not automatically highest risk or worst rate.

No productivity gain, time-to-triage reduction, fault prediction accuracy, causality, or real-facility outcome has been measured. Test pass rates establish the tested behavior; they are not success percentages for operators or AI factual accuracy.

## Findings preventing overperformance

1. **Mission discovery is incomplete.** `app/missions/page.tsx:10` explicitly says the mission list is coming next and links only M014. API mode can render other missions by direct URL, but operators cannot browse the full dataset from the Missions entry point. This is a workflow gap, not an API coverage failure.

2. **Paused replay is inconsistent.** Reproduce at `http://localhost:3000/live?mission=M014&at=02:15:00`. The status panel says the gauge inspection started at WP07 at 02:14:37, and the feed agrees. The map still draws SPOT at WP13. `LiveMission.tsx:31` computes panel state from `replay.clock`, while `FacilityMap.tsx:184–193` initializes its own clock from the last event at 02:13:00. The map receives events, speed and play state, but not the actual seek clock. Seeking between events therefore loses the partial-time position. Browser inspection confirmed the mismatch; existing replay/pathfinding tests do not cover this integration case.

3. **Recorded findings are presented as current open work.** `lib/insights.ts:69–84` totals hidden serious findings without considering decisions and says they “still need attention.” `lib/replay.ts:199–210` queues serious findings without consulting decisions, and `components/live/RightRail.tsx:107` labels them “open.” A saved action does not establish resolution, but the application also has no separate unresolved/resolved state. These counts should be labeled as recorded findings unless a lifecycle definition and corresponding filter exist.

4. **Some recommendations exceed the demonstrated evidence.** The battery cutoff is a heuristic derived from a small descriptive bucket. “Walk [WP05] first” ranks raw anomaly count rather than severity, asset criticality, or exposure-adjusted risk. The V2 text appropriately advises comparing similar routes, but the application does not provide that comparison. No predictive model is required by the kit; stronger support for existing claims matters more than adding one.

5. **AI verification is narrow.** `lib/mission-summary-grounding.ts:23–31` checks whether numbers and IDs occur in the input, not whether a number belongs to the claimed field or whether equipment-health assertions are true. A swapped known value can pass. Unit tests mock model inference; one successful real-browser generation establishes functionality for that run only. The observed summary omitted M014's three failed actions, so the structured report remains the stronger source of operational truth.

6. **Fresh-install and hosted-demo coverage are weaker than the local setup.** Without environment configuration, `lib/api.ts:9` defaults to mock mode, with only M014 in `MOCK_MISSIONS`; other mission report links from asset history can return 404, and mock decisions are only echoed in memory despite saved-state wording. The checked local environment uses the real API, so this is a packaging/fallback limitation, not a failure of the local real-mode data check. The backend README is empty. Hosted integration, new decision writes, and all SSE timings were not validated.

7. **Asset fixture and API experiences differ.** `backend/src/routes/assets.js` returns readings and problems but no optional `actions` list. All 20 queried asset endpoints omit it. Asset context functions therefore cannot explain no-reading action failures or count all inspection visits as fixtures do. This loses context without corrupting the verified readings.

## Highest-value final work

Finish the mission index using the existing mission-summary API; pass one replay clock to the map and panel; distinguish recorded findings from unresolved work; qualify the docking/hotspot heuristics; and verify the hosted demo plus a new decision-save/reload round trip. Preserve the accurate dataset joins, visible denominators, transparent priority calculation, and separation of questionable sensor evidence from equipment diagnoses.

The assessment is an audit, not an implementation pass: no application source or database decisions were changed. Added files are confined to `audit/`. Running `next build` while the existing development server was active caused a transient shared `.next` cache collision. The identified frontend process was restarted, the generated cache preserved at `C:\Users\jairg\AppData\Local\Temp\watchdog-next-final-audit-20261010`, and all eight sampled routes rechecked successfully. That audit-induced failure was excluded from the project score. The frontend remains running on port 3000.

---

# Implementation pass and re-review

Carried out October 10, 2026 on branch `claude/final-quality-pass` ([PR 16](https://github.com/jbear05/KnightHacks2026/pull/16)), in the phase order requested. The review above is left as written; this section records what changed, what was actually verified, what remains, and a re-score on the same reviewer-defined rubric. Source data in the challenge kit was not modified. No test was removed or loosened; where expected copy changed on purpose, the new assertions are at least as strict and several add negative checks.

## Findings and resolutions

| # | Original finding | Resolution | Where |
|---|---|---|---|
| 1 | Mission discovery unfinished | `/missions` lists all 27 runs from `getMissions()`: ID and name, date and time, configuration, status, failed steps, serious findings (with how many await review), report and replay links. Search plus configuration, status, "show" and sort filters combine and persist in the URL. Completed runs with failed steps or serious findings are labelled "with issues" (glyph and text, not colour alone); runs with serious findings are tinted. Empty results name the active filters and offer Clear filters. Native inputs, selects, links and a focusable scroll region give keyboard access. | `app/missions/page.tsx`, `components/missions/MissionIndex.tsx`, `lib/missions.ts` |
| 2 | Paused replay map and panel disagree | `useReplay()` is the only clock. `FacilityMap` takes `clock` (replacing `speed`/`playing`) and keeps no clock of its own; the map and the status panel both place SPOT with `lib/replay.ts` `stepAt()`. Animation state (gait, heading, teleport on seek) stays in the map. The Live page and top-bar state say "Reconstructed replay" and state whether the kit's original log covers the mission; M024–M027 say it has none. | `components/map/FacilityMap.tsx`, `lib/replay.ts`, `components/live/LiveMission.tsx`, `contracts/facility-map-props.ts` |
| 3 | Recorded findings presented as open work | Three documented states (`lib/report.ts`): recorded finding (historical, never changes), awaiting review (`operator_review_required && decision === null`), saved decision (records a choice only). API and fixtures add `awaiting_review` per mission. Insights keeps "14 ... recorded in 13 of those runs" and adds "N of 15 serious findings ... have no saved operator decision yet". The Live queue shows "N so far · K awaiting review" and each row's decision state. Buttons read "Dispatch a tech / Watch / Dismiss" and become "Dispatch recorded / Watch recorded / Dismissal recorded"; the success message says the decision does not notify a technician or mark the equipment fixed. Report, asset history, mission index, Live queue and Insights all read the saved decision after reload. | `lib/report.ts`, `components/report/*`, `components/live/RightRail.tsx`, `lib/insights.ts`, `backend/src/routes/missions.js` |
| 4 | Recommendations exceed evidence | The V1/V2 sentence gives counts and calls the gap an observed association. A new "V1 vs V2 by inspection type" table shows every denominator, the point difference, "small sample" under 20 steps and "no steps" for an empty side (`GET /api/insights` adds `byConfigType`). The battery sentence shows 3 of 11 vs 218 of 259, says the rate is uncertain, and labels 20% a suggested heuristic (chart: "Suggested: dock before 20%"). Location text separates "most findings" (with step denominators) from "lowest step success" (stops with 10+ steps); "walk it first" and "hotspot" wording are gone. Repeat-asset findings are a new card linking each asset's history. | `lib/insights.ts`, `components/insights/*`, `app/insights/page.tsx`, `backend/src/routes/insights.js` |
| 5 | AI summaries narrow and primary | Every report leads with a record-based summary: status, configuration and date, battery endpoints, each failed step with its cause, each serious finding with priority, and questionable equipment readings kept apart from robot localization telemetry. It renders on the server before and regardless of the model. The Falconsai draft is an optional "Draft with AI" extra underneath, with an explicit statement that ID/number membership cannot tell whether a number is on the right field. A rejected or failed draft leaves the record summary unchanged. | `lib/mission-summary-input.ts`, `components/report/MissionExplanation.tsx` |
| 6 | Fresh install and hosted coverage weak | Mock mode serves all 27 missions (`lib/mock/missions-detail.json`, generated by `lib/mock/build_missions.py`, which refuses to write unless M014 equals the hand-checked fixture) and shows a banner that decisions last only until reload. Added `npm run migrate`, filled `.env.example` files, a backend README (variables, migration order, seeding, endpoints, what a decision means, deployment, troubleshooting) and a rewritten root README. Added app-level loading and error states. | `lib/api.ts`, `app/layout.tsx`, `app/loading.tsx`, `app/error.tsx`, `backend/scripts/migrate.js`, READMEs |
| 7 | Asset API omits action history | `GET /api/assets/:id` returns `actions` in the fixture shape. Asset Detail adds "Failed steps": no-reading failures, readings kept despite a failure, walk failures marked as robot navigation, and steps run away from the asset's home stop. | `backend/src/routes/assets.js`, `lib/asset.ts`, `components/asset/FailedSteps.tsx` |

## Commands and scenarios actually verified

| Check | Result |
|---|---|
| `npm test` (root Vitest) | 81/81 passed in 12 files (was 64 in 9). New coverage: mission filters; Live sync (M014 at 02:15:00, two seeks with the same played events, backward seeks, reconstruction label); review states and decision wording; Insights wording and `byConfigType`; location rankings; record summary and AI-draft handling; failed-step context; mock coverage of every linked mission. |
| `npm test` in `map-sim/` | 64/64 passed (node test runner). |
| `npm run lint`, `npx tsc --noEmit` | Passed. |
| Backend `node --check` on every file | Passed. |
| `npm run build` | Passed in a fresh clone with its own `.next`; the running dev server's output directory was never used for a build. No workspace-root warning. |
| CI on PR 16 | Frontend and Backend jobs passed on the first push; the Vercel preview build succeeded. |
| Client bundle secret scan | No `neon.tech`, `postgresql://` or `DATABASE_URL` in `.next/static`. |
| `python scripts/check-mission-fixture.py` | M014 fixture matches the CSVs. |
| `python audit/final-check.py` (extended) | 7/7 Insights groups (now including `byConfigType`) match CSV-recomputed values in the API and the fixtures. 27/27 missions and 20/20 assets: no record discrepancy; `awaiting_review` agrees with each mission's problems in both endpoints; every mock mission and asset fixture equals the API apart from decision state; all 20 asset endpoints return `actions` matching `actions.csv`, including 61 actions logged away from an asset's home stop. 404/400 probes as expected. `/missions` links all 27 reports and has no placeholder. |
| Fresh setup | Cloned the branch, `npm ci` (root and backend), copied `.env.example` files, `npm run migrate` (twice; the second run skips tables), `npm run seed` (15/20/27/270/220/40/500 rows), `testConnection`, `npm run dev`, then `npm run build` and `next start`, against a throwaway local Postgres 17 cluster in the session scratch directory. |
| Operator journey (fresh build, synthetic DB) | Missions → V1 + serious findings (9 results, URL updated) → M014 report (record summary lists the 3 failed steps and 2 serious findings) → PANEL-212 asset history (failed steps, including M014's no-reading timeout) → back → Watch on PANEL-212 → message says the decision was recorded, not a dispatch or a fix → reload: report shows "Decision saved · Watch" and "1 of 2 awaiting review"; mission index shows 1 awaiting review for M014; asset page shows the decision; Live queue shows "Decision saved: Watch" and "1 awaiting review"; Insights shows 14 of 15 awaiting. One row in `operator_decisions` (AN035, watch). |
| Replay in the browser | At `?mission=M014&at=02:15:00` map and panel both show step 6, gauge reading, WP07, inspecting (started 02:14:37). Play at 60×, pause (position stable), jump back to step 2 (both move to step 3, walking to WP06), play to the end, restart from the start. |
| Real browser inference | One Falconsai run on M014 in the browser produced a draft naming the mission, configuration, battery endpoints and review counts; it again omitted the failed steps and was shown as secondary under the record summary. Model failure, rejection, and a swapped-number draft that passes the membership check are covered by component tests. |
| Narrow screen (375 px) | No horizontal page scroll on Missions, the M014 report, PANEL-212, Insights or Live, after fixing table screen-reader text that escaped its scroll box. Wide tables scroll inside focusable regions. |
| API failure | With the API stopped, pages show "Couldn't load this page" with Try again instead of a blank page. |
| Decision writes | Only against the throwaway local database. No decision was written to the team's Neon database. |

## Remaining limitations

- **Hosted demo.** Added after the first pass: the API now runs on Railway (`https://api-production-efbcb.up.railway.app`, same Neon database). `WATCHDOG_API=<that URL> python audit/final-check.py` passed in full against it (all Insights groups, 27/27 missions, 20/20 assets with actions, 404/400 probes; `audit/final-check-results-railway.json`), and its SSE replay stream returns events. Vercel Production and Preview now set `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_BASE` to it. A preview of this branch built with those variables served `/missions`, `/missions/M014`, `/missions/M017`, `/assets/PANEL-212` and `/insights` from the hosted API (no mock banner; M017 resolves; M014 shows its saved Neon decision), fetched through `vercel curl` because previews sit behind Vercel Authentication. Production (`knight-hacks2026.vercel.app`) still serves the old `main` until this PR merges and Vercel redeploys. No decision was written through the hosted site.
- **SSE replay endpoint.** The Live page reconstructs from mission records; `GET /api/replay` timings were not re-validated.
- **Analysis depth.** Insights remains descriptive. The by-type comparison rules out inspection mix as the whole explanation for the V1/V2 gap, but not route, stop, timing or battery. All 11 sub-20% battery steps were step 9 or 10 of V1 missions, so battery cannot be separated from mission position or configuration in this data.
- **AI wording.** The membership check still cannot detect a known number on the wrong field; the UI makes that irrelevant to the authoritative summary rather than solving it.
- **Accessibility and usability.** Keyboard operation relies on native controls and was spot-checked; no screen-reader pass, contrast audit or timed operator study was done.
- **Mock decisions** are page-local by design and say so.
- **PR 15** (what-if scenarios on Live) is still open and touches the same Live files; whichever merges second needs a small rebase around the map's clock props.

## Revised score (same rubric and reviewer-defined thresholds)

| Kit theme | Before | After | Evidence and remaining limit |
|---|---:|---:|---|
| Operational usefulness | 3 | 4 | The find → inspect → asset history → decide → reload journey works and stays consistent across five screens; review state is explicit. No measured operator time saving. |
| Insight | 3 | 4 | Configuration-by-type with denominators, separate count and rate rankings, repeat-asset view with links, battery sample size. Still descriptive; no adjustment for route or battery exposure. |
| Usability | 3 | 4 | Mission index with combined filters and explained empty results, loading and error states, verified narrow layouts, keyboard-operable controls. No formal accessibility audit or user study. |
| Technical execution | 3 | 4 | Replay sync fixed with regression tests; API and fixtures agree for all missions and assets; fresh setup and a new decision write → reload verified on a synthetic database; hosted Railway API and a Vercel preview reading it verified. No load testing; production redeploy happens on merge. |
| Creativity | 4 | 4 | Unchanged by design; nothing was added for feature count. |
| Explainability | 4 | 4 | Every recommendation shows its counts and assumptions; the authoritative summary is record-based and the AI limit is disclosed and tested. Kept at 4 because hosted behaviour and accessibility were not comprehensively validated. |
| **Total** | **20/30** | **24/30** | Meets the reviewer-defined overperformance threshold (at least 24, every theme at least 3, a coherent workflow with no known reproducible inconsistency) on local evidence. Still not an official judging score, percentile or probability of winning. |

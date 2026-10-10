# Watchdog: Map & Simulation

Floor plan, walkable grid, and A* pathfinding for the SPOT replay.

## Files
- `public/floorplan.png`: the 2-floor plan from the challenge kit (1095x595).
- `data/map.json`: the single source of truth for the map:
  - `stops`: WP01–WP15, **pixel position of each pin tip** on floorplan.png, plus name/zone/floor from locations.csv.
    (locations.csv x/y do NOT match the image, so they are not used.)
  - `grid`: walkable grid, 5 px cells, 219x119. `#` = walkable, `.` = blocked.
  - `stairs`: the one floor-1 <-> floor-2 link (top-middle stairs on F1, centre stairs on F2).
- `src/sim/astar.ts`: `NavGrid.route(from, to)` returns the polyline(s) the robot walks. Has no dependencies and no UI.
- `src/sim/spot.ts`: the animated SPOT robot dog (Canvas 2D, no images). `SpotAnimator`
  keeps heading + leg phase between frames, `drawSpot()` draws one frame.
  Modes: `idle`, `walk`, `inspect` (scan cone), `fail` (red ring, red eyes).
- `data/missions.json`: all 27 missions' actions and readings from the kit CSVs (synthetic data),
  built by `tools/build_missions.py`. The raw kit files stay out of git.
- `src/sim/scenario.ts`: mission alerts and the what-if scenarios (heat wave, obstacle at the
  dock). Pure functions, no drawing. See "Alerts and scenarios" below.
- `src/sim/health.ts`: component health score (from the data) and remaining life (simulated).
  See "Component health and remaining life" below.
- `src/sim/index.ts`: one import for everything above.
- `src/sim/types.ts`: shared types.
- `tools/build_grid.py`: builds the grid from hand-traced rectangles (rooms, corridors, doors).
- `tools/grid-editor.html`: paint cells to fix walls/doors, then download a new map.json.
- `tools/build_missions.py`: rebuilds data/missions.json from actions.csv + readings.csv.
- `tests/astar.test.ts`: routes all 210 stop pairs and fails loudly if any is unreachable.
- `tests/scenario.test.ts`: mission data checks, alert thresholds, and the dock obstacle detour from every stop.
- `tests/health.test.ts`: health scores add up to their reasons, life estimates, heat effect.

## Testing it on its own (no backend, no frontend needed)
Needs Node 22.6+ (for `--experimental-strip-types`).

    npm install          # one dev dependency: esbuild (only for the sandbox)
    npm test             # 55 automated tests (pathfinding, SPOT motion, alerts, scenarios, component health)
    npm run sandbox      # prints the exact URL to open, e.g. http://127.0.0.1:5173/sandbox/

`npm test` checks, for all 210 stop-to-stop routes: every route exists, never
touches a blocked cell (sampled every 0.5 px), starts/ends exactly on the
stops, uses the stairs only when the floor changes, and is as short as an
independent Dijkstra search. Small hand-made grids check the edge cases
(walls, diagonal corners, unreachable targets, same start and end).

Click a stop to see its components: health, estimated life left and why.
Tick "click to route" to click two stops (or any floor point) and watch SPOT
walk between them instead. Pick a mission and press "Replay mission" to watch SPOT do its real
steps from the data, with alerts as they happen. Tick "Heat wave" and/or
"Obstacle at the dock" to add a what-if scenario on top.

Grid editor: the same server prints its URL (…/tools/grid-editor.html).
Regenerate the grid from rectangles: `npm run grid` (needs Python 3; on
macOS/Linux use `python3 tools/build_grid.py` if `python` isn't found).

If the page doesn't load: use the URL the server printed (127.0.0.1, not
localhost). If the port is busy it moves to the next one by itself, and any
404 is logged in the terminal with the file path it looked for.

Note: `build_grid.py` overwrites the grid. If you hand-edit cells in the editor,
either stop using build_grid.py or copy the change into its rectangles.

## Alerts and scenarios
Every alert is tagged **DATA** (straight from the kit) or **SIMULATED** (only
exists because a scenario is on). The kit has no weather, no room temperature
and no thresholds, so each limit says where it comes from:

| Alert | Level | Limit and source |
|---|---|---|
| Failed step (obstacle, path blocked, sensor timeout, ...) | warning | the data |
| Low battery | warning | ≤ 20% (our threshold) |
| SPOT unsure of its position | warning | localization confidence < 60% (our threshold) |
| Questionable reading | info | quality = QUESTIONABLE in the data |
| Equipment running hot / overheating | warning / critical | ≥ 80°C / ≥ 90°C (our thresholds) |
| It's getting hot in here (simulated) | warning | air > 40°C |
| Too hot for SPOT: stop skipped (simulated) | critical | air > 45°C: SPOT's operating range is -20°C to 45°C (SPOT user guide) |
| Dock too hot to charge (simulated) | warning | air > 40°C at WP15: the charger works from 0°C to 40°C (SPOT user guide) |
| Obstacle in front of the dock (simulated) | warning / critical | re-routed / no way in |
| Component life left (simulated) | warning / critical | ≤ 18 / ≤ 6 months, raised when SPOT inspects it |

**Heat wave model** (`HEAT` in scenario.ts): indoor air starts at 26°C. The heat
wave adds half its strength (slider, default +16°C) at the start of the
mission, climbing to the full amount by the end. Machinery rooms run hotter
(mechanical +5°C, process +4°C, electrical +2°C), and floor 2 is +1°C. Equipment
readings rise 0.9°C per 1°C of extra air. Before each step SPOT checks the air
at the next stop and skips it if that's above 45°C.

**Obstacle at the dock**: when SPOT heads to WP15 Inspection Dock, an obstacle is
placed on its route just before the dock. SPOT only notices it when close,
stops, raises the alert, and re-plans around it (`NavGrid.withBlocked`).
WP15 being SPOT's charging dock is our assumption; the data doesn't say.

## Component health and remaining life
**Health score (0-100, from the data)**, per component over all 27 missions.
Each component starts at 100 and loses points, and every lost point is listed
as a reason on the stop card:

- readings near the limits (max 40 points): temperature ≥ 80°C −15, ≥ 70°C −6;
  pressure ≥ 140 psi −12, ≥ 125 psi −5; sound ≥ 80 dB −10, ≥ 75 dB −4;
  visual score < 72 −12, < 80 −5 (our bands; the data has no limits)
- failed inspections: −6 each (max 30), since its condition can't be confirmed
- QUESTIONABLE readings: −4 each (max 20)

Localization confidence is robot telemetry, so it never counts against a component.

**Remaining life (SIMULATED).** The data has no install dates or failure history,
and only ~10 days of readings (at most 7 of one kind per component), far too
little to forecast from a trend. So the estimate is built from stated assumptions
(`LIFE` in health.ts):

- design life by type: heat exchanger 20 yrs, electrical panel 25, pump 12,
  compressor 15, motor 15, valve 20, gauge 10
- every component is assumed half way through its design life
- life left = design life × 0.5 × (health / 100)²
- heat wave: life left halves for every +10°C (the "10 degree rule" of thumb)

A component belongs to the stop where SPOT inspects it most. Each stop's ring on
the map is coloured by its weakest component: red < 40, amber < 70, green ≥ 70.

To rebuild the mission data from the kit (paths to your copies of the CSVs):

    python tools/build_missions.py path/to/actions.csv path/to/readings.csv

## Using it
```ts
import { NavGrid, pointAlong, SpotAnimator, drawSpot, headingAlong } from "./src/sim/index.ts";
const nav = new NavGrid(map);                       // map = data/map.json
const r = nav.route(stopById.WP01, stopById.WP05);  // { legs, lengthPx, usesStairs }

// every animation frame:
const p = pointAlong(r.legs[0], distanceWalked);
animator.update(p.x * S, p.y * S, dtSeconds, bodyLen, headingAlong(r.legs[0], distanceWalked));
drawSpot(ctx, { x: p.x * S, y: p.y * S, heading: animator.heading, gait: animator.gait,
                walking: animator.walking, mode: "walk", size: bodyLen, t: now / 1000 });
```
Working example: `sandbox/index.html`.

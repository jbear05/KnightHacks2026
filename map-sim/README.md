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
- `src/sim/index.ts`: one import for everything above.
- `src/sim/types.ts`: shared types.
- `tools/build_grid.py`: builds the grid from hand-traced rectangles (rooms, corridors, doors).
- `tools/grid-editor.html`: paint cells to fix walls/doors, then download a new map.json.
- `tests/astar.test.ts`: routes all 210 stop pairs and fails loudly if any is unreachable.

## Testing it on its own (no backend, no frontend needed)
Needs Node 22.6+ (for `--experimental-strip-types`).

    npm install          # one dev dependency: esbuild (only for the sandbox)
    npm test             # 28 automated tests (pathfinding + SPOT motion)
    npm run sandbox      # prints the exact URL to open, e.g. http://127.0.0.1:5173/sandbox/

`npm test` checks, for all 210 stop-to-stop routes: every route exists, never
touches a blocked cell (sampled every 0.5 px), starts/ends exactly on the
stops, uses the stairs only when the floor changes, and is as short as an
independent Dijkstra search. Small hand-made grids check the edge cases
(walls, diagonal corners, unreachable targets, same start and end).

The sandbox lets you click two stops (or any floor point) and watch a dot walk
the route. "Replay M001 (with results)" walks the demo mission's real stop sequence and shows each action's result.

Grid editor: the same server prints its URL (…/tools/grid-editor.html).
Regenerate the grid from rectangles: `npm run grid` (needs Python 3; on
macOS/Linux use `python3 tools/build_grid.py` if `python` isn't found).

If the page doesn't load: use the URL the server printed (127.0.0.1, not
localhost). If the port is busy it moves to the next one by itself, and any
404 is logged in the terminal with the file path it looked for.

Note: `build_grid.py` overwrites the grid. If you hand-edit cells in the editor,
either stop using build_grid.py or copy the change into its rectangles.

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

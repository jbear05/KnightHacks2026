// <FacilityMap /> props: PROPOSAL from Design & Frontend for Map & Simulation.
// Status: reviewed by Map & Sim (Fatima, 2026-10-10). Q1-Q3 answered at the
// bottom; changes from the first draft are listed under "Map & Sim review".
// Decisions from Jair (2026-10-10) are in "Decided" at the bottom.
//
// Design principle: the map is a CONTROLLED component. Frontend's useReplay()
// hook (Step 2.5) owns the event stream and playback clock and passes events
// down. The map owns everything visual: pin placement, A* paths, SPOT
// animation, trail, heatmap colouring. One stream, so the map, event feed,
// battery gauge and Attention Queue can never disagree.
//
// Shared types (LiveEvent, Severity, ...) live in ./types.ts, owned by the
// "Shared types and endpoints" thread. Types below that are map-only stay here.

import type { Action, LiveEvent } from "./types";

export type LocationId = string;   // "WP01".."WP15"
export type Floor = 1 | 2;         // WP01-WP10 on floor 1, WP11-WP15 on floor 2

// ---------------------------------------------------------------------------
// Static waypoint info (from locations.csv / GET /api/locations)
// ---------------------------------------------------------------------------
export interface MapLocation {
  location_id: LocationId;
  location_name: string;           // "Pipe Gallery"
  zone_type: "ACCESS" | "ELECTRICAL" | "MECHANICAL" | "PROCESS";
  floor: Floor;
  environment: "NORMAL" | "HIGH_NOISE" | "LOW_LIGHT" | "INDOOR_DRY" | "INDOOR_DUSTY";
  // Pixel position is NOT here on purpose: the x_coord/y_coord in
  // locations.csv do not line up with the pins on fictional_floor_plan.png.
  // Map & Sim owns a pin-position table (e.g. lib/map/pins.ts) traced from
  // the image. DECIDED: the Map & Sim (simulator) person traces them and keeps
  // the table inside the component.
  // DONE: all 15 pins traced, together with the walkable grid A* uses and the
  // floor-1 <-> floor-2 stairs link (map.json in the Map & Sim module).
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FacilityMapBase {
  /** All 15 waypoints. DECIDED (Q3): bundled in the component, so the map
   *  works with no API call. Pass this only to override names/zones from the
   *  DB; pins without a matching location_id keep the bundled values. */
  locations?: MapLocation[];

  /** Which floor is shown. Controlled if set; otherwise the map follows SPOT
   *  in live mode and defaults to floor 1 in heatmap mode. The map renders
   *  its own floor 1 / floor 2 toggle. One floor-plan image per floor; when
   *  SPOT changes floors the map animates the move (stairs/lift) and, if
   *  uncontrolled, switches the shown floor.
   *  Map & Sim: also accepts "both" (both floors side by side, as in the
   *  challenge kit's floor plan), so SPOT never leaves the screen on the ~half
   *  of walks that change floor. Per-floor views are crops of the same image,
   *  no extra assets. The default stays Jair's call (currently: follow SPOT). */
  floor?: Floor | "both";
  onFloorChange?: (floor: Floor | "both") => void;

  /** Highlighted pin (ring + raised label), e.g. the location of the problem
   *  open in the side panel or the row hovered in a list. */
  selectedLocationId?: LocationId | null;

  /** Fired when an operator clicks a pin. Frontend decides what opens
   *  (Live: filter feed / Attention Queue; Insights: drill into that stop). */
  onSelectLocation?: (locationId: LocationId) => void;

  /** Fired on pin hover so the rest of the page can cross-highlight. */
  onHoverLocation?: (locationId: LocationId | null) => void;

  /** Theme comes from CSS variables in the app shell (dark "control room").
   *  The map should read --color-* tokens, not hard-code colours.
   *  Map & Sim reads these (fallback in brackets; rename freely, just tell us):
   *    --color-success  (#3fb950)  visited stop, step OK
   *    --color-danger   (#f85149)  failed step, CRITICAL/HIGH badge
   *    --color-warning  (#d29922)  warning badge, battery < 20%
   *    --color-accent   (#58a6ff)  selected pin ring, route line
   *    --color-surface  (#0d1117)  letterbox background, badge fill
   *    --color-text     (#e6edf3)  labels
   *  SPOT itself stays yellow/black like the real robot.
   *
   *  Sizing (Q1): the map fills its parent (100% x 100%) and keeps the floor
   *  plan's aspect ratio, letterboxed in --color-surface. Redraws on resize
   *  and is sharp on high-DPI screens. Give the parent a height. */
  className?: string;
}

/** What SPOT is doing right now. Sent by onSpotStatus (replaces onArrive). */
export interface SpotStatus {
  mode: "idle" | "walking" | "inspecting" | "failed" | "done";
  /** Where SPOT is heading (walking) or standing (other modes). */
  location_id: LocationId | null;
  /** The action SPOT is walking to or performing; null when idle/done. */
  action_id: string | null;
  /** Latest known battery, for the SPOT badge and the battery gauge. */
  battery_pct: number | null;
}

/** Live Mission screen: SPOT walks the route as events arrive. */
export interface FacilityMapLiveProps extends FacilityMapBase {
  mode: "live";

  /** Events played so far for the current mission, oldest first (the same
   *  array the event feed renders). The map derives from it:
   *   - SPOT's target: details.location_id of the latest ACTION_STARTED
   *   - trail colour per stop: ACTION_COMPLETED = green, ACTION_FAILED = red
   *   - battery for the SPOT badge: latest details.battery_pct
   *  Seeking backwards just passes a shorter array, so the map must handle
   *  the array shrinking (re-derive, no animation). */
  events: LiveEvent[];

  /** Map & Sim review: please pass the mission's actions here
   *  (MissionDetail.actions from GET /api/missions/:id, sorted by sequence).
   *
   *  Why: ACTION_STARTED at 18:06:12 for WP10 means SPOT is ALREADY AT WP10 at
   *  18:06:12 (in replay.ndjson, STARTED and COMPLETED share one timestamp).
   *  With `events` alone the map only learns the next stop when that event
   *  arrives, so SPOT always walks AFTER it and lags the feed. At 1x that is
   *  up to ~3 minutes of "Visual check at Valve Station" in the feed while
   *  SPOT is still crossing the plant. With the plan, SPOT walks during the
   *  gap before each event and arrives on time (walk = gap - duration_sec,
   *  then inspect for duration_sec, then the event fires).
   *
   *  Optional: without it the map still works and falls back to walking after
   *  each ACTION_STARTED. The plan never decides WHAT happened (success,
   *  failure, problems all come from `events`); it only gives the route ahead. */
  plan?: Action[];

  /** Playback speed so the A* walk animation lasts about as long as the gap
   *  to the next event (1 / 10 / 60).
   *  Map & Sim: between events the map advances its own mission clock from
   *  the latest event's timestamp at `speed`, so SPOT moves smoothly and never
   *  runs past the next planned action. No per-frame prop updates needed. */
  speed: 1 | 10 | 60;

  /** false = freeze SPOT mid-walk (legs stop, position holds). */
  playing: boolean;

  /** Stops with an open HIGH/CRITICAL problem in this mission get a warning
   *  badge on the pin. Frontend computes this from Problem[]. */
  alertLocationIds?: LocationId[];

  /** Optional: operator asked for a re-inspection (team plan section on
   *  operator actions). The map draws the re-route; Frontend shows the button.
   *  STRETCH GOAL: not needed for the demo. */
  reinspectLocationId?: LocationId | null;

  /** STRETCH GOAL. Optional weather add-on (FRONTEND_PLAN.md section 9). Map &
   *  Sim shows the effect (e.g. wet floors near WP01 / WP15, A* routes around
   *  them). */
  weather?: "normal" | "heat_wave" | "storm";

  /** DECIDED (Q2), replaces onArrive: fired whenever SPOT's status changes
   *  (starts walking, arrives and starts inspecting, fails, finishes), so the
   *  "Current action" card can show "Walking to Pump Bay" -> "Heat check at
   *  Pump Bay" without guessing. With `plan`, "inspecting" fires duration_sec
   *  BEFORE the matching ACTION_STARTED event; without `plan` it fires on it.
   *  Not fired while seeking. */
  onSpotStatus?: (status: SpotStatus) => void;
}

/** Insights screen: static heatmap, no robot. */
export interface FacilityMapHeatmapProps extends FacilityMapBase {
  mode: "heatmap";

  /** Value per waypoint. Waypoints missing from the record render as 0 /
   *  neutral. Frontend computes this from GET /api/insights byLocation[]. */
  heat: Partial<Record<LocationId, number>>;

  /** What the number means, for the legend and pin tooltip.
   *  Default "anomalies". */
  heatMetric?: "anomalies" | "failure_rate" | "priority_sum";

  /** Fixed colour scale range. Default [0, max(heat)]. Use a fixed range when
   *  comparing V1 vs V2 side by side so both maps share one scale. */
  heatDomain?: [number, number];

  /** Tooltip text per pin, e.g. "Pipe Gallery: 9 problems, 3 serious".
   *  Frontend supplies plain-English copy; map falls back to name + value. */
  heatLabel?: (locationId: LocationId, value: number) => string;

  // Map & Sim: the heat colour scale is colour-blind safe (one hue, light to
  // dark) and every pin also prints its number, so colour is never the only cue.
}

export type FacilityMapProps = FacilityMapLiveProps | FacilityMapHeatmapProps;

// ---------------------------------------------------------------------------
// Replay control bar (Decided #1: Map & Sim builds it, Frontend styles it)
// ---------------------------------------------------------------------------
// Map & Sim review: the first draft didn't define these props. Proposal: a
// separate <ReplayControls /> so it can sit under the map or in a header bar.
// Everything comes straight from useReplay(); the bar holds no state itself.
export interface ReplayControlsProps {
  playing: boolean;
  speed: 1 | 10 | 60;
  /** Index of the last event played (-1 before the first). */
  position: number;
  /** Events in the whole mission, for the scrubber length. */
  total: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: 1 | 10 | 60) => void;
  /** Scrub to an event index. The map jumps SPOT there without animating. */
  onSeek: (eventIndex: number) => void;
  /** Optional ticks on the scrubber, e.g. failed steps and serious problems,
   *  so the operator can jump straight to them. */
  markers?: Array<{ eventIndex: number; kind: "failed" | "problem" }>;
  /** Timestamp of the event at `position`, shown as plant time ("18:06:12"). */
  currentTime?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Usage sketches
// ---------------------------------------------------------------------------
// Live Mission (left 65% slot):
//   const replay = useReplay("M014", 60);
//   const { data: mission } = useMission("M014");          // GET /api/missions/M014
//   <FacilityMap mode="live" events={replay.events} plan={mission?.actions}
//     speed={replay.speed} playing={replay.playing}
//     alertLocationIds={["WP06"]} onSelectLocation={openStop}
//     onSpotStatus={setCurrentAction} />
//   <ReplayControls playing={replay.playing} speed={replay.speed}
//     position={replay.events.length - 1} total={replay.total}
//     onPlay={replay.play} onPause={replay.pause}
//     onSpeedChange={replay.setSpeed} onSeek={replay.seek} />
//
// Insights (map heatmap slot):
//   <FacilityMap mode="heatmap" heat={{ WP05: 9, WP06: 4 }} heatMetric="anomalies"
//     onSelectLocation={drillIntoStop} />
//
// ---------------------------------------------------------------------------
// Decided (Jair, 2026-10-10)
// ---------------------------------------------------------------------------
// 1. Replay controls call Frontend's useReplay: play(), pause(),
//    setSpeed(1 | 10 | 60), seek(eventIndex). Map & Sim builds the control
//    bar UI; Frontend styles it.
// 2. Pin positions: traced from fictional_floor_plan.png by the Map & Sim
//    (simulator) person, kept inside the component.
// 3. Two floors: one image per floor, and SPOT animates the floor change.
// 4. Re-inspection (reinspectLocationId) and weather are stretch goals.
//
// ---------------------------------------------------------------------------
// Questions for the Map & Sim reviewer: ANSWERED (Fatima, 2026-10-10)
// ---------------------------------------------------------------------------
// Q1. Sizing: should the map fill whatever space it is placed in
//     (width/height 100% of its parent) and keep the floor plan's aspect
//     ratio? Frontend gives it the left 65% of Live Mission and a card slot
//     on Insights.
//     A: Yes. Fills its parent, keeps the aspect ratio (letterboxed), redraws
//        on resize, sharp on high-DPI. The parent needs a height.
// Q2. "Arrived at stop" event: should the map call onArrive(locationId) when
//     the SPOT animation reaches a waypoint, so the Current action card can
//     switch from "Walking to Pump Bay" to "Heat check at Pump Bay"? Or is
//     ACTION_STARTED from the replay close enough and we skip it?
//     A: Yes, as onSpotStatus(status) (walking / inspecting / failed / idle /
//        done), which covers arriving and more. For it to line up with the
//        feed, pass `plan` (see the prop): without it SPOT can only start
//        walking once ACTION_STARTED arrives, i.e. after it should already be
//        there.
// Q3. Waypoint list: should the 15 waypoints (names, floors, zones) be built
//     into the map component, or passed in from the API as the `locations`
//     prop so names stay in sync with the database?
//     A: Built in. Pixel positions only exist in the map's own data, and the
//        names come from the same locations.csv the DB loads. `locations`
//        stays optional as an override.
//
// ---------------------------------------------------------------------------
// Map & Sim review: changes from the first draft
// ---------------------------------------------------------------------------
// 1. NEW optional `plan?: Action[]` on live props, so SPOT arrives on time.
// 2. `onArrive` -> `onSpotStatus` + `SpotStatus` type (Q2).
// 3. `floor` also accepts "both"; default unchanged (Jair's call).
// 4. NEW `ReplayControlsProps` for the control bar Map & Sim builds.
// 5. Listed the --color-* tokens the map reads, with fallbacks.
// 6. Behaviour notes, no type change: the map interpolates its own clock
//    between events; seeking (a shorter or jumped `events` array) moves SPOT
//    without animation; SPOT is placed by the ACTION's location_id, never the
//    asset's home (they differ in 61 of 270 actions); SPOT starts each mission
//    at WP01 Main Entrance (the data has no start position; our assumption,
//    worth a line in the demo footnotes).

// <FacilityMap /> props: PROPOSAL from Design & Frontend for Map & Simulation.
// Status: draft, to agree in the first hour (FRONTEND_PLAN.md, Step 1.1).
// Decisions from Jair (2026-10-10) are in "Decided" at the bottom.
// Lines marked "OPEN:" are questions still to settle with Map & Sim.
//
// Design principle: the map is a CONTROLLED component. Frontend's useReplay()
// hook (Step 2.5) owns the event stream and playback clock and passes events
// down. The map owns everything visual: pin placement, A* paths, SPOT
// animation, trail, heatmap colouring. One stream, so the map, event feed,
// battery gauge and Attention Queue can never disagree.
//
// Shared types (LiveEvent, Severity, ...) live in ./types.ts, owned by the
// "Shared types and endpoints" thread. Types below that are map-only stay here.

import type { LiveEvent } from "./types";

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
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FacilityMapBase {
  /** All 15 waypoints. Optional if Map & Sim bundles them; passing them keeps
   *  names in sync with the DB. OPEN: bundled or passed in? */
  locations?: MapLocation[];

  /** Which floor is shown. Controlled if set; otherwise the map follows SPOT
   *  in live mode and defaults to floor 1 in heatmap mode. The map renders
   *  its own floor 1 / floor 2 toggle. One floor-plan image per floor; when
   *  SPOT changes floors the map animates the move (stairs/lift) and, if
   *  uncontrolled, switches the shown floor. */
  floor?: Floor;
  onFloorChange?: (floor: Floor) => void;

  /** Highlighted pin (ring + raised label), e.g. the location of the problem
   *  open in the side panel or the row hovered in a list. */
  selectedLocationId?: LocationId | null;

  /** Fired when an operator clicks a pin. Frontend decides what opens
   *  (Live: filter feed / Attention Queue; Insights: drill into that stop). */
  onSelectLocation?: (locationId: LocationId) => void;

  /** Fired on pin hover so the rest of the page can cross-highlight. */
  onHoverLocation?: (locationId: LocationId | null) => void;

  /** Theme comes from CSS variables in the app shell (dark "control room").
   *  The map should read --color-* tokens, not hard-code colours. */
  className?: string;
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

  /** Playback speed so the A* walk animation lasts about as long as the gap
   *  to the next event (1 / 10 / 60). */
  speed: 1 | 10 | 60;

  /** false = freeze SPOT mid-walk. */
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

  /** Map tells Frontend when SPOT arrives at a stop, so the "Current action"
   *  card can switch from "Walking to Pump Bay" to "Heat check at Pump Bay".
   *  OPEN: needed, or is ACTION_STARTED close enough? */
  onArrive?: (locationId: LocationId) => void;
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
}

export type FacilityMapProps = FacilityMapLiveProps | FacilityMapHeatmapProps;

// ---------------------------------------------------------------------------
// Usage sketches
// ---------------------------------------------------------------------------
// Live Mission (left 65% slot):
//   const { events, speed, playing } = useReplay("M014", 60);
//   <FacilityMap mode="live" events={events} speed={speed} playing={playing}
//     alertLocationIds={["WP06"]} onSelectLocation={openStop} />
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
// Questions for the Map & Sim reviewer (please answer in the PR)
// ---------------------------------------------------------------------------
// Q1. Sizing: should the map fill whatever space it is placed in
//     (width/height 100% of its parent) and keep the floor plan's aspect
//     ratio? Frontend gives it the left 65% of Live Mission and a card slot
//     on Insights.
// Q2. "Arrived at stop" event: should the map call onArrive(locationId) when
//     the SPOT animation reaches a waypoint, so the Current action card can
//     switch from "Walking to Pump Bay" to "Heat check at Pump Bay"? Or is
//     ACTION_STARTED from the replay close enough and we skip it?
// Q3. Waypoint list: should the 15 waypoints (names, floors, zones) be built
//     into the map component, or passed in from the API as the `locations`
//     prop so names stay in sync with the database?

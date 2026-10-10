// Static reference tables from NextEra's synthetic kit (locations.csv, assets.csv).
// They never change during the event, so labels can be resolved without an API round trip.
// Live data (missions, problems, readings) still comes only from lib/api.ts.
import type { Asset, Location } from "./types";
import assets from "./reference/assets.json";
import locations from "./reference/locations.json";

export const LOCATIONS = Object.fromEntries((locations as Location[]).map((l) => [l.location_id, l]));
export const ASSETS = Object.fromEntries((assets as Asset[]).map((a) => [a.asset_id, a]));

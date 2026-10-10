// Shared types for the Map & Simulation module.

export interface Stop {
  id: string;          // "WP05"
  name: string;        // "Pipe Gallery"
  zone: string;        // ACCESS | ELECTRICAL | PROCESS | MECHANICAL
  floor: number;       // 1 | 2
  x: number;           // pixel on floorplan.png
  y: number;
}

export interface MapData {
  image: string;
  width: number;
  height: number;
  coord_note?: string;
  /** Pixel box of each floor in the image (floors sit side by side). */
  floors: Record<string, { x0: number; y0: number; x1: number; y1: number }>;
  stops: Stop[];
  grid: { cell: number; cols: number; rows_count: number; rows: string[] };
  stairs: {
    F1: { x: number; y: number; floor: number };
    F2: { x: number; y: number; floor: number };
    cost_sec: number;
  };
  /** Rectangles build_grid.py painted the grid from (stale after hand edits in the grid editor). */
  walk_rects?: { x0: number; y0: number; x1: number; y1: number; label: string }[];
}

/** A point on the map, in floorplan.png pixels. */
export interface Pt {
  x: number;
  y: number;
  floor: number;
}

/**
 * A route between two points. If it changes floor, it is split into legs:
 * leg 0 walks to the stairs, leg 1 walks from the other stairs end.
 */
export interface Route {
  legs: Pt[][];         // polylines, one per floor visited
  lengthPx: number;     // walking length (stairs excluded)
  usesStairs: boolean;
}

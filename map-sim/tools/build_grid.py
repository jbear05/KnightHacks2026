"""
Build the walkable grid for the floor plan from hand-traced rectangles.

Source of truth for the first draft: the WALK rectangles below (image pixel
coords on public/floorplan.png, 1095x595). Output: data/map.json gets
  grid.cell      -> cell size in px
  grid.rows      -> list of strings, '#' = walkable, '.' = blocked
  stairs         -> the cross-floor link A* is allowed to use
Fine-tune afterwards in tools/grid-editor.html (paint cells, export JSON).

Run:  python3 tools/build_grid.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "data" / "map.json"
CELL = 5

# (x0, y0, x1, y1, label)  -- inclusive-exclusive pixel boxes
WALK = [
    # ---------------- FLOOR 1 ----------------
    # corridors
    (160, 150, 305, 176, "F1 north corridor (west part)"),
    (305, 158, 640, 176, "F1 north corridor (above pipe gallery)"),
    (612, 150, 705, 378, "F1 east corridor / Control Room Corridor (WP07)"),
    (160, 337, 335, 356, "F1 south corridor (west part)"),
    (305, 300, 385, 322, "F1 south corridor (gallery SW corner, north of Turbine Hall)"),
    (305, 322, 335, 356, "F1 south corridor (link west of the Turbine Hall tank)"),
    (385, 300, 705, 322, "F1 south corridor (east part)"),
    (160, 337, 192, 445, "F1 west connector to entrance"),
    # rooms
    (60, 430, 160, 500, "WP01 Main Entrance apron"),
    (150, 425, 192, 445, "WP01 link to west connector"),
    (60, 252, 155, 420, "WP02 Electrical Room"),
    (165, 182, 300, 330, "WP03 Cooling Loop room"),
    (165, 42, 268, 144, "WP04 Pump Bay room"),
    (310, 180, 605, 292, "WP05 Pipe Gallery walkway"),
    (495, 42, 630, 140, "WP06 Compressor Area room"),  # x0 495: keeps a wall between the room and the F1 stairs
    (298, 362, 458, 500, "WP08 Turbine Hall North room"),
    (515, 325, 606, 500, "WP09 Turbine Hall South room"),
    (630, 386, 708, 505, "WP10 Valve Station room"),
    # doorways (bridge the walls between rooms and corridors)
    (155, 362, 165, 380, "door WP02 -> west connector"),
    (270, 328, 290, 340, "door WP03 -> south corridor"),
    (200, 146, 220, 152, "door WP04 -> north corridor"),
    (600, 138, 620, 160, "door WP06 -> north/east corridor"),
    (600, 188, 615, 210, "door Pipe Gallery east steps -> east corridor"),
    (310, 355, 330, 364, "door WP08 -> south corridor (west of the tank)"),
    (550, 318, 575, 328, "door WP09 -> south corridor"),
    (650, 374, 680, 390, "door WP10 -> east corridor"),
    (466, 45, 490, 160, "F1 stairs (top middle)"),
    # ---------------- FLOOR 2 ----------------
    (775, 225, 1065, 250, "F2 central corridor"),
    (915, 32, 935, 225, "F2 corridor between WP11 and WP12"),
    (778, 85, 912, 222, "WP11 Battery Room"),
    (938, 35, 1062, 222, "WP12 Heat Exchanger Area"),
    (778, 253, 910, 420, "WP13 Warehouse Corridor"),
    (940, 253, 1062, 420, "WP14 Auxiliary Systems Bay"),
    (778, 428, 1062, 548, "WP15 Inspection Dock"),
    (915, 250, 935, 400, "F2 stairs (centre)"),
    # doorways
    (840, 220, 862, 228, "door WP11 -> corridor"),
    (995, 220, 1020, 228, "door WP12 -> corridor"),
    (840, 248, 865, 256, "door WP13 -> corridor"),
    (990, 248, 1015, 256, "door WP14 -> corridor"),
    (868, 418, 895, 430, "door WP13 -> dock"),
    (1000, 418, 1025, 430, "door WP14 -> dock"),
]

# Cross-floor link. A* treats these two points as connected.
STAIRS = {
    "F1": {"x": 478, "y": 155, "floor": 1},
    "F2": {"x": 925, "y": 245, "floor": 2},
    # Each flight as drawn: landing (where it meets the floor, = the point above) -> far end.
    # Going up, SPOT climbs the F1 flight, fades, appears at the foot of the F2 flight and
    # climbs into the F2 corridor; going down is the reverse.
    "flight": {
        "F1": [{"x": 478, "y": 155}, {"x": 478, "y": 52}],
        "F2": [{"x": 925, "y": 245}, {"x": 925, "y": 395}],
    },
    "cost_sec": 25,  # time SPOT takes to climb one flight (assumption)
}


def main():
    m = json.loads(MAP.read_text(encoding="utf-8"))
    w, h = m["width"] // CELL, m["height"] // CELL
    rows = [["."] * w for _ in range(h)]
    for x0, y0, x1, y1, _ in WALK:
        for cy in range(h):
            for cx in range(w):
                px, py = cx * CELL + CELL / 2, cy * CELL + CELL / 2
                if x0 <= px < x1 and y0 <= py < y1:
                    rows[cy][cx] = "#"
    m["grid"] = {"cell": CELL, "cols": w, "rows_count": h, "rows": ["".join(r) for r in rows]}
    m["stairs"] = STAIRS
    m["walk_rects"] = [{"x0": a, "y0": b, "x1": c, "y1": d, "label": l} for a, b, c, d, l in WALK]

    # sanity: every stop and stair end must sit on a walkable cell
    bad = []
    for p in m["stops"] + [STAIRS["F1"], STAIRS["F2"]]:
        if rows[int(p["y"] // CELL)][int(p["x"] // CELL)] != "#":
            bad.append(p.get("id", f"stairs F{p['floor']}"))
    MAP.write_text(json.dumps(m, indent=1), encoding="utf-8", newline="\n")
    print(f"grid {w}x{h}, walkable cells: {sum(r.count('#') for r in rows)}")
    print("points off the grid:", bad or "none")


if __name__ == "__main__":
    main()

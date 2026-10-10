const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/locations
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                location_id,
                location_name,
                zone_type,
                floor,
                x_coord,
                y_coord,
                environment
            FROM locations
            ORDER BY location_id ASC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching locations:", error);

        res.status(500).json({
            error: "Failed to fetch locations"
        });
    }
});

module.exports = router;
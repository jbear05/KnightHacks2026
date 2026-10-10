const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/assets/:id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const assetResult = await pool.query(
            `
            SELECT
                a.asset_id,
                a.asset_name,
                a.asset_type,
                a.location_id,
                a.criticality,
                l.location_name
            FROM assets a
            JOIN locations l
                ON a.location_id = l.location_id
            WHERE a.asset_id = $1
            `,
            [id]
        );

        if (assetResult.rows.length === 0) {
            return res.status(404).json({
                error: "Asset not found"
            });
        }

        const readingsResult = await pool.query(
            `
            SELECT
                reading_id,
                action_id,
                mission_id,
                asset_id,
                location_id,
                timestamp,
                measurement_type,
                value,
                unit,
                quality
            FROM readings
            WHERE asset_id = $1
              AND measurement_type <> 'LOCALIZATION_CONFIDENCE_PCT'
            ORDER BY timestamp ASC, reading_id ASC
            `,
            [id]
        );

        const problemsResult = await pool.query(
            `
            SELECT *
            FROM problems
            WHERE asset_id = $1
            ORDER BY priority DESC, timestamp ASC, anomaly_id ASC
            `,
            [id]
        );

        res.json({
            ...assetResult.rows[0],
            readings: readingsResult.rows,
            problems: problemsResult.rows,
            normal_bands: []
        });

    } catch (error) {
        console.error("Error fetching asset:", error);

        res.status(500).json({
            error: "Failed to fetch asset"
        });
    }
});

module.exports = router;
const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

const validDecisions = new Set([
    "dispatch",
    "watch",
    "dismiss"
]);

// POST /api/problems/:id/decision
router.post("/:id/decision", async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, notes } = req.body ?? {};

        if (!validDecisions.has(decision)) {
            return res.status(400).json({
                error: "Decision must be dispatch, watch, or dismiss"
            });
        }

        if (
            notes !== undefined &&
            typeof notes !== "string"
        ) {
            return res.status(400).json({
                error: "Notes must be a string"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO operator_decisions
                (anomaly_id, decision, notes)
            SELECT
                anomaly_id, $2, $3
            FROM anomalies
            WHERE anomaly_id = $1
            RETURNING id
            `,
            [id, decision, notes ?? null]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: "Problem not found"
            });
        }

        // The problems view automatically selects
        // the latest operator decision.
        const updated = await pool.query(
            `
            SELECT *
            FROM problems
            WHERE anomaly_id = $1
            `,
            [id]
        );

        res.json(updated.rows[0]);

    } catch (error) {
        console.error("Error saving decision:", error);

        res.status(500).json({
            error: "Failed to save operator decision"
        });
    }
});

module.exports = router;
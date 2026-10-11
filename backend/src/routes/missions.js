const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/missions
router.get("/", async (req, res) => {
    try {
        const query = `
            SELECT
                m.mission_id,
                m.mission_name,
                m.scenario,
                m.configuration_version,
                m.start_time,
                m.end_time,
                m.duration_min,
                m.start_battery_pct,
                m.end_battery_pct,
                m.mission_status,

                COALESCE(a.failed_actions, 0)::int
                    AS failed_actions,

                COALESCE(p.serious_problems, 0)::int
                    AS serious_problems,

                COALESCE(p.hidden_problems, 0)::int
                    AS hidden_problems,

                COALESCE(p.awaiting_review, 0)::int
                    AS awaiting_review,

                EXISTS (
                    SELECT 1
                    FROM replay_events r
                    WHERE r.mission_id = m.mission_id
                ) AS in_replay

            FROM missions m

            LEFT JOIN (
                SELECT
                    mission_id,
                    COUNT(*) FILTER (
                        WHERE status = 'FAILED'
                    ) AS failed_actions
                FROM actions
                GROUP BY mission_id
            ) a ON a.mission_id = m.mission_id

            LEFT JOIN (
                SELECT
                    mission_id,
                    COUNT(*) FILTER (
                        WHERE severity IN ('HIGH', 'CRITICAL')
                    ) AS serious_problems,

                    COUNT(*) FILTER (
                        WHERE hidden_in_completed = TRUE
                    ) AS hidden_problems,

                    -- Flagged for review with no saved operator decision yet.
                    COUNT(*) FILTER (
                        WHERE operator_review_required = TRUE
                          AND decision IS NULL
                    ) AS awaiting_review

                FROM problems
                GROUP BY mission_id
            ) p ON p.mission_id = m.mission_id

            ORDER BY m.start_time ASC, m.mission_id ASC;
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching missions:", error);

        res.status(500).json({
            error: "Failed to fetch missions"
        });
    }
});

// GET /api/missions/:id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Retrieve the mission summary
        const missionResult = await pool.query(
            `
            SELECT
                m.mission_id,
                m.mission_name,
                m.scenario,
                m.configuration_version,
                m.start_time,
                m.end_time,
                m.duration_min,
                m.start_battery_pct,
                m.end_battery_pct,
                m.mission_status,

                (
                    SELECT COUNT(*)::int
                    FROM actions a
                    WHERE a.mission_id = m.mission_id
                      AND a.status = 'FAILED'
                ) AS failed_actions,

                (
                    SELECT COUNT(*)::int
                    FROM problems p
                    WHERE p.mission_id = m.mission_id
                      AND p.severity IN ('HIGH', 'CRITICAL')
                ) AS serious_problems,

                (
                    SELECT COUNT(*)::int
                    FROM problems p
                    WHERE p.mission_id = m.mission_id
                      AND p.hidden_in_completed = TRUE
                ) AS hidden_problems,

                (
                    SELECT COUNT(*)::int
                    FROM problems p
                    WHERE p.mission_id = m.mission_id
                      AND p.operator_review_required = TRUE
                      AND p.decision IS NULL
                ) AS awaiting_review,

                EXISTS (
                    SELECT 1
                    FROM replay_events r
                    WHERE r.mission_id = m.mission_id
                ) AS in_replay

            FROM missions m
            WHERE m.mission_id = $1
            `,
            [id]
        );

        if (missionResult.rows.length === 0) {
            return res.status(404).json({
                error: "Mission not found"
            });
        }

        // Retrieve actions in sequence
        const actionsResult = await pool.query(
            `
            SELECT
                action_id,
                mission_id,
                sequence,
                timestamp,
                location_id,
                asset_id,
                action_type,
                battery_pct,
                status,
                failure_type,
                duration_sec
            FROM actions
            WHERE mission_id = $1
            ORDER BY sequence ASC
            `,
            [id]
        );

        // Retrieve readings
        const readingsResult = await pool.query(
            `
            SELECT *
            FROM readings
            WHERE mission_id = $1
            ORDER BY timestamp ASC, reading_id ASC
            `,
            [id]
        );

        // Retrieve problems
        const problemsResult = await pool.query(
            `
            SELECT *
            FROM problems
            WHERE mission_id = $1
            ORDER BY priority DESC, timestamp ASC
            `,
            [id]
        );

        res.json({
            ...missionResult.rows[0],
            actions: actionsResult.rows,
            readings: readingsResult.rows,
            problems: problemsResult.rows,
            summary: null
        });

    } catch (error) {
        console.error("Error fetching mission details:", error);

        res.status(500).json({
            error: "Failed to fetch mission details"
        });
    }
});

module.exports = router;
const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

const VALID_SPEEDS = new Set([1, 10, 60]);

const EVENT_ORDER = {
    MISSION_STARTED: 0,
    ACTION_STARTED: 1,
    ACTION_COMPLETED: 2,
    ACTION_FAILED: 2,
    MISSION_COMPLETED: 3
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function sendEvent(res, event, name = null) {
    if (name) {
        res.write(`event: ${name}\n`);
    }

    res.write(`data: ${JSON.stringify(event)}\n\n`);
}

router.get("/", async (req, res) => {
    const missionId = req.query.mission;
    const speed = Number(req.query.speed ?? 1);
    const from = req.query.from;

    if (!missionId || typeof missionId !== "string") {
        return res.status(400).json({
            error: "A mission ID is required"
        });
    }

    if (!VALID_SPEEDS.has(speed)) {
        return res.status(400).json({
            error: "Speed must be 1, 10, or 60"
        });
    }

    if (from !== undefined && typeof from !== "string") {
        return res.status(400).json({
            error: "Invalid starting event ID"
        });
    }

    try {
        const missionResult = await pool.query(
            `SELECT mission_id FROM missions WHERE mission_id = $1`,
            [missionId]
        );

        if (missionResult.rows.length === 0) {
            return res.status(404).json({
                error: "Mission not found"
            });
        }

        const replayResult = await pool.query(
            `
            SELECT event_id, mission_id, timestamp,
                   event_type, details
            FROM replay_events
            WHERE mission_id = $1
            ORDER BY timestamp ASC, event_id ASC
            `,
            [missionId]
        );

        const problemsResult = await pool.query(
            `
            SELECT *
            FROM problems
            WHERE mission_id = $1
            ORDER BY timestamp ASC, anomaly_id ASC
            `,
            [missionId]
        );

        const replayEvents = replayResult.rows;
        const problems = problemsResult.rows;

        // Ensure ACTION_STARTED precedes completion events
        // when they share the same timestamp.
        replayEvents.sort((a, b) => {
            const timeDifference =
                a.timestamp.localeCompare(b.timestamp);

            if (timeDifference !== 0) {
                return timeDifference;
            }

            const orderA = EVENT_ORDER[a.event_type] ?? 10;
            const orderB = EVENT_ORDER[b.event_type] ?? 10;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            return a.event_id.localeCompare(b.event_id);
        });

        let startIndex = 0;

        if (from) {
            const index = replayEvents.findIndex(
                event => event.event_id === from
            );

            if (index === -1) {
                return res.status(400).json({
                    error: "Starting event not found in mission"
                });
            }

            startIndex = index;
        }

        // All validation is complete. Start SSE.
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        res.flushHeaders();

        let disconnected = false;

        res.on("close", () => {
            disconnected = true;
        });

        let previousTimestamp = null;
        let finished = false;

        for (let i = startIndex; i < replayEvents.length; i++) {
            if (disconnected) break;

            const event = replayEvents[i];

            if (previousTimestamp !== null) {
                const currentTime = new Date(event.timestamp).getTime();
                const previousTime = new Date(previousTimestamp).getTime();

                const delay = Math.max(
                    0,
                    (currentTime - previousTime) / speed
                );

                if (delay > 0) {
                    await sleep(delay);
                }
            }

            if (disconnected) break;

            sendEvent(res, event);

            // Inject problems immediately after their
            // corresponding action finishes.
            if (
                event.event_type === "ACTION_COMPLETED" ||
                event.event_type === "ACTION_FAILED"
            ) {
                const actionId = event.details?.action_id;

                const matchingProblems = problems.filter(
                    problem => problem.action_id === actionId
                );

                for (const problem of matchingProblems) {
                    sendEvent(res, {
                        event_id: `PROBLEM-${problem.anomaly_id}`,
                        mission_id: missionId,
                        timestamp: event.timestamp,
                        event_type: "PROBLEM_FOUND",
                        details: problem
                    });
                }
            }

            previousTimestamp = event.timestamp;

            if (event.event_type === "MISSION_COMPLETED") {
                finished = true;
            }
        }

        if (!disconnected) {
            sendEvent(res, {
                mission_id: missionId,
                reason: finished
                    ? "mission_finished"
                    : "log_ends"
            }, "end");

            res.end();
        }

    } catch (error) {
        console.error("Replay error:", error);

        if (!res.headersSent) {
            res.status(500).json({
                error: "Failed to stream mission replay"
            });
        } else {
            res.end();
        }
    }
});

module.exports = router;
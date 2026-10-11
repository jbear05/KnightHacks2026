const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

function rateStat(items, isSuccess) {
    const total = items.length;
    const succeeded = items.filter(isSuccess).length;

    return {
        total,
        succeeded,
        pct: total === 0
            ? 0
            : Math.round((succeeded / total) * 1000) / 10
    };
}

// GET /api/insights
router.get("/", async (req, res) => {
    try {
        const [
            missionsResult,
            actionsResult,
            problemsResult,
            locationsResult,
            assetsResult
        ] = await Promise.all([
            pool.query(`
                SELECT mission_id, configuration_version,
                       mission_status
                FROM missions
            `),

            pool.query(`
                SELECT action_id, mission_id, location_id,
                       action_type, battery_pct, status,
                       failure_type, configuration_version
                FROM actions
            `),

            pool.query(`
                SELECT anomaly_id, asset_id, location_id
                FROM problems
            `),

            pool.query(`
                SELECT location_id, location_name
                FROM locations
                ORDER BY location_id
            `),

            pool.query(`
                SELECT asset_id, asset_name
                FROM assets
            `)
        ]);

        const missions = missionsResult.rows;
        const actions = actionsResult.rows;
        const problems = problemsResult.rows;
        const locations = locationsResult.rows;
        const assets = assetsResult.rows;

        // 1. Compare V1 and V2
        const compare = {};

        for (const version of ["V1", "V2"]) {
            const versionMissions = missions.filter(
                m => m.configuration_version === version
            );

            const versionActions = actions.filter(
                a => a.configuration_version === version
            );

            compare[version] = {
                missions: rateStat(
                    versionMissions,
                    m => m.mission_status === "COMPLETED"
                ),
                actions: rateStat(
                    versionActions,
                    a => a.status === "SUCCESS"
                )
            };
        }

        // 2. Performance by facility location
        const byLocation = locations.map(location => {
            const localActions = actions.filter(
                a => a.location_id === location.location_id
            );

            const localProblems = problems.filter(
                p => p.location_id === location.location_id
            );

            const navigationActions = localActions.filter(
                a => a.action_type === "NAVIGATION"
            );

            const failedNavigation = navigationActions.filter(
                a => a.status === "FAILED"
            ).length;

            return {
                location_id: location.location_id,
                location_name: location.location_name,
                actions: rateStat(
                    localActions,
                    a => a.status === "SUCCESS"
                ),
                problems: localProblems.length,
                nav_failure_pct: navigationActions.length === 0
                    ? null
                    : Math.round(
                        failedNavigation /
                        navigationActions.length * 1000
                    ) / 10
            };
        });

        // 3. Performance by battery percentage
        const buckets = [
            { label: "<20%", min: 0, max: 19 },
            { label: "20-40%", min: 20, max: 39 },
            { label: "40-60%", min: 40, max: 59 },
            { label: "60-80%", min: 60, max: 79 },
            { label: "80-100%", min: 80, max: 100 }
        ];

        const batteryBuckets = buckets.map(bucket => {
            const bucketActions = actions.filter(a =>
                a.battery_pct !== null &&
                a.battery_pct >= bucket.min &&
                a.battery_pct <= bucket.max
            );

            return {
                ...bucket,
                actions: rateStat(
                    bucketActions,
                    a => a.status === "SUCCESS"
                )
            };
        });

        // 4. Performance by action type
        const actionTypes = [
            "NAVIGATION",
            "VISUAL_INSPECTION",
            "THERMAL_INSPECTION",
            "ACOUSTIC_INSPECTION",
            "GAUGE_READING"
        ];

        const byActionType = actionTypes.map(type => ({
            action_type: type,
            actions: rateStat(
                actions.filter(a => a.action_type === type),
                a => a.status === "SUCCESS"
            )
        }));

        // 5. Failure causes
        const failureCounts = new Map();

        for (const action of actions) {
            if (
                action.status === "FAILED" &&
                action.failure_type
            ) {
                failureCounts.set(
                    action.failure_type,
                    (failureCounts.get(action.failure_type) || 0) + 1
                );
            }
        }

        const failureCauses = [...failureCounts.entries()]
            .map(([failure_type, count]) => ({
                failure_type,
                count
            }))
            .sort((a, b) => b.count - a.count);

        // 6. Assets with repeated problems
        const repeatAssets = assets
            .map(asset => ({
                asset_id: asset.asset_id,
                asset_name: asset.asset_name,
                problems: problems.filter(
                    p => p.asset_id === asset.asset_id
                ).length
            }))
            .filter(asset => asset.problems > 1)
            .sort((a, b) => b.problems - a.problems);

        // 7. V1 vs V2 within each inspection type, so the configuration
        // comparison can be read with the inspection mix held fixed.
        const byConfigType = actionTypes.map(type => ({
            action_type: type,
            V1: rateStat(
                actions.filter(a => a.action_type === type && a.configuration_version === "V1"),
                a => a.status === "SUCCESS"
            ),
            V2: rateStat(
                actions.filter(a => a.action_type === type && a.configuration_version === "V2"),
                a => a.status === "SUCCESS"
            )
        }));

        res.json({
            compare,
            byConfigType,
            byLocation,
            batteryBuckets,
            byActionType,
            failureCauses,
            repeatAssets,
            soWhat: {}
        });

    } catch (error) {
        console.error("Error generating insights:", error);

        res.status(500).json({
            error: "Failed to generate insights"
        });
    }
});

module.exports = router;
CREATE OR REPLACE VIEW problems AS
SELECT
    an.anomaly_id,
    an.mission_id,
    an.action_id,
    an.timestamp,
    an.location_id,

    l.location_id || ' ' || l.location_name AS location,

    an.asset_id,
    a.asset_id || ' ' || a.asset_name AS asset,

    an.anomaly_type,
    an.severity,
    a.criticality AS asset_criticality,

    (
        CASE an.severity
            WHEN 'LOW' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'HIGH' THEN 3
            ELSE 4
        END
        *
        CASE a.criticality
            WHEN 'LOW' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'HIGH' THEN 3
            ELSE 4
        END
    ) AS priority,

    (
        m.mission_status = 'COMPLETED'
        AND an.severity IN ('HIGH', 'CRITICAL')
    ) AS hidden_in_completed,

    an.operator_review_required,
    an.description,
    d.decision

FROM anomalies an

JOIN missions m
    ON m.mission_id = an.mission_id

JOIN assets a
    ON a.asset_id = an.asset_id

JOIN locations l
    ON l.location_id = an.location_id

LEFT JOIN LATERAL (
    SELECT decision
    FROM operator_decisions od
    WHERE od.anomaly_id = an.anomaly_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1
) d ON true;
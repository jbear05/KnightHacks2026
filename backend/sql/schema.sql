-- Watchdog database schema (Neon / Postgres)
-- Column names match NextEra's CSVs in 02_DATA so the loader can copy them 1:1.
-- The "synthetic" column (always True) is dropped; the whole dataset is synthetic.

CREATE TABLE locations (
  location_id    VARCHAR(10) PRIMARY KEY,          -- WP01..WP15
  location_name  VARCHAR(50) NOT NULL,
  zone_type      VARCHAR(20) NOT NULL,             -- ACCESS, ELECTRICAL, MECHANICAL, PROCESS
  floor          SMALLINT    NOT NULL,             -- 1 or 2
  x_coord        NUMERIC(6,2) NOT NULL,
  y_coord        NUMERIC(6,2) NOT NULL,
  environment    VARCHAR(20) NOT NULL              -- NORMAL, HIGH_NOISE, LOW_LIGHT, INDOOR_DRY, INDOOR_DUSTY
);

CREATE TABLE assets (
  asset_id     VARCHAR(20) PRIMARY KEY,            -- e.g. PANEL-212
  asset_name   VARCHAR(50) NOT NULL,
  asset_type   VARCHAR(30) NOT NULL,
  location_id  VARCHAR(10) NOT NULL REFERENCES locations(location_id),
  criticality  VARCHAR(10) NOT NULL CHECK (criticality IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);

CREATE TABLE missions (
  mission_id             VARCHAR(20) PRIMARY KEY,  -- M001..M027
  mission_name           VARCHAR(60) NOT NULL,
  scenario               VARCHAR(10) NOT NULL CHECK (scenario IN ('BASELINE','IMPROVED')),
  configuration_version  VARCHAR(5)  NOT NULL CHECK (configuration_version IN ('V1','V2')),
  start_time             TIMESTAMP   NOT NULL,
  end_time               TIMESTAMP,
  duration_min           SMALLINT,
  start_battery_pct      SMALLINT CHECK (start_battery_pct BETWEEN 0 AND 100),
  end_battery_pct        SMALLINT CHECK (end_battery_pct BETWEEN 0 AND 100),
  mission_status         VARCHAR(20) NOT NULL CHECK (mission_status IN ('COMPLETED','FAILED')),
  operator_mode          VARCHAR(20) NOT NULL      -- always AUTOWALK in the data
);

CREATE TABLE actions (
  action_id              VARCHAR(20) PRIMARY KEY,  -- A0001..A0270
  mission_id             VARCHAR(20) NOT NULL REFERENCES missions(mission_id),
  sequence               SMALLINT    NOT NULL,     -- order within the mission
  timestamp              TIMESTAMP   NOT NULL,
  location_id            VARCHAR(10) NOT NULL REFERENCES locations(location_id),
  asset_id               VARCHAR(20) NOT NULL REFERENCES assets(asset_id),
  action_type            VARCHAR(30) NOT NULL CHECK (action_type IN
                           ('NAVIGATION','VISUAL_INSPECTION','THERMAL_INSPECTION','ACOUSTIC_INSPECTION','GAUGE_READING')),
  battery_pct            SMALLINT CHECK (battery_pct BETWEEN 0 AND 100),
  status                 VARCHAR(10) NOT NULL CHECK (status IN ('SUCCESS','FAILED')),
  failure_type           VARCHAR(30),              -- NULL when status = SUCCESS
  duration_sec           SMALLINT,
  scenario               VARCHAR(10) NOT NULL,     -- copied from mission (kept as in the CSV)
  configuration_version  VARCHAR(5)  NOT NULL,
  UNIQUE (mission_id, sequence)
);

CREATE TABLE readings (
  reading_id        VARCHAR(20) PRIMARY KEY,       -- R0001..R0220
  action_id         VARCHAR(20) NOT NULL REFERENCES actions(action_id),
  mission_id        VARCHAR(20) NOT NULL REFERENCES missions(mission_id),
  asset_id          VARCHAR(20) NOT NULL REFERENCES assets(asset_id),
  location_id       VARCHAR(10) NOT NULL REFERENCES locations(location_id),
  timestamp         TIMESTAMP   NOT NULL,
  measurement_type  VARCHAR(30) NOT NULL,          -- TEMPERATURE_C, SOUND_DB, PRESSURE_PSI, VISUAL_SCORE, LOCALIZATION_CONFIDENCE_PCT
  value             NUMERIC(10,2) NOT NULL,
  unit              VARCHAR(10) NOT NULL,          -- C, dB, psi, score, pct
  quality           VARCHAR(15) NOT NULL CHECK (quality IN ('GOOD','QUESTIONABLE'))
);

CREATE TABLE anomalies (
  anomaly_id                VARCHAR(20) PRIMARY KEY,  -- AN001..AN040
  action_id                 VARCHAR(20) NOT NULL REFERENCES actions(action_id),
  mission_id                VARCHAR(20) NOT NULL REFERENCES missions(mission_id),
  location_id               VARCHAR(10) NOT NULL REFERENCES locations(location_id),
  asset_id                  VARCHAR(20) NOT NULL REFERENCES assets(asset_id),
  timestamp                 TIMESTAMP   NOT NULL,
  anomaly_type              VARCHAR(30) NOT NULL,
  severity                  VARCHAR(10) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  operator_review_required  BOOLEAN     NOT NULL,
  description               TEXT
);

CREATE TABLE replay_events (
  event_id    VARCHAR(20) PRIMARY KEY,             -- E00001..E00500
  mission_id  VARCHAR(20) NOT NULL REFERENCES missions(mission_id),
  timestamp   TIMESTAMP   NOT NULL,
  event_type  VARCHAR(30) NOT NULL CHECK (event_type IN
                ('MISSION_STARTED','MISSION_COMPLETED','ACTION_STARTED','ACTION_COMPLETED','ACTION_FAILED')),
  details     JSONB       NOT NULL                 -- copied as-is from replay.ndjson
);

-- Written by the app when an operator acts on a problem. One row per decision, so history is kept.
CREATE TABLE operator_decisions (
  id          BIGSERIAL PRIMARY KEY,
  anomaly_id  VARCHAR(20) NOT NULL REFERENCES anomalies(anomaly_id),
  decision    VARCHAR(10) NOT NULL CHECK (decision IN ('dispatch','watch','dismiss')),
  notes       TEXT,
  decided_by  VARCHAR(50),
  created_at  TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX ON actions (mission_id);
... (30 lines left)
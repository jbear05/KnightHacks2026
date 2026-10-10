const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");

const missionRoutes = require("./routes/missions");
const locationRoutes = require("./routes/locations");
const assetRoutes = require("./routes/assets");
const problemRoutes = require("./routes/problems");
const insightsRoutes = require("./routes/insights");
const replayRoutes = require("./routes/replay");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic server health check
app.get("/", (req, res) => {
    res.json({
        application: "Watchdog",
        status: "running"
    });
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database, NOW() AS time"
        );

        res.json({
            status: "ok",
            database: result.rows[0].database,
            time: result.rows[0].time
        });

    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            error: "Database connection failed"
        });
    }
});


// Handle unknown routes
app.use("/api/missions", missionRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/replay", replayRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: "Endpoint not found"
    });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Watchdog API running on port ${PORT}`);
});
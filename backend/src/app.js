const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");

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

// Temporary endpoint to test the problems view
app.get("/api/problems", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM problems ORDER BY priority DESC"
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Error fetching problems:", error);

        res.status(500).json({
            error: "Failed to fetch problems"
        });
    }
});

// Handle unknown routes
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
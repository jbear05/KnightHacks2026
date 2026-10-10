const { Pool, types } = require("pg");
require("dotenv").config({ override: true });

// PostgreSQL TIMESTAMP -> ISO-like string
// Example: 2026-09-01T18:03:06
types.setTypeParser(1114, (value) =>
    value.replace(" ", "T")
);

// PostgreSQL NUMERIC -> JavaScript number
types.setTypeParser(1700, (value) =>
    parseFloat(value)
);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000
});

module.exports = pool;
const pool = require("../src/db/pool");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT current_database(), NOW()"
    );

    console.log("Connected to Neon PostgreSQL!");
    console.log(result.rows[0]);
  } catch (error) {
      if (error.errors) {
        for (const e of error.errors) {
          console.error({
            code: e.code,
            address: e.address,
            port: e.port
          });
        }
      }
      console.error("Database connection failed!");
      console.error("Error name:", error.name);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Cause:", error.cause?.message);
      process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();
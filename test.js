const pool = require("./db");

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Connected to Railway Postgres:", result.rows[0]);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  } finally {
    pool.end();
  }
})();

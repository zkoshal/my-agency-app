const pool = require("./db");

async function dropTables() {
  try {
    // Drop in dependency order to avoid foreign key conflicts
    await pool.query("DROP TABLE IF EXISTS brand_teams CASCADE");
    await pool.query("DROP TABLE IF EXISTS team_members CASCADE");
    await pool.query("DROP TABLE IF EXISTS brands CASCADE");

    await pool.query("DROP TABLE IF EXISTS assignees CASCADE");
    await pool.query("DROP TABLE IF EXISTS files CASCADE");
    await pool.query("DROP TABLE IF EXISTS rejectionLog CASCADE");
    await pool.query("DROP TABLE IF EXISTS feedbackLog CASCADE");
    await pool.query("DROP TABLE IF EXISTS rescheduleLog CASCADE");
    await pool.query("DROP TABLE IF EXISTS projects CASCADE");

    console.log("✅ All tables dropped successfully");
  } catch (err) {
    console.error("❌ Error dropping tables:", err.message);
  } finally {
    pool.end();
  }
}

dropTables();

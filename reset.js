const pool = require("./db");

async function reset() {
  try {
    // Delete in dependency order
    await pool.query("DELETE FROM brand_teams");
    await pool.query("DELETE FROM team_members");
    await pool.query("DELETE FROM brands");

    await pool.query("DELETE FROM assignees");
    await pool.query("DELETE FROM files");
    await pool.query("DELETE FROM rejectionLog");
    await pool.query("DELETE FROM feedbackLog");
    await pool.query("DELETE FROM rescheduleLog");
    await pool.query("DELETE FROM projects");

    // Reset sequences for SERIAL columns
    await pool.query("ALTER SEQUENCE assignees_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE files_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE rejectionlog_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE feedbacklog_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE reschedulelog_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE brands_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE team_members_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE brand_teams_id_seq RESTART WITH 1");

    console.log("✅ All data deleted and ID sequences reset");
  } catch (err) {
    console.error("❌ Error resetting data:", err.message);
  } finally {
    pool.end();
  }
}

reset();

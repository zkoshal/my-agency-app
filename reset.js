const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./app.db");

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS projects");
  db.run("DROP TABLE IF EXISTS assignees");
  db.run("DROP TABLE IF EXISTS rejectionLog");
  db.run("DROP TABLE IF EXISTS feedbackLog");
  db.run("DROP TABLE IF EXISTS rescheduleLog");
  db.run("DROP TABLE IF EXISTS files");
  db.run("DROP TABLE IF EXISTS brands");
  db.run("DROP TABLE IF EXISTS team_members");
  db.run("DROP TABLE IF EXISTS brand_teams");
});

console.log("✅ All tables dropped. Run migrate.js again to reload data.");

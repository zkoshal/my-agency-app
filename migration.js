const pool = require("./db");

async function migrate() {
  await pool.query(`
   CREATE TABLE IF NOT EXISTS projects (
    id BIGINT PRIMARY KEY,
    created_at TIMESTAMP,
    brand TEXT,
    name TEXT,
    cs_lead TEXT,
    brief TEXT,
    deadline DATE,
    status TEXT,
    version INT,
    is_archived INT DEFAULT 0,
    design_approved INT DEFAULT 0,
    creative_approved INT DEFAULT 0,
    delivery_date DATE,
    file_url TEXT
   )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignees (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT,
      url TEXT,
      uploaded_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rejection_log (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      date TIMESTAMP,
      reason TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback_log (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      version INT,
      date TIMESTAMP,
      content TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reschedule_log (
      id SERIAL PRIMARY KEY,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      old_date DATE,
      new_date DATE,
      reason TEXT,
      date TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      name TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_teams (
      id SERIAL PRIMARY KEY,
      brand_id INT REFERENCES brands(id) ON DELETE CASCADE,
      member_id INT REFERENCES team_members(id) ON DELETE CASCADE,
      role TEXT CHECK (role IN ('Creative', 'Design'))
    )
  `);

  console.log("✅ Migration complete with snake_case columns");
  pool.end();
}

migrate();

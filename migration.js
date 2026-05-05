const fs = require("fs");
const pool = require("./db");


async function migrate() {
  await pool.query(`
   CREATE TABLE IF NOT EXISTS projects (
    id BIGINT PRIMARY KEY,
    createdAt TIMESTAMP,
    brand TEXT,
    name TEXT,
    csLead TEXT,
    brief TEXT,
    deadline DATE,
    status TEXT,
    version INT,
    isArchived INT DEFAULT 0,
    designApproved INT DEFAULT 0,
    creativeApproved INT DEFAULT 0,
    deliveryDate DATE,
    fileUrl TEXT
   )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignees (
      id SERIAL PRIMARY KEY,
      projectId BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      projectId BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT,
      url TEXT,
      uploadedAt DATE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rejectionLog (
      id SERIAL PRIMARY KEY,
      projectId BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      date DATE,
      reason TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedbackLog (
      id SERIAL PRIMARY KEY,
      projectId BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      version INT,
      date DATE,
      content TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rescheduleLog (
      id SERIAL PRIMARY KEY,
      projectId BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      oldDate DATE,
      newDate DATE,
      reason TEXT,
      date DATE
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
      brandId INT REFERENCES brands(id) ON DELETE CASCADE,
      memberId INT REFERENCES team_members(id) ON DELETE CASCADE,
      role TEXT CHECK (role IN ('Creative', 'Design'))
    )
  `);

  console.log("✅ Migration complete");
  pool.end();
}

migrate();


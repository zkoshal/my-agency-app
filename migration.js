const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./app.db");

// --- Step 1: Create Tables ---
db.serialize(() => {
  // Projects
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    createdAt TEXT,
    brand TEXT,
    name TEXT,
    csLead TEXT,
    brief TEXT,
    deadline TEXT,
    status TEXT,
    version INTEGER,
    isArchived BOOLEAN,
    designApproved BOOLEAN,
    creativeApproved BOOLEAN,
    deliveryDate TEXT,
    fileUrl TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assignees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    name TEXT,
    FOREIGN KEY(projectId) REFERENCES projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rejectionLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    date TEXT,
    reason TEXT,
    FOREIGN KEY(projectId) REFERENCES projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS feedbackLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    version INTEGER,
    date TEXT,
    content TEXT,
    FOREIGN KEY(projectId) REFERENCES projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rescheduleLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    oldDate TEXT,
    newDate TEXT,
    reason TEXT,
    date TEXT,
    FOREIGN KEY(projectId) REFERENCES projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    name TEXT,
    url TEXT,
    uploadedAt TEXT,
    FOREIGN KEY(projectId) REFERENCES projects(id)
  )`);

  // Brands & Teams
  db.run(`CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS brand_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brandId INTEGER,
    memberId INTEGER,
    role TEXT,
    FOREIGN KEY(brandId) REFERENCES brands(id),
    FOREIGN KEY(memberId) REFERENCES team_members(id)
  )`);
});

// --- Step 2: Load database.json ---
const data = JSON.parse(fs.readFileSync("database.json", "utf8"));

data.forEach(post => {
  db.run(`INSERT INTO projects 
    (id, createdAt, brand, name, csLead, brief, deadline, status, version, isArchived, designApproved, creativeApproved, deliveryDate, fileUrl) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [post.id, post.createdAt, post.brand, post.name, post.csLead, post.brief, post.deadline, post.status, post.version, post.isArchived, post.designApproved, post.creativeApproved, post.deliveryDate || null, post.fileUrl || null]
  );

  post.assignees.forEach(a => {
    db.run("INSERT INTO assignees (projectId, name) VALUES (?, ?)", [post.id, a]);
  });

  post.rejectionLog.forEach(r => {
    db.run("INSERT INTO rejectionLog (projectId, date, reason) VALUES (?, ?, ?)", [post.id, r.date, r.reason]);
  });

  post.feedbackLog.forEach(f => {
    db.run("INSERT INTO feedbackLog (projectId, version, date, content) VALUES (?, ?, ?, ?)", [post.id, f.version, f.date, f.content]);
  });

  post.rescheduleLog.forEach(s => {
    db.run("INSERT INTO rescheduleLog (projectId, oldDate, newDate, reason, date) VALUES (?, ?, ?, ?, ?)", [post.id, s.oldDate, s.newDate, s.reason, s.date]);
  });

  post.files.forEach(file => {
    db.run("INSERT INTO files (projectId, name, url, uploadedAt) VALUES (?, ?, ?, ?)", [post.id, file.name, file.url, file.uploadedAt || null]);
  });
});

// --- Step 3: Insert Brand Teams ---
const SHARED_CREATIVE = ["Jawahira", "Shehryar", "Noor", "Maha", "Zoya", "Salman"];
const BUNYAD_GROUP = ["Ammarah Haroon", "Rimsha", "Asim", "Qasim", "Maham", "Salman"];
const PRIMARY_DESIGN_TEAM = ["Haroon", "Azka", "Aleem", "Farwa", "Ahmed", "Khadija"];
const SECONDARY_DESIGN_TEAM = ["Haroon", "Azka", "Ijaz", "Sameera", "Ansar", "Abdul Razzaq", "Anila"];

const BRAND_TEAMS = {
  "Bunyad": { "Creative": BUNYAD_GROUP, "Design": PRIMARY_DESIGN_TEAM },
  "Nido": { "Creative": BUNYAD_GROUP, "Design": PRIMARY_DESIGN_TEAM },
  "Everyday": { "Creative": SHARED_CREATIVE, "Design": PRIMARY_DESIGN_TEAM },
  "NPL": { "Creative": SHARED_CREATIVE, "Design": PRIMARY_DESIGN_TEAM },
  "Packages": { "Creative": BUNYAD_GROUP, "Design": PRIMARY_DESIGN_TEAM },
  "MilkPak": { "Creative": BUNYAD_GROUP, "Design": SECONDARY_DESIGN_TEAM },
  "Cream": { "Creative": BUNYAD_GROUP, "Design": SECONDARY_DESIGN_TEAM },
  "Highnoon": { "Creative": BUNYAD_GROUP, "Design": SECONDARY_DESIGN_TEAM },
  "Co Naturals": { "Creative": BUNYAD_GROUP, "Design": SECONDARY_DESIGN_TEAM },
  "Nescafe": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM },
  "Chilled Dairy": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM },
  "Nestle Professionals": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM },
  "PEL": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM },
  "Electrolux": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM },
  "Insignia": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM },
  "Nestle Chocolate": { "Creative": SHARED_CREATIVE, "Design": SECONDARY_DESIGN_TEAM }
};

Object.entries(BRAND_TEAMS).forEach(([brand, roles]) => {
  db.run("INSERT OR IGNORE INTO brands (name) VALUES (?)", [brand], (err) => {
    if (err) console.error(err);

    // Always fetch brandId
    db.get("SELECT id FROM brands WHERE name = ?", [brand], (err, brandRow) => {
      if (err) console.error(err);
      const brandId = brandRow.id;

      Object.entries(roles).forEach(([role, members]) => {
        members.forEach(member => {
          // Insert member if not exists
          db.run("INSERT OR IGNORE INTO team_members (name) VALUES (?)", [member], (err) => {
            if (err) console.error(err);

            // Always fetch memberId
            db.get("SELECT id FROM team_members WHERE name = ?", [member], (err, memberRow) => {
              if (err) console.error(err);
              const memberId = memberRow.id;

              // Prevent duplicate brand-role-member links
              db.run("INSERT OR IGNORE INTO brand_teams (brandId, memberId, role) VALUES (?, ?, ?)", [brandId, memberId, role]);
            });
          });
        });
      });
    });
  });
});


console.log("Migration complete!");

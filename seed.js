const fs = require("fs");
const pool = require("./db");

// Arrays
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

// Seed projects + related logs/files from database.json
async function seedProjects() {
  const data = JSON.parse(fs.readFileSync("database.json", "utf8"));

  for (const p of data) {
    await pool.query(
      `INSERT INTO projects 
       (id, createdAt, brand, name, csLead, brief, deadline, status, version, isArchived, designApproved, creativeApproved, deliveryDate, fileUrl)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id, p.createdAt, p.brand, p.name, p.csLead, p.brief,
        p.deadline, p.status, p.version, p.isArchived ? 1 : 0,
        p.designApproved ? 1 : 0, p.creativeApproved ? 1 : 0, p.deliveryDate || null, p.fileUrl || null
      ]
    );

    for (const a of p.assignees || []) {
      await pool.query(`INSERT INTO assignees (projectId, name) VALUES ($1, $2)`, [p.id, a]);
    }

    for (const f of p.files || []) {
      await pool.query(
        `INSERT INTO files (projectId, name, url, uploadedAt) VALUES ($1, $2, $3, $4)`,
        [p.id, f.name, f.url, f.uploadedAt || null]
      );
    }

    for (const r of p.rejectionLog || []) {
      await pool.query(
        `INSERT INTO rejectionLog (projectId, date, reason) VALUES ($1, $2, $3)`,
        [p.id, r.date, r.reason]
      );
    }

    for (const fb of p.feedbackLog || []) {
      await pool.query(
        `INSERT INTO feedbackLog (projectId, version, date, content) VALUES ($1, $2, $3, $4)`,
        [p.id, fb.version, fb.date, fb.content]
      );
    }

    for (const rs of p.rescheduleLog || []) {
      await pool.query(
        `INSERT INTO rescheduleLog (projectId, oldDate, newDate, reason, date) VALUES ($1, $2, $3, $4, $5)`,
        [p.id, rs.oldDate, rs.newDate, rs.reason, rs.date]
      );
    }
  }

  console.log("✅ Seeded projects and related data");
}

// Seed brands, team members, and brand-team assignments
async function seedBrandsTeams() {
  // Cache to avoid duplicate inserts
  const memberCache = new Map();

  for (const brandName of Object.keys(BRAND_TEAMS)) {
    const brandRes = await pool.query(
      `INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
      [brandName]
    );
    const brandId = brandRes.rows.length
      ? brandRes.rows[0].id
      : (await pool.query(`SELECT id FROM brands WHERE name=$1`, [brandName])).rows[0].id;

    for (const role of ["Creative", "Design"]) {
      for (const memberName of BRAND_TEAMS[brandName][role]) {
        let memberId;

        if (memberCache.has(memberName)) {
          memberId = memberCache.get(memberName);
        } else {
          const memberRes = await pool.query(
            `INSERT INTO team_members (name) VALUES ($1) RETURNING id`,
            [memberName]
          );
          memberId = memberRes.rows[0].id;
          memberCache.set(memberName, memberId);
        }

        await pool.query(
          `INSERT INTO brand_teams (brandId, memberId, role) VALUES ($1, $2, $3)`,
          [brandId, memberId, role]
        );
      }
    }
  }

  console.log("✅ Seeded brands, team members, and brand-team assignments");
}

// Run both seeders
(async () => {
  try {
    await seedProjects();
    await seedBrandsTeams();
  } catch (err) {
    console.error("❌ Error seeding data:", err.message);
  } finally {
    pool.end();
  }
})();

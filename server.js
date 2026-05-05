const express = require("express");
const multer = require("multer");
const pool = require("./db"); // Postgres connection
const path = require("path");
const app = express();
const PORT = 3000;

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

app.use(express.json());

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve uploaded files under /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


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

function getSystemDate() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

app.post('/login', (req, res) => {
    if (req.body.username === 'admin' && req.body.password === 'red123') res.json({ success: true });
    else res.status(401).json({ success: false });
});

// Get all brands
app.get("/brands", async (req, res) => {
  try {
    const result = await pool.query("SELECT name FROM brands");
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get team members for a brand by role
app.get("/team/:brand", async (req, res) => {
  const brandName = req.params.brand;
  try {
    const result = await pool.query(
      `SELECT tm.name, bt.role
       FROM brand_teams bt
       JOIN team_members tm ON bt.member_id = tm.id
       JOIN brands b ON bt.brand_id = b.id
       WHERE b.name = $1`,
      [brandName]
    );

    // Group by role
    const grouped = {};
    result.rows.forEach(r => {
      if (!grouped[r.role]) grouped[r.role] = [];
      grouped[r.role].push(r.name);
    });

    res.json(grouped);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get all projects with related data
app.get("/projects", async (req, res) => {
  try {
    const projectsRes = await pool.query("SELECT id, created_at \"createdAt\", brand, name, cs_lead \"csLead\", brief, deadline, status, version, is_archived \"isArchived\", design_approved \"designApproved\", creative_approved \"creativeApproved\", delivery_date \"deliveryDate\", file_url \"fileUrl\" FROM projects ORDER BY created_at DESC");
    const projects = projectsRes.rows;

    const fullProjects = await Promise.all(
      projects.map(async p => {
        const project = { ...p };

        const assigneesRes = await pool.query("SELECT name FROM assignees WHERE project_id=$1", [p.id]);
        project.assignees = assigneesRes.rows.map(r => r.name);

        const rejectionRes = await pool.query("SELECT date, reason FROM rejection_log WHERE project_id=$1", [p.id]);
        project.rejectionLog = rejectionRes.rows;

        const feedbackRes = await pool.query("SELECT version, date, content FROM feedback_log WHERE project_id=$1", [p.id]);
        project.feedbackLog = feedbackRes.rows;

        const rescheduleRes = await pool.query("SELECT old_date \"oldDate\", new_date \"newDate\", reason, date FROM reschedule_log WHERE project_id=$1", [p.id]);
        project.rescheduleLog = rescheduleRes.rows;

        const filesRes = await pool.query("SELECT name, url, uploaded_at \"uploadedAt\" FROM files WHERE project_id=$1", [p.id]);
        project.files = filesRes.rows;

        return project;
      })
    );

    res.json(fullProjects);
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});

app.post("/projects", upload.array("briefFiles", 10), async (req, res) => {
  try {
    const newFiles = req.files
      ? req.files.map(f => ({
          name: f.originalname,
          url: `/uploads/${f.filename}`,
          uploadedAt: new Date().toISOString()
        }))
      : [];

    const newProject = {
      id: Date.now(), // unique ID
      createdAt: new Date().toISOString(),
      brand: req.body.brand,
      name: req.body.projectName,
      csLead: req.body.csLead,
      brief: req.body.brief,
      deadline: req.body.deadline,
      status: "Active",
      version: 1,
      isArchived: 0,
      designApproved: 0,
      creativeApproved: 0,
      deliveryDate: null,
      fileUrl: null
    };

    // Insert into projects table
    await pool.query(
      `INSERT INTO projects 
        (id, created_at, brand, name, cs_lead, brief, deadline, status, version, is_archived, design_approved, creative_approved, delivery_date, file_url) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        newProject.id,
        newProject.createdAt,
        newProject.brand,
        newProject.name,
        newProject.csLead,
        newProject.brief,
        newProject.deadline,
        newProject.status,
        newProject.version,
        newProject.isArchived,
        newProject.designApproved,
        newProject.creativeApproved,
        newProject.deliveryDate,
        newProject.fileUrl
      ]
    );

    // Insert assignees
    const assignees = JSON.parse(req.body.assignees || "[]");
    for (const a of assignees) {
      await pool.query(
        "INSERT INTO assignees (project_id, name) VALUES ($1, $2)",
        [newProject.id, a]
      );
    }

    // Insert files
    for (const file of newFiles) {
      await pool.query(
        "INSERT INTO files (project_id, name, url, uploaded_at) VALUES ($1, $2, $3, $4)",
        [newProject.id, file.name, file.url, file.uploadedAt]
      );
    }

    res.json({ success: true, id: newProject.id });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});


app.post("/projects/reschedule", async (req, res) => {
  const { id, newDate, reason } = req.body;

  try {
    // Step 1: Get current deadline
    const rowRes = await pool.query("SELECT deadline FROM projects WHERE id=$1", [id]);
    if (rowRes.rows.length === 0) {
      return res.status(404).send("Project not found");
    }

    const oldDate = rowRes.rows[0].deadline;

    // Step 2: Update deadline in projects table
    await pool.query("UPDATE projects SET deadline=$1 WHERE id=$2", [newDate, id]);

    // Step 3: Insert into reschedule_log
    await pool.query(
      `INSERT INTO rescheduleLog (project_id, old_date, new_date, reason, date) 
       VALUES ($1, $2, $3, $4, $5)`,
      [id, oldDate, newDate, reason, new Date().toISOString()]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});


app.post("/projects/submit", upload.array("workFiles", 10), async (req, res) => {
  const { id } = req.body;

  try {
    // Step 1: Update project status
    await pool.query(
      `UPDATE projects 
       SET status=$1, design_approved=$2, creative_approved=$3 
       WHERE id=$4`,
      ["Under Review", 0, 0, id]
    );

    // Step 2: Insert uploaded files
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        await pool.query(
          `INSERT INTO files (project_id, name, url, uploaded_at) VALUES ($1, $2, $3, $4)`,
          [id, f.originalname, `/uploads/${f.filename}`, new Date().toISOString()]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});



app.post("/projects/approve-step", async (req, res) => {
  const { id, type } = req.body;

  try {
    // Step 1: Fetch current project state
    const rowRes = await pool.query(
      "SELECT design_approved, creative_approved FROM projects WHERE id=$1",
      [id]
    );
    if (rowRes.rows.length === 0) {
      return res.status(404).send("Project not found");
    }

    let { design_approved, creative_approved } = rowRes.rows[0];
    let status = null;
    let delivery_date = null;

    // Step 2: Update flags based on type
    if (type === "design") design_approved = 1;
    if (type === "creative") creative_approved = 1;

    // Step 3: If both approved, mark Ready to Share
    if (design_approved && creative_approved) {
      status = "Ready to Share";
      delivery_date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    }

    // Step 4: Update project in DB
    await pool.query(
      `UPDATE projects 
       SET design_approved=$1, creative_approved=$2, 
           status=COALESCE($3, status), 
           delivery_date=COALESCE($4, delivery_date) 
       WHERE id=$5`,
      [designapproved, creativeapproved, status, delivery_date, id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});



app.post("/projects/reject", async (req, res) => {
  const { id, reason } = req.body;

  try {
    // Step 1: Reset project status and approvals
    const updateRes = await pool.query(
      `UPDATE projects 
       SET status=$1, design_approved=$2, creative_approved=$3 
       WHERE id=$4`,
      ["Active", 0, 0, id]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).send("Project not found");
    }

    // Step 2: Insert rejection log entry
    await pool.query(
      `INSERT INTO rejection_log (project_id, date, reason) VALUES ($1, $2, $3)`,
      [id, new Date().toISOString(), reason]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});


app.post("/projects/archive", async (req, res) => {
  const { id } = req.body;

  try {
    const result = await pool.query(
      "UPDATE projects SET is_archived=$1 WHERE id=$2",
      [1, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("Project not found");
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});


app.post("/projects/feedback-restore", async (req, res) => {
  const { id, feedback } = req.body;

  try {
    // Step 1: Fetch current project state
    const rowRes = await pool.query("SELECT version FROM projects WHERE id=$1", [id]);
    if (rowRes.rows.length === 0) {
      return res.status(404).send("Project not found");
    }

    const newVersion = rowRes.rows[0].version + 1;

    // Step 2: Update project fields
    await pool.query(
      `UPDATE projects 
       SET is_archived=$1, status=$2, version=$3, 
           design_approved=$4, creative_approved=$5, delivery_date=$6 
       WHERE id=$7`,
      [0, "Active", newVersion, 0, 0, null, id]
    );

    // Step 3: Insert feedback log entry
    await pool.query(
      `INSERT INTO feedback_log (project_id, version, date, content) VALUES ($1, $2, $3, $4)`,
      [id, newVersion, new Date().toISOString(), feedback]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});



app.post("/projects/delete", async (req, res) => {
  const { id } = req.body;

  try {
    // Step 1: Delete related records first
    await pool.query("DELETE FROM assignees WHERE project_id=$1", [id]);
    await pool.query("DELETE FROM files WHERE project_id=$1", [id]);
    await pool.query("DELETE FROM rejection_log WHERE project_id=$1", [id]);
    await pool.query("DELETE FROM feedback_log WHERE project_id=$1", [id]);
    await pool.query("DELETE FROM reschedule_log WHERE project_id=$1", [id]);

    // Step 2: Delete project itself
    const result = await pool.query("DELETE FROM projects WHERE id=$1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).send("Project not found");
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send("DB Error: " + err.message);
  }
});


app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
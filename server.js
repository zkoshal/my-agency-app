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


const DATA_FILE = './database.json';

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

function loadProjects() {
    try {
        if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (err) { console.error("DB Load Error", err); }
    return [];
}


function saveProjects(projects) { fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2)); }

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
       JOIN team_members tm ON bt.memberId = tm.id
       JOIN brands b ON bt.brandId = b.id
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
    const projectsRes = await pool.query("SELECT * FROM projects ORDER BY createdAt DESC");
    const projects = projectsRes.rows;

    const fullProjects = await Promise.all(
      projects.map(async p => {
        const project = { ...p };

        const assigneesRes = await pool.query("SELECT name FROM assignees WHERE projectId=$1", [p.id]);
        project.assignees = assigneesRes.rows.map(r => r.name);

        const rejectionRes = await pool.query("SELECT date, reason FROM rejectionLog WHERE projectId=$1", [p.id]);
        project.rejectionLog = rejectionRes.rows;

        const feedbackRes = await pool.query("SELECT version, date, content FROM feedbackLog WHERE projectId=$1", [p.id]);
        project.feedbackLog = feedbackRes.rows;

        const rescheduleRes = await pool.query("SELECT oldDate, newDate, reason, date FROM rescheduleLog WHERE projectId=$1", [p.id]);
        project.rescheduleLog = rescheduleRes.rows;

        const filesRes = await pool.query("SELECT name, url, uploadedAt FROM files WHERE projectId=$1", [p.id]);
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
      isArchived: false,
      designApproved: false,
      creativeApproved: false,
      deliveryDate: null,
      fileUrl: null
    };

    // Insert into projects table
    await pool.query(
      `INSERT INTO projects 
        (id, createdAt, brand, name, csLead, brief, deadline, status, version, isArchived, designApproved, creativeApproved, deliveryDate, fileUrl) 
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
        "INSERT INTO assignees (projectId, name) VALUES ($1, $2)",
        [newProject.id, a]
      );
    }

    // Insert files
    for (const file of newFiles) {
      await pool.query(
        "INSERT INTO files (projectId, name, url, uploadedAt) VALUES ($1, $2, $3, $4)",
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

    // Step 3: Insert into rescheduleLog
    await pool.query(
      `INSERT INTO rescheduleLog (projectId, oldDate, newDate, reason, date) 
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
       SET status=$1, designApproved=$2, creativeApproved=$3 
       WHERE id=$4`,
      ["Under Review", false, false, id]
    );

    // Step 2: Insert uploaded files
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        await pool.query(
          `INSERT INTO files (projectId, name, url, uploadedAt) VALUES ($1, $2, $3, $4)`,
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
      "SELECT designApproved, creativeApproved FROM projects WHERE id=$1",
      [id]
    );
    if (rowRes.rows.length === 0) {
      return res.status(404).send("Project not found");
    }

    let { designapproved, creativeapproved } = rowRes.rows[0];
    let status = null;
    let deliveryDate = null;

    // Step 2: Update flags based on type
    if (type === "design") designapproved = true;
    if (type === "creative") creativeapproved = true;

    // Step 3: If both approved, mark Ready to Share
    if (designapproved && creativeapproved) {
      status = "Ready to Share";
      deliveryDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    }

    // Step 4: Update project in DB
    await pool.query(
      `UPDATE projects 
       SET designApproved=$1, creativeApproved=$2, 
           status=COALESCE($3, status), 
           deliveryDate=COALESCE($4, deliveryDate) 
       WHERE id=$5`,
      [designapproved, creativeapproved, status, deliveryDate, id]
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
       SET status=$1, designApproved=$2, creativeApproved=$3 
       WHERE id=$4`,
      ["Active", false, false, id]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).send("Project not found");
    }

    // Step 2: Insert rejection log entry
    await pool.query(
      `INSERT INTO rejectionLog (projectId, date, reason) VALUES ($1, $2, $3)`,
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
      "UPDATE projects SET isArchived=$1 WHERE id=$2",
      [true, id]
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
       SET isArchived=$1, status=$2, version=$3, 
           designApproved=$4, creativeApproved=$5, deliveryDate=$6 
       WHERE id=$7`,
      [false, "Active", newVersion, false, false, null, id]
    );

    // Step 3: Insert feedback log entry
    await pool.query(
      `INSERT INTO feedbackLog (projectId, version, date, content) VALUES ($1, $2, $3, $4)`,
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
    await pool.query("DELETE FROM assignees WHERE projectId=$1", [id]);
    await pool.query("DELETE FROM files WHERE projectId=$1", [id]);
    await pool.query("DELETE FROM rejectionLog WHERE projectId=$1", [id]);
    await pool.query("DELETE FROM feedbackLog WHERE projectId=$1", [id]);
    await pool.query("DELETE FROM rescheduleLog WHERE projectId=$1", [id]);

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
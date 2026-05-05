const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;
const db = require("./db");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

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

app.get("/brands", (req, res) => {
  db.all("SELECT name FROM brands", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows.map(r => r.name));
  });
});


// Get team members for a brand by role
app.get("/team/:brand", (req, res) => {
  const brandName = req.params.brand;

  const sql = `
    SELECT tm.name, bt.role
    FROM brand_teams bt
    JOIN team_members tm ON bt.memberId = tm.id
    JOIN brands b ON bt.brandId = b.id
    WHERE b.name = ?
  `;

  db.all(sql, [brandName], (err, rows) => {
    if (err) return res.status(500).send(err.message);

    // Group by role
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.role]) grouped[r.role] = [];
      grouped[r.role].push(r.name);
    });

    res.json(grouped);
  });
});


//app.get('/projects', (req, res) => res.json(loadProjects()));
app.get("/projects", (req, res) => {
  const sql = "SELECT * FROM projects";

  db.all(sql, [], (err, projects) => {
    if (err) return res.status(500).send("DB Error: " + err.message);

    // For each project, fetch related data
    const tasks = projects.map(p => new Promise((resolve, reject) => {
      const project = { ...p };

      db.all("SELECT name FROM assignees WHERE projectId = ?", [p.id], (err, rows) => {
        if (err) return reject(err);
        project.assignees = rows.map(r => r.name);

        db.all("SELECT date, reason FROM rejectionLog WHERE projectId = ?", [p.id], (err, rows) => {
          if (err) return reject(err);
          project.rejectionLog = rows;

          db.all("SELECT version, date, content FROM feedbackLog WHERE projectId = ?", [p.id], (err, rows) => {
            if (err) return reject(err);
            project.feedbackLog = rows;

            db.all("SELECT oldDate, newDate, reason, date FROM rescheduleLog WHERE projectId = ?", [p.id], (err, rows) => {
              if (err) return reject(err);
              project.rescheduleLog = rows;

              db.all("SELECT name, url, uploadedAt FROM files WHERE projectId = ?", [p.id], (err, rows) => {
                if (err) return reject(err);
                project.files = rows;

                resolve(project);
              });
            });
          });
        });
      });
    }));

    Promise.all(tasks)
      .then(fullProjects => res.json(fullProjects))
      .catch(err => res.status(500).send(err.message));
  });
});


app.post("/projects", upload.array("briefFiles", 10), (req, res) => {
  const newFiles = req.files
    ? req.files.map(f => ({
        name: f.originalname,
        url: `/uploads/${f.filename}`,
        uploadedAt: getSystemDate()
      }))
    : [];

  const newProject = {
    id: Date.now(), // unique ID
    createdAt: getSystemDate(),
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
  db.run(
    `INSERT INTO projects 
      (id, createdAt, brand, name, csLead, brief, deadline, status, version, isArchived, designApproved, creativeApproved, deliveryDate, fileUrl) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
    function (err) {
      if (err) return res.status(500).send(err.message);

      // Insert assignees
      const assignees = JSON.parse(req.body.assignees || "[]");
      assignees.forEach(a => {
        db.run("INSERT INTO assignees (projectId, name) VALUES (?, ?)", [
          newProject.id,
          a
        ]);
      });

      // Insert files
      newFiles.forEach(file => {
        db.run(
          "INSERT INTO files (projectId, name, url, uploadedAt) VALUES (?, ?, ?, ?)",
          [newProject.id, file.name, file.url, file.uploadedAt]
        );
      });

      res.json({ success: true, id: newProject.id });
    }
  );
});


app.post("/projects/reschedule", (req, res) => {
  const { id, newDate, reason } = req.body;

  // Step 1: Get current deadline
  db.get("SELECT deadline FROM projects WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).send("Project not found");

    const oldDate = row.deadline;

    // Step 2: Update deadline in projects table
    db.run("UPDATE projects SET deadline = ? WHERE id = ?", [newDate, id], function (err) {
      if (err) return res.status(500).send(err.message);

      // Step 3: Insert into rescheduleLog
      db.run(
        "INSERT INTO rescheduleLog (projectId, oldDate, newDate, reason, date) VALUES (?, ?, ?, ?, ?)",
        [id, oldDate, newDate, reason, getSystemDate()],
        function (err) {
          if (err) return res.status(500).send(err.message);
          res.json({ success: true });
        }
      );
    });
  });
});


app.post("/projects/submit", upload.array("workFiles", 10), (req, res) => {
  const { id } = req.body;

  // Step 1: Update project status
  db.run(
    `UPDATE projects 
     SET status = ?, designApproved = ?, creativeApproved = ? 
     WHERE id = ?`,
    ["Under Review", false, false, id],
    function (err) {
      if (err) return res.status(500).send(err.message);

      // Step 2: Insert uploaded files
      if (req.files && req.files.length > 0) {
        req.files.forEach(f => {
          db.run(
            "INSERT INTO files (projectId, name, url, uploadedAt) VALUES (?, ?, ?, ?)",
            [id, f.originalname, `/uploads/${f.filename}`, getSystemDate()]
          );
        });
      }

      res.json({ success: true });
    }
  );
});


app.post("/projects/approve-step", (req, res) => {
  const { id, type } = req.body;

  // Step 1: Fetch current project state
  db.get("SELECT designApproved, creativeApproved FROM projects WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).send("Project not found");

    let designApproved = row.designApproved;
    let creativeApproved = row.creativeApproved;
    let status = null;
    let deliveryDate = null;

    // Step 2: Update flags based on type
    if (type === "design") designApproved = true;
    if (type === "creative") creativeApproved = true;

    // Step 3: If both approved, mark Ready to Share
    if (designApproved && creativeApproved) {
      status = "Ready to Share";
      deliveryDate = new Date().toISOString().split("T")[0];
    }

    // Step 4: Update project in DB
    db.run(
      `UPDATE projects 
       SET designApproved = ?, creativeApproved = ?, 
           status = COALESCE(?, status), 
           deliveryDate = COALESCE(?, deliveryDate) 
       WHERE id = ?`,
      [designApproved, creativeApproved, status, deliveryDate, id],
      function (err) {
        if (err) return res.status(500).send(err.message);
        res.json({ success: true });
      }
    );
  });
});


app.post("/projects/reject", (req, res) => {
  const { id, reason } = req.body;

  // Step 1: Reset project status and approvals
  db.run(
    `UPDATE projects 
     SET status = ?, designApproved = ?, creativeApproved = ? 
     WHERE id = ?`,
    ["Active", false, false, id],
    function (err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) return res.status(404).send("Project not found");

      // Step 2: Insert rejection log entry
      db.run(
        "INSERT INTO rejectionLog (projectId, date, reason) VALUES (?, ?, ?)",
        [id, getSystemDate(), reason],
        function (err) {
          if (err) return res.status(500).send(err.message);
          res.json({ success: true });
        }
      );
    }
  );
});


app.post("/projects/archive", (req, res) => {
  const { id } = req.body;

  db.run(
    "UPDATE projects SET isArchived = ? WHERE id = ?",
    [true, id],
    function (err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) return res.status(404).send("Project not found");
      res.json({ success: true });
    }
  );
});


app.post("/projects/feedback-restore", (req, res) => {
  const { id, feedback } = req.body;

  // Step 1: Fetch current project state
  db.get("SELECT version FROM projects WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).send("Project not found");

    const newVersion = row.version + 1;

    // Step 2: Update project fields
    db.run(
      `UPDATE projects 
       SET isArchived = ?, status = ?, version = ?, 
           designApproved = ?, creativeApproved = ?, deliveryDate = ? 
       WHERE id = ?`,
      [false, "Active", newVersion, false, false, null, id],
      function (err) {
        if (err) return res.status(500).send(err.message);

        // Step 3: Insert feedback log entry
        db.run(
          "INSERT INTO feedbackLog (projectId, version, date, content) VALUES (?, ?, ?, ?)",
          [id, newVersion, getSystemDate(), feedback],
          function (err) {
            if (err) return res.status(500).send(err.message);
            res.json({ success: true });
          }
        );
      }
    );
  });
});


app.post("/projects/delete", (req, res) => {
  const { id } = req.body;

  // Step 1: Delete related records first (to avoid orphan rows)
  db.serialize(() => {
    db.run("DELETE FROM assignees WHERE projectId = ?", [id]);
    db.run("DELETE FROM files WHERE projectId = ?", [id]);
    db.run("DELETE FROM rejectionLog WHERE projectId = ?", [id]);
    db.run("DELETE FROM feedbackLog WHERE projectId = ?", [id]);
    db.run("DELETE FROM rescheduleLog WHERE projectId = ?", [id]);

    // Step 2: Delete project itself
    db.run("DELETE FROM projects WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) return res.status(404).send("Project not found");
      res.json({ success: true });
    });
  });
});


app.listen(port, () => console.log(`Server: http://localhost:${port}`));
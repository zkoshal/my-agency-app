const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

// Setup Storage for Creative Assets
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

// Configuration for Teams
const BRAND_TEAMS = {
    "Bunyad": {
        "Creative Team": ["Ammarah Haroon", "Rimsha", "Asim", "Qasim", "Maham"],
        "Design Team": ["Haroon", "Azka", "Ahmed"]
    },
    "Nescafe": {
        "Creative Team": ["Jawahira", "Shehryar", "Noor"]
    }
};

function loadProjects() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE);
            return JSON.parse(data);
        }
    } catch (err) { console.error(err); }
    return [];
}

function saveProjects(projects) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2)); }
    catch (err) { console.error(err); }
}

// API Routes
app.get('/team/:brand', (req, res) => res.json(BRAND_TEAMS[req.params.brand] || {}));
app.get('/projects', (req, res) => res.json(loadProjects()));

app.post('/projects', (req, res) => {
    const projects = loadProjects();
    const newProject = {
        id: Date.now(),
        brand: req.body.brand,
        name: req.body.projectName,
        csLead: req.body.csLead || "Unassigned",
        brief: req.body.brief || "",
        assignees: req.body.assignees || [],
        startDate: new Date().toISOString().split('T')[0],
        deadline: req.body.deadline,
        status: "Active",
        fileUrl: null,
        designApproved: false,
        creativeApproved: false,
        isArchived: false,
        completionDate: null,
        rescheduleLog: []
    };
    projects.push(newProject);
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/projects/reschedule', (req, res) => {
    const { id, newDeadline, reason } = req.body;
    let projects = loadProjects().map(p => {
        if (p.id == id) {
            p.rescheduleLog.push({
                oldDeadline: p.deadline,
                newDeadline: newDeadline,
                reason: reason,
                dateChanged: new Date().toISOString().split('T')[0]
            });
            p.deadline = newDeadline;
        }
        return p;
    });
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/projects/submit', upload.single('workFile'), (req, res) => {
    let projects = loadProjects().map(p => {
        if (p.id == req.body.id) {
            p.status = "Under Review";
            p.fileUrl = req.file ? `/uploads/${req.file.filename}` : p.fileUrl;
            p.designApproved = false;
            p.creativeApproved = false;
        }
        return p;
    });
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/projects/approve-step', (req, res) => {
    const { id, type } = req.body;
    let projects = loadProjects().map(p => {
        if (p.id == id) {
            if (type === 'design') p.designApproved = true;
            if (type === 'creative') p.creativeApproved = true;
            if (p.designApproved && p.creativeApproved) {
                p.status = "Ready to Share with Client";
                p.completionDate = new Date().toISOString().split('T')[0];
            }
        }
        return p;
    });
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/projects/reject', (req, res) => {
    let projects = loadProjects().map(p => {
        if (p.id == req.body.id) {
            p.status = "Active";
            p.designApproved = false;
            p.creativeApproved = false;
            p.completionDate = null;
        }
        return p;
    });
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/projects/archive', (req, res) => {
    let projects = loadProjects().map(p => {
        if (p.id == req.body.id) p.isArchived = true;
        return p;
    });
    saveProjects(projects);
    res.json({ success: true });
});

app.post('/projects/restore', (req, res) => {
    let projects = loadProjects().map(p => {
        if (p.id == req.body.id) p.isArchived = false;
        return p;
    });
    saveProjects(projects);
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `🟢 RED PUBLICIS PORTAL LIVE: http://localhost:${port}`);
});
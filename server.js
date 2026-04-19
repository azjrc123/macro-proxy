const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Simple file-based database ─────────────────────────────
const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {}
  return { goals: {}, favorites: [], logs: {} };
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('DB write error:', e);
  }
}

// ── Claude proxy ───────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: { message: 'No API key provided' } });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── GOALS ──────────────────────────────────────────────────
app.get('/api/goals', (req, res) => {
  const db = readDB();
  res.json(db.goals && Object.keys(db.goals).length ? db.goals : { cal: 2000, protein: 150, carbs: 200, fat: 65 });
});

app.post('/api/goals', (req, res) => {
  const db = readDB();
  db.goals = req.body;
  writeDB(db);
  res.json({ ok: true });
});

// ── FAVORITES ──────────────────────────────────────────────
app.get('/api/favorites', (req, res) => {
  const db = readDB();
  res.json(db.favorites || []);
});

app.post('/api/favorites', (req, res) => {
  const db = readDB();
  db.favorites = req.body;
  writeDB(db);
  res.json({ ok: true });
});

// ── DAILY LOG ──────────────────────────────────────────────
app.get('/api/log/:date', (req, res) => {
  const db = readDB();
  res.json(db.logs[req.params.date] || []);
});

app.post('/api/log/:date', (req, res) => {
  const db = readDB();
  if (!db.logs) db.logs = {};
  db.logs[req.params.date] = req.body;
  // Keep only last 30 days
  const dates = Object.keys(db.logs).sort();
  if (dates.length > 30) {
    dates.slice(0, dates.length - 30).forEach(d => delete db.logs[d]);
  }
  writeDB(db);
  res.json({ ok: true });
});

// ── STATUS ─────────────────────────────────────────────────
app.get('/', (req, res) => res.send('macro.ai sync server is running ✓'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


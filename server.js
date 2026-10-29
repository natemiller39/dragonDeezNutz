// Dragon Deez Nuts: serves the game and a small leaderboard API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL || '';
const INDEX = path.join(__dirname, 'index.html');

const pool = DB_URL
  ? new Pool({
      connectionString: DB_URL,
      // Render's external URLs need SSL; internal ones do not.
      ssl: /\.render\.com/.test(DB_URL) ? { rejectUnauthorized: false } : false,
      max: 4,
    })
  : null;

let dbReady = false;
async function initDb() {
  if (!pool) { console.log('DATABASE_URL not set: leaderboard disabled'); return; }
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS dragon_scores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      distance REAL NOT NULL DEFAULT 0,
      squished INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS dragon_scores_score_idx ON dragon_scores (score DESC)');
    dbReady = true;
    console.log('Leaderboard ready');
  } catch (e) {
    console.error('Database setup failed:', e.message);
    setTimeout(initDb, 10000);
  }
}

// A few posts per minute per visitor is plenty for a game.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some(t => now - t < 60000)) hits.delete(ip);
}, 60000).unref();

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2048) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, fs.readFileSync(INDEX), 'text/html; charset=utf-8');
    }
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });

    if (url.pathname === '/api/scores') {
      if (!dbReady) return send(res, 503, { error: 'Leaderboard is not available right now.' });

      if (req.method === 'GET') {
        const { rows } = await pool.query(
          'SELECT id, name, score, distance, squished FROM dragon_scores ORDER BY score DESC, created_at ASC LIMIT 10'
        );
        return send(res, 200, rows);
      }

      if (req.method === 'POST') {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        if (limited(ip)) return send(res, 429, { error: 'Too many scores at once. Wait a minute and try again.' });
        let body;
        try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'Could not read that score.' }); }
        const name = cleanName(body.name);
        const score = Number(body.score), distance = Number(body.distance), squished = Number(body.squished);
        if (!name) return send(res, 400, { error: 'Enter a name first.' });
        if (!Number.isInteger(score) || score < 0 || score > 5000000) return send(res, 400, { error: 'That score does not look right.' });
        const { rows } = await pool.query(
          'INSERT INTO dragon_scores (name, score, distance, squished) VALUES ($1, $2, $3, $4) RETURNING id',
          [name, score, Number.isFinite(distance) ? Math.max(0, distance) : 0, Number.isInteger(squished) ? Math.max(0, squished) : 0]
        );
        const rank = await pool.query('SELECT COUNT(*)::int + 1 AS rank FROM dragon_scores WHERE score > $1', [score]);
        return send(res, 201, { id: rows[0].id, rank: rank.rows[0].rank });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Something went wrong saving or loading scores.' });
  }
});

server.listen(PORT, () => console.log(`Dragon Deez Nuts on port ${PORT}`));
initDb();

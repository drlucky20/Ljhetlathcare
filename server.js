'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { roles, seedUsers, sectionIndex } = require('./config');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const SESSION_DAYS = 7;
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'lj.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
  salt TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, section TEXT NOT NULL, entry_date TEXT NOT NULL,
  data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_sec_date ON entries(section, entry_date);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, entry_date);
`);

// ---------- helpers ----------
const now = () => new Date().toISOString();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));

function createUser({ username, name, role, password }) {
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users (username,name,role,salt,hash,created_at) VALUES (?,?,?,?,?,?)')
    .run(username, name, role, salt, hashPw(password, salt), now());
}
function setPassword(id, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE users SET salt=?, hash=? WHERE id=?').run(salt, hashPw(password, salt), id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
}

// First run: create accounts with random passwords, print once.
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const lines = [];
  for (const u of seedUsers) {
    const password = crypto.randomBytes(7).toString('base64url');
    createUser({ ...u, password });
    lines.push(`${u.username.padEnd(12)} ${password.padEnd(12)} ${roles[u.role].label}`);
  }
  const file = path.join(DATA_DIR, 'initial-passwords.txt');
  fs.writeFileSync(file, 'username     password     role\n' + lines.join('\n') + '\n', { mode: 0o600 });
  console.log('\nFirst run - accounts created. Initial passwords (change them after login):\n');
  console.log('username     password     role\n' + lines.join('\n') + `\n\nSaved to ${file}\n`);
}

// ---------- validation ----------
function cleanData(section, input) {
  if (!input || typeof input !== 'object') throw httpErr(400, 'Invalid data');
  const out = {};
  for (const fd of section.fields) {
    let v = input[fd.k];
    if (fd.type === 'checkbox') { out[fd.k] = v === true; continue; }
    if (v === undefined || v === null || v === '') {
      if (fd.required) throw httpErr(400, `${fd.label} is required`);
      continue;
    }
    if (fd.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) throw httpErr(400, `${fd.label} must be a number`);
      if (fd.min !== undefined && v < fd.min) throw httpErr(400, `${fd.label} must be at least ${fd.min}`);
    } else if (fd.type === 'date') {
      if (!isDate(v)) throw httpErr(400, `${fd.label} must be a date`);
    } else if (fd.type === 'select') {
      if (!fd.options.includes(v)) throw httpErr(400, `${fd.label}: invalid option`);
    } else {
      v = String(v).trim();
      if (v.length > 2000) throw httpErr(400, `${fd.label} is too long`);
      if (!v && fd.required) throw httpErr(400, `${fd.label} is required`);
      if (!v) continue;
    }
    out[fd.k] = v;
  }
  return out;
}
function httpErr(status, message) { return Object.assign(new Error(message), { status }); }

// ---------- auth ----------
const failures = new Map(); // ip|user -> {n, until}
function parseCookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
function currentUser(req) {
  const tok = parseCookies(req).sid;
  if (!tok) return null;
  const row = db.prepare(`SELECT u.id,u.username,u.name,u.role,u.active,s.expires FROM sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(sha(tok));
  if (!row || !row.active || row.expires < Date.now()) return null;
  return row;
}
function requireUser(req) { const u = currentUser(req); if (!u) throw httpErr(401, 'Please log in'); return u; }
function requireAdmin(req) { const u = requireUser(req); if (u.role !== 'admin') throw httpErr(403, 'Admin only'); return u; }

// ---------- data access ----------
const parseRow = (r) => ({ id: r.id, user_id: r.user_id, section: r.section, date: r.entry_date, data: JSON.parse(r.data), updated_at: r.updated_at });

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const matches = (where, data) => !where || data[where.field] === where.equals;

function buildChart(section, end) {
  const c = section.chart;
  if (!c) throw httpErr(404, 'No chart for this section');
  if (c.mode === 'daily') {
    const start = addDays(end, -(c.days - 1));
    const rows = db.prepare('SELECT entry_date,data FROM entries WHERE section=? AND entry_date BETWEEN ? AND ?').all(section.id, start, end);
    const labels = Array.from({ length: c.days }, (_, i) => addDays(start, i));
    const series = c.series.map((s) => ({ name: s.name, values: labels.map(() => 0) }));
    for (const r of rows) {
      const idx = labels.indexOf(r.entry_date);
      const data = JSON.parse(r.data);
      c.series.forEach((s, si) => {
        if (!matches(s.where, data)) return;
        series[si].values[idx] += s.agg === 'count' ? 1 : Number(data[s.field]) || 0;
      });
    }
    return { title: c.title, mode: c.mode, labels, series };
  }
  if (c.mode === 'monthly_compare') {
    const endYear = Number(end.slice(0, 4));
    const endMonth = Number(end.slice(5, 7));
    const years = Array.from({ length: c.years }, (_, i) => endYear - (c.years - 1 - i));
    const rows = db.prepare('SELECT entry_date,data FROM entries WHERE section=? AND entry_date BETWEEN ? AND ?')
      .all(section.id, `${years[0]}-01-01`, `${endYear}-12-31`);
    const series = years.map((y) => ({ name: String(y), values: Array.from({ length: 12 }, (_, m) => (y === endYear && m + 1 > endMonth ? null : 0)) }));
    for (const r of rows) {
      const y = Number(r.entry_date.slice(0, 4)); const m = Number(r.entry_date.slice(5, 7)) - 1;
      const s = series[years.indexOf(y)];
      if (s && s.values[m] !== null) s.values[m] += Number(JSON.parse(r.data)[c.field]) || 0;
    }
    return { title: c.title, mode: c.mode, labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], series };
  }
  throw httpErr(500, 'Unknown chart mode');
}

const csvCell = (v) => { const s = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// ---------- routes ----------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('POST', '/api/login', async (ctx) => {
  const { username, password } = ctx.body;
  const key = ctx.ip + '|' + String(username).toLowerCase();
  const f = failures.get(key);
  if (f && f.until > Date.now()) throw httpErr(429, 'Too many attempts. Try again in a few minutes.');
  const u = typeof username === 'string' && typeof password === 'string'
    ? db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(username.trim()) : null;
  const ok = u && u.active && crypto.timingSafeEqual(Buffer.from(hashPw(password, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
  if (!ok) {
    const n = (f && f.until <= Date.now() ? 0 : f?.n || 0) + 1;
    failures.set(key, { n, until: n >= 5 ? Date.now() + 10 * 60 * 1000 : 0 });
    throw httpErr(401, 'Wrong username or password');
  }
  failures.delete(key);
  const tok = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(sha(tok), u.id, Date.now() + SESSION_DAYS * 864e5);
  const secure = ctx.req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  ctx.setCookie = `sid=${tok}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`;
  return { ok: true };
});

route('POST', '/api/logout', async (ctx) => {
  const tok = parseCookies(ctx.req).sid;
  if (tok) db.prepare('DELETE FROM sessions WHERE token=?').run(sha(tok));
  ctx.setCookie = 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
  return { ok: true };
});

route('GET', '/api/me', async (ctx) => {
  const u = requireUser(ctx.req);
  const visible = u.role === 'admin' ? roles : { [u.role]: roles[u.role] };
  return { user: { id: u.id, username: u.username, name: u.name, role: u.role, roleLabel: roles[u.role].label }, roles: visible };
});

route('POST', '/api/password', async (ctx) => {
  const u = requireUser(ctx.req);
  const { current, next } = ctx.body;
  const row = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  if (typeof current !== 'string' || !crypto.timingSafeEqual(Buffer.from(hashPw(current, row.salt), 'hex'), Buffer.from(row.hash, 'hex'))) throw httpErr(400, 'Current password is wrong');
  if (typeof next !== 'string' || next.length < 8) throw httpErr(400, 'New password must be at least 8 characters');
  setPassword(u.id, next);
  return { ok: true, relogin: true };
});

route('GET', '/api/entries', async (ctx) => {
  const u = requireUser(ctx.req);
  const { section, date } = ctx.query;
  const sec = sectionIndex[section];
  if (!sec || !isDate(date)) throw httpErr(400, 'Bad request');
  if (u.role !== 'admin' && sec.role !== u.role) throw httpErr(403, 'Not allowed');
  const rows = u.role === 'admin'
    ? db.prepare('SELECT * FROM entries WHERE section=? AND entry_date=? ORDER BY id').all(section, date)
    : db.prepare('SELECT * FROM entries WHERE section=? AND entry_date=? AND user_id=? ORDER BY id').all(section, date, u.id);
  return { entries: rows.map(parseRow) };
});

route('POST', '/api/entries', async (ctx) => {
  const u = requireUser(ctx.req);
  const { section, date, data } = ctx.body;
  const sec = sectionIndex[section];
  if (!sec || !isDate(date)) throw httpErr(400, 'Bad request');
  if (sec.role !== u.role) throw httpErr(403, 'Not allowed');
  const clean = cleanData(sec, data);
  const json = JSON.stringify(clean);
  if (sec.unique) {
    const ex = db.prepare('SELECT id FROM entries WHERE user_id=? AND section=? AND entry_date=?').get(u.id, section, date);
    if (ex) { db.prepare('UPDATE entries SET data=?, updated_at=? WHERE id=?').run(json, now(), ex.id); return { id: ex.id }; }
  }
  const r = db.prepare('INSERT INTO entries (user_id,section,entry_date,data,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(u.id, section, date, json, now(), now());
  return { id: Number(r.lastInsertRowid) };
});

route('DELETE', '/api/entries/:id', async (ctx) => {
  const u = requireUser(ctx.req);
  const row = db.prepare('SELECT * FROM entries WHERE id=?').get(Number(ctx.params.id));
  if (!row) throw httpErr(404, 'Not found');
  if (u.role !== 'admin' && row.user_id !== u.id) throw httpErr(403, 'Not allowed');
  db.prepare('DELETE FROM entries WHERE id=?').run(row.id);
  return { ok: true };
});

route('GET', '/api/chart', async (ctx) => {
  const u = requireUser(ctx.req);
  const sec = sectionIndex[ctx.query.section];
  const end = isDate(ctx.query.end) ? ctx.query.end : new Date().toISOString().slice(0, 10);
  if (!sec) throw httpErr(400, 'Bad request');
  if (u.role !== 'admin' && sec.role !== u.role) throw httpErr(403, 'Not allowed');
  return buildChart(sec, end);
});

route('GET', '/api/admin/day', async (ctx) => {
  requireAdmin(ctx.req);
  const { date } = ctx.query;
  if (!isDate(date)) throw httpErr(400, 'Bad date');
  const users = db.prepare("SELECT id,username,name,role FROM users WHERE active=1 AND role!='admin' ORDER BY id").all();
  const rows = db.prepare('SELECT * FROM entries WHERE entry_date=? ORDER BY id').all(date).map(parseRow);
  return {
    date,
    users: users.map((u) => {
      const mine = rows.filter((r) => r.user_id === u.id);
      const sections = {};
      for (const r of mine) (sections[r.section] ||= []).push(r);
      return { ...u, roleLabel: roles[u.role]?.label || u.role, count: mine.length, sections };
    }),
  };
});

route('GET', '/api/admin/export', async (ctx) => {
  requireAdmin(ctx.req);
  const { from, to } = ctx.query;
  if (!isDate(from) || !isDate(to)) throw httpErr(400, 'Bad dates');
  const rows = db.prepare(`SELECT e.*, u.name uname FROM entries e JOIN users u ON u.id=e.user_id
    WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date, e.id`).all(from, to);
  const out = ['Date,Staff,Section,Details'];
  for (const r of rows) {
    const sec = sectionIndex[r.section];
    const data = JSON.parse(r.data);
    const details = sec ? sec.fields.map((fd) => `${fd.label}: ${fd.type === 'checkbox' ? (data[fd.k] ? 'Yes' : 'No') : data[fd.k] ?? ''}`).join(' | ') : r.data;
    out.push([r.entry_date, r.uname, sec?.title || r.section, details].map(csvCell).join(','));
  }
  ctx.raw = { type: 'text/csv; charset=utf-8', body: '﻿' + out.join('\n'), filename: `lj-report-${from}_to_${to}.csv` };
  return null;
});

route('GET', '/api/admin/users', async (ctx) => {
  requireAdmin(ctx.req);
  return { users: db.prepare('SELECT id,username,name,role,active FROM users ORDER BY id').all().map((u) => ({ ...u, roleLabel: roles[u.role]?.label })) };
});

route('POST', '/api/admin/users', async (ctx) => {
  requireAdmin(ctx.req);
  const { username, name, role, password } = ctx.body;
  if (!/^[a-z0-9._-]{3,30}$/i.test(username || '')) throw httpErr(400, 'Username: 3-30 letters/numbers');
  if (!name || !roles[role]) throw httpErr(400, 'Name and role required');
  if (typeof password !== 'string' || password.length < 8) throw httpErr(400, 'Password must be at least 8 characters');
  try { createUser({ username: username.trim(), name: String(name).trim(), role, password }); }
  catch { throw httpErr(409, 'Username already exists'); }
  return { ok: true };
});

route('PATCH', '/api/admin/users/:id', async (ctx) => {
  const admin = requireAdmin(ctx.req);
  const id = Number(ctx.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) throw httpErr(404, 'Not found');
  const { password, active, name } = ctx.body;
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) throw httpErr(400, 'Password must be at least 8 characters');
    setPassword(id, password);
  }
  if (active !== undefined) {
    if (id === admin.id) throw httpErr(400, 'You cannot deactivate yourself');
    db.prepare('UPDATE users SET active=? WHERE id=?').run(active ? 1 : 0, id);
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  }
  if (name) db.prepare('UPDATE users SET name=? WHERE id=?').run(String(name).trim(), id);
  return { ok: true };
});

// ---------- server ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 100_000) { reject(httpErr(413, 'Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { reject(httpErr(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (status, body, headers = {}) => { res.writeHead(status, { ...SEC_HEADERS, ...headers }); res.end(body); };
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) return send(404, JSON.stringify({ error: 'Not found' }), { 'Content-Type': 'application/json' });
      const mutating = req.method !== 'GET';
      if (mutating && !String(req.headers['content-type'] || '').startsWith('application/json') && req.method !== 'DELETE') throw httpErr(415, 'JSON required');
      if (mutating && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw httpErr(403, 'Bad origin');
      const ctx = {
        req, ip: req.socket.remoteAddress, query: Object.fromEntries(url.searchParams),
        params: url.pathname.match(r.re).groups || {}, body: mutating ? await readBody(req) : {},
      };
      const result = await r.fn(ctx);
      const h = { 'Cache-Control': 'no-store' };
      if (ctx.setCookie) h['Set-Cookie'] = ctx.setCookie;
      if (ctx.raw) return send(200, ctx.raw.body, { ...h, 'Content-Type': ctx.raw.type, 'Content-Disposition': `attachment; filename="${ctx.raw.filename}"` });
      return send(200, JSON.stringify(result), { ...h, 'Content-Type': 'application/json' });
    }
    // static
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, 'Not found', { 'Content-Type': 'text/plain' });
    return send(200, fs.readFileSync(file), { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    send(status, JSON.stringify({ error: status === 500 ? 'Server error' : e.message }), { 'Content-Type': 'application/json' });
  }
});

if (require.main === module) server.listen(PORT, () => console.log(`LJ dashboard running on http://localhost:${PORT}`));
module.exports = { server, db };

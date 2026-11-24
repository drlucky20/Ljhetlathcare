'use strict';
// End-to-end smoke test: spins up the server on a temp DB and exercises the main flows.
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lj-'));
const { server } = require('../server');

const call = (base, cookie) => async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie.v ? { cookie: cookie.v } : {}) }, body: body && JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie.v = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const pw = Object.fromEntries(fs.readFileSync(path.join(process.env.DATA_DIR, 'initial-passwords.txt'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(/\s+/)).map(([u, p]) => [u, p]));
    const mk = async (u) => { const c = { v: '' }; const api = call(base, c); assert.equal((await api('POST', '/api/login', { username: u, password: pw[u] })).status, 200); return api; };
    const today = new Date().toISOString().slice(0, 10);

    const bad = call(base, { v: '' });
    assert.equal((await bad('POST', '/api/login', { username: 'manager', password: 'nope' })).status, 401);
    assert.equal((await bad('GET', '/api/me')).status, 401);

    const mgr = await mk('manager');
    assert.equal((await mgr('POST', '/api/entries', { section: 'mgr_stats', date: today, data: { calls: 42, appointments: 9 } })).status, 200);
    assert.equal((await mgr('POST', '/api/entries', { section: 'mgr_stats', date: today, data: { calls: 50, appointments: 11 } })).status, 200); // upsert
    const e = (await mgr('GET', `/api/entries?section=mgr_stats&date=${today}`)).body.entries;
    assert.equal(e.length, 1); assert.equal(e[0].data.calls, 50);
    assert.equal((await mgr('POST', '/api/entries', { section: 'mgr_stats', date: today, data: { calls: -1, appointments: 1 } })).status, 400);
    assert.equal((await mgr('POST', '/api/entries', { section: 'osh_sales', date: today, data: { type: 'Sale', description: 'x', amount: 1 } })).status, 403); // other role's section
    const chart = (await mgr('GET', `/api/chart?section=mgr_stats&end=${today}`)).body;
    assert.equal(chart.series[0].values.at(-1), 50);

    const nad = await mk('nadeesha');
    for (const [d, a] of [[today, 1000], ['2024-03-10', 700], ['2023-03-05', 500]]) await nad('POST', '/api/entries', { section: 'acc1_sales', date: d, data: { category: 'Treatment', amount: a } });
    const cmp = (await nad('GET', `/api/chart?section=acc1_sales&end=${today}`)).body;
    assert.equal(cmp.series.length, 4);
    assert.equal(cmp.series.find((s) => s.name === '2024').values[2], 700);

    const osh = await mk('oshani');
    await osh('POST', '/api/entries', { section: 'osh_sales', date: today, data: { type: 'Sale', description: 'a', amount: 300 } });
    await osh('POST', '/api/entries', { section: 'osh_sales', date: today, data: { type: 'Expense', description: 'b', amount: 80 } });
    assert.equal((await mgr('GET', `/api/admin/day?date=${today}`)).status, 403);

    const adm = await mk('admin');
    const day = (await adm('GET', `/api/admin/day?date=${today}`)).body;
    assert.equal(day.users.find((u) => u.username === 'manager').count, 1);
    assert.equal(day.users.find((u) => u.username === 'marketing').count, 0);
    const csv = await adm('GET', `/api/admin/export?from=${today}&to=${today}`);
    assert.equal(csv.status, 200); assert.match(csv.body, /Daily calls/);
    assert.equal((await adm('POST', '/api/admin/users', { username: 'newstaff', name: 'New', role: 'manager', password: 'longpass123' })).status, 200);
    assert.equal((await adm('PATCH', '/api/admin/users/2', { active: false })).status, 200);
    assert.equal((await mgr('GET', '/api/me')).status, 401); // disabled user is locked out
    assert.equal((await bad('GET', '/../../etc/passwd')).status, 404);
    console.log('All smoke tests passed');
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; }
  server.close(); process.exit(process.exitCode || 0);
});

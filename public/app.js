'use strict';
const $app = document.getElementById('app');
const state = { me: null, roles: {}, date: today(), tab: 'day', adminDate: today() };

// ---------- utils ----------
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 });

async function api(method, url, body) {
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') { state.me = null; render(); throw new Error('Please log in'); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
function flash(el, text, ok) {
  el.innerHTML = text ? `<div class="msg ${ok ? 'ok' : 'err'}" role="alert">${esc(text)}</div>` : '';
}
function cell(fd, v) {
  if (fd.type === 'checkbox') return v ? '✔' : '—';
  if (v === undefined || v === '') return '';
  return fd.type === 'number' && fd.money ? fmt(v) : esc(v);
}
function summaryOf(sec, entries) {
  return (sec.summary || []).map((s) => {
    const list = entries.filter((e) => !s.where || e.data[s.where.field] === s.where.equals);
    const v = s.agg === 'count' ? list.length : list.reduce((a, e) => a + (Number(e.data[s.field]) || 0), 0);
    return { label: s.label, value: v, money: s.money };
  });
}
const badges = (sum) => sum.length ? `<div class="badges">${sum.map((s) => `<span class="badge">${esc(s.label)}: <b>${fmt(s.value)}</b></span>`).join('')}</div>` : '';

// ---------- line chart (inline SVG, no libraries) ----------
const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
function niceMax(v) {
  if (v <= 0) return 5;
  const p = 10 ** Math.floor(Math.log10(v)); const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function chartSvg(c) {
  const W = 700, H = 260, L = 54, R = 12, T = 12, B = 30;
  const all = c.series.flatMap((s) => s.values.filter((v) => v !== null));
  const max = niceMax(Math.max(0, ...all));
  const n = c.labels.length;
  const x = (i) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v)}</text>`;
  }
  const step = Math.ceil(n / 8);
  c.labels.forEach((lb, i) => {
    if (i % step === 0 && (n - 1 - i >= step * 0.6 || i === n - 1)) {
      const t = c.mode === 'daily' ? lb.slice(5) : lb;
      g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(t)}</text>`;
    }
  });
  c.series.forEach((s, si) => {
    const col = COLORS[si % COLORS.length];
    let d = ''; let pen = false;
    s.values.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    g += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => { if (v !== null && (n <= 31 || v > 0)) g += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${col}"><title>${esc(s.name)} · ${esc(c.labels[i])}: ${fmt(v)}</title></circle>`; });
  });
  const legend = c.series.map((s, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(s.name)}</span>`).join('');
  return `<div class="chart"><h3>${esc(c.title)}</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}">${g}</svg><div class="legend">${legend}</div></div>`;
}
async function loadChart(sec, el, end) {
  try { el.innerHTML = chartSvg(await api('GET', `/api/chart?section=${sec.id}&end=${end}`)); }
  catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}

// ---------- forms ----------
function fieldHtml(fd, v) {
  const id = `f_${fd.k}`; const req = fd.required ? ' required' : '';
  if (fd.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${fd.k}" ${v ? 'checked' : ''}> ${esc(fd.label)}</label>`;
  if (fd.type === 'textarea') return `<label style="flex-basis:100%">${esc(fd.label)}<textarea name="${fd.k}" maxlength="2000"${req}>${esc(v)}</textarea></label>`;
  if (fd.type === 'select') return `<label>${esc(fd.label)}<select name="${fd.k}"${req}><option value="">–</option>${fd.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const type = fd.type === 'number' ? 'number" step="any' : fd.type;
  const min = fd.min !== undefined ? ` min="${fd.min}"` : '';
  return `<label>${esc(fd.label)}<input id="${id}" type="${type}" name="${fd.k}" value="${esc(v)}"${min}${req}${fd.type === 'text' ? ' maxlength="2000"' : ''}></label>`;
}
function readForm(form, sec) {
  const data = {};
  for (const fd of sec.fields) {
    const el = form.elements[fd.k];
    data[fd.k] = fd.type === 'checkbox' ? el.checked : el.value;
  }
  return data;
}

// ---------- staff: section card ----------
async function renderSection(sec, host, date) {
  const { entries } = await api('GET', `/api/entries?section=${sec.id}&date=${date}`);
  const cols = sec.fields.filter((f) => f.type !== 'textarea' || sec.fields.length < 5);
  let body = `<h2>${esc(sec.title)}</h2>${badges(summaryOf(sec, entries))}<div class="msgbox"></div>`;
  if (sec.unique) {
    const cur = entries[0];
    body += `<form class="row">${sec.fields.map((fd) => fieldHtml(fd, cur?.data[fd.k])).join('')}
      <button class="primary" type="submit">${cur ? 'Update' : 'Save'}</button></form>`;
    if (cur) body += `<p class="muted">Saved ${new Date(cur.updated_at).toLocaleTimeString()} – you can edit and save again.</p>`;
  } else {
    body += `<form class="row">${sec.fields.map((fd) => fieldHtml(fd)).join('')}<button class="primary" type="submit">Add</button></form>`;
    if (entries.length) {
      body += `<div class="table-wrap"><table><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}<th></th></tr></thead><tbody>${
        entries.map((e) => `<tr>${cols.map((f) => `<td>${cell(f, e.data[f.k])}</td>`).join('')}<td><button class="small danger" data-del="${e.id}" aria-label="Delete entry">✕</button></td></tr>`).join('')}</tbody></table></div>`;
    } else body += '<p class="muted">Nothing added for this day yet.</p>';
  }
  if (sec.chart) body += '<div class="chartbox"><p class="muted">Loading chart…</p></div>';
  host.innerHTML = body;
  const box = host.querySelector('.msgbox');
  host.querySelector('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await api('POST', '/api/entries', { section: sec.id, date, data: readForm(ev.target, sec) });
      await renderSection(sec, host, date);
      flash(host.querySelector('.msgbox'), 'Saved ✔', true);
    } catch (e) { flash(box, e.message); }
  });
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this entry?')) return;
    try { await api('DELETE', `/api/entries/${b.dataset.del}`); await renderSection(sec, host, date); } catch (e) { flash(box, e.message); }
  }));
  if (sec.chart) loadChart(sec, host.querySelector('.chartbox'), date);
}

// ---------- shell ----------
function header() {
  const m = state.me;
  return `<header class="top"><div class="wrap"><span class="brand">LJ Healthcare</span>
    <span class="who">${esc(m.name)} · ${esc(m.roleLabel)}</span>
    <button id="pw" class="small">Change password</button><button id="out" class="small">Log out</button></div></header>`;
}
function bindHeader() {
  document.getElementById('out').onclick = async () => { await api('POST', '/api/logout', {}); state.me = null; render(); };
  document.getElementById('pw').onclick = async () => {
    const current = prompt('Current password:'); if (current === null) return;
    const next = prompt('New password (min 8 characters):'); if (next === null) return;
    try { await api('POST', '/api/password', { current, next }); alert('Password changed. Please log in again.'); state.me = null; render(); }
    catch (e) { alert(e.message); }
  };
}

function loginView() {
  $app.innerHTML = `<div class="login card"><h1>LJ Healthcare</h1><p class="muted">Daily work dashboard – please log in</p>
    <div id="m"></div><form><label>Username<input type="text" name="u" autocomplete="username" autofocus required></label>
    <label>Password<input type="password" name="p" autocomplete="current-password" required></label>
    <button class="primary" style="width:100%;margin-top:6px">Log in</button></form></div>`;
  $app.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      await api('POST', '/api/login', { username: ev.target.u.value, password: ev.target.p.value });
      await boot();
    } catch (e) { flash(document.getElementById('m'), e.message); }
  };
}

// ---------- staff view ----------
async function staffView() {
  const role = state.roles[state.me.role];
  $app.innerHTML = `${header()}<div class="wrap"><div class="card row"><label style="max-width:220px">Date
    <input type="date" id="d" value="${state.date}" max="${today()}"></label>
    <p class="muted" style="flex:1 1 240px;margin:0">Enter today's work below. You can pick an earlier date to add or fix older entries.</p></div>
    <div id="secs"></div></div>`;
  bindHeader();
  const secs = document.getElementById('secs');
  const draw = () => {
    secs.innerHTML = role.sections.map(() => '<div class="card"></div>').join('');
    role.sections.forEach((sec, i) => renderSection(sec, secs.children[i], state.date).catch((e) => { secs.children[i].textContent = e.message; }));
  };
  document.getElementById('d').onchange = (ev) => { if (ev.target.value) { state.date = ev.target.value; draw(); } };
  draw();
}

// ---------- admin ----------
const adminTabs = [['day', 'Day summary'], ['charts', 'Charts'], ['users', 'Users'], ['export', 'Export']];
async function adminView() {
  $app.innerHTML = `${header()}<div class="wrap"><div class="tabs">${adminTabs.map(([k, l]) => `<button data-tab="${k}" class="${state.tab === k ? 'active' : ''}">${l}</button>`).join('')}</div><div id="pane"></div></div>`;
  bindHeader();
  $app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; adminView(); });
  const pane = document.getElementById('pane');
  try { await ({ day: adminDay, charts: adminCharts, users: adminUsers, export: adminExport }[state.tab])(pane); }
  catch (e) { pane.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}

async function adminDay(pane) {
  const data = await api('GET', `/api/admin/day?date=${state.adminDate}`);
  let totals = {}; // label -> value across everyone
  const sections = (roleId) => state.roles[roleId]?.sections || [];
  const cards = data.users.map((u) => {
    const secs = sections(u.role);
    const inner = secs.map((sec) => {
      const entries = u.sections[sec.id] || [];
      const sum = summaryOf(sec, entries);
      sum.forEach((s) => { const k = `${sec.title} – ${s.label}`; totals[k] = (totals[k] || 0) + s.value; });
      if (!entries.length) return `<h3 style="margin:14px 0 4px;font-size:15px">${esc(sec.title)}</h3><p class="muted">No entry</p>`;
      const cols = sec.fields;
      return `<h3 style="margin:14px 0 4px;font-size:15px">${esc(sec.title)}</h3>${badges(sum)}<div class="table-wrap"><table><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${
        entries.map((e) => `<tr>${cols.map((f) => `<td>${cell(f, e.data[f.k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('');
    const done = secs.filter((s) => (u.sections[s.id] || []).length).length;
    return `<details class="role" ${u.count ? 'open' : ''}><summary><b>${esc(u.name)}</b><span class="muted">${esc(u.roleLabel)}</span>
      <span class="pill ${u.count ? 'ok' : 'no'}">${u.count ? `${done}/${secs.length} sections updated` : 'Not updated yet'}</span></summary><div class="inner">${inner}</div></details>`;
  }).join('');
  const kpis = Object.entries(totals).filter(([, v]) => v).map(([l, v]) => `<div class="kpi"><div class="v">${fmt(v)}</div><div class="l">${esc(l)}</div></div>`).join('');
  const missing = data.users.filter((u) => !u.count).map((u) => u.name);
  pane.innerHTML = `<div class="card row"><label style="max-width:220px">Date<input type="date" id="ad" value="${state.adminDate}"></label>
    <button id="prev">◀ Previous day</button><button id="next">Next day ▶</button><button id="tod">Today</button></div>
    ${missing.length ? `<div class="msg err">Not updated yet: ${esc(missing.join(', '))}</div>` : '<div class="msg ok">Everyone has updated today ✔</div>'}
    ${kpis ? `<div class="grid">${kpis}</div>` : ''}${cards}`;
  const go = (d) => { state.adminDate = d; adminView(); };
  const shift = (n) => { const d = new Date(state.adminDate + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  pane.querySelector('#ad').onchange = (e) => e.target.value && go(e.target.value);
  pane.querySelector('#prev').onclick = () => go(shift(-1));
  pane.querySelector('#next').onclick = () => go(shift(1));
  pane.querySelector('#tod').onclick = () => go(today());
}

async function adminCharts(pane) {
  const items = [];
  for (const [rid, r] of Object.entries(state.roles)) for (const s of r.sections) if (s.chart) items.push({ s, label: r.label });
  pane.innerHTML = items.map((it, i) => `<div class="card"><span class="muted">${esc(it.label)} · ${esc(it.s.title)}</span><div id="c${i}"><p class="muted">Loading…</p></div></div>`).join('');
  items.forEach((it, i) => loadChart(it.s, document.getElementById('c' + i), today()));
}

async function adminUsers(pane) {
  const { users } = await api('GET', '/api/admin/users');
  const roleOpts = Object.entries(state.roles).map(([k, r]) => `<option value="${k}">${esc(r.label)}</option>`).join('');
  pane.innerHTML = `<div class="card"><h2>Staff logins</h2><div id="um"></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${
    users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.roleLabel)}</td><td>${u.active ? '<span class="pill ok">Active</span>' : '<span class="pill no">Disabled</span>'}</td>
    <td><button class="small" data-pw="${u.id}">Reset password</button> <button class="small ${u.active ? 'danger' : ''}" data-act="${u.id}" data-to="${u.active ? 0 : 1}">${u.active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Add a new login</h2><form class="row" id="nu"><label>Name<input type="text" name="name" required></label>
    <label>Username<input type="text" name="username" required pattern="[A-Za-z0-9._-]{3,30}"></label>
    <label>Role<select name="role">${roleOpts}</select></label>
    <label>Password (min 8)<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="primary">Create</button></form></div>`;
  const m = pane.querySelector('#um');
  pane.querySelectorAll('[data-pw]').forEach((b) => b.onclick = async () => {
    const p = prompt('New password (min 8 characters):'); if (!p) return;
    try { await api('PATCH', `/api/admin/users/${b.dataset.pw}`, { password: p }); flash(m, 'Password updated', true); } catch (e) { flash(m, e.message); }
  });
  pane.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
    try { await api('PATCH', `/api/admin/users/${b.dataset.act}`, { active: b.dataset.to === '1' }); adminView(); } catch (e) { flash(m, e.message); }
  });
  pane.querySelector('#nu').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try { await api('POST', '/api/admin/users', { name: f.name.value, username: f.username.value, role: f.role.value, password: f.password.value }); adminView(); }
    catch (e) { flash(m, e.message); }
  };
}

async function adminExport(pane) {
  const first = state.adminDate.slice(0, 8) + '01';
  pane.innerHTML = `<div class="card"><h2>Download report (CSV / Excel)</h2><p class="muted">All staff entries between two dates.</p>
    <div class="row"><label>From<input type="date" id="xf" value="${first}"></label><label>To<input type="date" id="xt" value="${state.adminDate}"></label>
    <a id="xl"><button class="primary" type="button">Download</button></a></div></div>`;
  const upd = () => { pane.querySelector('#xl').href = `/api/admin/export?from=${pane.querySelector('#xf').value}&to=${pane.querySelector('#xt').value}`; };
  pane.querySelector('#xf').onchange = upd; pane.querySelector('#xt').onchange = upd; upd();
}

// ---------- boot ----------
function render() {
  if (!state.me) return loginView();
  return state.me.role === 'admin' ? adminView() : staffView();
}
async function boot() {
  try { const r = await api('GET', '/api/me'); state.me = r.user; state.roles = r.roles; } catch { state.me = null; }
  render();
}
boot();

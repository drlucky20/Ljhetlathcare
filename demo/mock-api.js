// Browser-only stand-in for server.js, used by the shareable demo page. Data lives in this browser only.
(function () {
  const { roles, seedUsers } = window.DEMO_CONFIG;
  const sectionIndex = {};
  for (const [rid, r] of Object.entries(roles)) for (const s of r.sections) sectionIndex[s.id] = { ...s, role: rid };
  const KEY = 'lj-demo-v1';
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function seed() {
    const users = seedUsers.map((u, i) => ({ id: i + 1, ...u, active: true }));
    const uid = (r) => users.find((u) => u.role === r).id;
    const entries = []; let id = 1;
    let seedN = 7; const rnd = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
    const rr = (a, b) => Math.round(a + rnd() * (b - a));
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const add = (role, section, date, data) => entries.push({ id: id++, user_id: uid(role), section, date, data, updated_at: new Date().toISOString() });
    const today = todayStr();
    const prods = ['Vitamin C Serum', 'Sunscreen SPF 50', 'Hydra Facial Kit', 'Acne Gel', 'Night Cream', 'Hair Tonic'];
    for (let i = 0; i < 45; i++) {
      const d = addDays(today, -i);
      add('manager', 'mgr_stats', d, { calls: rr(25, 55), appointments: rr(6, 15), note: i === 0 ? 'Busy morning, many bridal inquiries' : undefined });
      add('manager', 'mgr_tasks', d, { web_product: rnd() > 0.3, chart_updated: true, sales_report: rnd() > 0.2, complaints_checked: rnd() > 0.2, special_note: i === 0 ? 'Supplier delivery arriving tomorrow 10am' : '' });
      if (i % 4 === 0) add('manager', 'mgr_web_products', d, { product: pick(prods), price: rr(2500, 12000) });
      if (i < 12) for (let k = 0; k < 2; k++) add('manager', 'mgr_product_sales', d, { product: pick(prods), qty: rr(1, 6), amount: rr(4000, 28000) });
      if (i % 6 === 0) add('manager', 'mgr_complaints', d, { customer: pick(['Kamani P.', 'Nuwan S.', 'Ishara D.']), complaint: 'Waited too long for appointment', status: i === 0 ? 'Open' : 'Resolved' });
      if (i % 2 === 0) add('marketing', 'mkt_videos', d, { name: pick(['Facial treatment tips', 'Meet Dr. LJ', 'Before & after', 'Skin care routine']), video_date: d, platform: pick(['Facebook', 'Instagram', 'TikTok']) });
      add('marketing', 'mkt_campaign', d, { campaign: pick(['Christmas Glow Offer', 'New Year Skin Reset']), platform: pick(['Facebook', 'Instagram']), spend: rr(1500, 6000), results: rr(40, 400) });
      if (i % 3 === 0) add('marketing', 'mkt_web_products', d, { product: pick(prods), action: pick(['Added', 'Updated']) });
      add('marketing', 'mkt_tasks', d, { videos_done: true, campaign_done: true, web_done: rnd() > 0.4, special_note: '' });
      add('accountant1', 'acc1_check', d, { cash: true, bank: true, invoices: rnd() > 0.15, note: '' });
      for (let k = 0; k < 3; k++) add('accountant1', 'acc1_sales', d, { category: pick(['Consultation', 'Treatment', 'Pharmacy / Products', 'Lab']), amount: rr(6000, 22000) });
      add('accountant1', 'acc1_patients', d, { new_patients: rr(3, 14), total_patients: rr(18, 45) });
      if (i % 3 === 0) add('accountant2', 'acc2_lectures', d, { lecturer: pick(['Dr. Perera', 'Mr. Silva']), topic: 'Skin Care Basics', students: rr(8, 30) });
      if (i % 7 === 0) add('accountant2', 'acc2_payments', d, { lecturer: pick(['Dr. Perera', 'Mr. Silva']), amount: rr(15000, 40000), status: 'Paid' });
      add('accountant2', 'acc2_lj_products', d, { product: pick(prods), qty: rr(1, 8), amount: rr(3000, 26000) });
      if (i % 2 === 0) add('accountant2', 'acc2_glorea', d, { item: 'Glorea Cleanser', qty: rr(1, 5), amount: rr(2000, 12000) });
      add('accountant2', 'acc2_cosmetics', d, { product: pick(['Lip Tint', 'BB Cream', 'Compact Powder']), qty: rr(1, 6), amount: rr(1500, 15000) });
      if (i > 0) { // receptionist has not updated today, to show the admin warning
        for (let k = 0; k < rr(2, 5); k++) add('receptionist', 'rec_customers', d, { customer: pick(['Dilani', 'Thilina', 'Sachini', 'Ruwan', 'Amaya']), phone: '07' + rr(10000000, 79999999), details: 'Follow-up call done' });
        if (i % 5 === 0) add('receptionist', 'rec_complaints', d, { customer: 'Mala F.', complaint: 'Product allergy reaction', status: 'In progress' });
        add('receptionist', 'rec_sales', d, { type: 'Sale', description: 'Day sales', amount: rr(35000, 90000) });
        add('receptionist', 'rec_sales', d, { type: 'Expense', description: pick(['Cleaning supplies', 'Tea & refreshments', 'Courier']), amount: rr(3000, 14000) });
      }
    }
    // Earlier years of monthly sales so the year-vs-year chart has history
    const cutoff = addDays(today, -45); const y = Number(today.slice(0, 4));
    for (let yr = y - 3; yr <= y; yr++) for (let m = 1; m <= 12; m++) {
      const d = `${yr}-${pad(m)}-15`; if (d >= cutoff) continue;
      const base = 450000 + (yr - (y - 3)) * 180000;
      add('accountant1', 'acc1_sales', d, { category: 'Treatment', amount: Math.round(base * (0.85 + 0.3 * Math.abs(Math.sin(m * 1.3 + yr)))) });
    }
    return { users, entries, nextId: id };
  }

  let store; try { store = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  if (!store) store = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } };
  let me = null;
  try { me = JSON.parse(sessionStorage.getItem(KEY + '-me')); } catch { /* ignore */ }
  const setMe = (u) => { me = u; try { sessionStorage.setItem(KEY + '-me', JSON.stringify(u)); } catch { /* ignore */ } };

  const E = (status, error) => ({ status, body: { error } });
  const isDate = (s) => typeof s === 'string' && DATE_RE.test(s);

  function clean(sec, input) {
    const out = {};
    for (const fd of sec.fields) {
      let v = input[fd.k];
      if (fd.type === 'checkbox') { out[fd.k] = v === true; continue; }
      if (v === undefined || v === null || String(v).trim() === '') { if (fd.required) return `${fd.label} is required`; continue; }
      if (fd.type === 'number') { v = Number(v); if (!Number.isFinite(v)) return `${fd.label} must be a number`; if (fd.min !== undefined && v < fd.min) return `${fd.label} must be at least ${fd.min}`; }
      else if (fd.type === 'select') { if (!fd.options.includes(v)) return `${fd.label}: invalid option`; }
      else v = String(v).trim();
      out[fd.k] = v;
    }
    return out;
  }
  const matches = (w, d) => !w || d[w.field] === w.equals;

  function chart(sec, end) {
    const c = sec.chart; const rows = store.entries.filter((e) => e.section === sec.id);
    if (c.mode === 'daily') {
      const labels = Array.from({ length: c.days }, (_, i) => addDays(end, -(c.days - 1) + i));
      const series = c.series.map((s) => ({ name: s.name, values: labels.map(() => 0) }));
      for (const r of rows) { const i = labels.indexOf(r.date); if (i < 0) continue; c.series.forEach((s, si) => { if (matches(s.where, r.data)) series[si].values[i] += s.agg === 'count' ? 1 : Number(r.data[s.field]) || 0; }); }
      return { title: c.title, mode: c.mode, labels, series };
    }
    const ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7));
    const years = Array.from({ length: c.years }, (_, i) => ey - (c.years - 1 - i));
    const series = years.map((y) => ({ name: String(y), values: Array.from({ length: 12 }, (_, m) => (y === ey && m + 1 > em ? null : 0)) }));
    for (const r of rows) { const s = series[years.indexOf(Number(r.date.slice(0, 4)))]; const m = Number(r.date.slice(5, 7)) - 1; if (s && s.values[m] !== null) s.values[m] += Number(r.data[c.field]) || 0; }
    return { title: c.title, mode: c.mode, labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], series };
  }

  function handle(method, url, body) {
    const u = new URL(url, 'http://x'); const p = u.pathname; const q = Object.fromEntries(u.searchParams);
    if (method === 'POST' && p === '/api/login') {
      const user = store.users.find((x) => x.username === String(body.username || '').trim().toLowerCase());
      if (!user || !user.active || body.password !== (user.password || 'demo')) return E(401, 'Wrong username or password (demo password is: demo)');
      setMe(user); return { status: 200, body: { ok: true } };
    }
    if (method === 'POST' && p === '/api/logout') { setMe(null); return { status: 200, body: { ok: true } }; }
    if (!me) return E(401, 'Please log in');
    const admin = me.role === 'admin';
    if (method === 'GET' && p === '/api/me') return { status: 200, body: { user: { id: me.id, username: me.username, name: me.name, role: me.role, roleLabel: roles[me.role].label }, roles: admin ? roles : { [me.role]: roles[me.role] } } };
    if (method === 'POST' && p === '/api/password') return E(400, 'Not available in the demo');
    if (p === '/api/entries' && method === 'GET') {
      const sec = sectionIndex[q.section]; if (!sec || !isDate(q.date)) return E(400, 'Bad request');
      if (!admin && sec.role !== me.role) return E(403, 'Not allowed');
      return { status: 200, body: { entries: store.entries.filter((e) => e.section === q.section && e.date === q.date && (admin || e.user_id === me.id)) } };
    }
    if (p === '/api/entries' && method === 'POST') {
      const sec = sectionIndex[body.section]; if (!sec || !isDate(body.date)) return E(400, 'Bad request');
      if (sec.role !== me.role) return E(403, 'Not allowed');
      const data = clean(sec, body.data || {}); if (typeof data === 'string') return E(400, data);
      const ex = sec.unique && store.entries.find((e) => e.user_id === me.id && e.section === sec.id && e.date === body.date);
      if (ex) { ex.data = data; ex.updated_at = new Date().toISOString(); } else store.entries.push({ id: store.nextId++, user_id: me.id, section: sec.id, date: body.date, data, updated_at: new Date().toISOString() });
      save(); return { status: 200, body: { ok: true } };
    }
    let m;
    if (method === 'DELETE' && (m = p.match(/^\/api\/entries\/(\d+)$/))) {
      const i = store.entries.findIndex((e) => e.id === Number(m[1])); if (i < 0) return E(404, 'Not found');
      if (!admin && store.entries[i].user_id !== me.id) return E(403, 'Not allowed');
      store.entries.splice(i, 1); save(); return { status: 200, body: { ok: true } };
    }
    if (method === 'GET' && p === '/api/chart') {
      const sec = sectionIndex[q.section]; if (!sec || !sec.chart) return E(400, 'Bad request');
      if (!admin && sec.role !== me.role) return E(403, 'Not allowed');
      return { status: 200, body: chart(sec, isDate(q.end) ? q.end : todayStr()) };
    }
    if (p.startsWith('/api/admin/') && !admin) return E(403, 'Admin only');
    if (method === 'GET' && p === '/api/admin/day') {
      const users = store.users.filter((x) => x.active && x.role !== 'admin').map((x) => {
        const mine = store.entries.filter((e) => e.user_id === x.id && e.date === q.date); const sections = {};
        for (const e of mine) (sections[e.section] ||= []).push(e);
        return { id: x.id, username: x.username, name: x.name, role: x.role, roleLabel: roles[x.role].label, count: mine.length, sections };
      });
      return { status: 200, body: { date: q.date, users } };
    }
    if (method === 'GET' && p === '/api/admin/users') return { status: 200, body: { users: store.users.map((x) => ({ id: x.id, username: x.username, name: x.name, role: x.role, active: x.active, roleLabel: roles[x.role].label })) } };
    if (method === 'POST' && p === '/api/admin/users') {
      if (!/^[a-z0-9._-]{3,30}$/i.test(body.username || '')) return E(400, 'Username: 3-30 letters/numbers');
      if (store.users.some((x) => x.username === body.username.toLowerCase())) return E(409, 'Username already exists');
      store.users.push({ id: store.users.length + 1, username: body.username.toLowerCase(), name: body.name, role: body.role, active: true, password: body.password }); save();
      return { status: 200, body: { ok: true } };
    }
    if (method === 'PATCH' && (m = p.match(/^\/api\/admin\/users\/(\d+)$/))) {
      const t = store.users.find((x) => x.id === Number(m[1])); if (!t) return E(404, 'Not found');
      if (body.password) t.password = body.password;
      if (body.active !== undefined) { if (t.id === me.id) return E(400, 'You cannot deactivate yourself'); t.active = !!body.active; }
      save(); return { status: 200, body: { ok: true } };
    }
    return E(404, 'Not found');
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      let r; try { r = handle((opts.method || 'GET').toUpperCase(), url, opts.body ? JSON.parse(opts.body) : {}); } catch (e) { r = E(500, 'Demo error'); }
      return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(url, opts);
  };
  // The artifact viewer blocks confirm()/prompt(): confirm always agrees, prompt is unavailable.
  window.confirm = () => true;
  window.prompt = () => null;
  window.DEMO = true;
})();

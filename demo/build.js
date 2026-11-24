// Builds demo/demo.html: one self-contained page (UI + in-browser mock API + sample data) for sharing a preview.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const { roles, seedUsers } = require('../config');
let css = rd('public/style.css');
// theme tokens in the shape the artifact viewer expects
const m = css.match(/@media \(prefers-color-scheme:dark\)\{:root\{([^}]*)\}\}/);
css = css.replace(m[0], `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${m[1]}}}\n:root[data-theme="dark"]{${m[1]}}`);
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public/logo.png')).toString('base64');
const app = rd('public/app.js').replace(/\/logo\.png/g, logo)
  .replace("<div id=\"m\"></div>", "<div id=\"m\"></div><div class=\"msg ok\">DEMO – sample data, stays in your browser.<br>Password for every login: <b>demo</b><br>Usernames: admin, manager, marketing, nadeesha, krishntha, receptionist</div>");
const exportStub = "async function adminExport(pane) { pane.innerHTML = '<div class=\"card\"><h2>Download report (CSV / Excel)</h2><p class=\"muted\">Available in the real app (not in this demo).</p></div>'; }";
const app2 = app.replace(/async function adminExport[\s\S]*?\n}\n/, exportStub + '\n');
const html = `<title>Doctor LJ Daily Dashboard</title>
<style>${css}
body{margin:0}</style>
<div id="app"></div>
<script>window.DEMO_CONFIG=${JSON.stringify({ roles, seedUsers })};</script>
<script>${rd('demo/mock-api.js')}</script>
<script>${app2}</script>
`;
fs.writeFileSync(path.join(__dirname, 'demo.html'), html);
console.log('demo/demo.html', Math.round(html.length / 1024) + ' KB');

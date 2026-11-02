// Restyling MirabiWatt (14/10/2026), poi come intervals.icu: un foglio di tema comune alle due pagine, testi leggibili
// (almeno 12px, niente maiuscolo spaziato né corsivo, niente ciano trasparente), card al posto del neon, niente griglia;
// in cima «← Control Panel › MirabiWatt». node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const CSS = () => fs.readFileSync(path.join(DIR, 'mira-tema.css'), 'utf8');
const regola = sel => { const m = CSS().match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '[^{]*\\{([^}]*)\\}')); return m ? m[1] : ''; };

// 14/10: index.html è solo un rimando ai Tools dentro la dashboard (tools_tema_dom.test.js)
for (const pagina of ['dashboard.html']) {
  test(`${pagina}: il tema Mira dopo gli stili della pagina e il ritorno al Control Panel`, async () => {
    const html = fs.readFileSync(path.join(DIR, pagina), 'utf8');
    const iLink = html.indexOf('href="mira-tema.css"'), iStyle = html.lastIndexOf('</style>', html.indexOf('</head>'));
    assert.ok(iLink > 0, 'il foglio del tema');
    assert.ok(iLink > iStyle, 'dopo gli stili della pagina, così vince');
    const dom = new JSDOM(html, { url: 'http://192.168.1.38:3000/' + pagina, runScripts: 'dangerously', virtualConsole: new VirtualConsole() });
    const a = dom.window.document.getElementById('tornaCp');
    assert.ok(a, '«← Control Panel»');
    assert.strictEqual(a.getAttribute('href'), 'http://192.168.1.38:8080/', 'sullo stesso indirizzo da cui l\'hai aperto');
    assert.match(dom.window.document.querySelector('.crumbs').textContent, /Control Panel.*MirabiWatt/s);
    dom.window.close();
  });
}

test('tema: testi leggibili, colori di Mira Economy, niente neon né griglia', () => {
  const css = CSS();
  // 14/10 sera: palette come intervals.icu (indaco scuro, azzurro), sempre leggibile; dal 31/10 i valori misurati su
  // intervals stanno in icu.css (tests/icu_stile.test.js), qui restano quelli di riserva
  assert.match(css, /--card: #26243a/);
  assert.match(css, /--accent: #4fc3f7/);
  for (const [sel, min] of [['.text-\\[8px\\]', 12], ['.text-\\[9px\\]', 12], ['.text-\\[10px\\]', 12.5], ['.text-xs', 13]]) {
    const px = Number((regola(sel).match(/font-size:\s*([\d.]+)px/) || [])[1]);
    assert.ok(px >= min, `${sel}: ${px}px`);
  }
  assert.match(regola('.uppercase'), /text-transform:\s*none/);
  assert.match(regola('.tracking-widest'), /letter-spacing:\s*normal/);
  assert.match(regola('.italic'), /font-style:\s*normal/);
  assert.match(regola('.neon-text'), /text-shadow:\s*none/);
  assert.match(regola('.neon-border'), /box-shadow:\s*none/);
  assert.match(regola('.text-cyan-500\\/50'), /color:\s*var\(--muted\)/);
  assert.match(regola('html body'), /background-image:\s*none/);
});

test('il server dà il tema come CSS', async () => {
  const r = await new Promise((ok, ko) => http.get('http://127.0.0.1:3000/mira-tema.css', ok).on('error', ko));
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['content-type'], /text\/css/);
  r.resume();
});

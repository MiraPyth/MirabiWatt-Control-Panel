// Tools dentro MirabiWatt e tema chiaro/scuro (14/10/2026). I Tools (Kcal, FTP e CP, idratazione, predictor, salite,
// piano) sono una vista della dashboard, non più una pagina a parte; il vecchio index.html rimanda lì. In fondo alla barra
// laterale «Tema chiaro» / «Tema scuro», come «Light Mode» di intervals.icu, ricordato fra una visita e l'altra.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

function pagina({ hash = '', tema = null } = {}) {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  const vc = new VirtualConsole(), errori = [];
  vc.on('jsdomError', e => errori.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://192.168.1.38:3000/' + hash,
    beforeParse(w) {
      if (tema) w.localStorage.setItem('mirabiwatt_tema', tema);
      w.lucide = { createIcons() {} }; w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async u => {
        const s = String(u);
        const r = s.startsWith('/api/calendar') ? { activities: [], wellness: [] } : s.startsWith('/api/automation') ? { installed: false }
          : s.startsWith('/api/ftp-tests') || s.startsWith('/api/saved-meals') ? [] : {};
        return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(r)) };
      };
    } });
  return { w: dom.window, d: dom.window.document, errori };
}

// 14/10 sera: i Tools rifatti (tre calcolatrici nello stile della dashboard) sono in oggi_tools_dom.test.js

test('Tools: il vecchio indirizzo index.html porta alla vista Tools della dashboard', async () => {
  const idx = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  assert.match(idx, /http-equiv="refresh" content="0; ?url=\/#strumenti"/);
  const { d, errori } = pagina({ hash: '#strumenti' });
  await tick(150);
  assert.ok(d.querySelector('#view-tools').classList.contains('active'));
  assert.deepStrictEqual(errori, []);
});

test('tema chiaro / scuro: la voce in fondo alla barra laterale, ricordato', async () => {
  let { w, d, errori } = pagina();
  await tick(100);
  const html = d.documentElement, voce = d.querySelector('#mw-tema');
  assert.ok(voce, 'la voce del tema');
  assert.ok(!html.hasAttribute('data-tema') || html.dataset.tema === 'scuro');
  assert.match(voce.textContent, /Tema chiaro/);
  voce.click();
  assert.strictEqual(html.dataset.tema, 'chiaro');
  assert.strictEqual(w.localStorage.getItem('mirabiwatt_tema'), 'chiaro');
  assert.match(voce.textContent, /Tema scuro/);
  voce.click();
  assert.strictEqual(html.dataset.tema, 'scuro');
  assert.deepStrictEqual(errori, []);
  // alla prossima apertura il tema scelto c'è già, prima che la pagina si disegni
  ({ d, errori } = pagina({ tema: 'chiaro' }));
  assert.strictEqual(d.documentElement.dataset.tema, 'chiaro');
  const css = fs.readFileSync(path.join(DIR, 'mira-tema.css'), 'utf8');
  const chiaro = (css.match(/html\[data-tema="chiaro"\]\s*\{([^}]*)\}/) || [])[1] || '';
  for (const v of ['--bg', '--side', '--card', '--text', '--muted', '--accent']) assert.match(chiaro, new RegExp(v + ':'), v);
  assert.match(chiaro, /--text: #1/, 'testo scuro su fondo chiaro');
  assert.doesNotMatch(fs.readFileSync(path.join(DIR, 'calendario.css'), 'utf8'), /background: #2|background: #3/, 'niente colori scuri fissi: solo variabili');
});

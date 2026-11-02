// 19/10/2026: in Stagione si sceglie il piano stagionale salvato sull'OptiPlex; le ripianificazioni salvate nel
// browser restano del loro piano; le sedute di palestra hanno il loro colore. Data finta: lunedì 19 ottobre 2026.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 19, 10, 0, 0).getTime();
const MIX = JSON.parse(fs.readFileSync(path.join(DIR, 'piani', 'mixed-body-building.json'), 'utf8'));

function pagina(attivo) {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  assert.match(html, /<script src="\/piano-attivo\.js"><\/script>/, 'il piano attivo arriva dal server');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  html = html.replace('<script src="/piano-attivo.js"></script>', attivo ? `<script>usaPiano(${JSON.stringify(attivo)})</script>` : '');
  const vc = new VirtualConsole(), errori = [], richieste = [];
  vc.on('jsdomError', e => errori.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://192.168.1.38:3000/',
    beforeParse(w) {
      const Vero = w.Date;
      class Finto extends Vero { constructor(...a) { super(...(a.length ? a : [FISSO])); } static now() { return FISSO; } }
      w.Date = Finto;
      w.lucide = { createIcons() {} };
      w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.mwRicarica = () => richieste.push({ url: 'ricarica' });
      w.fetch = async (url, o = {}) => {
        const u = String(url), body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: u, metodo: o.method || 'GET', body });
        let r = {};
        if (u.startsWith('/api/piani/inizio')) r = { inizioPalestra: body.inizio };
        else if (u.startsWith('/api/piani') && o.method === 'POST') r = { attivo: body.id };
        else if (u.startsWith('/api/piani')) r = { attivo: attivo ? attivo.id : 'full-cycling', inizioPalestra: '2026-10-26', finestra: ['2026-10-19', '2026-11-09'], piani: [
          { id: 'full-cycling', nome: 'Piano invernale full cycling' }, { id: 'mixed-body-building', nome: 'Piano invernale mixed body building' }] };
        else if (u.startsWith('/api/dashboard')) r = { profile: { name: 'Tiziano', ftp: 320, cp: 290, weightKg: 72 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 45, atl: 48, tsb: -3 }, lastActivity: null, nextWorkout: null };
        else if (u.startsWith('/api/calendar')) r = { activities: [], wellness: [] };
        else if (u.startsWith('/api/ftp-tests') || u.startsWith('/api/saved-meals') || u.startsWith('/api/obiettivi')) r = u.includes('obiettivi') ? { obiettivi: [] } : [];
        const testo = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(testo) };
      };
    } });
  return { w: dom.window, d: dom.window.document, errori, richieste };
}

test('Stagione: scelta del piano, con il piano attivo selezionato; cambiarlo lo salva e ricarica', async () => {
  const { d, richieste, errori } = pagina(MIX);
  await tick(200);
  const sel = d.getElementById('piano-scelta');
  assert.ok(sel, 'il selettore del piano');
  assert.deepStrictEqual([...sel.options].map(o => o.textContent), ['Piano invernale full cycling', 'Piano invernale mixed body building']);
  assert.strictEqual(sel.value, 'mixed-body-building');
  sel.value = 'full-cycling';
  sel.dispatchEvent(new d.defaultView.Event('change'));
  await tick(50);
  const p = richieste.find(r => r.url === '/api/piani' && r.metodo === 'POST');
  assert.deepStrictEqual(p.body, { id: 'full-cycling' });
  assert.ok(richieste.some(r => r.url === 'ricarica'));
  assert.deepStrictEqual(errori, []);
});

test('il calendario mostra il piano attivo; la palestra ha il suo colore', async () => {
  const { d } = pagina(MIX);
  await tick(200);
  // 25/10/2026: settimana del 26/10 fuori casa con gli elastici (la palestra parte il 2/11); la settimana del 19 resta quella di prima
  assert.doesNotMatch(d.querySelector('[data-data="2026-10-19"]').textContent, /Petto-Spalle|Elastici/);
  const lun = d.querySelector('[data-data="2026-10-26"]');
  assert.ok(lun, 'il lunedì 26/10');
  assert.match(lun.textContent, /Elastici Spinta/);
  assert.ok(lun.querySelector('.z-palestra'), 'colore palestra');
});

test('ripianificazioni salvate: separate per piano', async () => {
  const { w } = pagina(MIX);
  await tick(100);
  assert.strictEqual(w.eval('REPLAN_STORAGE_KEY'), 'mirabiwatt_replan_overrides:mixed-body-building');
  const full = pagina(null);
  await tick(100);
  assert.strictEqual(full.w.eval('REPLAN_STORAGE_KEY'), 'mirabiwatt_replan_overrides', 'full cycling tiene quelle di prima');
});

test('piano mixed attivo: «Palestra dal» con i lunedì possibili da questa settimana; cambiarlo rigenera e ricarica', async () => {
  const { d, richieste } = pagina(MIX);
  await tick(200);
  const sel = d.getElementById('piano-inizio');
  assert.ok(sel && !sel.closest('[hidden]'), 'visibile col piano mixed');
  assert.deepStrictEqual([...sel.options].map(o => o.value), ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
  assert.strictEqual(sel.value, '2026-10-26');
  sel.value = '2026-11-02';
  sel.dispatchEvent(new d.defaultView.Event('change'));
  await tick(50);
  assert.deepStrictEqual(richieste.find(r => r.url === '/api/piani/inizio').body, { inizio: '2026-11-02' });
  assert.ok(richieste.some(r => r.url === 'ricarica'));
});

test('piano full cycling attivo: niente «Palestra dal»', async () => {
  const { d } = pagina(null);
  await tick(200);
  assert.ok(d.getElementById('piano-inizio').closest('[hidden]'));
});

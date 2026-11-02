// 19/10/2026 sera: menu laterale con «Fondamenti di Body Building» (la «Bibbia») e «Mira Ricettario»; Nutrizione per fase
// con palestra, consigli (acqua, frutta e verdura, integratori) e ricette del Ricettario sotto i pasti.
// Data finta: lunedì 30 novembre 2026 (costruzione), piano mixed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 10, 30, 9, 0, 0).getTime();
const MIX = JSON.parse(fs.readFileSync(path.join(DIR, 'piani', 'mixed-body-building.json'), 'utf8'));
const finestre = [];
test.after(() => finestre.forEach(w => w.close()));

function pagina() {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  html = html.replace('<script src="/piano-attivo.js"></script>', `<script>usaPiano(${JSON.stringify(MIX)})</script>`);
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
      w.fetch = async (url, o = {}) => {
        const u = String(url);
        richieste.push(u);
        let r = {};
        if (u.startsWith('/api/ricette-pasto')) r = { ricette: [{ id: 'r-111', titolo: 'Pollo al limone', dieta: 'onnivora', porzioni_consigliate: 1.5, macro: { kcal: 600, p: 50, c: 40, g: 20 }, minuti: 25 }] };
        else if (u.startsWith('/api/piani')) r = { attivo: MIX.id, piani: [] };
        else if (u.startsWith('/api/dashboard')) r = { profile: { name: 'Tiziano', ftp: 305, cp: 281, weightKg: 81 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 50, atl: 52, tsb: -2 }, lastActivity: null, nextWorkout: null };
        else if (u.startsWith('/api/calendar')) r = { activities: [], wellness: [] };
        else if (u.startsWith('/api/obiettivi')) r = { obiettivi: [] };
        else if (u.startsWith('/api/ftp-tests') || u.startsWith('/api/saved-meals')) r = [];
        const t = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(t) };
      };
    } });
  finestre.push(dom.window);
  return { w: dom.window, d: dom.window.document, errori, richieste };
}

test('menu laterale: Fondamenti di Body Building e Mira Ricettario', async () => {
  const { d } = pagina();
  await tick(150);
  const bibbia = d.querySelector('.sidebar-item[data-view="view-bibbia"]');
  assert.ok(bibbia, 'voce Fondamenti di Body Building');
  assert.match(bibbia.textContent, /Fondamenti di Body Building/);
  const ric = d.getElementById('mw-ricettario');
  assert.ok(ric, 'voce Mira Ricettario');
  assert.match(ric.textContent, /Mira Ricettario/);
  assert.strictEqual(ric.getAttribute('href'), 'http://192.168.1.38:8100/');
});

test('Fondamenti di Body Building: concetti per livello, numeri chiave e fonti', async () => {
  const { d, errori } = pagina();
  await tick(150);
  d.querySelector('.sidebar-item[data-view="view-bibbia"]').click();
  const v = d.getElementById('view-bibbia');
  assert.ok(v.classList.contains('active'));
  const sezioni = v.querySelectorAll('.bb-sezione');
  assert.ok(sezioni.length >= 8, `sezioni: ${sezioni.length}`);
  const t = v.textContent;
  for (const k of ['Aderenza', 'Volume', 'RIR', 'Progressione', 'Scelta degli esercizi', 'Recuperi', 'Scarico', 'Bilancio energetico', 'Proteine', 'Integratori', 'Bici e palestra']) assert.ok(t.includes(k), k);
  assert.ok(v.querySelector('.bb-piramide'), 'la piramide come grafico');
  assert.ok(v.querySelectorAll('.bb-fonti li').length >= 10, 'fonti');
  assert.deepStrictEqual(errori, []);
});

test('Nutrizione: fase del giorno, palestra, consigli e ricette del Ricettario sotto i pasti', async () => {
  const { d, richieste, errori } = pagina();
  await tick(150);
  d.querySelector('.sidebar-item[data-view="view-nutrition"]').click();
  await tick(80);
  const n = d.getElementById('dash-nutrition');
  assert.match(n.textContent, /Costruzione/, 'la fase della settimana');
  assert.ok([...n.querySelectorAll('button')].some(b => /Palestra/.test(b.textContent)), 'scheda giorno di palestra');
  assert.match(n.textContent, /Creatina/);
  assert.match(n.textContent, /litri/i);
  assert.ok(richieste.some(u => u.startsWith('/api/ricette-pasto?') && /kcal=\d+/.test(u)), 'chiede le ricette per i pasti');
  await tick(80);
  const link = n.querySelector('a.mw-ricetta');
  assert.ok(link, 'una ricetta sotto un pasto');
  assert.strictEqual(link.getAttribute('href'), 'http://192.168.1.38:8100/#ricetta=r-111');
  assert.match(link.textContent, /Pollo al limone/);
  assert.deepStrictEqual(errori, []);
});

// Barra laterale nell'ordine nuovo, nome modificabile, Analisi FTP e Fitness come intervals.icu, obiettivi dentro
// Stagione con «+ Aggiungi obiettivo» (14/10/2026). Data finta: 14 ottobre 2026.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 14, 10, 0, 0).getTime();

const curva = (id, label, start, k, extra = {}) => ({ id, label, start, end: '2026-10-14', peso: 82.25,
  secs: [1, 5, 60, 180, 300, 600, 720, 1200, 3600], watts: [958, 945, 422, 380, 360, 312, 311, 291, 250].map(w => Math.round(w * k)),
  wkg: [11.67, 11.51, 5.05, 4.54, 4.3, 3.73, 3.72, 3.48, 3.04].map(w => Math.round(w * k * 100) / 100), cp: Math.round(281 * k), wPrime: 25200, eftp: Math.round(287 * k),
  map: k > 1 ? { watts: 345, wkg: 4.12, secs: 387 } : null, vo2max: 54.8, cs5m: 1550, ...extra });
const CURVE = { peso: 82.25, curve: [curva('42d', '42 days', '2026-09-02', 1), curva('84d', '84 days', '2026-07-22', 1.0001), curva('s0', 'This season', '2024-11-11', 1.115), curva('all', 'All time', '1986-01-01', 1.12)] };
const FITNESS = { giorni: Array.from({ length: 60 }, (_, i) => { const d = new Date(2026, 7, 15 + i); return { data: d.toLocaleDateString('sv-SE'), ctl: 40 + i / 10, atl: 45 + (i % 7), carico: 50 + (i % 5) * 10 }; }) };

function pagina({ pref = {} } = {}) {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  const vc = new VirtualConsole(), errori = [], richieste = [];
  vc.on('jsdomError', e => errori.push(e.message));
  let obiettivi = [{ id: 'ob1', nome: 'Gran Fondo Pantani', data: '2027-06-20', priorita: 'B', km: 150, dislivello: 2800, note: '' }];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://192.168.1.38:3000/',
    beforeParse(w) {
      const Vero = w.Date;
      class Finto extends Vero { constructor(...a) { super(...(a.length ? a : [FISSO])); } static now() { return FISSO; } }
      w.Date = Finto;
      w.lucide = { createIcons() {} }; w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (u, o = {}) => {
        const s = String(u), body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: s, metodo: o.method || 'GET', body });
        let r = {};
        if (s.startsWith('/api/dashboard')) r = { profile: { name: 'Magician', ftp: 320, cp: 290, weightKg: 82.25 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 47, atl: 36, tsb: 11 } };
        else if (s === '/api/power-curves') r = CURVE;
        else if (s.startsWith('/api/fitness')) r = FITNESS;
        else if (s === '/api/preferenze') { if (o.method === 'POST') pref = { nome: body.nome }; r = pref; }
        else if (s === '/api/obiettivi' && o.method === 'POST') { const ob = { id: 'ob2', ...body }; obiettivi.push(ob); r = { obiettivo: ob }; }
        else if (s === '/api/obiettivi') r = { obiettivi };
        else if (s.startsWith('/api/obiettivi/')) { obiettivi = obiettivi.filter(x => x.id !== s.split('/').pop()); r = { ok: true }; }
        else if (s.startsWith('/api/calendar')) r = { activities: [], wellness: [] };
        else if (s.startsWith('/api/automation')) r = { installed: false };
        else if (s.startsWith('/api/ftp-tests') || s.startsWith('/api/saved-meals')) r = [];
        const t = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(t) };
      };
    } });
  return { w: dom.window, d: dom.window.document, errori, richieste };
}

test('barra laterale: Oggi, Calendario, Analisi FTP, Fitness, Stagione, Nutrizione, Fondamenti di Body Building, Attrezzatura, Tools; il nome si cambia', async () => {
  const { w, d, errori, richieste } = pagina();
  await tick(200);
  const voci = [...d.querySelectorAll('#mw-sidebar .sidebar-item[data-view]')];
  assert.deepStrictEqual(voci.map(v => v.dataset.view), ['view-today', 'view-calendar', 'view-athlete', 'view-fitness', 'view-programming', 'view-nutrition', 'view-bibbia', 'view-gear', 'view-tools']);
  assert.deepStrictEqual(voci.map(v => v.textContent.trim()), ['Oggi', 'Calendario', 'Analisi FTP', 'Fitness', 'Stagione', 'Nutrizione', 'Fondamenti di Body Building', 'Attrezzatura', 'Tools']);
  assert.ok(!d.querySelector('#view-goals'), 'gli obiettivi stanno in Stagione');
  // il nome: da intervals.icu, finché non lo cambi
  const nome = d.querySelector('#mw-atleta-nome');
  assert.strictEqual(nome.textContent, 'Magician');
  nome.click();
  const campo = d.querySelector('#mw-nome-input');
  assert.ok(campo, 'si modifica sul posto');
  campo.value = 'Tiziano';
  campo.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick(50);
  assert.ok(richieste.some(r => r.url === '/api/preferenze' && r.metodo === 'POST' && r.body.nome === 'Tiziano'));
  assert.strictEqual(d.querySelector('#mw-atleta-nome').textContent, 'Tiziano');
  assert.strictEqual(d.querySelector('#athlete-name').textContent, 'Tiziano');
  assert.deepStrictEqual(errori, []);
});

test('il nome scelto vince su quello di intervals.icu anche alla prossima apertura', async () => {
  const { d, errori } = pagina({ pref: { nome: 'Tiziano' } });
  await tick(200);
  assert.strictEqual(d.querySelector('#mw-atleta-nome').textContent, 'Tiziano');
  assert.deepStrictEqual(errori, []);
});

test('Analisi FTP: power curve (watt e W/kg), best efforts, CP e W\', power profile', async () => {
  const { d, errori } = pagina();
  await tick(200);
  d.querySelector('.sidebar-item[data-view="view-athlete"]').click();
  await tick(100);
  const v = d.querySelector('#view-athlete');
  assert.strictEqual(v.querySelectorAll('#ftp-curva path.pc-linea').length, 4, 'le 4 curve');
  assert.ok(v.querySelectorAll('#ftp-curva .et-x').length >= 8, 'asse dei tempi da 1s alle ore');
  assert.strictEqual(v.querySelector('#ftp-curva .et-unita').textContent, 'W');
  d.querySelector('[data-unita="wkg"]').click();
  assert.strictEqual(v.querySelector('#ftp-curva .et-unita').textContent, 'W/kg');
  const tab = v.querySelector('#ftp-best').textContent.replace(/\s+/g, ' ');
  for (const r of ['1s', '5s', '60s', '3m', '5m', '10m', '12m', '20m', 'MAP', 'TMAP', 'VO2max', 'CS5m']) assert.match(tab, new RegExp(r));
  assert.match(tab, /958/);
  assert.match(tab, /11\.67/);
  assert.match(tab, /6m27s/);
  const leg = v.querySelector('#ftp-legenda').textContent.replace(/\s+/g, ' ');
  assert.match(leg, /42 giorni.*CP 281 W.*W' 25200 J/s);
  const prof = v.querySelector('#ftp-profilo').textContent.replace(/\s+/g, ' ');
  assert.match(prof, /5s.*1m.*5m.*FTP/s);
  assert.match(prof, /Coggan/);
  assert.match(prof, /Completo|Velocista|Puncheur|Passista/);
  assert.deepStrictEqual(errori, []);
});

test('Fitness: periodi rapidi, Fitness/Fatica con il carico, Forma con le fasce, valori a destra, previsione', async () => {
  const { d, errori, richieste } = pagina();
  await tick(200);
  d.querySelector('.sidebar-item[data-view="view-fitness"]').click();
  await tick(150);
  assert.ok(richieste.some(r => r.url.startsWith('/api/fitness?start=')));
  for (const k of ['stagione', 'prossimo', '6m', '1a', '1m', '42g']) assert.ok(d.querySelector(`[data-periodo="${k}"]`), k);
  const g = d.querySelector('#fit-grafico');
  assert.ok(g.querySelector('path.fit-ctl') && g.querySelector('path.fit-atl') && g.querySelectorAll('.fit-carico').length > 10);
  const f = d.querySelector('#forma-grafico');
  assert.strictEqual(f.querySelectorAll('rect.fascia').length, 5, 'transizione, fresco, grigia, ottimale, rischio');
  assert.ok(f.querySelector('path.forma-linea'));
  const val = d.querySelector('#fit-valori').textContent.replace(/\s+/g, ' ');
  assert.match(val, /Fitness \d+.*Fatica \d+.*Forma -?\d+/s);
  assert.match(val, /Transizione|Fresco|Zona grigia|Ottimale|Rischio alto/);
  d.querySelector('[data-periodo="prossimo"]').click();
  await tick(150);
  assert.ok(d.querySelector('#fit-grafico path.fit-previsto'), 'il prossimo mese previsto dal piano, tratteggiato');
  assert.deepStrictEqual(errori, []);
});

test('Stagione: gli obiettivi con «+ Aggiungi obiettivo»', async () => {
  const { d, errori, richieste } = pagina();
  await tick(200);
  d.querySelector('.sidebar-item[data-view="view-programming"]').click();
  await tick(100);
  const box = d.querySelector('#view-programming #dash-events');
  assert.ok(box, 'gli obiettivi dentro Stagione');
  assert.match(box.textContent, /Nove Colli/);
  assert.match(box.textContent, /Gran Fondo Pantani/);
  d.querySelector('#ob-aggiungi').click();
  const form = d.querySelector('#ob-form');
  assert.ok(!form.hidden);
  form.querySelector('[name=nome]').value = 'Maratona dles Dolomites';
  form.querySelector('[name=data]').value = '2027-07-04';
  form.querySelector('[name=priorita]').value = 'A';
  form.dispatchEvent(new d.defaultView.Event('submit', { cancelable: true }));
  await tick(100);
  const post = richieste.find(r => r.url === '/api/obiettivi' && r.metodo === 'POST');
  assert.ok(post && post.body.nome === 'Maratona dles Dolomites' && post.body.priorita === 'A');
  assert.match(d.querySelector('#dash-events').textContent, /Maratona dles Dolomites/);
  d.querySelector('#dash-events [data-ob-elimina="ob1"]').click();
  await tick(100);
  assert.ok(richieste.some(r => r.url === '/api/obiettivi/ob1' && r.metodo === 'DELETE'));
  assert.doesNotMatch(d.querySelector('#dash-events').textContent, /Gran Fondo Pantani/);
  const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
  assert.deepStrictEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
  assert.deepStrictEqual(errori, []);
});

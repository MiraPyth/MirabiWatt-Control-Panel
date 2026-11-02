// MirabiWatt da smartphone (13/10/2026): menu laterale a scomparsa, calendario a una colonna, niente scorrimento orizzontale.
const PR = (nome, kmSoglia, percento, kmUsati) => ({ id: 7, nome, kmSoglia, giorniSoglia: 0, oreSoglia: 0, attivitaSoglia: 0, percento, kmUsati, giorniUsati: 90, dal: '2026-02-05' });
const CO = (id, tipo, nome, km, extra = {}) => ({ id, tipo, nome, km, ore: Math.round(km / 30), attivita: Math.round(km / 60), acquisto: '2026-02-05', ritiro: null, componente: true, componenti: null, virtuale: false, promemoria: [], ...extra });
const GEAR = { aggiornato: '2026-10-14T08:00:00Z', kmRecenti: { b1: 924 }, gear: [
  { ...CO('b1', 'Bike', 'La bici 🚲', 52761), componente: false, componenti: ['c1', 'c2', 'c3', 'c4'] },
  { ...CO('b2', 'Bike', 'Speciale su Zwift Hub', 7722), componente: false, componenti: [], virtuale: true },
  { ...CO('s1', 'Shoes', 'ASICS Nimbus', 227), componente: false },
  CO('c1', 'Chain', 'SRAM chain <x>', 7706, { promemoria: [PR('Check consumo', 7000, 110.1, 7706)] }),
  CO('c2', 'Tyre', 'Continental GP 5000', 7706, { promemoria: [PR('Invertire', 2500, 153.2, 3831)] }),
  CO('c3', 'BrakePads', 'Pastiglie dietro', 706, { promemoria: [PR('Controllo pastiglie', 1500, 47, 706)] }),
  CO('c4', 'Cassette', 'Pacco 10-36', 24377),
  CO('sella', 'Saddle', 'S-Works Power Mirror', 0),
  CO('v1', 'Chain', 'SRAM chain', 7027, { acquisto: '2023-12-24', ritiro: '2024-05-05' }),
  CO('v2', 'Chain', 'SRAM chain', 6037, { acquisto: '2024-05-05', ritiro: '2024-07-04' }),
] };
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 14, 10, 0, 0).getTime();
const PROFILO = { name: 'Magician', ftp: 305, cp: 281, wPrime: 24960, weightKg: 82.25, ftpUpdated: '2026-09-24T07:32:19Z',
  powerZones: [55, 75, 90, 105, 120, 150, 999], powerZoneNames: ['Active Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 Max', 'Anaerobic', 'Neuromuscular'] };
const CURVE = { peso: 82.25, curve: ['42d', '84d', 's0', 'all'].map((id, k) => ({ id, label: id, start: '2026-09-02', end: '2026-10-14', peso: 82.25,
  secs: [1, 5, 60, 180, 300, 600, 720, 1200], watts: [958, 945, 422, 380, 360, 312, 311, 291], wkg: [11.67, 11.51, 5.05, 4.54, 4.3, 3.73, 3.72, 3.48],
  cp: 281 + k, wPrime: 25200, eftp: 287 + k * 10, map: null, vo2max: 54.8, cs5m: 1550 })) };
const FITNESS = { giorni: Array.from({ length: 50 }, (_, i) => { const d = new Date(2026, 7, 25 + i); return { data: d.toLocaleDateString('sv-SE'), ctl: 45 + i / 20, atl: 40 + (i % 9), carico: 40 + (i % 4) * 15 }; }) };

function pagina() {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  const vc = new VirtualConsole(), errori = [], richieste = [];
  vc.on('jsdomError', e => errori.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://192.168.1.38:3000/',
    beforeParse(w) {
      const Vero = w.Date;
      class Finto extends Vero { constructor(...a) { super(...(a.length ? a : [FISSO])); } static now() { return FISSO; } }
      w.Date = Finto;
      w.lucide = { createIcons() {} }; w.matchMedia = q => ({ matches: /max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (u, o = {}) => {
        const s = String(u), body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: s, metodo: o.method || 'GET', body });
        let r = {};
        if (s.startsWith('/api/dashboard')) r = { profile: PROFILO, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 47, atl: 36, tsb: 11 },
          lastActivity: { id: 'i195817930', name: '[MirabiWatt] EnduranceLungo', type: 'Ride', date: '2026-10-10T09:00:00', movingTime: 5340, distance: 38500, load: 77 } };
        else if (s === '/api/power-curves') r = CURVE;
        else if (s.startsWith('/api/fitness')) r = FITNESS;
        else if (s === '/api/preferenze') r = o.method === 'POST' ? body : {};
        else if (s === '/api/obiettivi') r = { obiettivi: [] };
        else if (s.startsWith('/api/calendar')) r = { activities: [], wellness: [{ date: '2026-10-13', ctl: 47, atl: 36, rampRate: -4 }] };
        else if (s === '/api/gear') r = GEAR;
        else if (s.startsWith('/api/automation')) r = { installed: false };
        else if (s.startsWith('/api/ftp-tests') || s.startsWith('/api/saved-meals')) r = [];
        const t = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(t) };
      };
    } });
  return { w: dom.window, d: dom.window.document, errori, richieste };
}
const vai = (d, v) => d.querySelector(`.sidebar-item[data-view="${v}"]`).click();
const testo = el => el.textContent.replace(/\s+/g, ' ');


test('smartphone: il menu si apre dal pulsante in alto e si chiude scegliendo una voce, toccando fuori o con Esc', async () => {
  const { d, w, errori } = pagina();
  await tick(250);
  const side = d.getElementById('mw-sidebar'), apri = d.querySelector('.mw-titolo #mw-apri-menu'), velo = d.getElementById('mw-velo');
  assert.ok(apri && velo, 'pulsante menu nella barra del titolo e velo');
  assert.ok(!side.classList.contains('aperto') && velo.hidden);
  apri.click();
  assert.ok(side.classList.contains('aperto') && !velo.hidden);
  d.querySelector('.sidebar-item[data-view="view-fitness"]').click();
  assert.ok(!side.classList.contains('aperto') && velo.hidden, 'scelta la voce il menu si chiude');
  assert.ok(d.getElementById('view-fitness').classList.contains('active'));
  apri.click(); velo.click();
  assert.ok(!side.classList.contains('aperto'), 'toccando fuori si chiude');
  apri.click(); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.ok(!side.classList.contains('aperto'), 'Esc chiude');
  apri.click(); d.getElementById('mw-toggle').click();
  assert.ok(!side.classList.contains('aperto') && !side.classList.contains('compatto'), 'su telefono il pulsante del menu chiude, non compatta');
  assert.deepStrictEqual(errori, []);
});

test('smartphone: il CSS mobile è caricato per ultimo e copre menu, calendario, barre e tabelle', () => {
  const html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  const fogli = [...html.matchAll(/<link rel="stylesheet" href="([\w.-]+\.css)">/g)].map(m => m[1]);
  // 19/10/2026 notte: dopo mobile.css solo la home da telefono (mobile-home.css), anch'essa per il telefono
  assert.deepStrictEqual(fogli.slice(-2), ['mobile.css', 'mobile-home.css'], fogli.join());
  const css = fs.readFileSync(path.join(DIR, 'mobile.css'), 'utf8');
  const blocco = (css.match(/@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/) || [])[1] || '';
  for (const sel of ['.mw-sidebar', '.mw-sidebar.aperto', '#mw-apri-menu', '.mw-cal-testa', '.mw-riga', '.mw-giorno', 'body.mw-cal-attivo .mw-titolo', '.mw-toolbar', '.mw-main', '.mw-tab'])
    assert.ok(blocco.includes(sel), 'manca ' + sel);
  assert.match(blocco, /\.mw-riga[^{]*\{[^}]*min-width: 0/);
  assert.match(blocco, /\.mw-cal-testa[^{]*\{[^}]*display: none/);
  assert.match(css, /#mw-apri-menu[^{]*\{[^}]*display: none/, 'su desktop il pulsante non si vede');
  assert.match(css, /body \{[^}]*overflow-x: hidden/);
});

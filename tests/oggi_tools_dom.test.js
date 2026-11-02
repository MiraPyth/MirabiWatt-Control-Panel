// Oggi rifatta, Analisi FTP con valori attuali e zone, Tools rifatti nello stile della dashboard (14/10/2026 sera).
// Tutto legato agli stessi valori dell'atleta (FTP, CP, W', peso da intervals.icu). Data finta: mercoledì 14 ottobre 2026.
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
      w.lucide = { createIcons() {} }; w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {};
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

test('Oggi: allenamento del giorno con i watt dalla FTP, forma, settimana, prossimo obiettivo, nutrizione, ultima attività', async () => {
  const { d, errori } = pagina();
  await tick(250);
  vai(d, 'view-today');
  await tick(150);
  const r = d.querySelector('#oggi-root');
  assert.match(testo(r.querySelector('.mw-oggi-testa')), /mercoledì 14 ottobre/i);
  assert.match(testo(r.querySelector('.mw-oggi-testa')), /Settimana 42/);
  assert.match(testo(r.querySelector('.mw-oggi-testa')), /FTP 305 W.*CP 281 W.*W' 24960 J/);
  const a = r.querySelector('#oggi-allenamento');
  assert.match(testo(a), /EnduranceCorto/);
  assert.match(testo(a), /1h45/);
  assert.match(testo(a), /Da fare/);
  assert.ok(a.querySelectorAll('.mw-passi li').length >= 2, 'come farlo, passo per passo');
  assert.match(testo(a.querySelector('.mw-passi')), /\d+(-\d+)?W/, 'i watt calcolati dalla FTP attuale');
  assert.match(testo(a), /Domani/);
  // forma, settimana, obiettivo, nutrizione, ultima attività
  assert.match(testo(r.querySelector('#oggi-forma')), /Fitness \d+.*Fatica \d+.*Forma -?\d+/);
  assert.ok(r.querySelector('#oggi-forma svg'));
  const chip = r.querySelectorAll('#oggi-settimana .mw-chip');
  assert.strictEqual(chip.length, 7);
  assert.ok(chip[2].classList.contains('oggi'));
  assert.match(testo(r.querySelector('#oggi-settimana')), /pianificat/);
  assert.match(testo(r.querySelector('#oggi-obiettivo')), /Tratturo Magno.*giorni/);
  assert.match(testo(r.querySelector('#dash-last-activity')), /EnduranceLungo/);
  // azioni: dettaglio, imprevisto, nutrizione
  a.querySelector('[data-oggi="dettaglio"]').click();
  await tick(50);
  assert.ok(!d.querySelector('#cal-dettaglio').hidden);
  d.querySelector('#cal-dettaglio-chiudi').click();
  a.querySelector('[data-oggi="imprevisto"]').click();
  await tick(50);
  assert.ok(d.querySelector('.mw-riga[data-settimana="2026-10-12"] [data-data="2026-10-14"] .mw-imprevisto.attivo'), 'l\'imprevisto finisce nel calendario');
  assert.match(testo(d.querySelector('#oggi-allenamento')), /imprevisto/i);
  r.querySelector('#oggi-nutrizione [data-oggi="nutrizione"]').click();
  assert.ok(d.querySelector('#view-nutrition').classList.contains('active'));
  assert.deepStrictEqual(errori, []);
});

test('Analisi FTP: i valori attuali (FTP, CP, W\', eFTP) e le zone di potenza in watt', async () => {
  const { d, errori } = pagina();
  await tick(250);
  vai(d, 'view-athlete');
  await tick(150);
  const v = testo(d.querySelector('#ftp-valori'));
  assert.match(v, /FTP 305 W/);
  assert.match(v, /3\.71 W\/kg/);
  assert.match(v, /CP 281 W/);
  assert.match(v, /W' 24960 J/);
  assert.match(v, /eFTP 287 W/);
  assert.match(v, /sotto la FTP impostata/);
  const righe = [...d.querySelectorAll('#ftp-zone tbody tr')].map(testo);
  assert.strictEqual(righe.length, 7);
  assert.match(righe[0], /Z1.*Recupero attivo.*0–168 W/);
  assert.match(righe[3], /Z4.*Soglia.*276–320 W/);
  assert.match(righe[6], /Z7.*Neuromuscolare.*459\+ W/);
  assert.deepStrictEqual(errori, []);
});

test('Tools: tre calcolatrici nello stile della dashboard, con peso, FTP, CP e W\' dell\'atleta', async () => {
  const { w, d, errori } = pagina();
  await tick(250);
  vai(d, 'view-tools');
  const r = d.querySelector('#strumenti-root');
  assert.deepStrictEqual([...r.querySelectorAll('[data-strumento]')].map(b => b.dataset.strumento), ['idratazione', 'predittore', 'salite']);
  assert.ok(!d.querySelector('#toolsGrid, #userModal, #view-kcal, #view-ftp-cp, #view-training, .tool-card'), 'via kcal, FTP e CP, week training e il vecchio pannello');
  const scrivi = (sel, v) => { const el = r.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  // idratazione
  r.querySelector('[data-strumento="idratazione"]').click();
  scrivi('#hyd-volume', '750'); scrivi('#hyd-carbo', '60');
  assert.match(testo(r.querySelector('#hyd-risultato')), /Isotonica.*40 g.*20 g/);
  // predittore: il peso dell'atleta già scritto, la potenza anche in % di FTP
  r.querySelector('[data-strumento="predittore"]').click();
  assert.strictEqual(r.querySelector('#pred-peso').value, '82.25');
  scrivi('#pred-velocita', '28');
  assert.match(testo(r.querySelector('#pred-risultato')), /\d+ W.*W\/kg.*% della FTP/);
  // salite: la potenza parte dalla FTP; quanto la reggi con il W' sopra il CP
  r.querySelector('[data-strumento="salite"]').click();
  assert.strictEqual(r.querySelector('#sal-watt').value, '305');
  scrivi('#sal-km', '10'); scrivi('#sal-dislivello', '800');
  const s = testo(r.querySelector('#sal-risultato'));
  assert.match(s, /pendenza media 8%/i);
  assert.match(s, /VAM \d+/);
  assert.match(s, /sopra il CP/);
  assert.strictEqual(r.querySelectorAll('#sal-livelli tbody tr').length, 6);
  scrivi('#sal-watt', '270');
  assert.match(testo(r.querySelector('#sal-risultato')), /sotto il CP/);
  const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
  assert.deepStrictEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
  assert.deepStrictEqual(errori, []);
});

test('Oggi: nutrizione con solo kcal e macro del giorno (i pasti restano nella pagina Nutrizione)', async () => {
  const { w, d, errori } = pagina();
  await tick(250);
  vai(d, 'view-today');
  await tick(100);
  const c = d.getElementById('oggi-nutrizione');
  const tipo = c.querySelector('[data-oggi="nutrizione"]').dataset.tipo;
  const piano = w.pianoNutrizione(tipo, 82.25);
  const kpi = testo(c.querySelector('.mw-nut-kpi'));
  assert.match(kpi, new RegExp(`${piano.target.kcal} kcal`));
  assert.match(kpi, new RegExp(`Proteine ${piano.target.p} g.*Carboidrati ${piano.target.c} g.*Grassi ${piano.target.fat} g`));
  assert.strictEqual(c.querySelectorAll('.mw-nut-pasto').length, 0, 'niente elenco dei pasti');
  assert.doesNotMatch(testo(c), new RegExp(piano.pasti[0].nome));
  c.querySelector('[data-oggi="nutrizione"]').click();
  assert.ok(d.getElementById('view-nutrition').classList.contains('active'));
  assert.deepStrictEqual(errori, []);
});

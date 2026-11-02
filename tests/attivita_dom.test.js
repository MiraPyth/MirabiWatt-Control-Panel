// Attività nel calendario come intervals.icu (13/10/2026): schede con i campi scelti, dettaglio, abbinamento al pianificato
// trascinando la sessione (o con il pulsante nel dettaglio, da telefono), kcal consumate in Oggi. Data finta: mercoledì 14/10/2026.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 14, 10, 0, 0).getTime();

const G = (id, date, start, extra = {}) => ({ id, date, start, name: '', type: 'Ride', indoor: false, tss: 77, durationMin: 89, distanceKm: 38.47, hr: 136, watt: 182, np: 220,
  intensita: 72, kj: 981, kcal: 1116, compliance: 33, zone: [1827, 1591, 1063, 600, 300, 100, 30], abbinata: false, ...extra });
const S = (id, start, extra = {}) => ({ id, date: '2026-10-13', start, name: '', type: '', strava: true, tss: null, durationMin: null, distanceKm: null, abbinata: false, ...extra });
const ATTIVITA = [G('i10', '2026-10-10', '15:33', { name: '[MirabiWatt] EnduranceLungo', abbinata: true }),
  S('s1', '18:15'), S('s2', '18:56'), S('s3', '19:06', { abbinata: true }), S('s4', '19:49'),
  G('g14', '2026-10-14', '07:10', { name: 'Zwift - Pacer Group Ride <x>', type: 'VirtualRide', indoor: true, kcal: 500, durationMin: 42, distanceKm: 30.03, compliance: null })];
const EVENTI = [{ id: 555, date: '2026-10-13', name: '[MirabiWatt] Zwift Race', attivitaAbbinata: 's3' }, { id: 777, date: '2026-10-14', name: '[MirabiWatt] EnduranceCorto', attivitaAbbinata: null }];
const FORMA = [{ date: '2026-10-04', ctl: 40, atl: 50, rampRate: 1 }, { date: '2026-10-11', ctl: 44.6, atl: 43.2, rampRate: 3 }, { date: '2026-10-13', ctl: 45, atl: 48, rampRate: 2 }];

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
      w.lucide = { createIcons() {} }; w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
      w.confirm = () => true; w.alert = () => {};
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (url, o = {}) => {
        const body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: String(url), metodo: o.method || 'GET', body });
        const u = String(url);
        let r = {};
        if (u.startsWith('/api/dashboard')) r = { profile: { name: 'Tiziano', ftp: 320, cp: 290, weightKg: 72 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 45, atl: 48, tsb: -3 }, lastActivity: null, nextWorkout: null };
        else if (u.startsWith('/api/calendar')) r = { activities: ATTIVITA, wellness: FORMA, eventi: EVENTI };
        else if (u === '/api/preferenze') r = o.method === 'POST' ? body : {};
        else if (u === '/api/abbina') { if (String(body.activityId).startsWith('s')) return { ok: false, status: 422, json: async () => ({ error: 'Attività arrivata da Strava: intervals.icu non permette di modificarla via API.' }) }; r = { ok: true, activityId: body.activityId, eventId: body.eventId }; }
        else if (u.startsWith('/api/week-actual')) r = { activities: ATTIVITA };
        else if (u.startsWith('/api/replan-ai')) r = { days: body.days.map(d => ({ ...d, s: 'Riposo', zone: 'Rec', dur: '' })), rationale: 'Settimana di scarico per la cena di lavoro.' };
        else if (u.startsWith('/api/push-week')) r = { results: body.days.map((d, i) => ({ day: d.d, date: '2026-10-1' + i, name: d.s, ok: true, structured: true })) };
        else if (u.startsWith('/api/automation/status')) r = { installed: false, recentLog: '' };
        else if (u.startsWith('/api/ftp-tests') || u.startsWith('/api/saved-meals')) r = [];
        const testo = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(testo) };
      };
    } });
  return { w: dom.window, d: dom.window.document, errori, richieste };
}
const cella = (d, data) => d.querySelector(`.mw-giorno[data-data="${data}"]`);
const testo = el => el.textContent.replace(/\s+/g, ' ').trim();

test('schede: durata e distanza in testa, FC, watt, load, orario, kJ, zone, aderenza, nome vero', async () => {
  const { d, errori } = pagina();
  await tick(250);
  const g = cella(d, '2026-10-10').querySelector('.mw-attivita');
  assert.match(testo(g.querySelector('.mw-a-testa')), /1h29m.*38\.47 km/);
  assert.match(testo(g), /136 bpm · 182 W.*Load 77 · 72% · 15:33.*981 kJ/);
  assert.doesNotMatch(testo(g), /NP 220|1116 kcal/, 'NP e kcal non sono tra i campi predefiniti');
  assert.strictEqual(g.querySelectorAll('.mw-a-zone i').length, 7);
  assert.match(testo(g.querySelector('.mw-a-ok')), /33%/);
  assert.match(testo(g.querySelector('.mw-a-nome')), /^EnduranceLungo$/);
  assert.ok(g.classList.contains('abbinata'));
  const z = cella(d, '2026-10-14').querySelector('.mw-attivita');
  assert.match(testo(z.querySelector('.mw-a-nome')), /Zwift - Pacer Group Ride <x>/);
  assert.ok(!z.innerHTML.includes('<x>'));
  assert.deepStrictEqual(errori, []);
});

test('attività da Strava: niente «Attività (Strava)», l\'orario e il perché mancano i dati; la gara abbinata su intervals.icu conta come fatta', async () => {
  const { d, errori } = pagina();
  await tick(250);
  const c = cella(d, '2026-10-13'), schede = [...c.querySelectorAll('.mw-attivita')];
  assert.strictEqual(schede.length, 4);
  assert.ok(!/Attività \(Strava\)/.test(testo(c)));
  assert.match(testo(schede[0]), /Attività delle 18:15/);
  assert.ok(schede.every(s => s.classList.contains('stub')));
  assert.ok(schede[2].classList.contains('abbinata'));
  assert.match(testo(c.querySelector('.mw-sessione')), /✓ fatto/);
  assert.deepStrictEqual(errori, []);
});

test('trascino il pianificato sull\'attività: abbinata su intervals.icu e ricarico', async () => {
  const { w, d, errori, richieste } = pagina();
  await tick(250);
  const c = cella(d, '2026-10-14'), ses = c.querySelector('.mw-sessione'), att = c.querySelector('.mw-attivita');
  assert.strictEqual(ses.getAttribute('draggable'), 'true');
  const dt = { dati: {}, setData(k, v) { this.dati[k] = v; }, getData(k) { return this.dati[k]; }, effectAllowed: '', dropEffect: '' };
  const ev = (tipo, el) => { const e = new w.Event(tipo, { bubbles: true, cancelable: true }); e.dataTransfer = dt; el.dispatchEvent(e); return e; };
  ev('dragstart', ses);
  assert.ok(ev('dragover', att).defaultPrevented, 'l\'attività accetta il rilascio');
  const prima = richieste.filter(r => r.url.startsWith('/api/calendar')).length;
  ev('drop', att);
  await tick(80);
  assert.deepStrictEqual(richieste.find(r => r.url === '/api/abbina').body, { activityId: 'g14', eventId: 777 });
  assert.ok(richieste.filter(r => r.url.startsWith('/api/calendar')).length > prima, 'ricarica il calendario');
  assert.match(d.getElementById('mw-toast').textContent, /Abbinata/);
  // un'attività da Strava: intervals.icu rifiuta, lo dico chiaro
  ev('dragstart', cella(d, '2026-10-13').querySelector('.mw-sessione'));
  ev('drop', cella(d, '2026-10-13').querySelector('.mw-attivita'));
  await tick(80);
  assert.match(d.getElementById('mw-toast').textContent, /Strava/);
  // giorno diverso: non si abbina
  const n = richieste.filter(r => r.url === '/api/abbina').length;
  ev('dragstart', ses); ev('drop', cella(d, '2026-10-10').querySelector('.mw-attivita'));
  await tick(50);
  assert.strictEqual(richieste.filter(r => r.url === '/api/abbina').length, n);
  assert.match(d.getElementById('mw-toast').textContent, /stesso giorno/);
  assert.deepStrictEqual(errori, []);
});

test('tocco un\'attività: dettaglio con tutti i dati, zone, link a intervals.icu e «Abbina» (da telefono)', async () => {
  const { d, errori, richieste } = pagina();
  await tick(250);
  cella(d, '2026-10-14').querySelector('.mw-attivita').click();
  const m = d.getElementById('cal-attivita');
  assert.ok(!m.hidden);
  assert.match(testo(m), /Zwift - Pacer Group Ride.*42m.*30\.03 km.*136 bpm.*NP 220 W.*500 kcal/);
  assert.strictEqual(m.querySelectorAll('.mw-att-zona').length, 7);
  assert.ok(m.querySelector('a[href="https://intervals.icu/activities/g14"]'));
  const b = m.querySelector('[data-abbina]');
  assert.match(testo(b), /EnduranceCorto/);
  b.click();
  await tick(80);
  assert.deepStrictEqual(richieste.find(r => r.url === '/api/abbina').body, { activityId: 'g14', eventId: 777 });
  assert.ok(m.hidden);
  // da Strava: spiega e niente pulsante
  cella(d, '2026-10-13').querySelector('.mw-attivita').click();
  assert.match(testo(m), /Strava.*Zwift/);
  assert.ok(!m.querySelector('[data-abbina]'));
  assert.deepStrictEqual(errori, []);
});

test('campi della scheda a scelta dalla barra in alto, salvati', async () => {
  const { d, errori, richieste } = pagina();
  await tick(250);
  d.getElementById('cal-campi').click();
  const menu = d.getElementById('cal-campi-menu');
  assert.ok(!menu.hidden);
  assert.strictEqual(menu.querySelectorAll('input[data-campo]').length, 12);
  const kcal = menu.querySelector('input[data-campo="kcal"]'), fc = menu.querySelector('input[data-campo="fc"]');
  kcal.checked = true; kcal.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
  fc.checked = false; fc.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
  await tick(30);
  const g = cella(d, '2026-10-10').querySelector('.mw-attivita');
  assert.match(testo(g), /1116 kcal/);
  assert.doesNotMatch(testo(g), /136 bpm/);
  const salvata = richieste.filter(r => r.url === '/api/preferenze' && r.metodo === 'POST').pop();
  assert.ok(salvata.body.campiAttivita.includes('kcal') && !salvata.body.campiAttivita.includes('fc'));
  assert.deepStrictEqual(errori, []);
});

test('Oggi: kcal consumate con le attività del giorno, come riferimento', async () => {
  const { d, errori } = pagina();
  await tick(250);
  d.querySelector('.sidebar-item[data-view="view-today"]').click();
  await tick(50);
  assert.match(testo(d.querySelector('#oggi-nutrizione .mw-nut-consumate')), /Consumate con le attività 500 kcal/);
  assert.deepStrictEqual(errori, []);
});

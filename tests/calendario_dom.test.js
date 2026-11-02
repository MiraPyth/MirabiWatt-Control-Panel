// La dashboard come intervals.icu (14/10/2026): barra laterale comprimibile, barra strumenti con il mese e le azioni
// rapide, calendario a righe settimanali con il riepilogo a sinistra, pannello «Ripianifica settimana» (livello, IA,
// salva, invia a intervals), dettaglio dell'allenamento. Data finta: mercoledì 14 ottobre 2026.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 14, 10, 0, 0).getTime();

const ATTIVITA = [{ id: 'i1', date: '2026-10-07', name: '[MirabiWatt] EnduranceCorto', type: 'Ride', tss: 56, durationMin: 97 },
  { id: 'i2', date: '2026-10-10', name: '[MirabiWatt] EnduranceLungo', type: 'Ride', tss: 77, durationMin: 89 }];
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
      w.lucide = { createIcons() {} };
      w.confirm = () => true; w.alert = () => {};
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (url, o = {}) => {
        const body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: String(url), metodo: o.method || 'GET', body });
        const u = String(url);
        let r = {};
        if (u.startsWith('/api/dashboard')) r = { profile: { name: 'Tiziano', ftp: 320, cp: 290, weightKg: 72 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 45, atl: 48, tsb: -3 }, lastActivity: null, nextWorkout: null };
        else if (u.startsWith('/api/calendar')) r = { activities: ATTIVITA, wellness: FORMA };
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
const riga = (d, ws) => d.querySelector(`.mw-riga[data-settimana="${ws}"]`);

test('si apre sul calendario: barra laterale comprimibile, mese, azioni rapide, settimane dalla più recente', async () => {
  const { w, d, errori } = pagina();
  await tick(200);
  assert.ok(d.querySelector('#view-calendar').classList.contains('active'), 'il calendario è la vista di partenza');
  // barra laterale: si comprime e si ricorda
  const side = d.querySelector('#mw-sidebar');
  assert.ok(!side.classList.contains('compatto'));
  d.querySelector('#mw-toggle').click();
  assert.ok(side.classList.contains('compatto'));
  assert.strictEqual(w.localStorage.getItem('mirabiwatt_sidebar'), 'compatto');
  d.querySelector('#mw-toggle').click();
  assert.ok(!side.classList.contains('compatto'));
  // barra strumenti
  assert.match(d.querySelector('#cal-mese').textContent, /ott(obre)? 2026/i);
  for (const id of ['cal-ripianifica', 'cal-ia', 'cal-salva', 'cal-invia', 'cal-aggiorna', 'cal-prec', 'cal-succ', 'cal-oggi']) assert.ok(d.getElementById(id), id);
  // le settimane di ottobre, dalla più recente; quella di oggi selezionata
  assert.deepStrictEqual([...d.querySelectorAll('.mw-riga')].map(r => r.dataset.settimana), ['2026-10-26', '2026-10-19', '2026-10-12', '2026-10-05', '2026-09-28']);
  assert.ok(riga(d, '2026-10-12').classList.contains('corrente') && riga(d, '2026-10-12').classList.contains('sel'));
  assert.match(riga(d, '2026-10-12').querySelector('.mw-sett').textContent, /Settimana 42/);
  // riepilogo come intervals: Totale, Load, Fitness, Fatica, Forma, Ramp (dati veri nella settimana passata)
  const s = riga(d, '2026-10-05').querySelector('.mw-sett').textContent.replace(/\s+/g, ' ');
  assert.match(s, /Totale 3h06/);
  assert.match(s, /Load 133/);
  assert.match(s, /Fitness 44\.6/);
  assert.match(s, /Fatica 43\.2/);
  assert.match(s, /Forma 1\.4/);
  assert.match(s, /Ramp 4\.6/);
  // il giorno con l'attività vera
  const mer = riga(d, '2026-10-05').querySelector('[data-data="2026-10-07"]');
  assert.match(mer.textContent, /EnduranceCorto/);
  assert.match(mer.textContent.replace(/\s+/g, ' '), /1h37m.*Load 56/); // 13/10: scheda come intervals.icu
  assert.ok(mer.querySelector('.mw-sessione.fatto, .mw-sessione.diverso'), 'stato dal confronto con intervals.icu');
  assert.ok(d.querySelector('.mw-giorno.oggi[data-data="2026-10-14"]'));
  // niente più la vecchia griglia settimanale, niente id doppi
  assert.ok(!d.querySelector('#dash-week-detail'));
  const ids = [...d.querySelectorAll('[id]')].map(e => e.id), doppi = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepStrictEqual(doppi, []);
  assert.deepStrictEqual(errori, []);
});

test('seleziono una settimana futura, la riduco, la salvo: resta nel calendario', async () => {
  const { w, d, errori } = pagina();
  await tick(200);
  riga(d, '2026-10-19').querySelector('.mw-sett').click();
  assert.ok(riga(d, '2026-10-19').classList.contains('sel'));
  const pan = d.querySelector('#cal-pannello');
  assert.ok(!pan.hidden, 'il pannello Ripianifica settimana');
  assert.match(d.querySelector('#dash-week-label').textContent, /19 ott/);
  const prima = riga(d, '2026-10-19').querySelectorAll('.mw-sessione.riposo').length;
  d.querySelector('#btn-ridotta').click();
  assert.ok(riga(d, '2026-10-19').querySelectorAll('.mw-sessione.riposo').length > prima, 'il piano ridotto nel calendario');
  d.querySelector('#cal-salva').click();
  const salvati = JSON.parse(w.localStorage.getItem('mirabiwatt_replan_overrides'));
  assert.strictEqual(salvati['2026-10-19'].planLevel, 'ridotta');
  assert.match(riga(d, '2026-10-19').querySelector('.mw-sett').textContent, /ripianificata/i);
  // passando a un'altra settimana la ridotta resta lì
  riga(d, '2026-10-12').querySelector('.mw-sett').click();
  assert.ok(riga(d, '2026-10-19').querySelectorAll('.mw-sessione.riposo').length > prima);
  assert.deepStrictEqual(errori, []);
});

test('ripianifica con IA dalla barra in alto, poi invia a intervals', async () => {
  const { d, errori, richieste } = pagina();
  await tick(200);
  riga(d, '2026-10-19').querySelector('.mw-sett').click();
  d.querySelector('#cal-ia').click();
  assert.ok(!d.querySelector('#cal-pannello').hidden);
  assert.strictEqual(d.activeElement, d.querySelector('#imprevisto-text'), 'pronto a scrivere l\'imprevisto');
  d.querySelector('#imprevisto-text').value = 'Martedì cena di lavoro';
  d.querySelector('#btn-replan-ai').click();
  await tick(100);
  const ia = richieste.find(r => r.url === '/api/replan-ai');
  assert.ok(ia && ia.body.days.length === 7 && /cena/.test(ia.body.reason));
  assert.match(d.querySelector('#dash-ai-rationale').textContent, /scarico/);
  assert.strictEqual(riga(d, '2026-10-19').querySelectorAll('.mw-sessione.riposo').length, 7, 'la proposta dell\'IA nel calendario');
  d.querySelector('#cal-invia').click();
  await tick(100);
  const push = richieste.find(r => r.url === '/api/push-week');
  assert.ok(push && push.body.weekStart === '2026-10-19' && push.body.days.length === 7);
  assert.match(d.querySelector('#dash-push-results').textContent, /inviato/);
  assert.deepStrictEqual(errori, []);
});

test('imprevisto su un giorno, dettaglio dell\'allenamento, menu della settimana, cambio mese', async () => {
  const { d, errori, richieste } = pagina();
  await tick(200);
  // imprevisto su un giorno di un'altra settimana: la seleziona e ricalibra
  const b = riga(d, '2026-10-26').querySelector('.mw-imprevisto');
  assert.ok(b, 'il pulsante imprevisto sui giorni futuri');
  b.click();
  assert.ok(riga(d, '2026-10-26').classList.contains('sel'));
  assert.ok(riga(d, '2026-10-26').querySelector('.mw-imprevisto.attivo'));
  // il dettaglio dell'allenamento in un pannello
  riga(d, '2026-10-19').querySelector('.mw-sessione:not(.riposo)').click();
  await tick(50);
  const det = d.querySelector('#cal-dettaglio');
  assert.ok(!det.hidden && det.textContent.trim().length > 20, 'il dettaglio');
  d.querySelector('#cal-dettaglio-chiudi').click();
  assert.ok(det.hidden);
  // il menu ⋯ della settimana
  riga(d, '2026-10-19').querySelector('.mw-menu').click();
  const menu = d.querySelector('.mw-popover');
  assert.ok(menu && !menu.hidden);
  assert.match(menu.textContent, /Ripianifica.*Ripianifica con IA.*Salva.*Invia a intervals.*Ripristina/s);
  // cambio mese
  d.querySelector('#cal-succ').click();
  await tick(100);
  assert.match(d.querySelector('#cal-mese').textContent, /nov(embre)? 2026/i);
  assert.strictEqual(d.querySelectorAll('.mw-riga').length, 6, 'dal 26 ottobre al 30 novembre');
  assert.ok(richieste.some(r => r.url.startsWith('/api/calendar?start=2026-10-19&end=2026-12-06')), richieste.map(r => r.url).join(' '));
  d.querySelector('#cal-oggi').click();
  assert.match(d.querySelector('#cal-mese').textContent, /ott(obre)? 2026/i);
  // le altre viste ci sono ancora
  d.querySelector('.sidebar-item[data-view="view-today"]').click();
  assert.ok(d.querySelector('#view-today').classList.contains('active'));
  assert.deepStrictEqual(errori, []);
});

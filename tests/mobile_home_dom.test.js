// 19/10/2026 notte: MirabiWatt da telefono con la home del mock di Tiziano: testata calda con saluto, carico della settimana
// come numero grande con barra e % del piano, tre valori (fitness, fatica, forma), la settimana come lista con i
// pallini fatto/da fare e la pillola sul giorno di oggi, barra in basso con le sezioni. Data finta: lunedì 26 ottobre
// 2026, primo giorno di palestra del piano mixed (Petto-Spalle).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 26, 8, 30, 0).getTime();
const MIX = JSON.parse(fs.readFileSync(path.join(DIR, 'piani', 'mixed-body-building.json'), 'utf8'));
const finestre = [];
test.after(() => finestre.forEach(w => w.close()));

function pagina(telefono = true) {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  html = html.replace('<script src="/piano-attivo.js"></script>', `<script>usaPiano(${JSON.stringify(MIX)})</script>`);
  const vc = new VirtualConsole(), errori = [];
  vc.on('jsdomError', e => errori.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://192.168.1.38:3000/',
    beforeParse(w) {
      const Vero = w.Date;
      class Finto extends Vero { constructor(...a) { super(...(a.length ? a : [FISSO])); } static now() { return FISSO; } }
      w.Date = Finto;
      w.matchMedia = q => ({ matches: telefono && /max-width:\s*760px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.localStorage.setItem('mirabiwatt_atleta_nome', 'Tiziano');
      w.lucide = { createIcons() {} };
      w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async url => {
        const u = String(url);
        let r = {};
        if (u.startsWith('/api/fitness')) r = { giorni: [{ data: '2026-10-25', ctl: 59.2, atl: 71.8 }] };
        else if (u.startsWith('/api/palestra/storico')) r = { sessioni: [], ultimi: {} };
        else if (u.startsWith('/api/strava/stato')) r = { configurato: true, collegato: false, auto: true };
        else if (u.startsWith('/api/piani')) r = { attivo: MIX.id, piani: [] };
        else if (u.startsWith('/api/dashboard')) r = { profile: { name: 'Tiziano', ftp: 305, cp: 281, weightKg: 81 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 59, atl: 72, tsb: -13 }, lastActivity: null, nextWorkout: null };
        else if (u.startsWith('/api/calendar')) r = { activities: [], wellness: [] };
        else if (u.startsWith('/api/obiettivi')) r = { obiettivi: [] };
        else if (u.startsWith('/api/ftp-tests') || u.startsWith('/api/saved-meals')) r = [];
        const testo = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(testo) };
      };
    } });
  finestre.push(dom.window);
  return { w: dom.window, d: dom.window.document, errori };
}

test('telefono: si apre su Oggi con la testata calda, saluto e carico della settimana', async () => {
  const { d, errori } = pagina();
  await tick(200);
  assert.ok(d.getElementById('view-today').classList.contains('active'), 'da telefono la home è Oggi');
  const hero = d.querySelector('#mh-root .mh-hero');
  assert.ok(hero, 'testata');
  assert.match(hero.querySelector('.mh-saluto').textContent, /^Buongiorno, Tiziano$/);
  assert.match(hero.querySelector('.mh-avatar').textContent.trim(), /^T$/);
  assert.match(hero.querySelector('.mh-etichetta').textContent, /Carico della settimana/);
  assert.match(hero.querySelector('.mh-numero').textContent, /^\d+$/);
  assert.match(hero.querySelector('.mh-su').textContent, /\/ \d+ TSS/);
  assert.match(hero.querySelector('.mh-pillola').textContent, /\d+% del piano/);
  assert.ok(hero.querySelector('.mh-barra i'), 'barra di avanzamento');
  assert.deepStrictEqual(errori, []);
});

test('telefono: fitness, fatica e forma nelle tre schede, da intervals.icu', async () => {
  const { d } = pagina();
  await tick(250);
  const valori = [...d.querySelectorAll('#mh-root .mh-stat')].map(s => s.textContent.replace(/\s+/g, ' ').trim());
  assert.strictEqual(valori.length, 3);
  assert.match(valori[0], /59.*Fitness/);
  assert.match(valori[1], /72.*Fatica/);
  assert.match(valori[2], /-13.*Forma/);
});

test('telefono: la settimana come lista, oggi la palestra con «Inizia», tocco = dettaglio', async () => {
  const { w, d } = pagina();
  await tick(200);
  const righe = d.querySelectorAll('#mh-root .mh-giorno');
  assert.strictEqual(righe.length, 7);
  const oggi = d.querySelector('#mh-root .mh-giorno.oggi');
  assert.match(oggi.textContent, /Elastici Spinta/);  // 25/10/2026: settimana fuori casa, la scheda guidata vale anche con gli elastici
  const inizia = oggi.querySelector('[data-palestra-inizia]');
  assert.ok(inizia, 'pillola Inizia sulla seduta di palestra di oggi');
  assert.match(inizia.textContent, /Inizia/);
  let aperto = null;
  w.showWorkoutDetail = s => { aperto = s; };
  righe[1].querySelector('.mh-apri').click();
  assert.match(aperto, /Uscita a pranzo/, 'martedì: il dettaglio della seduta');
});

test('telefono: barra in basso con le sezioni, la pillola segue la vista', async () => {
  const { d } = pagina();
  await tick(200);
  const tab = d.querySelector('.mh-tab');
  assert.ok(tab);
  const bottoni = [...tab.querySelectorAll('button')];
  assert.deepStrictEqual(bottoni.map(b => b.dataset.mhVai), ['view-today', 'view-calendar', 'view-nutrition', 'view-fitness', 'menu']);
  assert.ok(bottoni[0].classList.contains('attivo'));
  bottoni[1].click();
  assert.ok(d.getElementById('view-calendar').classList.contains('active'));
  assert.ok(bottoni[1].classList.contains('attivo') && !bottoni[0].classList.contains('attivo'));
  assert.match(bottoni[1].textContent, /Calendario/);
});

test('computer: nessuna home da telefono, si apre sul calendario come prima', async () => {
  const { d } = pagina(false);
  await tick(200);
  assert.ok(d.getElementById('view-calendar').classList.contains('active'));
  assert.ok(d.querySelector('.mh-tab button.attivo[data-mh-vai="view-calendar"]'), 'la barra (nascosta) segue comunque la vista');
  const css = fs.readFileSync(path.join(DIR, 'mobile-home.css'), 'utf8');
  assert.match(css.split('@media')[0], /\.mh, \.mh-tab \{ display: none; \}/, 'fuori dal telefono testata e barra non si vedono');
});

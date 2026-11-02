// 19/10/2026: «INIZIA ALLENAMENTO» dal dettaglio di una seduta di palestra. Esercizio per esercizio: GIF, serie con
// kg e ripetizioni precompilati dallo storico, recupero a tempo, bozza che sopravvive a una ricarica, salvataggio
// sull'OptiPlex. Data finta: lunedì 19 ottobre 2026, piano mixed body building.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 19, 18, 0, 0).getTime();
const MIX = JSON.parse(fs.readFileSync(path.join(DIR, 'piani', 'mixed-body-building.json'), 'utf8'));
const finestre = [];
test.after(() => finestre.forEach(w => w.close())); // i timer dell'app terrebbero vivo il processo
const ULTIMI = { 'spinte-inclinata-manubri': { data: '2026-10-12', serie: [{ kg: 14, reps: 10 }, { kg: 14, reps: 10 }] } };

function pagina(bozza, strava = { ok: true, id: 55, url: 'https://www.strava.com/activities/55' }, statoStrava = { collegato: true, auto: true }) {
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
      if (bozza) w.localStorage.setItem('mirabiwatt_palestra_bozza', JSON.stringify(bozza));
      w.lucide = { createIcons() {} };
      w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (url, o = {}) => {
        const u = String(url), body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: u, metodo: o.method || 'GET', body });
        let r = {};
        if (u.startsWith('/api/palestra/storico')) r = { sessioni: [], ultimi: ULTIMI };
        else if (u.startsWith('/api/palestra/sessioni')) r = { ok: true, id: body.id, strava };
        else if (u.startsWith('/api/strava/stato')) r = statoStrava;
        else if (u.startsWith('/api/strava/verifica')) r = statoStrava.collegato ? { ok: true, atleta: 'Tiziano S.', scope: 'read,activity:write' } : { ok: false, collegato: false };
        else if (u.startsWith('/api/strava/auto')) r = { auto: body.auto };
        else if (u.startsWith('/api/strava/condividi')) r = { ok: true, id: 77, url: 'https://www.strava.com/activities/77' };
        else if (u.startsWith('/api/piani')) r = { attivo: MIX.id, piani: [] };
        else if (u.startsWith('/api/dashboard')) r = { profile: { name: 'Tiziano', ftp: 305, cp: 281, weightKg: 81 }, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 50, atl: 52, tsb: -2 }, lastActivity: null, nextWorkout: null };
        else if (u.startsWith('/api/calendar')) r = { activities: [], wellness: [] };
        else if (u.startsWith('/api/obiettivi')) r = { obiettivi: [] };
        else if (u.startsWith('/api/ftp-tests') || u.startsWith('/api/saved-meals')) r = [];
        const testo = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(testo) };
      };
    } });
  finestre.push(dom.window);
  return { w: dom.window, d: dom.window.document, errori, richieste };
}

test('dal dettaglio: INIZIA ALLENAMENTO, esercizio per esercizio, timer, salva', async () => {
  const { w, d, errori, richieste } = pagina();
  await tick(150);
  w.showWorkoutDetail('Petto-Spalle (adattamento 1)');
  const inizia = d.querySelector('#dash-workout-detail [data-palestra-inizia]');
  assert.ok(inizia, 'pulsante nel dettaglio');
  assert.match(inizia.textContent, /INIZIA ALLENAMENTO/);
  assert.ok(!d.querySelector('#dash-workout-detail').textContent.includes('FTP'), 'niente watt in una seduta di pesi');
  assert.match(d.querySelector('#dash-workout-detail').textContent, /Perché/, 'il dettaglio spiega perché');
  inizia.click();
  await tick(80);
  const app = d.getElementById('mw-palestra');
  assert.ok(app && !app.hidden, 'l\'app a schermo intero');
  assert.match(app.textContent, /Riscaldamento/);
  assert.match(app.textContent, /Spinta: petto/, 'lo scopo della seduta');
  assert.match(app.textContent, /Come scegliere il carico/, 'guida per la prima volta (qualche esercizio senza storico)');
  d.getElementById('pal-avanti').click();

  // primo esercizio: GIF locale, ultima volta, carico proposto (14×10 su tutte → 16 kg), perché
  assert.strictEqual(app.querySelector('.pal-nome').textContent, 'Spinte su panca inclinata 30° con manubri');
  assert.strictEqual(app.querySelector('.pal-gif').getAttribute('src'), '/palestra-gif/B3Rxp6L.gif');
  assert.match(app.querySelector('.pal-ultima').textContent, /14 kg/);
  assert.match(app.querySelector('.pal-obiettivo').textContent, /2×6-10/);
  assert.match(app.querySelector('.pal-perche').textContent, /petto alto/);
  const kg = app.querySelector('[data-pal-kg="0"]');
  assert.strictEqual(kg.value, '16');
  app.querySelector('[data-pal-piu-kg="0"]').click();
  assert.strictEqual(app.querySelector('[data-pal-kg="0"]').value, '18', '+ manubri: 2 kg');
  app.querySelector('[data-pal-meno-kg="0"]').click();

  // guida passo passo: prima gli avvicinamenti (calcolati dal carico vero), poi le serie vere
  assert.match(app.querySelector('.pal-ora').textContent, /Avvicinamento 1 di 2: 8 kg × 10/);
  assert.ok(app.querySelector('[data-pal-avv="0"]') && app.querySelector('[data-pal-avv="1"]'), 'righe di avvicinamento');
  assert.match(app.querySelector('[data-pal-avv="1"]').textContent, /12 kg × 5/);
  app.querySelector('[data-pal-avv-fatta="0"]').click();
  assert.match(d.getElementById('pal-timer').textContent, /1:00/, 'recupero breve dopo un avvicinamento');
  assert.match(app.querySelector('.pal-ora').textContent, /Avvicinamento 2 di 2/);
  app.querySelector('[data-pal-avv-fatta="1"]').click();
  assert.match(app.querySelector('.pal-ora').textContent, /Serie 1 di 2 \(vera\): 16 kg × 6-10/);
  assert.ok(app.querySelector('[data-pal-serie="0"]').classList.contains('prossima'), 'la riga da fare è evidenziata');
  d.getElementById('pal-timer-salta').click();

  // serie fatta → recupero 90"
  app.querySelector('[data-pal-fatta="0"]').click();
  assert.ok(app.querySelector('[data-pal-serie="0"]').classList.contains('fatta'));
  const timer = d.getElementById('pal-timer');
  assert.ok(!timer.hidden, 'parte il recupero');
  assert.match(timer.textContent, /2:30/, 'multiarticolare: 2\'30"');
  d.getElementById('pal-timer-salta').click();
  assert.ok(timer.hidden);
  const bozza = JSON.parse(w.localStorage.getItem('mirabiwatt_palestra_bozza'));
  assert.deepStrictEqual(bozza.esercizi[0].serie[0], { kg: 16, reps: 10, fatta: true });

  // fino alla fine, poi salva
  for (let i = 0; i < 10 && !d.getElementById('pal-salva'); i++) d.getElementById('pal-avanti').click();
  assert.match(app.textContent, /1 serie/);
  d.getElementById('pal-note').value = 'tutto ok';
  d.getElementById('pal-salva').click();
  await tick(80);
  const post = richieste.find(r => r.url === '/api/palestra/sessioni' && r.metodo === 'POST');
  assert.ok(post, 'salvata sull\'OptiPlex');
  assert.strictEqual(post.body.seduta, 'Petto-Spalle');
  assert.strictEqual(post.body.note, 'tutto ok');
  assert.ok(post.body.fine);
  assert.strictEqual(w.localStorage.getItem('mirabiwatt_palestra_bozza'), null, 'bozza tolta dopo il salvataggio');
  assert.match(app.textContent, /Salvato/);
  const suStrava = app.querySelector('a.pal-strava');
  assert.ok(suStrava, 'link all\'attività su Strava');
  assert.strictEqual(suStrava.getAttribute('href'), 'https://www.strava.com/activities/55');
  // la mappa dei muscoli lavorati, da scaricare e aggiungere all'attività Strava a mano
  const mappa = app.querySelector('.pal-mappa svg');
  assert.ok(mappa, 'immagine dei muscoli nella schermata Salvato');
  assert.ok(mappa.querySelector('[data-muscolo="petto"]').getAttribute('fill') !== w.MappaMuscoli.SPENTO, 'petto acceso: c\'è una serie di spinte fatta');
  assert.ok(d.getElementById('pal-mappa-scarica'), 'pulsante per scaricare l\'immagine');
  assert.match(app.querySelector('.pal-mappa').textContent, /Aggiungi foto|foto/);
  assert.deepStrictEqual(errori, []);
});

test('allenamento interrotto: alla riapertura si riprende da dove eri', async () => {
  const { w } = pagina();
  await tick(100);
  const P = w.Palestra, piano = w.pianoPalestra('Petto-Spalle (adattamento 1)');
  const s = P.nuovaSessione(piano, {}, '2026-10-19T16:00:00.000Z');
  s.indice = 2;
  const { d } = pagina(s);
  await tick(150);
  const riprendi = d.getElementById('pal-riprendi');
  assert.ok(riprendi && !riprendi.hidden, 'pulsante Riprendi');
  riprendi.click();
  await tick(50);
  assert.strictEqual(d.querySelector('#mw-palestra .pal-nome').textContent, piano.esercizi[2].nome);
});

// 19/10/2026 sera: l'utente ha aperto un allenamento solo per guardarlo e non riusciva più a toglierlo.
// «Esci» interrompe e cancella; se ci sono serie già segnate chiede prima. Anche il pulsante Riprendi si può togliere.
test('Esci senza serie segnate: allenamento cancellato, nessun Riprendi', async () => {
  const { w, d } = pagina();
  await tick(150);
  let domande = 0;
  w.confirm = () => { domande++; return true; };
  await w.mwPalestra.inizia('Petto-Spalle (adattamento 1)');
  d.getElementById('pal-esci').click();
  assert.strictEqual(domande, 0, 'niente da perdere: non chiede');
  assert.ok(d.getElementById('mw-palestra').hidden);
  assert.strictEqual(w.localStorage.getItem('mirabiwatt_palestra_bozza'), null);
  assert.ok(d.getElementById('pal-riprendi').hidden);
  await w.mwPalestra.inizia('Petto-Spalle (adattamento 1)');
  assert.match(d.getElementById('mw-palestra').textContent, /Riscaldamento/, 'si ricomincia da capo');
});

test('Esci con serie segnate: chiede; se dici no resti nell\'allenamento', async () => {
  const { w, d } = pagina();
  await tick(150);
  await w.mwPalestra.inizia('Petto-Spalle (adattamento 1)');
  d.getElementById('pal-avanti').click();
  d.querySelector('[data-pal-fatta="0"]').click();
  let domanda = '';
  w.confirm = q => { domanda = q; return false; };
  d.getElementById('pal-esci').click();
  assert.match(domanda, /1 serie/);
  assert.ok(!d.getElementById('mw-palestra').hidden, 'resta aperto');
  w.confirm = () => true;
  d.getElementById('pal-esci').click();
  assert.ok(d.getElementById('mw-palestra').hidden);
  assert.strictEqual(w.localStorage.getItem('mirabiwatt_palestra_bozza'), null);
});

test('il pulsante Riprendi ha la ✕ per togliere l\'allenamento lasciato a metà', async () => {
  const { w } = pagina();
  await tick(100);
  const s = w.Palestra.nuovaSessione(w.pianoPalestra('Petto-Spalle (adattamento 1)'), {}, '2026-10-19T16:00:00.000Z');
  const { w: w2, d } = pagina(s);
  await tick(150);
  w2.confirm = () => true;
  d.getElementById('pal-scarta').click();
  assert.ok(d.getElementById('pal-riprendi').hidden);
  assert.strictEqual(w2.localStorage.getItem('mirabiwatt_palestra_bozza'), null);
});

test('Strava non collegato: dopo il salvataggio c\'è «Collega Strava»; collegato ma senza invio automatico: «Condividi su Strava»', async () => {
  for (const [stato, atteso] of [[{ collegato: false, configurato: true, auto: true }, /Collega Strava/], [{ collegato: true, auto: false }, /Condividi su Strava/]]) {
    const { w, d, richieste } = pagina(null, null, stato);
    await tick(150);
    await w.mwPalestra.inizia('Petto-Spalle (adattamento 1)');
    for (let i = 0; i < 12 && !d.getElementById('pal-salva'); i++) d.getElementById('pal-avanti').click();
    d.getElementById('pal-salva').click();
    await tick(120);
    const box = d.querySelector('.pal-salvato');
    assert.match(box.textContent, atteso);
    if (!stato.collegato) assert.strictEqual(box.querySelector('a[href*="/strava/collega"]').getAttribute('href'), 'http://mira-optiplex.tail2a9ecd.ts.net:3000/strava/collega');
    else {
      box.querySelector('#pal-strava-condividi').click();
      await tick(80);
      assert.ok(richieste.some(r => r.url === '/api/strava/condividi'));
      assert.strictEqual(d.querySelector('a.pal-strava').getAttribute('href'), 'https://www.strava.com/activities/77');
    }
  }
});

test('Tools: scheda Strava per collegare e verificare il collegamento senza pubblicare nulla', async () => {
  for (const collegato of [false, true]) {
    const { w, d, richieste, errori } = pagina(null, undefined, { configurato: true, collegato, atleta: collegato ? 'Tiziano S.' : null, auto: true });
    await tick(150);
    w.switchDashView('view-tools');
    await tick(60);
    const card = d.getElementById('strava-root');
    assert.ok(card, 'scheda Strava in Tools');
    if (!collegato) {
      assert.match(card.textContent, /Non collegato/);
      assert.strictEqual(card.querySelector('a[href*="/strava/collega"]').getAttribute('href'), 'http://mira-optiplex.tail2a9ecd.ts.net:3000/strava/collega');
    } else {
      assert.match(card.textContent, /Collegato · Tiziano S\./);
      card.querySelector('#strava-verifica').click();
      await tick(60);
      assert.ok(richieste.some(r => r.url === '/api/strava/verifica'), 'verifica = sola lettura del profilo, nessuna attività creata');
      assert.ok(!richieste.some(r => r.url === '/api/strava/condividi'));
      assert.match(card.textContent, /Strava risponde/);
      const auto = card.querySelector('#strava-auto');
      auto.click();
      await tick(40);
      const r = richieste.find(x => x.url === '/api/strava/auto');
      assert.deepStrictEqual(r.body, { auto: false });
    }
    assert.deepStrictEqual(errori, []);
  }
});

test('Strava 409 (attivita gia presente nello stesso orario): lo spiega, niente «Riprova», resta l immagine da aggiungere', async () => {
  const { w, d } = pagina(null, { ok: false, sovrapposta: true, error: 'Su Strava c\'è già un\'attività nello stesso orario' });
  await tick(150);
  await w.mwPalestra.inizia('Petto-Spalle (adattamento 1)');
  for (let i = 0; i < 12 && !d.getElementById('pal-salva'); i++) d.getElementById('pal-avanti').click();
  d.getElementById('pal-salva').click();
  await tick(120);
  const box = d.querySelector('.pal-salvato');
  assert.match(box.textContent, /già.*stesso orario[\s\S]*orologio/);
  assert.ok(!box.querySelector('#pal-strava-condividi'), 'niente Riprova: fallirebbe di nuovo');
  assert.doesNotMatch(box.textContent, /non ha accettato/);
  assert.ok(d.getElementById('pal-mappa-scarica'));
});

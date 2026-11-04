// MirabiWatt Palestra · interfaccia vera (www/) in jsdom con rete finta. Prima: node scripts/prepara.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const WWW = path.join(__dirname, '..', 'www');
const attendi = (ms = 30) => new Promise(r => setTimeout(r, ms));

const PIANO = { seduta: 'Petto-Spalle', schema: 'adattamento 1', scopo: 'Petto alto e spalle.', esercizi: [
  { id: 'panca', nome: 'Panca inclinata', gif: 'abc', attrezzo: 'manubri', tipo: 'isolamento', gruppo: 'petto', serie: 1, reps: [8, 10], repsTesto: '8-10', unita: 'reps', rir: '2', recSec: 90, partenza: [14, 18] }] };

function apri({ rete = 'casa', locale = {}, fatta = false, oggiTipo = 'palestra', notifiche = null } = {}) {
  const inviate = [];
  const oggi = new Date(); const iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;
  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>${fs.readFileSync(path.join(WWW, src), 'utf8')}</script>`);
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', beforeParse(w) {
    for (const [k, v] of Object.entries(locale)) w.localStorage.setItem(k, JSON.stringify(v));
    w.fetch = async (url, opz = {}) => {
      if (rete === 'nessuna' || (rete === 'tailscale' && url.includes('192.168'))) throw new Error('rete');
      if (url.includes('/api/palestra/prossime')) return { ok: true, json: async () => ({ generato: 'x', sedute: [{ data: iso, giorno: 'Lun', piano: PIANO, fatta }, { data: '2099-01-05', giorno: 'Lun', piano: PIANO }], ultimi: {} }) };
      if (url.includes('/api/settimana-piano')) return { ok: true, json: async () => ({ lunedi: iso, fase: 'Ri-adattamento palestra', settimana: 'Sett. 1', gare: [{ nome: 'Granfondo X', data: '2099-03-14', km: 104 }], giorni: [
        { data: iso, giorno: 'Mer', ...(oggiTipo === 'bici' ? { nome: 'EnduranceCorto', dur: '1h15', zona: 'Z2', riposo: false } : { nome: 'Petto-Spalle', dur: "50'", zona: 'Palestra', riposo: false }) },
        { data: '2099-01-02', giorno: 'Gio', nome: 'Riposo', dur: '', zona: '', riposo: true }] }) };
      if (url.includes('/api/dashboard')) return { ok: true, json: async () => ({ lastWeighIn: { date: iso, value: 82.5 } }) };
      if (url.includes('/api/palestra/sessioni')) { inviate.push({ url, corpo: JSON.parse(opz.body) }); return { ok: true, json: async () => ({ ok: true }) }; }
      throw new Error('url inattesa ' + url);
    };
    w.navigator.vibrate = () => true;
    if (notifiche) w.Capacitor = { Plugins: { LocalNotifications: notifiche } };
  } });
  return { w: dom.window, d: dom.window.document, inviate };
}

test('home: seduta di oggi scaricata, stato sincronizzato, pulsante Inizia', async () => {
  const { d, w } = apri();
  await attendi();
  assert.match(d.querySelector('.prossima').textContent, /Oggi[\s\S]*Petto-Spalle[\s\S]*1 esercizi/);
  assert.match(d.getElementById('stato-sync').textContent, /Sincronizzato/);
  assert.ok(d.getElementById('inizia'));
  assert.ok(d.querySelector('#inizia svg'), 'icona Phosphor presente');
  w.close();
});

test('fuori casa: arriva da Tailscale', async () => {
  const { d, w } = apri({ rete: 'tailscale' });
  await attendi();
  assert.strictEqual(w.MWP.stato.server, 'http://100.101.135.102:3000');
  assert.ok(d.getElementById('inizia'));
  w.close();
});

test('senza rete e senza dati: messaggio che spiega cosa fare', async () => {
  const { d, w } = apri({ rete: 'nessuna' });
  await attendi();
  assert.match(d.querySelector('.vuoto').textContent, /Nessuna seduta scaricata[\s\S]*Aggiorna/);
  assert.match(d.getElementById('stato-sync').textContent, /Offline, mai scaricate/);
  w.close();
});


const scrivi = (w, inp, v) => { inp.value = v; inp.dispatchEvent(new w.Event('input', { bubbles: true })); };

test('seduta completa offline: ogni riga con i suoi kg e ripetizioni, conferma di riga, recupero, fine, coda e invio al ritorno', async () => {
  const { d, w, inviate } = apri();
  await attendi();
  const fetchVera = w.fetch; w.fetch = async () => { throw new Error('rete'); };   // in palestra non c'e' segnale
  d.getElementById('inizia').click();
  assert.ok(!d.querySelector('.stepper'), 'niente barra con kg e ripetizioni sotto');
  assert.strictEqual(d.querySelectorAll('.righe-serie li').length, 2);
  d.querySelector('[data-conf="0"]').click();                       // riga W confermata
  assert.ok(d.querySelector('.recupero'), 'parte il recupero');
  d.getElementById('salta').click();
  const kg = d.querySelector('input[data-t="serie"][data-c="kg"]'), reps = d.querySelector('input[data-t="serie"][data-c="reps"]');
  assert.strictEqual(kg.value, '14');
  scrivi(w, kg, '16'); scrivi(w, reps, '9');                        // si cambia dalla riga stessa
  assert.strictEqual(JSON.parse(w.localStorage.getItem('mwp_bozza')).esercizi[0].serie[0].kg, 16, 'bozza salvata a ogni modifica');
  d.querySelector('[data-conf="1"]').click();
  assert.match(d.querySelector('h1').textContent, /Seduta finita/);
  d.getElementById('note').value = 'Spalla ok';
  d.getElementById('salva').click();
  await attendi();
  assert.strictEqual(JSON.parse(w.localStorage.getItem('mwp_coda')).length, 1);
  assert.strictEqual(w.localStorage.getItem('mwp_bozza'), null);
  assert.match(d.getElementById('stato-sync').textContent, /1 seduta da inviare/);
  w.fetch = fetchVera;
  d.getElementById('aggiorna').click();
  await attendi();
  assert.strictEqual(inviate.length, 1);
  assert.strictEqual(inviate[0].corpo.esercizi[0].serie[0].kg, 16);
  assert.strictEqual(inviate[0].corpo.esercizi[0].serie[0].reps, 9);
  assert.strictEqual(inviate[0].corpo.note, 'Spalla ok');
  assert.match(d.getElementById('stato-sync').textContent, /Sincronizzato/);
  w.close();
});

test('uscire dall allenamento: popup con Cancella / Riprendi piu tardi', async () => {
  const { d, w } = apri();
  await attendi();
  d.getElementById('inizia').click();
  d.getElementById('esci').click();
  assert.match(d.querySelector('.dialogo').textContent, /Riprendi più tardi[\s\S]*Cancella allenamento/);
  d.getElementById('dlg-resta').click();
  assert.ok(!d.querySelector('.dialogo'), 'resta nell allenamento');
  assert.ok(d.querySelector('.righe-serie'));
  d.getElementById('esci').click();
  d.getElementById('dlg-dopo').click();
  assert.ok(w.localStorage.getItem('mwp_bozza'), 'la bozza resta');
  assert.ok(d.getElementById('riprendi'));
  d.getElementById('riprendi').click();
  d.getElementById('esci').click();
  d.getElementById('dlg-cancella').click();
  assert.strictEqual(w.localStorage.getItem('mwp_bozza'), null, 'cancellata');
  assert.ok(d.getElementById('inizia'));
  w.close();
});

test('recupero: la notifica di fine si programma, si sposta con +15 s e si annulla con Salta', async () => {
  const chiamate = [];
  const notifiche = { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), createChannel: async () => {},
    schedule: async o => chiamate.push(['programma', o.notifications[0].schedule.at.getTime()]), cancel: async () => chiamate.push(['annulla']) };
  const { d, w } = apri({ notifiche });
  await attendi();
  d.getElementById('inizia').click();
  d.querySelector('[data-conf="0"]').click();
  await attendi();
  const prima = chiamate.find(c => c[0] === 'programma');
  assert.ok(prima && prima[1] > Date.now() + 50000 && prima[1] < Date.now() + 70000, 'circa 60 s dopo');
  d.getElementById('piu15').click();
  await attendi();
  assert.ok(chiamate.filter(c => c[0] === 'programma').pop()[1] >= prima[1] + 14000, 'spostata di 15 s');
  d.getElementById('salta').click();
  await attendi();
  assert.strictEqual(chiamate[chiamate.length - 1][0], 'annulla');
  w.close();
});

test('app chiusa a meta: la home propone Riprendi', async () => {
  const s = { id: 'x', data: '2026-11-02', inizio: '2026-11-02T18:05:00', seduta: 'Petto-Spalle', esercizi: [] };
  const { d, w } = apri({ locale: { mwp_bozza: s } });
  await attendi();
  assert.ok(d.getElementById('riprendi'));
  assert.match(d.querySelector('.prossima').textContent, /in corso[\s\S]*18:05/);
  w.close();
});

test('niente lineette lunghe nei testi dell app', () => {
  for (const f of ['index.html', 'js/app.js']) assert.ok(!/[—–]/.test(fs.readFileSync(path.join(WWW, f), 'utf8')), f);
});


test('oggi: seduta gia fatta, nessuna replica del calendario', async () => {
  const { d, w } = apri({ fatta: true });
  await attendi();
  assert.match(d.querySelector('.prossima').textContent, /Oggi[\s\S]*già salvata/);
  assert.ok(!d.getElementById('inizia'));
  assert.ok(!d.querySelector('.elenco-giorni, .giorno-card'), 'niente elenco di giorni nella schermata Oggi');
  w.close();
});

test('calendario: card cliccabili con colori per bici, palestra e riposo; obiettivi separati', async () => {
  const { d, w } = apri();
  await attendi();
  d.querySelector('[data-tab="calendario"]').click();
  assert.match(d.querySelector('h1').textContent, /Calendario/);
  assert.strictEqual(d.querySelectorAll('[data-giorno]').length, 2);
  assert.match(d.querySelector('.giorno-card.palestra.oggi').textContent, /Petto-Spalle[\s\S]*50'/);
  assert.ok(d.querySelector('.giorno-card.riposo'));
  const gara = d.querySelector('[data-gara]');
  assert.match(gara.textContent, /Granfondo X/);
  assert.ok(!gara.closest('ul').querySelector('[data-giorno]'), 'obiettivi in un elenco a parte');
  d.querySelector('[data-giorno="0"]').click();
  assert.match(d.querySelector('.foglio').textContent, /Palestra[\s\S]*Petto-Spalle[\s\S]*Panca inclinata/);
  d.getElementById('chiudi-foglio').click();
  assert.ok(!d.querySelector('.foglio'));
  gara.click();
  assert.match(d.querySelector('.foglio').textContent, /Obiettivo[\s\S]*104 km/);
  w.close();
});

test('nutrizione: target e pasti del giorno', async () => {
  const { d, w } = apri();
  await attendi();
  d.querySelector('[data-tab="nutrizione"]').click();
  assert.match(d.querySelector('.prossima').textContent, /\d{4} kcal[\s\S]*proteine/);
  assert.ok(d.querySelectorAll('.pasto').length >= 4);
  assert.match(d.querySelector('.pasto').textContent, /Colazione/);
  w.close();
});

test('oggi in bici: solo la card della bici, niente tracking ne prossime sedute', async () => {
  const { d, w } = apri({ oggiTipo: 'bici' });
  await attendi();
  // la seduta di palestra di oggi scaricata prevale: senza di essa si vede la bici
  w.localStorage.setItem('mwp_dati', JSON.stringify({ sedute: [{ data: '2099-01-05', piano: PIANO }] }));
  w.MWP.home();
  assert.match(d.querySelector('.prossima').textContent, /in bici[\s\S]*EnduranceCorto[\s\S]*1h15/);
  assert.ok(!d.getElementById('inizia'));
  w.close();
});

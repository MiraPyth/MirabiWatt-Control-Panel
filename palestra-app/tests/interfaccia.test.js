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

function apri({ rete = 'casa', locale = {} } = {}) {
  const inviate = [];
  const oggi = new Date(); const iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;
  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>${fs.readFileSync(path.join(WWW, src), 'utf8')}</script>`);
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', beforeParse(w) {
    for (const [k, v] of Object.entries(locale)) w.localStorage.setItem(k, JSON.stringify(v));
    w.fetch = async (url, opz = {}) => {
      if (rete === 'nessuna' || (rete === 'tailscale' && url.includes('192.168'))) throw new Error('rete');
      if (url.includes('/api/palestra/prossime')) return { ok: true, json: async () => ({ generato: 'x', sedute: [{ data: iso, giorno: 'Lun', piano: PIANO }], ultimi: {} }) };
      if (url.includes('/api/palestra/sessioni')) { inviate.push({ url, corpo: JSON.parse(opz.body) }); return { ok: true, json: async () => ({ ok: true }) }; }
      throw new Error('url inattesa ' + url);
    };
    w.navigator.vibrate = () => true;
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

test('seduta completa offline: avvicinamento, serie con stepper, recupero, fine, salvata in coda e inviata al ritorno', async () => {
  const { d, w, inviate } = apri();
  await attendi();
  // da qui la rete cade: in palestra non c'e' segnale
  const fetchVera = w.fetch; w.fetch = async () => { throw new Error('rete'); };
  d.getElementById('inizia').click();
  assert.match(d.querySelector('.passo').textContent, /Avvicinamento 1 di 1/);
  assert.ok(!d.querySelector('.stepper'), 'niente stepper sugli avvicinamenti');
  d.getElementById('fatta').click();
  assert.ok(d.querySelector('.recupero'), 'recupero dopo l avvicinamento');
  d.getElementById('salta').click();
  assert.match(d.querySelector('.passo').textContent, /Serie 1 di 1/);
  assert.strictEqual(d.querySelectorAll('.stepper output')[0].textContent, '14');
  d.querySelector('[data-campo="kg"][data-verso="1"]').click();
  assert.strictEqual(d.querySelectorAll('.stepper output')[0].textContent, '16');
  assert.ok(JSON.parse(w.localStorage.getItem('mwp_bozza')), 'bozza salvata a ogni tocco');
  d.getElementById('fatta').click();
  assert.match(d.querySelector('h1').textContent, /Seduta finita/);
  d.getElementById('note').value = 'Spalla ok';
  d.getElementById('salva').click();
  await attendi();
  assert.strictEqual(JSON.parse(w.localStorage.getItem('mwp_coda')).length, 1);
  assert.strictEqual(w.localStorage.getItem('mwp_bozza'), null);
  assert.match(d.getElementById('stato-sync').textContent, /1 seduta da inviare/);
  // a casa: Aggiorna invia la coda
  w.fetch = fetchVera;
  d.getElementById('aggiorna').click();
  await attendi();
  assert.strictEqual(inviate.length, 1);
  assert.strictEqual(inviate[0].corpo.esercizi[0].serie[0].kg, 16);
  assert.strictEqual(inviate[0].corpo.note, 'Spalla ok');
  assert.deepStrictEqual(JSON.parse(w.localStorage.getItem('mwp_coda')), []);
  assert.match(d.getElementById('stato-sync').textContent, /Sincronizzato/);
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

// «Ripianifica con IA» (31/10/2026). L'utente, sabato: «L'AI non aveva idea di che giorno fosse… se invio un prompt
// oggi che è sabato, bisogna che riceva tutte le informazioni di questa settimana fino al momento del prompt per capire
// come pianificare il giorno successivo, non i precedenti. Non si torna indietro nel tempo.»
// Prima: giorni «Lun…Dom» senza date, nessun «oggi è sabato», ultime 5 attività di 14 giorni (anche della settimana
// prima), e Gemini riscriveva tutti e 7 i giorni, compresi quelli già passati.
// Dati veri della settimana 26/10: elastici e uscite saltati, MTB venerdì 220' e sabato 98'.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../ripianifica-ia.js');

const WS = '2026-10-26';
const PIANO = [
  { d: 'Lun', s: 'Elastici Spinta', dur: "35'", zone: 'Palestra' },
  { d: 'Mar', s: 'Uscita a pranzo', dur: "45'", zone: 'Z1-Z2' },
  { d: 'Mer', s: 'Elastici Gambe-Core', dur: "35'", zone: 'Palestra' },
  { d: 'Gio', s: 'Elastici Tirata', dur: "35'", zone: 'Palestra' },
  { d: 'Ven', s: 'Uscita facoltativa', dur: "40'", zone: 'Z1-Z2' },
  { d: 'Sab', s: 'Riposo', dur: '', zone: '' },
  { d: 'Dom', s: 'MTB Endurance', dur: '2h-2h30', zone: 'Z2', critical: true },
];
const ATTIVITA = [
  { date: '2026-10-31', name: 'Granforma', type: 'Ride', tss: 98, durationMin: 98 },
  { date: '2026-10-30', name: 'MTBitume', type: 'Ride', tss: 156, durationMin: 220 },
  { date: '2026-10-24', name: 'Uscita della settimana prima', type: 'Ride', tss: 120, durationMin: 150 },
];
const PROSSIMA = [
  { d: 'Lun', s: 'Petto-Spalle', dur: "50'", zone: 'Palestra' },
  { d: 'Mar', s: 'Zwift Race', dur: "60-75'", zone: 'HIT', critical: true },
  { d: 'Mer', s: 'Gambe-Core', dur: "50'", zone: 'Palestra' },
];
const sabato = new Date(2026, 9, 31, 18, 40);
const ctx = () => R.contesto({ ws: WS, giorni: PIANO, attivita: ATTIVITA, adesso: sabato, forma: { ctl: 41, atl: 58, tsb: -17 },
  prossima: PROSSIMA, etichetta: 'Base 1 — Sett. 4 — Scarico fuori casa' });

test('sa che oggi è sabato 31 ottobre e a che ora', () => {
  const c = ctx();
  assert.strictEqual(c.oggi, '2026-10-31');
  const p = R.prompt(c, 'domani non so cosa fare');
  assert.match(p, /sabato 31 ottobre 2026, ore 18:40/);
});

test('ogni giorno ha la sua data e si sa se è passato, oggi o futuro', () => {
  const c = ctx();
  assert.deepStrictEqual(c.giorni.map(g => [g.d, g.data, g.quando]), [
    ['Lun', '2026-10-26', 'passato'], ['Mar', '2026-10-27', 'passato'], ['Mer', '2026-10-28', 'passato'],
    ['Gio', '2026-10-29', 'passato'], ['Ven', '2026-10-30', 'passato'], ['Sab', '2026-10-31', 'oggi'], ['Dom', '2026-11-01', 'futuro']]);
  const p = R.prompt(c, 'x');
  assert.match(p, /Ven 30\/10/);
  assert.match(p, /Dom 1\/11/);
});

test('cosa ho fatto davvero, solo di questa settimana', () => {
  const c = ctx();
  assert.deepStrictEqual(c.giorni[4].fatto.map(a => a.name), ['MTBitume']);
  assert.deepStrictEqual(c.giorni[0].fatto, []);
  const p = R.prompt(c, 'x');
  assert.match(p, /MTBitume[^\n]*220'[^\n]*TSS 156/);
  assert.match(p, /Granforma[^\n]*98'[^\n]*TSS 98/);
  assert.doesNotMatch(p, /settimana prima/);
  // il conto della settimana: TSS fatto 254, sedute saltate elencate
  assert.match(p, /TSS 254/);
  assert.match(p, /saltat[ei][^\n]*Elastici Spinta/i);
});

test('oggi con un\'attività già fatta è chiuso: si ripianifica solo domenica', () => {
  const c = ctx();
  assert.deepStrictEqual(R.modificabili(c), ['Dom']);
  const p = R.prompt(c, 'x');
  assert.match(p, /DA RIPIANIFICARE[^\n]*\n[^\n]*Dom 1\/11/);
});

test('oggi senza niente fatto si può ancora ripianificare', () => {
  const c = R.contesto({ ws: WS, giorni: PIANO, attivita: [], adesso: new Date(2026, 9, 31, 9, 0), forma: {} });
  assert.deepStrictEqual(R.modificabili(c), ['Sab', 'Dom']);
});

test('l\'inizio della settimana dopo entra nel prompt (domenica non deve rovinare il lunedì)', () => {
  const p = R.prompt(ctx(), 'x');
  assert.match(p, /Lun 2\/11[^\n]*Petto-Spalle/);
  assert.match(p, /Mar 3\/11[^\n]*Zwift Race/);
});

test('la richiesta dell\'atleta e lo stato di forma di oggi', () => {
  const p = R.prompt(ctx(), 'domani non so cosa fare');
  assert.match(p, /"domani non so cosa fare"/);
  assert.match(p, /TSB[^\n]*-17/);
});

test('la risposta di Gemini non tocca i giorni passati né oggi già fatto', () => {
  const c = ctx();
  const risposta = { days: [
    { d: 'Lun', s: 'Zwift Race', dur: "60'", zone: 'HIT' }, // tentativo di cambiare il passato: ignorato
    { d: 'Dom', s: 'Elastici Spinta', dur: "35'", zone: 'Palestra', note: 'forza saltata in settimana' }],
    rationale: 'Due giorni di MTB: domenica forza leggera.' };
  const r = R.applica(risposta, c);
  assert.strictEqual(r.days.length, 7);
  assert.deepStrictEqual(r.days.slice(0, 6), PIANO.slice(0, 6));
  assert.strictEqual(r.days[6].s, 'Elastici Spinta');
  assert.strictEqual(r.days[6].d, 'Dom');
  assert.strictEqual(r.rationale, 'Due giorni di MTB: domenica forza leggera.');
});

test('se Gemini dimentica un giorno da ripianificare resta quello del piano', () => {
  const c = R.contesto({ ws: WS, giorni: PIANO, attivita: [], adesso: new Date(2026, 9, 31, 9, 0), forma: {} });
  const r = R.applica({ days: [{ d: 'Dom', s: 'EnduranceCorto', dur: '1h15', zone: 'Z2' }], rationale: 'ok' }, c);
  assert.strictEqual(r.days[5].s, 'Riposo');
  assert.strictEqual(r.days[6].s, 'EnduranceCorto');
});

test('settimana tutta passata: niente da ripianificare, errore chiaro', () => {
  const c = R.contesto({ ws: '2026-10-19', giorni: PIANO, attivita: [], adesso: sabato, forma: {} });
  assert.deepStrictEqual(R.modificabili(c), []);
  assert.throws(() => R.prompt(c, 'x'), /già passata/);
});

test('settimana futura: tutti i giorni si possono ripianificare, niente «fatto»', () => {
  const c = R.contesto({ ws: '2026-11-02', giorni: PROSSIMA.concat(PIANO.slice(3)), attivita: [], adesso: sabato, forma: {} });
  assert.strictEqual(R.modificabili(c).length, 7);
});

test('il server usa questo prompt e passa la settimana giusta', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /require\('\.\/ripianifica-ia\.js'\)/);
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'dashboard.html'), 'utf8');
  assert.match(html, /weekStart: viewedWeekStart/);
});

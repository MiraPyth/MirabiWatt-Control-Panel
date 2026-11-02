// COACH CLAUDIO (19/10/2026 sera): ogni domenica alle 20:00 su Discord il recap della settimana di allenamento e cosa
// c'è nella prossima, con alimentazione e motivi scientifici. Stesso formato dei messaggi di «Claudio l'Economo»:
// una riga di titolo e riquadri colorati per sezione, nota finale con le fonti. Niente rete qui.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../coach.js');

const WS = '2026-11-23';
const PIANO = [
  { d: 'Lun', s: 'Petto-Spalle (costruzione 1)', dur: '75\'', zone: 'Palestra' },
  { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
  { d: 'Mer', s: 'Gambe-Core (costruzione 1)', dur: '75\'', zone: 'Palestra' },
  { d: 'Gio', s: 'EnduranceCorto', dur: '1h15', zone: 'Z2' },
  { d: 'Ven', s: 'Schiena-Bicipiti (costruzione 1)', dur: '75\'', zone: 'Palestra' },
  { d: 'Sab', s: 'Riposo' },
  { d: 'Dom', s: 'EnduranceLungo', dur: '2h45', zone: 'Z2', critical: true }
];
const ATTIVITA = [
  { date: '2026-11-24', type: 'VirtualRide', name: 'Zwift Race', durationMin: 62, tss: 80 },
  { date: '2026-11-26', type: 'Ride', name: 'Endurance', durationMin: 70, tss: 50 },
  { date: '2026-11-29', type: 'Ride', name: 'Lungo', durationMin: 170, tss: 140 },
  { date: '2026-11-23', type: 'WeightTraining', name: '[MW] Petto-Spalle', durationMin: 70, tss: 30 }
];
const serie = (kg, n) => Array.from({ length: n }, () => ({ kg, reps: 10, fatta: true }));
const PALESTRA = [
  { id: 'a', data: '2026-11-16', seduta: 'Petto-Spalle', esercizi: [{ id: 'panca-piana-manubri', nome: 'Panca piana con manubri', serie: serie(20, 3) }] },
  { id: 'b', data: '2026-11-23', seduta: 'Petto-Spalle', esercizi: [{ id: 'panca-piana-manubri', nome: 'Panca piana con manubri', serie: serie(22, 3) }] },
  { id: 'c', data: '2026-11-25', seduta: 'Gambe-Core', esercizi: [{ id: 'squat-bilanciere', nome: 'Squat con bilanciere', serie: [...serie(60, 2), { kg: 60, reps: 8, fatta: false }] }] }
];
const WELL = [
  { date: '2026-11-17', weight: 80.6, ctl: 50, atl: 50 }, { date: '2026-11-20', weight: 80.8, ctl: 51, atl: 52 },
  { date: '2026-11-23', weight: 80.9, ctl: 51, atl: 50 }, { date: '2026-11-27', weight: 81.1, ctl: 53, atl: 58 }, { date: '2026-11-29', weight: 81.2, ctl: 54, atl: 57 }
];

const analisi = () => C.analizza({ ws: WS, giorniPiano: PIANO, attivita: ATTIVITA, sessioniPalestra: PALESTRA, wellness: WELL });

test('bici: sedute fatte su quelle previste, ore e carico', () => {
  const a = analisi();
  assert.deepStrictEqual([a.bici.fatte, a.bici.previste], [3, 3]);
  assert.strictEqual(a.bici.minuti, 62 + 70 + 170);
  assert.strictEqual(a.bici.tss, 270);
});

test('palestra: sedute dallo storico, serie fatte e i carichi saliti rispetto alla volta prima', () => {
  const a = analisi();
  assert.deepStrictEqual([a.palestra.fatte, a.palestra.previste], [2, 3]);
  assert.strictEqual(a.palestra.serie, 5);
  assert.deepStrictEqual(a.palestra.mancate, ['Schiena-Bicipiti']);
  assert.deepStrictEqual(a.palestra.progressi, [{ nome: 'Panca piana con manubri', da: 20, a: 22 }]);
});

test('forma e peso: CTL della settimana e media del peso contro la settimana prima', () => {
  const a = analisi();
  assert.deepStrictEqual([a.forma.ctlDa, a.forma.ctlA, a.forma.tsb], [51, 54, -3]);
  assert.strictEqual(a.peso.media, 81.07);
  assert.strictEqual(a.peso.delta, 0.37);
});

test('consiglio sulle calorie dal ritmo del peso, per fase (Pyramid Nutrition)', () => {
  assert.strictEqual(C.consiglioPeso('costruzione', 0.15, 81).stato, 'ok');
  assert.match(C.consiglioPeso('costruzione', 0.6, 81).testo, /togli/i);
  assert.match(C.consiglioPeso('costruzione', -0.2, 81).testo, /aggiungi/i);
  assert.strictEqual(C.consiglioPeso('definizione', -0.5, 81).stato, 'ok');
  assert.match(C.consiglioPeso('definizione', -0.1, 81).testo, /togli/i);
  assert.match(C.consiglioPeso('definizione', -1.2, 81).testo, /aggiungi/i);
  assert.strictEqual(C.consiglioPeso('mantenimento', 0.1, 81).stato, 'ok');
  assert.strictEqual(C.consiglioPeso('costruzione', null, 81).stato, 'senza-dati');
});

test('il tipo di giorno per la nutrizione, come la pagina Nutrizione', () => {
  assert.deepStrictEqual(PIANO.map(C.tipoGiorno), ['palestra', 'hit', 'palestra', 'endurance', 'palestra', 'riposo', 'lungo']);
});

test('messaggio Discord nel formato di Claudio l\'Economo', () => {
  const m = C.messaggio({
    ws: WS, analisi: analisi(), commento: 'Settimana solida: il lungo è il pezzo più importante.',
    prossima: { ws: '2026-11-30', fase: 'Costruzione', label: 'Sett. 2', special: 'Stesse serie, RIR 2.', perche: 'Progressione dello sforzo (RP).',
      giorni: PIANO, nutrizione: { fase: 'costruzione', perche: 'Surplus piccolo.', tipi: { palestra: { kcal: 2900, p: 162, c: 380, fat: 80 }, riposo: { kcal: 2530, p: 162, c: 300, fat: 70 } } } }
  });
  assert.match(m.content, /^🏋️ \*\*Recap della settimana\*\* · domenica 29 novembre$/);
  assert.deepStrictEqual(m.embeds.map(e => e.title), ['📊 La settimana appena fatta', '🧭 Com\'è andata', '📅 La prossima settimana', '🍽️ Alimentazione', '🔬 Perché']);
  for (const e of m.embeds) { assert.ok(typeof e.color === 'number'); assert.ok(e.description.length > 10 && e.description.length <= 1500); }
  assert.match(m.embeds[0].description, /Bici \*\*3\/3\*\*/);
  assert.match(m.embeds[0].description, /Palestra \*\*2\/3\*\*/);
  assert.match(m.embeds[0].description, /Panca piana con manubri 20 → 22 kg/);
  assert.match(m.embeds[2].description, /Lun · Petto-Spalle \(costruzione 1\)/);
  assert.match(m.embeds[3].description, /Palestra.*2900 kcal/);
  assert.ok(m.embeds[m.embeds.length - 1].footer.text.includes('Fonti'));
  assert.deepStrictEqual(m.allowed_mentions, { parse: [] });
});

test('a metà settimana contano solo i giorni già passati (niente sedute «mancate» future, niente CTL proiettato)', () => {
  const a = C.analizza({ ws: WS, oggi: '2026-11-25', giorniPiano: PIANO, attivita: ATTIVITA, sessioniPalestra: PALESTRA, wellness: WELL });
  assert.deepStrictEqual([a.bici.fatte, a.bici.previste], [1, 1], 'solo martedì');
  assert.deepStrictEqual([a.palestra.fatte, a.palestra.previste], [2, 2]);
  assert.deepStrictEqual(a.palestra.mancate, []);
  assert.strictEqual(a.forma.ctlA, 51, 'il CTL di oggi, non quello proiettato');
});

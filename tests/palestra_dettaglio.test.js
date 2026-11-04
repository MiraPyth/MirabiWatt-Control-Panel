// 04/11/2026: da Oggi, a seduta fatta, si apre come e' stata fatta (serie vere, kg e ripetizioni, note).
const test = require('node:test');
const assert = require('node:assert');
const P = require('../palestra.js');

const sessione = {
  id: 'x', data: '2026-11-04', seduta: 'Gambe-Core', schema: 'adattamento 1', inizio: '2026-11-04T12:30:00', fine: '2026-11-04T13:20:00', note: 'Alzate laterali con i manubri, troppa gente',
  esercizi: [
    { id: 'squat-bilanciere', nome: 'Squat', serie: [{ kg: 20, reps: 8, fatta: true }, { kg: 22.5, reps: 7, fatta: true }, { kg: 25, reps: 6, fatta: false }] },
    { id: 'calf-raise', nome: 'Calf raise', serie: [{ kg: 30, reps: 12, fatta: false }] },
    { id: 'plank', nome: 'Plank', unita: 's', serie: [{ kg: null, reps: 40, fatta: true }] },
  ] };

test('dettaglio: solo gli esercizi fatti, solo le serie fatte, con kg e ripetizioni', () => {
  const d = P.dettaglioSessione(sessione);
  assert.strictEqual(d.titolo, 'Gambe-Core');
  assert.deepStrictEqual(d.esercizi.map(e => e.nome), ['Squat', 'Plank']);
  assert.strictEqual(d.esercizi[0].testo, '20 kg × 8, 22,5 kg × 7');
  assert.strictEqual(d.esercizi[1].testo, '40 s', 'a tempo: secondi, senza kg');
});

test('dettaglio: durata, serie totali e note', () => {
  const d = P.dettaglioSessione(sessione);
  assert.strictEqual(d.durataMin, 50);
  assert.strictEqual(d.serieFatte, 3);
  assert.strictEqual(d.note, 'Alzate laterali con i manubri, troppa gente');
});

test('dettaglio: sessione vuota o mancante non rompe', () => {
  assert.strictEqual(P.dettaglioSessione(null), null);
  assert.deepStrictEqual(P.dettaglioSessione({ seduta: 'X', esercizi: [] }).esercizi, []);
});

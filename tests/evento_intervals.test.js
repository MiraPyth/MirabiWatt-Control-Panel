// 19/10/2026: il nome inviato a intervals.icu. «[MirabiWatt]» allungava i nomi fino a renderli illeggibili: ora «[MW]».
// Le sedute di palestra vanno come WeightTraining con la durata, non come uscite in bici.
const test = require('node:test');
const assert = require('node:assert');
const { eventoAllenamento, TOGLI_SIGLA } = require('../intervals-evento.js');
const { getWorkoutDetail } = require('../workout-library.js');

const ev = day => eventoAllenamento(day, '2026-10-20', getWorkoutDetail(day.s, 300, 280));

test('sigla corta [MW]', () => {
  const e = ev({ d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT' });
  assert.strictEqual(e.name, '[MW] Zwift Race');
  assert.strictEqual(e.type, 'Ride');
  assert.strictEqual(e.uid, 'mirabiwatt-2026-10-20', 'stesso uid: un nuovo invio aggiorna l\'evento, non lo duplica');
  assert.strictEqual(e.indoor, true);
});

test('palestra: WeightTraining, durata, esercizi, nome senza lo schema tra parentesi', () => {
  const e = ev({ d: 'Lun', s: 'Petto-Spalle (adattamento 1)', dur: '55\'', zone: 'Palestra', note: 'Prima volta dopo anni.' });
  assert.strictEqual(e.name, '[MW] Petto-Spalle');
  assert.strictEqual(e.type, 'WeightTraining');
  assert.ok(e.moving_time >= 40 * 60);
  assert.match(e.description, /Panca piana/);
  assert.match(e.description, /Prima volta dopo anni\./);
});

test('i nomi vecchi e nuovi si leggono senza sigla', () => {
  assert.strictEqual('[MirabiWatt] EnduranceLungo'.replace(TOGLI_SIGLA, ''), 'EnduranceLungo');
  assert.strictEqual('[MW] EnduranceLungo'.replace(TOGLI_SIGLA, ''), 'EnduranceLungo');
});

// 10/11/2026: «Allenamento recente» della Dashboard Fit: l'ultimo allenamento tra le sedute di palestra salvate e le attivita' di intervals.icu.
// Le metriche compaiono solo se pertinenti e vere: niente watt per la palestra, niente muscoli per la bici, niente numeri inventati.
const test = require('node:test');
const assert = require('node:assert');
const { ultimoAllenamento } = require('../fit-ultimo.js');

const sessione = (data, inizio, fine, esercizi) => ({ id: inizio, data, seduta: 'Petto-Spalle', schema: 'adattamento 2', inizio, fine, esercizi });
const panca = n => ({ id: 'panca-piana-manubri', nome: 'Panca piana', serie: Array.from({ length: n }, () => ({ kg: 14, reps: 8, fatta: true })) });
const ride = (date, start, extra = {}) => ({ id: 'a1', date, start, name: 'Zwift Race', type: 'VirtualRide', durationMin: 62, distanceKm: 31.2, kcal: 780, np: 262, watt: 240, ...extra });
const base = { pesoKg: 82.47 };

test('palestra: nome, durata, muscoli lavorati (serie per muscolo) e calorie stimate dichiarate', () => {
  const u = ultimoAllenamento({ ...base, sessioni: [sessione('2026-11-06', '2026-11-06T18:00:00', '2026-11-06T18:50:00', [panca(3)])], attivita: [] });
  assert.strictEqual(u.tipo, 'palestra');
  assert.strictEqual(u.nome, 'Petto-Spalle');
  assert.strictEqual(u.data, '2026-11-06');
  assert.strictEqual(u.durataMin, 50);
  assert.strictEqual(u.muscoli[0].nome, 'Petto');
  assert.strictEqual(u.muscoli[0].serie, 3);
  assert.deepStrictEqual([u.kcal, u.kcalStimate], [344, true]);
  assert.strictEqual(u.distanzaKm, null);
  assert.strictEqual(u.npWatt, null, 'niente watt in palestra');
  assert.strictEqual(u.velMediaKmh, null);
});

test('bici: durata, calorie misurate, distanza, potenza normalizzata e velocita\' media (km/h) dai dati; niente muscoli', () => {
  const u = ultimoAllenamento({ ...base, sessioni: [], attivita: [ride('2026-11-09', '19:00')] });
  assert.strictEqual(u.tipo, 'ciclismo');
  assert.deepStrictEqual([u.durataMin, u.kcal, u.kcalStimate, u.distanzaKm, u.npWatt], [62, 780, false, 31.2, 262]);
  assert.strictEqual(u.velMediaKmh, 30.2);
  assert.deepStrictEqual(u.muscoli, []);
});

test('vince il piu\' recente per data e ora, tra palestra e attivita\'', () => {
  const s = sessione('2026-11-09', '2026-11-09T12:00:00', '2026-11-09T12:50:00', [panca(2)]);
  assert.strictEqual(ultimoAllenamento({ ...base, sessioni: [s], attivita: [ride('2026-11-09', '19:00')] }).tipo, 'ciclismo');
  assert.strictEqual(ultimoAllenamento({ ...base, sessioni: [s], attivita: [ride('2026-11-09', '07:00')] }).tipo, 'palestra');
  assert.strictEqual(ultimoAllenamento({ ...base, sessioni: [s], attivita: [ride('2026-11-08', '19:00')] }).tipo, 'palestra');
});

test('attivita senza tipo o senza durata (segnaposto Strava) e sedute senza serie fatte non contano', () => {
  const vuota = sessione('2026-11-10', '2026-11-10T10:00:00', '2026-11-10T10:05:00', [{ id: 'x', nome: 'X', serie: [{ kg: 10, reps: 5, fatta: false }] }]);
  const u = ultimoAllenamento({ ...base, sessioni: [vuota], attivita: [{ id: '9', date: '2026-11-10', start: '13:00', name: '', type: '', durationMin: null }, ride('2026-11-05', '18:00')] });
  assert.strictEqual(u.data, '2026-11-05');
  assert.strictEqual(ultimoAllenamento({ ...base, sessioni: [vuota], attivita: [] }), null);
});

test('corsa e altri sport: tipo corretto, velocita\' solo se c\'e\' la distanza, calorie null se mancanti', () => {
  const run = ultimoAllenamento({ ...base, sessioni: [], attivita: [{ id: '5', date: '2026-11-08', start: '07:00', name: 'Corsa', type: 'Run', durationMin: 30, distanzaKm: null, kcal: null }] });
  assert.strictEqual(run.tipo, 'corsa');
  assert.deepStrictEqual([run.kcal, run.velMediaKmh, run.distanzaKm], [null, null, null]);
  const nuoto = ultimoAllenamento({ ...base, sessioni: [], attivita: [{ id: '6', date: '2026-11-08', start: '07:00', name: 'Nuoto', type: 'Swim', durationMin: 40, distanceKm: 1.5, kcal: 400 }] });
  assert.strictEqual(nuoto.tipo, 'nuoto');
  const altro = ultimoAllenamento({ ...base, sessioni: [], attivita: [{ id: '7', date: '2026-11-08', start: '07:00', name: 'Yoga', type: 'Yoga', durationMin: 40 }] });
  assert.strictEqual(altro.tipo, 'altro');
});

test('senza peso le calorie della palestra non si stimano', () => {
  const u = ultimoAllenamento({ pesoKg: null, sessioni: [sessione('2026-11-06', '2026-11-06T18:00:00', '2026-11-06T18:50:00', [panca(3)])], attivita: [] });
  assert.deepStrictEqual([u.kcal, u.kcalStimate], [null, false]);
});

test('nessun allenamento: null', () => {
  assert.strictEqual(ultimoAllenamento({ ...base, sessioni: [], attivita: [] }), null);
});

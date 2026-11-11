// 11/11/2026: calendario mensile dell'app Fit. Puro: fatto (attivita' + sedute salvate) e pianificato (eventi), per giorno e per sport.
const test = require('node:test');
const assert = require('node:assert');
const { calendarioMese, intervalloMese } = require('../fit-calendario.js');

const base = { mese: '2026-11', oggi: '2026-11-11', attivita: [], eventi: [], sessioni: [] };
const giorno = (c, d) => c.giorni.find(g => g.data === d);

test('intervallo del mese: primo e ultimo giorno, anche febbraio bisestile', () => {
  assert.deepStrictEqual(intervalloMese('2026-11'), { da: '2026-11-01', a: '2026-11-30' });
  assert.deepStrictEqual(intervalloMese('2028-02'), { da: '2028-02-01', a: '2028-02-29' });
  assert.strictEqual(intervalloMese('2026-13'), null);
  assert.strictEqual(intervalloMese('novembre'), null);
});

test('un giorno per ogni giorno del mese, vuoto se non c e nulla', () => {
  const c = calendarioMese(base);
  assert.strictEqual(c.giorni.length, 30);
  assert.deepStrictEqual(giorno(c, '2026-11-03'), { data: '2026-11-03', voci: [], sport: [], riposo: false });
});

test('attivita fatte: sport dal tipo, durata e svolto vero', () => {
  const c = calendarioMese({ ...base, attivita: [
    { id: 1, date: '2026-11-05', type: 'Ride', name: 'Zwift Z2', durationMin: 62 },
    { id: 2, date: '2026-11-06', type: 'Run', name: 'Corsa', durationMin: 35 },
    { id: 3, date: '2026-11-07', type: 'Swim', name: 'Nuoto', durationMin: 30 },
    { id: 4, date: '2026-11-08', type: 'Yoga', name: 'Yoga', durationMin: 20 }] });
  assert.deepStrictEqual(giorno(c, '2026-11-05').voci, [{ sport: 'ciclismo', nome: 'Zwift Z2', durataMin: 62, svolto: true }]);
  assert.deepStrictEqual(giorno(c, '2026-11-06').sport, ['corsa']);
  assert.deepStrictEqual(giorno(c, '2026-11-07').sport, ['nuoto']);
  assert.deepStrictEqual(giorno(c, '2026-11-08').sport, ['altro']);
});

test('seduta di palestra salvata e attivita di pesi dello stesso giorno: una sola voce', () => {
  const sessioni = [{ data: '2026-11-09', seduta: 'Petto-Spalle', inizio: '2026-11-09T18:00:00', fine: '2026-11-09T18:48:00', esercizi: [{ serie: [{ fatta: true }] }] }];
  const c = calendarioMese({ ...base, sessioni, attivita: [{ id: 9, date: '2026-11-09', type: 'WeightTraining', name: 'Pesi', durationMin: 50 }] });
  assert.deepStrictEqual(giorno(c, '2026-11-09').voci, [{ sport: 'palestra', nome: 'Petto-Spalle', durataMin: 48, svolto: true }]);
});

test('sedute senza serie fatte non contano', () => {
  const sessioni = [{ data: '2026-11-04', seduta: 'Vuota', inizio: '2026-11-04T18:00:00', fine: '2026-11-04T18:10:00', esercizi: [{ serie: [{ fatta: false }] }] }];
  assert.deepStrictEqual(giorno(calendarioMese({ ...base, sessioni }), '2026-11-04').voci, []);
});

test('pianificato: evento senza attivita dello stesso sport resta da fare; se fatto sparisce', () => {
  const eventi = [
    { date: '2026-11-12', name: 'Sweet Spot', categoria: 'WORKOUT', type: 'Ride', durationMin: 75 },
    { date: '2026-11-10', name: 'Z2', categoria: 'WORKOUT', type: 'Ride', durationMin: 60 }];
  const attivita = [{ id: 1, date: '2026-11-10', type: 'VirtualRide', name: 'Zwift', durationMin: 58 }];
  const c = calendarioMese({ ...base, eventi, attivita });
  assert.deepStrictEqual(giorno(c, '2026-11-12').voci, [{ sport: 'ciclismo', nome: 'Sweet Spot', durataMin: 75, svolto: false }]);
  assert.deepStrictEqual(giorno(c, '2026-11-10').voci, [{ sport: 'ciclismo', nome: 'Zwift', durataMin: 58, svolto: true }]);
});

test('note di riposo segnano il giorno; altre note si ignorano', () => {
  const eventi = [
    { date: '2026-11-13', name: 'DIVANO', categoria: 'NOTE' }, { date: '2026-11-14', name: 'DAY OFF', categoria: 'NOTE' },
    { date: '2026-11-15', name: 'Compleanno', categoria: 'NOTE' }];
  const c = calendarioMese({ ...base, eventi });
  assert.strictEqual(giorno(c, '2026-11-13').riposo, true);
  assert.strictEqual(giorno(c, '2026-11-14').riposo, true);
  assert.strictEqual(giorno(c, '2026-11-15').riposo, false);
});

test('eventi e attivita fuori dal mese si scartano; durata assente resta null', () => {
  const c = calendarioMese({ ...base,
    eventi: [{ date: '2026-12-01', name: 'x', categoria: 'WORKOUT', type: 'Ride' }, { date: '2026-11-20', name: 'Libero', categoria: 'WORKOUT', type: 'Run', durationMin: null }],
    attivita: [{ id: 1, date: '2026-10-31', type: 'Ride', name: 'Ieri mese', durationMin: 40 }] });
  assert.strictEqual(c.giorni.reduce((n, g) => n + g.voci.length, 0), 1);
  assert.strictEqual(giorno(c, '2026-11-20').voci[0].durataMin, null);
});

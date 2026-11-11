// 11/11/2026: dettagli dell'allenamento nel calendario: zone di potenza, esercizi, durata. Puro.
const test = require('node:test');
const assert = require('node:assert');
const { calendarioMese, zoneDaDoc, eserciziDaScheda } = require('../fit-calendario.js');

const base = { mese: '2026-11', oggi: '2026-11-11', attivita: [], eventi: [], sessioni: [] };
const giorno = (c, d) => c.giorni.find(g => g.data === d);

test('zone di potenza dal documento dell allenamento: solo zone con tempo, minuti e watt', () => {
  const doc = { zoneTimes: [
    { id: 'Z1', secs: 300, minWatts: 1, maxWatts: 167 }, { id: 'Z2', secs: 3600, minWatts: 168, maxWatts: 229 },
    { id: 'Z3', secs: 0, minWatts: 230, maxWatts: 274 }, { id: 'Z7', secs: 120, minWatts: 500, maxWatts: null }] };
  assert.deepStrictEqual(zoneDaDoc(doc), [
    { zona: 'Z1', min: 5, watt: 'fino a 167 W' }, { zona: 'Z2', min: 60, watt: '168-229 W' }, { zona: 'Z7', min: 2, watt: 'oltre 500 W' }]);
  assert.strictEqual(zoneDaDoc({ steps: [] }), null);
  assert.strictEqual(zoneDaDoc(null), null);
});

test('esercizi dalla scheda del piano: nome, serie e ripetizioni; senza scheda null', () => {
  const scheda = { esercizi: [{ nome: 'Squat', serie: 2, repsTesto: '5-8', unita: 'reps' }, { nome: 'Plank', serie: 3, repsTesto: '30-45', unita: 'sec' }] };
  assert.deepStrictEqual(eserciziDaScheda(scheda), [{ nome: 'Squat', serie: 2, reps: '5-8' }, { nome: 'Plank', serie: 3, reps: '30-45 sec' }]);
  assert.strictEqual(eserciziDaScheda(null), null);
  assert.strictEqual(eserciziDaScheda({ esercizi: [] }), null);
});

test('dettagli degli eventi pianificati passano nella voce; seduta fatta porta gli esercizi svolti', () => {
  const eventi = [
    { date: '2026-11-12', name: 'Endurance', categoria: 'WORKOUT', type: 'Ride', durationMin: 90, zone: [{ zona: 'Z2', min: 75, watt: '168-229 W' }] },
    { date: '2026-11-13', name: 'Petto', categoria: 'WORKOUT', type: 'WeightTraining', durationMin: 70, esercizi: [{ nome: 'Panca', serie: 3, reps: '6-8' }] }];
  const sessioni = [{ data: '2026-11-09', seduta: 'Gambe', inizio: '2026-11-09T18:00:00', fine: '2026-11-09T18:50:00',
    esercizi: [{ nome: 'Squat', serie: [{ fatta: true, reps: 6 }, { fatta: true, reps: 6 }, { fatta: false }] }, { nome: 'Saltato', serie: [{ fatta: false }] }] }];
  const c = calendarioMese({ ...base, eventi, sessioni });
  assert.deepStrictEqual(giorno(c, '2026-11-12').voci[0].zone, [{ zona: 'Z2', min: 75, watt: '168-229 W' }]);
  assert.deepStrictEqual(giorno(c, '2026-11-13').voci[0].esercizi, [{ nome: 'Panca', serie: 3, reps: '6-8' }]);
  assert.deepStrictEqual(giorno(c, '2026-11-09').voci[0].esercizi, [{ nome: 'Squat', serie: 2 }]);
  assert.strictEqual('zone' in giorno(c, '2026-11-09').voci[0], false);
});

test('scheda di un evento [MW]: nome pulito e schema preso dalla settimana del piano', () => {
  const { schedaDiEvento } = require('../palestra-settimana.js');
  const baseName = n => String(n).replace(/\s*\(.*\)\s*$/, '');
  const schede = { 'Petto-Spalle (adattamento 2)': { seduta: 'Petto-Spalle', esercizi: [{ nome: 'Panca' }] } };
  const findDetailedWeek = () => ({ week: { days: [{ d: 'Lun', s: 'Petto-Spalle (adattamento 2)' }] } });
  const pianoPalestra = n => schede[n] || null;
  assert.deepStrictEqual(schedaDiEvento({ nomeEvento: '[MW] Petto-Spalle', lunedi: '2026-11-09', findDetailedWeek, pianoPalestra, baseName }), schede['Petto-Spalle (adattamento 2)']);
  assert.strictEqual(schedaDiEvento({ nomeEvento: '[MW] Sconosciuta', lunedi: '2026-11-09', findDetailedWeek, pianoPalestra, baseName }), null);
  assert.strictEqual(schedaDiEvento({ nomeEvento: '[MW] Petto-Spalle', lunedi: '2030-01-07', findDetailedWeek: () => null, pianoPalestra, baseName }), null);
});

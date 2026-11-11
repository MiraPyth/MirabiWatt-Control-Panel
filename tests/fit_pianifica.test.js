// 11/11/2026: pianificare un allenamento dall'app Fit: elenco dei modelli e evento intervals.icu nel formato nativo (che Garmin sincronizza).
const test = require('node:test');
const assert = require('node:assert');
const { modelliDisponibili, eventoNuovo, testoLibero, UID_APP } = require('../fit-pianifica.js');

const dettagli = {
  EnduranceCorto: { label: 'Endurance corto', totalMin: 90, icuText: 'Warmup\n- 10m 50-60%\n\n- 75m 56-75%\n\nCooldown\n- 5m 40-50%' },
  'Test Riposo': { label: 'Riposo', totalMin: 0, icuText: null, isRest: true },
  'Uscita a pranzo': { label: 'Uscita a pranzo', totalMin: 45, icuText: null, plainDescription: 'Uscita libera' },
  'Petto-Spalle (adattamento 2)': { label: 'Petto-Spalle', totalMin: 70, palestra: true, plainDescription: 'Spinta: petto e spalle.' },
};
const libreria = { EnduranceCorto: 1, 'Test Riposo': 1, 'Uscita a pranzo': 1, 'Petto-Spalle': 1, Sconosciuta: 1 };
const getDetail = nome => dettagli[nome] || { label: nome, totalMin: null, icuText: null };
const pianoPalestra = nome => (nome === 'Petto-Spalle (adattamento 2)' ? { seduta: 'Petto-Spalle' } : null);
const base = { libreria, sedutePalestra: ['Petto-Spalle', 'Gambe-Core'], schemaPalestra: 'adattamento 2', getDetail, pianoPalestra, ftp: 305, cp: 275 };

test('modelli: ciclismo solo con testo strutturato, palestra solo con scheda nel piano corrente', () => {
  const m = modelliDisponibili(base);
  assert.deepStrictEqual(m.ciclismo, [{ id: 'EnduranceCorto', nome: 'Endurance corto', durataMin: 90 }]);
  assert.deepStrictEqual(m.palestra, [{ id: 'Petto-Spalle', nome: 'Petto-Spalle', durataMin: 70 }]);
});

test('ciclismo da modello: evento WORKOUT Ride con il testo nativo, sigla [MW], uid dell app unico', () => {
  const e = eventoNuovo({ ...base, data: '2026-11-20', sport: 'ciclismo', modello: 'EnduranceCorto', casuale: () => 'abc123' });
  assert.strictEqual(e.category, 'WORKOUT');
  assert.strictEqual(e.type, 'Ride');
  assert.strictEqual(e.start_date_local, '2026-11-20T00:00:00');
  assert.strictEqual(e.name, '[MW] EnduranceCorto');
  assert.strictEqual(e.description, dettagli.EnduranceCorto.icuText);
  assert.ok(e.external_id.startsWith(UID_APP) && e.external_id.includes('2026-11-20') && e.external_id.endsWith('abc123'));
  assert.strictEqual('uid' in e, false);
});

test('palestra da modello: WeightTraining con durata e descrizione della seduta', () => {
  const e = eventoNuovo({ ...base, data: '2026-11-21', sport: 'palestra', modello: 'Petto-Spalle', casuale: () => 'x' });
  assert.strictEqual(e.type, 'WeightTraining');
  assert.strictEqual(e.name, '[MW] Petto-Spalle');
  assert.strictEqual(e.moving_time, 70 * 60);
  assert.strictEqual(e.description, 'Spinta: petto e spalle.');
  assert.strictEqual(e.indoor, true);
});

test('corsa e nuoto liberi: testo nativo con zona di passo, riscaldamento e defaticamento sopra i 30 minuti', () => {
  assert.strictEqual(testoLibero({ durataMin: 45, zona: 2 }), 'Warmup\n- 10m Z1 Pace\n\n- 30m Z2 Pace\n\nCooldown\n- 5m Z1 Pace');
  assert.strictEqual(testoLibero({ durataMin: 20, zona: 3 }), '- 20m Z3 Pace');
  const e = eventoNuovo({ ...base, data: '2026-11-22', sport: 'corsa', libero: { nome: 'Corsa facile', durataMin: 45, zona: 2 }, casuale: () => 'y' });
  assert.strictEqual(e.type, 'Run');
  assert.strictEqual(e.name, '[MW] Corsa facile');
  assert.strictEqual(e.moving_time, 45 * 60);
  assert.strictEqual(e.description, 'Warmup\n- 10m Z1 Pace\n\n- 30m Z2 Pace\n\nCooldown\n- 5m Z1 Pace');
  const n = eventoNuovo({ ...base, data: '2026-11-22', sport: 'nuoto', libero: { nome: 'Nuoto', durataMin: 30, zona: 2 }, casuale: () => 'z' });
  assert.strictEqual(n.type, 'Swim');
});

test('input non valido: data, sport, modello, durata e zona fuori misura vengono rifiutati con messaggio chiaro', () => {
  const r = i => () => eventoNuovo({ ...base, data: '2026-11-20', sport: 'ciclismo', modello: 'EnduranceCorto', casuale: () => 'a', ...i });
  assert.throws(r({ data: '20/11/2026' }), /data/i);
  assert.throws(r({ data: '2026-13-45' }), /data/i);
  assert.throws(r({ sport: 'golf' }), /sport/i);
  assert.throws(r({ modello: 'Sconosciuta' }), /modello/i);
  assert.throws(r({ sport: 'palestra', modello: 'Gambe-Core' }), /modello/i);
  assert.throws(r({ sport: 'corsa', libero: { nome: 'x', durataMin: 0, zona: 2 } }), /durata/i);
  assert.throws(r({ sport: 'corsa', libero: { nome: 'x', durataMin: 600, zona: 2 } }), /durata/i);
  assert.throws(r({ sport: 'corsa', libero: { nome: 'x', durataMin: 30, zona: 9 } }), /zona/i);
  assert.throws(r({ sport: 'corsa', libero: { nome: '   ', durataMin: 30, zona: 2 } }), /nome/i);
  assert.throws(r({ sport: 'corsa' }), /libero/i);
});

test('il nome libero e ripulito: niente sigle doppie, niente a capo, lunghezza limitata', () => {
  const e = eventoNuovo({ ...base, data: '2026-11-22', sport: 'corsa', libero: { nome: '[MW]  Corsa\nlunga ' + 'x'.repeat(200), durataMin: 40, zona: 2 }, casuale: () => 'k' });
  assert.ok(e.name.startsWith('[MW] Corsa lunga'));
  assert.ok(e.name.length <= 80);
  assert.ok(!/\n/.test(e.name));
});

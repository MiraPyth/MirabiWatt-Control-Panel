// Attrezzatura (13/10/2026): bici, componenti e promemoria di manutenzione da intervals.icu (che li sincronizza da Strava).
const test = require('node:test');
const assert = require('node:assert');
const Gear = require('../attrezzatura.js');

const P = (nome, kmSoglia, percento, kmUsati, extra = {}) => ({ id: 1, nome, kmSoglia, giorniSoglia: 0, oreSoglia: 0, attivitaSoglia: 0, percento, kmUsati, giorniUsati: 100, dal: '2026-02-05', ...extra });
const C = (id, tipo, nome, km, extra = {}) => ({ id, tipo, nome, km, ore: Math.round(km / 30), attivita: Math.round(km / 60), acquisto: '2026-02-05', ritiro: null, componente: true, componenti: null, virtuale: false, promemoria: [], ...extra });
const DATI = {
  kmRecenti: { b1: 420, b2: 60 },
  gear: [
    { ...C('b1', 'Bike', 'La bici', 52761), componente: false, componenti: ['c1', 'c2', 'c3', 'c4', 'h10'] },
    { ...C('b2', 'Bike', 'Speciale su Zwift Hub', 7722), componente: false, componenti: ['h10'], virtuale: true },
    { ...C('b0', 'Bike', 'Vecchia', 900), componente: false, ritiro: '2025-01-01' },
    { ...C('s1', 'Shoes', 'ASICS Nimbus', 227), componente: false, componenti: ['h10'] },
    C('c1', 'Chain', 'SRAM chain', 7706, { promemoria: [P('Check consumo', 7000, 110.08, 7706)] }),
    C('c2', 'Tyre', 'GP 5000', 7706, { promemoria: [P('Invertire', 2500, 153.2, 3831)] }),
    C('c3', 'BrakePads', 'Pastiglie front', 2712, { promemoria: [P('Controllo', 1500, 85, 1275)] }),
    C('c4', 'Cassette', 'Pacco 10-36', 24377),
    C('h10', 'Battery', 'Polar H10', 8507),
    C('sella', 'Saddle', 'S-Works Power', 0, { acquisto: '2026-06-13' }),
    C('v1', 'Chain', 'SRAM chain', 7027, { acquisto: '2023-12-24', ritiro: '2024-05-05' }),
    C('v2', 'Chain', 'SRAM chain', 3634, { acquisto: '2024-05-05', ritiro: '2024-07-04' }),
    C('v3', 'Tyre', 'Vittoria Corsa', 4656, { acquisto: '2023-11-02', ritiro: '2025-03-08' }),
  ],
};

test('stato del promemoria: ok sotto l\'80%, presto fino al 100%, scaduto oltre', () => {
  assert.deepStrictEqual([0, 79.9, 80, 99.9, 100, 180].map(Gear.stato), ['ok', 'ok', 'presto', 'presto', 'scaduto', 'scaduto']);
});

test('nomi dei tipi in italiano', () => {
  assert.strictEqual(Gear.tipo('Chain'), 'Catena');
  assert.strictEqual(Gear.tipo('BrakePads'), 'Pastiglie');
  assert.strictEqual(Gear.tipo('Tyre'), 'Copertoni');
  assert.strictEqual(Gear.tipo('Sconosciuto'), 'Sconosciuto');
});

test('vista: bici attive con i componenti montati, ordinate per uso recente', () => {
  const v = Gear.vista(DATI);
  assert.deepStrictEqual(v.bici.map(b => b.id), ['b1', 'b2']);
  const b = v.bici[0];
  assert.strictEqual(b.kmSettimana, 70, '420 km in 6 settimane');
  assert.deepStrictEqual(b.componenti.map(c => c.id), ['c2', 'c1', 'c3', 'c4', 'h10'], 'prima i più urgenti');
  assert.ok(v.bici[1].virtuale);
  assert.deepStrictEqual(v.ritirate.map(b => b.id), ['b0']);
  assert.deepStrictEqual(v.altra.map(b => b.id), ['s1']);
  assert.deepStrictEqual(v.nonMontati.map(c => c.id), ['sella']);
});

test('promemoria: km mancanti e settimane stimate con il ritmo della bici', () => {
  const v = Gear.vista(DATI);
  const pastiglie = v.bici[0].componenti.find(c => c.id === 'c3').promemoria[0];
  assert.strictEqual(pastiglie.stato, 'presto');
  assert.strictEqual(pastiglie.kmMancanti, 225);
  assert.strictEqual(pastiglie.settimane, 3, '225 km a 70 km/settimana');
  const catena = v.bici[0].componenti.find(c => c.id === 'c1').promemoria[0];
  assert.strictEqual(catena.stato, 'scaduto');
  assert.strictEqual(catena.kmMancanti, -706);
  assert.strictEqual(catena.settimane, 0);
});

test('avvisi: solo presto e scaduto, dal più urgente, con la bici di appartenenza', () => {
  const v = Gear.vista(DATI);
  assert.deepStrictEqual(v.avvisi.map(a => [a.componente.id, a.stato, a.bici]), [['c2', 'scaduto', 'La bici'], ['c1', 'scaduto', 'La bici'], ['c3', 'presto', 'La bici']]);
});

test('storico: sostituzioni per tipo con la durata media e il confronto del pezzo montato', () => {
  const v = Gear.vista(DATI);
  const catene = v.storico.find(s => s.tipo === 'Chain');
  assert.strictEqual(catene.pezzi.length, 2);
  assert.strictEqual(catene.kmMedi, 5331);
  assert.strictEqual(catene.attivo.id, 'c1');
  assert.strictEqual(catene.vitaUsata, 145, 'la catena montata ha già fatto il 145% della media');
  const comp = v.bici[0].componenti.find(c => c.id === 'c1');
  assert.strictEqual(comp.kmMediTipo, 5331);
  assert.ok(!v.storico.some(s => s.tipo === 'Cassette'), 'senza sostituzioni niente storico');
});

test('storico: niente durata media per pezzi che non si consumano o con una sola sostituzione', () => {
  const d = { gear: DATI.gear.concat([C('w1', 'Wheelset', 'DT Swiss Winter', 1261, { ritiro: '2025-03-08' }), C('w2', 'Wheelset', 'Elite 45', 32342),
    C('bt1', 'Battery', 'Leva DX', 10899, { ritiro: '2025-01-23' }), C('bt2', 'Battery', 'Leva SX', 29142, { ritiro: '2025-09-09' })]) };
  const v = Gear.vista(d);
  const ruote = v.storico.find(s => s.tipo === 'Wheelset'), batterie = v.storico.find(s => s.tipo === 'Battery');
  assert.deepStrictEqual([ruote.pezzi.length, ruote.kmMedi, ruote.vitaUsata], [1, null, null]);
  assert.deepStrictEqual([batterie.pezzi.length, batterie.kmMedi], [2, null]);
  assert.strictEqual(v.storico.find(s => s.tipo === 'Tyre').kmMedi, null, 'un solo copertone ritirato');
});

test('vista con dati vuoti o mancanti non si rompe', () => {
  const v = Gear.vista({});
  assert.deepStrictEqual([v.bici.length, v.avvisi.length, v.storico.length], [0, 0, 0]);
});

// MirabiWatt Palestra · settimana e nutrizione: logica pura (04/11/2026).
const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/js/giornata.js');

test('minuti: ore, minuti e intervalli (si prende la parte bassa)', () => {
  assert.strictEqual(G.minuti("50'"), 50);
  assert.strictEqual(G.minuti('1h15'), 75);
  assert.strictEqual(G.minuti('2h30'), 150);
  assert.strictEqual(G.minuti("60-75'"), 60);
  assert.strictEqual(G.minuti(''), 0);
  assert.strictEqual(G.minuti(undefined), 0);
});

test('tipo di giornata per la nutrizione, come nel pannello MirabiWatt', () => {
  assert.strictEqual(G.tipo({ nome: 'Riposo', riposo: true }), 'riposo');
  assert.strictEqual(G.tipo({ nome: 'Gambe-Core', zona: 'Palestra', dur: "50'" }), 'palestra');
  assert.strictEqual(G.tipo({ nome: 'Zwift Race', zona: 'HIT', dur: "60-75'" }), 'hit');
  assert.strictEqual(G.tipo({ nome: 'EnduranceLungo', zona: 'Z2', dur: '2h30' }), 'lungo');
  assert.strictEqual(G.tipo({ nome: 'EnduranceCorto', zona: 'Z2', dur: '1h15' }), 'endurance');
  assert.strictEqual(G.tipo(null), 'riposo');
});

test('genere: palestra, bici o riposo', () => {
  assert.strictEqual(G.genere({ zona: 'Palestra' }), 'palestra');
  assert.strictEqual(G.genere({ riposo: true }), 'riposo');
  assert.strictEqual(G.genere({ zona: 'Z2', dur: '1h15' }), 'bici');
});

test('stato del giorno rispetto a oggi', () => {
  assert.strictEqual(G.stato({ data: '2026-11-03' }, '2026-11-04'), 'passato');
  assert.strictEqual(G.stato({ data: '2026-11-04' }, '2026-11-04'), 'oggi');
  assert.strictEqual(G.stato({ data: '2026-11-05' }, '2026-11-04'), 'futuro');
});

test('giorni alla gara', () => {
  assert.strictEqual(G.giorniA('2027-03-14', '2026-11-04'), 130);
  assert.strictEqual(G.giorniA('2026-11-04', '2026-11-04'), 0);
});

test('nutrizione di una giornata: target e pasti arrotondati, senza lineette', () => {
  const finta = () => ({ target: { kcal: 2942.4, p: 165, c: 386, fat: 82 }, perche: 'Perche', consigli: { acquaL: 3.6 },
    pasti: [{ nome: 'Colazione', kcal: 875.2, p: 35.3, c: 130.6, fat: 23.4, cibi: [{ label: 'Uova intere', grams: 148.4 }], nota: null }] });
  const n = G.nutrizione({ nome: 'Gambe-Core', zona: 'Palestra', dur: "50'" }, 82.5, 'mantenimento', finta);
  assert.strictEqual(n.tipo, 'palestra');
  assert.strictEqual(n.kcal, 2942);
  assert.strictEqual(n.acquaL, 3.6);
  assert.deepStrictEqual(n.pasti[0], { nome: 'Colazione', kcal: 875, p: 35, c: 131, fat: 23, cibi: [{ label: 'Uova intere', grammi: 148 }], nota: null });
});

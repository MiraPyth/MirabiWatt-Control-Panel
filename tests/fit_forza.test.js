// 11/11/2026: «Forza» per Analytics: per ogni esercizio il massimo sollevato, l'andamento seduta per seduta e il massimale stimato. Puro.
const test = require('node:test');
const assert = require('node:assert');
const { forza, stimaMassimale, CARDINE } = require('../fit-forza.js');

const catalogo = {
  'panca-piana-manubri': { nome: 'Panca piana con manubri', attrezzo: 'manubri', gruppo: 'petto' },
  'squat-bilanciere': { nome: 'Squat con bilanciere', attrezzo: 'bilanciere', gruppo: 'quadricipiti e glutei' },
  'crunch-cavi': { nome: 'Crunch ai cavi', attrezzo: 'cavo', gruppo: 'addome' },
  'hanging-knee-raise': { nome: 'Hanging leg raise', attrezzo: 'corpo', gruppo: 'addome' },
};
const sess = (data, esercizi) => ({ id: data, data, seduta: 'S', esercizi });
const es = (id, serie, extra = {}) => ({ id, nome: catalogo[id] ? catalogo[id].nome : id, serie: serie.map(([kg, reps, fatta = true]) => ({ kg, reps, fatta })), ...extra });
const trova = (r, id) => [...r.cardine, ...r.altri].find(x => x.id === id);

test('massimale stimato (Epley) solo fino a 12 ripetizioni, mai inventato', () => {
  assert.strictEqual(stimaMassimale(100, 5), 116.7);
  assert.strictEqual(stimaMassimale(20, 1), 20.7);
  assert.strictEqual(stimaMassimale(20, 15), null);
  assert.strictEqual(stimaMassimale(null, 8), null);
  assert.strictEqual(stimaMassimale(0, 8), null);
});

test('panca: massimo di sempre, andamento per seduta (miglior serie) e numero di volte', () => {
  const r = forza({ catalogo, sessioni: [
    sess('2026-11-02', [es('panca-piana-manubri', [[14, 6], [14, 6]])]),
    sess('2026-11-11', [es('panca-piana-manubri', [[18, 6], [22, 6], [24, 4, false]])]),
  ] });
  const p = trova(r, 'panca-piana-manubri');
  assert.deepStrictEqual(p.massimo, { kg: 22, reps: 6, data: '2026-11-11' });
  assert.deepStrictEqual(p.sessioni.map(x => [x.data, x.kg, x.reps]), [['2026-11-02', 14, 6], ['2026-11-11', 22, 6]]);
  assert.strictEqual(p.volte, 2);
  assert.strictEqual(p.e1rm, 26.4);                                     // 22 x (1 + 6/30)
  assert.strictEqual(p.unita, 'kg per manubrio');
  assert.strictEqual(p.nome, 'Panca piana con manubri');
});

test('a parita di peso conta la serie con piu ripetizioni; le serie non fatte non contano', () => {
  const r = forza({ catalogo, sessioni: [sess('2026-11-02', [es('panca-piana-manubri', [[20, 5], [20, 8], [30, 3, false]])])] });
  assert.deepStrictEqual(trova(r, 'panca-piana-manubri').massimo, { kg: 20, reps: 8, data: '2026-11-02' });
});

test('bilanciere: si aggiunge la barra salvata e lo si dice; senza barra salvata i kg restano com erano', () => {
  const r = forza({ catalogo, sessioni: [
    sess('2026-11-04', [es('squat-bilanciere', [[40, 5]])]),
    sess('2026-11-11', [es('squat-bilanciere', [[40, 5]], { barra: 20 })]),
  ] });
  const s = trova(r, 'squat-bilanciere');
  assert.deepStrictEqual(s.sessioni.map(x => x.kg), [40, 60]);
  assert.strictEqual(s.massimo.kg, 60);
  assert.match(s.unita, /barra compresa/);
});

test('esercizi senza peso (corpo libero, kg nullo o zero) non compaiono; cardine prima, gli altri dopo', () => {
  const r = forza({ catalogo, sessioni: [sess('2026-11-02', [
    es('hanging-knee-raise', [[null, 10]]), es('crunch-cavi', [[29, 15]]), es('panca-piana-manubri', [[14, 6]]), es('pallof', [[0, 10]])]) ] });
  assert.ok(!trova(r, 'hanging-knee-raise'));
  assert.ok(!trova(r, 'pallof'));
  assert.deepStrictEqual(r.cardine.map(x => x.id), ['panca-piana-manubri']);
  assert.deepStrictEqual(r.altri.map(x => x.id), ['crunch-cavi']);
});

test('esercizio non in catalogo: usa il nome salvato nella seduta; nessuna seduta: elenchi vuoti', () => {
  const r = forza({ catalogo, sessioni: [sess('2026-11-02', [{ id: 'nuovo', nome: 'Esercizio nuovo', serie: [{ kg: 10, reps: 8, fatta: true }] }])] });
  assert.strictEqual(trova(r, 'nuovo').nome, 'Esercizio nuovo');
  assert.strictEqual(trova(r, 'nuovo').unita, 'kg');
  assert.deepStrictEqual(forza({ catalogo, sessioni: [] }), { cardine: [], altri: [] });
});

test('gli esercizi cardine sono una lista fissa e ordinata, con panca e squat', () => {
  assert.ok(CARDINE.includes('panca-piana-manubri') && CARDINE.includes('squat-bilanciere'));
  assert.strictEqual(new Set(CARDINE).size, CARDINE.length);
});

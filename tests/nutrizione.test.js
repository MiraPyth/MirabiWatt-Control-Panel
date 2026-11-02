// Piano nutrizionale del giorno (13/10/2026): un'unica funzione per la pagina Nutrizione e lo specchietto in Oggi.
const test = require('node:test');
const assert = require('node:assert');
const N = require('../nutrition-library.js');

// 19/10/2026 sera: nutrizione per fase e per giorno (The Muscle and Strength Pyramid: Nutrition; Iraki 2019; Murphy &
// Koehler 2022; IOC RED-S). Mantenimento stimato = 30 kcal/kg + la seduta del giorno; costruzione +100/+200 kcal,
// definizione ~−500 nei giorni di palestra e riposo ma quasi niente sotto i giorni di bici.
const W = 81;
test('proteine e grassi per fase: costruzione 2,0 g/kg e 25%, definizione 2,4 g/kg e 20%, grassi mai sotto 0,5 g/kg', () => {
  const c = N.pianoNutrizione('palestra', W, { fase: 'costruzione' }), d = N.pianoNutrizione('palestra', W, { fase: 'definizione' });
  assert.strictEqual(c.target.p, 162);
  assert.strictEqual(d.target.p, Math.round(2.4 * W));
  assert.ok(Math.abs(c.target.fat * 9 / c.target.kcal - 0.25) < 0.02);
  assert.ok(Math.abs(d.target.fat * 9 / d.target.kcal - 0.20) < 0.02);
  assert.ok(d.target.fat >= 0.5 * W && d.target.c >= 1 * W);
  assert.strictEqual(c.target.kcal, N.kcalOf(c.target));
});

test('calorie: mantenimento + seduta; surplus piccolo in costruzione, deficit dove non c\'è la bici in definizione', () => {
  const m = t => N.pianoNutrizione(t, W, { fase: 'mantenimento' }).target.kcal;
  assert.ok(Math.abs(m('riposo') - 30 * W) <= 10, 'riposo = 30 kcal/kg');
  assert.ok(m('riposo') < m('palestra') && m('palestra') < m('endurance') && m('endurance') < m('lungo'));
  const diff = (t, f) => N.pianoNutrizione(t, W, { fase: f }).target.kcal - m(t);
  for (const t of ['riposo', 'palestra', 'hit', 'lungo']) { const x = diff(t, 'costruzione'); assert.ok(x >= 90 && x <= 210, `costruzione ${t}: ${x}`); }
  assert.ok(diff('riposo', 'definizione') <= -400 && diff('riposo', 'definizione') >= -510);
  assert.ok(diff('palestra', 'definizione') <= -400);
  assert.ok(diff('lungo', 'definizione') >= -200, 'mai un deficit grosso sotto il lungo (RED-S)');
  assert.ok(diff('hit', 'definizione') >= -200);
});

test('i pasti arrivano al bersaglio: carboidrati e proteine entro il 10%', () => {
  for (const t of ['riposo', 'palestra', 'endurance', 'hit', 'lungo']) for (const f of ['mantenimento', 'costruzione', 'definizione']) {
    const n = N.pianoNutrizione(t, W, { fase: f });
    assert.ok(Math.abs(n.totale.c - n.target.c) <= n.target.c * 0.1, `${t} ${f}: C ${n.totale.c} vs ${n.target.c}`);
    assert.ok(Math.abs(n.totale.p - n.target.p) <= n.target.p * 0.1, `${t} ${f}: P ${n.totale.p} vs ${n.target.p}`);
    for (const p of n.pasti) { assert.ok(p.kcal > 0 && p.cibi.every(c => c.label && c.grams > 0)); assert.strictEqual(p.kcal, N.kcalOf(p)); }
  }
  assert.ok(N.pianoNutrizione('lungo', W).pasti.find(p => /Durante/.test(p.nome)).nota, 'carboidrati durante il lungo');
  assert.ok(!N.pianoNutrizione('palestra', W).pasti.some(p => /Durante/.test(p.nome)), 'in palestra niente maltodestrine');
});

test('acqua, frutta, verdura e integratori dalla Pyramid', () => {
  const n = N.pianoNutrizione('palestra', W, { fase: 'costruzione' });
  assert.strictEqual(n.consigli.acquaL, 3.5, '1 L ogni 23 kg');
  assert.strictEqual(n.consigli.frutta, Math.ceil(n.target.kcal / 1000));
  assert.strictEqual(n.consigli.verdura, Math.ceil(n.target.kcal / 1000));
  const nomi = n.consigli.integratori.map(i => i.nome);
  for (const x of ['Creatina monoidrato', 'Vitamina D3', 'Omega-3 (EPA+DHA)']) assert.ok(nomi.includes(x), x);
  assert.match(n.consigli.integratori.find(i => i.nome === 'Creatina monoidrato').dose, /3 g/);
  assert.ok(N.pianoNutrizione('lungo', W).consigli.acquaL > n.consigli.acquaL, 'più acqua nei giorni di bici');
});

test('il perché della fase', () => {
  for (const f of ['mantenimento', 'costruzione', 'definizione']) assert.ok(N.pianoNutrizione('riposo', W, { fase: f }).perche.length > 60, f);
});

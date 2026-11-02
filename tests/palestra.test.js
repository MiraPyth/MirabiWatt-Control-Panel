// Schede di palestra del piano «mixed body building» — scheda 2 (19/10/2026 sera), dopo «The Muscle and Strength
// Pyramid: Training» (Helms) e «Scientific Principles of Hypertrophy Training» (RP). Priorità: spalle, petto, bicipiti,
// addome con specializzazione (~1,5× volume); mesociclo RIR 3 → 0-1 con serie in più sui prioritari, poi scarico;
// gambe pesanti e mai sotto RIR 2 (c'è la bici). Lo schema è tra parentesi nel nome della seduta.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { getWorkoutDetail, pianoPalestra, ESERCIZI_PALESTRA } = require('../workout-library.js');

const SEDUTE = ['Petto-Spalle', 'Gambe-Core', 'Schiena-Bicipiti'];
const settimana = schema => SEDUTE.flatMap(s => pianoPalestra(`${s} (${schema})`).esercizi);
const serieDi = (schema, gruppo) => settimana(schema).filter(e => e.gruppo.startsWith(gruppo)).reduce((t, e) => t + e.serie, 0);

test('specializzazione: gruppi prioritari 14-18 serie a fine mesociclo, gambe moderate', () => {
  for (const g of ['petto', 'spalle', 'addome']) {
    assert.ok(serieDi('costruzione 1', g) >= 11, `${g} a inizio mesociclo`);
    const fine = serieDi('costruzione 4', g);
    assert.ok(fine >= 14 && fine <= 20, `${g}: ${fine}`);
  }
  assert.ok(serieDi('costruzione 4', 'bicipiti') >= 9, 'bicipiti diretti, più le tirate');
  const gambe = ['quadricipiti', 'femorali'].reduce((t, g) => t + serieDi('costruzione 4', g), 0);
  assert.ok(gambe <= 12, `gambe ${gambe}: c'è già la bici`);
});

test('frequenza: petto 2, spalle laterali 3, bicipiti 2, addome 3 volte a settimana', () => {
  const volte = g => SEDUTE.filter(s => pianoPalestra(`${s} (costruzione 1)`).esercizi.some(e => e.gruppo.startsWith(g))).length;
  assert.strictEqual(volte('petto'), 2);
  assert.strictEqual(SEDUTE.filter(s => pianoPalestra(`${s} (costruzione 1)`).esercizi.some(e => /deltoide laterale/.test(e.gruppo))).length, 3);
  assert.strictEqual(volte('bicipiti'), 2);
  assert.strictEqual(volte('addome'), 3);
});

test('mesociclo: RIR che scende, serie in più sui prioritari, poi scarico', () => {
  const rir = s => pianoPalestra(`Petto-Spalle (${s})`).esercizi.find(e => e.id === 'croci-cavi').rir;
  assert.deepStrictEqual(['costruzione 1', 'costruzione 2', 'costruzione 3', 'costruzione 4'].map(rir), ['3', '2', '1-2', '0-1']);
  const croci = s => pianoPalestra(`Petto-Spalle (${s})`).esercizi.find(e => e.id === 'croci-cavi').serie;
  const push = s => pianoPalestra(`Petto-Spalle (${s})`).esercizi.find(e => e.id === 'pushdown-corda').serie;
  assert.strictEqual(croci('costruzione 4'), croci('costruzione 1') + 1, 'prioritario: +1');
  assert.strictEqual(push('costruzione 4'), push('costruzione 1'), 'non prioritario: uguale');
  const tot = s => settimana(s).reduce((t, e) => t + e.serie, 0);
  assert.ok(tot('scarico') <= tot('costruzione 4') / 2 + 2, 'scarico: circa metà delle serie');
  assert.strictEqual(pianoPalestra('Petto-Spalle (scarico)').esercizi[0].rir, '4');
});

test('gambe pesanti mai sotto RIR 2, multiarticolari della parte alta mai a cedimento', () => {
  for (const e of pianoPalestra('Gambe-Core (costruzione 4)').esercizi.filter(e => e.tipo === 'gambe')) assert.strictEqual(e.rir, '2-3', e.nome);
  for (const e of pianoPalestra('Petto-Spalle (costruzione 4)').esercizi.filter(e => e.tipo === 'composto')) assert.strictEqual(e.rir, '1', e.nome);
  const squat = pianoPalestra('Gambe-Core (costruzione 1)').esercizi.find(e => e.id === 'squat-bilanciere');
  assert.ok(squat.reps[1] <= 8, 'forza per la bici: 4-8 ripetizioni (Mujika 2016)');
});

test('definizione: stessi carichi, meno serie sui non prioritari', () => {
  const p = s => pianoPalestra(`Schiena-Bicipiti (${s})`).esercizi;
  const def = p('definizione 1'), cos = p('costruzione 1');
  for (let i = 0; i < def.length; i++) assert.strictEqual(def[i].serie, cos[i].prio ? cos[i].serie : Math.max(1, cos[i].serie - 1), def[i].nome);
});

// La durata non ha un tetto imposto (l'utente, 19/10 sera): il limite è quello della Pyramid, non più di ~11 serie per
// lo stesso muscolo nella stessa seduta (oltre, meglio distribuire su più giorni).
test('al massimo ~11 serie per muscolo nella stessa seduta; scarico molto più corto', () => {
  for (const s of SEDUTE) for (const sch of ['adattamento 1', 'costruzione 1', 'costruzione 4', 'definizione 2']) {
    const perGruppo = {};
    for (const e of pianoPalestra(`${s} (${sch})`).esercizi) { const g = e.gruppo.split(/[ ,]/)[0]; perGruppo[g] = (perGruppo[g] || 0) + e.serie; }
    for (const [g, n] of Object.entries(perGruppo)) assert.ok(n <= 11, `${s} ${sch}: ${g} ${n} serie`);
    assert.ok(getWorkoutDetail(`${s} (${sch})`, 300, 280).totalMin >= 40);
  }
  assert.ok(getWorkoutDetail('Petto-Spalle (scarico)', 300, 280).totalMin < getWorkoutDetail('Petto-Spalle (costruzione 4)', 300, 280).totalMin * 0.7);
});

test('ogni esercizio e ogni seduta dicono perché', () => {
  for (const [seduta, lista] of Object.entries(ESERCIZI_PALESTRA)) {
    const d = getWorkoutDetail(`${seduta} (costruzione 2)`, 300, 280);
    assert.ok(d.scopo && d.scopo.length > 40, `${seduta}: scopo`);
    assert.ok(d.perche && d.perche.length > 40, `${seduta}: perché della settimana`);
    for (const e of lista) {
      assert.ok(e.perche && e.perche.length > 40, `${e.nome}: perché`);
      assert.ok(['composto', 'gambe', 'iso'].includes(e.tipo), `${e.nome}: tipo`);
      assert.ok(fs.statSync(path.join(__dirname, '..', 'palestra-gif', `${e.gif}.gif`)).size > 1000, `${e.nome}: GIF`);
      assert.ok(e.consigli && e.consigli.length >= 2, `${e.nome}: consigli`);
    }
  }
});

test('recuperi: 2-3\' sui multiarticolari, 90" sugli isolamenti (Pyramid liv. 5)', () => {
  const p = pianoPalestra('Gambe-Core (costruzione 1)').esercizi;
  assert.strictEqual(p.find(e => e.id === 'squat-bilanciere').recSec, 180);
  assert.strictEqual(p.find(e => e.id === 'leg-extension').recSec, 90);
});

test('descrizione per intervals.icu: scopo, perché ed esercizi', () => {
  const d = getWorkoutDetail('Schiena-Bicipiti (adattamento 2)', 300, 280);
  assert.strictEqual(d.palestra, true);
  assert.strictEqual(d.icuText, null);
  assert.match(d.plainDescription, /Perché:/);
  for (const s of d.uiSteps.slice(1)) assert.ok(d.plainDescription.includes(s.text.split(' — ')[0]), s.text);
});

test('ridotta dal Piano B e vecchi nomi delle schede: stessa scheda', () => {
  assert.deepStrictEqual(getWorkoutDetail('Gambe-Core (costruzione 3) (ridotta)', 300, 280).uiSteps, getWorkoutDetail('Gambe-Core (costruzione 3)', 300, 280).uiSteps);
  assert.deepStrictEqual(getWorkoutDetail('Gambe-Core (ipertrofia)', 300, 280).uiSteps, getWorkoutDetail('Gambe-Core (costruzione 2)', 300, 280).uiSteps);
});

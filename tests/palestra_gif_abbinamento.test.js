// 11/11/2026: abbinamento GIF-esercizio. «Lat machine» mostrava un uomo ai cavi (ExerciseDB LEprlgG, "cable lat pulldown full range of motion",
// girata su un telaio a croci) invece della macchina. Il catalogo palestra-gif-nomi.json dice cosa mostra davvero ogni GIF (nome ExerciseDB).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ESERCIZI_PALESTRA } = require('../workout-library.js');
const nomi = require('../palestra-gif-nomi.json');

const esercizi = new Map();
for (const lista of Object.values(ESERCIZI_PALESTRA)) for (const e of lista) esercizi.set(e.id, e);

// Cosa deve far vedere la GIF di un esercizio (parole del nome ExerciseDB). Solo dove l'attrezzo o il gesto contano.
const ATTESO = {
  'lat-machine': /machine .*pulldown/i,
  'pulldown-braccia-tese': /straight arm pulldown/i,
  'croci-cavi': /fly/i,
  'chest-press-macchina': /machine chest press/i,
  'leg-extension': /leg extension/i,
  'leg-curl-seduto': /seated leg curl/i,
  'curl-martello': /hammer curl/i,
  'alzate-laterali-manubri': /dumbbell lateral raise/i,
  'alzate-laterali-cavi': /cable lateral raise/i,
};

test('ogni esercizio ha una GIF che esiste come file e che il catalogo sa nominare', () => {
  for (const e of esercizi.values()) {
    assert.ok(e.gif, `${e.id}: manca la gif`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'palestra-gif', `${e.gif}.gif`)), `${e.id}: file ${e.gif}.gif mancante`);
    assert.ok(nomi[e.gif], `${e.id}: ${e.gif} non e' nel catalogo dei nomi`);
  }
});

test('la GIF mostra l esercizio giusto (nome ExerciseDB dell id)', () => {
  for (const [id, re] of Object.entries(ATTESO)) {
    const e = esercizi.get(id);
    assert.ok(e, `${id} non esiste piu' nella libreria`);
    assert.match(nomi[e.gif], re, `${id}: la GIF ${e.gif} mostra «${nomi[e.gif]}»`);
  }
});

test('due esercizi diversi non condividono la stessa GIF, salvo il Pallof (con e senza elastico)', () => {
  const per = {};
  for (const e of esercizi.values()) (per[e.gif] = per[e.gif] || []).push(e.id);
  const doppi = Object.values(per).filter(v => v.length > 1).map(v => v.sort().join('+'));
  assert.deepStrictEqual(doppi, ['el-pallof+pallof-press']);
});

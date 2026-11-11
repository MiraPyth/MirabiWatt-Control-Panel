// 11/11/2026: il volume di una seduta sul bilanciere conta anche la barra (le righe salvate hanno solo i dischi). Server: salvataggio e traguardi.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../palestra-store.js');
const T = require('../fit-traguardi.js');

const sessione = (barra) => ({
  id: 's1', data: '2026-11-11', seduta: 'Gambe-Core', inizio: '2026-11-11T18:00:00Z', fine: '2026-11-11T18:50:00Z',
  esercizi: [
    { id: 'squat-bilanciere', nome: 'Squat', ...(barra === undefined ? {} : { barra }), serie: [{ kg: 10, reps: 10, fatta: true }, { kg: 10, reps: 10, fatta: false }] },
    { id: 'panca-piana-manubri', nome: 'Panca', serie: [{ kg: 14, reps: 8, fatta: true }] },
  ],
});

test('il salvataggio conserva la barra dell esercizio (e solo se valida)', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mw-barra-')), 'storico.json');
  store.salva(sessione(20), file);
  const salvata = store.trova('s1', file);
  assert.strictEqual(salvata.esercizi[0].barra, 20);
  assert.strictEqual('barra' in salvata.esercizi[1], false);
  store.salva({ ...sessione(900), id: 's2' }, file);
  assert.strictEqual('barra' in store.trova('s2', file).esercizi[0], false, 'una barra fuori misura si scarta');
  store.salva({ ...sessione(undefined), id: 's3' }, file);
  assert.strictEqual('barra' in store.trova('s3', file).esercizi[0], false);
});

test('volume massimo di una seduta: con la barra (10 dischi + 20) x 10 + 14 x 8; senza barra come prima', () => {
  assert.strictEqual(T.valori({ sessioni: [sessione(20)] }).volumeMaxSeduta, (10 + 20) * 10 + 14 * 8);
  assert.strictEqual(T.valori({ sessioni: [sessione(undefined)] }).volumeMaxSeduta, 10 * 10 + 14 * 8);
});

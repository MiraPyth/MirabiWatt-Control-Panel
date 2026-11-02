// 19/10/2026: le sessioni di palestra salvate sull'OptiPlex (palestra-storico.json). Un file temporaneo, niente rete.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const S = require('../palestra-store.js');

const file = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'palestra-')), 'storico.json');
const SESS = { id: '2026-10-19T17:00:00.000Z', data: '2026-10-19', seduta: 'Petto-Spalle', schema: 'adattamento 1', inizio: '2026-10-19T17:00:00.000Z', fine: '2026-10-19T17:50:00.000Z',
  esercizi: [{ id: 'panca-piana-manubri', nome: 'Panca piana con manubri', serie: [{ kg: 12, reps: 15, fatta: true }, { kg: 12, reps: 14, fatta: true }] }], note: 'spalla dx ok' };

test('salva e rilegge, con l\'ultima volta di ogni esercizio', () => {
  const f = file();
  S.salva(SESS, f);
  const st = S.storico(f);
  assert.strictEqual(st.sessioni.length, 1);
  assert.deepStrictEqual(st.ultimi['panca-piana-manubri'].serie, [{ kg: 12, reps: 15 }, { kg: 12, reps: 14 }]);
});

test('salvare di nuovo la stessa sessione la sostituisce, non la duplica', () => {
  const f = file();
  S.salva(SESS, f);
  S.salva({ ...SESS, note: 'corretta' }, f);
  const st = S.storico(f);
  assert.strictEqual(st.sessioni.length, 1);
  assert.strictEqual(st.sessioni[0].note, 'corretta');
});

test('sessioni malformate rifiutate', () => {
  const f = file();
  for (const s of [null, {}, { ...SESS, esercizi: 'x' }, { ...SESS, data: 'ieri' },
    { ...SESS, esercizi: [{ id: 'x', serie: [{ kg: 'tanto', reps: 3, fatta: true }] }] }]) assert.throws(() => S.salva(s, f));
  assert.strictEqual(S.storico(f).sessioni.length, 0);
});

test('file mancante: storico vuoto', () => {
  assert.deepStrictEqual(S.storico(file()), { sessioni: [], ultimi: {} });
});

test('id Strava: si segna sulla seduta e un nuovo salvataggio non lo perde (niente doppioni su Strava)', () => {
  const f = file();
  S.salva(SESS, f);
  S.segna(SESS.id, { stravaId: 987 }, f);
  assert.strictEqual(S.trova(SESS.id, f).stravaId, 987);
  S.salva({ ...SESS, note: 'corretta' }, f);
  assert.strictEqual(S.trova(SESS.id, f).stravaId, 987);
  assert.strictEqual(S.trova('nessuna', f), null);
});

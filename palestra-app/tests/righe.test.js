// MirabiWatt Palestra (04/11/2026): ogni riga della seduta e' indipendente; notifica di fine recupero.
const test = require('node:test');
const assert = require('node:assert');
const Palestra = require('../../palestra.js');
global.Palestra = Palestra;
const Seduta = require('../src/js/seduta.js');
const Notifiche = require('../src/js/notifiche.js');

const piano = { seduta: 'Gambe', schema: 'x', esercizi: [
  { id: 'squat', nome: 'Squat', attrezzo: 'bilanciere', tipo: 'composto', gruppo: 'gambe', serie: 3, reps: [6, 8], repsTesto: '6-8', unita: 'reps', rir: '2', recSec: 150, partenza: [40, 50] },
  { id: 'plank', nome: 'Plank', attrezzo: 'corpo', tipo: 'isolamento', gruppo: 'core', serie: 1, reps: [30, 40], repsTesto: '30-40', unita: 's', rir: '1', recSec: 45 },
] };
const nuova = () => Palestra.nuovaSessione(piano, {}, '2026-11-04T13:00:00');

test('righe: avvicinamenti e serie, ciascuna con kg e ripetizioni proprie', () => {
  const r = Seduta.righe(nuova().esercizi[0]);
  assert.deepStrictEqual(r.map(x => x.tipo + x.idx), ['avv0', 'avv1', 'serie0', 'serie1', 'serie2']);
  assert.ok(r.every(x => typeof x.reps === 'number'));
  assert.ok(r[0].kg < r[1].kg && r[1].kg < r[2].kg, 'avvicinamenti crescenti fino al carico vero');
});

test('imposta: cambia solo la riga toccata, le altre serie non si muovono', () => {
  const s = nuova(), kg0 = s.esercizi[0].serie[1].kg;
  Seduta.imposta(s, 0, 'serie', 0, 'kg', 55);
  Seduta.imposta(s, 0, 'serie', 0, 'reps', 5);
  assert.strictEqual(s.esercizi[0].serie[0].kg, 55);
  assert.strictEqual(s.esercizi[0].serie[0].reps, 5);
  assert.strictEqual(s.esercizi[0].serie[1].kg, kg0);
});

test('imposta: un avvicinamento modificato resta com e (non segue piu il carico)', () => {
  const s = nuova();
  Seduta.imposta(s, 0, 'avv', 0, 'kg', 20);
  Seduta.imposta(s, 0, 'serie', 0, 'kg', 60);
  assert.strictEqual(Seduta.righe(s.esercizi[0])[0].kg, 20);
});

test('imposta: valori non validi si ignorano, mai sotto zero', () => {
  const s = nuova(), prima = s.esercizi[0].serie[0].kg;
  Seduta.imposta(s, 0, 'serie', 0, 'kg', 'abc');
  assert.strictEqual(s.esercizi[0].serie[0].kg, prima);
  Seduta.imposta(s, 0, 'serie', 0, 'reps', -3);
  assert.strictEqual(s.esercizi[0].serie[0].reps, 0);
});

test('conferma: una riga qualsiasi, parte il recupero dell esercizio (60 s per l avvicinamento)', () => {
  const s = nuova();
  assert.strictEqual(Seduta.conferma(s, 0, 'avv', 0).recSec, 60);
  const r = Seduta.conferma(s, 0, 'serie', 1);
  assert.strictEqual(r.recSec, 150);
  assert.strictEqual(s.esercizi[0].serie[1].fatta, true);
  assert.strictEqual(s.esercizi[0].serie[0].fatta, false);
});

test('conferma due volte la stessa riga: la annulla, senza recupero', () => {
  const s = nuova();
  Seduta.conferma(s, 0, 'serie', 0);
  const r = Seduta.conferma(s, 0, 'serie', 0);
  assert.strictEqual(r.recSec, 0);
  assert.strictEqual(s.esercizi[0].serie[0].fatta, false);
});

test('notifica fine recupero: si programma all ora giusta e si annulla', async () => {
  const chiamate = [];
  const plugin = { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
    createChannel: async c => chiamate.push(['canale', c.id]), schedule: async o => chiamate.push(['programma', o.notifications[0].id, o.notifications[0].schedule.at.getTime(), o.notifications[0].channelId]),
    cancel: async o => chiamate.push(['annulla', o.notifications[0].id]) };
  const n = Notifiche.crea(plugin);
  await n.programma(1700000000000, 'Recupero finito', 'Tocca a te');
  await n.annulla();
  assert.deepStrictEqual(chiamate.filter(c => c[0] !== 'canale'), [['programma', 1, 1700000000000, 'recupero'], ['annulla', 1]]);
});

test('notifica: senza plugin o senza permesso non succede nulla di grave', async () => {
  const n0 = Notifiche.crea(null);
  await n0.programma(Date.now() + 1000, 'a', 'b'); await n0.annulla();
  const programmate = [];
  const n1 = Notifiche.crea({ checkPermissions: async () => ({ display: 'denied' }), requestPermissions: async () => ({ display: 'denied' }), createChannel: async () => {}, schedule: async o => programmate.push(o), cancel: async () => {} });
  await n1.programma(Date.now() + 1000, 'a', 'b');
  assert.strictEqual(programmate.length, 0);
});

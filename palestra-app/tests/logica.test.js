// MirabiWatt Palestra (app Android, 02/11/2026): coda offline, scelta del server, avanzamento della seduta.
const test = require('node:test');
const assert = require('node:assert');
const Palestra = require('../../palestra.js');
global.Palestra = Palestra;
const Sync = require('../src/js/sync.js');
const Seduta = require('../src/js/seduta.js');

const piano = { seduta: 'Petto-Spalle', schema: 'adattamento 1', esercizi: [
  { id: 'panca', nome: 'Panca inclinata', attrezzo: 'manubri', tipo: 'composto', gruppo: 'petto', serie: 2, reps: [8, 10], repsTesto: '8-10', unita: 'reps', rir: '2', recSec: 120, partenza: [14, 18] },
  { id: 'alzate', nome: 'Alzate laterali', attrezzo: 'manubri', tipo: 'isolamento', gruppo: 'spalle', serie: 1, reps: [12, 15], repsTesto: '12-15', unita: 'reps', rir: '1', recSec: 60 },
] };
const nuova = () => Palestra.nuovaSessione(piano, {}, '2026-11-02T18:00:00');

test('coda: la stessa seduta salvata due volte resta una sola, la piu recente', () => {
  let c = Sync.accoda([], { id: 'a', note: 'prima' });
  c = Sync.accoda(c, { id: 'a', note: 'dopo' });
  c = Sync.accoda(c, { id: 'b' });
  assert.deepStrictEqual(c.map(s => [s.id, s.note]), [['a', 'dopo'], ['b', undefined]]);
});

test('svuota: tiene in coda solo quelle non accettate', async () => {
  const inviate = [];
  const r = await Sync.svuota([{ id: 'a' }, { id: 'b' }, { id: 'c' }], async s => { inviate.push(s.id); if (s.id === 'b') throw new Error('rete'); });
  assert.deepStrictEqual(inviate, ['a', 'b', 'c']);
  assert.deepStrictEqual(r.coda.map(s => s.id), ['b']);
  assert.strictEqual(r.inviate, 2);
});

test('server: prova casa poi Tailscale, il primo che risponde vince', async () => {
  const provati = [];
  const s = await Sync.scegliServer(async url => { provati.push(url); if (url.includes('192.168')) throw new Error('fuori casa'); });
  assert.strictEqual(s, 'http://100.101.135.102:3000');
  assert.deepStrictEqual(provati, ['http://192.168.1.38:3000', 'http://100.101.135.102:3000']);
});

test('server: nessuno raggiungibile = null (si lavora offline)', async () => {
  assert.strictEqual(await Sync.scegliServer(async () => { throw new Error('no'); }), null);
});

test('etichetta di freschezza dei dati', () => {
  const ora = Date.parse('2026-11-02T18:00:00');
  assert.strictEqual(Sync.freschezza(null, ora), 'mai scaricate');
  assert.strictEqual(Sync.freschezza(ora - 5 * 60000, ora), 'aggiornate 5 min fa');
  assert.strictEqual(Sync.freschezza(ora - 3 * 3600000, ora), 'aggiornate 3 h fa');
  assert.strictEqual(Sync.freschezza(ora - 50 * 3600000, ora), 'aggiornate 2 giorni fa');
});

test('seduta: si parte dagli avvicinamenti del primo esercizio', () => {
  const s = nuova();
  const p = Seduta.posizione(s);
  assert.strictEqual(p.iEs, 0);
  assert.strictEqual(p.passo.tipo, 'avvicinamento');
});

test('segna: avvicinamenti, poi serie vere con il recupero dell esercizio, poi esercizio dopo', () => {
  const s = nuova();
  assert.strictEqual(Seduta.segna(s).recSec, 60);   // avvicinamento 1
  assert.strictEqual(Seduta.segna(s).recSec, 60);   // avvicinamento 2
  assert.strictEqual(Seduta.segna(s).recSec, 120);  // serie 1
  const ultima = Seduta.segna(s);                   // serie 2: esercizio finito
  assert.strictEqual(ultima.esercizioFinito, true);
  assert.strictEqual(Seduta.posizione(s).iEs, 1);
  assert.deepStrictEqual(s.esercizi[0].serie.map(x => x.fatta), [true, true]);
});

test('fine seduta: dopo l ultima serie posizione = finita', () => {
  const s = nuova();
  for (let i = 0; i < 20 && !Seduta.posizione(s).finita; i++) Seduta.segna(s);
  assert.strictEqual(Seduta.posizione(s).finita, true);
});

test('aggiusta: kg a passi dell attrezzo, propagati alle serie non ancora fatte', () => {
  const s = nuova();
  Seduta.segna(s); Seduta.segna(s); // avvicinamenti
  Seduta.aggiusta(s, 'kg', +1);
  assert.deepStrictEqual(s.esercizi[0].serie.map(x => x.kg), [16, 16]);
  Seduta.segna(s);
  Seduta.aggiusta(s, 'kg', -1);
  assert.deepStrictEqual(s.esercizi[0].serie.map(x => x.kg), [16, 14]);
  Seduta.aggiusta(s, 'reps', +1);
  assert.strictEqual(s.esercizi[0].serie[1].reps, 9);
});

test('aggiusta: mai sotto zero', () => {
  const s = nuova();
  Seduta.segna(s); Seduta.segna(s);
  for (let i = 0; i < 20; i++) Seduta.aggiusta(s, 'kg', -1);
  assert.strictEqual(s.esercizi[0].serie[0].kg, 0);
});

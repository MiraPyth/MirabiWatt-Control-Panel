// 10/11/2026: l'app di palestra legge la settimana vera (gli eventi su intervals.icu, dove finiscono le modifiche fatte da
// MirabiWatt) e non piu' il piano stagionale statico; le sedute non fatte restano scegliibili e una seduta fatta in un
// altro giorno della settimana conta come fatta. Logica pura: piano, schede ed eventi arrivano come dati.
const test = require('node:test');
const assert = require('node:assert');
const { settimanaPalestra } = require('../palestra-settimana.js');

const baseName = s => (s || '').replace(/\s*\(.*?\)\s*$/, '').trim();
// piano statico della settimana di lunedi' 9/11: quello che MirabiWatt aveva prima delle modifiche
const PIANO = { phase: { name: 'Ri-adattamento palestra' }, week: { label: 'Sett. 2', days: [
  { d: 'Lun', s: 'Petto-Spalle (adattamento 2)', dur: "50'", zone: 'Palestra' }, { d: 'Mar', s: 'Zwift Race', dur: "60-75'", zone: 'HIT' },
  { d: 'Mer', s: 'Gambe-Core (adattamento 2)', dur: "50'", zone: 'Palestra' }, { d: 'Gio', s: 'EnduranceCorto', dur: '1h15', zone: 'Z2' },
  { d: 'Ven', s: 'Schiena-Bicipiti (adattamento 2)', dur: "50'", zone: 'Palestra' }, { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'EnduranceLungo', dur: '2h45', zone: 'Z2' }] } };
const SCHEDE = new Set(['Petto-Spalle', 'Gambe-Core', 'Schiena-Bicipiti']);
const dip = {
  findDetailedWeek: lun => lun === '2026-11-09' ? PIANO : null, baseName,
  pianoPalestra: nome => SCHEDE.has(baseName(nome)) ? { seduta: baseName(nome), schema: (nome.match(/\((.*)\)/) || [])[1], esercizi: [{ id: 'x' }] } : null,
};
// eventi spinti su intervals.icu dopo le modifiche: Petto-Spalle spostata a mercoledi', Gambe-Core tolta, Zwift Race tolta
const EVENTI = [{ date: '2026-11-11', name: '[MW] Petto-Spalle' }, { date: '2026-11-12', name: '[MW] EnduranceCorto' }, { date: '2026-11-13', name: '[MW] Schiena-Bicipiti' }, { date: '2026-11-15', name: '[MW] EnduranceLungo' }];
const chiama = (extra = {}) => settimanaPalestra({ lunedi: '2026-11-09', eventi: EVENTI, sessioni: [], gare: [{ nome: 'Granfondo' }], ...dip, ...extra });

test('con gli eventi di intervals.icu la settimana e\' quella modificata, non il piano', () => {
  const s = chiama();
  assert.strictEqual(s.fonte, 'intervals');
  assert.deepStrictEqual(s.giorni.map(g => [g.data, g.nome]), [['2026-11-09', 'Riposo'], ['2026-11-10', 'Riposo'], ['2026-11-11', 'Petto-Spalle'], ['2026-11-12', 'EnduranceCorto'],
    ['2026-11-13', 'Schiena-Bicipiti'], ['2026-11-14', 'Riposo'], ['2026-11-15', 'EnduranceLungo']]);
  assert.strictEqual(s.fase, 'Ri-adattamento palestra');
  assert.strictEqual(s.settimana, 'Sett. 2');
});

test('durata e zona dei giorni vengono dal piano per nome; il riposo e\' riposo', () => {
  const g = chiama().giorni;
  assert.deepStrictEqual([g[3].dur, g[3].zona], ['1h15', 'Z2']);
  assert.deepStrictEqual([g[2].zona, g[2].dur], ['Palestra', "50'"]);
  assert.strictEqual(g[0].riposo, true);
  assert.strictEqual(g[2].riposo, false);
});

test('la scheda di palestra e\' quella giusta con lo schema della settimana (adattamento 2)', () => {
  const g = chiama().giorni[2];
  assert.strictEqual(g.nomePiano, 'Petto-Spalle (adattamento 2)');
  assert.strictEqual(g.seduta.seduta, 'Petto-Spalle');
  assert.strictEqual(g.seduta.schema, 'adattamento 2');
  assert.strictEqual(chiama().giorni[3].seduta, null, 'la bici non ha scheda');
});

test('sedute del piano non piu\' in calendario: restano scegliibili in «altre»', () => {
  const s = chiama();
  assert.deepStrictEqual(s.altre.map(a => a.nomePiano), ['Gambe-Core (adattamento 2)']);
  assert.strictEqual(s.altre[0].fatta, false);
});

test('seduta fatta un altro giorno della settimana: conta come fatta (anche in «altre»)', () => {
  const s = chiama({ sessioni: [{ data: '2026-11-10', seduta: 'Petto-Spalle' }, { data: '2026-11-10', seduta: 'Gambe-Core' }] });
  assert.strictEqual(s.giorni[2].fatta, true);
  assert.strictEqual(s.giorni[2].fattaIl, '2026-11-10');
  assert.strictEqual(s.altre[0].fatta, true);
  assert.strictEqual(s.giorni[4].fatta, false, 'Schiena-Bicipiti non fatta');
});

test('una sola sessione non segna due sedute con lo stesso nome nella settimana', () => {
  const doppie = [{ date: '2026-11-09', name: '[MW] Petto-Spalle' }, { date: '2026-11-11', name: '[MW] Petto-Spalle' }];
  const s = chiama({ eventi: doppie, sessioni: [{ data: '2026-11-10', seduta: 'Petto-Spalle' }] });
  assert.deepStrictEqual([s.giorni[0].fatta, s.giorni[2].fatta], [true, false], 'la prima in ordine di data');
});

test('sessioni di un\'altra settimana non contano', () => {
  const s = chiama({ sessioni: [{ data: '2026-11-04', seduta: 'Petto-Spalle' }, { data: '2026-11-16', seduta: 'Petto-Spalle' }] });
  assert.strictEqual(s.giorni[2].fatta, false);
});

test('senza eventi (intervals.icu non risponde o settimana non spinta): il piano, e lo dice', () => {
  for (const eventi of [null, []]) {
    const s = chiama({ eventi });
    assert.strictEqual(s.fonte, 'piano');
    assert.deepStrictEqual(s.giorni.map(g => g.nome), ['Petto-Spalle', 'Zwift Race', 'Gambe-Core', 'EnduranceCorto', 'Schiena-Bicipiti', 'Riposo', 'EnduranceLungo']);
    assert.deepStrictEqual(s.altre, []);
    assert.strictEqual(s.giorni[0].seduta.schema, 'adattamento 2', 'la seduta di lunedi\' (ieri) resta scegliibile');
  }
});

test('evento senza prefisso [MW] o con nome nuovo: si legge comunque, schema dalla settimana', () => {
  const s = chiama({ eventi: [{ date: '2026-11-10', name: 'Gambe-Core' }, { date: '2026-11-11', name: 'Uscita libera' }] });
  assert.strictEqual(s.giorni[1].nomePiano, 'Gambe-Core (adattamento 2)');
  assert.strictEqual(s.giorni[2].nome, 'Uscita libera');
  assert.deepStrictEqual([s.giorni[2].dur, s.giorni[2].zona, s.giorni[2].seduta], ['', '', null]);
});

test('settimana fuori dal piano: niente scheda inventata', () => {
  const s = settimanaPalestra({ lunedi: '2026-12-07', eventi: [{ date: '2026-12-08', name: '[MW] Petto-Spalle' }], sessioni: [], gare: [], ...dip });
  assert.strictEqual(s.giorni[1].nome, 'Petto-Spalle');
  assert.strictEqual(s.giorni[1].seduta, null, 'nessuno schema noto: non si indovina');
  assert.strictEqual(s.fase, null);
});

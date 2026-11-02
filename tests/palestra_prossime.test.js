// 02/11/2026: l'app Android di palestra scarica le prossime sedute per allenarsi anche senza rete.
// Logica pura (palestra-prossime.js) + rotta vera /api/palestra/prossime sul server vivo (sola lettura).
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { prossimeSedute } = require('../palestra-prossime.js');

const SETTIMANE = {
  '2026-11-02': { week: { days: [
    { s: 'Petto-Spalle (adattamento 1)', zone: 'Palestra', d: 'Lun' }, { s: 'Zwift Race', zone: 'HIT', d: 'Mar' },
    { s: 'Gambe-Core (adattamento 1)', zone: 'Palestra', d: 'Mer' }, { s: 'EnduranceCorto', zone: 'Z2', d: 'Gio' },
    { s: 'Schiena-Bicipiti (adattamento 1)', zone: 'Palestra', d: 'Ven' }, { s: 'Riposo', d: 'Sab' }, { s: 'EnduranceLungo', zone: 'Z2', d: 'Dom' }] } },
  '2026-11-09': { week: { days: [{ s: 'Petto-Spalle (adattamento 2)', zone: 'Palestra', d: 'Lun' }, { s: 'Riposo', d: 'Mar' }] } },
};
const dip = {
  findDetailedWeek: ws => SETTIMANE[ws] || null,
  pianoPalestra: nome => /Petto|Gambe|Schiena/.test(nome) ? { seduta: nome.replace(/ \(.*/, ''), schema: (nome.match(/\((.*)\)/) || [])[1], esercizi: [{ id: 'finto', gif: 'abc' }] } : null,
};

test('solo i giorni di palestra, da oggi in avanti, con la scheda strutturata', () => {
  const r = prossimeSedute({ oggi: '2026-11-03', giorni: 7, ...dip });
  assert.deepStrictEqual(r.map(x => [x.data, x.piano.seduta]), [['2026-11-04', 'Gambe-Core'], ['2026-11-06', 'Schiena-Bicipiti'], ['2026-11-09', 'Petto-Spalle']]);
  assert.strictEqual(r[2].piano.schema, 'adattamento 2');
  assert.strictEqual(r[0].giorno, 'Mer');
});

test('oggi compreso', () => {
  assert.strictEqual(prossimeSedute({ oggi: '2026-11-02', giorni: 1, ...dip })[0].data, '2026-11-02');
});

test('settimana non pianificata: salta senza errori', () => {
  assert.deepStrictEqual(prossimeSedute({ oggi: '2026-11-16', giorni: 7, ...dip }), []);
});

test('rotta vera: 200, sedute e ultima volta per esercizio, giorni limitati', async () => {
  const r = await new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: 3000, path: '/api/palestra/prossime?giorni=14' }, res => {
    const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, j: JSON.parse(Buffer.concat(p)) }));
  }).on('error', ko));
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.j.sedute) && typeof r.j.ultimi === 'object' && /^\d{4}-/.test(r.j.generato));
  for (const s of r.j.sedute) assert.ok(s.data && s.piano && Array.isArray(s.piano.esercizi));
});

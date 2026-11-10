// 10/11/2026: rotte /api/fit/* dell'app Fit (peso Garmin, obiettivi del giorno, profilo, foto). Dipendenze finte: nessuna rete, nessun file vero.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { creaFitApi } = require('../fit-api.js');

const OGGI = '2026-11-11';
const PESI = [{ data: '2026-11-04', kg: 82.47, grassoPct: 23.7, fonte: 'garmin' }, { data: '2026-10-22', kg: 82.35, grassoPct: 22.1, fonte: 'garmin' }, { data: '2026-10-21', kg: 82.79, grassoPct: 22.0, fonte: 'garmin' }];
const SETTIMANA = { giorni: [{ data: OGGI, giorno: 'Mer', nome: 'Petto-Spalle', dur: "50'", zona: 'Palestra', riposo: false, seduta: { seduta: 'Petto-Spalle' } }] };

function avvia(dep = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-fitapi-'));
  const api = creaFitApi({
    garmin: { peso: async () => PESI }, settimanaDel: async () => SETTIMANA, attivita: async () => [], sessioni: () => [],
    pesoKg: () => 82.47, ftp: () => 305, cartellaDati: dir, adesso: () => new Date(OGGI + 'T10:00:00'), ...dep });
  return new Promise(ok => { const s = http.createServer(async (req, res) => { if (!(await api.servi(req, res))) { res.writeHead(404); res.end('altro'); } }); s.listen(0, '127.0.0.1', () => ok({ s, dir })); });
}
const chiedi = (s, metodo, url, corpo, tipo = 'application/json') => new Promise((ok, ko) => {
  const r = http.request({ host: '127.0.0.1', port: s.address().port, path: url, method: metodo, headers: corpo ? { 'Content-Type': tipo, 'Content-Length': Buffer.byteLength(corpo) } : {} }, res => {
    const p = []; res.on('data', c => p.push(c)); res.on('end', () => { const b = Buffer.concat(p); let j = null; try { j = JSON.parse(b.toString()); } catch (e) { /* binario */ } ok({ status: res.statusCode, head: res.headers, corpo: b, json: j }); });
  }); r.on('error', ko); if (corpo) r.write(corpo); r.end();
});

test('peso: serie dal Garmin, ultimo valore e variazione tra le ultime due pesate, fonte dichiarata', async () => {
  const { s } = await avvia();
  const r = await chiedi(s, 'GET', '/api/fit/peso?giorni=90');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.serie.length, 3);
  assert.strictEqual(r.json.fonte, 'garmin');
  assert.strictEqual(r.json.ultimo.kg, 82.47);
  assert.deepStrictEqual(r.json.variazione, { kg: 0.12, da: '2026-10-22', a: '2026-11-04' });
  s.close();
});

test('peso: con una sola pesata niente variazione; senza pesate «vuoto», non zero', async () => {
  let s1 = (await avvia({ garmin: { peso: async () => [PESI[0]] } })).s;
  assert.strictEqual((await chiedi(s1, 'GET', '/api/fit/peso')).json.variazione, null);
  s1.close();
  s1 = (await avvia({ garmin: { peso: async () => [] } })).s;
  const r = await chiedi(s1, 'GET', '/api/fit/peso');
  assert.deepStrictEqual([r.json.serie, r.json.ultimo, r.json.variazione], [[], null, null]);
  s1.close();
});

test('peso: giorni fuori da 1..365 rifiutati; errori Garmin con il codice giusto e messaggio chiaro', async () => {
  let { s } = await avvia();
  assert.strictEqual((await chiedi(s, 'GET', '/api/fit/peso?giorni=0')).status, 400);
  assert.strictEqual((await chiedi(s, 'GET', '/api/fit/peso?giorni=999')).status, 400);
  s.close();
  s = (await avvia({ garmin: { peso: async () => { throw new Error('chiave Garmin non configurata sul server'); } } })).s;
  let r = await chiedi(s, 'GET', '/api/fit/peso');
  assert.strictEqual(r.status, 503);
  assert.strictEqual(r.json.nonDisponibile, true);
  assert.match(r.json.error, /non configurata/);
  s.close();
  s = (await avvia({ garmin: { peso: async () => { throw new Error('Garmin non risponde'); } } })).s;
  r = await chiedi(s, 'GET', '/api/fit/peso');
  assert.strictEqual(r.status, 502);
  s.close();
});

test('oggi: obiettivi del giorno dal piano, dalle sedute e dalle attivita\' vere', async () => {
  const { s } = await avvia({
    sessioni: () => [{ data: OGGI, seduta: 'Petto-Spalle', inizio: '2026-11-11T09:00:00', fine: '2026-11-11T09:50:00' }],
    attivita: async () => [{ date: OGGI, type: 'Run', durationMin: 30, kcal: 300 }],
  });
  const r = await chiedi(s, 'GET', '/api/fit/oggi');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.data, OGGI);
  assert.strictEqual(r.json.giorno.nome, 'Petto-Spalle');
  assert.strictEqual(r.json.obiettivi.previsto.minuti, 50);
  assert.strictEqual(r.json.obiettivi.previsto.kcal, 344);
  assert.strictEqual(r.json.obiettivi.svolto.minuti, 80);
  assert.deepStrictEqual(r.json.avvisi, []);
  s.close();
});

test('oggi: se le attivita\' non si leggono lo dice (avviso), non finge zero', async () => {
  const { s } = await avvia({ attivita: async () => { throw new Error('intervals.icu non risponde'); } });
  const r = await chiedi(s, 'GET', '/api/fit/oggi');
  assert.strictEqual(r.status, 200);
  assert.match(r.json.avvisi.join(' '), /attivit/i);
  assert.strictEqual(r.json.obiettivi.previsto.minuti, 50, 'il previsto dal piano resta');
  s.close();
});

test('oggi: giorno di riposo o settimana non disponibile', async () => {
  let { s } = await avvia({ settimanaDel: async () => ({ giorni: [{ data: OGGI, giorno: 'Mer', nome: 'Riposo', dur: '', zona: '', riposo: true, seduta: null }] }) });
  let r = await chiedi(s, 'GET', '/api/fit/oggi');
  assert.strictEqual(r.json.obiettivi.riposo, true);
  s.close();
  s = (await avvia({ settimanaDel: async () => { throw new Error('boom'); } })).s;
  r = await chiedi(s, 'GET', '/api/fit/oggi');
  assert.strictEqual(r.status, 502);
  s.close();
});

test('profilo: lettura di default e modifica persistente, con la validazione del server', async () => {
  const { s } = await avvia();
  let r = await chiedi(s, 'GET', '/api/fit/profilo');
  assert.strictEqual(r.json.nome, '');
  r = await chiedi(s, 'PUT', '/api/fit/profilo', JSON.stringify({ nome: 'Tiziano', obiettivi: { oreMovimento: 1.5 } }));
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await chiedi(s, 'GET', '/api/fit/profilo')).json.obiettivi.oreMovimento, 1.5);
  r = await chiedi(s, 'PUT', '/api/fit/profilo', JSON.stringify({ unita: { peso: 'stone' } }));
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /unit/);
  r = await chiedi(s, 'PUT', '/api/fit/profilo', 'non json');
  assert.strictEqual(r.status, 400);
  r = await chiedi(s, 'PUT', '/api/fit/profilo', JSON.stringify({ nome: 'x'.repeat(20000) }));
  assert.strictEqual(r.status, 413);
  s.close();
});

test('oggi usa l\'obiettivo di movimento del profilo', async () => {
  const { s } = await avvia();
  await chiedi(s, 'PUT', '/api/fit/profilo', JSON.stringify({ obiettivi: { oreMovimento: 2 } }));
  const r = await chiedi(s, 'GET', '/api/fit/oggi');
  assert.strictEqual(r.json.obiettivi.movimento.oreObiettivo, 2);
  s.close();
});

test('foto: si carica come immagine grezza, si rilegge con il tipo giusto, assente = 404', async () => {
  const { s } = await avvia();
  assert.strictEqual((await chiedi(s, 'GET', '/api/fit/foto')).status, 404);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
  let r = await chiedi(s, 'PUT', '/api/fit/foto', jpeg, 'image/jpeg');
  assert.strictEqual(r.status, 200);
  assert.match(r.json.foto, /^foto-[0-9a-f]{8}\.jpg$/);
  r = await chiedi(s, 'GET', '/api/fit/foto');
  assert.strictEqual(r.head['content-type'], 'image/jpeg');
  assert.deepStrictEqual(r.corpo, jpeg);
  r = await chiedi(s, 'PUT', '/api/fit/foto', Buffer.from('non una foto'), 'image/jpeg');
  assert.strictEqual(r.status, 400);
  r = await chiedi(s, 'PUT', '/api/fit/foto', Buffer.alloc(2 * 1024 * 1024, 1), 'image/png');
  assert.strictEqual(r.status, 413);
  s.close();
});

test('rotte non fit: non vengono toccate', async () => {
  const { s } = await avvia();
  assert.strictEqual((await chiedi(s, 'GET', '/api/altro')).corpo.toString(), 'altro');
  assert.strictEqual((await chiedi(s, 'POST', '/api/fit/peso', '{}')).corpo.toString(), 'altro');
  s.close();
});

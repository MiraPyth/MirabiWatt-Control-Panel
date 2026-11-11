// 11/11/2026: rotte /api/fit/modelli e /api/fit/pianifica con dipendenze finte (nessuna scrittura su intervals.icu).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { creaFitApi } = require('../fit-api.js');

function avvia(pianifica) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-pian-'));
  const api = creaFitApi({ garmin: { peso: async () => [] }, settimanaDel: async () => ({ giorni: [] }), attivita: async () => [], sessioni: () => [],
    pesoKg: () => 80, ftp: () => 300, cartellaDati: dir, adesso: () => new Date('2026-11-11T10:00:00'), pianifica });
  return new Promise(ok => { const s = http.createServer(async (req, res) => { if (!(await api.servi(req, res))) { res.writeHead(404); res.end('altro'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
}
const chiedi = (s, metodo, url, corpo) => new Promise((ok, ko) => {
  const r = http.request({ host: '127.0.0.1', port: s.address().port, path: url, method: metodo, headers: corpo ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) } : {} }, res => {
    const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(Buffer.concat(p).toString() || 'null') }));
  }); r.on('error', ko); if (corpo) r.write(corpo); r.end();
});
const errore = (codice, messaggio) => Object.assign(new Error(messaggio), { code: codice });

test('modelli: elenco dal servizio di pianificazione', async () => {
  const s = await avvia({ modelli: async () => ({ ciclismo: [{ id: 'EnduranceCorto', nome: 'Endurance corto', durataMin: 90 }], palestra: [] }) });
  const r = await chiedi(s, 'GET', '/api/fit/modelli');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ciclismo[0].id, 'EnduranceCorto');
  s.close();
});

test('pianifica: crea e risponde con id, nome e data; l input arriva intatto al servizio', async () => {
  let ricevuto = null;
  const s = await avvia({ crea: async i => { ricevuto = i; return { id: 4242, nome: '[MW] Endurance', data: i.data }; } });
  const r = await chiedi(s, 'POST', '/api/fit/pianifica', JSON.stringify({ data: '2026-11-20', sport: 'ciclismo', modello: 'EnduranceCorto' }));
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.json, { ok: true, id: 4242, nome: '[MW] Endurance', data: '2026-11-20' });
  assert.deepStrictEqual(ricevuto, { data: '2026-11-20', sport: 'ciclismo', modello: 'EnduranceCorto' });
  s.close();
});

test('pianifica: input non valido 400 col messaggio, intervals.icu giu 502, JSON rotto 400', async () => {
  const s = await avvia({ crea: async i => { if (i.sport === 'golf') throw errore('input', 'sport non valido'); throw new Error('intervals.icu 500'); } });
  const a = await chiedi(s, 'POST', '/api/fit/pianifica', JSON.stringify({ data: '2026-11-20', sport: 'golf' }));
  assert.strictEqual(a.status, 400);
  assert.strictEqual(a.json.error, 'sport non valido');
  const b = await chiedi(s, 'POST', '/api/fit/pianifica', JSON.stringify({ data: '2026-11-20', sport: 'corsa' }));
  assert.strictEqual(b.status, 502);
  assert.doesNotMatch(b.json.error, /500/);
  assert.strictEqual((await chiedi(s, 'POST', '/api/fit/pianifica', '{rotto')).status, 400);
  s.close();
});

test('elimina: solo id numerici; evento non dell app 403; esito ok', async () => {
  const tolti = [];
  const s = await avvia({ elimina: async id => { if (id === '999') throw errore('non-app', 'solo gli allenamenti creati dall app'); tolti.push(id); } });
  assert.strictEqual((await chiedi(s, 'DELETE', '/api/fit/pianifica?id=4242')).status, 200);
  assert.deepStrictEqual(tolti, ['4242']);
  assert.strictEqual((await chiedi(s, 'DELETE', '/api/fit/pianifica?id=999')).status, 403);
  assert.strictEqual((await chiedi(s, 'DELETE', '/api/fit/pianifica?id=../x')).status, 400);
  assert.strictEqual((await chiedi(s, 'DELETE', '/api/fit/pianifica')).status, 400);
  s.close();
});

test('senza servizio di pianificazione le rotte rispondono 503, non crollano', async () => {
  const s = await avvia(undefined);
  assert.strictEqual((await chiedi(s, 'GET', '/api/fit/modelli')).status, 503);
  assert.strictEqual((await chiedi(s, 'POST', '/api/fit/pianifica', '{}')).status, 503);
  s.close();
});

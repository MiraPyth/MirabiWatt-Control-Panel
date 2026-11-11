// 11/11/2026: rotta /api/fit/forza con dipendenza finta.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { creaFitApi } = require('../fit-api.js');

const avvia = dep => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-forza-'));
  const api = creaFitApi({ garmin: { peso: async () => [] }, settimanaDel: async () => ({ giorni: [] }), attivita: async () => [], sessioni: () => [],
    pesoKg: () => 80, ftp: () => 300, cartellaDati: dir, adesso: () => new Date('2026-11-11T10:00:00'), ...dep });
  return new Promise(ok => { const s = http.createServer(async (req, res) => { if (!(await api.servi(req, res))) { res.writeHead(404); res.end('x'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
};
const chiedi = s => new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: s.address().port, path: '/api/fit/forza' }, res => { const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(Buffer.concat(p).toString()) })); }).on('error', ko));

test('forza: risponde col calcolo; senza servizio 503; guasto 502', async () => {
  const a = await avvia({ forza: async () => ({ cardine: [{ id: 'panca-piana-manubri' }], altri: [] }) });
  const r = await chiedi(a);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.cardine[0].id, 'panca-piana-manubri');
  a.close();
  const b = await avvia({});
  assert.strictEqual((await chiedi(b)).status, 503);
  b.close();
  const c = await avvia({ forza: async () => { throw new Error('giu'); } });
  assert.strictEqual((await chiedi(c)).status, 502);
  c.close();
});

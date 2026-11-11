// 11/11/2026: aggiornamento OTA dell'app MirabiWatt Fit: il server legge fit/dist/ (ultima.json + apk) e li serve su /api/fit/app e /api/fit/app.apk.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { creaRilascio } = require('../palestra-app-release.js');
const fitRilascio = require('../fit-app-release.js');

const cartella = (conApk = true, extra = {}) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-fit-rilascio-'));
  fs.writeFileSync(path.join(d, 'ultima.json'), JSON.stringify({ versione: '1.0.0', codice: 2, costruito: 1794300000000, apk: 'mw-fit-1.0.0.apk', ...extra }));
  if (conApk) fs.writeFileSync(path.join(d, 'mw-fit-1.0.0.apk'), Buffer.from('PK-finto-fit'));
  return d;
};
const avvia = (dir, r = fitRilascio) => new Promise(ok => { const s = http.createServer((req, res) => { if (!r.servi(req, res, dir)) { res.writeHead(404); res.end('altro'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
const chiedi = (s, url) => new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: s.address().port, path: url }, res => {
  const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, head: res.headers, corpo: Buffer.concat(p) }));
}).on('error', ko));

test('fabbrica: indirizzi e informazioni seguono il prefisso scelto', () => {
  const r = creaRilascio('/api/fit/app');
  assert.strictEqual(r.URL_APK, '/api/fit/app.apk');
  assert.deepStrictEqual(r.info(cartella()), { ok: true, versione: '1.0.0', codice: 2, costruito: 1794300000000, byte: 12, url: '/api/fit/app.apk' });
  assert.strictEqual(r.info(cartella(false)), null);
});

test('rotte Fit: json delle versioni e download dell apk; le rotte della palestra non sono sue', async () => {
  const s = await avvia(cartella());
  const j = await chiedi(s, '/api/fit/app');
  assert.strictEqual(j.status, 200);
  assert.strictEqual(JSON.parse(j.corpo).codice, 2);
  assert.strictEqual(JSON.parse(j.corpo).url, '/api/fit/app.apk');
  const a = await chiedi(s, '/api/fit/app.apk');
  assert.strictEqual(a.status, 200);
  assert.strictEqual(a.head['content-type'], 'application/vnd.android.package-archive');
  assert.strictEqual(a.corpo.toString(), 'PK-finto-fit');
  assert.match(a.head['content-disposition'], /mw-fit-1\.0\.0\.apk/);
  assert.strictEqual((await chiedi(s, '/api/palestra/app')).status, 404);
  s.close();
});

test('senza build: 404 chiaro; nome apk che esce dalla cartella: rifiutato', async () => {
  const s = await avvia(cartella(false));
  assert.strictEqual((await chiedi(s, '/api/fit/app')).status, 404);
  s.close();
  assert.strictEqual(fitRilascio.info(cartella(true, { apk: '../x.apk' })), null);
});

// 04/11/2026: l'app Android di palestra controlla qui se esiste una versione nuova e la scarica dalle Impostazioni.
// Cartella di rilascio (fuori da git): latest.json { versione } + mw-palestra.apk.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const rilascio = require('../palestra-app-release.js');

const cartella = (conApk = true) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-rilascio-'));
  fs.writeFileSync(path.join(d, 'latest.json'), JSON.stringify({ versione: '0.4.0', note: 'Impostazioni e guida' }));
  if (conApk) fs.writeFileSync(path.join(d, 'mw-palestra.apk'), Buffer.from('PK-finto-apk'));
  return d;
};
const chiedi = (server, url) => new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: server.address().port, path: url }, res => {
  const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, head: res.headers, corpo: Buffer.concat(p) }));
}).on('error', ko));
const avvia = dir => new Promise(ok => { const s = http.createServer((req, res) => { if (!rilascio.servi(req, res, dir)) { res.writeHead(404); res.end('altro'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });

test('informazioni: versione e indirizzo del file', () => {
  assert.deepStrictEqual(rilascio.info(cartella()), { versione: '0.4.0', url: '/api/palestra/app.apk', note: 'Impostazioni e guida' });
});

test('senza rilascio o senza apk: nessuna informazione', () => {
  assert.strictEqual(rilascio.info(path.join(os.tmpdir(), 'non-esiste-mw')), null);
  assert.strictEqual(rilascio.info(cartella(false)), null);
});

test('rotta /api/palestra/app: json con la versione', async () => {
  const s = await avvia(cartella());
  const r = await chiedi(s, '/api/palestra/app');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(JSON.parse(r.corpo).versione, '0.4.0');
  s.close();
});

test('rotta /api/palestra/app.apk: il file, come download Android', async () => {
  const s = await avvia(cartella());
  const r = await chiedi(s, '/api/palestra/app.apk');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.head['content-type'], 'application/vnd.android.package-archive');
  assert.match(r.head['content-disposition'], /attachment; filename="mw-palestra-0\.4\.0\.apk"/);
  assert.strictEqual(r.corpo.toString(), 'PK-finto-apk');
  s.close();
});

test('senza rilascio: 404 e le altre rotte non vengono toccate', async () => {
  const s = await avvia(path.join(os.tmpdir(), 'non-esiste-mw'));
  assert.strictEqual((await chiedi(s, '/api/palestra/app')).status, 404);
  assert.strictEqual((await chiedi(s, '/api/palestra/app.apk')).status, 404);
  assert.strictEqual((await chiedi(s, '/api/altro')).corpo.toString(), 'altro');
  s.close();
});

test('non serve altri file della cartella ne percorsi strani', async () => {
  const d = cartella();
  fs.writeFileSync(path.join(d, 'segreto.txt'), 'no');
  const s = await avvia(d);
  assert.strictEqual((await chiedi(s, '/api/palestra/app.apk/../segreto.txt')).corpo.toString(), 'altro');
  assert.strictEqual((await chiedi(s, '/api/palestra/segreto.txt')).corpo.toString(), 'altro');
  s.close();
});

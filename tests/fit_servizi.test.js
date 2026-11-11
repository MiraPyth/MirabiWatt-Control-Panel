// 11/11/2026: stato dei servizi collegati (Garmin, intervals.icu, Strava, Health Connect) per la schermata Profilo. Puro + rotta.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { riassumiServizi } = require('../fit-servizi.js');
const { creaFitApi } = require('../fit-api.js');

test('tutto collegato: stato, dettaglio leggibile, nessun segreto', () => {
  const s = riassumiServizi({ garmin: { chiave: true, ultimaPesata: '2026-11-04' }, intervals: { ok: true }, strava: { collegato: true, atleta: 'Tiziano S.' } });
  assert.strictEqual(s.garmin.stato, 'collegato');
  assert.match(s.garmin.dettaglio, /Ultimo peso: 4 novembre 2026/);
  assert.strictEqual(s.intervals.stato, 'collegato');
  assert.strictEqual(s.strava.stato, 'collegato');
  assert.match(s.strava.dettaglio, /Tiziano S\./);
  assert.strictEqual(s.healthConnect.stato, 'non-disponibile');
  assert.ok(!JSON.stringify(s).match(/GCDC|Bearer|api[_-]?key/i));
});

test('chiave Garmin assente: non configurato; errore di rete: errore con messaggio breve', () => {
  assert.strictEqual(riassumiServizi({ garmin: { chiave: false }, intervals: { ok: true }, strava: { collegato: false } }).garmin.stato, 'non-configurato');
  const s = riassumiServizi({ garmin: { chiave: true, errore: 'Garmin non risponde' }, intervals: { ok: false, errore: 'intervals.icu 401' }, strava: { collegato: false } });
  assert.strictEqual(s.garmin.stato, 'errore');
  assert.strictEqual(s.garmin.dettaglio, 'Garmin non risponde');
  assert.strictEqual(s.intervals.stato, 'errore');
  assert.strictEqual(s.strava.stato, 'non-collegato');
});

test('Garmin collegato ma senza pesate: lo dice', () => {
  const s = riassumiServizi({ garmin: { chiave: true, ultimaPesata: null }, intervals: { ok: true }, strava: { collegato: false } });
  assert.strictEqual(s.garmin.stato, 'collegato');
  assert.match(s.garmin.dettaglio, /Nessuna pesata/);
});

test('rotta servizi: risponde con lo stato; senza servizio 503; guasto 502', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-serv-'));
  const crea = dep => creaFitApi({ garmin: { peso: async () => [] }, settimanaDel: async () => ({ giorni: [] }), attivita: async () => [], sessioni: () => [], pesoKg: () => 80, ftp: () => 300, cartellaDati: dir, adesso: () => new Date('2026-11-11T10:00:00'), ...dep });
  const avvia = api => new Promise(ok => { const s = http.createServer(async (req, res) => { if (!(await api.servi(req, res))) { res.writeHead(404); res.end('x'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
  const chiedi = s => new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: s.address().port, path: '/api/fit/servizi' }, res => { const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(Buffer.concat(p).toString()) })); }).on('error', ko));
  const a = await avvia(crea({ servizi: async () => ({ garmin: { stato: 'collegato', dettaglio: 'x' } }) }));
  const r = await chiedi(a);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.garmin.stato, 'collegato');
  a.close();
  const b = await avvia(crea({}));
  assert.strictEqual((await chiedi(b)).status, 503);
  b.close();
  const c = await avvia(crea({ servizi: async () => { throw new Error('giu'); } }));
  assert.strictEqual((await chiedi(c)).status, 502);
  c.close();
});

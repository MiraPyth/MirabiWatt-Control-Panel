// 11/11/2026: dati dell'attivita' fatta nel calendario (metriche, link a intervals.icu) e percorso GPS campionato. Puro + rotta con dipendenze finte.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { calendarioMese, campionaPercorso } = require('../fit-calendario.js');
const { creaFitApi } = require('../fit-api.js');

const base = { mese: '2026-11', oggi: '2026-11-11', attivita: [], eventi: [], sessioni: [] };
const giorno = (c, d) => c.giorni.find(g => g.data === d);
const GARNADAY = { id: 'i207323488', date: '2026-11-08', type: 'Ride', name: 'Garnaday', durationMin: 195, distanceKm: 85.28, kcal: 2173, np: 215, watt: 160, bpm: 139, bpmMax: 187, rpm: 77, kmh: 26.3, climbM: 955, tss: 161 };

test('attivita fatta: metriche vere e link a intervals.icu nella voce', () => {
  const v = giorno(calendarioMese({ ...base, attivita: [GARNADAY] }), '2026-11-08').voci[0];
  assert.deepStrictEqual(v.attivita, {
    id: 'i207323488', url: 'https://intervals.icu/activities/i207323488', distanzaKm: 85.28, velMediaKmh: 26.3, npWatt: 215, wattMedi: 160,
    bpmMedio: 139, bpmMax: 187, rpmMedio: 77, dislivelloM: 955, kcal: 2173, tss: 161 });
  assert.strictEqual(v.durataMin, 195);
});

test('metriche mancanti si omettono, mai a zero; senza id niente link', () => {
  const v = giorno(calendarioMese({ ...base, attivita: [{ id: 'i1', date: '2026-11-08', type: 'Ride', name: 'Solo durata', durationMin: 40, np: null, bpm: 0, kcal: null }] }), '2026-11-08').voci[0];
  assert.deepStrictEqual(v.attivita, { id: 'i1', url: 'https://intervals.icu/activities/i1' });
  const s = giorno(calendarioMese({ ...base, attivita: [{ date: '2026-11-08', type: 'Ride', name: 'x', durationMin: 40 }] }), '2026-11-08').voci[0];
  assert.strictEqual('attivita' in s, false);
});

test('percorso: toglie i punti senza GPS, tiene primo e ultimo, al massimo N punti', () => {
  const lat = [null, null, ...Array.from({ length: 1000 }, (_, i) => 44 + i / 1000)];
  const lng = [null, null, ...Array.from({ length: 1000 }, (_, i) => 10 + i / 1000)];
  const p = campionaPercorso([{ type: 'latlng', data: lat, data2: lng }], 100);
  assert.ok(p.length <= 100 && p.length >= 50);
  assert.deepStrictEqual(p[0], [44, 10]);
  assert.deepStrictEqual(p[p.length - 1], [44.999, 10.999]);
  assert.deepStrictEqual(campionaPercorso([{ type: 'latlng', data: [null, null], data2: [null, null] }], 100), []);
  assert.deepStrictEqual(campionaPercorso([], 100), []);
  assert.deepStrictEqual(campionaPercorso(null, 100), []);
});

function avvia(dep = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-fitatt-'));
  const api = creaFitApi({ garmin: { peso: async () => [] }, settimanaDel: async () => ({ giorni: [] }), attivita: async () => [], sessioni: () => [],
    pesoKg: () => 80, ftp: () => 300, cartellaDati: dir, adesso: () => new Date('2026-11-11T10:00:00'), ...dep });
  return new Promise(ok => { const s = http.createServer(async (req, res) => { if (!(await api.servi(req, res))) { res.writeHead(404); res.end('altro'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
}
const chiedi = (s, url) => new Promise((ok, ko) => {
  http.get({ host: '127.0.0.1', port: s.address().port, path: url }, res => { const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(Buffer.concat(p).toString() || 'null') })); }).on('error', ko);
});

test('rotta percorso: punti campionati, id non valido 400, intervals.icu giu 502', async () => {
  const s = await avvia({ percorso: async id => [[44.1, 10.1], [44.2, 10.2]] });
  const r = await chiedi(s, '/api/fit/percorso?id=i207323488');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.json.punti, [[44.1, 10.1], [44.2, 10.2]]);
  assert.strictEqual((await chiedi(s, '/api/fit/percorso?id=../etc')).status, 400);
  assert.strictEqual((await chiedi(s, '/api/fit/percorso')).status, 400);
  s.close();
  const g = await avvia({ percorso: async () => { throw new Error('giu'); } });
  assert.strictEqual((await chiedi(g, '/api/fit/percorso?id=i1')).status, 502);
  g.close();
});

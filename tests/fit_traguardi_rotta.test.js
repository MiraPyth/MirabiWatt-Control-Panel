// 11/11/2026: rotte /api/fit/traguardi (achievements e record) e /api/fit/seduta (scheda + storico per il tracking). Dipendenze finte.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { serieMassima, calcolaTraguardi } = require('../fit-traguardi.js');
const { creaFitApi } = require('../fit-api.js');

test('serie: giorni di allenamento di fila, un solo giorno di riposo in mezzo e ammesso; due no', () => {
  assert.strictEqual(serieMassima([]), 0);
  assert.strictEqual(serieMassima(['2026-11-01']), 1);
  assert.strictEqual(serieMassima(['2026-11-01', '2026-11-02', '2026-11-03']), 3);
  assert.strictEqual(serieMassima(['2026-11-01', '2026-11-03']), 3);                         // un giorno di riposo in mezzo: conta come serie
  assert.strictEqual(serieMassima(['2026-11-01', '2026-11-04']), 1);                         // due giorni di riposo: la serie si spezza
  assert.strictEqual(serieMassima(['2026-11-03', '2026-11-01', '2026-11-01', '2026-11-02']), 3); // disordine e doppioni
  assert.strictEqual(serieMassima(['2026-10-01', '2026-10-02', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']), 4);
});

test('calcolaTraguardi: giorni da sedute e attivita, curva all-time e soglie del profilo', () => {
  const sessioni = [{ data: '2026-11-09', esercizi: [{ id: 'panca-piana-manubri', serie: [{ kg: 20, reps: 8, fatta: true }] }] }];
  const attivita = [{ date: '2026-11-10', type: 'Ride', durationMin: 200, distanceKm: 85 }, { date: '2026-11-11', type: 'Ride', durationMin: 60 }];
  const curva = { secs: [5, 60, 300, 1200], watts: [950, 600, 380, 320] };
  const r = calcolaTraguardi({ sessioni, attivita, ftp: 305, curva, soglie: { 'ftp-320': 310 }, oggi: '2026-11-11' });
  assert.ok(Array.isArray(r.achievements) && r.achievements.length >= 10);
  const ftp320 = r.achievements.find(a => a.id === 'ftp-320');
  assert.strictEqual(ftp320.soglia, 310);
  assert.strictEqual(ftp320.raggiunto, false);
  assert.strictEqual(r.achievements.find(a => a.id === 'lunga-3h').raggiunto, true);
  assert.strictEqual(r.record.find(x => x.id === 'p5s').valore, 950);
  assert.strictEqual(r.record.find(x => x.id === 'serieRecord').valore, 3);                  // 9, 10, 11 novembre
  assert.strictEqual(r.aggiornato, '2026-11-11');
});

test('calcolaTraguardi senza dati: nessun traguardo regalato, niente record inventati', () => {
  const r = calcolaTraguardi({ sessioni: [], attivita: [], ftp: null, curva: null, soglie: {}, oggi: '2026-11-11' });
  assert.ok(r.achievements.every(a => a.raggiunto === false));
  assert.deepStrictEqual(r.record, []);
});

function avvia(dep = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-trag-'));
  const api = creaFitApi({ garmin: { peso: async () => [] }, settimanaDel: async () => ({ giorni: [] }), attivita: async () => [], sessioni: () => [],
    pesoKg: () => 80, ftp: () => 300, cartellaDati: dir, adesso: () => new Date('2026-11-11T10:00:00'), ...dep });
  return new Promise(ok => { const s = http.createServer(async (req, res) => { if (!(await api.servi(req, res))) { res.writeHead(404); res.end('altro'); } }); s.listen(0, '127.0.0.1', () => ok(s)); });
}
const chiedi = (s, url) => new Promise((ok, ko) => {
  http.get({ host: '127.0.0.1', port: s.address().port, path: url }, res => { const p = []; res.on('data', c => p.push(c)); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(Buffer.concat(p).toString() || 'null') })); }).on('error', ko);
});

test('rotta traguardi: risponde col calcolo, 502 se i dati non arrivano', async () => {
  const s = await avvia({ traguardi: async () => ({ achievements: [{ id: 'a' }], record: [], aggiornato: '2026-11-11' }) });
  const r = await chiedi(s, '/api/fit/traguardi');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.achievements[0].id, 'a');
  s.close();
  const g = await avvia({ traguardi: async () => { throw new Error('giu'); } });
  assert.strictEqual((await chiedi(g, '/api/fit/traguardi')).status, 502);
  g.close();
  const n = await avvia({});
  assert.strictEqual((await chiedi(n, '/api/fit/traguardi')).status, 503);
  n.close();
});

test('rotta seduta: scheda e storico per data e nome; parametri sbagliati 400; seduta non trovata 404', async () => {
  let ricevuto = null;
  const s = await avvia({ seduta: async i => { ricevuto = i; return i.nome === 'Sconosciuta' ? null : { scheda: { seduta: 'Petto-Spalle', esercizi: [] }, storico: [{ data: '2026-11-02' }] }; } });
  const r = await chiedi(s, '/api/fit/seduta?data=2026-11-12&nome=%5BMW%5D%20Petto-Spalle');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.json, { data: '2026-11-12', nome: '[MW] Petto-Spalle', scheda: { seduta: 'Petto-Spalle', esercizi: [] }, storico: [{ data: '2026-11-02' }] });
  assert.deepStrictEqual(ricevuto, { data: '2026-11-12', nome: '[MW] Petto-Spalle' });
  assert.strictEqual((await chiedi(s, '/api/fit/seduta?data=12/11/2026&nome=x')).status, 400);
  assert.strictEqual((await chiedi(s, '/api/fit/seduta?data=2026-11-12')).status, 400);
  assert.strictEqual((await chiedi(s, '/api/fit/seduta?data=2026-11-12&nome=Sconosciuta')).status, 404);
  s.close();
});

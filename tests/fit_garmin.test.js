// 10/11/2026: client Garmin Personal API (solo lettura) per l'app Fit. Rete finta, dati sintetici: nessuna chiamata vera, nessuna chiave vera.
// Forma delle risposte verificata il 10/11 con la chiave di Tiziano (peso in GRAMMI, dailyWeightSummaries[].allWeightMetrics[]).
const test = require('node:test');
const assert = require('node:assert');
const { creaGarmin, normalizzaPeso, scadenzaJwt } = require('../fit-garmin.js');

const jwt = exp => `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.firma`;
const misura = (data, g, extra = {}) => ({ samplePk: 1, date: Date.parse(data + 'T07:00:00Z'), calendarDate: data, weight: g, bmi: 24, bodyFat: 22.5, bodyWater: 54, boneMass: 3200, muscleMass: 38000, sourceType: 'INDEX_SCALE', timestampGMT: Date.parse(data + 'T06:00:00Z'), weightDelta: 0, ...extra });
const giorno = (data, ...ms) => ({ summaryDate: data, numOfWeightEntries: ms.length, minWeight: ms[0].weight, maxWeight: ms[0].weight, latestWeight: ms[ms.length - 1], allWeightMetrics: ms });
const RISPOSTA = { dailyWeightSummaries: [giorno('2026-11-04', misura('2026-11-04', 82470)), giorno('2026-10-22', misura('2026-10-22', 82349, { bodyFat: 22.1 }))], totalAverage: { weight: 82400 }, previousDateWeight: null, nextDateWeight: null };

// adesso in millisecondi (1_000_000 ms = 1000 s); exp del token in secondi
function finto({ adesso = 1_000_000, risposte = {}, scadenza = 1000 + 24 * 3600 } = {}) {
  const chiamate = [];
  const fetch = async (url, opz = {}) => {
    chiamate.push({ url, auth: (opz.headers || {}).Authorization, metodo: opz.method || 'GET' });
    const r = risposte[url.split('?')[0]] || risposte[url] || null;
    if (url.includes('personal-api-key/token')) return { ok: true, status: 200, text: async () => jwt(scadenza) };
    if (typeof r === 'function') return r(chiamate.length);
    return { ok: true, status: 200, text: async () => JSON.stringify(r) };
  };
  const g = creaGarmin({ chiave: () => 'CHIAVE-FINTA', fetch, adesso: () => adesso });
  return { g, chiamate, avanza: s => { adesso += s * 1000; } };
}

test('JWT: la scadenza si legge dal campo exp', () => {
  assert.strictEqual(scadenzaJwt(jwt(1234567)), 1234567);
  assert.strictEqual(scadenzaJwt('non-un-jwt'), null);
});

test('peso normalizzato: kg (da grammi), una pesata al giorno (l\'ultima), piu\' recente per prima, composizione se presente', () => {
  const p = normalizzaPeso(RISPOSTA);
  assert.deepStrictEqual(p.map(x => [x.data, x.kg]), [['2026-11-04', 82.47], ['2026-10-22', 82.35]]);
  assert.strictEqual(p[0].grassoPct, 22.5);
  assert.strictEqual(p[0].fonte, 'garmin');
  assert.strictEqual(p[1].grassoPct, 22.1);
});

test('piu\' pesate nello stesso giorno: conta l\'ultima del giorno', () => {
  const r = { dailyWeightSummaries: [giorno('2026-11-04', misura('2026-11-04', 83000, { timestampGMT: 1 }), misura('2026-11-04', 82500, { timestampGMT: 2 }))] };
  assert.strictEqual(normalizzaPeso(r)[0].kg, 82.5);
});

test('risposta vuota o con campi mancanti: elenco vuoto, mai numeri inventati', () => {
  assert.deepStrictEqual(normalizzaPeso(null), []);
  assert.deepStrictEqual(normalizzaPeso({}), []);
  assert.deepStrictEqual(normalizzaPeso({ dailyWeightSummaries: [{ summaryDate: '2026-11-04', allWeightMetrics: [] }] }), []);
  assert.deepStrictEqual(normalizzaPeso({ dailyWeightSummaries: [giorno('2026-11-04', misura('2026-11-04', null))] }), []);
});

test('peso: scambia la chiave per un token, poi legge con Bearer e l\'intervallo richiesto', async () => {
  const { g, chiamate } = finto({ risposte: { 'https://personal.connectapi.garmin.com/weight-service/weight/range/2026-10-10/2026-11-10': RISPOSTA } });
  const p = await g.peso('2026-10-10', '2026-11-10');
  assert.strictEqual(p.length, 2);
  assert.strictEqual(chiamate[0].metodo, 'POST');
  assert.match(chiamate[0].auth, /^ApiKey /);
  assert.strictEqual(chiamate[1].auth, `Bearer ${jwt(1000 + 24 * 3600)}`);
  assert.match(chiamate[1].url, /\/weight-service\/weight\/range\/2026-10-10\/2026-11-10\?includeAll=true$/);
});

test('il token si riusa finche\' non manca meno di un\'ora alla scadenza', async () => {
  const f = finto({ risposte: { 'https://personal.connectapi.garmin.com/weight-service/weight/range/a/b': RISPOSTA } });
  await f.g.peso('a', 'b'); await f.g.peso('a', 'b');
  assert.strictEqual(f.chiamate.filter(c => c.metodo === 'POST').length, 1);
  f.avanza(23.5 * 3600);                      // mancano 30 minuti: si rinnova
  await f.g.peso('a', 'b');
  assert.strictEqual(f.chiamate.filter(c => c.metodo === 'POST').length, 2);
});

test('401 sul dato: un solo rinnovo del token e un nuovo tentativo', async () => {
  let n = 0;
  const f = finto({ risposte: { 'https://personal.connectapi.garmin.com/weight-service/weight/range/a/b': () => (++n === 1 ? { ok: false, status: 401, text: async () => '' } : { ok: true, status: 200, text: async () => JSON.stringify(RISPOSTA) }) } });
  assert.strictEqual((await f.g.peso('a', 'b')).length, 2);
  assert.strictEqual(f.chiamate.filter(c => c.metodo === 'POST').length, 2);
});

test('errori con messaggio chiaro: chiave rifiutata, troppe richieste, servizio giu\'', async () => {
  const sempre = (status) => ({ risposte: { 'https://personal.connectapi.garmin.com/weight-service/weight/range/a/b': async () => ({ ok: false, status, text: async () => '' }) } });
  await assert.rejects(() => finto(sempre(401)).g.peso('a', 'b'), /Garmin non accetta la chiave/);
  await assert.rejects(() => finto(sempre(429)).g.peso('a', 'b'), /troppe richieste/);
  await assert.rejects(() => finto(sempre(503)).g.peso('a', 'b'), /Garmin non risponde/);
});

test('chiave assente: errore esplicito, nessuna chiamata', async () => {
  const chiamate = [];
  const g = creaGarmin({ chiave: () => null, fetch: async u => { chiamate.push(u); }, adesso: () => 0 });
  await assert.rejects(() => g.peso('a', 'b'), /chiave Garmin non configurata/);
  assert.strictEqual(chiamate.length, 0);
});

test('corpo vuoto (JSON nullo): nessuna pesata', async () => {
  const f = finto({ risposte: { 'https://personal.connectapi.garmin.com/weight-service/weight/range/a/b': async () => ({ ok: true, status: 200, text: async () => '' }) } });
  assert.deepStrictEqual(await f.g.peso('a', 'b'), []);
});

test('la chiave e il token non compaiono mai nei messaggi di errore', async () => {
  const f = finto({ risposte: { 'https://personal.connectapi.garmin.com/weight-service/weight/range/a/b': async () => ({ ok: false, status: 500, text: async () => 'Bearer segreto CHIAVE-FINTA' }) } });
  try { await f.g.peso('a', 'b'); assert.fail('doveva fallire'); } catch (e) { assert.ok(!/CHIAVE-FINTA|Bearer|segreto/.test(e.message)); }
});

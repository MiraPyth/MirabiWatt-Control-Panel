// 19/10/2026: API dell'app di palestra sul server vivo (porta 3000). Niente scritture vere: lo storico non si sporca.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const chiama = (metodo, p, corpo) => new Promise((ok, ko) => {
  const r = http.request({ host: '127.0.0.1', port: 3000, path: p, method: metodo, headers: { 'Content-Type': 'application/json' } }, res => {
    const pezzi = []; res.on('data', c => pezzi.push(c)); res.on('end', () => ok({ status: res.statusCode, tipo: res.headers['content-type'], corpo: Buffer.concat(pezzi) }));
  });
  r.on('error', ko); r.end(corpo ? JSON.stringify(corpo) : undefined);
});

test('storico: sessioni e ultima volta per esercizio', async () => {
  const r = await chiama('GET', '/api/palestra/storico');
  assert.strictEqual(r.status, 200);
  const j = JSON.parse(r.corpo);
  assert.ok(Array.isArray(j.sessioni) && typeof j.ultimi === 'object');
});

test('sessione malformata: 400, nessun salvataggio', async () => {
  const prima = JSON.parse((await chiama('GET', '/api/palestra/storico')).corpo).sessioni.length;
  const r = await chiama('POST', '/api/palestra/sessioni', { id: 'x', data: 'ieri', seduta: 'Petto-Spalle', esercizi: [] });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(JSON.parse((await chiama('GET', '/api/palestra/storico')).corpo).sessioni.length, prima);
});

test('le GIF arrivano dall\'OptiPlex come immagini', async () => {
  const r = await chiama('GET', '/palestra-gif/SpYC0Kp.gif');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.tipo, 'image/gif');
  assert.strictEqual(r.corpo.slice(0, 3).toString(), 'GIF');
});

test('ricette del Ricettario per i macro di un pasto (ponte verso :8100)', async () => {
  const r = await chiama('GET', '/api/ricette-pasto?kcal=650&p=45&c=70&g=20&pasto=pranzo&n=2');
  assert.strictEqual(r.status, 200);
  const j = JSON.parse(r.corpo);
  assert.strictEqual(j.ricette.length, 2);
  for (const x of j.ricette) assert.ok(x.id && x.titolo && x.macro.kcal > 0);
});

test('Strava: credenziali presenti, collegamento che rimanda all\'autorizzazione di Strava', async () => {
  const st = JSON.parse((await chiama('GET', '/api/strava/stato')).corpo);
  assert.strictEqual(st.configurato, true);
  assert.strictEqual(typeof st.collegato, 'boolean');
  const r = await chiama('GET', '/strava/collega');
  assert.strictEqual(r.status, 302);
});

test('Strava: la verifica del collegamento risponde in JSON e non pubblica nulla', async () => {
  const r = await chiama('GET', '/api/strava/verifica');
  assert.strictEqual(r.status, 200);
  assert.match(r.tipo, /json/);
  const j = JSON.parse(r.corpo);
  assert.ok(j.ok === true ? typeof j.atleta === 'string' : j.collegato === false || typeof j.error === 'string');
});

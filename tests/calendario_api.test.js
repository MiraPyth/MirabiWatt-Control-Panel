// /api/calendar (14/10/2026): attività vere e forma (CTL, ATL, ramp) di un intervallo, per il calendario stile intervals.icu.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const get = p => new Promise((ok, ko) => http.get('http://127.0.0.1:3000' + p, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => ok({ status: r.statusCode, body: s ? JSON.parse(s) : null })); }).on('error', ko));

test('date mancanti o sbagliate: 400', async () => {
  assert.strictEqual((await get('/api/calendar')).status, 400);
  assert.strictEqual((await get('/api/calendar?start=2026-10-01&end=ieri')).status, 400);
  assert.strictEqual((await get('/api/calendar?start=2026-10-31&end=2026-10-01')).status, 400, 'fine prima dell\'inizio');
  assert.strictEqual((await get('/api/calendar?start=2026-01-01&end=2026-12-31')).status, 400, 'al massimo ~3 mesi');
});

test('attività e forma dell\'intervallo, da intervals.icu', async () => {
  const r = await get('/api/calendar?start=2026-09-28&end=2026-10-11');
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.ok(Array.isArray(r.body.activities) && Array.isArray(r.body.wellness));
  for (const a of r.body.activities) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(a.date) && 'tss' in a && 'durationMin' in a && 'name' in a);
  assert.ok(r.body.wellness.length > 0, 'la forma dei giorni passati');
  for (const w of r.body.wellness) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(w.date) && 'ctl' in w && 'atl' in w && 'rampRate' in w);
});

// 13/10/2026: schede come intervals.icu e abbinamento al pianificato
const post = (p, corpo) => new Promise((ok, ko) => { const r = http.request({ host: '127.0.0.1', port: 3000, path: p, method: 'POST', headers: { 'Content-Type': 'application/json' } },
  res => { let s = ''; res.on('data', c => s += c); res.on('end', () => ok({ status: res.statusCode, body: s ? JSON.parse(s) : null })); }); r.on('error', ko); r.end(JSON.stringify(corpo)); });

test('attività con i dati della scheda (FC, watt, kJ, kcal, zone, aderenza), quelle da Strava riconoscibili, eventi con l\'abbinamento', async () => {
  const r = await get('/api/calendar?start=2026-10-10&end=2026-10-13');
  assert.strictEqual(r.status, 200);
  const garmin = r.body.activities.find(a => a.id === 'i195817930');
  assert.ok(garmin, 'l\'uscita del 10/10 da Garmin');
  assert.strictEqual(garmin.start, '15:33');
  for (const k of ['hr', 'watt', 'np', 'intensita', 'kj', 'kcal', 'compliance', 'distanceKm']) assert.ok(typeof garmin[k] === 'number', k);
  assert.strictEqual(garmin.zone.length, 7);
  assert.strictEqual(garmin.abbinata, true, 'abbinata al pianificato del 10/10');
  // dal 13/10 sera Zwift è collegato direttamente a intervals.icu: le uscite arrivano complete
  const zwift = r.body.activities.filter(a => a.date === '2026-10-13');
  assert.strictEqual(zwift.length, 4);
  assert.ok(zwift.every(a => !a.strava && a.indoor && /^Zwift/.test(a.name) && typeof a.watt === 'number'));
  const ev = r.body.eventi.find(e => e.date === '2026-10-13');
  assert.deepStrictEqual([ev.id, ev.name], [144231662, '[MirabiWatt] Zwift Race']);
  assert.ok('attivitaAbbinata' in ev);
  // le rare rimaste da Strava: riconoscibili, con l'orario
  const vecchie = (await get('/api/calendar?start=2026-07-28&end=2026-07-28')).body.activities.filter(a => a.strava);
  assert.ok(vecchie.length >= 1 && vecchie.every(a => /^\d\d:\d\d$/.test(a.start)));
});

test('/api/abbina: servono attività ed evento; quelle da Strava intervals.icu non le lascia abbinare', async () => {
  assert.strictEqual((await post('/api/abbina', { activityId: 'i1' })).status, 400);
  const r = await post('/api/abbina', { activityId: '19503906064', eventId: 144231662 }); // da Strava (28/07): intervals.icu rifiuta
  assert.strictEqual(r.status, 422);
  assert.match(r.body.error, /Strava/);
});

test('/api/preferenze: i campi delle schede attività, solo quelli noti', async () => {
  const prima = (await get('/api/preferenze')).body || {};
  try {
    assert.strictEqual((await post('/api/preferenze', { campiAttivita: ['durata', 'kcal', 'boh', 'kcal'] })).status, 200);
    assert.deepStrictEqual((await get('/api/preferenze')).body.campiAttivita, ['durata', 'kcal']);
  } finally { await post('/api/preferenze', { campiAttivita: prima.campiAttivita || ['durata', 'distanza', 'fc', 'watt', 'load', 'intensita', 'orario', 'kj', 'compliance', 'zone'] }); }
});

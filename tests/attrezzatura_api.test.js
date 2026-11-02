// /api/gear (13/10/2026): il gear di intervals.icu (sincronizzato da Strava), ridotto a quello che serve alla dashboard.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const chiedi = p => new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: 3000, path: p }, res => {
  let s = ''; res.on('data', c => s += c); res.on('end', () => ok({ status: res.statusCode, body: JSON.parse(s) }));
}).on('error', ko));

test('/api/gear: bici, componenti con km e promemoria, km recenti per bici', async () => {
  const r = await chiedi('/api/gear');
  assert.strictEqual(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const g = r.body.gear;
  assert.ok(Array.isArray(g) && g.length > 10);
  const bici = g.filter(x => x.tipo === 'Bike' && !x.ritiro);
  assert.ok(bici.length >= 1);
  const principale = bici.find(b => (b.componenti || []).length > 3);
  assert.ok(principale, 'una bici con i componenti montati');
  for (const x of g) {
    assert.ok(typeof x.km === 'number' && typeof x.ore === 'number' && typeof x.componente === 'boolean');
    assert.ok(Array.isArray(x.promemoria));
    assert.ok(!('athlete_id' in x) && !('distance' in x), 'campi già tradotti');
  }
  const conProm = g.find(x => x.promemoria.length);
  const p = conProm.promemoria[0];
  for (const k of ['nome', 'kmSoglia', 'giorniSoglia', 'percento', 'kmUsati', 'giorniUsati', 'dal']) assert.ok(k in p, k);
  assert.ok(typeof r.body.kmRecenti === 'object');
  assert.ok(Object.keys(r.body.kmRecenti).every(k => g.some(x => x.id === k)), 'km recenti solo per gear noto');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(r.body.aggiornato));
});

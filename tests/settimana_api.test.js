// /api/settimana-piano (14/10/2026): la settimana del piano stagionale, giorno per giorno, per la scheda MirabiWatt del
// Control Panel (mira-home la incrocia con le attività fatte).
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const get = p => new Promise((ok, ko) => http.get('http://127.0.0.1:3000' + p, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => ok({ status: r.statusCode, body: JSON.parse(s) })); }).on('error', ko));

test('la settimana del piano, da lunedì a domenica', async () => {
  const r = await get('/api/settimana-piano?data=2026-10-14');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.lunedi, '2026-10-12');
  assert.match(r.body.fase, /Base 1/);
  assert.strictEqual(r.body.giorni.length, 7);
  assert.deepStrictEqual(r.body.giorni.map(g => g.giorno), ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']);
  assert.deepStrictEqual(r.body.giorni[0], { data: '2026-10-12', giorno: 'Lun', nome: 'Riposo', dur: '', zona: '', riposo: true });
  assert.deepStrictEqual(r.body.giorni[1], { data: '2026-10-13', giorno: 'Mar', nome: 'Zwift Race', dur: "60-75'", zona: 'HIT', riposo: false });
  // le gare del piano stagionale (gli obiettivi che vedi in Stagione)
  assert.deepStrictEqual(r.body.gare.map(g => [g.nome, g.data, g.priorita]), [['Granfondo Tratturo Magno', '2027-03-14', 'B'], ['Granfondo Nove Colli (percorso lungo)', '2027-05-23', 'A']]);
  assert.strictEqual((await get('/api/settimana-piano?data=boh')).status, 400);
  const fuori = await get('/api/settimana-piano?data=2030-01-07');
  assert.deepStrictEqual([fuori.status, fuori.body.giorni], [200, []], 'fuori dal piano: nessun giorno');
});

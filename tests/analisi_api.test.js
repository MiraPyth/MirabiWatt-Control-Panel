// Endpoint per Analisi FTP, Fitness, nome dell'atleta e obiettivi (14/10/2026).
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const chiedi = (p, metodo = 'GET', corpo) => new Promise((ok, ko) => {
  const r = http.request({ host: '127.0.0.1', port: 3000, path: p, method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : {} }, res => {
    let s = ''; res.on('data', c => s += c); res.on('end', () => ok({ status: res.statusCode, body: s ? JSON.parse(s) : null }));
  });
  r.on('error', ko); if (corpo) r.write(JSON.stringify(corpo)); r.end();
});

test('/api/power-curves: le 4 curve con watt, W/kg, CP e W\' (modello ECP), MAP, VO2max, CS5m', async () => {
  const r = await chiedi('/api/power-curves');
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.curve.map(c => c.id), ['42d', '84d', 's0', 'all']);
  for (const c of r.body.curve) {
    assert.ok(c.secs.length > 50 && c.secs.length === c.watts.length && c.wkg.length === c.watts.length);
    assert.ok(c.secs.includes(1200) && c.secs.includes(300));
    assert.ok(c.cp > 100 && c.wPrime > 1000, `${c.id}: CP ${c.cp} W' ${c.wPrime}`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.start) && /^\d{4}-\d{2}-\d{2}$/.test(c.end));
    assert.ok('vo2max' in c && 'cs5m' in c && 'map' in c);
  }
  assert.ok(r.body.peso > 40);
});

test('/api/fitness: Fitness, Fatica e carico del giorno su un periodo lungo', async () => {
  assert.strictEqual((await chiedi('/api/fitness?start=2026-10-10&end=ieri')).status, 400);
  assert.strictEqual((await chiedi('/api/fitness?start=2023-01-01&end=2026-10-10')).status, 400, 'al massimo 2 anni');
  const r = await chiedi('/api/fitness?start=2026-04-01&end=2026-10-10');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.giorni.length > 150);
  for (const g of r.body.giorni.slice(0, 5)) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(g.data) && 'ctl' in g && 'atl' in g && 'carico' in g);
});

test('/api/preferenze: il nome da mostrare al posto di quello di intervals.icu', async () => {
  const prima = (await chiedi('/api/preferenze')).body;
  try {
    assert.strictEqual((await chiedi('/api/preferenze', 'POST', { nome: '  Tiziano  ' })).status, 200);
    assert.strictEqual((await chiedi('/api/preferenze')).body.nome, 'Tiziano');
    await chiedi('/api/preferenze', 'POST', { nome: 'x'.repeat(200) });
    assert.strictEqual((await chiedi('/api/preferenze')).body.nome.length, 40);
    // il peso della bici (Tools) senza toccare il nome
    await chiedi('/api/preferenze', 'POST', { pesoBici: 7.8 });
    const p = (await chiedi('/api/preferenze')).body;
    assert.deepStrictEqual([p.pesoBici, p.nome.length], [7.8, 40]);
  } finally { await chiedi('/api/preferenze', 'POST', { nome: (prima && prima.nome) || '', pesoBici: (prima && prima.pesoBici) || 8.5 }); }
});

test('/api/obiettivi: aggiungo, vedo, tolgo un obiettivo', async () => {
  assert.strictEqual((await chiedi('/api/obiettivi', 'POST', { nome: '', data: '2027-06-01' })).status, 400, 'senza nome no');
  assert.strictEqual((await chiedi('/api/obiettivi', 'POST', { nome: 'Gara', data: 'presto' })).status, 400, 'senza data no');
  const r = await chiedi('/api/obiettivi', 'POST', { nome: 'Granfondo di prova', data: '2027-06-13', priorita: 'B', km: 120, dislivello: 2100, note: 'test' });
  assert.strictEqual(r.status, 200);
  const id = r.body.obiettivo.id;
  try {
    const lista = (await chiedi('/api/obiettivi')).body.obiettivi;
    const o = lista.find(x => x.id === id);
    assert.deepStrictEqual([o.nome, o.data, o.priorita, o.km, o.dislivello], ['Granfondo di prova', '2027-06-13', 'B', 120, 2100]);
  } finally {
    assert.strictEqual((await chiedi('/api/obiettivi/' + id, 'DELETE')).status, 200);
  }
  assert.ok(!(await chiedi('/api/obiettivi')).body.obiettivi.some(x => x.id === id));
});

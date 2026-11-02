// Schede delle attività come intervals.icu (13/10/2026): campi a scelta, zone, compliance; abbinamento al pianificato.
const test = require('node:test');
const assert = require('node:assert');
const Cal = require('../calendario.js');
const SP = require('../season-plan.js');

const GARA = { id: 'i9', date: '2026-10-13', start: '19:06', name: '[MirabiWatt] Zwift Race', type: 'VirtualRide', indoor: true, durationMin: 42, distanceKm: 30.03,
  hr: 171, watt: 277, np: 290, tss: 58, intensita: 90, kj: 672, kcal: 650, compliance: 100, abbinata: true,
  zone: [0, 120, 300, 900, 1000, 140, 60] };

test('scheda: durata e distanza in testa, poi FC e watt, load intensità e orario, kJ', () => {
  const s = Cal.schedaAttivita(GARA, Cal.CAMPI_ATTIVITA.map(c => c.id));
  assert.strictEqual(s.titolo, 'Zwift Race');
  assert.deepStrictEqual(s.testa, ['42m', '30.03 km']);
  assert.deepStrictEqual(s.righe, ['171 bpm · 277 W · NP 290 W', 'Load 58 · 90% · 19:06', '672 kJ · 650 kcal']);
  assert.strictEqual(s.compliance, 100);
  assert.strictEqual(s.zone.length, 7);
  assert.strictEqual(Math.round(s.zone.reduce((t, z) => t + z.pct, 0)), 100);
  assert.deepStrictEqual(s.zone[3], { z: 'Z4', pct: 35.7 });
  assert.ok(!s.stub);
});

test('scheda: solo i campi scelti, e quelli senza dato spariscono', () => {
  const s = Cal.schedaAttivita({ ...GARA, hr: null, kcal: null }, ['durata', 'fc', 'watt', 'load']);
  assert.deepStrictEqual(s.testa, ['42m']);
  assert.deepStrictEqual(s.righe, ['277 W', 'Load 58']);
  assert.strictEqual(s.compliance, null);
  assert.deepStrictEqual(s.zone, []);
  assert.deepStrictEqual(Cal.schedaAttivita({ ...GARA, durationMin: 90 }, ['durata']).testa, ['1h30m']);
});

test('scheda: attività arrivata da Strava, senza dati via API', () => {
  const s = Cal.schedaAttivita({ id: '205', date: '2026-10-13', start: '18:15', strava: true }, ['durata']);
  assert.ok(s.stub);
  assert.strictEqual(s.titolo, 'Attività delle 18:15');
  assert.match(s.nota, /Strava/);
});

test('campi predefiniti: tutti tranne NP e kcal', () => {
  assert.deepStrictEqual(Cal.campiPredefiniti(), Cal.CAMPI_ATTIVITA.map(c => c.id).filter(c => c !== 'np' && c !== 'kcal'));
});

test('piano contro realtà: un\'attività abbinata al pianificato vale come fatto, anche se le altre del giorno non hanno dati', () => {
  const giorni = [{ d: 'Mar', s: 'Zwift Race', dur: "60-75'", zone: 'HIT' }];
  const att = [{ date: '2026-10-13', strava: true, durationMin: null }, { date: '2026-10-13', strava: true, durationMin: null, abbinata: true }];
  assert.strictEqual(SP.matchWeekToActual(giorni, '2026-10-13', '2026-10-14', { '2026-10-13': att })[0].status, 'done-match');
  assert.strictEqual(SP.matchWeekToActual(giorni, '2026-10-13', '2026-10-14', { '2026-10-13': att.map(a => ({ ...a, abbinata: false })) })[0].status, 'done-divergent');
});

test('kcal consumate in un giorno: somma di quelle note, e quante attività non le hanno', () => {
  assert.deepStrictEqual(Cal.kcalGiorno([{ kcal: 650 }, { kcal: 120 }, { strava: true }]), { kcal: 770, senzaDati: 1, attivita: 3 });
  assert.deepStrictEqual(Cal.kcalGiorno([]), { kcal: 0, senzaDati: 0, attivita: 0 });
});

// 10/11/2026: Achievements e Record personali dell'app Fit. Tutto calcolato su dati veri (sedute salvate, attivita', test FTP, curva di
// potenza); le soglie sono quelle di default e Tiziano le puo' cambiare dal profilo (obiettivi). Nessun traguardo e' «raggiunto» per finta.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../fit-traguardi.js');

const sessione = (data, esercizi) => ({ id: data, data, seduta: 'S', esercizi });
const panca = kg => ({ id: 'panca-piana-manubri', nome: 'Panca piana con manubri', serie: [{ kg, reps: 8, fatta: true }, { kg: kg + 100, reps: 8, fatta: false }] });
const CURVA = { secs: [1, 2, 3, 4, 5, 6, 60, 300, 1200], watts: [931, 922, 915, 906, 901, 891, 500, 380, 310] };

test('valori: sedute, serie record, volume massimo di una seduta, panca (somma dei due manubri)', () => {
  const sessioni = [
    sessione('2026-11-02', [panca(14), { id: 'x', nome: 'X', serie: [{ kg: 50, reps: 10, fatta: true }, { kg: 50, reps: 10, fatta: true }] }]),
    sessione('2026-11-04', [panca(20)]),
  ];
  const v = T.valori({ sessioni, attivita: [], serieRecord: 4, ftp: 305, curva: CURVA, oggi: '2026-11-10' });
  assert.strictEqual(v.sedutePalestra, 2);
  assert.strictEqual(v.serieRecord, 4);
  assert.strictEqual(v.volumeMaxSeduta, 14 * 8 + 1000, 'solo le serie fatte contano: 112 + 1000');
  assert.strictEqual(v.pancaTotale, 40, 'massimo kg per manubrio x 2, solo serie fatte');
  assert.strictEqual(v.ftp, 305);
  assert.strictEqual(v.p5s, 901);
});

test('valori: uscite in bici e la piu\' lunga; le attivita\' senza tipo o durata non contano', () => {
  const attivita = [{ type: 'Ride', durationMin: 150, distanceKm: 62 }, { type: 'VirtualRide', durationMin: 60, distanceKm: 30 }, { type: '', durationMin: null }, { type: 'Ride', durationMin: 10 }];
  const v = T.valori({ sessioni: [], attivita, serieRecord: 0, ftp: null, curva: null, oggi: '2026-11-10' });
  assert.strictEqual(v.usciteBici, 2);
  assert.strictEqual(v.biciMaxMinuti, 150);
  assert.strictEqual(v.biciMaxKm, 62);
  assert.strictEqual(v.ftp, null);
  assert.strictEqual(v.p5s, null);
});

test('achievements: percentuale, raggiunto solo se il valore arriva alla soglia, null se il dato manca', () => {
  const v = { sedutePalestra: 7, serieRecord: 7, ftp: 305, p5s: 901, pancaTotale: null, volumeMaxSeduta: 1200, usciteBici: 0, biciMaxMinuti: 0, biciMaxKm: 0 };
  const a = Object.fromEntries(T.achievements(v).map(x => [x.id, x]));
  assert.strictEqual(a['sedute-10'].percento, 70);
  assert.strictEqual(a['sedute-10'].raggiunto, false);
  assert.strictEqual(a['serie-7'].raggiunto, true);
  assert.strictEqual(a['mille-chili'].raggiunto, true);
  assert.strictEqual(a['mille-chili'].percento, 100, 'la percentuale si ferma a 100');
  assert.strictEqual(a['ftp-320'].percento, 95);
  assert.strictEqual(a['p5s-1000'].valore, 901);
  assert.strictEqual(a['panca-80'].valore, null, 'senza dati niente percentuale');
  assert.strictEqual(a['panca-80'].percento, null);
  assert.strictEqual(a['panca-80'].raggiunto, false);
});

test('soglie personalizzate dal profilo sostituiscono quelle di default', () => {
  const v = { sedutePalestra: 7, ftp: 305 };
  const a = Object.fromEntries(T.achievements(v, { 'sedute-10': 5, 'ftp-320': 300 }).map(x => [x.id, x]));
  assert.strictEqual(a['sedute-10'].soglia, 5);
  assert.strictEqual(a['sedute-10'].raggiunto, true);
  assert.strictEqual(a['ftp-320'].raggiunto, true);
  assert.strictEqual(a['serie-7'].soglia, 7, 'le altre restano di default');
});

test('ogni achievement ha id unico, nome, descrizione, categoria e unita', () => {
  const l = T.DEFINIZIONI;
  assert.strictEqual(new Set(l.map(d => d.id)).size, l.length);
  for (const d of l) for (const k of ['id', 'nome', 'descr', 'categoria', 'metrica', 'unita']) assert.ok(d[k], `${d.id}: ${k}`);
  for (const d of l) assert.ok(d.soglia > 0);
  assert.ok(!l.some(d => /[—–]/.test(JSON.stringify(d))), 'niente lineette lunghe');
});

test('record personali: potenze dalla curva (5 s, 1 min, 5 min, 20 min), seduta piu\' pesante, uscita piu\' lunga, panca', () => {
  const sessioni = [sessione('2026-11-02', [panca(20)])];
  const attivita = [{ type: 'Ride', durationMin: 150, distanceKm: 62 }];
  const v = T.valori({ sessioni, attivita, serieRecord: 5, ftp: 305, curva: CURVA, oggi: '2026-11-10' });
  const r = Object.fromEntries(T.record(v).map(x => [x.id, x]));
  assert.deepStrictEqual([r.p5s.valore, r.p1m.valore, r.p5m.valore, r.p20m.valore], [901, 500, 380, 310]);
  assert.strictEqual(r.p5s.unita, 'W');
  assert.strictEqual(r.biciPiuLunga.valore, 150);
  assert.strictEqual(r.serieRecord.valore, 5);
  assert.strictEqual(r.pancaTotale.valore, 40);
});

test('record senza dati: elenco vuoto per quella voce, non zero', () => {
  const r = T.record(T.valori({ sessioni: [], attivita: [], serieRecord: 0, ftp: null, curva: null, oggi: '2026-11-10' }));
  assert.deepStrictEqual(r, []);
});

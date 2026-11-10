// 10/11/2026: app MirabiWatt Fit (Expo). Obiettivi del giorno per gli anelli: previsti dal piano (stima dichiarata), svolti dai dati veri.
// Mai numeri inventati: se manca un dato (FTP, peso, calorie) il campo e' null e l'app mostra «non disponibile».
const test = require('node:test');
const assert = require('node:assert');
const { obiettiviGiorno } = require('../fit-oggi.js');

const OGGI = '2026-11-11';
const palestra = { nome: 'Petto-Spalle', dur: "50'", zona: 'Palestra', riposo: false, seduta: { seduta: 'Petto-Spalle' } };
const bici = { nome: 'EnduranceCorto', dur: '1h15', zona: 'Z2', riposo: false, seduta: null };
const base = { data: OGGI, attivita: [], sessioni: [], pesoKg: 82.5, ftp: 305, oreMovimentoObiettivo: 2 };

test('palestra: minuti dal piano e calorie stimate (MET 5 x peso x ore), dichiarate come stima', () => {
  const o = obiettiviGiorno({ ...base, giorno: palestra });
  assert.strictEqual(o.previsto.minuti, 50);
  assert.strictEqual(o.previsto.kcal, 344);
  assert.strictEqual(o.previsto.fonte, 'stima');
});

test('bici: kcal stimate dalla FTP, dalla zona e dalla durata (kJ ~ kcal)', () => {
  const o = obiettiviGiorno({ ...base, giorno: bici });
  assert.strictEqual(o.previsto.minuti, 75);
  assert.strictEqual(o.previsto.kcal, 892);   // 305 W x 0,65 x 3,6 x 1,25 h
});

test('senza FTP o senza peso: calorie previste null, i minuti restano', () => {
  assert.strictEqual(obiettiviGiorno({ ...base, ftp: null, giorno: bici }).previsto.kcal, null);
  assert.strictEqual(obiettiviGiorno({ ...base, pesoKg: null, giorno: palestra }).previsto.kcal, null);
  assert.strictEqual(obiettiviGiorno({ ...base, ftp: null, giorno: bici }).previsto.minuti, 75);
});

test('riposo o nessun giorno: niente previsto, niente percentuali', () => {
  const o = obiettiviGiorno({ ...base, giorno: { nome: 'Riposo', dur: '', zona: '', riposo: true, seduta: null } });
  assert.deepStrictEqual([o.previsto.minuti, o.previsto.kcal], [0, 0]);
  assert.strictEqual(o.anelli.find(a => a.id === 'calorie').percento, null);
  assert.strictEqual(obiettiviGiorno({ ...base, giorno: null }).previsto.minuti, 0);
});

test('svolto: seduta di palestra salvata oggi (minuti da inizio e fine, calorie stimate) e bici dai dati veri', () => {
  const sessioni = [{ data: OGGI, seduta: 'Petto-Spalle', inizio: '2026-11-11T12:00:00', fine: '2026-11-11T12:50:00' }];
  const attivita = [{ date: OGGI, type: 'Ride', durationMin: 60, kcal: 700 }];
  const o = obiettiviGiorno({ ...base, giorno: palestra, sessioni, attivita });
  assert.strictEqual(o.svolto.minuti, 110);
  assert.strictEqual(o.svolto.kcal, 1044);   // 344 stimate (palestra) + 700 misurate (bici)
  assert.strictEqual(o.svolto.kcalStimate, true, 'le calorie della palestra sono una stima: si dice');
});

test('l\'attivita Strava di pesi dello stesso giorno non si somma alla seduta salvata (niente doppioni)', () => {
  const sessioni = [{ data: OGGI, seduta: 'Petto-Spalle', inizio: '2026-11-11T12:00:00', fine: '2026-11-11T12:50:00' }];
  const attivita = [{ date: OGGI, type: 'WeightTraining', durationMin: 52, kcal: 300 }, { date: OGGI, type: '', durationMin: null, kcal: null }];
  const o = obiettiviGiorno({ ...base, giorno: palestra, sessioni, attivita });
  assert.strictEqual(o.svolto.minuti, 50);
});

test('attivita di altri giorni o senza durata non contano', () => {
  const attivita = [{ date: '2026-11-10', type: 'Ride', durationMin: 90, kcal: 900 }, { date: OGGI, type: 'Run', durationMin: null, kcal: null }];
  const o = obiettiviGiorno({ ...base, giorno: bici, attivita });
  assert.strictEqual(o.svolto.minuti, 0);
  assert.strictEqual(o.svolto.kcal, 0);
});

test('calorie mancanti in un\'attivita misurata: si segnalano, non si inventano', () => {
  const attivita = [{ date: OGGI, type: 'Run', durationMin: 40, kcal: null }];
  const o = obiettiviGiorno({ ...base, giorno: bici, attivita });
  assert.strictEqual(o.svolto.minuti, 40);
  assert.strictEqual(o.svolto.kcal, null);
});

test('movimento: ore svolte = tempo di allenamento (Health Connect si aggiungera), obiettivo dal profilo, null se non impostato', () => {
  const attivita = [{ date: OGGI, type: 'Ride', durationMin: 90, kcal: 800 }];
  const o = obiettiviGiorno({ ...base, giorno: bici, attivita });
  assert.deepStrictEqual(o.movimento, { oreSvolte: 1.5, oreObiettivo: 2, fonte: 'allenamenti' });
  assert.strictEqual(obiettiviGiorno({ ...base, giorno: bici, oreMovimentoObiettivo: null }).movimento.oreObiettivo, null);
});

test('anelli: valore, obiettivo e percentuale (anche oltre il 100%)', () => {
  const attivita = [{ date: OGGI, type: 'Ride', durationMin: 90, kcal: 1000 }];
  const o = obiettiviGiorno({ ...base, giorno: bici, attivita });
  const per = id => o.anelli.find(a => a.id === id);
  assert.deepStrictEqual([per('calorie').valore, per('calorie').obiettivo, per('calorie').percento], [1000, 892, 112]);
  assert.deepStrictEqual([per('minuti').valore, per('minuti').obiettivo, per('minuti').percento], [90, 75, 120]);
  assert.deepStrictEqual([per('movimento').valore, per('movimento').obiettivo, per('movimento').percento], [1.5, 2, 75]);
});

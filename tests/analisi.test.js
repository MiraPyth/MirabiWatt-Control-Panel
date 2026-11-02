// Analisi FTP e Fitness (14/10/2026): logica in analisi.js. Migliori sforzi dalla curva, profilo di potenza sulla scala
// di Coggan (uomini, W/kg), fasce della Forma come intervals.icu, serie Fitness/Fatica con la previsione dal piano.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console });
for (const f of ['season-plan.js', 'workout-library.js', 'calendario.js', 'analisi.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
const A = vm.runInContext('Analisi', ctx), Cal = vm.runInContext('Cal', ctx);
const uguale = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

const CURVA = { secs: [1, 2, 5, 60, 180, 300, 600, 720, 1200, 3600], watts: [958, 952, 945, 422, 380, 360, 312, 311, 291, 250], wkg: [11.67, 11.6, 11.51, 5.05, 4.54, 4.3, 3.73, 3.72, 3.48, 3.0] };

test('migliori sforzi alle durate di intervals.icu', () => {
  const m = A.migliori(CURVA);
  uguale(m.map(x => x.label), ['1s', '5s', '60s', '3m', '5m', '10m', '12m', '20m']);
  uguale(m.map(x => x.watts), [958, 945, 422, 380, 360, 312, 311, 291]);
  uguale(m.find(x => x.label === '20m').wkg, 3.48);
  const corta = A.migliori({ secs: [1, 5], watts: [900, 800], wkg: [11, 10] });
  assert.strictEqual(corta.find(x => x.label === '20m').watts, null, 'durata che manca: vuoto, non inventato');
});

test('profilo di potenza sulla scala di Coggan: livello da 0 a 100, categoria, tipo di ciclista', () => {
  // estremi della tabella di Coggan (uomini): 5s 10.17–25.18, 1m 5.64–11.50, 5m 2.33–7.60, FTP 1.86–6.40
  const top = A.profilo({ s5: 25.18, m1: 11.5, m5: 7.6, ftp: 6.4 });
  uguale(top.voci.map(v => v.livello), [100, 100, 100, 100]);
  assert.strictEqual(top.voci[0].categoria, 'Livello mondiale');
  const basso = A.profilo({ s5: 9, m1: 5, m5: 2, ftp: 1.5 });
  uguale(basso.voci.map(v => v.livello), [0, 0, 0, 0]);
  assert.strictEqual(basso.voci[3].categoria, 'Non allenato');
  const p = A.profilo({ s5: 14.75, m1: 6.94, m5: 4.92, ftp: 3.89 });
  assert.ok(Math.abs(p.voci[2].livello - (4.92 - 2.33) / (7.6 - 2.33) * 100) <= 0.05, 'livello arrotondato a un decimale');
  assert.match(p.tipo, /Puncheur|Completo|Passista|Velocista/);
  assert.strictEqual(A.profilo({ s5: 20, m1: 6, m5: 3, ftp: 2.5 }).tipo, 'Velocista');
  assert.strictEqual(A.profilo({ s5: 12, m1: 6.2, m5: 4, ftp: 4.6 }).tipo, 'Passista');
  assert.strictEqual(A.profilo({ s5: 17.7, m1: 8.6, m5: 4.97, ftp: 4.13 }).tipo, 'Completo (all rounder)', 'livelli vicini fra loro');
});

test('fasce della Forma come intervals.icu', () => {
  uguale([25, 20.5, 12, 5, 0, -10, -20, -31].map(x => A.zonaForma(x).id), ['transizione', 'transizione', 'fresco', 'fresco', 'grigia', 'grigia', 'ottimale', 'rischio']);
  assert.strictEqual(A.zonaForma(-20).nome, 'Ottimale');
});

test('serie Fitness/Fatica: i giorni veri, poi la previsione dal piano fino alla fine del periodo', () => {
  const giorni = [{ data: '2026-10-12', ctl: 45, atl: 48, carico: 60 }, { data: '2026-10-13', ctl: 46, atl: 50, carico: 80 }];
  const s = A.serieFitness(giorni, '2026-10-13', '2026-10-20');
  uguale(s.map(x => x.data), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  assert.ok(s.slice(0, 2).every(x => !x.previsto) && s.slice(2).every(x => x.previsto));
  let ctl = 46, atl = 50;
  const tss = Cal.tssDelGiorno('2026-10-14');
  ctl += (tss - ctl) / 42; atl += (tss - atl) / 7;
  assert.strictEqual(s[2].ctl, Math.round(ctl * 10) / 10);
  assert.strictEqual(s[2].form, Math.round((ctl - atl) * 10) / 10);
  assert.strictEqual(s[1].form, -4);
  // senza giorni futuri nel periodo: solo quelli veri
  assert.strictEqual(A.serieFitness(giorni, '2026-10-13', '2026-10-13').length, 2);
});

test('periodi rapidi', () => {
  uguale(A.periodo('42g', '2026-10-14'), { start: '2026-09-03', end: '2026-10-14' });
  uguale(A.periodo('1m', '2026-10-14'), { start: '2026-09-14', end: '2026-10-14' });
  uguale(A.periodo('prossimo', '2026-10-14'), { start: '2026-09-30', end: '2026-11-14' });
  uguale(A.periodo('stagione', '2026-10-14'), { start: '2026-09-21', end: '2026-10-14' });
  assert.strictEqual(A.periodo('6m', '2026-10-14').start, '2026-04-14');
});

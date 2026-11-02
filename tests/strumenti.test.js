// Zone di potenza dalla FTP attuale e Tools rifatti (14/10/2026): logica pura in strumenti.js. Fisica del moto (stessi
// coefficienti dei Tools di prima), idratazione, quanto reggi sopra il CP con il W' (modello CP/W'), confronto FTP/eFTP.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'strumenti.js'), 'utf8'), ctx);
const S = vm.runInContext('Strumenti', ctx);
const uguale = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

test('zone di potenza in watt dalla FTP e dalle percentuali di intervals.icu', () => {
  const z = S.zone(305, [55, 75, 90, 105, 120, 150, 999], ['Active Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 Max', 'Anaerobic', 'Neuromuscular']);
  uguale(z.map(x => [x.n, x.da, x.a]), [['Z1', 0, 168], ['Z2', 169, 229], ['Z3', 230, 275], ['Z4', 276, 320], ['Z5', 321, 366], ['Z6', 367, 458], ['Z7', 459, null]]);
  uguale(z.map(x => x.nome), ['Recupero attivo', 'Resistenza', 'Tempo', 'Soglia', 'VO2max', 'Anaerobica', 'Neuromuscolare']);
  assert.strictEqual(S.zone(300).length, 7, 'senza zone di intervals: le 7 di Coggan');
});

test('FTP impostata contro eFTP: quando conviene un test', () => {
  assert.strictEqual(S.confrontoFtp(305, 287).stato, 'sotto');
  assert.strictEqual(S.confrontoFtp(305, 320).stato, 'sopra');
  assert.strictEqual(S.confrontoFtp(305, 300).stato, 'ok');
  assert.ok(Math.abs(S.confrontoFtp(305, 287).diff - (287 - 305) / 305 * 100) < 1e-9);
});

test('quanto reggi sopra il CP: W\' / (P − CP); sotto il CP a lungo', () => {
  assert.strictEqual(S.durataSopraCp(381, 281, 24960), 24960 / 100);
  assert.strictEqual(S.durataSopraCp(270, 281, 24960), Infinity);
});

test('fisica del moto: potenza per una velocità e il suo inverso', () => {
  const p = S.potenza(30, 0, 90);
  const v = 30 / 3.6, atteso = (90 * 9.81 * 0.004 * v + 0.5 * 1.225 * 0.32 * v ** 3) / 0.97;
  assert.ok(Math.abs(p.totale - atteso) < 1e-9);
  assert.ok(p.aero > p.gravita && p.gravita === 0, 'in pianura domina l\'aria');
  assert.ok(Math.abs(S.velocita(p.totale, 0, 90) - 30) < 0.01);
  const salita = S.potenza(15, 8, 90);
  assert.ok(salita.gravita > salita.aero, 'all\'8% domina la gravità');
});

test('salita: tempo e VAM con la potenza scelta, e quanto la reggi', () => {
  const s = S.salita({ km: 10, dislivello: 800, massa: 90.75, watt: 305, cp: 281, wPrime: 24960 });
  assert.strictEqual(s.pendenza, 8);
  assert.ok(Math.abs(s.velocita - S.velocita(305, 8, 90.75)) < 1e-9);
  assert.ok(Math.abs(s.tempoOre - 10 / s.velocita) < 1e-12);
  assert.strictEqual(s.vam, Math.round(800 / s.tempoOre));
  assert.ok(s.reggi > 0 && s.reggi === 24960 / (305 - 281), 'sopra il CP: W\' finisce dopo W\'/(P−CP) secondi');
  assert.strictEqual(s.esaurito, s.tempoOre * 3600 > s.reggi, 'la salita dura più di quanto reggi');
  assert.ok(s.livelli.length >= 5 && s.livelli.every(l => l.watt > 0));
});

test('idratazione: maltodestrine e fruttosio, concentrazione, tonicità, limite', () => {
  const i = S.idratazione({ ratio: '2:1', volume: 750, carbo: 60, sale: 1 });
  uguale([Math.round(i.malto), Math.round(i.fruttosio), i.conc, i.tonicita], [40, 20, 8, 'Isotonica']);
  const j = S.idratazione({ ratio: '1:0.8', volume: 500, carbo: 400, sale: 0 });
  assert.strictEqual(j.carbo, 250, 'al massimo metà del volume in grammi');
  assert.ok(j.limitato);
  assert.ok(Math.abs(j.fruttosio / j.malto - 0.8) < 1e-9);
  assert.strictEqual(S.idratazione({ ratio: '2:1', volume: 1000, carbo: 40, sale: 0 }).tonicita, 'Ipotonica');
});

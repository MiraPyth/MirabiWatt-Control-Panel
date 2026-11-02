// 19/10/2026: app di allenamento in palestra. La scheda strutturata per il tracker (serie, ripetizioni, recupero,
// GIF, attrezzo), la proposta del carico dallo storico (doppia progressione), la sessione da compilare, il riepilogo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { pianoPalestra, ESERCIZI_PALESTRA } = require('../workout-library.js');
const P = require('../palestra.js');

test('scheda strutturata: serie, ripetizioni, recupero in secondi, GIF, attrezzo, perché', () => {
  const p = pianoPalestra('Petto-Spalle (costruzione 4)');
  assert.strictEqual(p.seduta, 'Petto-Spalle');
  assert.strictEqual(p.schema, 'costruzione 4');
  assert.strictEqual(p.esercizi.length, 9);
  const panca = p.esercizi.find(e => e.id === 'panca-piana-manubri');
  assert.deepStrictEqual([panca.serie, panca.reps, panca.rir, panca.recSec, panca.gif, panca.attrezzo],
    [4, [6, 10], '1', 150, 'SpYC0Kp', 'manubri']);
  assert.ok(panca.perche.length > 40);
  assert.ok(p.scopo && p.perche);
  const pallof = pianoPalestra('Gambe-Core (costruzione 1)').esercizi.find(e => e.id === 'pallof-press');
  assert.deepStrictEqual([pallof.unita, pallof.reps, pallof.repsTesto], ['reps', [10, 10], '10 per lato']);
});

test('ogni esercizio ha la sua GIF sull\'OptiPlex e i consigli di tecnica in italiano', () => {
  for (const [seduta, lista] of Object.entries(ESERCIZI_PALESTRA)) for (const e of lista) {
    assert.ok(e.id && e.gif && e.attrezzo, `${seduta}: ${e.nome}`);
    assert.ok(fs.statSync(path.join(__dirname, '..', 'palestra-gif', `${e.gif}.gif`)).size > 1000, e.gif);
    assert.ok(e.consigli && e.consigli.length >= 2, `${e.nome}: consigli`);
  }
});

const PANCA = { id: 'panca-piana-manubri', attrezzo: 'manubri', reps: [8, 12], serie: 3 };

test('proposta del carico: prima volta, progressione, stesso carico', () => {
  // 19/10/2026 notte: prima volta dopo 2 anni di stop → il carico di partenza prudente della scheda, non un campo vuoto
  const prima = P.proposta({ ...PANCA, partenza: [14, 16] }, null);
  assert.strictEqual(prima.kg, 14);
  assert.match(prima.nota, /14-16 kg per manubrio/);
  assert.match(prima.nota, /RIR/);
  assert.strictEqual(P.proposta(PANCA, null).kg, null, 'senza partenza: lo scegli tu');
  const tutte = { data: '2026-10-12', serie: [{ kg: 14, reps: 12 }, { kg: 14, reps: 12 }, { kg: 14, reps: 12 }] };
  const su = P.proposta(PANCA, tutte);
  assert.strictEqual(su.kg, 16);
  assert.match(su.nota, /16 kg/);
  const non = { data: '2026-10-12', serie: [{ kg: 14, reps: 12 }, { kg: 14, reps: 10 }, { kg: 14, reps: 9 }] };
  assert.strictEqual(P.proposta(PANCA, non).kg, 14);
  assert.strictEqual(P.proposta({ ...PANCA, attrezzo: 'macchina' }, { serie: [{ kg: 40, reps: 12 }, { kg: 40, reps: 12 }, { kg: 40, reps: 12 }] }).kg, 45);
  assert.strictEqual(P.proposta({ ...PANCA, attrezzo: 'corpo' }, tutte).kg, null, 'corpo libero: niente kg');
});

test('la sessione nasce precompilata con la proposta e le ripetizioni dell\'ultima volta', () => {
  const piano = pianoPalestra('Petto-Spalle (costruzione 2)');
  const ultimi = { 'spinte-inclinata-manubri': { data: '2026-10-12', serie: [{ kg: 14, reps: 9 }, { kg: 14, reps: 8 }, { kg: 14, reps: 7 }] } };
  const s = P.nuovaSessione(piano, ultimi, '2026-10-19T17:00:00.000Z');
  assert.strictEqual(s.id, '2026-10-19T17:00:00.000Z');
  assert.strictEqual(s.data, '2026-10-19');
  const e = s.esercizi[0];
  assert.deepStrictEqual(e.serie.map(x => [x.kg, x.reps, x.fatta]), [[14, 9, false], [14, 8, false], [14, 7, false]]);
  assert.strictEqual(s.esercizi[1].serie[0].kg, 14, 'mai fatto: il carico di partenza prudente');
  assert.strictEqual(s.esercizi[1].serie[0].reps, 6, 'mai fatto: il minimo dell\'intervallo');
});

test('riepilogo: solo le serie fatte', () => {
  const s = P.nuovaSessione(pianoPalestra('Petto-Spalle (costruzione 2)'), {}, '2026-10-19T17:00:00.000Z');
  s.esercizi[0].serie[0] = { kg: 14, reps: 12, fatta: true };
  s.esercizi[0].serie[1] = { kg: 14, reps: 10, fatta: true };
  s.esercizi[1].serie[0] = { kg: 12, reps: 10, fatta: false };
  const r = P.riepilogo(s, '2026-10-19T18:05:00.000Z');
  assert.deepStrictEqual([r.serieFatte, r.esercizi, r.kg, r.durataMin], [2, 1, 14 * 12 + 14 * 10, 65]);
});

test('dallo storico l\'ultima volta di ogni esercizio, con le sole serie fatte', () => {
  const storico = [
    { id: 'a', data: '2026-10-05', esercizi: [{ id: 'panca-piana-manubri', serie: [{ kg: 12, reps: 12, fatta: true }] }] },
    { id: 'b', data: '2026-10-12', esercizi: [{ id: 'panca-piana-manubri', serie: [{ kg: 14, reps: 12, fatta: true }, { kg: 14, reps: 8, fatta: false }] },
      { id: 'curl-cavi', serie: [{ kg: 10, reps: 12, fatta: false }] }] }
  ];
  const u = P.ultimiDaStorico(storico);
  assert.deepStrictEqual(u['panca-piana-manubri'], { data: '2026-10-12', serie: [{ kg: 14, reps: 12 }] });
  assert.strictEqual(u['curl-cavi'], undefined, 'nessuna serie fatta: non vale come ultima volta');
});

test('ogni esercizio con i pesi ha un carico di partenza, gli esercizi a corpo libero no', () => {
  const { ESERCIZI_PALESTRA } = require('../workout-library.js');
  for (const lista of Object.values(ESERCIZI_PALESTRA)) for (const e of lista) {
    // 25/10/2026: con l'elastico non c'è un carico in kg da prescrivere, come a corpo libero
    if (e.attrezzo === 'corpo' || e.attrezzo === 'elastico') assert.ok(!e.partenza, e.nome);
    else { assert.ok(Array.isArray(e.partenza) && e.partenza[0] > 0 && e.partenza[1] >= e.partenza[0], e.nome); }
  }
});

// 19/10/2026 notte: «l'app deve essere una guida step by step, la mia mente non è affidabile». Le serie di avvicinamento
// sono righe vere (che non contano nello storico) e l'app dice sempre qual è il prossimo passo.
test('serie di avvicinamento: 2 sui multiarticolari, 1 sul primo isolamento di un muscolo, nessuna se il muscolo è già caldo', () => {
  const s = P.nuovaSessione(pianoPalestra('Gambe-Core (costruzione 1)'), {}, '2026-11-25T17:00:00.000Z');
  const per = id => s.esercizi.find(e => e.id === id).avvicinamento.map(a => [a.pct, a.reps]);
  assert.deepStrictEqual(per('squat-bilanciere'), [[0.5, 10], [0.75, 5]]);
  assert.deepStrictEqual(per('leg-extension'), [], 'quadricipiti già caldi dallo squat');
  assert.deepStrictEqual(per('calf-raise'), [[0.5, 10]], 'polpacci: primo esercizio del muscolo');
  assert.deepStrictEqual(per('hanging-knee-raise'), [], 'corpo libero: niente pesi da scaldare');
});

test('kg delle serie di avvicinamento: percentuale del carico vero, arrotondata ai pesi che esistono', () => {
  assert.strictEqual(P.kgAvvicinamento({ attrezzo: 'manubri' }, 16, 0.5), 8);
  assert.strictEqual(P.kgAvvicinamento({ attrezzo: 'manubri' }, 16, 0.75), 12);
  assert.strictEqual(P.kgAvvicinamento({ attrezzo: 'bilanciere' }, 40, 0.5), 20, 'mai meno del bilanciere vuoto');
  assert.strictEqual(P.kgAvvicinamento({ attrezzo: 'bilanciere' }, 50, 0.75), 37.5);
  assert.strictEqual(P.kgAvvicinamento({ attrezzo: 'macchina' }, 40, 0.5), 20);
  assert.strictEqual(P.kgAvvicinamento({ attrezzo: 'manubri' }, null, 0.5), null);
});

test('il prossimo passo: prima gli avvicinamenti, poi le serie vere, poi «esercizio finito»', () => {
  const s = P.nuovaSessione(pianoPalestra('Petto-Spalle (adattamento 1)'), {}, '2026-10-26T17:00:00.000Z');
  const e = s.esercizi[0];
  let p = P.prossimoPasso(e);
  assert.deepStrictEqual([p.tipo, p.indice], ['avvicinamento', 0]);
  assert.match(p.testo, /Avvicinamento 1 di 2/);
  assert.match(p.testo, /6 kg × 10/);
  assert.match(p.testo, /non conta/);
  e.avvicinamento.forEach(a => { a.fatta = true; });
  p = P.prossimoPasso(e);
  assert.deepStrictEqual([p.tipo, p.indice], ['serie', 0]);
  assert.match(p.testo, /Serie 1 di 2/);
  assert.match(p.testo, /12 kg × 6-10/);
  assert.match(p.testo, /4 in canna/);
  e.serie.forEach(x => { x.fatta = true; });
  assert.strictEqual(P.prossimoPasso(e).tipo, 'finito');
});

// 19/10/2026: più piani stagionali salvati sull'OptiPlex (piani/*.json), uno attivo.
// «Piano invernale full cycling» = il piano di prima, intatto. «Piano invernale mixed body building» = 3 palestre
// (lun/mer/ven), Zwift Race il martedì, endurance il giovedì, un lungo outdoor nel weekend; le gare restano obiettivi.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const piani = require('../piani.js');
const SP = require('../season-plan.js');
const { getWorkoutDetail, baseName } = require('../workout-library.js');

const FULL = piani.leggi('full-cycling');
const MIX = piani.leggi('mixed-body-building');
const INIZIO = MIX.inizioPalestra;
const { genera } = require('../scripts/piano-mixed.js');
const minuti = s => { if (!s) return 0; const h = s.match(/^(\d+)h(\d+)?/); return h ? +h[1] * 60 + (+h[2] || 0) : parseInt(s, 10) || 0; };
const giorni = p => p.detailedPhases.flatMap(f => f.weeks.map((w, i) => ({ fase: f, w, ws: SP.fmtISO(SP.addDays(SP.mondayOf(SP.parseISO(f.start)), i * 7)) })));

test('i due piani salvati, con i loro nomi', () => {
  const e = piani.elenco();
  assert.deepStrictEqual(e.map(p => [p.id, p.nome]).sort(), [
    ['full-cycling', 'Piano invernale full cycling'],
    ['mixed-body-building', 'Piano invernale mixed body building']]);
});

test('full cycling è il piano di prima, identico', () => {
  const { id, nome, ...resto } = FULL;
  const { id: _i, nome: _n, ...prima } = SP.SEASON;
  assert.deepStrictEqual(resto, JSON.parse(JSON.stringify(prima)));
});

const SPECIALI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'piani', 'settimane-speciali.json'), 'utf8'));

test('mixed: le settimane già passate restano quelle vere, le gare restano obiettivi', () => {
  // tranne le settimane decise a mano (25/10/2026: fuori casa con gli elastici)
  const passate = w => w.ws < INIZIO && !SPECIALI[w.ws];
  const a = giorni(FULL).filter(passate).map(x => x.w), b = giorni(MIX).filter(passate).map(x => x.w);
  assert.ok(a.length >= 4);
  assert.deepStrictEqual(b, a);
  assert.deepStrictEqual(MIX.events, FULL.events);
  assert.strictEqual(MIX.start, FULL.start);
});

test('mixed: dal lunedì scelto la settimana tipo dell\'utente', () => {
  const nuove = giorni(MIX).filter(x => x.ws >= INIZIO);
  assert.ok(nuove.length >= 8, 'almeno 8 settimane con il dettaglio');
  for (const { w, ws } of nuove) {
    const g = Object.fromEntries(w.days.map(d => [d.d, d]));
    assert.deepStrictEqual(w.days.map(d => d.d), ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'], ws);
    for (const d of ['Lun', 'Mer', 'Ven']) assert.strictEqual(g[d].zone, 'Palestra', `${ws} ${d}`);
    assert.strictEqual(g.Mar.s, 'Zwift Race', ws);
    assert.match(g.Gio.s, /^Endurance/, ws);
    const lunghi = ['Sab', 'Dom'].filter(d => g[d].critical && /Z2/.test(g[d].zone || ''));
    assert.strictEqual(lunghi.length, 1, `${ws}: un solo lungo nel weekend`);
    const altro = ['Sab', 'Dom'].find(d => !lunghi.includes(d));
    assert.strictEqual(g[altro].s, 'Riposo', `${ws}: l'altro giorno del weekend è libero (per spostarci il lungo)`);
    assert.match(g[lunghi[0]].note || '', /outdoor/i);
  }
});

test('mixed: ogni seduta ha la sua scheda (niente «dettaglio non disponibile»)', () => {
  for (const { w, ws } of giorni(MIX)) for (const d of w.days) {
    if (/^Riposo/.test(d.s) || d.s === 'Corpo libero e MSR') continue;
    const det = getWorkoutDetail(d.s, 300, 280);
    assert.ok(det.totalMin, `${ws} ${d.d} ${d.s}`);
  }
});

test('mixed: prima il ri-adattamento, poi un vero scarico nel blocco di costruzione', () => {
  const nuove = giorni(MIX).filter(x => x.ws >= INIZIO);
  const schemi = nuove.map(x => (x.w.days[0].s.match(/\((.+)\)/) || [])[1]);
  assert.deepStrictEqual(schemi.slice(0, 4), ['adattamento 1', 'adattamento 2', 'adattamento 3', 'adattamento 4']);
  const scarico = schemi.indexOf('scarico');
  assert.ok(scarico > 4 && scarico <= 8, 'scarico entro la 4ª-5ª settimana di carico');
  const ws = nuove[scarico].w;
  // il volume che mostra il calendario: la durata «dur» delle sedute (60-75' conta 60)
  const min = w => w.days.reduce((t, d) => t + minuti(d.dur), 0);
  const ore = min(ws), piena = min(nuove[scarico - 1].w);
  assert.ok(ore < piena * 0.8, 'la settimana di scarico cala davvero');
});

test('mixed: fasi contigue dall\'inizio stagione alla fine della transizione (ottobre 2027)', () => {
  const fasi = [...MIX.detailedPhases, ...MIX.summaryPhases];
  for (let i = 1; i < fasi.length; i++) {
    assert.strictEqual(SP.fmtISO(SP.addDays(SP.parseISO(fasi[i - 1].end), 1)), fasi[i].start, `${fasi[i - 1].id} → ${fasi[i].id}`);
  }
  assert.strictEqual(fasi[fasi.length - 1].end, '2027-10-10');
  for (const p of MIX.summaryPhases) for (const k of ['hours', 'hit', 'focus', 'detail']) assert.ok(p[k], `${p.id}.${k}`);
});

test('usaPiano cambia il piano che usano calendario e server', () => {
  const prima = JSON.parse(JSON.stringify(SP.SEASON));
  try {
    SP.usaPiano(MIX);
    assert.strictEqual(SP.SEASON.id, 'mixed-body-building');
    assert.strictEqual(SP.findDetailedWeek(INIZIO).week.days[0].zone, 'Palestra');
    SP.usaPiano(FULL);
    assert.strictEqual(SP.findDetailedWeek(INIZIO).week.days[0].s, 'Riposo');
  } finally { SP.usaPiano(prima); }
});

test('scelta del piano attivo, salvata su file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piani-'));
  for (const f of ['full-cycling.json', 'mixed-body-building.json']) fs.copyFileSync(path.join(piani.DIR, f), path.join(dir, f));
  assert.strictEqual(piani.attivo(dir), 'full-cycling', 'senza scelta: il piano di prima');
  piani.scegli('mixed-body-building', dir);
  assert.strictEqual(piani.attivo(dir), 'mixed-body-building');
  assert.throws(() => piani.scegli('../server', dir));
  assert.strictEqual(piani.attivo(dir), 'mixed-body-building');
});

// 19/10/2026 sera: «questa settimana mantengo il piano di prima, la palestra parte quando decido io».
// 25/10/2026: fuori casa la settimana del 26/10, la palestra parte il 2/11.
test('la palestra parte lunedì 2/11: la settimana del 19/10 resta quella di prima', () => {
  assert.strictEqual(INIZIO, '2026-11-02');
  SP.usaPiano(MIX);
  try {
    const a = SP.findDetailedWeek('2026-10-21').week, b = (SP.usaPiano(FULL), SP.findDetailedWeek('2026-10-21').week);
    assert.deepStrictEqual(a, b);
  } finally { SP.usaPiano(FULL); }
});

test('inizio spostato più avanti: le settimane prima restano full cycling, poi parte il ri-adattamento', () => {
  const p = genera(FULL, '2026-11-09');
  assert.strictEqual(p.inizioPalestra, '2026-11-09');
  const sett = giorni(p);
  for (const ws of ['2026-10-19', '2026-10-26', '2026-11-02']) {
    assert.deepStrictEqual(sett.find(x => x.ws === ws).w, giorni(FULL).find(x => x.ws === ws).w, ws);
  }
  const prima = sett.find(x => x.ws === '2026-11-09');
  assert.strictEqual(prima.fase.id, 'riadatt');
  assert.match(prima.w.days[0].s, /adattamento 1/);
  const fasi = [...p.detailedPhases, ...p.summaryPhases];
  for (let i = 1; i < fasi.length; i++) assert.strictEqual(SP.fmtISO(SP.addDays(SP.parseISO(fasi[i - 1].end), 1)), fasi[i].start, `${fasi[i - 1].id} → ${fasi[i].id}`);
});

test('inizio non valido: non un lunedì o fuori dalla finestra', () => {
  assert.throws(() => genera(FULL, '2026-10-28'));
  assert.throws(() => genera(FULL, '2026-11-16'), /tra/);
  assert.throws(() => genera(FULL, '2026-10-12'));
});

// 19/10/2026 sera: piano per migliorare in generale, non centrato sulle gare (eventi facoltativi, «settimana evento»).
test('anno: ri-adattamento → costruzione → (feste) → definizione → mantenimento → transizione, niente fasi da gara', () => {
  // le feste ci sono solo se la costruzione finisce prima del 4/1: con la palestra dal 2/11 lo scarico cade a Capodanno
  const ids = [...MIX.detailedPhases, ...MIX.summaryPhases].map(f => f.id).filter(id => !['prep', 'base1', 'feste'].includes(id));
  assert.deepStrictEqual(ids, ['riadatt', 'costruzione', 'definizione', 'mantenimento', 'transizione']);
  assert.ok(MIX.eventiFacoltativi);
  assert.ok(MIX.planB.evento, 'la settimana evento è una scelta di Ripianifica');
  const def = MIX.detailedPhases.find(f => f.id === 'definizione');
  assert.strictEqual(def.start, '2027-01-04');
  assert.strictEqual(def.end, '2027-03-28');
});

test('ogni settimana nuova dice perché e con che alimentazione; pausa dalla dieta ogni 5 in definizione', () => {
  for (const { w, ws } of giorni(MIX).filter(x => x.ws >= INIZIO)) {
    assert.ok(w.perche && w.perche.length > 80, `${ws}: perché`);
    assert.ok(['mantenimento', 'costruzione', 'definizione'].includes(w.nutrizione), `${ws}: ${w.nutrizione}`);
  }
  const def = giorni(MIX).filter(x => x.fase.id === 'definizione');
  assert.deepStrictEqual(def.map(x => x.w.nutrizione).slice(0, 5), ['definizione', 'definizione', 'definizione', 'definizione', 'mantenimento']);
  assert.match(def[4].w.days[0].s, /scarico/);
});

test('la fase nutrizionale del giorno viene dalla settimana del piano', () => {
  const prima = JSON.parse(JSON.stringify(SP.SEASON));
  try {
    SP.usaPiano(MIX);
    assert.strictEqual(SP.faseNutrizione('2026-10-21'), 'mantenimento', 'prima della palestra');
    assert.strictEqual(SP.faseNutrizione('2026-11-30'), 'costruzione');
    assert.strictEqual(SP.faseNutrizione('2027-01-12'), 'definizione');
    assert.strictEqual(SP.faseNutrizione('2027-02-03'), 'mantenimento', 'pausa dalla dieta (5ª settimana)');
    assert.strictEqual(SP.faseNutrizione('2027-06-01'), 'mantenimento', 'fase sommaria');
    SP.usaPiano(FULL);
    assert.strictEqual(SP.faseNutrizione('2027-01-12'), 'mantenimento', 'il piano full cycling non ha fasi nutrizionali');
  } finally { SP.usaPiano(prima); }
});

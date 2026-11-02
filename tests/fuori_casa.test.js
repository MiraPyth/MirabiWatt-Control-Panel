// 25/10/2026, richiesta dell'utente: «da domani avrei dovuto ricominciare la palestra e non riesco: sono fuori città
// con i classici elastici. Sabato o domenica un giro in MTB, forse un'uscita martedì a pranzo e venerdì pomeriggio.
// Dovrebbe essere la settimana di scarico». Dopo 3 settimane di Base 1 (nel piano full cycling la 4ª era «Scarico"),
// la settimana 26/10 diventa scarico con gli elastici e la palestra parte lunedì 2/11.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const piani = require('../piani.js');
const SP = require('../season-plan.js');
const { getWorkoutDetail, pianoPalestra, ESERCIZI_PALESTRA } = require('../workout-library.js');
const { eventoAllenamento } = require('../intervals-evento.js');
const Palestra = require('../palestra.js');
const { genera, scrivi } = require('../scripts/piano-mixed.js');

const FULL = piani.leggi('full-cycling');
const MIX = piani.leggi('mixed-body-building');
const GIF = path.join(__dirname, '..', 'palestra-gif');

function settimanaDi(piano, lunedi) {
  for (const f of piano.detailedPhases) {
    const l0 = SP.fmtISO(SP.mondayOf(SP.parseISO(f.start)));
    const i = f.weeks.findIndex((_, k) => SP.fmtISO(SP.addDays(SP.parseISO(l0), k * 7)) === lunedi);
    if (i >= 0) return { fase: f, w: f.weeks[i] };
  }
  return null;
}

test('tre sedute con gli elastici, ognuna con la sua scheda guidata', () => {
  for (const seduta of ['Elastici Spinta', 'Elastici Gambe-Core', 'Elastici Tirata']) {
    const nome = `${seduta} (elastici)`;
    const d = getWorkoutDetail(nome);
    assert.ok(d.palestra, nome);
    assert.ok(d.totalMin >= 25 && d.totalMin <= 45, `${nome}: ${d.totalMin}'`);
    const p = pianoPalestra(nome);
    assert.ok(p.esercizi.length >= 5, nome);
    for (const e of p.esercizi) {
      assert.strictEqual(e.attrezzo, 'elastico', e.nome);
      assert.strictEqual(e.rir, '3', e.nome);
      assert.ok(e.serie <= 2, `${e.nome}: scarico, al massimo 2 serie`);
    }
    assert.doesNotMatch(p.riscaldamento, /cyclette|vogatore/, 'fuori casa non c\'è la cyclette');
  }
});

test('ogni esercizio della libreria ha la sua animazione sul disco', () => {
  for (const [seduta, lista] of Object.entries(ESERCIZI_PALESTRA)) {
    for (const e of lista) assert.ok(fs.existsSync(path.join(GIF, `${e.gif}.gif`)), `${seduta}: ${e.nome} (${e.gif})`);
  }
});

test('con l\'elastico niente carichi da proporre né serie di avvicinamento', () => {
  const es = { attrezzo: 'elastico', tipo: 'iso', reps: [12, 15], serie: 2 };
  assert.strictEqual(Palestra.proposta(es, null).kg, null);
  assert.deepStrictEqual(Palestra.avvicinamenti(es, false), []);
});

test('uscita a piedi e giro in MTB: scheda e tipo giusto su intervals.icu', () => {
  for (const s of ['Uscita a pranzo', 'Uscita facoltativa', 'MTB Endurance']) {
    const d = getWorkoutDetail(s);
    assert.doesNotMatch(d.uiSteps[0].text, /non ancora disponibile/, s);
  }
  const mtb = { d: 'Dom', s: 'MTB Endurance', dur: '2h-2h30', zone: 'Z2', icuType: 'MountainBikeRide' };
  assert.strictEqual(eventoAllenamento(mtb, '2026-11-01', getWorkoutDetail(mtb.s)).type, 'MountainBikeRide');
  const piedi = { d: 'Mar', s: 'Uscita a pranzo', dur: '45\'', zone: 'Z1-Z2', icuType: 'Workout' };
  assert.strictEqual(eventoAllenamento(piedi, '2026-10-27', getWorkoutDetail(piedi.s)).type, 'Workout');
  const bici = { d: 'Gio', s: 'EnduranceCorto', dur: '1h', zone: 'Z2' };
  assert.strictEqual(eventoAllenamento(bici, '2026-10-29', getWorkoutDetail(bici.s)).type, 'Ride', 'le altre restano Ride');
});

test('piano attivo: settimana 26/10 di scarico fuori casa, palestra dal 2/11', () => {
  assert.strictEqual(MIX.inizioPalestra, '2026-11-02');
  const { w } = settimanaDi(MIX, '2026-10-26');
  assert.match(w.label, /Scarico/);
  assert.strictEqual(w.nutrizione, 'mantenimento');
  const g = Object.fromEntries(w.days.map(d => [d.d, d]));
  assert.match(g.Lun.s, /^Elastici Spinta/);
  assert.strictEqual(g.Mar.s, 'Uscita a pranzo');
  assert.match(g.Mer.s, /^Elastici Gambe-Core/);
  assert.match(g.Gio.s, /^Elastici Tirata/);
  assert.strictEqual(g.Ven.s, 'Uscita facoltativa');
  assert.strictEqual(g.Dom.s, 'MTB Endurance');
  assert.strictEqual(g.Dom.icuType, 'MountainBikeRide');
  for (const d of w.days.filter(x => /^Elastici/.test(x.s))) assert.strictEqual(d.zone, 'Palestra', d.s);
  const dopo = settimanaDi(MIX, '2026-11-02');
  assert.strictEqual(dopo.fase.id, 'riadatt');
  assert.match(dopo.w.days[0].s, /Petto-Spalle \(adattamento 1\)/);
});

test('le settimane speciali sopravvivono alla rigenerazione del piano', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-speciali-'));
  const fileMix = path.join(dir, 'mix.json'), fileSpec = path.join(dir, 'speciali.json');
  fs.writeFileSync(fileSpec, JSON.stringify({ '2026-10-26': { label: 'Prova', days: [{ d: 'Lun', s: 'Riposo' }] } }));
  const p = scrivi('2026-11-02', path.join(__dirname, '..', 'piani', 'full-cycling.json'), fileMix, fileSpec);
  assert.strictEqual(settimanaDi(p, '2026-10-26').w.label, 'Prova');
  assert.strictEqual(settimanaDi(JSON.parse(fs.readFileSync(fileMix, 'utf8')), '2026-10-26').w.label, 'Prova');
  // senza speciali la settimana resta quella del piano di prima
  assert.deepStrictEqual(settimanaDi(genera(FULL, '2026-11-02'), '2026-10-26').w, settimanaDi(FULL, '2026-10-26').w);
});

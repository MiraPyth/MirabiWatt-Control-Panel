// Calendario stile intervals.icu (14/10/2026): la logica in calendario.js, sopra season-plan.js e workout-library.js.
// Settimane del mese (dalla più recente), stato di una settimana (piano, ripianificazione salvata, attività vere),
// riepilogo settimanale (Totale, Load, Fitness, Fatica, Forma, Ramp; previsione per le settimane future).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console });
for (const f of ['season-plan.js', 'workout-library.js', 'calendario.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
const g = n => vm.runInContext(n, ctx);
const Cal = g('Cal');
const OGGI = '2026-10-14';
// le liste nate nel contesto vm hanno un altro prototipo: si confrontano i valori
const uguale = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

test('settimane del mese, dalla più recente; numero di settimana ISO', () => {
  uguale(Cal.settimaneDelMese('2026-10'), ['2026-10-26', '2026-10-19', '2026-10-12', '2026-10-05', '2026-09-28']);
  assert.strictEqual(Cal.numeroSettimana('2026-10-12'), 42);
  assert.strictEqual(Cal.numeroSettimana('2026-12-28'), 53);
  assert.strictEqual(Cal.numeroSettimana('2027-01-04'), 1);
});

test('settimana passata: il piano e cosa è successo davvero, giorno per giorno', () => {
  const found = g("findDetailedWeek('2026-10-05')");
  assert.ok(found, 'settimana con dettaglio');
  const att = [{ date: '2026-10-07', name: '[MirabiWatt] EnduranceCorto', tss: 56, durationMin: 97 }];
  const s = Cal.statoSettimana('2026-10-05', { attivita: att, oggi: OGGI });
  assert.strictEqual(s.piano, true);
  assert.strictEqual(s.fase.id, found.phase.id);
  assert.strictEqual(s.giorni.length, 7);
  uguale(s.giorni.map(x => x.data), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.ok(['done-match', 'done-divergent'].includes(s.giorni[2].stato));
  uguale(s.giorni[2].attivita.map(a => a.tss), [56]);
  for (const [i, d] of found.week.days.entries()) {
    if (i === 2) continue;
    const riposo = ['Riposo', 'Riposo o Passeggiata'].includes(g('baseName')(d.s));
    assert.strictEqual(s.giorni[i].stato, riposo ? 'rest-ok' : 'missed', `${d.d} ${d.s}`);
  }
});

test('settimana futura: livello ridotto, imprevisti, ripianificazione IA salvata', () => {
  const ws = '2026-10-19', found = g(`findDetailedWeek('${ws}')`);
  assert.ok(found);
  const rid = Cal.statoSettimana(ws, { oggi: OGGI, override: { planLevel: 'ridotta' } });
  uguale(rid.giorni.map(x => x.giorno), g('applyPlanB')(found.week.days, 'ridotta'));
  assert.ok(rid.giorni.every(x => x.stato === 'future'));
  const imp = Cal.statoSettimana(ws, { oggi: OGGI, override: { unavailableDays: ['Gio'] } });
  const atteso = g('replanWeek')(found.week.days, new Set(['Gio']), new Set());
  uguale(imp.giorni.map(x => x.giorno), atteso.days);
  uguale(imp.note, atteso.notes);
  assert.strictEqual(imp.giorni[3].imprevisto, true);
  const giorniIA = found.week.days.map(d => ({ ...d, s: 'Riposo', zone: 'Rec' }));
  const ia = Cal.statoSettimana(ws, { oggi: OGGI, override: { aiReplanResult: { days: giorniIA, rationale: 'Settimana di scarico.' } } });
  uguale(ia.giorni.map(x => x.giorno.s), Array(7).fill('Riposo'));
  assert.strictEqual(ia.rationale, 'Settimana di scarico.');
});

test('settimana di una fase non ancora dettagliata', () => {
  const s = Cal.statoSettimana('2026-12-07', { oggi: OGGI });
  assert.strictEqual(s.piano, false);
  assert.strictEqual(s.fase.id, 'base3');
  assert.strictEqual(s.giorni.length, 7);
});

test('riepilogo di una settimana passata: Totale, Load, Fitness, Fatica, Forma, Ramp dai dati veri', () => {
  const att = [{ date: '2026-10-07', tss: 56, durationMin: 97 }, { date: '2026-10-10', tss: 77, durationMin: 89 }];
  const forma = [{ date: '2026-10-04', ctl: 40, atl: 50, rampRate: 1 }, { date: '2026-10-10', ctl: 44, atl: 45.5, rampRate: 2 }, { date: '2026-10-11', ctl: 44.6, atl: 43.2, rampRate: 3 }];
  const s = Cal.statoSettimana('2026-10-05', { attivita: att, oggi: OGGI });
  const r = Cal.riepilogoSettimana(s, forma, OGGI);
  uguale([r.totaleMin, r.load, r.stimato], [186, 133, false]);
  uguale([r.fitness, r.fatigue, r.form, r.ramp], [44.6, 43.2, 1.4, 4.6]);
});

test('riepilogo di una settimana futura: ore e load dal piano, forma prevista da oggi', () => {
  const ws = '2026-10-19', s = Cal.statoSettimana(ws, { oggi: OGGI });
  const forma = [{ date: '2026-10-13', ctl: 45, atl: 48, rampRate: 2 }];
  const r = Cal.riepilogoSettimana(s, forma, OGGI);
  assert.strictEqual(r.stimato, true);
  const piano = s.giorni.map(x => x.giorno);
  assert.strictEqual(r.totaleMin, piano.reduce((t, d) => t + g('parseDurMin')(d.dur), 0));
  assert.strictEqual(r.load, piano.reduce((t, d) => t + Cal.tssStimato(d), 0));
  // previsione: da oggi (ultimo dato) a domenica 25, giorno per giorno con il TSS pianificato
  let ctl = 45, atl = 48;
  for (let d = g("parseISO('2026-10-14')"); g('fmtISO')(d) <= '2026-10-25'; d = g('addDays')(d, 1)) {
    const iso = g('fmtISO')(d), f = g('findDetailedWeek')(iso), tss = f ? Cal.tssStimato(f.week.days[(d.getDay() + 6) % 7]) : 0;
    ctl += (tss - ctl) / 42; atl += (tss - atl) / 7;
  }
  assert.strictEqual(r.fitness, Math.round(ctl * 10) / 10);
  assert.strictEqual(r.fatigue, Math.round(atl * 10) / 10);
  assert.strictEqual(r.form, Math.round((ctl - atl) * 10) / 10);
});

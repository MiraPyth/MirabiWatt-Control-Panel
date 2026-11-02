/* MirabiWatt · calendario stile intervals.icu (14/10/2026). Logica pura sopra season-plan.js (SEASON, findDetailedWeek,
 * applyPlanB, replanWeek, matchWeekToActual, date) e workout-library.js (baseName): le settimane del mese, lo stato di
 * ogni settimana (piano, ripianificazione salvata, cosa è successo davvero) e il riepilogo settimanale (Totale, Load,
 * Fitness, Fatica, Forma, Ramp) con la previsione per le settimane future. Nel browser è `Cal`. */
(function (root) {
  'use strict';
  const RIPOSI = ['Riposo', 'Riposo o Passeggiata'];
  const eRiposo = d => RIPOSI.includes(baseName(d.s)) || d.zone === 'Rec';
  const tondo = x => Math.round(x * 10) / 10;

  /** Numero di settimana ISO 8601 (la settimana con il primo giovedì dell'anno è la 1). */
  function numeroSettimana(iso) {
    const d = parseISO(iso), g = addDays(d, 3 - ((d.getDay() + 6) % 7)); // il giovedì della settimana
    const primo = new Date(g.getFullYear(), 0, 4);
    return 1 + Math.round(((g - primo) / 86400000 - 3 + ((primo.getDay() + 6) % 7)) / 7);
  }

  /** I lunedì delle settimane che toccano il mese 'AAAA-MM', dalla più recente (come intervals.icu). */
  function settimaneDelMese(mese) {
    const primo = parseISO(`${mese}-01`), ultimo = new Date(primo.getFullYear(), primo.getMonth() + 1, 0), out = [];
    for (let d = mondayOf(primo); d <= ultimo; d = addDays(d, 7)) out.push(fmtISO(d));
    return out.reverse();
  }

  /** TSS stimato di una sessione del piano (stesse quote orarie della dashboard). */
  function tssStimato(day) {
    if (!day || !day.s) return 0;
    if (day.s.includes('Riposo') || day.s === 'Corpo libero e MSR') return 0;
    const ore = (parseDurMin(day.dur) || 60) / 60, z = (day.zone || '').toUpperCase();
    const perOra = z.includes('PALESTRA') ? 35 : z.includes('HIT') ? 85 : z.includes('TEST') ? 65 : z.includes('Z3') ? 68 : z.includes('Z2') ? 55 : z === 'REC' ? 20 : 55;
    return Math.round(ore * perOra);
  }

  /** Lo stato di una settimana. opz: { attivita: [{date, name, tss, durationMin}], oggi, override: {planLevel, unavailableDays, aiReplanResult} }.
   *  Come renderCurrentWeek: un giorno già trascorso mostra la realtà, mai un'ipotesi di ripianificazione. */
  function statoSettimana(ws, opz = {}) {
    const oggi = opz.oggi, ov = opz.override || {}, perData = {};
    for (const a of opz.attivita || []) (perData[a.date] = perData[a.date] || []).push(a);
    const date = Array.from({ length: 7 }, (_, i) => fmtISO(addDays(parseISO(ws), i)));
    const found = findDetailedWeek(ws);
    if (!found) {
      return { ws, piano: false, fase: findSummaryPhase(ws), note: [], rationale: '',
        giorni: date.map(data => ({ data, giorno: null, stato: data > oggi ? 'future' : 'libero', attivita: perData[data] || [], oggi: data === oggi })) };
    }
    const { phase, week } = found, rilevante = ws <= oggi;
    const match = rilevante ? matchWeekToActual(week.days, ws, oggi, perData) : week.days.map((d, i) => ({ dateISO: date[i], status: 'future', activities: [] }));
    const bloccati = new Set(), fatti = ['done-match', 'done-divergent', 'rest-ok'];
    match.forEach((m, i) => { if (fatti.includes(m.status)) bloccati.add(week.days[i].d); });
    const imprevisti = new Set(ov.unavailableDays || []);
    let giorni, note = [], rationale = '';
    if (ov.aiReplanResult && Array.isArray(ov.aiReplanResult.days)) {
      giorni = ov.aiReplanResult.days;
      rationale = ov.aiReplanResult.rationale || '';
    } else {
      giorni = applyPlanB(week.days, ov.planLevel || 'piena', ws);
      // persi (da intervals.icu) + imprevisti segnati a mano: stessa ricalibrazione di replanWeek
      const insieme = new Set([...match.map((m, i) => (m.status === 'missed' ? week.days[i].d : null)).filter(Boolean), ...imprevisti]);
      if (insieme.size) { const r = replanWeek(giorni, insieme, bloccati); giorni = r.days; note = r.notes; }
    }
    giorni = giorni.map((d, i) => (match[i] && fatti.includes(match[i].status) ? { ...week.days[i] } : d));
    return {
      ws, piano: true, fase: phase, settimana: week, note, rationale,
      giorni: giorni.map((d, i) => ({ data: date[i], giorno: d, originale: week.days[i], stato: match[i].status,
        attivita: match[i].activities && match[i].activities.length ? match[i].activities : perData[date[i]] || [],
        actualMin: match[i].actualMin, actualTSS: match[i].actualTSS, imprevisto: imprevisti.has(week.days[i].d), oggi: date[i] === oggi, riposo: eRiposo(d) })),
    };
  }

  /** TSS pianificato di un giorno qualunque (piano pieno), per la previsione della forma. */
  function tssDelGiorno(iso) {
    const f = findDetailedWeek(iso);
    return f ? tssStimato(f.week.days[(parseISO(iso).getDay() + 6) % 7]) : 0;
  }

  /** CTL e ATL a una data: il dato vero se c'è (ultimo ≤ data), altrimenti la previsione dall'ultimo dato con il piano. */
  function formaAl(data, forma, oggi) {
    const vere = forma.filter(w => w.ctl != null && w.atl != null).sort((a, b) => a.date.localeCompare(b.date));
    const fino = vere.filter(w => w.date <= data);
    if (data <= oggi || !vere.length) return fino.length ? { ctl: fino[fino.length - 1].ctl, atl: fino[fino.length - 1].atl, stimato: false } : null;
    const base = vere.filter(w => w.date <= oggi).pop() || vere[vere.length - 1];
    let ctl = base.ctl, atl = base.atl;
    for (let d = addDays(parseISO(base.date), 1); fmtISO(d) <= data; d = addDays(d, 1)) {
      const tss = tssDelGiorno(fmtISO(d));
      ctl += (tss - ctl) / 42; atl += (tss - atl) / 7;
    }
    return { ctl, atl, stimato: true };
  }

  /** Il riepilogo di una settimana (colonna a sinistra del calendario). Totale in minuti: fatto per i giorni passati,
   *  pianificato per quelli futuri; Load = TSS fatto + stimato; Fitness/Fatica a fine settimana; Forma = Fitness − Fatica;
   *  Ramp = Fitness di fine settimana − quella di 7 giorni prima. */
  function riepilogoSettimana(stato, forma, oggi) {
    let totaleMin = 0, load = 0;
    for (const x of stato.giorni) {
      if (x.data <= oggi && x.attivita.length) {
        totaleMin += x.attivita.reduce((t, a) => t + (a.durationMin || 0), 0);
        load += x.attivita.reduce((t, a) => t + (a.tss || 0), 0);
      } else if (x.data > oggi && x.giorno) {
        totaleMin += parseDurMin(x.giorno.dur);
        load += tssStimato(x.giorno);
      }
    }
    const fine = stato.giorni[6].data, prima = fmtISO(addDays(parseISO(fine), -7));
    const f = formaAl(fine, forma || [], oggi), p = formaAl(prima, forma || [], oggi);
    return { totaleMin, load, stimato: fine > oggi, fitness: f ? tondo(f.ctl) : null, fatigue: f ? tondo(f.atl) : null,
      form: f ? tondo(f.ctl - f.atl) : null, ramp: f && p ? tondo(f.ctl - p.ctl) : null };
  }

  // 13/10/2026: la scheda di un'attività come su intervals.icu, con i campi scelti dall'atleta
  const CAMPI_ATTIVITA = [
    { id: 'durata', nome: 'Durata' }, { id: 'distanza', nome: 'Distanza' }, { id: 'fc', nome: 'FC media' }, { id: 'watt', nome: 'Potenza media' },
    { id: 'np', nome: 'Potenza normalizzata' }, { id: 'load', nome: 'Load' }, { id: 'intensita', nome: 'Intensità' }, { id: 'orario', nome: 'Orario' },
    { id: 'kj', nome: 'Lavoro (kJ)' }, { id: 'kcal', nome: 'Calorie' }, { id: 'compliance', nome: 'Aderenza al piano' }, { id: 'zone', nome: 'Tempo nelle zone' }];
  const campiPredefiniti = () => CAMPI_ATTIVITA.map(c => c.id).filter(c => c !== 'np' && c !== 'kcal');
  const durata = m => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m` : `${m}m`);

  function schedaAttivita(a, campi) {
    const c = new Set(campi || campiPredefiniti()), ha = v => v != null && v !== '';
    if (a.strava) return { stub: true, titolo: `Attività delle ${a.start || '—'}`, nota: 'Dati non disponibili via API: arriva da Strava', testa: [], righe: [], compliance: null, zone: [] };
    const riga = parti => parti.filter(([k, v]) => c.has(k) && ha(v)).map(([, , t]) => t).join(' · ');
    const testa = [['durata', a.durationMin, ha(a.durationMin) && durata(a.durationMin)], ['distanza', a.distanceKm, ha(a.distanceKm) && `${a.distanceKm.toFixed(2)} km`]]
      .filter(([k, v]) => c.has(k) && ha(v)).map(([, , t]) => t);
    const righe = [
      riga([['fc', a.hr, `${a.hr} bpm`], ['watt', a.watt, `${a.watt} W`], ['np', a.np, `NP ${a.np} W`]]),
      riga([['load', a.tss, `Load ${a.tss}`], ['intensita', a.intensita, `${a.intensita}%`], ['orario', a.start, a.start]]),
      riga([['kj', a.kj, `${a.kj} kJ`], ['kcal', a.kcal, `${a.kcal} kcal`]]),
    ].filter(Boolean);
    const tot = (a.zone || []).reduce((t, x) => t + (x || 0), 0);
    const zone = c.has('zone') && tot > 0 ? a.zone.map((x, i) => ({ z: 'Z' + (i + 1), pct: Math.round((x || 0) / tot * 1000) / 10 })) : [];
    return { stub: false, titolo: (a.name || '').replace(/^\[(MirabiWatt|MW)\]\s*/, '') || 'Attività', testa, righe,
      compliance: c.has('compliance') && ha(a.compliance) ? a.compliance : null, zone };
  }

  /** Le kcal consumate in un giorno con le attività: somma di quelle note, e quante non le hanno (da Strava). */
  function kcalGiorno(attivita) {
    const l = attivita || [];
    return { kcal: l.reduce((t, a) => t + (Number(a.kcal) || 0), 0), senzaDati: l.filter(a => a.kcal == null).length, attivita: l.length };
  }

  const Cal = { numeroSettimana, settimaneDelMese, tssStimato, tssDelGiorno, statoSettimana, riepilogoSettimana, formaAl, eRiposo,
    CAMPI_ATTIVITA, campiPredefiniti, schedaAttivita, kcalGiorno };
  root.Cal = Cal;
  if (typeof module !== 'undefined' && module.exports) module.exports = Cal;
})(typeof window !== 'undefined' ? window : globalThis);

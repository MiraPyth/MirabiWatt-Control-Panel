/* MirabiWatt · Oggi (14/10/2026 sera), rifatta nello stile della dashboard: l'allenamento del giorno con i watt dalla FTP
 * attuale e le azioni (dettaglio, imprevisto, calendario), la forma con la previsione di domani, la settimana in corso, il
 * prossimo obiettivo, la nutrizione del giorno, l'ultima attività. Stessi dati e stessa logica del Calendario (Cal),
 * della Fitness (Analisi) e dell'Analisi FTP (window.mwAtleta). */
(function () {
  'use strict';
  const root = document.getElementById('oggi-root');
  if (!root) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const oggi = () => fmtISO(new Date());
  const ZONA = z => { const x = (z || '').toUpperCase(); return x.includes('PALESTRA') ? 'z-palestra' : x.includes('HIT') ? 'z-hit' : x.includes('TEST') ? 'z-test' : x.includes('Z3') ? 'z-z3' : x.includes('Z2') ? 'z-z2' : x === 'REC' ? 'z-rec' : 'z-libero'; };
  const oreMin = m => (m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : '0h');
  let forma = null;

  root.innerHTML = `<div class="mw-oggi">
    <header class="mw-oggi-testa"><div><div class="mw-pan-sopra">Oggi</div><h2 id="oggi-data"></h2><p id="oggi-fase" class="mw-aiuto"></p></div>
      <div id="oggi-valori" class="mw-oggi-valori"></div></header>
    <div class="mw-oggi-griglia">
      <section class="mw-card mw-oggi-allenamento" id="oggi-allenamento"></section>
      <section class="mw-card" id="oggi-forma"><div class="mw-card-testa"><h3>Forma</h3></div><p class="mw-aiuto">Leggo la forma da intervals.icu…</p></section>
      <section class="mw-card mw-intera" id="oggi-settimana"></section>
      <section class="mw-card" id="oggi-obiettivo"></section>
      <section class="mw-card" id="oggi-nutrizione"></section>
      <section class="mw-card" id="oggi-ultima"><div class="mw-card-testa"><h3>Ultima attività</h3></div><div id="dash-last-activity" class="mw-aiuto">In caricamento…</div>
        <h4 class="mw-sotto">Prossimo su intervals.icu</h4><div id="dash-next-workout" class="mw-aiuto">In caricamento…</div></section>
    </div></div>`;

  /** La settimana di oggi con le stesse regole del calendario (ripianificazione in corso o salvata, attività vere). */
  function settimana(ws) {
    const sel = typeof viewedWeekStart !== 'undefined' && ws === viewedWeekStart;
    const ov = sel ? { planLevel: currentPlanLevel, unavailableDays: [...unavailableDays], aiReplanResult } : (loadReplanOverrides()[ws] || {});
    return Cal.statoSettimana(ws, { oggi: oggi(), attivita: typeof calAttivitaSettimana === 'function' ? calAttivitaSettimana(ws) : [], override: ov });
  }

  function allenamento(st, i, ws) {
    const x = st.giorni[i], g = x && x.giorno, a = window.mwAtleta || {};
    const domani = i < 6 ? st.giorni[i + 1] : settimana(fmtISO(addDays(parseISO(ws), 7))).giorni[0];
    const testaDomani = domani && domani.giorno ? `<p class="mw-oggi-domani"><b>Domani</b> · ${esc(domani.giorno.s)}${domani.giorno.dur ? ` · ${esc(domani.giorno.dur)}` : ''}</p>` : '';
    if (!g) return `<div class="mw-card-testa"><h3>Allenamento di oggi</h3></div><p class="mw-aiuto">Settimana ${st.fase ? `di ${esc(st.fase.name)}: da dettagliare` : 'fuori dal piano'}. Le attività di oggi arrivano da intervals.icu.</p>${testaDomani}`;
    const riposo = Cal.eRiposo(g), fatto = x.attivita.length > 0, tss = Cal.tssStimato(g);
    const stato = fatto ? `<span class="mw-stato fatto">✓ Fatto</span>` : x.imprevisto ? '<span class="mw-stato imprevisto">Segnato come imprevisto: la settimana è ricalibrata</span>' : riposo ? '<span class="mw-stato">Riposo</span>' : '<span class="mw-stato da-fare">Da fare</span>';
    let passi = '';
    if (!riposo && a.ftp) {
      try {
        const det = getWorkoutDetail(g.s, a.ftp, a.cp || a.ftp);
        if (det && det.uiSteps && det.uiSteps.length) passi = `<ol class="mw-passi">${det.uiSteps.slice(0, 7).map(p => `<li><span>${esc(p.text)}</span>${p.durMin ? ` <small>${p.durMin}′</small>` : ''}${p.watts ? ` <b>${esc(p.watts)}</b>` : p.target ? ` <b>${esc(p.target)}</b>` : ''}</li>`).join('')}</ol>`;
      } catch (e) { /* sessione libera */ }
    }
    return `<div class="mw-oggi-sessione ${ZONA(g.zone)}">
        <div class="mw-card-testa"><h3>Allenamento di oggi</h3>${stato}</div>
        <div class="mw-oggi-nome">${esc(g.s)}</div>
        <div class="mw-oggi-info">${[g.dur, g.zone, tss ? `~${tss} TSS` : ''].filter(Boolean).map(esc).join(' · ')}</div>
        ${g.note ? `<p class="mw-aiuto">${esc(g.note)}</p>` : ''}
        ${fatto ? `<ul class="mw-oggi-fatte">${x.attivita.map(at => `<li>🚴 ${esc((at.name || '').replace(/^\[(MirabiWatt|MW)\]\s*/, '') || 'Attività')}${at.durationMin != null ? ` · ${at.durationMin}′` : ''}${at.tss != null ? ` · ${at.tss} TSS` : ''}</li>`).join('')}</ul>` : passi}
        <div class="mw-riga-azioni">
          ${!riposo && !fatto && g.zone === 'Palestra' && x.oggi ? `<button type="button" class="mw-tb mw-primario" data-palestra-inizia="${esc(g.s)}"><i data-lucide="dumbbell" class="w-4 h-4"></i> Inizia allenamento</button>` : ''}
          ${riposo ? '' : '<button type="button" class="mw-tb mw-primario" data-oggi="dettaglio"><i data-lucide="list" class="w-4 h-4"></i> Dettaglio</button>'}
          ${!riposo && !fatto && (x.stato === 'today-pending' || x.stato === 'future') ? `<button type="button" class="mw-tb" data-oggi="imprevisto">${x.imprevisto ? 'Togli imprevisto' : 'Oggi salta: imprevisto'}</button>` : ''}
          <button type="button" class="mw-tb" data-oggi="calendario"><i data-lucide="calendar-days" class="w-4 h-4"></i> Calendario</button>
        </div>
        ${testaDomani}</div>`;
  }

  function settimanaCard(st, ws) {
    const r = Cal.riepilogoSettimana(st, typeof calForma === 'function' ? calForma() : [], oggi());
    const pianificati = st.giorni.reduce((t, x) => t + (x.giorno ? parseDurMin(x.giorno.dur) : 0), 0);
    const fatti = st.giorni.reduce((t, x) => t + x.attivita.reduce((s, a) => s + (a.durationMin || 0), 0), 0);
    const GG = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const chip = st.giorni.map((x, i) => {
      const g = x.giorno, cl = ['mw-chip', g ? ZONA(g.zone) : '', x.oggi ? 'oggi' : '', g && Cal.eRiposo(g) ? 'riposo' : '',
        { 'done-match': 'fatto', 'done-divergent': 'diverso', missed: 'saltato' }[x.stato] || ''].filter(Boolean).join(' ');
      const ico = { 'done-match': '✓', 'done-divergent': '⚠', missed: '✗' }[x.stato] || (x.imprevisto ? '⏸' : '');
      return `<div class="${cl}"><span class="mw-chip-g">${GG[i]} ${parseISO(x.data).getDate()}</span><span class="mw-chip-s">${esc(g ? g.s : x.attivita.length ? 'attività' : '—')}</span><span class="mw-chip-i">${ico}</span></div>`;
    }).join('');
    return `<div class="mw-card-testa"><h3>Settimana ${Cal.numeroSettimana(ws)}</h3><span class="mw-aiuto">${st.piano ? esc(`${st.fase.name} — ${st.settimana.label}`) : st.fase ? esc(st.fase.name) : ''}</span></div>
      <div class="mw-chips">${chip}</div>
      <div class="mw-barra-prog" aria-hidden="true"><i style="width:${pianificati ? Math.min(100, fatti / pianificati * 100) : 0}%"></i></div>
      <p class="mw-aiuto">Fatto ${oreMin(fatti)} di ${oreMin(pianificati)} pianificate · Load ${r.load}${r.stimato ? ' (con la stima dei giorni che mancano)' : ''}</p>`;
  }

  function obiettivoCard() {
    const tutti = SEASON.events.map(e => ({ nome: e.name, data: e.date, km: e.km, dislivello: e.elev, priorita: e.priority }))
      .concat((window.obiettiviUtente || []).map(o => ({ ...o }))).filter(o => o.data >= oggi()).sort((a, b) => a.data.localeCompare(b.data));
    const o = tutti[0];
    if (!o) return '<div class="mw-card-testa"><h3>Prossimo obiettivo</h3></div><p class="mw-aiuto">Nessun obiettivo in arrivo: aggiungilo in Stagione.</p>';
    const giorni = Math.round((parseISO(o.data) - parseISO(oggi())) / 86400000), fase = phaseNameForDate(oggi());
    return `<div class="mw-card-testa"><h3>Prossimo obiettivo</h3><span class="mw-prio">Priorità ${esc(o.priorita || 'B')}</span></div>
      <div class="mw-oggi-nome">${esc(o.nome)}</div>
      <p class="mw-aiuto">${parseISO(o.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}${o.km ? ` · ${o.km} km` : ''}${o.dislivello ? ` · ${o.dislivello} m D+` : ''}</p>
      <div class="mw-oggi-conto"><b>${giorni}</b> giorni <small>~${Math.floor(giorni / 7)} settimane</small></div>
      ${fase ? `<p class="mw-aiuto">Adesso: ${esc(fase)}</p>` : ''}`;
  }

  /** 13/10/2026: le kcal consumate oggi con le attività (da intervals.icu), solo come riferimento. */
  function consumate() {
    const att = typeof calDati !== 'undefined' && calDati.activities ? calDati.activities.filter(a => a.date === oggi()) : [];
    if (!att.length) return '';
    const k = Cal.kcalGiorno(att);
    return `<p class="mw-nut-consumate">Consumate con le attività <b>${k.kcal} kcal</b>${k.senzaDati ? ` <small>· ${k.senzaDati} ${k.senzaDati === 1 ? 'attività' : 'attività'} senza dati (da Strava)</small>` : ''}</p>`;
  }

  function nutrizioneCard(x) {
    const g = x && x.giorno, tipo = g ? classifySessionForNutrition(g) : 'riposo';
    const NOMI = { riposo: 'Giornata leggera', hit: 'Giornata intensa (HIT)', lungo: 'Uscita lunga' };
    const peso = (window.mwAtleta && window.mwAtleta.peso) || (typeof currentAthleteWeight !== 'undefined' && currentAthleteWeight) || 83.6;
    const n = pianoNutrizione(tipo, peso, { fase: faseNutrizione(fmtISO(new Date())) }), t = n.target, kc = m => m.p * 4 + m.c * 4 + m.fat * 9;
    const quota = k => Math.round(t[k] * (k === 'fat' ? 9 : 4) / kc(t) * 100);
    return `<div class="mw-card-testa"><h3>Nutrizione di oggi</h3><span class="mw-prio">${NOMI[tipo] || tipo}</span></div>
      <div class="mw-nut-kpi"><div class="mw-nut-kcal"><b>${t.kcal} kcal</b><small>target · ${esc(String(peso))} kg</small></div>
        <div class="mw-nut-macro"><span class="p">Proteine ${t.p} g</span><span class="c">Carboidrati ${t.c} g</span><span class="f">Grassi ${t.fat} g</span></div>
        <div class="mw-barra-composta mw-nut-barra"><i class="p" style="width:${quota('p')}%">${quota('p')}%</i><i class="c" style="width:${quota('c')}%">${quota('c')}%</i><i class="f" style="width:${quota('fat')}%">${quota('fat')}%</i></div></div>
      ${consumate()}
      ${g ? `<p class="mw-aiuto">${esc(timingAdviceFor(g, new Date()))}</p>` : ''}
      <button type="button" class="mw-tb mw-primario" data-oggi="nutrizione" data-tipo="${tipo}"><i data-lucide="apple" class="w-4 h-4"></i> Pasti di oggi</button>`;
  }

  function formaCard() {
    const el = document.getElementById('oggi-forma');
    if (!forma || !forma.length) return;
    const reali = forma.filter(p => !p.previsto), p = reali[reali.length - 1] || forma[0], domani = forma.find(q => q.data === fmtISO(addDays(parseISO(oggi()), 1)));
    const z = Analisi.zonaForma(p.form), W = 420, H = 110, L = 4, R = 4, n = forma.length;
    const min = Math.min(-35, ...forma.map(q => q.form)), max = Math.max(25, ...forma.map(q => q.form));
    const X = i => L + i / Math.max(1, n - 1) * (W - L - R), Y = v => 4 + (1 - (v - min) / (max - min)) * (H - 8);
    const linea = pts => pts.map(([i, q], j) => `${j ? 'L' : 'M'}${X(i).toFixed(1)},${Y(q.form).toFixed(1)}`).join('');
    const tutti = forma.map((q, i) => [i, q]), veri = tutti.filter(([, q]) => !q.previsto), dopo = tutti.filter(([i, q]) => q.previsto || i === veri.length - 1);
    el.innerHTML = `<div class="mw-card-testa"><h3>Forma</h3><span class="mw-fv-zona z-${z.id}">${z.nome}</span></div>
      <div class="mw-oggi-forma"><div class="mw-fv"><span>Fitness</span> <b class="fit">${Math.round(p.ctl)}</b></div><div class="mw-fv"><span>Fatica</span> <b class="fat">${Math.round(p.atl)}</b></div>
        <div class="mw-fv"><span>Forma</span> <b class="z-${z.id}">${Math.round(p.form)}</b></div></div>
      <svg class="mw-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Forma delle ultime sei settimane">
        <rect class="fascia z-ottimale" x="${L}" width="${W - L - R}" y="${Y(-10)}" height="${Y(-30) - Y(-10)}"/><rect class="fascia z-fresco" x="${L}" width="${W - L - R}" y="${Y(20)}" height="${Y(5) - Y(20)}"/>
        <line class="griglia" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>
        <path class="forma-linea z-grigia" d="${linea(veri)}"/>${dopo.length > 1 ? `<path class="forma-linea previsto z-fresco" d="${linea(dopo)}"/>` : ''}</svg>
      <p class="mw-aiuto">${domani ? `Domani, con il piano: forma ${Math.round(domani.form)} (${Analisi.zonaForma(domani.form).nome.toLowerCase()}).` : ''} Ultime 6 settimane; tratteggiata la prossima dal piano.</p>`;
  }

  function disegnaOggi() {
    const o = oggi(), ws = fmtISO(mondayOf(parseISO(o))), i = (parseISO(o).getDay() + 6) % 7, st = settimana(ws), a = window.mwAtleta;
    document.getElementById('oggi-data').textContent = parseISO(o).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('oggi-fase').textContent = `Settimana ${Cal.numeroSettimana(ws)}${st.piano ? ` · ${st.fase.name} — ${st.settimana.label}` : st.fase ? ` · ${st.fase.name}` : ''}`;
    document.getElementById('oggi-valori').innerHTML = a && a.ftp ? `<span>FTP ${a.ftp} W</span><span>${(a.ftp / a.peso).toFixed(2)} W/kg</span><span>CP ${a.cp} W</span><span>W' ${a.wPrime} J</span>` : '';
    document.getElementById('oggi-allenamento').innerHTML = allenamento(st, i, ws);
    document.getElementById('oggi-settimana').innerHTML = settimanaCard(st, ws);
    document.getElementById('oggi-obiettivo').innerHTML = obiettivoCard();
    document.getElementById('oggi-nutrizione').innerHTML = nutrizioneCard(st.giorni[i]);
    formaCard();
    lucide.createIcons();
  }

  async function caricaForma() {
    const o = oggi(), start = fmtISO(addDays(parseISO(o), -41));
    try {
      const r = await fetch(`/api/fitness?start=${start}&end=${o}`), j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      forma = Analisi.serieFitness(j.giorni || [], o, fmtISO(addDays(parseISO(o), 7)));
      formaCard();
      window.mwForma = forma;   // anche per la home da telefono (mobile-home.js)
      document.dispatchEvent(new Event('mw-forma'));
    } catch (e) { document.getElementById('oggi-forma').innerHTML = `<div class="mw-card-testa"><h3>Forma</h3></div><p class="mw-aiuto">intervals.icu non risponde (${esc(e.message)}).</p>`; }
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-oggi]');
    if (!b) return;
    const o = oggi(), ws = fmtISO(mondayOf(parseISO(o))), x = settimana(ws).giorni[(parseISO(o).getDay() + 6) % 7];
    if (b.dataset.oggi === 'dettaglio' && x && x.giorno) showWorkoutDetail(x.giorno.s);
    if (b.dataset.oggi === 'imprevisto' && x && x.originale) calImprevisto(ws, x.originale.d);
    if (b.dataset.oggi === 'calendario') switchDashView('view-calendar');
    if (b.dataset.oggi === 'nutrizione') jumpToNutrition(b.dataset.tipo || 'riposo');
  });
  // si ridisegna con il calendario (dati da intervals.icu, ripianificazioni), i valori dell'atleta, gli obiettivi
  const disegnaCal = window.disegnaCalendario;
  window.disegnaCalendario = function () { disegnaCal(); disegnaOggi(); };
  const disegnaEventi = window.renderEvents;
  window.renderEvents = function () { disegnaEventi(); disegnaOggi(); };
  document.addEventListener('mw-atleta', disegnaOggi);
  disegnaOggi();
  caricaForma();
})();

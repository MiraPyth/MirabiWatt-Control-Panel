/* MirabiWatt · interfaccia del calendario stile intervals.icu (14/10/2026). Usa la logica di calendario.js (Cal) e le
 * funzioni della dashboard (renderCurrentWeek, setPlanLevel, doReplanAI, doSaveReplan, doPushWeek, toggleUnavailable,
 * showWorkoutDetail, loadReplanOverrides…): qui solo il disegno e i comandi. */
'use strict';

const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
let calMese = null;                                    // 'AAAA-MM' mostrato
let calDati = { chiave: '', activities: [], wellness: [] };
let calBase = [];                                      // forma degli ultimi giorni (punto di partenza della previsione)

const calEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const calOggi = () => fmtISO(new Date());
const calNomeMese = m => `${MESI_IT[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const calSpostaMese = (m, n) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1); return fmtISO(d).slice(0, 7); };
const calFineSettimana = ws => fmtISO(addDays(parseISO(ws), 6));
const calOre = m => (m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : '0m');
const calNum = x => (x == null ? '—' : String(x));

function calAttivitaSettimana(ws) {
  const fine = calFineSettimana(ws);
  return calDati.activities.filter(a => a.date >= ws && a.date <= fine);
}
function calForma() {
  const per = new Map();
  for (const w of calBase.concat(calDati.wellness)) per.set(w.date, w);
  return [...per.values()];
}

/** I dati veri del mese mostrato (attività e forma) e, una volta, la forma degli ultimi giorni per la previsione. */
async function calCarica(forza = false) {
  const sett = Cal.settimaneDelMese(calMese);
  const start = fmtISO(addDays(parseISO(sett[sett.length - 1]), -7)), end = calFineSettimana(sett[0]), chiave = start + end;
  if (!forza && calDati.chiave === chiave) return;
  const stato = document.getElementById('cal-stato'), oggi = calOggi();
  stato.textContent = 'Aggiorno da intervals.icu…';
  const leggi = async u => { const r = await fetch(u); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status); return j; };
  try {
    const [r, b] = await Promise.all([leggi(`/api/calendar?start=${start}&end=${end}`),
      calBase.length && !forza ? null : leggi(`/api/calendar?start=${fmtISO(addDays(parseISO(oggi), -7))}&end=${oggi}`)]);
    calDati = { chiave, activities: r.activities || [], wellness: r.wellness || [], eventi: r.eventi || [] };
    if (b) calBase = b.wellness || [];
    stato.textContent = '';
  } catch (e) {
    stato.textContent = 'intervals.icu non risponde: mostro solo il piano';
  }
  renderCurrentWeek();
}

const ZONE = z => { const x = (z || '').toUpperCase(); return x.includes('PALESTRA') ? 'z-palestra' : x.includes('HIT') ? 'z-hit' : x.includes('TEST') ? 'z-test' : x.includes('Z3') ? 'z-z3' : x.includes('Z2') ? 'z-z2' : x === 'REC' ? 'z-rec' : 'z-libero'; };
const STATI = { 'done-match': ['fatto', '✓ fatto'], 'done-divergent': ['diverso', '⚠ diverso dal piano'], missed: ['saltato', '✗ saltato'], 'today-pending': ['oggi', 'oggi'] };

function calCella(st, x, i, ws) {
  const dd = parseISO(x.data), oggi = calOggi(), g = x.giorno;
  const classi = ['mw-giorno', x.oggi ? 'oggi' : '', x.data < oggi ? 'passato' : '', x.data.slice(0, 7) !== calMese ? 'fuori-mese' : ''].filter(Boolean).join(' ');
  let corpo = '';
  if (g) {
    const riposo = Cal.eRiposo(g), [cl, txt] = STATI[x.stato] || ['', ''], tss = Cal.tssStimato(g);
    corpo += `<button type="button" class="mw-sessione ${ZONE(g.zone)}${riposo ? ' riposo' : ''}${cl ? ' ' + cl : ''}" data-sessione="${calEsc(g.s)}" title="${calEsc(g.note || '')}"${riposo ? '' : ' draggable="true"'}>
      <span class="mw-s-nome">${calEsc(g.s)}</span>
      ${riposo ? '' : `<span class="mw-s-info">${[g.dur, g.zone, tss ? `~${tss} TSS` : ''].filter(Boolean).map(calEsc).join(' · ')}</span>`}
      ${txt && !(riposo && cl === 'oggi') ? `<span class="mw-s-stato">${txt}</span>` : ''}</button>`;
    // anche un giorno già segnato (diventato riposo dopo la ricalibrazione): così l'imprevisto si toglie
    if ((x.imprevisto || !riposo) && (x.stato === 'future' || x.stato === 'today-pending'))
      corpo += `<button type="button" class="mw-imprevisto${x.imprevisto ? ' attivo' : ''}" data-imprevisto="${calEsc(x.originale.d)}" data-ws="${ws}" title="Questo giorno salta: ricalibra la settimana">${x.imprevisto ? '✕ imprevisto' : 'imprevisto'}</button>`;
  }
  corpo += x.attivita.slice().sort((p, q) => String(p.start || '').localeCompare(String(q.start || ''))).map(calSchedaHTML).join(''); // attivita-ui.js
  corpo += SEASON.events.filter(e => e.date === x.data).map(e => `<div class="mw-evento">🏁 ${calEsc(e.name)}</div>`).join('');
  return `<div class="${classi}" data-data="${x.data}">
    <div class="mw-g-testa"><span class="mw-g-nome">${GIORNI_BREVI[i]}</span><span class="mw-g-num">${String(dd.getDate()).padStart(2, '0')}</span><span class="mw-g-mese">${MESI_BREVI[dd.getMonth()]}</span></div>
    ${corpo}</div>`;
}

function calRiga(ws, salvati, forma) {
  const oggi = calOggi(), sel = ws === viewedWeekStart;
  const ov = sel ? { planLevel: currentPlanLevel, unavailableDays: [...unavailableDays], aiReplanResult } : (salvati[ws] || {});
  const st = Cal.statoSettimana(ws, { oggi, attivita: calAttivitaSettimana(ws), override: ov });
  const r = Cal.riepilogoSettimana(st, forma, oggi), corrente = ws <= oggi && oggi <= calFineSettimana(ws);
  const s = salvati[ws], salvata = s && (s.aiReplanResult || (s.unavailableDays || []).length || (s.planLevel && s.planLevel !== 'piena'));
  const bozza = sel && (aiReplanResult || unavailableDays.size || currentPlanLevel !== 'piena') && !salvata;
  const fase = st.piano ? `${st.fase.name} — ${st.settimana.label}` : st.fase ? `${st.fase.name} · da dettagliare (${st.fase.hours}, HIT ${st.fase.hit})` : 'Fuori dal piano';
  const stat = (k, v, cl = '') => `<div><dt>${k}</dt> <dd class="${cl}">${v}</dd></div>`;
  return `<div class="mw-riga${sel ? ' sel' : ''}${corrente ? ' corrente' : ''}" data-settimana="${ws}">
    <div class="mw-sett" role="button" tabindex="0" title="Seleziona la settimana e apri Ripianifica">
      <div class="mw-sett-testa"><b>Settimana ${Cal.numeroSettimana(ws)}</b><button type="button" class="mw-menu" data-menu="${ws}" aria-label="Azioni della settimana">⋯</button></div>
      <div class="mw-sett-fase">${calEsc(fase)}</div>
      ${salvata ? `<span class="mw-badge">${s.aiReplanResult ? '✨ ' : ''}ripianificata</span>` : ''}${bozza ? '<span class="mw-badge bozza">modifiche da salvare</span>' : ''}
      <dl class="mw-stats">
        ${stat('Totale', calOre(r.totaleMin))}${stat('Load', (r.stimato && r.load ? '~' : '') + r.load)}
        ${stat('Fitness', calNum(r.fitness), 'fit')}${stat('Fatica', calNum(r.fatigue), 'fat')}
        ${stat('Forma', calNum(r.form), 'form')}${stat('Ramp', calNum(r.ramp))}
      </dl>
    </div>
    ${st.giorni.map((x, i) => calCella(st, x, i, ws)).join('')}
  </div>`;
}

function disegnaCalendario() {
  const el = document.getElementById('cal-righe');
  if (!el || !calMese) return;
  const salvati = loadReplanOverrides(), forma = calForma();
  document.getElementById('cal-mese').textContent = calNomeMese(calMese);
  el.innerHTML = Cal.settimaneDelMese(calMese).map(ws => calRiga(ws, salvati, forma)).join('');
  if (viewedWeekStart) document.getElementById('cal-sel').textContent = `Selezionata: settimana ${Cal.numeroSettimana(viewedWeekStart)} · ${fmtDateShort(viewedWeekStart)} – ${fmtDateShort(calFineSettimana(viewedWeekStart))}`;
  lucide.createIcons();
}

/* ----- comandi ----- */
function selezionaSettimana(ws, apri = true) {
  if (ws !== viewedWeekStart) {
    viewedWeekStart = ws;
    resetWeekOverrides();
    currentPlanLevel = 'piena';
    applySavedOverrideIfAny();
  }
  renderCurrentWeek();
  if (apri) apriPannello();
}
function calVaiASettimana(ws) {
  calMese = fmtISO(addDays(parseISO(ws), 3)).slice(0, 7);
  selezionaSettimana(ws, true);
  calCarica();
}
function apriPannello(ia = false) {
  document.getElementById('cal-pannello').hidden = false;
  if (ia) document.getElementById('imprevisto-text').focus();
}
function chiudiPannello() { document.getElementById('cal-pannello').hidden = true; }
function mwAvviso(testo) {
  let t = document.getElementById('mw-toast');
  if (!t) { t = document.createElement('div'); t.id = 'mw-toast'; t.className = 'mw-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = testo; t.classList.add('vis');
  clearTimeout(mwAvviso._t); mwAvviso._t = setTimeout(() => t.classList.remove('vis'), 3500);
}
function calSalva() {
  doSaveReplan();
  mwAvviso(document.getElementById('save-replan-status').textContent);
  disegnaCalendario();
}
function calInvia() { apriPannello(); doPushWeek(); }
function calRipristina() { clearReplan(); mwAvviso('Settimana riportata al piano.'); }
function calImprevisto(ws, giorno) {
  selezionaSettimana(ws, false);
  toggleUnavailable(giorno);
}

/* menu ⋯ della settimana */
function calChiudiMenu() { const m = document.querySelector('.mw-popover'); if (m) m.remove(); }
function calMenu(ws, bottone) {
  calChiudiMenu();
  const m = document.createElement('div');
  m.className = 'mw-popover';
  const voci = [['Ripianifica', () => selezionaSettimana(ws, true)], ['Ripianifica con IA', () => { selezionaSettimana(ws, false); apriPannello(true); }],
    ['Salva', () => { selezionaSettimana(ws, false); calSalva(); }], ['Invia a intervals', () => { selezionaSettimana(ws, false); calInvia(); }],
    ['Ripristina', () => { selezionaSettimana(ws, false); calRipristina(); }]];
  m.innerHTML = voci.map(([t], i) => `<button type="button" data-voce="${i}">${t}</button>`).join('');
  m.addEventListener('click', e => { const b = e.target.closest('[data-voce]'); if (!b) return; calChiudiMenu(); voci[Number(b.dataset.voce)][1](); });
  const r = bottone.getBoundingClientRect();
  m.style.top = `${r.bottom + window.scrollY + 4}px`; m.style.left = `${r.left + window.scrollX}px`;
  document.body.appendChild(m);
}

/* ----- avvio e collegamenti ----- */
function calInizia() {
  calMese = calOggi().slice(0, 7);
  document.body.classList.toggle('mw-cal-attivo', document.getElementById('view-calendar').classList.contains('active'));
  renderCurrentWeek();
  calCarica();
}

(function collega() {
  // tema chiaro / scuro (14/10/2026): la scelta è già applicata da uno script in testa alla pagina, qui il pulsante
  const tema = document.getElementById('mw-tema');
  const etichettaTema = () => {
    const chiaro = document.documentElement.dataset.tema === 'chiaro';
    tema.querySelector('.mw-label').textContent = chiaro ? 'Tema scuro' : 'Tema chiaro';
    tema.querySelector('i, svg').setAttribute('data-lucide', chiaro ? 'moon' : 'sun');
  };
  const cambiaTema = () => {
    const nuovo = document.documentElement.dataset.tema === 'chiaro' ? 'scuro' : 'chiaro';
    document.documentElement.dataset.tema = nuovo;
    try { localStorage.setItem('mirabiwatt_tema', nuovo); } catch (e) { /* pazienza */ }
    // 29/10: lo stesso cookie del Control Panel, così il cambio vale anche lì e nelle pagine OGame
    try { document.cookie = 'mira_tema=' + nuovo + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) { /* pazienza */ }
    etichettaTema();
    lucide.createIcons();
  };
  etichettaTema();
  // tema cambiato nel Control Panel mentre questa scheda era aperta: si riallinea quando ci torni
  const rileggiTema = () => {
    const c = document.cookie.match(/(?:^|; )mira_tema=(chiaro|scuro)/);
    if (!c || c[1] === document.documentElement.dataset.tema) return;
    document.documentElement.dataset.tema = c[1];
    try { localStorage.setItem('mirabiwatt_tema', c[1]); } catch (e) { /* pazienza */ }
    etichettaTema();
    lucide.createIcons();
  };
  window.addEventListener('focus', rileggiTema);
  window.addEventListener('pageshow', rileggiTema);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rileggiTema(); });
  tema.addEventListener('click', cambiaTema);
  tema.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cambiaTema(); } });
  const side = document.getElementById('mw-sidebar');
  try { if (localStorage.getItem('mirabiwatt_sidebar') === 'compatto') side.classList.add('compatto'); } catch (e) { /* pazienza */ }
  // 13/10/2026: da smartphone il menu è a scomparsa (mobile.css): si apre dalla barra del titolo, si chiude scegliendo una voce
  const telefono = () => !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
  const velo = document.getElementById('mw-velo');
  const menuMobile = aperto => { side.classList.toggle('aperto', aperto); if (velo) velo.hidden = !aperto; document.body.classList.toggle('mw-menu-aperto', aperto); };
  const apri = document.getElementById('mw-apri-menu');
  if (apri) apri.addEventListener('click', () => menuMobile(true));
  if (velo) velo.addEventListener('click', () => menuMobile(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && side.classList.contains('aperto')) menuMobile(false); });
  side.addEventListener('click', e => { if (e.target.closest('.sidebar-item[data-view]') && side.classList.contains('aperto')) menuMobile(false); });
  document.getElementById('mw-toggle').addEventListener('click', () => {
    if (telefono()) { menuMobile(false); return; }
    side.classList.toggle('compatto');
    try { localStorage.setItem('mirabiwatt_sidebar', side.classList.contains('compatto') ? 'compatto' : 'esteso'); } catch (e) { /* pazienza */ }
  });
  const su = (id, f) => document.getElementById(id).addEventListener('click', f);
  su('cal-ripianifica', () => apriPannello());
  su('cal-ia', () => apriPannello(true));
  su('cal-salva', calSalva);
  su('cal-invia', calInvia);
  su('cal-aggiorna', () => { calCarica(true); fetchDashboard(); });
  su('cal-prec', () => { calMese = calSpostaMese(calMese, -1); disegnaCalendario(); calCarica(); });
  su('cal-succ', () => { calMese = calSpostaMese(calMese, 1); disegnaCalendario(); calCarica(); });
  const oggi = () => { calMese = calOggi().slice(0, 7); disegnaCalendario(); calCarica(); };
  su('cal-oggi', oggi);
  su('cal-mese', oggi);
  su('cal-chiudi', chiudiPannello);
  // altezza vera della barra strumenti (va a capo su schermi stretti): il calendario scorre nello spazio sotto
  const barra = document.querySelector('#view-calendar .mw-toolbar');
  if (barra && window.ResizeObserver) new ResizeObserver(() => { if (barra.offsetHeight) document.documentElement.style.setProperty('--mw-tb-h', `${barra.offsetHeight}px`); }).observe(barra);
  // il dettaglio dell'allenamento (showWorkoutDetail lo scrive in #dash-workout-detail) si apre nel suo pannello
  const det = document.getElementById('dash-workout-detail'), modale = document.getElementById('cal-dettaglio');
  new MutationObserver(() => { if (!det.classList.contains('hidden')) modale.hidden = false; }).observe(det, { attributes: true, attributeFilter: ['class'], childList: true });
  const chiudiDettaglio = () => { modale.hidden = true; det.classList.add('hidden'); };
  su('cal-dettaglio-chiudi', chiudiDettaglio);
  modale.addEventListener('click', e => { if (e.target === modale) chiudiDettaglio(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { chiudiDettaglio(); chiudiPannello(); calChiudiMenu(); } });
  document.addEventListener('click', e => { if (!e.target.closest('.mw-popover') && !e.target.closest('.mw-menu')) calChiudiMenu(); });
  document.getElementById('cal-righe').addEventListener('click', e => {
    const menu = e.target.closest('.mw-menu'), imp = e.target.closest('.mw-imprevisto'), ses = e.target.closest('.mw-sessione'), sett = e.target.closest('.mw-sett');
    if (menu) { e.stopPropagation(); calMenu(menu.dataset.menu, menu); }
    else if (imp) calImprevisto(imp.dataset.ws, imp.dataset.imprevisto);
    else if (ses) showWorkoutDetail(ses.dataset.sessione);
    else if (sett) selezionaSettimana(sett.closest('.mw-riga').dataset.settimana, true);
  });
  document.getElementById('cal-righe').addEventListener('keydown', e => {
    const sett = e.target.closest('.mw-sett');
    if (sett && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selezionaSettimana(sett.closest('.mw-riga').dataset.settimana, true); }
  });
})();

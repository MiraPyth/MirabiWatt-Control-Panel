/* MirabiWatt · home da telefono (19/10/2026 notte, dal mock di Tiziano): testata calda con saluto e carico della
 * settimana (numero grande, barra, % del piano), tre schede fitness/fatica/forma, la settimana come lista con i pallini
 * fatto/da fare e la pillola su oggi, barra delle sezioni in basso. Solo sotto i 760px (mobile-home.css); stessi dati
 * del Calendario (Cal.statoSettimana) e della Forma di Oggi (window.mwForma, evento «mw-forma»). */
(function () {
  'use strict';
  const root = document.getElementById('mh-root');
  if (!root) return;
  const telefono = () => !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const oggi = () => fmtISO(new Date());
  const GG = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const TAB = [['view-today', 'Oggi', 'house'], ['view-calendar', 'Calendario', 'calendar-days'], ['view-nutrition', 'Nutrizione', 'apple'],
    ['view-fitness', 'Fitness', 'chart-column'], ['menu', 'Menu', 'user-round']];

  function tipo(g) {
    if (!g || Cal.eRiposo(g)) return ['riposo', 'moon'];
    const z = (g.zone || '').toUpperCase();
    return z.includes('PALESTRA') ? ['palestra', 'dumbbell'] : z.includes('HIT') || z.includes('TEST') ? ['hit', 'zap'] : z.includes('Z3') ? ['z3', 'mountain'] : z.includes('Z2') || z === 'REC' ? ['z2', 'bike'] : ['libero', 'activity'];
  }

  function settimana(ws) {
    const sel = typeof viewedWeekStart !== 'undefined' && ws === viewedWeekStart;
    const ov = sel ? { planLevel: currentPlanLevel, unavailableDays: [...unavailableDays], aiReplanResult } : (loadReplanOverrides()[ws] || {});
    return Cal.statoSettimana(ws, { oggi: oggi(), attivita: typeof calAttivitaSettimana === 'function' ? calAttivitaSettimana(ws) : [], override: ov });
  }

  function nome() {
    return (window.mwNomeScelto || window.mwNomeIntervals || (document.getElementById('mw-atleta-nome') || {}).textContent || 'Atleta').trim();
  }

  function saluto() {
    const h = new Date().getHours();
    return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  }

  function stats() {
    const f = window.mwForma || [], reali = f.filter(p => !p.previsto), p = reali[reali.length - 1];
    const v = x => (p ? Math.round(x) : '—');
    return [['Fitness', 'trending-up', p && v(p.ctl), 'fit'], ['Fatica', 'flame', p && v(p.atl), 'fat'], ['Forma', 'heart-pulse', p && v(p.form), 'form']]
      .map(([n, ico, val, cl]) => `<div class="mh-stat ${cl}"><i data-lucide="${ico}" class="mh-stat-ico"></i><b>${val == null ? '—' : val}</b><small>${n}</small></div>`).join('');
  }

  function riga(x, i, prossimo) {
    const g = x.giorno, [cl, ico] = tipo(g), riposo = cl === 'riposo';
    const fatto = x.stato === 'done-match' || x.stato === 'done-divergent' || (x.attivita.length > 0 && !riposo);
    const saltato = x.stato === 'missed';
    const titolo = g ? g.s : x.attivita.length ? (x.attivita[0].name || 'Attività').replace(/^\[(MirabiWatt|MW)\]\s*/, '') : 'Libero';
    const info = [`${GG[i]} ${parseISO(x.data).getDate()}`, g && !riposo ? g.dur : '', g && !riposo ? g.zone : ''].filter(Boolean).map(esc).join(' · ');
    let pillola = '';
    if (x.oggi && !fatto && g && !riposo) pillola = cl === 'palestra' ? `<button type="button" class="mh-azione" data-palestra-inizia="${esc(g.s)}">Inizia</button>` : '<span class="mh-azione">Oggi</span>';
    else if (prossimo) pillola = '<span class="mh-azione chiara">Prossimo</span>';
    const stato = ['mh-giorno', x.oggi ? 'oggi' : '', fatto ? 'fatto' : '', saltato ? 'saltato' : '', riposo ? 'riposo' : ''].filter(Boolean).join(' ');
    return `<li class="${stato}"><span class="mh-punto" aria-label="${fatto ? 'fatto' : saltato ? 'saltato' : 'da fare'}">${fatto ? '<i data-lucide="check"></i>' : saltato ? '<i data-lucide="x"></i>' : ''}</span>
      <button type="button" class="mh-apri"${riposo ? ' disabled' : ''} data-sessione="${esc(g ? g.s : '')}"><span class="mh-mini ${cl}"><i data-lucide="${ico}"></i></span>
        <span class="mh-testo"><b>${esc(titolo)}</b><small>${info}</small></span></button>${pillola}</li>`;
  }

  function disegna() {
    const o = oggi(), ws = fmtISO(mondayOf(parseISO(o))), st = settimana(ws);
    const piano = st.giorni.reduce((t, x) => t + Cal.tssStimato(x.giorno), 0);
    const fatto = Math.round(st.giorni.reduce((t, x) => t + x.attivita.reduce((s, a) => s + (a.tss || 0), 0), 0));
    const pct = piano ? Math.round(fatto / piano * 100) : 0;
    const iProssimo = st.giorni.findIndex(x => x.data > o && x.giorno && !Cal.eRiposo(x.giorno));
    const fase = st.piano ? `${st.fase.name} — ${st.settimana.label}` : st.fase ? st.fase.name : '';
    const n = nome();
    root.innerHTML = `<section class="mh-hero">
        <div class="mh-hero-su"><span class="mh-avatar" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>
          <div class="mh-tondi"><button type="button" class="mh-tondo" data-mh="aggiorna" aria-label="Aggiorna da intervals.icu"><i data-lucide="refresh-cw"></i></button>
            <button type="button" class="mh-tondo" data-mh-vai="menu" aria-label="Menu"><i data-lucide="menu"></i></button></div></div>
        <h1 class="mh-saluto">${saluto()}, ${esc(n)}</h1>
        <div class="mh-riga"><span class="mh-etichetta">Carico della settimana</span><span class="mh-pillola">${pct}% del piano</span></div>
        <div class="mh-grande"><span class="mh-numero">${fatto.toLocaleString('it-IT')}</span><span class="mh-su">/ ${piano.toLocaleString('it-IT')} TSS</span></div>
        <div class="mh-barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, pct)}%"></i></div>
        <p class="mh-fase">Settimana ${Cal.numeroSettimana(ws)}${fase ? ` · ${esc(fase)}` : ''}</p>
        <div class="mh-stats">${stats()}</div>
      </section>
      <div class="mh-sezione"><h2>Questa settimana</h2><button type="button" class="mh-link" data-mh-vai="view-calendar">Calendario</button></div>
      <ol class="mh-lista">${st.giorni.map((x, i) => riga(x, i, i === iProssimo)).join('')}</ol>`;
    if (window.lucide) lucide.createIcons();
  }

  // ------- barra delle sezioni
  const tab = document.createElement('nav');
  tab.className = 'mh-tab';
  tab.setAttribute('aria-label', 'Sezioni');
  tab.innerHTML = TAB.map(([v, t, ico]) => `<button type="button" data-mh-vai="${v}" aria-label="${t}"><i data-lucide="${ico}"></i><span>${t}</span></button>`).join('');
  document.body.appendChild(tab);
  function segnaTab(v) { tab.querySelectorAll('button').forEach(b => b.classList.toggle('attivo', b.dataset.mhVai === v)); }

  function vai(v) {
    if (v === 'menu') { const m = document.getElementById('mw-apri-menu'); if (m) m.click(); return; }
    window.switchDashView(v);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mh-vai]');
    if (b && (tab.contains(b) || root.contains(b))) return vai(b.dataset.mhVai);
    const a = e.target.closest('#mh-root [data-mh="aggiorna"]');
    if (a) { if (typeof calCarica === 'function') calCarica(true); if (typeof fetchDashboard === 'function') fetchDashboard(); return; }
    const s = e.target.closest('#mh-root .mh-apri');
    if (s && s.dataset.sessione) window.showWorkoutDetail(s.dataset.sessione);
  });

  const cambia = window.switchDashView;
  window.switchDashView = function (v) {
    cambia(v);
    segnaTab(v);
    document.body.classList.toggle('mh-su-oggi', v === 'view-today');
  };

  // si ridisegna con il calendario (dati da intervals.icu), la forma, il nome
  const disegnaCal = window.disegnaCalendario;
  window.disegnaCalendario = function () { disegnaCal(); disegna(); };
  const applicaNome = window.mwApplicaNome;
  if (applicaNome) window.mwApplicaNome = function () { applicaNome(); disegna(); };
  document.addEventListener('mw-forma', disegna);
  document.addEventListener('mw-atleta', disegna);
  disegna();
  // da telefono la home è Oggi
  const attiva = (document.querySelector('.dash-view.active') || {}).id;
  if (telefono()) window.switchDashView('view-today'); else segnaTab(attiva);
})();

/* MirabiWatt · Attrezzatura (13/10/2026): bici, componenti montati, promemoria di manutenzione e storico delle sostituzioni,
 * dal gear di intervals.icu (che lo sincronizza da Strava). In Oggi una card Manutenzione quando qualcosa è in scadenza. */
(function () {
  'use strict';
  const root = document.getElementById('gear-root');
  if (!root || typeof Gear === 'undefined') return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const data = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const INTERVALS = 'https://intervals.icu/gear';
  let vista = null;

  if (typeof DASH_VIEWS !== 'undefined') DASH_VIEWS['view-gear'] = { title: 'Attrezzatura', icon: 'bike' };
  root.innerHTML = `<div class="mw-gear">
    <header class="mw-tools-testa"><div><div class="mw-pan-sopra">Attrezzatura</div><h2>Bici e componenti</h2>
      <p class="mw-aiuto" id="gear-fonte">Leggo il gear da intervals.icu…</p></div>
      <a class="mw-tb" href="${INTERVALS}" target="_blank" rel="noopener"><i data-lucide="external-link" class="w-4 h-4"></i> Gestisci su intervals.icu</a></header>
    <section class="mw-card" id="gear-avvisi"></section>
    <div id="gear-bici"></div>
    <div class="mw-gear-griglia">
      <section class="mw-card" id="gear-altra"></section>
      <section class="mw-card" id="gear-storico"></section>
    </div></div>`;

  function barra(p) {
    return `<div class="mw-gear-barra ${p.stato}" title="${esc(p.nome)}"><i style="width:${Math.min(100, p.percento)}%"></i></div>`;
  }
  function residuo(p) {
    if (p.kmMancanti != null) return p.kmMancanti <= 0 ? `<b class="mw-gear-oltre">${-p.kmMancanti} km oltre</b>` : `${p.kmMancanti} km${p.settimane != null ? ` · ~${p.settimane} settimane` : ''}`;
    if (p.giorniMancanti != null) return p.giorniMancanti <= 0 ? `<b class="mw-gear-oltre">${-p.giorniMancanti} giorni oltre</b>` : `${p.giorniMancanti} giorni`;
    return '';
  }

  function disegnaAvvisi() {
    const el = document.getElementById('gear-avvisi'), av = vista.avvisi;
    el.innerHTML = `<div class="mw-card-testa"><h3>Manutenzione</h3><span class="mw-stato ${av.length ? 'imprevisto' : 'fatto'}">${av.length ? `${av.length} da fare` : 'Tutto in regola'}</span></div>
      ${av.length ? av.map(a => `<div class="mw-gear-avviso ${a.stato}"><div><b>${esc(a.componente.nome)}</b> <small>${esc(a.componente.etichetta)} · ${esc(a.bici)}</small>
        <div class="mw-aiuto">${esc(a.promemoria.nome)} · soglia ${a.promemoria.kmSoglia ? a.promemoria.kmSoglia + ' km' : a.promemoria.giorniSoglia + ' giorni'} dal ${data(a.promemoria.dal)}</div></div>
        <div class="mw-gear-avviso-num"><b>${Math.round(a.promemoria.percento)}%</b><span>${residuo(a.promemoria)}</span></div>${barra(a.promemoria)}</div>`).join('')
        : '<p class="mw-aiuto">Nessun promemoria in scadenza. I promemoria si impostano su intervals.icu, per componente.</p>'}`;
  }

  function cardBici(b) {
    const righe = b.componenti.map(c => {
      const p = c.promemoria[0];
      return `<tr data-id="${esc(c.id)}"><td><b>${esc(c.etichetta)}</b><br><small>${esc(c.nome)}</small></td>
        <td>${c.km} km<br><small>dal ${data(c.acquisto)}</small></td>
        <td>${c.kmMediTipo ? `<small>media ${c.kmMediTipo} km</small>` : ''}</td>
        <td class="mw-gear-prom">${p ? `${barra(p)}<small>${esc(p.nome)} · ${Math.round(p.percento)}% · ${residuo(p)}</small>` : '<small>—</small>'}</td></tr>`;
    }).join('');
    return `<section class="mw-card mw-gear-bici${b.attivita ? '' : ' ferma'}"><div class="mw-card-testa"><h3>${esc(b.nome)}</h3>
        <span class="mw-aiuto">${b.virtuale ? 'Uscite sui rulli · ' : ''}${b.km} km · ${b.ore} h · ${b.attivita} attività${b.kmSettimana ? ` · <b>${b.kmSettimana} km/settimana</b> nelle ultime 6` : ''}</span></div>
      ${righe ? `<table class="mw-tab mw-gear-tab"><thead><tr><th>Componente</th><th>Km</th><th>Storico</th><th>Promemoria</th></tr></thead><tbody>${righe}</tbody></table>`
        : '<p class="mw-aiuto">Nessun componente montato.</p>'}</section>`;
  }

  function disegnaAltro() {
    const riga = x => `<li><b>${esc(x.nome)}</b> <small>${esc(x.etichetta)} · ${x.km} km${x.attivita ? ` · ${x.attivita} attività` : ''}</small></li>`;
    document.getElementById('gear-altra').innerHTML = `<div class="mw-card-testa"><h3>Altra attrezzatura</h3></div>
      <ul class="mw-gear-lista">${vista.altra.map(riga).join('')}</ul>
      ${vista.nonMontati.length ? `<h4 class="mw-sotto">Non montati</h4><ul class="mw-gear-lista">${vista.nonMontati.map(riga).join('')}</ul>` : ''}
      ${vista.ritirate.length ? `<h4 class="mw-sotto">Bici ritirate</h4><ul class="mw-gear-lista">${vista.ritirate.map(riga).join('')}</ul>` : ''}`;
    document.getElementById('gear-storico').innerHTML = `<div class="mw-card-testa"><h3>Storico sostituzioni</h3></div>
      ${vista.storico.map(s => `<details class="mw-gear-storico"><summary><b>${esc(s.etichetta)}</b> <small>${s.pezzi.length} ${s.pezzi.length === 1 ? 'sostituzione' : 'sostituzioni'}${s.kmMedi ? ` · media ${s.kmMedi} km` : ''}${s.vitaUsata ? ` · montato al ${s.vitaUsata}%` : ''}</small></summary>
        <table class="mw-tab"><tbody>${s.pezzi.map(p => `<tr><td>${esc(p.nome)}</td><td><small>${data(p.dal)} → ${data(p.al)}</small></td><td>${p.km} km</td></tr>`).join('')}</tbody></table></details>`).join('')
        || '<p class="mw-aiuto">Nessun componente ritirato.</p>'}`;
  }

  function disegna() {
    if (!vista) return;
    document.getElementById('gear-fonte').textContent = 'Da intervals.icu, sincronizzato da Strava · km dal montaggio · ritmo sulle ultime 6 settimane';
    disegnaAvvisi();
    document.getElementById('gear-bici').innerHTML = vista.bici.map(cardBici).join('');
    disegnaAltro();
    disegnaOggi();
    if (window.lucide) lucide.createIcons();
  }

  // Oggi: la card compare solo se qualcosa è in scadenza
  function disegnaOggi() {
    const griglia = document.querySelector('#oggi-root .mw-oggi-griglia');
    if (!griglia || !vista) return;
    let c = document.getElementById('oggi-manutenzione');
    if (!c) {
      c = document.createElement('section'); c.className = 'mw-card'; c.id = 'oggi-manutenzione';
      const dopo = document.getElementById('oggi-forma');
      griglia.insertBefore(c, dopo ? dopo.nextSibling : null);
    }
    const av = vista.avvisi;
    c.hidden = !av.length;
    c.innerHTML = `<div class="mw-card-testa"><h3>Manutenzione</h3><span class="mw-stato imprevisto">${av.length} ${av.length === 1 ? 'intervento' : 'interventi'}</span></div>
      <ul class="mw-gear-lista">${av.slice(0, 4).map(a => `<li><b>${esc(a.componente.nome)}</b> <small>${esc(a.promemoria.nome)} · ${residuo(a.promemoria)}</small></li>`).join('')}</ul>
      <button type="button" class="mw-tb" data-vai-gear><i data-lucide="bike" class="w-4 h-4"></i> Attrezzatura</button>`;
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-vai-gear]')) switchDashView('view-gear'); });

  async function carica() {
    try {
      const r = await fetch('/api/gear');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      vista = Gear.vista(await r.json());
      disegna();
    } catch (e) {
      document.getElementById('gear-fonte').textContent = 'intervals.icu non risponde: riprovo quando riapri la pagina.';
    }
  }
  const prima = window.switchDashView;
  window.switchDashView = function (id) { prima(id); if (id === 'view-gear' && !vista) carica(); };
  carica();
})();

/* MirabiWatt · Tools rifatti nello stile della dashboard (14/10/2026 sera): Idratazione, Predittore di prestazione, Salite.
 * Peso, FTP, CP e W' arrivano da intervals.icu (window.mwAtleta, vedi fetchDashboard); il peso della bici si ricorda nelle
 * preferenze del server. Calcoli in strumenti.js. */
(function () {
  'use strict';
  const root = document.getElementById('strumenti-root');
  if (!root) return;
  const TOOLS = [['idratazione', 'Idratazione', 'droplet', 'La borraccia: carboidrati, rapporto maltodestrine/fruttosio, sale, tonicità'],
    ['predittore', 'Predittore di prestazione', 'trending-up', 'Che potenza serve per una media su un percorso, e quanto ci metti'],
    ['salite', 'Salite', 'mountain', 'Tempo e VAM alla potenza che scegli, quanto la reggi con il tuo W\'']];
  let scelto = 'idratazione', pesoBici = 8.5, inizializzato = false;
  const at = () => window.mwAtleta || {};
  const num = id => parseFloat(String((root.querySelector('#' + id) || {}).value || '').replace(',', '.')) || 0;
  const ore = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
  const min = s => (s === Infinity ? '' : s >= 3600 ? ore(s / 3600) : `${Math.floor(s / 60)}′${String(Math.round(s % 60)).padStart(2, '0')}″`);
  const campo = (id, label, valore, extra = '') => `<label>${label}<input id="${id}" inputmode="decimal" value="${valore}" ${extra}></label>`;

  function struttura() {
    root.innerHTML = `<div class="mw-tools">
      <div class="mw-tools-testa"><div><div class="mw-pan-sopra">Tools</div><h2>Calcolatrici</h2></div>
        <div class="mw-seg" role="tablist">${TOOLS.map(([k, t, ico]) => `<button type="button" data-strumento="${k}" role="tab"><i data-lucide="${ico}" class="w-4 h-4"></i> ${t}</button>`).join('')}</div></div>
      <p class="mw-aiuto" id="strumenti-atleta"></p>
      <section class="mw-card mw-tool" data-pannello="idratazione">
        <div class="mw-card-testa"><h3>Idratazione</h3><span class="mw-aiuto">${TOOLS[0][3]}</span></div>
        <div class="mw-tool-corpo"><form class="mw-form" onsubmit="return false">
            <label class="mw-largo">Rapporto<select id="hyd-ratio"><option value="2:1">2:1 maltodestrine/fruttosio</option><option value="1:0.8">1:0,8 (avanzato)</option></select></label>
            <label>Borraccia<select id="hyd-volume"><option value="500">500 ml</option><option value="750" selected>750 ml</option><option value="1000">1000 ml</option></select></label>
            ${campo('hyd-carbo', 'Carboidrati (g)', 60)}${campo('hyd-sale', 'Sale (g)', 1)}
          </form><div id="hyd-risultato" class="mw-risultato"></div></div>
      </section>
      <section class="mw-card mw-tool" data-pannello="predittore">
        <div class="mw-card-testa"><h3>Predittore di prestazione</h3><span class="mw-aiuto">${TOOLS[1][3]}</span></div>
        <div class="mw-tool-corpo"><form class="mw-form" onsubmit="return false">
            ${campo('pred-peso', 'Peso atleta (kg)', '')}${campo('pred-bici', 'Peso bici (kg)', pesoBici)}
            ${campo('pred-km', 'Distanza (km)', 100)}${campo('pred-dislivello', 'Dislivello (m)', 1500)}${campo('pred-velocita', 'Media (km/h)', 28)}
          </form><div id="pred-risultato" class="mw-risultato"></div></div>
      </section>
      <section class="mw-card mw-tool" data-pannello="salite">
        <div class="mw-card-testa"><h3>Salite</h3><span class="mw-aiuto">${TOOLS[2][3]}</span></div>
        <div class="mw-tool-corpo"><form class="mw-form" onsubmit="return false">
            ${campo('sal-km', 'Lunghezza (km)', 10)}${campo('sal-dislivello', 'Dislivello (m)', 800)}
            ${campo('sal-peso', 'Peso atleta (kg)', '')}${campo('sal-bici', 'Peso bici (kg)', pesoBici)}${campo('sal-watt', 'Potenza (W)', '')}
          </form><div id="sal-risultato" class="mw-risultato"></div></div>
        <table class="mw-tab" id="sal-livelli"><thead><tr><th>Livello</th><th>VAM</th><th>Tempo</th><th>Potenza</th><th>W/kg</th></tr></thead><tbody></tbody></table>
      </section>
    </div>`;
    inizializzato = true;
  }

  // i valori dell'atleta nei campi (solo se non li hai già cambiati tu)
  function riempi() {
    const a = at();
    for (const id of ['pred-peso', 'sal-peso']) { const el = root.querySelector('#' + id); if (el && !el.dataset.toccato && a.peso) el.value = a.peso; }
    const w = root.querySelector('#sal-watt'); if (w && !w.dataset.toccato && a.ftp) w.value = a.ftp;
    for (const id of ['pred-bici', 'sal-bici']) { const el = root.querySelector('#' + id); if (el && !el.dataset.toccato) el.value = pesoBici; }
    root.querySelector('#strumenti-atleta').textContent = a.ftp ? `Dai tuoi dati di intervals.icu: ${a.peso} kg · FTP ${a.ftp} W · CP ${a.cp} W · W' ${a.wPrime} J. Cambiali nei campi per una prova.` : 'Leggo i tuoi dati da intervals.icu…';
  }

  function idratazione() {
    const i = Strumenti.idratazione({ ratio: root.querySelector('#hyd-ratio').value, volume: num('hyd-volume'), carbo: num('hyd-carbo'), sale: num('hyd-sale') });
    const pm = Math.round(i.malto), pf = Math.round(i.fruttosio), tot = Math.max(1, i.carbo);
    root.querySelector('#hyd-risultato').innerHTML = `<div class="mw-kpi-griglia">
        <div class="mw-kpi"><span>Tonicità</span><b class="ton-${i.tonicita.split(' ')[0].toLowerCase()}">${i.tonicita}</b><small>${String(i.conc).replace('.', ',')}% di carboidrati</small></div>
        <div class="mw-kpi"><span>Maltodestrine</span><b>${pm} g</b></div><div class="mw-kpi"><span>Fruttosio</span><b>${pf} g</b></div>
        <div class="mw-kpi"><span>Sale</span><b>${String(i.sale).replace('.', ',')} g</b></div></div>
      <div class="mw-barra-composta" aria-hidden="true"><i class="malto" style="width:${pm / tot * 100}%"></i><i class="fruttosio" style="width:${pf / tot * 100}%"></i></div>
      ${i.limitato ? `<p class="mw-aiuto stato-sopra">Al massimo ${i.max} g in questa borraccia: oltre non si scioglie bene.</p>` : ''}
      <p class="mw-aiuto">Fino a 6% ipotonica, 6-8% isotonica (assorbimento migliore), oltre ipertonica. Il rapporto 2:1 sfrutta i due trasportatori SGLT1 e GLUT5; 1:0,8 permette più grammi l'ora se l'intestino è allenato.</p>`;
  }

  function predittore() {
    const peso = num('pred-peso'), massa = peso + num('pred-bici'), km = num('pred-km'), d = num('pred-dislivello'), v = num('pred-velocita'), a = at();
    if (!peso || !v) { root.querySelector('#pred-risultato').innerHTML = '<p class="mw-aiuto">Scrivi peso e media.</p>'; return; }
    const pend = km ? d / (km * 1000) * 100 : 0, p = Strumenti.potenza(v, pend, massa), tot = Math.max(1, p.rotolamento + p.aero + Math.max(0, p.gravita));
    const pct = a.ftp ? Math.round(p.totale / a.ftp * 100) : null;
    root.querySelector('#pred-risultato').innerHTML = `<div class="mw-kpi-griglia">
        <div class="mw-kpi"><span>Potenza media</span><b>${Math.round(p.totale)} W</b><small>${(p.totale / peso).toFixed(2)} W/kg</small></div>
        ${pct ? `<div class="mw-kpi"><span>Intensità</span><b>${pct}% della FTP</b><small>${Strumenti.zone(a.ftp, a.zone, a.nomiZone).find(z => z.a == null || p.totale <= z.a).nome}</small></div>` : ''}
        <div class="mw-kpi"><span>Tempo</span><b>${km ? ore(km / v) : '–'}</b><small>pendenza media ${pend.toFixed(1).replace('.', ',')}%</small></div></div>
      <div class="mw-barra-composta" aria-label="Da dove viene la fatica"><i class="aria" style="width:${p.aero / tot * 100}%">aria</i><i class="gravita" style="width:${Math.max(0, p.gravita) / tot * 100}%">gravità</i><i class="rotolamento" style="width:${p.rotolamento / tot * 100}%">attrito</i></div>
      <p class="mw-aiuto">Pendenza costante su tutto il percorso, posizione da strada (CdA 0,32), gomme normali (Crr 0,004). In pianura conta l'aria, sopra il 4-5% la gravità.</p>`;
  }

  function salite() {
    const km = num('sal-km'), d = num('sal-dislivello'), peso = num('sal-peso'), massa = peso + num('sal-bici'), watt = num('sal-watt'), a = at();
    const out = root.querySelector('#sal-risultato'), body = root.querySelector('#sal-livelli tbody');
    if (!km || !d || !peso || !watt) { out.innerHTML = '<p class="mw-aiuto">Scrivi lunghezza, dislivello, peso e potenza.</p>'; body.innerHTML = ''; return; }
    const s = Strumenti.salita({ km, dislivello: d, massa, watt, cp: a.cp, wPrime: a.wPrime, massaAtleta: peso });
    const sopra = a.cp && watt > a.cp;
    out.innerHTML = `<div class="mw-kpi-griglia">
        <div class="mw-kpi"><span>Tempo</span><b>${ore(s.tempoOre)}</b><small>pendenza media ${String(s.pendenza).replace('.', ',')}%</small></div>
        <div class="mw-kpi"><span>Velocità</span><b>${s.velocita.toFixed(1).replace('.', ',')} km/h</b><small>VAM ${s.vam} m/h</small></div>
        <div class="mw-kpi"><span>Potenza</span><b>${watt} W</b><small>${(watt / peso).toFixed(2)} W/kg${a.ftp ? ` · ${Math.round(watt / a.ftp * 100)}% FTP` : ''}</small></div></div>
      ${!a.cp ? '' : sopra
        ? `<p class="mw-nota ${s.esaurito ? 'stato-sopra' : ''}">${watt} W sono sopra il CP (${a.cp} W): il W' (${a.wPrime} J) si svuota in circa ${min(s.reggi)}. ${s.esaurito ? `La salita dura ${ore(s.tempoOre)}: non la reggi a questa potenza, abbassa verso il CP.` : 'La salita finisce prima: ci stai dentro, ma arrivi vuoto.'}</p>`
        : `<p class="mw-nota">${watt} W sono sotto il CP (${a.cp} W): sostenibile a lungo, il limite lo danno fatica e alimentazione.</p>`}`;
    body.innerHTML = s.livelli.map(l => `<tr${Math.abs(l.vam - s.vam) < 100 ? ' class="tu"' : ''}><td>${l.nome}</td><td>${l.vam} m/h</td><td>${ore(l.tempoOre)}</td><td><b>${l.watt} W</b></td><td>${l.wkg.toFixed(2)}</td></tr>`).join('');
  }

  function mostra(k) {
    scelto = k;
    if (!inizializzato) struttura();
    root.querySelectorAll('[data-strumento]').forEach(b => { b.classList.toggle('scelto', b.dataset.strumento === k); b.setAttribute('aria-selected', b.dataset.strumento === k); });
    root.querySelectorAll('[data-pannello]').forEach(p => { p.hidden = p.dataset.pannello !== k; });
    riempi(); ricalcola();
    lucide.createIcons();
  }
  function ricalcola() { if (scelto === 'idratazione') idratazione(); else if (scelto === 'predittore') predittore(); else salite(); }

  struttura();
  root.addEventListener('click', e => { const b = e.target.closest('[data-strumento]'); if (b) mostra(b.dataset.strumento); });
  root.addEventListener('input', e => {
    if (e.target.matches('input, select')) e.target.dataset.toccato = '1';
    if (/-bici$/.test(e.target.id)) {
      pesoBici = parseFloat(e.target.value.replace(',', '.')) || pesoBici;
      fetch('/api/preferenze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pesoBici }) }).catch(() => {});
    }
    ricalcola();
  });
  root.addEventListener('change', ricalcola);
  document.addEventListener('mw-atleta', () => { riempi(); ricalcola(); });
  fetch('/api/preferenze').then(r => r.json()).then(j => { if (j && j.pesoBici) { pesoBici = j.pesoBici; riempi(); ricalcola(); } }).catch(() => {});
  // il vecchio indirizzo index.html (e chi apre /#strumenti) arriva qui
  document.addEventListener('DOMContentLoaded', () => { if (location.hash === '#strumenti' && window.switchDashView) window.switchDashView('view-tools'); });
  mostra('idratazione');
})();

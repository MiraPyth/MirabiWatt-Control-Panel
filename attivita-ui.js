/* MirabiWatt · attività nel calendario come intervals.icu (13/10/2026): schede con i campi scelti (durata, distanza, FC,
 * watt, load, intensità, orario, kJ, zone, aderenza), dettaglio al tocco, abbinamento al pianificato trascinando la
 * sessione sull'attività (o con «Abbina» nel dettaglio, da telefono). Caricato prima di calendario-ui.js: calCella usa
 * calSchedaHTML; calDati (con gli eventi di intervals.icu) arriva da calCarica. */
let calCampi = null; // null: i campi predefiniti
let calTrascino = null;
const calCampiScelti = () => calCampi || Cal.campiPredefiniti();
const CAL_STUB = 'Questa attività è arrivata su intervals.icu da Strava: per le regole di Strava intervals.icu non ne passa i dati via API e non si può abbinare da qui. '
  + 'Abbinala su intervals.icu oppure collega Zwift direttamente a intervals.icu (Settings → Connections → Zwift): le prossime uscite arriveranno complete.';

function calSchedaHTML(a) {
  const s = Cal.schedaAttivita(a, calCampiScelti()), ab = a.abbinata ? ' abbinata' : '';
  const testa = `<div class="mw-a-testa"><span class="mw-a-ico" aria-hidden="true">${a.indoor ? '🚲' : '🚴'}</span>`;
  const piano = a.abbinata ? '<span class="mw-a-piano">🔗 pianificato</span>' : '';
  if (s.stub) {
    return `<div class="mw-attivita stub${ab}" data-attivita="${calEsc(a.id)}" role="button" tabindex="0" title="${calEsc(s.nota)}">
      ${testa}<b>${calEsc(a.start || '')}</b></div><span class="mw-a-nome">${calEsc(s.titolo)}</span>
      <span class="mw-a-nota">dati solo su intervals.icu</span>${piano}</div>`;
  }
  const ok = s.compliance == null ? '' : `<span class="mw-a-ok ${s.compliance >= 80 ? 'alta' : s.compliance >= 50 ? 'media' : 'bassa'}">✓ ${s.compliance}%</span>`;
  return `<div class="mw-attivita${ab}" data-attivita="${calEsc(a.id)}" role="button" tabindex="0">
    ${testa}${s.testa.map(t => `<b>${calEsc(t)}</b>`).join('')}</div>
    <div class="mw-a-corpo">${s.righe.map(r => `<span class="mw-a-riga">${calEsc(r)}</span>`).join('')}${ok}</div>
    ${s.zone.length ? `<div class="mw-a-zone">${s.zone.map(z => `<i class="zp-${z.z.toLowerCase()}" style="width:${z.pct}%" title="${z.z} ${z.pct}%"></i>`).join('')}</div>` : ''}
    <span class="mw-a-nome">${calEsc(s.titolo)}</span>${piano}</div>`;
}

/** L'allenamento pianificato su intervals.icu di quel giorno (quello con il nome della sessione, se ce n'è più d'uno). */
function calEventoDelGiorno(data) {
  const ev = (calDati.eventi || []).filter(e => e.date === data);
  const cella = document.querySelector(`.mw-giorno[data-data="${data}"] .mw-sessione`), nome = cella ? cella.dataset.sessione : '';
  return ev.find(e => e.name.replace(/^\[(MirabiWatt|MW)\]\s*/, '') === nome) || ev[0] || null;
}

async function calAbbina(id, data) {
  const a = (calDati.activities || []).find(x => String(x.id) === String(id));
  if (!a) return;
  if (a.date !== data) { mwAvviso('Il pianificato si abbina a un\'attività dello stesso giorno.'); return; }
  if (a.strava) { mwAvviso('Attività arrivata da Strava: intervals.icu non permette di abbinarla via API. Abbinala su intervals.icu.'); return; }
  const ev = calEventoDelGiorno(data);
  if (!ev) { mwAvviso('Su intervals.icu non c\'è ancora il pianificato di questo giorno: invia prima la settimana.'); return; }
  try {
    const r = await fetch('/api/abbina', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activityId: a.id, eventId: ev.id }) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
    mwAvviso(`Abbinata a «${ev.name.replace(/^\[(MirabiWatt|MW)\]\s*/, '')}»`);
    calCarica(true);
  } catch (e) { mwAvviso(e.message); }
}

function calApriAttivita(id) {
  const a = (calDati.activities || []).find(x => String(x.id) === String(id));
  if (!a) return;
  const m = document.getElementById('cal-attivita'), corpo = document.getElementById('cal-attivita-corpo');
  const quando = parseISO(a.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) + (a.start ? ` · ${a.start}` : '');
  const link = `<a class="mw-tb" href="https://intervals.icu/activities/${calEsc(a.id)}" target="_blank" rel="noopener"><i data-lucide="external-link" class="w-4 h-4"></i> Apri su intervals.icu</a>`;
  const ev = calEventoDelGiorno(a.date), nomeEv = ev ? ev.name.replace(/^\[(MirabiWatt|MW)\]\s*/, '') : '';
  if (a.strava) {
    corpo.innerHTML = `<div class="mw-pan-sopra">${calEsc(quando)}</div><h3>Attività delle ${calEsc(a.start || '')}</h3>
      <p class="mw-aiuto">${CAL_STUB}</p>${a.abbinata && ev ? `<p>🔗 Abbinata a «${calEsc(nomeEv)}» su intervals.icu.</p>` : ''}<div class="mw-att-azioni">${link}</div>`;
  } else {
    const s = Cal.schedaAttivita(a, Cal.CAMPI_ATTIVITA.map(c => c.id));
    const kpi = (k, v) => (v == null || v === '' ? '' : `<div class="mw-kpi"><span>${k}</span> <b>${calEsc(v)}</b></div>`);
    const min = sec => `${Math.round(sec / 60)}′`;
    corpo.innerHTML = `<div class="mw-pan-sopra">${calEsc(quando)}</div><h3>${calEsc(s.titolo)}</h3>
      <div class="mw-kpi-griglia">${kpi('Durata', s.testa[0])}${kpi('Distanza', a.distanceKm != null ? `${a.distanceKm.toFixed(2)} km` : null)}
        ${kpi('FC media', a.hr != null ? `${a.hr} bpm` : null)}${kpi('Potenza media', a.watt != null ? `${a.watt} W` : null)}${kpi('NP', a.np != null ? `${a.np} W` : null)}
        ${kpi('Load', a.tss)}${kpi('Intensità', a.intensita != null ? `${a.intensita}%` : null)}${kpi('Lavoro', a.kj != null ? `${a.kj} kJ` : null)}
        ${kpi('Calorie', a.kcal != null ? `${a.kcal} kcal` : null)}${kpi('Aderenza al piano', a.compliance != null ? `${a.compliance}%` : null)}</div>
      ${s.zone.length ? `<h4 class="mw-sotto">Tempo nelle zone</h4><div class="mw-att-zone">${s.zone.map((z, i) => `<div class="mw-att-zona"><span>${z.z}</span>
        <div class="mw-att-barra"><i class="zp-${z.z.toLowerCase()}" style="width:${z.pct}%"></i></div><small>${min(a.zone[i])} · ${z.pct}%</small></div>`).join('')}</div>` : ''}
      <div class="mw-att-azioni">${a.abbinata ? `<span class="mw-stato fatto">🔗 Abbinata${ev ? ` a «${calEsc(nomeEv)}»` : ''}</span>`
        : ev ? `<button type="button" class="mw-tb mw-primario" data-abbina="${ev.id}"><i data-lucide="link" class="w-4 h-4"></i> Abbina a «${calEsc(nomeEv)}»</button>` : ''}${link}</div>`;
  }
  m.dataset.attivita = a.id;
  m.hidden = false;
  if (window.lucide) lucide.createIcons();
}

function calMenuCampi() {
  const menu = document.getElementById('cal-campi-menu'), scelti = new Set(calCampiScelti());
  menu.innerHTML = `<div class="mw-pan-sopra">Campi delle schede</div>` + Cal.CAMPI_ATTIVITA.map(c =>
    `<label class="mw-campo"><input type="checkbox" data-campo="${c.id}"${scelti.has(c.id) ? ' checked' : ''}> ${c.nome}</label>`).join('');
}

(function () {
  'use strict';
  const righe = document.getElementById('cal-righe'), m = document.getElementById('cal-attivita');
  if (!righe || !m) return;
  const chiudi = () => { m.hidden = true; };
  document.getElementById('cal-attivita-chiudi').addEventListener('click', chiudi);
  m.addEventListener('click', e => {
    if (e.target === m) chiudi();
    const b = e.target.closest('[data-abbina]');
    if (b) { const a = (calDati.activities || []).find(x => String(x.id) === m.dataset.attivita); chiudi(); if (a) calAbbina(a.id, a.date); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudi(); });
  righe.addEventListener('click', e => { const t = e.target.closest('.mw-attivita'); if (t) calApriAttivita(t.dataset.attivita); });
  righe.addEventListener('keydown', e => { const t = e.target.closest('.mw-attivita'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); calApriAttivita(t.dataset.attivita); } });

  // trascino la sessione pianificata sull'attività, come su intervals.icu
  righe.addEventListener('dragstart', e => {
    const s = e.target.closest('.mw-sessione[draggable="true"]');
    if (!s) return;
    calTrascino = s.closest('.mw-giorno').dataset.data;
    e.dataTransfer.setData('text/plain', calTrascino);
    e.dataTransfer.effectAllowed = 'link';
  });
  righe.addEventListener('dragover', e => {
    const t = e.target.closest('.mw-attivita');
    if (!t || !calTrascino) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'link'; t.classList.add('drop');
  });
  righe.addEventListener('dragleave', e => { const t = e.target.closest('.mw-attivita'); if (t) t.classList.remove('drop'); });
  righe.addEventListener('drop', e => {
    const t = e.target.closest('.mw-attivita');
    if (!t) return;
    e.preventDefault(); t.classList.remove('drop');
    const data = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || calTrascino;
    calTrascino = null;
    if (data) calAbbina(t.dataset.attivita, data);
  });
  righe.addEventListener('dragend', () => { calTrascino = null; });

  // campi delle schede, salvati sul server
  const bottone = document.getElementById('cal-campi'), menu = document.getElementById('cal-campi-menu');
  bottone.addEventListener('click', e => { e.stopPropagation(); calMenuCampi(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#cal-campi-menu')) menu.hidden = true; });
  menu.addEventListener('change', e => {
    if (!e.target.matches('input[data-campo]')) return;
    calCampi = [...menu.querySelectorAll('input[data-campo]:checked')].map(i => i.dataset.campo);
    disegnaCalendario();
    fetch('/api/preferenze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campiAttivita: calCampi }) }).catch(() => {});
  });
  fetch('/api/preferenze').then(r => r.json()).then(p => {
    if (p && Array.isArray(p.campiAttivita)) { calCampi = p.campiAttivita; if (typeof disegnaCalendario === 'function') disegnaCalendario(); }
  }).catch(() => {});
})();

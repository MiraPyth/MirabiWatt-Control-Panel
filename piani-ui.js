/* MirabiWatt · scelta del piano stagionale in Stagione (19/10/2026). I piani stanno sull'OptiPlex (piani/*.json);
 * cambiarlo salva la scelta e ricarica la pagina, perché calendario, Oggi e Stagione leggono il piano al caricamento. */
(function () {
  'use strict';
  const sel = document.getElementById('piano-scelta'), stato = document.getElementById('piano-stato');
  if (!sel) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ricarica = () => (window.mwRicarica || (() => location.reload()))();

  fetch('/api/piani').then(r => r.json()).then(j => {
    sel.innerHTML = j.piani.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');
    sel.value = j.attivo;
    sel.dataset.attivo = j.attivo;
    // 19/10 sera: col piano mixed si sceglie il lunedì in cui parte la palestra (da questa settimana in poi)
    const riga = document.getElementById('piano-inizio-riga'), ini = document.getElementById('piano-inizio');
    if (j.attivo !== 'mixed-body-building' || !j.finestra) { riga.hidden = true; return; }
    const lunedi = [], oggi = fmtISO(mondayOf(new Date()));
    for (let d = parseISO(j.finestra[0]); fmtISO(d) <= j.finestra[1]; d = addDays(d, 7)) if (fmtISO(d) >= oggi || fmtISO(d) === j.inizioPalestra) lunedi.push(fmtISO(d));
    ini.innerHTML = lunedi.map(x => `<option value="${x}">lun ${x.slice(8, 10)}/${x.slice(5, 7)}</option>`).join('');
    ini.value = j.inizioPalestra;
    ini.dataset.attivo = j.inizioPalestra;
    riga.hidden = false;
  }).catch(() => { stato.textContent = 'Piani non raggiungibili'; });

  document.getElementById('piano-inizio').addEventListener('change', async ev => {
    const ini = ev.target;
    stato.textContent = 'Sposto l\'inizio…';
    try {
      const r = await fetch('/api/piani/inizio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inizio: ini.value }) });
      if (!r.ok) throw new Error();
      ricarica();
    } catch (e) {
      ini.value = ini.dataset.attivo;
      stato.textContent = 'Non sono riuscito a spostare l\'inizio';
    }
  });

  sel.addEventListener('change', async () => {
    stato.textContent = 'Cambio piano…';
    try {
      const r = await fetch('/api/piani', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.value }) });
      if (!r.ok) throw new Error();
      ricarica();
    } catch (e) {
      sel.value = sel.dataset.attivo;
      stato.textContent = 'Non sono riuscito a cambiare piano';
    }
  });
})();

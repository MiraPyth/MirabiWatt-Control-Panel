/* MirabiWatt · scheda Strava in Tools (19/10/2026 sera): stato del collegamento, «Collega Strava», «Verifica
 * collegamento» (legge solo il profilo atleta, non pubblica nulla) e l'interruttore dell'invio automatico delle sedute. */
(function () {
  'use strict';
  const root = document.getElementById('strava-root');
  if (!root) return;
  const COLLEGA = 'http://mira-optiplex.tail2a9ecd.ts.net:3000/strava/collega';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let stato = null, verifica = null;

  function disegna() {
    const s = stato || {};
    let corpo;
    if (!stato) corpo = '<p class="mw-aiuto">Controllo…</p>';
    else if (!s.configurato) corpo = '<p class="mw-aiuto">Manca il file .strava.env sull\'OptiPlex.</p>';
    else if (!s.collegato) corpo = `<p class="mw-strava-stato no">Non collegato</p>
      <p class="mw-aiuto">Con Tailscale attivo, apri il collegamento e autorizza MirabiWatt lasciando la spunta su «caricare le attività».</p>
      <a class="mw-strava-btn" href="${COLLEGA}" target="_blank" rel="noopener">Collega Strava</a>`;
    else {
      const v = verifica === 'attesa' ? '<p class="mw-aiuto">Chiedo a Strava…</p>'
        : verifica && verifica.ok ? `<p class="mw-strava-ok">✓ Strava risponde: profilo di ${esc(verifica.atleta)}${verifica.scope && !/activity:write/.test(verifica.scope) ? ' · manca il permesso di pubblicare, ricollega' : ''}</p>`
        : verifica ? `<p class="mw-strava-ko">Strava non risponde (${esc(verifica.error || 'non collegato')}). <a href="${COLLEGA}" target="_blank" rel="noopener">Ricollega</a></p>` : '';
      corpo = `<p class="mw-strava-stato si">Collegato${s.atleta ? ` · ${esc(s.atleta)}` : ''}</p>
      <div class="mw-strava-azioni"><button type="button" class="mw-tb" id="strava-verifica">Verifica collegamento</button>
        <a class="mw-tb" href="${COLLEGA}" target="_blank" rel="noopener">Ricollega</a></div>${v}
      <label class="mw-strava-auto"><input type="checkbox" id="strava-auto"${s.auto ? ' checked' : ''}> Pubblica in automatico ogni seduta salvata</label>
      <p class="mw-aiuto">La verifica legge solo il tuo profilo: su Strava non compare niente.</p>`;
    }
    root.innerHTML = `<section class="mw-card mw-strava"><div class="mw-card-testa"><h3>Strava</h3><span class="mw-aiuto">Le sedute di palestra nel tuo storico Strava, come con JEFIT</span></div>${corpo}</section>`;
  }

  async function carica() {
    try { stato = await (await fetch('/api/strava/stato')).json(); } catch (e) { stato = { configurato: true, collegato: false }; }
    disegna();
  }

  root.addEventListener('click', async e => {
    if (e.target.closest('#strava-verifica')) {
      verifica = 'attesa'; disegna();
      try { verifica = await (await fetch('/api/strava/verifica')).json(); } catch (x) { verifica = { ok: false, error: 'rete' }; }
      disegna();
    }
  });
  root.addEventListener('change', async e => {
    if (e.target.id !== 'strava-auto') return;
    const auto = e.target.checked;
    try { stato.auto = (await (await fetch('/api/strava/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto }) })).json()).auto; } catch (x) { /* resta com'era */ }
    disegna();
  });
  // al ritorno dalla pagina di autorizzazione (altra scheda) lo stato si aggiorna da solo
  document.addEventListener('visibilitychange', () => { if (!document.hidden) carica(); });
  carica();
})();

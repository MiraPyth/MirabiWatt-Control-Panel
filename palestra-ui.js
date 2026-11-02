/* MirabiWatt · app di allenamento in palestra (19/10/2026). «INIZIA ALLENAMENTO» dal dettaglio della seduta (o da Oggi):
 * riscaldamento, poi esercizio per esercizio con GIF, serie con kg e ripetizioni precompilati dallo storico, recupero a
 * tempo, e alla fine il salvataggio sull'OptiPlex (/api/palestra/sessioni). La sessione in corso resta in localStorage:
 * se il telefono ricarica la pagina si riprende da dove eri. Logica in palestra.js (Palestra), scheda da workout-library.js. */
(function () {
  'use strict';
  const CHIAVE = 'mirabiwatt_palestra_bozza';
  const ATTREZZO_KG = { manubri: 'kg per manubrio', bilanciere: 'kg totali', cavo: 'kg', macchina: 'kg', elastico: 'kg elastico' };  // elastico: la resistenza scritta sopra
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtKg = k => k == null ? '' : String(Math.round(k * 10) / 10);
  const dataBreve = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
  let stravaEsito = null;   // dopo il salvataggio: { ok, url } | { ok:false, error } | { collegato, auto } (19/10 notte)
  const STRAVA_COLLEGA = 'http://mira-optiplex.tail2a9ecd.ts.net:3000/strava/collega';
  let s = null, salvata = false, timer = { fine: 0, h: null }, orologio = null, audio = null, wakeLock = null;

  function salvaBozza() { try { localStorage.setItem(CHIAVE, JSON.stringify(s)); } catch (e) { /* pazienza */ } }
  function leggiBozza() { try { return JSON.parse(localStorage.getItem(CHIAVE) || 'null'); } catch (e) { return null; } }
  function togliBozza() { try { localStorage.removeItem(CHIAVE); } catch (e) { /* pazienza */ } }

  function app() {
    let el = document.getElementById('mw-palestra');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'mw-palestra';
    el.className = 'mw-palestra';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Allenamento in palestra');
    el.innerHTML = `<header class="pal-testa">
        <button type="button" id="pal-esci" class="pal-esci" aria-label="Esci e interrompi l'allenamento">← Esci</button>
        <div class="pal-titolo"><b id="pal-seduta"></b><small id="pal-stato"></small></div>
        <span id="pal-tempo" class="pal-tempo">0:00</span>
      </header>
      <nav id="pal-chips" class="pal-chips" aria-label="Esercizi"></nav>
      <main id="pal-corpo" class="pal-corpo"></main>
      <div id="pal-timer" class="pal-timer" hidden role="timer" aria-live="polite">
        <div><small id="pal-timer-etichetta">Recupero</small><b id="pal-timer-tempo">0:00</b></div>
        <button type="button" id="pal-timer-meno">−15″</button><button type="button" id="pal-timer-piu">+15″</button>
        <button type="button" id="pal-timer-salta" class="pal-primario">Salta</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', clic);
    el.addEventListener('change', cambio);
    return el;
  }

  // ------- timer di recupero (e per gli esercizi a tempo): conta sull'ora di fine, quindi regge lo schermo spento
  const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  function avviaTimer(sec, etichetta) {
    timer.fine = Date.now() + sec * 1000;
    document.getElementById('pal-timer-etichetta').textContent = etichetta;
    document.getElementById('pal-timer').hidden = false;
    aggiornaTimer();
    clearInterval(timer.h);
    timer.h = setInterval(aggiornaTimer, 250);
  }
  function aggiornaTimer() {
    const resta = Math.max(0, Math.ceil((timer.fine - Date.now()) / 1000));
    document.getElementById('pal-timer-tempo').textContent = resta ? mmss(resta) : 'Vai!';
    if (!resta && timer.h) {
      clearInterval(timer.h); timer.h = null;
      suona();
      setTimeout(() => { if (!timer.h) fermaTimer(); }, 4000);
    }
  }
  function fermaTimer() { clearInterval(timer.h); timer.h = null; const t = document.getElementById('pal-timer'); if (t) t.hidden = true; }
  function suona() {
    try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { /* niente vibrazione */ }
    try {
      if (!audio) return;
      [0, 0.25].forEach(t => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880; g.gain.value = 0.2;
        o.connect(g); g.connect(audio.destination);
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.15);
      });
    } catch (e) { /* niente audio */ }
  }
  function sbloccaAudio() {
    try { if (!audio && (window.AudioContext || window.webkitAudioContext)) audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* niente audio */ }
  }

  // ------- disegno
  function disegna() {
    const el = app(), n = s.esercizi.length;
    document.getElementById('pal-seduta').textContent = s.seduta;
    document.getElementById('pal-stato').textContent = s.indice < 0 ? s.schema : s.indice >= n ? 'Fine' : `${s.schema} · ${s.indice + 1} di ${n}`;
    document.getElementById('pal-chips').innerHTML = s.esercizi.map((e, i) => {
      const fatte = e.serie.filter(x => x.fatta).length;
      return `<button type="button" data-pal-vai="${i}" class="${i === s.indice ? 'sel' : ''} ${fatte >= e.serie.length - (e.facoltative || 0) ? 'fatto' : fatte ? 'parziale' : ''}">${i + 1}</button>`;
    }).join('') + `<button type="button" data-pal-vai="${n}" class="${s.indice >= n ? 'sel' : ''}" aria-label="Fine">✓</button>`;
    const corpo = document.getElementById('pal-corpo');
    corpo.innerHTML = s.indice < 0 ? riscaldamento() : s.indice >= n ? fine() : esercizio(s.esercizi[s.indice]);
    corpo.scrollTop = 0;
    el.scrollTop = 0;
  }

  function riscaldamento() {
    return `<section class="pal-card">
        <h2>Riscaldamento</h2>
        <p>${esc(s.riscaldamento || 'Riscaldamento: 5\' cyclette o vogatore, mobilità spalle, serie leggere del primo esercizio')}.</p>
        <p><b>Scopo.</b> ${esc(s.scopo || '')}</p>
        <p class="pal-nota">${esc(s.nota || '')}</p>
        <p class="pal-nota"><b>Perché questa settimana.</b> ${esc(s.perche || '')}</p>
        ${s.esercizi.some(e => !e.ultimo) ? `<div class="pal-perche"><b>Prima volta con questi esercizi? Come scegliere il carico</b>
          <ol class="pal-guida">
            <li>Il campo kg parte già da un carico prudente: la parte bassa dell'intervallo indicato sotto ogni esercizio.</li>
            <li>Le serie di avvicinamento sono già scritte in ogni esercizio (A1, A2), con i kg calcolati: non contano, spuntale e basta.</li>
            <li>Prima serie vera: fermati quando ti resterebbero le ripetizioni in canna (RIR) scritte nell'obiettivo.</li>
            <li>Troppo facile (arrivi in cima con più RIR del previsto)? Sali alla serie dopo. Non arrivi al minimo delle ripetizioni? Scendi.</li>
            <li>Segna con ✓ il carico vero: la prossima volta l'app riparte da lì.</li>
          </ol>
          Le prime 2 settimane servono a tendini e tecnica: meglio troppo leggero che troppo pesante. I pesi delle macchine cambiano da marca a marca, l'intervallo è solo un punto di partenza.</div>` : ''}
        <ol class="pal-anteprima">${s.esercizi.map(e => `<li>${esc(e.nome)} <small>${e.serie.length}×${esc(e.repsTesto)}</small></li>`).join('')}</ol>
      </section>
      <div class="pal-nav"><span></span><button type="button" id="pal-avanti" class="pal-primario pal-grande">Inizia gli esercizi →</button></div>`;
  }

  function esercizio(e) {
    const i = s.indice, conKg = e.attrezzo !== 'corpo', unita = e.unita === 's' ? 's' : 'rip';
    const passo = Palestra.prossimoPasso(e), av = e.avvicinamento || [];
    const righeAvv = av.map((a, k) => {
      const kg = Palestra.kgAvvicinamento(e, e.serie[0] && e.serie[0].kg, a.pct);
      return `<div class="pal-avv ${a.fatta ? 'fatta' : ''} ${passo.tipo === 'avvicinamento' && passo.indice === k ? 'prossima' : ''}" data-pal-avv="${k}">
        <span class="pal-n">A${k + 1}</span><span class="pal-avv-testo">${kg != null ? fmtKg(kg) + ' kg' : 'leggero'} × ${a.reps}</span>
        <button type="button" class="pal-check" data-pal-avv-fatta="${k}" aria-label="Avvicinamento ${k + 1} fatto" aria-pressed="${a.fatta}">✓</button></div>`;
    }).join('');
    const ultima = e.ultimo
      ? `Ultima volta (${dataBreve(e.ultimo.data)}): ${e.ultimo.serie.map(x => conKg && x.kg != null ? `${fmtKg(x.kg)} kg × ${x.reps}` : `${x.reps}${e.unita === 's' ? '″' : ''}`).join(' · ')}`
      : 'Prima volta con questo esercizio';
    const righe = e.serie.map((x, j) => `<div class="pal-serie ${x.fatta ? 'fatta' : ''} ${passo.tipo === 'serie' && passo.indice === j ? 'prossima' : ''} ${j >= e.serie.length - (e.facoltative || 0) ? 'facoltativa' : ''}" data-pal-serie="${j}">
        <span class="pal-n">${j + 1}${j >= e.serie.length - (e.facoltative || 0) ? '<small>facolt.</small>' : ''}</span>
        ${conKg ? `<div class="pal-campo"><button type="button" data-pal-meno-kg="${j}" aria-label="Meno peso">−</button><input data-pal-kg="${j}" inputmode="decimal" value="${fmtKg(x.kg)}" placeholder="kg" aria-label="kg serie ${j + 1}"><button type="button" data-pal-piu-kg="${j}" aria-label="Più peso">+</button></div>` : '<div class="pal-campo pal-vuoto">corpo libero</div>'}
        <div class="pal-campo"><button type="button" data-pal-meno-reps="${j}" aria-label="Meno">−</button><input data-pal-reps="${j}" inputmode="numeric" value="${x.reps}" aria-label="${unita} serie ${j + 1}"><button type="button" data-pal-piu-reps="${j}" aria-label="Più">+</button></div>
        ${e.unita === 's' ? `<button type="button" class="pal-crono" data-pal-crono="${j}" aria-label="Avvia ${x.reps} secondi">▶</button>` : ''}
        <button type="button" class="pal-check" data-pal-fatta="${j}" aria-label="Serie ${j + 1} fatta" aria-pressed="${x.fatta}">✓</button>
      </div>`).join('');
    const ultimo = i === s.esercizi.length - 1;
    return `<section class="pal-card pal-es">
        <img class="pal-gif" src="/palestra-gif/${esc(e.gif)}.gif" alt="Come si esegue: ${esc(e.nome)}" width="180" height="180">
        <div class="pal-info">
          <div class="pal-gruppo">${esc(e.gruppo)}</div>
          <h2 class="pal-nome">${esc(e.nome)}</h2>
          <div class="pal-obiettivo">${e.serie.length}×${esc(e.repsTesto)} · RIR ${esc(e.rir)} · rec ${mmss(e.recSec)}</div>
          <div class="pal-ultima">${esc(ultima)}</div>
          <div class="pal-proposta">${esc(e.proposta && e.proposta.nota)}</div>
        </div>
      </section>
      ${e.perche ? `<p class="pal-perche"><b>Perché:</b> ${esc(e.perche)}</p>` : ''}
      <details class="pal-consigli"><summary>Tecnica</summary><ul>${(e.consigli || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>
      <div class="pal-ora ${passo.tipo}" role="status"><b>Ora</b> ${esc(passo.testo)}</div>
      ${av.length ? `<div class="pal-sezione-titolo">Avvicinamento · non conta</div><div class="pal-lista">${righeAvv}</div><div class="pal-sezione-titolo">Serie vere</div>` : ''}
      <div class="pal-intestazione"><span>Serie</span>${conKg ? `<span>${ATTREZZO_KG[e.attrezzo] || 'kg'}</span>` : '<span></span>'}<span>${e.unita === 's' ? 'secondi' : 'ripetizioni'}</span><span></span></div>
      <div class="pal-lista">${righe}</div>
      <div class="pal-nav">
        <button type="button" id="pal-indietro">← ${i === 0 ? 'Riscaldamento' : 'Precedente'}</button>
        <button type="button" id="pal-avanti" class="pal-primario pal-grande">${ultimo ? 'Fine allenamento →' : 'Prossimo →'}</button>
      </div>`;
  }

  function fine() {
    if (salvata) return `<section class="pal-card pal-salvato"><h2>✓ Salvato sull'OptiPlex</h2><p>La prossima volta trovi questi carichi come «ultima volta».</p>
        <div class="pal-strava-box">${stravaHtml()}</div>
        ${mappaHtml()}
        <button type="button" id="pal-chiudi" class="pal-primario pal-grande">Chiudi</button></section>`;
    const r = Palestra.riepilogo(s, new Date().toISOString());
    const mancanti = s.esercizi.filter(e => !e.serie.some(x => x.fatta)).map(e => e.nome);
    return `<section class="pal-card">
        <h2>Fine allenamento</h2>
        <div class="pal-numeri"><div><b>${r.serieFatte}</b><small>${r.serieFatte === 1 ? 'serie' : 'serie'}</small></div><div><b>${r.esercizi}/${s.esercizi.length}</b><small>esercizi</small></div>
          <div><b>${r.kg.toLocaleString('it-IT')}</b><small>kg sollevati</small></div><div><b>${r.durataMin}′</b><small>durata</small></div></div>
        <p class="pal-riga">${r.serieFatte} serie fatte su ${s.esercizi.reduce((t, e) => t + e.serie.length, 0)}.</p>
        ${mancanti.length ? `<p class="pal-nota">Senza serie segnate: ${mancanti.map(esc).join(', ')}.</p>` : ''}
        <label class="pal-label" for="pal-note">Note (sensazioni, dolori, attrezzi occupati…)</label>
        <textarea id="pal-note" rows="3" maxlength="1000">${esc(s.note || '')}</textarea>
        <p id="pal-errore" class="pal-errore" role="alert"></p>
      </section>
      <div class="pal-nav"><button type="button" id="pal-indietro">← Esercizi</button><button type="button" id="pal-salva" class="pal-primario pal-grande">Salva allenamento</button></div>`;
  }

  function stravaHtml() {
    const x = stravaEsito;
    if (!x) return '<p class="pal-nota">Strava: controllo…</p>';
    if (x.url) return `<a class="pal-strava" href="${esc(x.url)}" target="_blank" rel="noopener">✓ Su Strava: apri l'attività</a>`;
    if (x.sovrapposta) return `<p class="pal-nota">${esc(x.error)}: probabilmente l'orologio ha già registrato la palestra. Non la duplico: aggiungi a quella l'immagine qui sotto.</p>`;
    if (x.ok === false) return `<p class="pal-errore">Strava non ha accettato la seduta (${esc(x.error || 'errore')}).</p><button type="button" id="pal-strava-condividi">Riprova su Strava</button>`;
    if (x.collegato === false) return `<p class="pal-nota">Vuoi le sedute nello storico di Strava, come con JEFIT?</p><a class="pal-strava-collega" href="${STRAVA_COLLEGA}" target="_blank" rel="noopener">Collega Strava</a><p class="pal-nota">Serve Tailscale attivo sul telefono. Dopo il collegamento torna qui e premi «Condividi».</p><button type="button" id="pal-strava-condividi">Condividi su Strava</button>`;
    return '<button type="button" id="pal-strava-condividi">Condividi su Strava</button>';
  }

  // 19/10/2026 sera: i muscoli lavorati in un'immagine (mappa-muscoli.js). Strava non accetta foto dalle app private:
  // si scarica (o si condivide, dove il browser lo permette) e la si aggiunge all'attività dall'app Strava.
  function mappaHtml() {
    if (!window.MappaMuscoli) return '';
    return `<div class="pal-mappa"><div class="pal-mappa-img">${MappaMuscoli.svg(s)}</div>
      <button type="button" id="pal-mappa-scarica" class="pal-primario">Scarica immagine per Strava</button>
      <p class="pal-nota">Strava non lascia caricare foto alle app private: su Strava apri l'attività → Modifica → Aggiungi foto e scegli questa.</p></div>`;
  }

  function scaricaMappa() {
    const nome = `mirabiwatt-${s.data}-${String(s.seduta).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 1080;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(async b => {
        const file = new File([b], nome, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: `${s.seduta} · MirabiWatt` }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MappaMuscoli.svg(s));
  }

  async function condividiStrava() {
    stravaEsito = null; disegna();
    try { stravaEsito = await (await fetch('/api/strava/condividi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) })).json(); }
    catch (e) { stravaEsito = { ok: false, error: 'rete' }; }
    disegna();
  }

  // ------- azioni
  function vai(i) {
    s.indice = Math.max(-1, Math.min(s.esercizi.length, i));
    salvaBozza();
    disegna();
  }

  function numero(v) { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null; }

  function clic(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    sbloccaAudio();
    const d = b.dataset, e = s && s.esercizi[s.indice];
    if (b.id === 'pal-chiudi') return chiudi();
    if (b.id === 'pal-esci') return esci();
    if (b.id === 'pal-avanti') return vai(s.indice + 1);
    if (b.id === 'pal-indietro') return vai(s.indice - 1);
    if (b.id === 'pal-salva') return salva();
    if (b.id === 'pal-strava-condividi') return condividiStrava();
    if (b.id === 'pal-mappa-scarica') return scaricaMappa();
    if (b.id === 'pal-timer-salta') return fermaTimer();
    if (b.id === 'pal-timer-piu') { timer.fine += 15000; return aggiornaTimer(); }
    if (b.id === 'pal-timer-meno') { timer.fine = Math.max(Date.now(), timer.fine - 15000); return aggiornaTimer(); }
    if (d.palVai != null) return vai(+d.palVai);
    if (!e) return;
    const passo = Palestra.INCREMENTI[e.attrezzo] || 1;
    if (d.palPiuKg != null || d.palMenoKg != null) {
      const x = e.serie[+(d.palPiuKg ?? d.palMenoKg)];
      x.kg = Math.max(0, Math.round(((x.kg || 0) + (d.palPiuKg != null ? passo : -passo)) * 10) / 10);
    } else if (d.palPiuReps != null || d.palMenoReps != null) {
      const x = e.serie[+(d.palPiuReps ?? d.palMenoReps)], q = e.unita === 's' ? 5 : 1;
      x.reps = Math.max(0, (x.reps || 0) + (d.palPiuReps != null ? q : -q));
    } else if (d.palAvvFatta != null) {
      const a = e.avvicinamento[+d.palAvvFatta];
      a.fatta = !a.fatta;
      if (a.fatta) { a.kg = Palestra.kgAvvicinamento(e, e.serie[0] && e.serie[0].kg, a.pct); avviaTimer(60, 'Avvicinamento fatto: tra poco il prossimo passo'); }
    } else if (d.palCrono != null) {
      return avviaTimer(e.serie[+d.palCrono].reps, 'Tieni la posizione');
    } else if (d.palFatta != null) {
      const j = +d.palFatta, x = e.serie[j];
      x.fatta = !x.fatta;
      if (x.fatta) {
        // il carico della serie fatta passa alle serie dopo ancora vuote
        e.serie.slice(j + 1).forEach(y => { if (!y.fatta && y.kg == null) y.kg = x.kg; });
        const ultimaSerie = s.indice === s.esercizi.length - 1 && j === e.serie.length - 1;
        if (!ultimaSerie) avviaTimer(e.recSec, j === e.serie.length - 1 ? 'Recupero · poi esercizio dopo' : 'Recupero');
      }
    } else return;
    salvaBozza();
    disegna();
  }

  function cambio(ev) {
    const t = ev.target, e = s && s.esercizi[s.indice];
    if (!e) return;
    if (t.dataset.palKg != null) e.serie[+t.dataset.palKg].kg = numero(t.value);
    else if (t.dataset.palReps != null) e.serie[+t.dataset.palReps].reps = Math.round(numero(t.value) || 0);
    else if (t.id === 'pal-note') s.note = t.value;
    else return;
    salvaBozza();
  }

  async function salva() {
    const btn = document.getElementById('pal-salva'), err = document.getElementById('pal-errore');
    s.note = document.getElementById('pal-note').value;
    s.fine = new Date().toISOString();
    btn.disabled = true; btn.textContent = 'Salvo…';
    try {
      const r = await fetch('/api/palestra/sessioni', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `errore ${r.status}`);
      togliBozza();
      salvata = true;
      stravaEsito = j.strava;
      if (!stravaEsito) { try { stravaEsito = await (await fetch('/api/strava/stato')).json(); } catch (e) { stravaEsito = { collegato: false }; } }
      fermaTimer();
      aggiornaRiprendi();
      disegna();
    } catch (e) {
      salvaBozza();
      err.textContent = `Non salvato (${e.message}). L'allenamento resta qui: riprova quando c'è rete.`;
      btn.disabled = false; btn.textContent = 'Riprova a salvare';
    }
  }

  function apri() {
    salvata = false;
    const el = app();
    el.hidden = false;
    document.documentElement.classList.add('pal-aperta');
    aggiornaRiprendi();
    disegna();
    clearInterval(orologio);
    const tempo = () => { const t = document.getElementById('pal-tempo'); if (t && s) t.textContent = mmss(Math.max(0, Math.floor((Date.now() - new Date(s.inizio)) / 1000))); };
    tempo(); orologio = setInterval(tempo, 1000);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wakeLock = w; }).catch(() => {}); } catch (e) { /* schermo libero */ }
  }

  function chiudi() {
    const el = app();
    el.hidden = true;
    document.documentElement.classList.remove('pal-aperta');
    clearInterval(orologio); fermaTimer();
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* già libero */ }
    wakeLock = null;
    if (salvata) s = null;
    aggiornaRiprendi();
  }

  // «Esci» interrompe e cancella l'allenamento (19/10 sera, richiesta dell'utente): si potrà ricominciare da capo.
  // Se ci sono serie già segnate chiede prima. Una ricarica della pagina invece non cancella niente (Riprendi).
  function esci() {
    if (!salvata && s) {
      const fatte = s.esercizi.reduce((t, e) => t + e.serie.filter(x => x.fatta).length, 0);
      if (fatte && !confirm(`Hai già segnato ${fatte} serie. Esci e cancelli questo allenamento?`)) return;
      togliBozza();
      s = null;
    }
    chiudi();
  }

  async function inizia(nomeSeduta) {
    const piano = pianoPalestra(nomeSeduta);
    if (!piano) return;
    const oggi = new Date().toISOString().slice(0, 10), bozza = leggiBozza();
    if (bozza && bozza.seduta === piano.seduta && bozza.data === oggi) { s = bozza; return apri(); }
    if (bozza && !confirm(`C'è un allenamento non salvato (${bozza.seduta}, ${dataBreve(bozza.data)}). Lo scarto e ne inizio uno nuovo?`)) { s = bozza; return apri(); }
    let ultimi = {};
    try { ultimi = (await (await fetch('/api/palestra/storico')).json()).ultimi || {}; } catch (e) { /* senza storico si parte da zero */ }
    s = Palestra.nuovaSessione(piano, ultimi, new Date().toISOString());
    s.nota = piano.nota; s.riscaldamento = piano.riscaldamento; s.scopo = piano.scopo; s.perche = piano.perche;
    salvaBozza();
    apri();
  }

  // pulsante «Riprendi» se c'è un allenamento non salvato
  function aggiornaRiprendi() {
    const bozza = leggiBozza(), aperta = !app().hidden;
    let b = document.getElementById('pal-riprendi');
    if (!b) {
      b = document.createElement('div');
      b.id = 'pal-riprendi'; b.className = 'pal-riprendi';
      b.innerHTML = '<button type="button" class="pal-riprendi-vai"></button><button type="button" id="pal-scarta" aria-label="Cancella l\'allenamento lasciato a metà">✕</button>';
      b.addEventListener('click', ev => {
        if (ev.target.closest('#pal-scarta')) {
          if (!confirm('Cancello l\'allenamento lasciato a metà? Non viene salvato niente.')) return;
          togliBozza(); s = null; return aggiornaRiprendi();
        }
        s = leggiBozza(); if (s) apri();
      });
      document.body.appendChild(b);
    }
    b.hidden = !bozza || aperta;
    if (bozza) b.querySelector('.pal-riprendi-vai').textContent = `▶ Riprendi allenamento · ${bozza.seduta}`;
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-palestra-inizia]');
    if (!b) return;
    const modale = document.getElementById('cal-dettaglio');
    if (modale) modale.hidden = true;
    inizia(b.dataset.palestraInizia);
  });
  window.mwPalestra = { inizia };
  aggiornaRiprendi();
})();

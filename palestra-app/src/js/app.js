/* MirabiWatt Palestra · interfaccia (02/11/2026). Tre sezioni in basso (Settimana, Oggi, Nutrizione) e, durante la
 * seduta, Allenamento, Recupero, Fine.
 * Dati sul telefono (localStorage della WebView): sedute scaricate, bozza della seduta in corso, coda da inviare. */
(function () {
  'use strict';
  const K = { dati: 'mwp_dati', bozza: 'mwp_bozza', coda: 'mwp_coda', sett: 'mwp_sett', peso: 'mwp_peso', tab: 'mwp_tab' };
  const app = document.getElementById('app');
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icona = (nome, etichetta) => `<span class="icona"${etichetta ? ` role="img" aria-label="${esc(etichetta)}"` : ' aria-hidden="true"'}>${(window.ICONE || {})[nome] || ''}</span>`;
  const leggi = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
  const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memoria piena: si continua */ } };
  const pad = n => String(n).padStart(2, '0');
  const isoLocale = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const fmtKg = k => k == null ? '-' : String(Math.round(k * 10) / 10).replace('.', ',');
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const dataBreve = iso => { const d = new Date(iso + 'T12:00:00'); return `${GIORNI[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };

  let stato = { schermata: 'home', tab: leggi(K.tab, 'oggi'), server: null, sync: 'offline', seduta: null, timer: null };

  // ---------- rete ----------
  async function getJSON(url, ms = 3000) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function sincronizza() {
    stato.sync = 'cerco';
    disegnaStato();
    let scaricati = null;
    stato.server = await Sync.scegliServer(async url => { scaricati = await getJSON(`${url}/api/palestra/prossime?giorni=14`); });
    if (stato.server && scaricati) {
      scrivi(K.dati, { ...scaricati, scaricato: Date.now() });
      const r = await Sync.svuota(leggi(K.coda, []), async s => {
        const res = await fetch(`${stato.server}/api/palestra/sessioni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      });
      scrivi(K.coda, r.coda);
      try { scrivi(K.sett, { ...await getJSON(`${stato.server}/api/settimana-piano`, 5000), scaricato: Date.now() }); } catch (e) { /* resta la settimana in memoria */ }
      try { const d = await getJSON(`${stato.server}/api/dashboard`, 8000); if (d.lastWeighIn) scrivi(K.peso, d.lastWeighIn.value); } catch (e) { /* resta il peso in memoria */ }
      stato.sync = 'online';
    } else stato.sync = 'offline';
    if (stato.schermata === 'home') home(); else disegnaStato();
  }

  function testoStato() {
    const coda = leggi(K.coda, []).length, dati = leggi(K.dati, null);
    if (stato.sync === 'cerco') return { cls: '', ico: 'arrow-clockwise', t: 'Cerco MirabiWatt…' };
    if (coda) return { cls: 'attesa', ico: 'cloud-slash', t: `${coda} ${coda === 1 ? 'seduta' : 'sedute'} da inviare` };
    if (stato.sync === 'online') return { cls: '', ico: 'cloud-check', t: 'Sincronizzato' };
    return { cls: '', ico: 'cloud-slash', t: `Offline, ${Sync.freschezza(dati && dati.scaricato)}` };
  }
  function disegnaStato() {
    const el = document.getElementById('stato-sync');
    if (!el) return;
    const s = testoStato();
    el.className = `stato-sync ${s.cls}`;
    el.innerHTML = `${icona(s.ico)}<span>${esc(s.t)}</span>`;
  }

  // ---------- sezioni in basso ----------
  const TABS = [{ id: 'settimana', t: 'Settimana', ico: 'calendar-blank' }, { id: 'oggi', t: 'Oggi', ico: 'barbell' }, { id: 'nutrizione', t: 'Nutrizione', ico: 'fork-knife' }];
  function tabs(visibile) {
    const nav = document.getElementById('tabs');
    nav.hidden = !visibile;
    if (!visibile) return;
    nav.innerHTML = TABS.map(x => `<button type="button" data-tab="${x.id}"${x.id === stato.tab ? ' class="attiva" aria-current="page"' : ''}>${icona(x.ico)}<span>${x.t}</span></button>`).join('');
    nav.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { stato.tab = b.dataset.tab; scrivi(K.tab, stato.tab); home(); window.scrollTo(0, 0); });
  }
  function intestazione(titolo, sotto) {
    return `<header class="barra"><div class="barra-titolo"><h1>${esc(titolo)}</h1>${sotto ? `<small>${esc(sotto)}</small>` : ''}</div>
      <button class="tasto-icona" id="aggiorna" type="button" aria-label="Aggiorna">${icona('arrow-clockwise')}</button></header>
      <div><span id="stato-sync" class="stato-sync" role="status"></span></div>`;
  }
  const oggiISO = () => isoLocale().slice(0, 10);

  function home() {
    stato.schermata = 'home';
    tabs(true);
    ({ settimana, nutrizione, oggi: schedaOggi }[stato.tab] || schedaOggi)();
    disegnaStato();
    const a = document.getElementById('aggiorna');
    if (a) a.onclick = sincronizza;
  }

  // ---------- settimana ----------
  function settimana() {
    const w = leggi(K.sett, null), oggi = oggiISO();
    if (!w) {
      app.innerHTML = `<div class="schermata con-tab">${intestazione('Settimana')}<div class="vuoto">${icona('calendar-blank')}<b>Settimana non scaricata</b>Collegati alla rete di casa o a Tailscale e tocca «Aggiorna».</div></div>`;
      return;
    }
    const fatte = new Set(((leggi(K.dati, {}).sedute) || []).filter(x => x.fatta).map(x => x.data));
    const gara = (w.gare || []).filter(g => g.data >= oggi).sort((a, b) => a.data.localeCompare(b.data))[0];
    const ICO = { palestra: 'barbell', bici: 'bicycle', riposo: 'moon' };
    app.innerHTML = `<div class="schermata con-tab">${intestazione('Settimana', [w.fase, w.settimana].filter(Boolean).join(', '))}
      ${gara ? `<div class="gara">${icona('flag-checkered')}<div><b>${esc(gara.nome)}</b><small>tra ${Giornata.giorniA(gara.data, oggi)} giorni, ${esc(dataBreve(gara.data))}${gara.km ? `, ${gara.km} km` : ''}</small></div></div>` : ''}
      <ul class="giorni-settimana">${(w.giorni || []).map(g => {
        const gen = Giornata.genere(g), st = Giornata.stato(g, oggi), fatta = gen === 'palestra' && fatte.has(g.data);
        const dettaglio = gen === 'riposo' ? 'Recupero' : [g.dur, g.zona].filter(Boolean).join(', ');
        return `<li class="giorno-card ${gen} ${st}"><span class="tessera-ico">${icona(ICO[gen])}</span>
          <div><div class="g-quando">${esc(g.giorno)} ${esc(dataBreve(g.data).split(' ')[1])}</div><b>${esc(g.nome)}</b><div class="g-dett">${esc(dettaglio)}</div></div>
          ${fatta ? `<span class="g-stato fatta">${icona('check')}Fatta</span>` : st === 'oggi' ? '<span class="g-stato oggi">Oggi</span>' : ''}</li>`;
      }).join('')}</ul></div>`;
  }

  // ---------- nutrizione ----------
  function nutrizione() {
    const w = leggi(K.sett, null), oggi = oggiISO(), g = w && (w.giorni || []).find(x => x.data === oggi);
    if (!g) {
      app.innerHTML = `<div class="schermata con-tab">${intestazione('Nutrizione')}<div class="vuoto">${icona('fork-knife')}<b>Piano di oggi non scaricato</b>Collegati alla rete di casa o a Tailscale e tocca «Aggiorna».</div></div>`;
      return;
    }
    const peso = leggi(K.peso, 82.5), n = Giornata.nutrizione(g, peso, 'mantenimento', pianoNutrizione);
    const NOMI = { riposo: 'Giornata di riposo', palestra: 'Giornata di palestra', endurance: 'Giornata di bici', hit: 'Giornata intensa', lungo: 'Uscita lunga' };
    const kc = n.p * 4 + n.c * 4 + n.fat * 9, quota = (x, f) => Math.round(x * f / kc * 100);
    app.innerHTML = `<div class="schermata con-tab">${intestazione('Nutrizione', `${NOMI[n.tipo] || ''}, ${fmtKg(peso)} kg`)}
      <section class="prossima"><div class="quando">Target di oggi</div><h2>${n.kcal} kcal</h2>
        <div class="macro"><span class="p"><b>${n.p} g</b>proteine</span><span class="c"><b>${n.c} g</b>carboidrati</span><span class="f"><b>${n.fat} g</b>grassi</span></div>
        <div class="barra-macro" role="img" aria-label="Proteine ${quota(n.p, 4)}%, carboidrati ${quota(n.c, 4)}%, grassi ${quota(n.fat, 9)}%"><i class="p" style="width:${quota(n.p, 4)}%"></i><i class="c" style="width:${quota(n.c, 4)}%"></i><i class="f" style="width:${quota(n.fat, 9)}%"></i></div>
        ${n.acquaL ? `<p class="scopo">${icona('drop')} Acqua: circa ${String(n.acquaL).replace('.', ',')} litri</p>` : ''}</section>
      <h2 class="sezione-titolo">Pasti suggeriti</h2>
      <ul class="pasti">${n.pasti.map(m => `<li class="pasto"><div class="pasto-testa"><b>${esc(m.nome)}</b><span>${m.kcal} kcal</span></div>
        <div class="pasto-macro">P ${m.p} g, C ${m.c} g, G ${m.fat} g</div>
        <ul class="cibi">${m.cibi.map(c => `<li><span>${esc(c.label)}</span><span>${c.grammi} g</span></li>`).join('')}</ul>${m.nota ? `<p class="scopo">${esc(m.nota)}</p>` : ''}</li>`).join('')}</ul></div>`;
  }

  // ---------- oggi ----------
  function schedaOggi() {
    const dati = leggi(K.dati, { sedute: [] }), bozza = leggi(K.bozza, null);
    const oggi = oggiISO();
    const w = leggi(K.sett, null), gOggi = w && (w.giorni || []).find(x => x.data === oggi), gen = Giornata.genere(gOggi);
    const future = (dati.sedute || []).filter(s => s.data >= oggi && !s.fatta);   // gia' salvate: non si ripropongono
    const prossima = future[0];
    let corpo, fuoriPalestra = '';
    if (!bozza && gOggi && gen !== 'palestra') {
      // oggi non e' un giorno di palestra: bici o riposo, poi la prossima seduta
      fuoriPalestra = gen === 'riposo'
        ? `<section class="prossima"><div class="quando">Oggi</div><h2>Riposo</h2><div class="meta">Recupero: oggi niente pesi.</div></section>`
        : `<section class="prossima"><div class="quando">Oggi, in bici</div><h2>${esc(gOggi.nome)}</h2><div class="meta">${esc([gOggi.dur, gOggi.zona].filter(Boolean).join(', '))}</div>
           <p class="scopo">Si registra con il ciclocomputer o Zwift: qui non serve il tracking.</p></section>`;
    }
    if (bozza) {
      corpo = `<section class="prossima"><div class="quando">Allenamento in corso</div><h2>${esc(bozza.seduta)}</h2>
        <div class="meta">iniziato ${esc(bozza.inizio.slice(11, 16))}</div></section>`;
    } else if (prossima) {
      const p = prossima.piano, quando = prossima.data === oggi ? 'Oggi' : `Prossima palestra: ${dataBreve(prossima.data)}`;
      const minuti = Math.round((10 + p.esercizi.reduce((t, e) => t + e.serie * 2.5, 0)) / 5) * 5;
      corpo = `<section class="prossima"><div class="quando">${esc(quando)}</div><h2>${esc(p.seduta)}</h2>
        <div class="meta">${p.esercizi.length} esercizi, circa ${minuti} min, ${esc(p.schema || '')}</div>
        ${p.scopo ? `<p class="scopo">${esc(p.scopo)}</p>` : ''}</section>`;
    } else {
      corpo = `<div class="vuoto">${icona('barbell')}<b>Nessuna seduta scaricata</b>Collegati alla rete di casa o a Tailscale e tocca «Aggiorna».</div>`;
    }
    const altre = future.slice(bozza ? 0 : 1, 7);
    app.innerHTML = `<div class="schermata con-tab">
      ${intestazione('Allenamento di oggi', gOggi ? `${gOggi.giorno} ${dataBreve(oggi).split(' ')[1]}` : '')}
      ${fuoriPalestra}${corpo}
      ${altre.length ? `<h2 class="sezione-titolo">Prossimi giorni</h2><ul class="elenco-giorni">${altre.map(s =>
        `<li><span class="giorno">${esc(dataBreve(s.data))}</span><span>${esc(s.piano.seduta)}</span></li>`).join('')}</ul>` : ''}
      <div class="spinta"></div>
      <div class="azioni">
        ${bozza ? `<button class="cta" id="riprendi" type="button">${icona('play')}Riprendi allenamento</button>`
          : prossima ? `<button class="cta" id="inizia" type="button">${icona('barbell')}Inizia allenamento</button>` : ''}
      </div></div>`;
    const b = document.getElementById('inizia');
    if (b) b.onclick = () => {
      stato.seduta = Palestra.nuovaSessione(prossima.piano, dati.ultimi || {}, isoLocale());
      scrivi(K.bozza, stato.seduta);
      allenamento();
    };
    const r = document.getElementById('riprendi');
    if (r) r.onclick = () => { stato.seduta = bozza; allenamento(); };
  }

  // ---------- allenamento ----------
  function cronometro() {
    const el = document.getElementById('cronometro');
    if (!el || !stato.seduta) return;
    const s = Math.max(0, Math.round((Date.now() - new Date(stato.seduta.inizio)) / 1000));
    el.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }

  function allenamento() {
    stato.schermata = 'allenamento';
    tabs(false);
    const s = stato.seduta, pos = Seduta.posizione(s);
    if (pos.finita) return fine();
    const e = s.esercizi[pos.iEs], j = e.serie.findIndex(x => !x.fatta), serie = e.serie[j];
    const avv = pos.passo.tipo === 'avvicinamento';
    const testo = esc(pos.passo.testo).replace(/^([^:]+):/, '<b>$1:</b>');
    const unita = e.unita === 's' ? 's' : 'rip';
    const righe = [...(e.avvicinamento || []).map((a, i) => ({ et: 'A', kg: Palestra.kgAvvicinamento(e, e.serie[0].kg, a.pct), reps: a.reps, fatta: a.fatta, ora: !a.fatta && avv && i === pos.passo.indice })),
      ...e.serie.map((x, i) => ({ et: String(i + 1), kg: x.kg, reps: x.reps, fatta: x.fatta, ora: !x.fatta && !avv && i === j }))];
    app.innerHTML = `<div class="schermata">
      <header class="barra">
        <button class="tasto-icona" id="esci" type="button" aria-label="Torna alla home">${icona('x')}</button>
        <div class="barra-titolo"><b>Esercizio ${pos.iEs + 1} di ${s.esercizi.length}</b><small>${esc(s.seduta)}</small></div>
        <span class="cronometro" id="cronometro" aria-label="Tempo trascorso"></span></header>
      <section class="esercizio">
        ${e.gif ? `<img src="gif/${esc(e.gif)}.gif" alt="Come si esegue: ${esc(e.nome)}" width="320" height="200">` : ''}
        <div class="nome"><h2>${esc(e.nome)}</h2><div class="gruppo">${esc(e.gruppo || '')}</div></div></section>
      <ul class="righe-serie" aria-label="Serie">${righe.map(r => `<li class="${r.fatta ? 'fatta' : r.ora ? 'ora' : ''}${r.et === 'A' ? ' avv' : ''}"><span class="et">${r.et === 'A' ? 'W' : r.et}</span>
        <span class="val"><b>${r.kg == null ? '-' : fmtKg(r.kg)}</b> kg</span><span class="val"><b>${r.reps}</b> ${unita}</span>
        <span class="spunta">${r.fatta ? icona('check', 'Fatta') : ''}</span></li>`).join('')}</ul>
      <p class="passo">${testo}</p>
      ${avv ? '' : `<div class="stepper-coppia">
        <div class="stepper"><label id="l-kg">Kg</label><output aria-labelledby="l-kg">${fmtKg(serie.kg)}</output>
          <div class="tasti"><button type="button" data-campo="kg" data-verso="-1" aria-label="Meno kg">${icona('minus')}</button>
          <button type="button" data-campo="kg" data-verso="1" aria-label="Più kg">${icona('plus')}</button></div></div>
        <div class="stepper"><label id="l-reps">${e.unita === 's' ? 'Secondi' : 'Ripetizioni'}</label><output aria-labelledby="l-reps">${serie.reps}</output>
          <div class="tasti"><button type="button" data-campo="reps" data-verso="-1" aria-label="Meno ripetizioni">${icona('minus')}</button>
          <button type="button" data-campo="reps" data-verso="1" aria-label="Più ripetizioni">${icona('plus')}</button></div></div></div>`}
      <div class="spinta"></div>
      <div class="azioni"><button class="cta fatta" id="fatta" type="button">${icona('check')}${avv ? 'Avvicinamento fatto' : 'Serie fatta'}</button></div>
    </div>`;
    cronometro();
    clearInterval(stato.timerCrono);
    stato.timerCrono = setInterval(cronometro, 1000);
    document.getElementById('esci').onclick = () => { clearInterval(stato.timerCrono); home(); };
    app.querySelectorAll('[data-campo]').forEach(b => b.onclick = () => {
      Seduta.aggiusta(s, b.dataset.campo, Number(b.dataset.verso));
      scrivi(K.bozza, s);
      allenamento();
    });
    document.getElementById('fatta').onclick = () => {
      const r = Seduta.segna(s);
      scrivi(K.bozza, s);
      if (Seduta.posizione(s).finita) return fine();
      recupero(r.recSec);
    };
  }

  // ---------- recupero ----------
  function recupero(secondi) {
    stato.schermata = 'recupero';
    const fineMs = { v: Date.now() + secondi * 1000 }, totale = { v: secondi };
    const pos = Seduta.posizione(stato.seduta), e = stato.seduta.esercizi[pos.iEs];
    const div = document.createElement('div');
    div.className = 'recupero';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Recupero');
    div.innerHTML = `<div class="anello"><div><span class="conto" id="conto" aria-live="off"></span></div></div>
      <p class="dopo">Poi: <b>${esc(e.nome)}</b><br>${esc(pos.passo.testo.split(':')[0])}</p>
      <div class="tasti"><button class="cta-secondaria" id="piu15" type="button">${icona('plus')}15 s</button>
      <button class="cta-secondaria" id="salta" type="button">${icona('skip-forward')}Salta</button></div>`;
    app.appendChild(div);
    const chiudi = () => { clearInterval(stato.timer); div.remove(); allenamento(); };
    const tick = () => {
      const resta = Math.max(0, Math.ceil((fineMs.v - Date.now()) / 1000));
      document.getElementById('conto').textContent = `${Math.floor(resta / 60)}:${pad(resta % 60)}`;
      div.querySelector('.anello').style.setProperty('--p', String(resta / Math.max(1, totale.v)));
      if (resta <= 0) { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); chiudi(); }
    };
    document.getElementById('piu15').onclick = () => { fineMs.v += 15000; totale.v += 15; tick(); };
    document.getElementById('salta').onclick = chiudi;
    clearInterval(stato.timer);
    stato.timer = setInterval(tick, 250);
    tick();
  }

  // ---------- fine ----------
  function fine() {
    stato.schermata = 'fine';
    tabs(false);
    clearInterval(stato.timerCrono);
    const s = stato.seduta, r = Palestra.riepilogo(s, isoLocale());
    app.innerHTML = `<div class="schermata">
      <header class="barra"><h1>Seduta finita</h1></header>
      <p class="meta">${esc(s.seduta)}, ${esc(dataBreve(s.data))}</p>
      <div class="tessere">
        <div class="tessera"><b>${r.serieFatte}</b><span>serie</span></div>
        <div class="tessera"><b>${r.kg >= 1000 ? fmtKg(r.kg / 1000) + 't' : r.kg}</b><span>${r.kg >= 1000 ? 'sollevate' : 'kg sollevati'}</span></div>
        <div class="tessera"><b>${r.durataMin}</b><span>minuti</span></div></div>
      <div class="campo"><label for="note">Note (facoltative)</label><textarea id="note" maxlength="1000">${esc(s.note || '')}</textarea></div>
      <p class="esito" id="esito" role="status"></p>
      <div class="spinta"></div>
      <div class="azioni"><button class="cta" id="salva" type="button">${icona('check')}Salva seduta</button>
        <button class="cta-secondaria" id="riprendi" type="button">${icona('arrow-left')}Torna agli esercizi</button></div></div>`;
    document.getElementById('riprendi').onclick = () => { const p = Seduta.posizione(s); if (!p.finita) allenamento(); else home(); };
    document.getElementById('salva').onclick = async () => {
      s.note = document.getElementById('note').value;
      s.fine = isoLocale();
      scrivi(K.coda, Sync.accoda(leggi(K.coda, []), s));
      localStorage.removeItem(K.bozza);
      stato.seduta = null;
      home();            // la home mostra «1 seduta da inviare» finche' il server non la accetta
      await sincronizza();
    };
  }

  // ---------- avvio ----------
  const cap = window.Capacitor && window.Capacitor.Plugins;
  if (cap && cap.App) cap.App.addListener('backButton', () => {
    if (stato.schermata === 'recupero') { clearInterval(stato.timer); allenamento(); }
    else if (stato.schermata === 'home') cap.App.exitApp();
    else { clearInterval(stato.timerCrono); home(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stato.schermata === 'home') sincronizza(); });

  window.MWP = { stato, home, sincronizza, K };
  home();
  sincronizza();
})();

/* MirabiWatt Palestra · interfaccia (02/11/2026). Tre sezioni in basso (Settimana, Oggi, Nutrizione) e, durante la
 * seduta, Allenamento, Recupero, Fine.
 * Dati sul telefono (localStorage della WebView): sedute scaricate, bozza della seduta in corso, coda da inviare. */
(function () {
  'use strict';
  const K = { dati: 'mwp_dati', bozza: 'mwp_bozza', coda: 'mwp_coda', sett: 'mwp_sett', peso: 'mwp_peso', tab: 'mwp_tab' };
  const app = document.getElementById('app');
  const cap0 = window.Capacitor && window.Capacitor.Plugins;
  const Notif = Notifiche.crea(cap0 && cap0.LocalNotifications);
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
  const TABS = [{ id: 'calendario', t: 'Calendario', ico: 'calendar-blank' }, { id: 'oggi', t: 'Oggi', ico: 'barbell' }, { id: 'nutrizione', t: 'Nutrizione', ico: 'fork-knife' }];
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
    ({ calendario, nutrizione, oggi: schedaOggi }[stato.tab] || schedaOggi)();
    disegnaStato();
    const a = document.getElementById('aggiorna');
    if (a) a.onclick = sincronizza;
  }

  // ---------- calendario ----------
  const ZONE = { Z1: 'Recupero attivo: pedalata molto facile.', Z2: 'Endurance: ritmo da conversazione, base aerobica.', Z3: 'Tempo: ritmo sostenuto ma controllato.',
    HIT: 'Intervalli intensi: poche ripetute dure con recuperi veri.', TEST: 'Test: sforzo massimale per aggiornare le zone.', GARA: 'Gara: si va a tutta.', REC: 'Recupero.' };
  const ICO_GEN = { palestra: 'barbell', bici: 'bicycle', riposo: 'moon' };
  const NOME_GEN = { palestra: 'Palestra', bici: 'Bici', riposo: 'Riposo' };

  function foglio(titolo, corpo, classe) {
    const div = document.createElement('div');
    div.className = 'velo';
    div.innerHTML = `<div class="foglio ${classe || ''}" role="dialog" aria-modal="true" aria-label="${esc(titolo)}">${corpo}
      <button class="cta-secondaria" id="chiudi-foglio" type="button">Chiudi</button></div>`;
    document.body.appendChild(div);
    const chiudi = () => div.remove();
    div.onclick = e => { if (e.target === div) chiudi(); };
    div.querySelector('#chiudi-foglio').onclick = chiudi;
    div.querySelector('#chiudi-foglio').focus();
    return chiudi;
  }

  function dettaglioGiorno(g) {
    const gen = Giornata.genere(g), sed = ((leggi(K.dati, {}).sedute) || []).find(x => x.data === g.data);
    const testa = `<div class="foglio-testa ${gen}"><span class="tessera-ico">${icona(ICO_GEN[gen])}</span><div><div class="g-quando">${esc(NOME_GEN[gen])}, ${esc(g.giorno)} ${esc(dataBreve(g.data).split(' ')[1])}</div><h2>${esc(g.nome)}</h2></div></div>`;
    let corpo = '';
    if (gen === 'palestra' && sed) {
      const p = sed.piano;
      corpo = `<p class="meta">${esc([g.dur, p.schema].filter(Boolean).join(', '))}${sed.fatta ? ', fatta' : ''}</p>${p.scopo ? `<p class="scopo">${esc(p.scopo)}</p>` : ''}
        <ul class="cibi">${p.esercizi.map(e => `<li><span>${esc(e.nome)}</span><span>${e.serie} × ${esc(e.repsTesto || '')}</span></li>`).join('')}</ul>`;
    } else if (gen === 'palestra') corpo = `<p class="meta">${esc(g.dur || '')}</p><p class="scopo">Il dettaglio degli esercizi si scarica con «Aggiorna» quando sei in rete.</p>`;
    else if (gen === 'bici') corpo = `<p class="meta">${esc([g.dur, g.zona].filter(Boolean).join(', '))}</p><p class="scopo">${esc(ZONE[String(g.zona || '').toUpperCase()] || 'Allenamento in bici.')} Si registra con il ciclocomputer o Zwift.</p>`;
    else corpo = `<p class="scopo">Giorno di recupero: oggi niente allenamento, mangia e dormi bene.</p>`;
    foglio(g.nome, testa + corpo);
  }

  function dettaglioGara(g, oggi) {
    const gg = Giornata.giorniA(g.data, oggi);
    foglio(g.nome, `<div class="foglio-testa gara"><span class="tessera-ico">${icona('flag-checkered')}</span><div><div class="g-quando">Obiettivo${g.priorita ? `, priorità ${esc(g.priorita)}` : ''}</div><h2>${esc(g.nome)}</h2></div></div>
      <p class="meta">${esc(dataBreve(g.data))}, tra ${gg} giorni</p>
      <ul class="cibi">${g.km ? `<li><span>Distanza</span><span>${g.km} km</span></li>` : ''}${g.dislivello ? `<li><span>Dislivello</span><span>${g.dislivello} m</span></li>` : ''}</ul>`);
  }

  function calendario() {
    const w = leggi(K.sett, null), oggi = oggiISO();
    if (!w) {
      app.innerHTML = `<div class="schermata con-tab">${intestazione('Calendario')}<div class="vuoto">${icona('calendar-blank')}<b>Calendario non scaricato</b>Collegati alla rete di casa o a Tailscale e tocca «Aggiorna».</div></div>`;
      return;
    }
    const fatte = new Set(((leggi(K.dati, {}).sedute) || []).filter(x => x.fatta).map(x => x.data));
    const gare = (w.gare || []).filter(g => g.data >= oggi).sort((a, b) => a.data.localeCompare(b.data));
    app.innerHTML = `<div class="schermata con-tab">${intestazione('Calendario', [w.fase, w.settimana].filter(Boolean).join(', '))}
      <h2 class="sezione-titolo">Obiettivi</h2>
      ${gare.length ? `<ul class="giorni-settimana">${gare.map((g, i) => `<li><button type="button" class="giorno-card gara" data-gara="${i}"><span class="tessera-ico">${icona('flag-checkered')}</span>
        <div><div class="g-quando">${esc(dataBreve(g.data))}${g.priorita ? `, priorità ${esc(g.priorita)}` : ''}</div><b>${esc(g.nome)}</b><div class="g-dett">${[g.km && g.km + ' km', g.dislivello && g.dislivello + ' m'].filter(Boolean).join(', ')}</div></div>
        <span class="g-stato gara">${Giornata.giorniA(g.data, oggi)} gg</span></button></li>`).join('')}</ul>` : '<p class="meta">Nessun obiettivo in programma.</p>'}
      <h2 class="sezione-titolo">Allenamenti della settimana</h2>
      <div class="legenda"><span class="bici">${icona('bicycle')}Bici</span><span class="palestra">${icona('barbell')}Palestra</span><span class="riposo">${icona('moon')}Riposo</span></div>
      <ul class="giorni-settimana">${(w.giorni || []).map((g, i) => {
        const gen = Giornata.genere(g), st = Giornata.stato(g, oggi), fatta = gen === 'palestra' && fatte.has(g.data);
        const dettaglio = gen === 'riposo' ? 'Recupero' : [g.dur, g.zona].filter(Boolean).join(', ');
        return `<li><button type="button" class="giorno-card ${gen} ${st}" data-giorno="${i}"><span class="tessera-ico">${icona(ICO_GEN[gen])}</span>
          <div><div class="g-quando">${esc(g.giorno)} ${esc(dataBreve(g.data).split(' ')[1])}</div><b>${esc(g.nome)}</b><div class="g-dett">${esc(dettaglio)}</div></div>
          ${fatta ? `<span class="g-stato fatta">${icona('check')}Fatta</span>` : st === 'oggi' ? '<span class="g-stato oggi">Oggi</span>' : ''}</button></li>`;
      }).join('')}</ul></div>`;
    app.querySelectorAll('[data-giorno]').forEach(b => b.onclick = () => dettaglioGiorno(w.giorni[Number(b.dataset.giorno)]));
    app.querySelectorAll('[data-gara]').forEach(b => b.onclick = () => dettaglioGara(gare[Number(b.dataset.gara)], oggi));
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
    const dati = leggi(K.dati, { sedute: [] }), bozza = leggi(K.bozza, null), oggi = oggiISO();
    const w = leggi(K.sett, null), gOggi = w && (w.giorni || []).find(x => x.data === oggi);
    const seduta = (dati.sedute || []).find(x => x.data === oggi);
    let corpo, inizia = null;
    if (bozza) {
      corpo = `<section class="prossima"><div class="quando">Allenamento in corso</div><h2>${esc(bozza.seduta)}</h2>
        <div class="meta">iniziato ${esc(bozza.inizio.slice(11, 16))}</div></section>`;
    } else if (seduta && seduta.fatta) {
      corpo = `<section class="prossima fatta"><div class="quando">Oggi</div><h2>${esc(seduta.piano.seduta)}</h2><div class="meta">${icona('check')} Seduta già salvata. Ottimo lavoro.</div></section>`;
    } else if (seduta) {
      const p = seduta.piano, minuti = Math.round((10 + p.esercizi.reduce((t, e) => t + e.serie * 2.5, 0)) / 5) * 5;
      inizia = seduta;
      corpo = `<section class="prossima"><div class="quando">Oggi</div><h2>${esc(p.seduta)}</h2>
        <div class="meta">${p.esercizi.length} esercizi, circa ${minuti} min, ${esc(p.schema || '')}</div>
        ${p.scopo ? `<p class="scopo">${esc(p.scopo)}</p>` : ''}</section>
        <ul class="cibi elenco-esercizi">${p.esercizi.map(e => `<li><span>${esc(e.nome)}</span><span>${e.serie} × ${esc(e.repsTesto || '')}</span></li>`).join('')}</ul>`;
    } else if (gOggi && Giornata.genere(gOggi) === 'bici') {
      corpo = `<section class="prossima bici"><div class="quando">Oggi, in bici</div><h2>${esc(gOggi.nome)}</h2><div class="meta">${esc([gOggi.dur, gOggi.zona].filter(Boolean).join(', '))}</div>
        <p class="scopo">${esc(ZONE[String(gOggi.zona || '').toUpperCase()] || '')} Si registra con il ciclocomputer o Zwift: qui non serve il tracking.</p></section>`;
    } else if (gOggi) {
      corpo = `<section class="prossima"><div class="quando">Oggi</div><h2>Riposo</h2><div class="meta">Recupero: oggi niente allenamento.</div></section>`;
    } else if (!(dati.sedute || []).length) {
      corpo = `<div class="vuoto">${icona('barbell')}<b>Nessuna seduta scaricata</b>Collegati alla rete di casa o a Tailscale e tocca «Aggiorna».</div>`;
    } else {
      corpo = `<section class="prossima"><div class="quando">Oggi</div><h2>Nessun allenamento</h2><div class="meta">Niente in programma per oggi.</div></section>`;
    }
    app.innerHTML = `<div class="schermata con-tab">
      ${intestazione('Allenamento di oggi', gOggi ? `${gOggi.giorno} ${dataBreve(oggi).split(' ')[1]}` : dataBreve(oggi))}
      ${corpo}
      <div class="spinta"></div>
      <div class="azioni">
        ${bozza ? `<button class="cta" id="riprendi" type="button">${icona('play')}Riprendi allenamento</button>`
          : inizia ? `<button class="cta" id="inizia" type="button">${icona('barbell')}Inizia allenamento</button>` : ''}
      </div></div>`;
    const b = document.getElementById('inizia');
    if (b) b.onclick = () => {
      Notif.prepara();     // il permesso per l'avviso di fine recupero si chiede ora, non nel mezzo della seduta
      stato.seduta = Palestra.nuovaSessione(inizia.piano, dati.ultimi || {}, isoLocale());
      scrivi(K.bozza, stato.seduta);
      allenamento();
    };
    const r = document.getElementById('riprendi');
    if (r) r.onclick = () => { Notif.prepara(); stato.seduta = bozza; allenamento(); };
  }

  // ---------- allenamento ----------
  function cronometro() {
    const el = document.getElementById('cronometro');
    if (!el || !stato.seduta) return;
    const s = Math.max(0, Math.round((Date.now() - new Date(stato.seduta.inizio)) / 1000));
    el.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }

  /** «Cancella o riprendi più tardi?»: si esce dalla seduta solo scegliendo. */
  function chiediUscita() {
    if (document.querySelector('.dialogo')) return;
    const div = document.createElement('div');
    div.className = 'velo';
    div.innerHTML = `<div class="foglio dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">Esci dall'allenamento?</h2>
      <p class="scopo">Cancelli la seduta e perdi quello che hai registrato, oppure la riprendi più tardi da dove sei arrivato.</p>
      <button class="cta" id="dlg-dopo" type="button">${icona('play')}Riprendi più tardi</button>
      <button class="cta-secondaria pericolo" id="dlg-cancella" type="button">${icona('x')}Cancella allenamento</button>
      <button class="cta-secondaria" id="dlg-resta" type="button">${icona('arrow-left')}Torna all'allenamento</button></div>`;
    document.body.appendChild(div);
    const chiudi = () => div.remove();
    const esci = () => { clearInterval(stato.timerCrono); clearInterval(stato.timer); Notif.annulla(); const r = document.querySelector('.recupero'); if (r) r.remove(); chiudi(); home(); };
    div.querySelector('#dlg-resta').onclick = chiudi;
    div.querySelector('#dlg-dopo').onclick = esci;                       // la bozza resta: la home propone «Riprendi»
    div.querySelector('#dlg-cancella').onclick = () => { localStorage.removeItem(K.bozza); stato.seduta = null; esci(); };
    div.querySelector('#dlg-dopo').focus();
  }

  function allenamento() {
    stato.schermata = 'allenamento';
    tabs(false);
    const s = stato.seduta, pos = Seduta.posizione(s);
    if (pos.finita) return fine();
    const e = s.esercizi[pos.iEs], righe = Seduta.righe(e), ora = righe.findIndex(r => !r.fatta);
    const unita = e.unita === 's' ? 's' : 'rip';
    app.innerHTML = `<div class="schermata">
      <header class="barra">
        <button class="tasto-icona" id="esci" type="button" aria-label="Esci dall'allenamento">${icona('x')}</button>
        <div class="barra-titolo"><b>Esercizio ${pos.iEs + 1} di ${s.esercizi.length}</b><small>${esc(s.seduta)}</small></div>
        <span class="cronometro" id="cronometro" aria-label="Tempo trascorso"></span></header>
      <section class="esercizio">
        ${e.gif ? `<img src="gif/${esc(e.gif)}.gif" alt="Come si esegue: ${esc(e.nome)}" width="320" height="200">` : ''}
        <div class="nome"><h2>${esc(e.nome)}</h2><div class="gruppo">${esc(e.gruppo || '')}</div></div></section>
      <ul class="righe-serie" aria-label="Serie">${righe.map((r, i) => `<li class="${r.fatta ? 'fatta' : i === ora ? 'ora' : ''}${r.tipo === 'avv' ? ' avv' : ''}">
        <span class="et">${r.tipo === 'avv' ? 'W' : r.idx + 1}</span>
        <label class="val"><input type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" data-t="${r.tipo}" data-i="${r.idx}" data-c="kg" value="${r.kg == null ? '' : esc(fmtKg(r.kg))}" aria-label="Chili, riga ${i + 1}"${r.kg == null ? ' placeholder="-"' : ''}><span>kg</span></label>
        <label class="val"><input type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" data-t="${r.tipo}" data-i="${r.idx}" data-c="reps" value="${r.reps}" aria-label="${unita === 's' ? 'Secondi' : 'Ripetizioni'}, riga ${i + 1}"><span>${unita}</span></label>
        <button type="button" class="spunta" data-conf="${i}" aria-label="${r.fatta ? 'Annulla la riga ' : 'Conferma la riga '}${i + 1}">${icona('check')}</button></li>`).join('')}</ul>
      <p class="passo">${esc(pos.passo.testo).replace(/^([^:]+):/, '<b>$1:</b>')}</p>
    </div>`;
    cronometro();
    clearInterval(stato.timerCrono);
    stato.timerCrono = setInterval(cronometro, 1000);
    document.getElementById('esci').onclick = chiediUscita;
    // ogni campo cambia solo la sua riga e si salva subito
    app.querySelectorAll('.righe-serie input').forEach(inp => {
      inp.onfocus = () => inp.select();
      inp.oninput = () => { Seduta.imposta(s, pos.iEs, inp.dataset.t, Number(inp.dataset.i), inp.dataset.c, inp.value); scrivi(K.bozza, s); };
      inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); };
    });
    app.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => {
      const r = righe[Number(b.dataset.conf)];
      const res = Seduta.conferma(s, pos.iEs, r.tipo, r.idx);
      scrivi(K.bozza, s);
      if (Seduta.posizione(s).finita) return fine();
      if (res.recSec > 0) recupero(res.recSec); else allenamento();
    });
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
    // con l'app in background il timer della pagina non basta: Android suona la notifica all'ora di fine
    const avviso = () => Notif.programma(fineMs.v, 'Recupero finito', `Tocca a te: ${e.nome}`);
    avviso();
    const chiudi = () => { clearInterval(stato.timer); stato.tickRecupero = null; Notif.annulla(); div.remove(); allenamento(); };
    const tick = () => {
      const resta = Math.max(0, Math.ceil((fineMs.v - Date.now()) / 1000));
      document.getElementById('conto').textContent = `${Math.floor(resta / 60)}:${pad(resta % 60)}`;
      div.querySelector('.anello').style.setProperty('--p', String(resta / Math.max(1, totale.v)));
      if (resta <= 0) { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); chiudi(); }
    };
    document.getElementById('piu15').onclick = () => { fineMs.v += 15000; totale.v += 15; avviso(); tick(); };
    document.getElementById('salta').onclick = chiudi;
    clearInterval(stato.timer);
    stato.timer = setInterval(tick, 250);
    stato.tickRecupero = tick;      // al ritorno nell'app si riallinea subito
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
    if (stato.schermata === 'recupero') { clearInterval(stato.timer); Notif.annulla(); const r = document.querySelector('.recupero'); if (r) r.remove(); allenamento(); }
    else if (stato.schermata === 'home') cap.App.exitApp();
    else if (stato.schermata === 'allenamento') chiediUscita();
    else { clearInterval(stato.timerCrono); home(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (stato.schermata === 'home') sincronizza();
    else if (stato.schermata === 'recupero' && stato.tickRecupero) stato.tickRecupero();
  });

  window.MWP = { stato, home, sincronizza, K };
  home();
  sincronizza();
})();

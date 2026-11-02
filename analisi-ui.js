/* MirabiWatt · Analisi FTP, Fitness, nome dell'atleta, obiettivi (14/10/2026), sul modello di intervals.icu.
 * Dati: /api/power-curves (curve 42 giorni, 84 giorni, stagione, da sempre con CP/W' del modello ECP e eFTP), /api/fitness
 * (Fitness, Fatica, carico del giorno), /api/preferenze (il nome da mostrare), /api/obiettivi. Logica in analisi.js. */
(function () {
  'use strict';
  const COLORI = { '42d': '#a78bfa', '84d': '#ec4899', s0: '#f59e0b', all: '#34d399' };
  const NOMI = { '42d': '42 giorni', '84d': '84 giorni', s0: 'Questa stagione', all: 'Da sempre' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const oggi = () => fmtISO(new Date());
  const dataBreve = iso => parseISO(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  const durata = s => (s < 60 ? `${s}s` : s < 3600 ? (s % 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s / 60}m`)
    : `${Math.floor(s / 3600)}h${s % 3600 ? String(Math.round((s % 3600) / 60)).padStart(2, '0') + 'm' : ''}`);
  const passoTondo = (span, n = 6) => { const g = span / n, p = Math.pow(10, Math.floor(Math.log10(g || 1))); return [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= g) || p * 10; };

  /* ----- il nome: quello scelto da te vince su quello di intervals.icu («Magician») ----- */
  window.mwApplicaNome = function () {
    const n = window.mwNomeScelto || window.mwNomeIntervals || 'Atleta';
    for (const id of ['mw-atleta-nome', 'athlete-name']) { const el = document.getElementById(id); if (el) el.textContent = n; }
  };
  async function salvaNome(nome) {
    window.mwNomeScelto = nome;
    window.mwApplicaNome();
    try { await fetch('/api/preferenze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) }); } catch (e) { /* resta il nome sullo schermo */ }
  }
  function modificaNome() {
    const span = document.getElementById('mw-atleta-nome');
    if (!span || document.getElementById('mw-nome-input')) return;
    const campo = document.createElement('input');
    campo.id = 'mw-nome-input'; campo.className = 'mw-nome-input'; campo.maxLength = 40; campo.value = span.textContent;
    campo.setAttribute('aria-label', 'Il tuo nome');
    span.hidden = true; span.after(campo); campo.focus(); campo.select && campo.select();
    let fatto = false;
    const chiudi = salva => {
      if (fatto) return; fatto = true;
      const v = campo.value.trim();
      campo.remove(); span.hidden = false;
      if (salva) salvaNome(v === (window.mwNomeIntervals || '') ? '' : v);
    };
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); chiudi(true); } else if (e.key === 'Escape') chiudi(false); });
    campo.addEventListener('blur', () => chiudi(true));
  }

  /* ----- Analisi FTP ----- */
  let curve = null, unita = 'w';
  async function caricaFTP() {
    const root = document.getElementById('ftp-analisi');
    if (!root) return;
    if (!curve) {
      root.innerHTML = '<p class="mw-aiuto">Leggo le curve di potenza da intervals.icu…</p>';
      try { const r = await fetch('/api/power-curves'); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status); curve = j; }
      catch (e) { root.innerHTML = `<p class="mw-aiuto">intervals.icu non risponde (${esc(e.message)}).</p>`; return; }
    }
    disegnaFTP();
  }
  function disegnaFTP() {
    const root = document.getElementById('ftp-analisi');
    root.innerHTML = `<div class="mw-ftp-griglia">
      ${valoriEZone()}
      <section class="mw-card"><div class="mw-card-testa"><h3>Power Curve</h3>
        <div class="mw-seg" role="group" aria-label="Unità">${[['w', 'Watt'], ['wkg', 'W/kg']].map(([k, t]) => `<button type="button" data-unita="${k}" class="${unita === k ? 'scelto' : ''}" aria-pressed="${unita === k}">${t}</button>`).join('')}</div></div>
        <div id="ftp-curva" class="mw-grafico">${graficoCurva()}</div>
        <div id="pc-tip" class="mw-tip" hidden></div>
        <table class="mw-tab" id="ftp-legenda"><tbody>${curve.curve.map(c => `<tr><td><i class="pallino" style="background:${COLORI[c.id]}"></i><b style="color:${COLORI[c.id]}">${NOMI[c.id] || esc(c.label)}</b></td>
          <td>${c.id === 'all' ? 'da sempre' : esc(dataBreve(c.start))} – ${esc(dataBreve(c.end))}</td><td><b style="color:${COLORI[c.id]}">CP ${c.cp} W</b></td><td>W' ${c.wPrime} J</td></tr>`).join('')}</tbody></table>
        <p class="mw-aiuto">CP e W' dal modello ECP di intervals.icu (curva di potenza e modello di Morton a 3 parametri); eFTP dal modello FFT.</p>
      </section>
      <section class="mw-card"><div class="mw-card-testa"><h3>Best Efforts</h3></div>${tabellaBest()}</section>
      <section class="mw-card mw-intera"><div class="mw-card-testa"><h3>Power Profile</h3><span class="mw-aiuto">peso ${curve.peso} kg</span></div>${profilo()}</section>
    </div>`;
    lucide.createIcons();
  }
  /** Valori attuali (intervals.icu) e zone di potenza in watt: la stessa FTP usata da Oggi, Calendario e Tools. */
  function valoriEZone() {
    const a = window.mwAtleta;
    if (!a || !a.ftp) return '<section class="mw-card mw-intera" id="ftp-valori"><p class="mw-aiuto">Leggo FTP, CP e W\' da intervals.icu…</p></section>';
    const c42 = curve && curve.curve.find(c => c.id === '42d'), eftp = c42 && c42.eftp, cf = eftp ? Strumenti.confrontoFtp(a.ftp, eftp) : null;
    const frase = !cf ? '' : cf.stato === 'sotto' ? `eFTP ${Math.abs(cf.diff).toFixed(0)}% sotto la FTP impostata: forma calata o pochi sforzi massimali nelle ultime 6 settimane. Le zone potrebbero essere un po' alte.`
      : cf.stato === 'sopra' ? `eFTP ${cf.diff.toFixed(0)}% sopra la FTP impostata: le zone sono basse, è il momento di un test.` : 'eFTP in linea con la FTP impostata.';
    const zone = Strumenti.zone(a.ftp, a.zone, a.nomiZone);
    return `<section class="mw-card mw-intera mw-valori-zone"><div class="mw-card-testa"><h3>Valori attuali e zone di potenza</h3>
        <button type="button" class="mw-tb" onclick="toggleFtpForm()"><i data-lucide="plus" class="w-4 h-4"></i> Registra un test FTP</button></div>
      <div class="mw-vz">
        <div id="ftp-valori" class="mw-kpi-griglia">
          <div class="mw-kpi"><span>FTP impostata</span><b>FTP ${a.ftp} W</b><small>${(a.ftp / a.peso).toFixed(2)} W/kg${a.ftpAggiornata ? ` · dal ${esc(dataBreve(a.ftpAggiornata.slice(0, 10)))}` : ''}</small></div>
          <div class="mw-kpi"><span>Critical Power</span><b>CP ${a.cp} W</b><small>${(a.cp / a.peso).toFixed(2)} W/kg</small></div>
          <div class="mw-kpi"><span>Capacità anaerobica</span><b>W' ${a.wPrime} J</b><small>${(a.wPrime / 1000).toFixed(1)} kJ sopra il CP</small></div>
          <div class="mw-kpi"><span>Stimata dalla curva (42 giorni)</span><b>eFTP ${eftp || '–'} W</b><small>${eftp ? (eftp / a.peso).toFixed(2) + ' W/kg' : ''}</small></div>
          ${frase ? `<p class="mw-aiuto mw-kpi-nota stato-${cf.stato}">${frase}</p>` : ''}
        </div>
        <table class="mw-tab" id="ftp-zone"><thead><tr><th>Zona</th><th></th><th>% FTP</th><th>Watt</th></tr></thead><tbody>
          ${zone.map((z, i) => `<tr class="zona-${i + 1}"><td><i class="mw-zona-col"></i><b>${z.n}</b></td><td>${esc(z.nome)}</td><td>${z.aPerc == null ? `oltre ${z.daPerc}%` : `${z.daPerc}–${z.aPerc}%`}</td>
            <td><b>${z.a == null ? `${z.da}+ W` : `${z.da}–${z.a} W`}</b></td></tr>`).join('')}</tbody></table>
      </div>
      <p class="mw-aiuto">FTP, CP e W' sono quelli di intervals.icu: un test registrato nella scheda FTP qui sopra li aggiorna là e qui, e con loro le zone, gli allenamenti di Oggi e i Tools.</p>
    </section>`;
  }
  document.addEventListener('mw-atleta', () => { if (curve && document.getElementById('view-athlete').classList.contains('active')) disegnaFTP(); });

  function graficoCurva() {
    const W = 760, H = 380, L = 56, R = 14, T = 14, B = 34, cs = curve.curve;
    const maxS = Math.max(...cs.map(c => c.secs[c.secs.length - 1] || 1));
    const X = s => L + Math.log10(s) / Math.log10(maxS) * (W - L - R);
    const val = c => (unita === 'w' ? c.watts : c.wkg);
    const maxV = Math.max(...cs.flatMap(val)), passo = passoTondo(maxV), top = Math.ceil(maxV / passo) * passo;
    const Y = v => T + (1 - v / top) * (H - T - B);
    const griglia = [];
    for (let v = 0; v <= top + 1e-9; v += passo) griglia.push(`<line class="griglia" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="et-y" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}">${Math.round(v * 10) / 10}</text>`);
    const TACCHE = [[1, '1s'], [5, '5s'], [15, '15s'], [60, '1m'], [120, '2m'], [300, '5m'], [600, '10m'], [1200, '20m'], [1800, '30m'], [3600, '1h'], [7200, '2h'], [10800, '3h'], [18000, '5h'], [28800, '8h']].filter(([s]) => s <= maxS);
    const asse = TACCHE.map(([s, t]) => `<line class="griglia-v" x1="${X(s).toFixed(1)}" x2="${X(s).toFixed(1)}" y1="${T}" y2="${H - B}"/><text class="et-x" x="${X(s).toFixed(1)}" y="${H - 12}">${t}</text>`).join('');
    const cp = cs.filter(c => c.id === '42d' || c.id === 's0').map(c => { const v = unita === 'w' ? c.cp : c.cp / curve.peso; return `<line class="pc-cp" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" style="stroke:${COLORI[c.id]}"><title>CP ${NOMI[c.id]}</title></line>`; }).join('');
    const linee = cs.slice().reverse().map(c => `<path class="pc-linea" data-curva="${c.id}" style="stroke:${COLORI[c.id]}" d="${c.secs.map((s, i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)},${Y(val(c)[i]).toFixed(1)}`).join('')}"/>`).join('');
    return `<svg class="mw-svg" id="pc-svg" viewBox="0 0 ${W} ${H}" data-l="${L}" data-r="${R}" data-w="${W}" data-max="${maxS}" role="img" aria-label="Curva di potenza">
      ${griglia.join('')}${asse}<text class="et-unita" x="12" y="${T + 4}">${unita === 'w' ? 'W' : 'W/kg'}</text>${cp}${linee}<line class="pc-cursore" id="pc-cursore" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
      <rect class="pc-presa" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></svg>`;
  }
  function suCurva(e) {
    const svg = e.target.closest('#pc-svg');
    if (!svg || !curve) return;
    const r = svg.getBoundingClientRect(), W = Number(svg.dataset.w), L = Number(svg.dataset.l), R = Number(svg.dataset.r), maxS = Number(svg.dataset.max);
    if (!r.width) return;
    const x = (e.clientX - r.left) / r.width * W, s = Math.pow(10, Math.max(0, Math.min(1, (x - L) / (W - L - R))) * Math.log10(maxS));
    const tip = document.getElementById('pc-tip'), cur = document.getElementById('pc-cursore');
    cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('visibility', 'visible');
    const righe = curve.curve.map(c => {
      let i = 0; while (i < c.secs.length - 1 && c.secs[i + 1] <= s) i++;
      const v = unita === 'w' ? `${c.watts[i]} W` : `${(c.wkg[i] || 0).toFixed(2)} W/kg`;
      return `<div><i class="pallino" style="background:${COLORI[c.id]}"></i>${NOMI[c.id]} <b>${v}</b></div>`;
    }).join('');
    tip.innerHTML = `<b>${durata(Math.round(s))}</b>${righe}`;
    tip.hidden = false;
  }
  function tabellaBest() {
    const cs = curve.curve, mig = cs.map(c => Analisi.migliori(c)), wkg = x => (x == null ? '–' : x.toFixed(2)), w = x => (x == null ? '–' : x);
    const riga = (label, celle) => `<tr><th>${label}</th>${celle}</tr>`;
    return `<table class="mw-tab mw-best" id="ftp-best"><thead><tr><th>Durata</th>${cs.map(c => `<th colspan="2" style="color:${COLORI[c.id]}">${NOMI[c.id]}</th>`).join('')}</tr>
      <tr><th></th>${cs.map(() => '<th>W</th><th>W/kg</th>').join('')}</tr></thead><tbody>
      ${Analisi.DURATE.map(([, label], k) => riga(label, mig.map(m => `<td>${w(m[k].watts)}</td><td>${wkg(m[k].wkg)}</td>`).join(''))).join('')}
      ${riga('MAP', cs.map(c => `<td>${c.map ? c.map.watts : '–'}</td><td>${c.map ? c.map.wkg.toFixed(2) : '–'}</td>`).join(''))}
      ${riga('TMAP', cs.map(c => `<td colspan="2">${c.map ? durata(c.map.secs) : '–'}</td>`).join(''))}
      ${riga('eFTP', cs.map(c => `<td>${w(c.eftp)}</td><td>${c.eftp ? (c.eftp / curve.peso).toFixed(2) : '–'}</td>`).join(''))}
      ${riga('VO2max', cs.map(c => `<td colspan="2">${c.vo2max == null ? '–' : c.vo2max}</td>`).join(''))}
      ${riga('CS5m', cs.map(c => `<td colspan="2">${c.cs5m == null ? '–' : c.cs5m}</td>`).join(''))}
    </tbody></table>`;
  }
  function profilo() {
    const cs = curve.curve, peso = curve.peso;
    const prof = cs.map(c => { const at = s => { const i = c.secs.indexOf(s); return i < 0 ? null : c.wkg[i]; }; return Analisi.profilo({ s5: at(5), m1: at(60), m5: at(300), ftp: c.eftp ? c.eftp / peso : null }); });
    // grafico come intervals.icu: una linea per periodo sulle quattro durate, da 0 (non allenato) a 100 (livello mondiale)
    const W = 420, H = 230, L = 40, R = 14, T = 12, B = 26, X = i => L + i * (W - L - R) / 3, Y = v => T + (1 - v / 100) * (H - T - B);
    const svg = `<svg class="mw-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profilo di potenza">
      ${[0, 20, 40, 60, 80, 100].map(v => `<line class="griglia" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="et-y" x="${L - 6}" y="${Y(v) + 4}">${v}%</text>`).join('')}
      ${['5s', '1m', '5m', 'FTP'].map((t, i) => `<text class="et-x" x="${X(i)}" y="${H - 8}">${t}</text>`).join('')}
      ${prof.map((p, k) => `<path class="pp-linea" style="stroke:${COLORI[cs[k].id]}" d="${p.voci.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v.livello || 0)}`).join('')}"/>${p.voci.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v.livello || 0)}" r="4" style="stroke:${COLORI[cs[k].id]}" class="pp-punto"/>`).join('')}`).join('')}
    </svg>`;
    return `<div class="mw-profilo" id="ftp-profilo">${svg}
      <table class="mw-tab"><thead><tr><th></th>${cs.map(c => `<th style="color:${COLORI[c.id]}">${NOMI[c.id]}</th>`).join('')}</tr></thead><tbody>
        ${['5s', '1m', '5m', 'FTP'].map((t, i) => `<tr><th>${t}</th>${prof.map(p => { const v = p.voci[i]; return `<td>${v.wkg == null ? '–' : v.wkg.toFixed(2)} <small>${v.livello == null ? '' : v.livello + '% · ' + v.categoria}</small></td>`; }).join('')}</tr>`).join('')}
        <tr><th>Peso</th>${cs.map(() => `<td>${peso} kg</td>`).join('')}</tr>
        <tr><th>Tipo</th>${prof.map(p => `<td><b>${esc(p.tipo)}</b></td>`).join('')}</tr>
      </tbody></table>
      <p class="mw-aiuto">Livello sulla scala di Coggan per uomini, in W/kg: 0% = non allenato, 100% = livello mondiale. intervals.icu usa invece i percentili dei suoi atleti, che non sono pubblici: i numeri non coincidono, l'ordine dei punti forti e deboli sì.</p>
    </div>`;
  }

  /* ----- Fitness ----- */
  const PERIODI = [['stagione', 'Stagione'], ['prossimo', 'Prossimo mese'], ['6m', '6 mesi'], ['1a', '1 anno'], ['1m', '1 mese'], ['42g', '42 giorni']];
  let fitPeriodo = 'stagione', fitSerie = [], fitSel = null;
  const cacheFit = {};
  async function caricaFitness() {
    const root = document.getElementById('fitness-root');
    if (!root) return;
    if (!root.querySelector('.mw-fit-barra')) {
      root.innerHTML = `<div class="mw-fit-barra"><span id="fit-date" class="mw-fit-date"></span>
          <div class="mw-seg">${PERIODI.map(([k, t]) => `<button type="button" data-periodo="${k}">${t}</button>`).join('')}</div></div>
        <div class="mw-fit-corpo"><div class="mw-fit-grafici"><div id="fit-grafico" class="mw-grafico"></div><div id="forma-grafico" class="mw-grafico"></div></div>
          <aside id="fit-valori" class="mw-fit-valori" aria-live="polite"></aside></div>`;
    }
    root.querySelectorAll('[data-periodo]').forEach(b => { b.classList.toggle('scelto', b.dataset.periodo === fitPeriodo); b.setAttribute('aria-pressed', b.dataset.periodo === fitPeriodo); });
    const { start, end } = Analisi.periodo(fitPeriodo, oggi()), fineDati = end > oggi() ? oggi() : end, chiave = start + fineDati;
    document.getElementById('fit-date').textContent = `${dataBreve(start)} – ${dataBreve(end)}`;
    if (!cacheFit[chiave]) {
      try { const r = await fetch(`/api/fitness?start=${start}&end=${fineDati}`); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status); cacheFit[chiave] = j.giorni || []; }
      catch (e) { document.getElementById('fit-grafico').innerHTML = `<p class="mw-aiuto">intervals.icu non risponde (${esc(e.message)}).</p>`; return; }
    }
    fitSerie = Analisi.serieFitness(cacheFit[chiave], oggi(), end).filter(x => x.data >= start);
    const reali = fitSerie.filter(x => !x.previsto);
    fitSel = reali.length ? reali[reali.length - 1] : fitSerie[fitSerie.length - 1];
    disegnaFitness();
  }
  function scalaX(n, L, W, R) { return i => L + (n > 1 ? i / (n - 1) : 0.5) * (W - L - R); }
  function etichetteMesi(serie, X, y) {
    return serie.map((p, i) => (p.data.slice(8) === '01' ? `<line class="griglia-v" x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="0" y2="${y}"/><text class="et-x" x="${X(i).toFixed(1)}" y="${y + 16}">${parseISO(p.data).toLocaleDateString('it-IT', { month: 'short' })}</text>` : '')).join('');
  }
  function disegnaFitness() {
    const s = fitSerie, n = s.length;
    if (!n) { document.getElementById('fit-grafico').innerHTML = '<p class="mw-aiuto">Nessun dato nel periodo.</p>'; return; }
    const W = 900, L = 44, R = 10, X = scalaX(n, L, W, R), iOggi = s.findIndex(p => p.data === oggi());
    // 1. Fitness, Fatica e carico del giorno
    const H1 = 290, T1 = 10, B1 = 26, max1 = Math.max(10, ...s.map(p => Math.max(p.ctl, p.atl, p.carico)));
    const p1 = passoTondo(max1, 5), top1 = Math.ceil(max1 / p1) * p1, Y1 = v => T1 + (1 - v / top1) * (H1 - T1 - B1);
    const griglia1 = []; for (let v = 0; v <= top1 + 1e-9; v += p1) griglia1.push(`<line class="griglia" x1="${L}" x2="${W - R}" y1="${Y1(v).toFixed(1)}" y2="${Y1(v).toFixed(1)}"/><text class="et-y" x="${L - 6}" y="${(Y1(v) + 4).toFixed(1)}">${v}</text>`);
    const bw = Math.max(1, (W - L - R) / n * 0.6);
    const barre = s.map((p, i) => (p.carico ? `<rect class="fit-carico${p.previsto ? ' previsto' : ''}" x="${(X(i) - bw / 2).toFixed(1)}" y="${Y1(p.carico).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y1(0) - Y1(p.carico)).toFixed(1)}"/>` : '')).join('');
    const linea = (pts, k) => pts.map(([i, p], j) => `${j ? 'L' : 'M'}${X(i).toFixed(1)},${Y1(p[k]).toFixed(1)}`).join('');
    const tutti = s.map((p, i) => [i, p]), reali = tutti.filter(([, p]) => !p.previsto), futuri = tutti.filter(([i, p]) => p.previsto || i === reali.length - 1);
    const area = reali.length ? `${linea(reali, 'ctl')}L${X(reali[reali.length - 1][0]).toFixed(1)},${Y1(0)}L${X(reali[0][0]).toFixed(1)},${Y1(0)}Z` : '';
    document.getElementById('fit-grafico').innerHTML = `<svg class="mw-svg" id="fit-svg" viewBox="0 0 ${W} ${H1}" role="img" aria-label="Fitness, Fatica e carico del giorno">
      ${griglia1.join('')}${etichetteMesi(s, X, H1 - B1)}${barre}
      <path class="fit-area" d="${area}"/><path class="fit-ctl" d="${linea(reali, 'ctl')}"/><path class="fit-atl" d="${linea(reali, 'atl')}"/>
      ${futuri.length > 1 ? `<path class="fit-previsto fit-ctl-p" d="${linea(futuri, 'ctl')}"/><path class="fit-previsto fit-atl-p" d="${linea(futuri, 'atl')}"/>` : ''}
      ${iOggi >= 0 ? `<line class="fit-oggi" x1="${X(iOggi).toFixed(1)}" x2="${X(iOggi).toFixed(1)}" y1="${T1}" y2="${H1 - B1}"/>` : ''}
      <line class="fit-cursore" x1="0" x2="0" y1="${T1}" y2="${H1 - B1}" visibility="hidden"/>
      <text class="et-unita" x="6" y="${T1 + 4}">carico</text>
      <rect class="pc-presa" x="${L}" y="0" width="${W - L - R}" height="${H1}" data-grafico="fit"/></svg>`;
    // 2. Forma con le fasce
    const H2 = 220, T2 = 8, B2 = 22, minF = Math.min(-40, ...s.map(p => p.form)), maxF = Math.max(30, ...s.map(p => p.form));
    const Y2 = v => T2 + (1 - (v - minF) / (maxF - minF)) * (H2 - T2 - B2);
    const fasce = [['transizione', 20, maxF], ['fresco', 5, 20], ['grigia', -10, 5], ['ottimale', -30, -10], ['rischio', minF, -30]];
    const rect = fasce.map(([z, a, b]) => `<rect class="fascia z-${z}" x="${L}" width="${W - L - R}" y="${Y2(b).toFixed(1)}" height="${(Y2(a) - Y2(b)).toFixed(1)}"/>`).join('');
    const tacche = [20, 5, -10, -30].map(v => `<text class="et-y" x="${L - 6}" y="${(Y2(v) + 4).toFixed(1)}">${v}</text>`).join('');
    // la linea cambia colore con la fascia, come intervals.icu
    const segmenti = []; let cur = null;
    s.forEach((p, i) => {
      const z = Analisi.zonaForma(p.form).id + (p.previsto ? ' previsto' : '');
      const pt = `${X(i).toFixed(1)},${Y2(p.form).toFixed(1)}`;
      if (!cur || cur.z !== z) { if (cur) cur.d += `L${pt}`; cur = { z, d: `M${pt}` }; segmenti.push(cur); } else cur.d += `L${pt}`;
    });
    document.getElementById('forma-grafico').innerHTML = `<svg class="mw-svg" id="forma-svg" viewBox="0 0 ${W} ${H2}" role="img" aria-label="Forma">
      ${rect}${tacche}${segmenti.map(g => `<path class="forma-linea z-${g.z}" d="${g.d}"/>`).join('')}
      ${iOggi >= 0 ? `<line class="fit-oggi" x1="${X(iOggi).toFixed(1)}" x2="${X(iOggi).toFixed(1)}" y1="${T2}" y2="${H2 - B2}"/>` : ''}
      <line class="fit-cursore" x1="0" x2="0" y1="${T2}" y2="${H2 - B2}" visibility="hidden"/>
      <text class="et-unita" x="6" y="${T2 + 4}">forma</text>
      <rect class="pc-presa" x="${L}" y="0" width="${W - L - R}" height="${H2}" data-grafico="forma"/></svg>`;
    valori();
  }
  function valori() {
    const p = fitSel, el = document.getElementById('fit-valori');
    if (!p || !el) return;
    const z = Analisi.zonaForma(p.form);
    el.innerHTML = `<div class="mw-fv-data">${parseISO(p.data).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}${p.previsto ? ' · previsto' : ''}</div>
      <div class="mw-fv"><span>Fitness</span> <b class="fit">${Math.round(p.ctl)}</b></div>
      <div class="mw-fv"><span>Fatica</span> <b class="fat">${Math.round(p.atl)}</b></div>
      <div class="mw-fv"><span>Forma</span> <b class="z-${z.id}">${Math.round(p.form)}</b></div>
      <div class="mw-fv-zona z-${z.id}">${z.nome}</div>
      <div class="mw-fv"><span>Carico</span> <b>${p.carico}</b></div>
      <ul class="mw-fv-legenda">${Analisi.ZONE.map(([id, nome]) => `<li class="z-${id}">${nome}</li>`).join('')}</ul>`;
  }
  function suFitness(e) {
    const presa = e.target.closest('.pc-presa[data-grafico]');
    if (!presa || !fitSerie.length) return;
    const svg = presa.ownerSVGElement, r = svg.getBoundingClientRect();
    if (!r.width) return;
    const W = 900, L = 44, R = 10, x = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(fitSerie.length - 1, Math.round((x - L) / (W - L - R) * (fitSerie.length - 1))));
    fitSel = fitSerie[i];
    const X = scalaX(fitSerie.length, L, W, R)(i).toFixed(1);
    document.querySelectorAll('#fitness-root .fit-cursore').forEach(l => { l.setAttribute('x1', X); l.setAttribute('x2', X); l.setAttribute('visibility', 'visible'); });
    valori();
  }

  /* ----- obiettivi (Stagione) ----- */
  async function caricaObiettivi() {
    try { const j = await (await fetch('/api/obiettivi')).json(); window.obiettiviUtente = j.obiettivi || []; } catch (e) { /* restano quelli del piano */ }
    renderEvents();
  }
  async function aggiungiObiettivo(form) {
    const v = n => form.querySelector(`[name=${n}]`).value.trim();
    const corpo = { nome: v('nome'), data: v('data'), priorita: v('priorita'), km: v('km'), dislivello: v('dislivello'), note: v('note') };
    if (!corpo.nome || !corpo.data) { if (window.mwAvviso) mwAvviso('Scrivi almeno nome e data.'); return; }
    try {
      const r = await fetch('/api/obiettivi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      window.obiettiviUtente = (window.obiettiviUtente || []).concat(j.obiettivo);
      form.reset(); form.hidden = true;
      renderEvents();
      if (window.mwAvviso) mwAvviso(`Obiettivo «${j.obiettivo.nome}» aggiunto.`);
    } catch (e) { if (window.mwAvviso) mwAvviso('Non salvato: ' + e.message); }
  }
  async function eliminaObiettivo(id) {
    const o = (window.obiettiviUtente || []).find(x => x.id === id);
    if (!o || !confirm(`Togliere l'obiettivo «${o.nome}»?`)) return;
    await fetch('/api/obiettivi/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
    window.obiettiviUtente = window.obiettiviUtente.filter(x => x.id !== id);
    renderEvents();
  }

  /* ----- collegamenti ----- */
  const vai = window.switchDashView;
  window.switchDashView = function (v) {
    vai(v);
    if (v === 'view-athlete') caricaFTP();
    if (v === 'view-fitness') caricaFitness();
    if (v === 'view-programming') caricaObiettivi();
  };
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#mw-atleta-nome')) modificaNome();
    const u = t.closest('[data-unita]'); if (u) { unita = u.dataset.unita; disegnaFTP(); }
    const p = t.closest('[data-periodo]'); if (p) { fitPeriodo = p.dataset.periodo; caricaFitness(); }
    if (t.closest('#ob-aggiungi')) { const f = document.getElementById('ob-form'); f.hidden = false; f.querySelector('[name=nome]').focus(); }
    if (t.closest('#ob-annulla')) document.getElementById('ob-form').hidden = true;
    const del = t.closest('[data-ob-elimina]'); if (del) eliminaObiettivo(del.dataset.obElimina);
  });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'mw-atleta-nome') { e.preventDefault(); modificaNome(); } });
  document.addEventListener('mousemove', e => { if (e.target.closest && e.target.closest('#pc-svg')) suCurva(e); else if (e.target.closest && e.target.closest('.pc-presa[data-grafico]')) suFitness(e); });
  document.addEventListener('mouseleave', e => { if (e.target && e.target.id === 'pc-svg') document.getElementById('pc-tip').hidden = true; }, true);
  document.getElementById('ob-form').addEventListener('submit', e => { e.preventDefault(); aggiungiObiettivo(e.target); });
  fetch('/api/preferenze').then(r => r.json()).then(j => { window.mwNomeScelto = (j && j.nome) || ''; window.mwApplicaNome(); }).catch(() => {});
  caricaObiettivi();
  window.mwAnalisi = { caricaFTP, caricaFitness, caricaObiettivi };
})();

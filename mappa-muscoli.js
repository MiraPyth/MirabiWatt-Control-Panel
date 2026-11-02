/* MirabiWatt · mappa dei muscoli lavorati in una seduta di palestra (19/10/2026 sera). Pura, senza DOM né rete:
 * serie per muscolo (1 sul principale, ½ sui secondari, solo le serie fatte) e l'immagine 1080×1080 in SVG, figura
 * davanti e dietro colorata a calore. Strava non lascia caricare foto alle app private: l'immagine si scarica dalla
 * schermata «Salvato» e si aggiunge a mano. Nel browser è `MappaMuscoli`; nel server la usano strava.js e server.js. */
(function (root) {
  'use strict';
  const SPENTO = '#37344f';
  // ordine anatomico: decide anche i pari merito
  const NOMI = {
    petto: 'Petto', spalle: 'Spalle', 'spalle-post': 'Deltoidi posteriori', dorsali: 'Dorsali', trapezio: 'Trapezio',
    bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', avambracci: 'Avambracci', addome: 'Addome', obliqui: 'Obliqui',
    lombari: 'Lombari', glutei: 'Glutei', quadricipiti: 'Quadricipiti', femorali: 'Femorali', adduttori: 'Adduttori', polpacci: 'Polpacci'
  };
  const ORDINE = Object.keys(NOMI);

  // muscolo principale = 1, secondari = quanto contano davvero (½ come nelle conte di volume RP/Pyramid, meno se marginali)
  const ESERCIZI = {
    'spinte-inclinata-manubri': { petto: 1, spalle: 0.5, tricipiti: 0.5 },
    'panca-piana-manubri': { petto: 1, spalle: 0.5, tricipiti: 0.5 },
    'chest-press-macchina': { petto: 1, tricipiti: 0.5, spalle: 0.3 },
    'croci-cavi': { petto: 1 },
    'lento-avanti-manubri': { spalle: 1, tricipiti: 0.5, trapezio: 0.3 },
    'alzate-laterali-manubri': { spalle: 1, trapezio: 0.3 },
    'alzate-laterali-cavi': { spalle: 1, trapezio: 0.3 },
    'alzate-posteriori-macchina': { 'spalle-post': 1, trapezio: 0.5 },
    'face-pull': { 'spalle-post': 1, trapezio: 0.5 },
    'overhead-tricipiti-cavo': { tricipiti: 1 },
    'pushdown-corda': { tricipiti: 1 },
    'curl-cavi': { bicipiti: 1, avambracci: 0.3 },
    'curl-panca-inclinata': { bicipiti: 1, avambracci: 0.3 },
    'curl-martello': { bicipiti: 1, avambracci: 0.5 },
    'crunch-cavi': { addome: 1, obliqui: 0.3 },
    'hanging-knee-raise': { addome: 1, obliqui: 0.3 },
    'ab-wheel': { addome: 1, obliqui: 0.3 },
    'pallof-press': { obliqui: 1, addome: 0.5 },
    'squat-bilanciere': { quadricipiti: 1, glutei: 1, adduttori: 0.5, lombari: 0.3 },
    'stacco-rumeno-manubri': { femorali: 1, glutei: 1, lombari: 0.5 },
    'leg-curl-seduto': { femorali: 1 },
    'leg-extension': { quadricipiti: 1 },
    'calf-raise': { polpacci: 1 },
    'lat-machine': { dorsali: 1, bicipiti: 0.5, 'spalle-post': 0.3 },
    'rematore-petto-appoggiato': { dorsali: 1, trapezio: 0.5, 'spalle-post': 0.5, bicipiti: 0.3 },
    'pulldown-braccia-tese': { dorsali: 1 }
  };
  // esercizio nuovo: muscoli dalle parole del gruppo della scheda («femorali e glutei»), il primo è il principale
  const PAROLE = [[/spalle posteriori|deltoidi? posterior/, 'spalle-post'], [/petto|pettoral/, 'petto'], [/spalle|deltoid/, 'spalle'],
    [/dorsali/, 'dorsali'], [/trapezio/, 'trapezio'], [/bicipiti|brachiale/, 'bicipiti'], [/tricipiti/, 'tricipiti'],
    [/avambracci/, 'avambracci'], [/addome|addominali/, 'addome'], [/obliqui|anti-rotazione/, 'obliqui'], [/lombari/, 'lombari'],
    [/glutei/, 'glutei'], [/quadricipiti/, 'quadricipiti'], [/femorali/, 'femorali'], [/adduttori/, 'adduttori'], [/polpacci/, 'polpacci']];

  function muscoliDi(e) {
    if (ESERCIZI[e.id]) return ESERCIZI[e.id];
    const g = String(e.gruppo || e.nome || '').toLowerCase(), trovati = [];
    for (const [re, m] of PAROLE) { const i = g.search(re); if (i >= 0 && !trovati.some(t => t.m === m)) trovati.push({ m, i }); }
    trovati.sort((a, b) => a.i - b.i);
    return Object.fromEntries(trovati.map((t, k) => [t.m, k ? 0.5 : 1]));
  }

  /** { muscolo: serie } della seduta. */
  function carico(s) {
    const out = {};
    for (const e of s.esercizi || []) {
      const n = (e.serie || []).filter(x => x.fatta).length;
      if (!n) continue;
      for (const [m, p] of Object.entries(muscoliDi(e))) out[m] = Math.round(((out[m] || 0) + n * p) * 100) / 100;
    }
    return out;
  }

  function classifica(c) {
    return ORDINE.filter(m => c[m] > 0).map(m => ({ id: m, nome: NOMI[m], serie: c[m] }))
      .sort((a, b) => b.serie - a.serie || ORDINE.indexOf(a.id) - ORDINE.indexOf(b.id));
  }

  const mezzi = x => String(Math.round(x * 2) / 2).replace('.', ',');
  /** «petto 2 · spalle 2 · tricipiti 1»: i muscoli con almeno una serie, per la descrizione su Strava. */
  function rigaTesto(s) {
    return classifica(carico(s)).filter(x => x.serie >= 1).map(x => `${x.nome.toLowerCase()} ${mezzi(x.serie)}`).join(' · ');
  }

  // ------- immagine
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const TAPPE = [[0, [255, 196, 107]], [0.5, [255, 122, 47]], [1, [255, 46, 99]]];   // ambra → arancio → rosso caldo
  function calore(r) {
    r = Math.max(0, Math.min(1, r));
    const j = r <= 0.5 ? 0 : 1, [a, ca] = TAPPE[j], [b, cb] = TAPPE[j + 1], t = (r - a) / (b - a);
    return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  // curva morbida chiusa (Catmull-Rom → Bézier) da una lista di punti
  function liscio(p, k = 1) {
    const n = p.length, f = v => Math.round(v * 10) / 10;
    let d = `M${f(p[0][0])} ${f(p[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += `C${f(p1[0] + (p2[0] - p0[0]) * k / 6)} ${f(p1[1] + (p2[1] - p0[1]) * k / 6)} ${f(p2[0] - (p3[0] - p1[0]) * k / 6)} ${f(p2[1] - (p3[1] - p1[1]) * k / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + 'Z';
  }
  const specchio = p => p.map(([x, y]) => [200 - x, y]).reverse();

  // figura su una griglia 200×440, metà sinistra (x < 100): l'altra metà è lo specchio
  const SAGOMA = [[100, 54], [91, 56], [89, 68], [78, 74], [64, 78], [52, 84], [45, 96], [42, 112], [40, 130], [38, 150], [36, 166], [33, 186],
    [30, 206], [28, 226], [25, 240], [24, 252], [28, 262], [34, 260], [36, 248], [40, 232], [46, 210], [52, 188], [56, 170], [58, 150],
    [61, 134], [64, 124], [65, 146], [66, 170], [66, 192], [63, 214], [60, 240], [59, 270], [61, 300], [63, 322], [61, 346], [61, 372],
    [65, 398], [66, 414], [60, 426], [64, 432], [84, 432], [86, 420], [84, 402], [86, 372], [88, 346], [88, 322], [92, 292], [96, 262], [100, 246]];
  const AVAMBRACCIO = [[45, 170], [40, 170], [35, 186], [31, 206], [30, 224], [37, 226], [43, 208], [49, 188], [52, 174]];
  const DAVANTI = [
    ['trapezio', [[91, 62], [86, 73], [70, 80], [82, 83], [93, 76]]],
    ['spalle', [[66, 82], [54, 86], [47, 96], [44, 112], [46, 124], [54, 118], [60, 106], [66, 94]]],
    ['petto', [[98, 88], [84, 84], [70, 86], [64, 96], [62, 110], [66, 122], [78, 128], [92, 128], [98, 124]]],
    ['bicipiti', [[58, 124], [50, 124], [45, 136], [43, 152], [46, 164], [52, 162], [56, 148]]],
    ['avambracci', AVAMBRACCIO],
    ['obliqui', [[84, 132], [70, 130], [66, 146], [67, 170], [70, 192], [78, 204], [85, 200], [84, 170]]],
    ['addome', [[88, 132], [98, 132], [98, 146], [87, 146]], 0.35],
    ['addome', [[87, 150], [98, 150], [98, 164], [87, 164]], 0.35],
    ['addome', [[87, 168], [98, 168], [98, 182], [87, 182]], 0.35],
    ['addome', [[88, 186], [98, 186], [98, 212], [91, 206]], 0.35],
    ['quadricipiti', [[66, 222], [62, 246], [62, 272], [66, 298], [72, 316], [78, 310], [76, 280], [74, 248], [72, 226]]],
    ['quadricipiti', [[77, 222], [80, 250], [82, 280], [80, 306], [86, 318], [92, 306], [92, 280], [90, 250], [86, 232]]],
    ['adduttori', [[93, 238], [91, 252], [93, 276], [97, 262], [99, 246], [99, 240]]],
    ['polpacci', [[64, 336], [62, 356], [64, 380], [68, 396], [73, 392], [72, 364], [70, 342]]],
    ['polpacci', [[86, 336], [87, 356], [85, 378], [82, 392], [79, 386], [80, 360], [82, 342]]]
  ];
  const DIETRO = [
    ['trapezio', [[100, 58], [92, 60], [88, 70], [72, 80], [84, 90], [92, 108], [100, 128]]],
    ['spalle-post', [[68, 82], [56, 86], [48, 96], [45, 112], [48, 122], [56, 116], [62, 104], [70, 94]]],
    ['dorsali', [[72, 96], [64, 112], [64, 134], [68, 156], [78, 176], [90, 184], [93, 164], [91, 140], [85, 116]]],
    ['tricipiti', [[58, 122], [48, 122], [44, 136], [42, 152], [45, 166], [52, 164], [57, 148]]],
    ['avambracci', AVAMBRACCIO],
    ['lombari', [[99, 166], [95, 170], [92, 186], [92, 204], [96, 212], [99, 212]]],
    ['femorali', [[64, 262], [62, 286], [64, 306], [70, 322], [80, 322], [88, 310], [92, 288], [94, 268], [86, 270], [74, 266]]],
    ['glutei', [[99, 214], [86, 212], [72, 216], [64, 230], [64, 248], [72, 262], [86, 266], [98, 258]]],
    ['polpacci', [[64, 330], [61, 350], [63, 372], [68, 388], [76, 386], [78, 362], [76, 340]]],
    ['polpacci', [[80, 332], [78, 350], [80, 372], [84, 386], [88, 372], [88, 350], [86, 336]]]
  ];

  function figura(vista, forme, colori, x, y) {
    const sagoma = liscio([...SAGOMA, ...specchio(SAGOMA).slice(1, -1)], 0.8);
    const pezzi = forme.flatMap(([m, p, k]) => [[m, liscio(p, k)], [m, liscio(specchio(p), k)]]);
    const accesi = pezzi.filter(([m]) => colori[m]);
    return `<g data-vista="${vista}" transform="translate(${x} ${y}) scale(1.5)">
<path d="${sagoma}" fill="url(#mw-pelle)" stroke="#4a4668" stroke-width="1"/><ellipse cx="100" cy="30" rx="18" ry="23" fill="url(#mw-pelle)" stroke="#4a4668" stroke-width="1"/>
<g filter="url(#mw-bagliore)" opacity=".7">${accesi.map(([m, d]) => `<path d="${d}" fill="${colori[m]}"/>`).join('')}</g>
${pezzi.map(([m, d]) => `<path data-muscolo="${m}" d="${d}" fill="${colori[m] || SPENTO}" stroke="#15141f" stroke-width="1.2" stroke-linejoin="round"/>`).join('')}
<g fill="url(#mw-lucido)" pointer-events="none">${accesi.map(([, d]) => `<path d="${d}"/>`).join('')}</g>
</g>`;
  }

  function quando(s) {
    const d = new Date(s.inizio || `${s.data}T12:00:00Z`);
    return isNaN(d) ? '' : new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  }

  /** L'immagine 1080×1080 della seduta, in SVG. */
  function svg(s) {
    const c = carico(s), cl = classifica(c), max = Math.max(4, ...cl.map(x => x.serie));
    const colori = Object.fromEntries(cl.map(x => [x.id, calore(x.serie / max)]));
    const fatte = (s.esercizi || []).map(e => (e.serie || []).filter(x => x.fatta));
    const serie = fatte.reduce((t, f) => t + f.length, 0);
    const kg = Math.round(fatte.reduce((t, f) => t + f.reduce((u, x) => u + (x.kg || 0) * (x.reps || 0), 0), 0));
    const esercizi = fatte.filter(f => f.length).length;
    const dur = s.inizio && s.fine ? Math.round((new Date(s.fine) - new Date(s.inizio)) / 60000) : null;
    const sotto = [s.schema, quando(s)].filter(Boolean).join(' · ');
    const righe = cl.slice(0, 7).map((x, i) => {
      const y = 318 + i * 80;
      return `<text x="700" y="${y}" font-size="27" font-weight="600" fill="#ececf4">${esc(x.nome)}</text>
<text x="1016" y="${y}" font-size="23" fill="#a8a4c2" text-anchor="end">${mezzi(x.serie)} serie</text>
<rect x="700" y="${y + 16}" width="316" height="12" rx="6" fill="#2c2944"/><rect x="700" y="${y + 16}" width="${Math.max(12, Math.round(316 * x.serie / max))}" height="12" rx="6" fill="${colori[x.id]}"/>`;
    }).join('\n');
    const numeri = [[dur != null ? `${dur}′` : '—', 'durata'], [String(serie), 'serie'], [kg.toLocaleString('it-IT'), 'kg sollevati'], [String(esercizi), 'esercizi']]
      .map(([v, l], i) => `<text x="${135 + i * 270}" y="1000" font-size="46" font-weight="700" fill="#ececf4" text-anchor="middle">${esc(v)}</text><text x="${135 + i * 270}" y="1036" font-size="21" fill="#a8a4c2" text-anchor="middle" letter-spacing="1">${l}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="Inter, 'Segoe UI', Roboto, system-ui, sans-serif">
<defs>
<radialGradient id="mw-fondo" cx="35%" cy="45%" r="80%"><stop offset="0" stop-color="#2b2648"/><stop offset="1" stop-color="#111019"/></radialGradient>
<radialGradient id="mw-alone" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff7a2f" stop-opacity=".22"/><stop offset="1" stop-color="#ff7a2f" stop-opacity="0"/></radialGradient>
<linearGradient id="mw-pelle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2b47"/><stop offset="1" stop-color="#1d1b2e"/></linearGradient>
<linearGradient id="mw-lucido" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="mw-bagliore" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<rect width="1080" height="1080" fill="url(#mw-fondo)"/>
<circle cx="370" cy="560" r="360" fill="url(#mw-alone)"/>
<text x="64" y="86" font-size="22" font-weight="700" fill="#4fc3f7" letter-spacing="3">MirabiWatt · PALESTRA</text>
<text x="64" y="156" font-size="64" font-weight="800" fill="#ececf4">${esc(s.seduta)}</text>
<text x="64" y="198" font-size="26" fill="#a8a4c2">${esc(sotto)}</text>
${figura('davanti', DAVANTI, colori, 70, 230)}
${figura('dietro', DIETRO, colori, 370, 230)}
<text x="220" y="912" font-size="18" fill="#77739a" text-anchor="middle" letter-spacing="4">DAVANTI</text>
<text x="520" y="912" font-size="18" fill="#77739a" text-anchor="middle" letter-spacing="4">DIETRO</text>
<text x="700" y="262" font-size="20" font-weight="700" fill="#77739a" letter-spacing="4">MUSCOLI LAVORATI</text>
${righe || '<text x="700" y="318" font-size="24" fill="#a8a4c2">Nessuna serie segnata</text>'}
<line x1="64" y1="936" x2="1016" y2="936" stroke="#35324d" stroke-width="2"/>
${numeri}
</svg>`;
  }

  const api = { SPENTO, NOMI, carico, classifica, rigaTesto, svg, calore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MappaMuscoli = api;
})(typeof window !== 'undefined' ? window : this);

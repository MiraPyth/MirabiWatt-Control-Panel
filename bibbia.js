/* MirabiWatt · «Fondamenti di Body Building» (19/10/2026 sera): la «Bibbia» dell'utente. Concetti essenziali da
 * «The Muscle and Strength Pyramid: Training» (Helms, Morgan, Valdez, 3ª ed. 2025), «…: Nutrition» (Helms, 2016),
 * «Scientific Principles of Hypertrophy Training» (Renaissance Periodization, 2021) e dagli studi di
 * sintesi-ricomposizione-corporea.md. Solo dati + un disegnatore: niente rete. */
(function () {
  'use strict';
  const el = document.getElementById('bb-corpo');
  if (!el) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const PIRAMIDE_ALLENAMENTO = ['Aderenza', 'Volume · intensità · frequenza', 'Progressione', 'Scelta degli esercizi', 'Recuperi', 'Tempo di esecuzione'];
  const PIRAMIDE_NUTRIZIONE = ['Bilancio energetico', 'Macronutrienti e fibre', 'Micronutrienti e acqua', 'Tempi e frequenza dei pasti', 'Integratori'];

  // ogni sezione: titolo, una frase che la riassume, i punti (testo breve), un grafico facoltativo
  const SEZIONI = [
    { id: 'aderenza', titolo: 'Aderenza', regola: 'Il piano migliore è quello che riesci a seguire per mesi.',
      punti: ['Costruisci il piano attorno alla vita che hai, non a quella ideale.', 'Meglio 3 sedute fatte sempre che 5 saltate a metà.', 'Ogni livello della piramide conta meno di quello sotto: prima la costanza, poi i dettagli.'] },
    { id: 'volume', titolo: 'Volume', regola: '10-20 serie dure a settimana per muscolo. È la leva più forte per crescere.',
      grafico: 'volume',
      punti: ['Serie «dura» = a 0-4 ripetizioni dal cedimento. Il volume si conta in serie, non in kg × ripetizioni.', 'Sotto ~4 serie a settimana si mantiene, oltre ~30 non si guadagna più niente.', 'Gruppi su cui punti (per te: petto, spalle, bicipiti, addome): ~1,5 volte il volume, gli altri un po\' meno (specializzazione).', 'Non più di ~11 serie per lo stesso muscolo nella stessa seduta: oltre, meglio spalmare su due giorni.'] },
    { id: 'intensita', titolo: 'Intensità e RIR', regola: 'Per crescere conta stare vicino al cedimento, non arrivarci.',
      grafico: 'rir',
      punti: ['RIR = ripetizioni che lasci in canna. RIR 2 = potevi farne altre 2.', 'Funziona tutto tra ~4 e ~30 ripetizioni massime (30-85% del massimale).', '6-8 ripetizioni: RIR 3-0. 8-12: RIR 2-0. Oltre 12: RIR 1-0.', 'Il cedimento non è superiore (Refalo 2023): usalo sugli isolamenti, all\'ultima serie.'] },
    { id: 'frequenza', titolo: 'Frequenza', regola: 'Ogni muscolo almeno 2 volte a settimana.',
      punti: ['A parità di volume la frequenza conta poco per crescere, molto di più per la forza.', 'Serve soprattutto a distribuire il volume: 16 serie in 2 sedute rendono più di 16 in una.'] },
    { id: 'progressione', titolo: 'Progressione', regola: 'Doppia progressione: prima le ripetizioni, poi il peso.',
      grafico: 'doppia',
      punti: ['Ogni esercizio ha un intervallo (es. 8-12) e un RIR. Quando chiudi tutte le serie al massimo delle ripetizioni, la volta dopo sali di peso.', 'Mesociclo (RP): si parte vicino al volume minimo efficace con RIR 3, ogni settimana più vicino al cedimento e qualche serie in più, poi scarico.', 'Se le prestazioni calano due sedute di fila, la fatica ha superato il recupero: scarico anticipato.'] },
    { id: 'mesociclo', titolo: 'Il mesociclo', regola: '4 settimane di carico che sale, 1 di scarico.',
      grafico: 'mesociclo',
      punti: ['Sett. 1: RIR 3, volume di partenza. Sett. 2: RIR 2. Sett. 3: RIR 1-2 e una serie in più sui prioritari. Sett. 4: RIR 0-1.', 'Scarico: metà delle serie, carichi −10%, RIR 4. Ogni 4-6 settimane (Bell 2023; nella pratica in media ogni 5,6).'] },
    { id: 'esercizi', titolo: 'Scelta degli esercizi', regola: 'Pochi esercizi, scelti bene, tenuti per tutto il mesociclo.',
      punti: ['Copri i 6 schemi: spinta orizzontale e verticale, tirata verticale e due rematori (gomiti larghi e stretti), squat, cerniera d\'anca.', 'Una spinta inclinata per il petto alto; un isolamento per quadricipiti, femorali, bicipiti, tricipiti, deltoide laterale, polpacci.', 'Meglio gli esercizi che caricano il muscolo allungato: curl inclinato, estensioni sopra la testa, leg curl seduto, stacco rumeno.', 'Prima i multiarticolari, da freschi. Cambiare sempre esercizio fa perdere tempo a reimparare.'] },
    { id: 'recuperi', titolo: 'Recuperi e tempo di esecuzione', regola: 'Almeno 90" tra le serie; 2-3\' sui multiarticolari pesanti.',
      grafico: 'recuperi',
      punti: ['Oltre ~90" la crescita non cambia (Singer 2024); sui grandi esercizi serve più tempo per non perdere ripetizioni.', 'Discesa controllata in 1-4", salita decisa. Non oltre ~8" per ripetizione.', 'Superserie tra muscoli che non si disturbano (bicipiti + tricipiti) per risparmiare tempo.'] },
    { id: 'scarico', titolo: 'Scarico', regola: 'La fatica cresce più in fretta dei muscoli: va smaltita.',
      punti: ['Meno serie e meno carico, stessa frequenza, RIR più alto.', 'Non è tempo perso: risensibilizza il muscolo allo stimolo del mesociclo dopo (RP).'] },
    { id: 'bici', titolo: 'Bici e palestra', regola: 'La bici non toglie muscolo. I pesi pesanti per le gambe fanno andare più forte.',
      punti: ['Meta-analisi su 43 studi: aggiungere l\'aerobico non riduce la crescita né la forza massima (Schumann 2022). La bici è l\'aerobico più compatibile.', 'Gambe pesanti (4-8 ripetizioni, mai a cedimento) 1-2 volte a settimana migliorano gli sforzi lunghi in bici (Mujika 2016; meta-analisi 2025).', 'Separa pesi e bici di almeno 3 ore quando puoi. Gambe mai il giorno prima del lungo o della seduta intensa.', 'Una sola seduta intensa a settimana mantiene il VO2max se l\'intensità è piena (Spiering 2021).'] },
    { id: 'energia', titolo: 'Bilancio energetico', regola: 'Le calorie decidono se il peso sale o scende. Tutto il resto viene dopo.',
      grafico: 'fasi',
      punti: ['Costruzione: +100/+200 kcal al giorno, +0,5-1% del peso al mese (intermedio). Di più = grasso (Helms 2023).', 'Definizione: −0,5/−1% del peso a settimana, deficit mai oltre ~500 kcal al giorno (Murphy & Koehler 2022).', 'Pausa dalla dieta: 1-2 settimane al mantenimento ogni ~8 di deficit.', 'Il peso del giorno non conta: conta la media settimanale.'] },
    { id: 'macro', titolo: 'Proteine, grassi, carboidrati', regola: 'Prima le proteine, poi i grassi minimi, il resto carboidrati.',
      grafico: 'macro',
      punti: ['Proteine: 1,8-2,3 g/kg in costruzione, 2,3-2,8 g/kg in definizione.', 'Grassi: 20-30% delle kcal (15-25% in definizione), mai sotto 0,5 g/kg.', 'Carboidrati: il resto, mai sotto 1 g/kg; tanti nei giorni di bici.', 'Da ciclista: il deficit nei giorni di palestra e riposo, mai sotto i lunghi e le sedute intense (IOC RED-S 2018).'] },
    { id: 'micro', titolo: 'Frutta, verdura, acqua', regola: 'Una porzione di frutta e una di verdura ogni 1000 kcal.',
      punti: ['Acqua: 1 litro ogni 23 kg di peso (per te ~3,5 L), più quella persa in bici.', 'Urine chiare 5 volte al giorno: il controllo più semplice.'] },
    { id: 'tempi', titolo: 'Pasti e tempi', regola: '3-6 pasti, 0,4-0,5 g/kg di proteine ciascuno.',
      punti: ['Un pasto con proteine 1-2 ore prima e uno 1-2 ore dopo l\'allenamento.', 'Il resto dei tempi conta poco: le calorie e le proteine del giorno contano molto di più.'] },
    { id: 'integratori', titolo: 'Integratori', regola: 'Pochi, con prove solide.',
      punti: ['Creatina monoidrato 0,04 g/kg (3 g) al giorno, sempre, a qualsiasi ora.', 'Vitamina D3 20-80 UI/kg secondo il sole (d\'inverno ~1600-3200 UI).', 'Omega-3: 2-3 g di EPA+DHA al giorno.', 'Caffeina ~3 mg/kg prima delle sedute dure (facoltativa).', 'BCAA e glutammina: inutili se le proteine sono giuste.'] }
  ];

  const FONTI = [
    'Helms E.R., Morgan A., Valdez A.M. — The Muscle and Strength Pyramid: Training, 3ª ed. (2025)',
    'Helms E.R. — The Muscle and Strength Pyramid: Nutrition (2016)',
    'Hoffmann J., Davis M., Feather J., Israetel M. — Scientific Principles of Hypertrophy Training, RP (2021)',
    'Schoenfeld B.J. et al. (2017) Dose-response tra volume settimanale e massa muscolare, J Sports Sci',
    'Pelland J. et al. (2024) Dose-risposta di volume e frequenza, SportRxiv',
    'Refalo M.C. et al. (2023) Vicinanza al cedimento e ipertrofia, Sports Med',
    'Singer A. et al. (2024) Recuperi tra le serie e ipertrofia, meta-analisi',
    'Bell L. et al. (2023) Scarico negli sport di forza e fisico, consenso Delphi, Sports Med Open',
    'Schumann M. et al. (2022) Compatibilità tra allenamento aerobico e di forza, Sports Med',
    'Mujika I., Rønnestad B.R., Martin D.T. (2016) Forza e prestazione nel ciclismo di endurance, IJSPP',
    'Spiering B.A. et al. (2021) La dose minima per mantenere la prestazione, JSCR',
    'Helms E.R. et al. (2023) Surplus piccolo o grande in soggetti allenati',
    'Murphy C., Koehler K. (2022) Il deficit energetico frena la massa magra, Scand J Med Sci Sports',
    'Hector A.J., Phillips S.M. (2018) Proteine e perdita di peso negli atleti, IJSNEM',
    'Mountjoy M. et al. (2018) Consenso IOC su RED-S, Br J Sports Med'
  ];

  // ----- grafici, solo HTML/CSS
  const barre = (righe, max) => `<div class="bb-barre">${righe.map(r => `<div class="bb-barra"><span>${esc(r[0])}</span><i style="--w:${Math.round(r[1] / max * 100)}%" class="${r[2] || ''}"></i><b>${esc(r[3] || r[1])}</b></div>`).join('')}</div>`;
  const GRAFICI = {
    volume: () => `<div class="bb-scala"><div class="bb-zona mv">mantieni<br><small>&lt;4</small></div><div class="bb-zona mev">cresci<br><small>10-20</small></div><div class="bb-zona mrv">troppo<br><small>&gt;25-30</small></div></div><p class="bb-didascalia">Serie dure per muscolo a settimana. Si parte dal basso (MEV) e si sale verso il massimo recuperabile (MRV).</p>`,
    rir: () => `<div class="bb-rir">${[['4', 'facile'], ['3', ''], ['2', 'utile'], ['1', ''], ['0', 'cedimento']].map(([n, t]) => `<div><b>${n}</b><small>${t}</small></div>`).join('')}</div><p class="bb-didascalia">Ripetizioni lasciate in canna. La crescita vera sta tra 3 e 0.</p>`,
    doppia: () => `<table class="bb-tab"><tr><th>Seduta</th><th>Carico</th><th>Ripetizioni (8-12)</th></tr><tr><td>1</td><td>20 kg</td><td>10 · 9 · 8</td></tr><tr><td>2</td><td>20 kg</td><td>11 · 10 · 9</td></tr><tr><td>3</td><td>20 kg</td><td>12 · 12 · 12 ✓</td></tr><tr><td>4</td><td>22 kg</td><td>9 · 8 · 8</td></tr></table>`,
    mesociclo: () => barre([['Sett. 1 · RIR 3', 24, 'c1'], ['Sett. 2 · RIR 2', 24, 'c2'], ['Sett. 3 · RIR 1-2', 28, 'c3'], ['Sett. 4 · RIR 0-1', 30, 'c4'], ['Scarico · RIR 4', 14, 'c0']], 30) + '<p class="bb-didascalia">Serie a seduta nella tua scheda (Petto-Spalle).</p>',
    recuperi: () => barre([['Squat, stacco', 180, 'c4', '3\''], ['Panca, rematore, lat', 150, 'c3', '2\'30"'], ['Isolamenti', 90, 'c1', '1\'30"']], 180),
    fasi: () => `<div class="bb-fasi"><div class="f-r">Ri-adattamento<small>ott-nov · mantenimento</small></div><div class="f-c">Costruzione<small>nov-dic · +150 kcal</small></div><div class="f-d">Definizione<small>gen-mar · −400/−500</small></div><div class="f-m">Mantenimento e prestazione<small>apr-set</small></div><div class="f-t">Transizione<small>ott</small></div></div>`,
    macro: () => barre([['Proteine', 2.0, 'c3', '2,0 g/kg (costruzione)'], ['Proteine', 2.4, 'c4', '2,4 g/kg (definizione)'], ['Grassi', 1.0, 'c1', '20-30% kcal'], ['Carboidrati', 3, 'c2', 'il resto']], 3)
  };

  const piramide = (livelli, titolo) => `<div class="bb-piramide" aria-label="${esc(titolo)}">${livelli.slice().reverse().map((l, i, a) => `<div style="--l:${a.length - i}" class="bb-livello"><span>${a.length - i}</span>${esc(l)}</div>`).join('')}</div>`;

  el.innerHTML = `
    <section class="bb-testa">
      <h2>Fondamenti di Body Building</h2>
      <p>I concetti che reggono il tuo piano, in ordine d'importanza. Sotto ogni regola, il motivo e la fonte.</p>
      <div class="bb-due">
        <div><h3>Allenamento</h3>${piramide(PIRAMIDE_ALLENAMENTO, 'Piramide dell\'allenamento')}</div>
        <div><h3>Alimentazione</h3>${piramide(PIRAMIDE_NUTRIZIONE, 'Piramide dell\'alimentazione')}</div>
      </div>
      <p class="bb-didascalia">Dalla base alla punta: un livello conta più di tutti quelli sopra (The Muscle and Strength Pyramid).</p>
    </section>
    <nav class="bb-indice">${SEZIONI.map(s => `<a href="#bb-${s.id}">${esc(s.titolo)}</a>`).join('')}</nav>
    <div class="bb-griglia">${SEZIONI.map(s => `
      <section class="bb-sezione" id="bb-${s.id}">
        <h3>${esc(s.titolo)}</h3>
        <p class="bb-regola">${esc(s.regola)}</p>
        ${s.grafico ? `<div class="bb-grafico">${GRAFICI[s.grafico]()}</div>` : ''}
        <ul>${s.punti.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      </section>`).join('')}</div>
    <section class="bb-fonti"><h3>Fonti</h3><ol>${FONTI.map(f => `<li>${esc(f)}</li>`).join('')}</ol></section>`;
  el.addEventListener('click', ev => {
    const a = ev.target.closest('.bb-indice a');
    if (!a) return;
    ev.preventDefault();
    const t = document.getElementById(a.getAttribute('href').slice(1));
    if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // il link a Mira Ricettario segue l'host da cui apri MirabiWatt (LAN o Tailscale)
  const r = document.getElementById('mw-ricettario');
  if (r && location.hostname) r.href = `${location.protocol}//${location.hostname}:8100/`;
})();

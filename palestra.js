/* MirabiWatt · logica dell'app di allenamento in palestra (19/10/2026). Pura, senza DOM né rete: proposta del carico
 * dallo storico (doppia progressione), sessione precompilata, riepilogo, ultima volta di ogni esercizio.
 * Nel browser è `Palestra`; nel server la usa palestra-store.js. */
(function (root) {
  'use strict';
  // passo di carico proposto quando chiudi tutte le serie al massimo delle ripetute
  const INCREMENTI = { manubri: 2, bilanciere: 2.5, cavo: 2.5, macchina: 5, corpo: 0 };
  const fmtKg = k => String(Math.round(k * 10) / 10).replace('.', ',');
  const UNITA_KG = { manubri: 'kg per manubrio', bilanciere: 'kg totali, bilanciere compreso', cavo: 'kg', macchina: 'kg', elastico: 'kg dell\'elastico' };

  /** { kg, nota } per un esercizio { attrezzo, reps: [min, max], serie } dato l'ultima volta { data, serie: [{kg, reps}] }. */
  function proposta(es, ultimo) {
    const passo = INCREMENTI[es.attrezzo] || 0;
    if (!ultimo || !ultimo.serie || !ultimo.serie.length) {
      // 19/10/2026 notte: ritorno dopo ~2 anni di stop. Si parte dal basso dell'intervallo prudente della scheda e si
      // corregge serie per serie col RIR (Pyramid: scegli il carico della 1ª serie, poi aggiusta).
      if (passo && es.partenza) {
        const [a, b] = es.partenza, unita = UNITA_KG[es.attrezzo] || 'kg';
        return { kg: a, nota: `Prima volta: parti da ${fmtKg(a)}-${fmtKg(b)} ${unita}. Se arrivi in cima alle ripetizioni e ne avresti ancora più di ${es.rir || 'qualche'} in canna (RIR), sali alla serie dopo; se non arrivi al minimo, scendi.` };
      }
      return { kg: null, nota: passo ? 'Prima volta: scegli un carico che ti lascia le ripetizioni in canna indicate.' : 'Prima volta: tecnica pulita, senza fretta.' };
    }
    const max = es.reps[1], kgUltimo = Math.max(...ultimo.serie.map(s => s.kg || 0));
    const tutte = ultimo.serie.length >= es.serie && ultimo.serie.every(s => s.reps >= max);
    if (!passo) return { kg: null, nota: tutte ? 'Hai chiuso tutto al massimo: rallenta la discesa o aggiungi 2 ripetizioni.' : 'Cerca una ripetizione in più dell\'ultima volta.' };
    if (tutte) return { kg: kgUltimo + passo, nota: `Ultima volta tutte le serie a ${max}: sali a ${fmtKg(kgUltimo + passo)} kg.` };
    return { kg: kgUltimo || null, nota: `Stesso carico, ${fmtKg(kgUltimo)} kg: cerca una ripetizione in più.` };
  }

  // 19/10/2026 notte: serie di avvicinamento come righe vere (non contano nello storico). Muscolo ancora freddo:
  // 2 sui multiarticolari (50%×10, 75%×5), 1 sugli isolamenti (50%×10); muscolo già caldo: 1 sui multiarticolari, 0 sugli
  // isolamenti. Corpo libero: niente.
  function avvicinamenti(es, caldo) {
    if (es.attrezzo === 'corpo' || !INCREMENTI[es.attrezzo]) return [];
    const multi = es.tipo === 'composto' || es.tipo === 'gambe';
    if (multi) return caldo ? [{ pct: 0.75, reps: 5, fatta: false }] : [{ pct: 0.5, reps: 10, fatta: false }, { pct: 0.75, reps: 5, fatta: false }];
    return caldo ? [] : [{ pct: 0.5, reps: 10, fatta: false }];
  }
  const muscolo = es => String(es.gruppo || es.id).split(/[ ,]/)[0].toLowerCase();

  /** kg di una serie di avvicinamento: percentuale del carico vero, arrotondata al passo dell'attrezzo. */
  function kgAvvicinamento(es, kg, pct) {
    if (kg == null) return null;
    const passo = INCREMENTI[es.attrezzo] || 1;
    let x = Math.round(kg * pct / passo) * passo;
    if (es.attrezzo === 'bilanciere') x = Math.max(20, x);
    return Math.max(passo, Math.round(x * 10) / 10);
  }

  /** Il prossimo passo dell'esercizio, scritto per intero: { tipo: avvicinamento|serie|finito, indice, testo }. */
  function prossimoPasso(e) {
    const av = e.avvicinamento || [], i = av.findIndex(a => !a.fatta);
    if (i >= 0) {
      const kg = kgAvvicinamento(e, e.serie[0] && e.serie[0].kg, av[i].pct);
      return { tipo: 'avvicinamento', indice: i, kg, testo: `Avvicinamento ${i + 1} di ${av.length}: ${kg != null ? fmtKg(kg) + ' kg' : (av[i].pct === 0.5 ? 'metà carico' : 'tre quarti del carico')} × ${av[i].reps}. Leggero, non conta: scalda muscolo e tecnica.` };
    }
    const j = e.serie.findIndex(x => !x.fatta);
    if (j >= 0) {
      const x = e.serie[j], quanto = e.unita === 's' ? `${x.reps} secondi` : `${x.kg != null ? fmtKg(x.kg) + ' kg × ' : ''}${e.repsTesto}`;
      return { tipo: 'serie', indice: j, testo: `Serie ${j + 1} di ${e.serie.length} (vera): ${quanto}. Fermati quando ne avresti ancora ${e.rir} in canna.` };
    }
    return { tipo: 'finito', indice: -1, testo: 'Esercizio finito: passa al prossimo.' };
  }

  /** La sessione da compilare: kg dalla proposta, ripetizioni dell'ultima volta (o il minimo dell'intervallo). */
  function nuovaSessione(piano, ultimi, adessoISO) {
    const caldi = new Set();
    return {
      id: adessoISO, data: adessoISO.slice(0, 10), inizio: adessoISO, seduta: piano.seduta, schema: piano.schema, indice: -1,
      esercizi: piano.esercizi.map(es => {
        const u = (ultimi || {})[es.id], p = proposta(es, u), m = muscolo(es), av = avvicinamenti(es, caldi.has(m));
        caldi.add(m);
        return {
          ...es, ultimo: u || null, proposta: p, avvicinamento: av,
          serie: Array.from({ length: es.serie }, (_, i) => ({ kg: p.kg, reps: (u && u.serie[i] && u.serie[i].reps) || es.reps[0], fatta: false }))
        };
      })
    };
  }

  function riepilogo(sessione, fineISO) {
    let serieFatte = 0, kg = 0, esercizi = 0;
    for (const e of sessione.esercizi) {
      const fatte = e.serie.filter(s => s.fatta);
      if (fatte.length) esercizi++;
      serieFatte += fatte.length;
      kg += fatte.reduce((t, s) => t + (e.unita === 's' ? 0 : (s.kg || 0) * (s.reps || 0)), 0);
    }
    const durataMin = Math.round((new Date(fineISO) - new Date(sessione.inizio)) / 60000);
    return { serieFatte, esercizi, kg: Math.round(kg), durataMin };
  }

  /** 04/11/2026: come è stata fatta una seduta salvata, da mostrare in Oggi: solo esercizi e serie fatte, una riga di testo ciascuno. */
  function dettaglioSessione(s) {
    if (!s) return null;
    const esercizi = (s.esercizi || []).map(e => {
      const fatte = (e.serie || []).filter(x => x.fatta);
      const testo = fatte.map(x => e.unita === 's' ? `${x.reps} s` : x.kg == null ? `${x.reps} rip` : `${fmtKg(x.kg)} kg × ${x.reps}`).join(', ');
      return { nome: e.nome || e.id, testo, serie: fatte.length };
    }).filter(e => e.serie > 0);
    const durataMin = s.inizio && s.fine ? Math.round((new Date(s.fine) - new Date(s.inizio)) / 60000) : null;
    return { titolo: s.seduta, schema: s.schema || '', data: s.data, durataMin, serieFatte: esercizi.reduce((t, e) => t + e.serie, 0), esercizi, note: s.note || '' };
  }

  /** { idEsercizio: { data, serie: [{kg, reps}] } } dalla sessione più recente con almeno una serie fatta. */
  function ultimiDaStorico(sessioni) {
    const out = {};
    const ordinate = [...sessioni].sort((a, b) => (a.data + a.id).localeCompare(b.data + b.id));
    for (const s of ordinate) for (const e of s.esercizi || []) {
      const fatte = (e.serie || []).filter(x => x.fatta).map(x => ({ kg: x.kg, reps: x.reps }));
      if (fatte.length) out[e.id] = { data: s.data, serie: fatte };
    }
    return out;
  }

  const api = { INCREMENTI, proposta, avvicinamenti, nuovaSessione, riepilogo, dettaglioSessione, ultimiDaStorico, kgAvvicinamento, prossimoPasso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Palestra = api;
})(typeof window !== 'undefined' ? window : this);

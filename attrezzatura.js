/* MirabiWatt · Attrezzatura (13/10/2026): bici, componenti montati e promemoria di manutenzione dal gear di intervals.icu
 * (che lo sincronizza da Strava). Logica pura: la usa attrezzatura-ui.js e i test in node. */
(function (radice) {
  'use strict';
  const TIPI = { Bike: 'Bici', Shoes: 'Scarpe da corsa', Chain: 'Catena', Tyre: 'Copertoni', BrakePads: 'Pastiglie', Brake: 'Dischi freno',
    Cassette: 'Pacco pignoni', Wheelset: 'Ruote', Battery: 'Batterie', CyclingShoes: 'Scarpe bici', Accessories: 'Accessori',
    Trainer: 'Rulli', Saddle: 'Sella', Chainring: 'Corone', Pedals: 'Pedali', Helmet: 'Casco', PowerMeter: 'Misuratore di potenza' };
  // si consumano con i km: solo per questi la durata media delle sostituzioni ha senso
  const CONSUMABILI = new Set(['Chain', 'Tyre', 'BrakePads', 'Cassette', 'Chainring']);
  const SETTIMANE_RECENTI = 6; // kmRecenti arriva dagli ultimi 42 giorni

  const tipo = t => TIPI[t] || t;
  const stato = p => (p >= 100 ? 'scaduto' : p >= 80 ? 'presto' : 'ok');
  const PESO = { scaduto: 2, presto: 1, ok: 0 };

  function promemoria(p, kmSettimana) {
    const percento = Math.round((Number(p.percento) || 0) * 10) / 10;
    const out = { ...p, percento, stato: stato(percento), kmMancanti: null, giorniMancanti: null, settimane: null };
    if (p.kmSoglia > 0) {
      out.kmMancanti = Math.round(p.kmSoglia - (p.kmUsati || 0));
      out.settimane = out.kmMancanti <= 0 ? 0 : kmSettimana > 0 ? Math.round(out.kmMancanti / kmSettimana) : null;
    }
    if (p.giorniSoglia > 0) out.giorniMancanti = Math.round(p.giorniSoglia - (p.giorniUsati || 0));
    return out;
  }
  const urgenza = c => Math.max(-1, ...c.promemoria.map(p => p.percento));

  function vista(dati) {
    const gear = (dati && dati.gear) || [], kmRecenti = (dati && dati.kmRecenti) || {};
    const perId = new Map(gear.map(x => [x.id, x]));
    const componenti = gear.filter(x => x.componente);

    // storico delle sostituzioni per tipo: durata media dei pezzi ritirati
    const storico = [];
    for (const t of [...new Set(componenti.map(c => c.tipo))]) {
      const pezzi = componenti.filter(c => c.tipo === t && c.ritiro).sort((a, b) => String(b.ritiro).localeCompare(String(a.ritiro)));
      if (!pezzi.length) continue;
      const kmMedi = CONSUMABILI.has(t) && pezzi.length >= 2 ? Math.round(pezzi.reduce((s, c) => s + c.km, 0) / pezzi.length) : null;
      const attivo = componenti.filter(c => c.tipo === t && !c.ritiro).sort((a, b) => b.km - a.km)[0] || null;
      storico.push({ tipo: t, etichetta: tipo(t), pezzi: pezzi.map(c => ({ id: c.id, nome: c.nome, dal: c.acquisto, al: c.ritiro, km: c.km })), kmMedi,
        attivo, vitaUsata: attivo && kmMedi ? Math.round(attivo.km / kmMedi * 100) : null });
    }
    const mediaTipo = new Map(storico.map(s => [s.tipo, s.kmMedi]));

    const telaio = gear.filter(x => !x.componente);
    const montati = new Set(telaio.flatMap(b => b.componenti || []));
    const conComponenti = b => {
      const kmSettimana = Math.round((kmRecenti[b.id] || 0) / SETTIMANE_RECENTI);
      const comp = (b.componenti || []).map(id => perId.get(id)).filter(c => c && !c.ritiro)
        .map(c => ({ ...c, etichetta: tipo(c.tipo), kmMediTipo: mediaTipo.get(c.tipo) || null, promemoria: (c.promemoria || []).map(p => promemoria(p, kmSettimana)) }))
        .sort((x, y) => urgenza(y) - urgenza(x) || y.km - x.km);
      return { ...b, etichetta: tipo(b.tipo), kmSettimana, kmRecenti: kmRecenti[b.id] || 0, componenti: comp };
    };
    const attive = telaio.filter(b => !b.ritiro).map(conComponenti);
    const bici = attive.filter(b => b.tipo === 'Bike').sort((x, y) => y.kmRecenti - x.kmRecenti || y.km - x.km);
    const altra = attive.filter(b => b.tipo !== 'Bike').sort((x, y) => y.km - x.km);

    const avvisi = [], visti = new Set();
    for (const b of bici.concat(altra)) for (const c of b.componenti) for (const p of c.promemoria) {
      if (p.stato === 'ok' || visti.has(c.id + '/' + p.id + '/' + p.nome)) continue;
      visti.add(c.id + '/' + p.id + '/' + p.nome);
      avvisi.push({ bici: b.nome, componente: c, promemoria: p, stato: p.stato });
    }
    avvisi.sort((x, y) => PESO[y.stato] - PESO[x.stato] || y.promemoria.percento - x.promemoria.percento);

    return { bici, altra, ritirate: telaio.filter(b => b.ritiro).map(b => ({ ...b, etichetta: tipo(b.tipo) })), avvisi, storico,
      nonMontati: componenti.filter(c => !c.ritiro && !montati.has(c.id)).map(c => ({ ...c, etichetta: tipo(c.tipo) })) };
  }

  const Gear = { tipo, stato, promemoria, vista, TIPI };
  if (typeof module !== 'undefined' && module.exports) module.exports = Gear;
  else radice.Gear = Gear;
})(typeof window !== 'undefined' ? window : globalThis);

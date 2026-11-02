/* MirabiWatt · Analisi FTP e Fitness (14/10/2026). Logica pura: migliori sforzi dalla curva di potenza, profilo di
 * potenza sulla scala di Coggan (uomini, W/kg: intervals.icu usa i percentili del suo database, che da fuori non si
 * leggono), fasce della Forma come intervals.icu, serie Fitness/Fatica con la previsione dal piano (calendario.js),
 * periodi rapidi. Nel browser è `Analisi`. */
(function (root) {
  'use strict';
  const DURATE = [[1, '1s'], [5, '5s'], [60, '60s'], [180, '3m'], [300, '5m'], [600, '10m'], [720, '12m'], [1200, '20m']];
  const tondo = x => Math.round(x * 10) / 10;

  /** I migliori sforzi alle durate della tabella Best Efforts: { label, secs, watts, wkg } (null se la durata manca). */
  function migliori(curva) {
    return DURATE.map(([secs, label]) => {
      const i = (curva.secs || []).indexOf(secs);
      return { label, secs, watts: i < 0 ? null : curva.watts[i], wkg: i < 0 || !curva.wkg ? null : Math.round(curva.wkg[i] * 100) / 100 };
    });
  }

  // tabella di Coggan (Allen & Coggan, uomini): W/kg del più basso («non allenato») e del più alto («livello mondiale»)
  const COGGAN = [['s5', '5s', 10.17, 25.18], ['m1', '1m', 5.64, 11.5], ['m5', '5m', 2.33, 7.6], ['ftp', 'FTP', 1.86, 6.4]];
  const CATEGORIE = ['Livello mondiale', 'Eccezionale', 'Eccellente', 'Molto buono', 'Buono', 'Discreto', 'Sufficiente', 'Principiante', 'Non allenato'];
  /** Il profilo di potenza: per 5s, 1m, 5m, FTP il livello (0-100 lungo la scala di Coggan) e la categoria; poi il tipo di ciclista. */
  function profilo(wkg) {
    const voci = COGGAN.map(([k, label, min, max]) => {
      const x = wkg[k], livello = x == null ? null : Math.round(Math.max(0, Math.min(1, (x - min) / (max - min))) * 1000) / 10;
      return { k, label, wkg: x, livello, categoria: livello == null ? '' : CATEGORIE[Math.min(8, Math.floor((100 - livello) / 100 * 9))] };
    });
    const l = voci.map(v => v.livello).filter(v => v != null);
    let tipo = '';
    if (l.length === 4) {
      const max = Math.max(...l), i = l.indexOf(max);
      tipo = max - Math.min(...l) < 15 ? 'Completo (all rounder)' : i <= 1 ? 'Velocista' : i === 2 ? 'Puncheur' : 'Passista';
    }
    return { voci, tipo };
  }

  // fasce della Forma (Fitness − Fatica) come intervals.icu
  const ZONE = [['transizione', 'Transizione', 20], ['fresco', 'Fresco', 5], ['grigia', 'Zona grigia', -10], ['ottimale', 'Ottimale', -30], ['rischio', 'Rischio alto', -Infinity]];
  function zonaForma(f) {
    const z = ZONE.find(([, , soglia], i) => (i === 0 ? f > soglia : f >= soglia)) || ZONE[ZONE.length - 1];
    return { id: z[0], nome: z[1] };
  }

  /** La serie del grafico Fitness: i giorni veri ({data, ctl, atl, carico}) e, dopo l'ultimo, la previsione con il TSS del
   *  piano fino a `fine`. Ogni punto: { data, ctl, atl, form, carico, previsto }. */
  function serieFitness(giorni, oggi, fine) {
    const veri = (giorni || []).filter(g => g.ctl != null && g.atl != null).sort((a, b) => a.data.localeCompare(b.data));
    const out = veri.map(g => ({ data: g.data, ctl: g.ctl, atl: g.atl, form: tondo(g.ctl - g.atl), carico: g.carico || 0, previsto: false }));
    if (!veri.length) return out;
    const ultimo = veri[veri.length - 1];
    let ctl = ultimo.ctl, atl = ultimo.atl;
    for (let d = addDays(parseISO(ultimo.data), 1); fmtISO(d) <= fine; d = addDays(d, 1)) {
      const data = fmtISO(d), tss = Cal.tssDelGiorno(data);
      ctl += (tss - ctl) / 42; atl += (tss - atl) / 7;
      out.push({ data, ctl: tondo(ctl), atl: tondo(atl), form: tondo(ctl - atl), carico: tss, previsto: true });
    }
    return out;
  }

  const mesi = (iso, n) => { const d = parseISO(iso); return fmtISO(new Date(d.getFullYear(), d.getMonth() + n, d.getDate())); };
  /** I periodi rapidi della pagina Fitness. */
  function periodo(k, oggi) {
    if (k === 'stagione') return { start: SEASON.start < oggi ? SEASON.start : mesi(oggi, -1), end: oggi };
    if (k === '42g') return { start: fmtISO(addDays(parseISO(oggi), -41)), end: oggi };
    if (k === '1m') return { start: mesi(oggi, -1), end: oggi };
    if (k === '6m') return { start: mesi(oggi, -6), end: oggi };
    if (k === '1a') return { start: mesi(oggi, -12), end: oggi };
    if (k === 'prossimo') return { start: fmtISO(addDays(parseISO(oggi), -14)), end: mesi(oggi, 1) };
    return { start: mesi(oggi, -6), end: oggi };
  }

  const Analisi = { DURATE, migliori, profilo, CATEGORIE, zonaForma, ZONE, serieFitness, periodo };
  root.Analisi = Analisi;
  if (typeof module !== 'undefined' && module.exports) module.exports = Analisi;
})(typeof window !== 'undefined' ? window : globalThis);

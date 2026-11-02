/* MirabiWatt · zone di potenza e Tools (14/10/2026). Logica pura, nessun DOM. Nel browser è `Strumenti`.
 * - zone(ftp, percentuali, nomi): le zone in watt dalla FTP attuale (percentuali e nomi di intervals.icu, o Coggan);
 * - confrontoFtp(ftp, eftp): FTP impostata contro eFTP stimata dalla curva di potenza;
 * - durataSopraCp(P, CP, W'): modello CP/W', quanti secondi reggi sopra il CP;
 * - potenza / velocita: fisica del moto (stessi coefficienti dei Tools di prima: CdA 0,32, Crr 0,004, rendimento 97%);
 * - salita, idratazione: le calcolatrici dei Tools. */
(function (root) {
  'use strict';
  const NOMI_IT = { 'active recovery': 'Recupero attivo', endurance: 'Resistenza', tempo: 'Tempo', threshold: 'Soglia', 'vo2 max': 'VO2max', vo2max: 'VO2max',
    anaerobic: 'Anaerobica', neuromuscular: 'Neuromuscolare', 'sweet spot': 'Sweet spot' };
  const COGGAN = [55, 75, 90, 105, 120, 150, 999];
  const NOMI_COGGAN = ['Recupero attivo', 'Resistenza', 'Tempo', 'Soglia', 'VO2max', 'Anaerobica', 'Neuromuscolare'];

  function zone(ftp, perc = COGGAN, nomi = NOMI_COGGAN) {
    const p = perc && perc.length ? perc : COGGAN, n = nomi && nomi.length === p.length ? nomi : NOMI_COGGAN;
    return p.map((x, i) => ({ n: `Z${i + 1}`, nome: NOMI_IT[String(n[i]).toLowerCase()] || n[i], daPerc: i ? p[i - 1] : 0, aPerc: x >= 999 ? null : x,
      da: i ? Math.round(p[i - 1] / 100 * ftp) + 1 : 0, a: x >= 999 ? null : Math.round(x / 100 * ftp) }));
  }

  function confrontoFtp(ftp, eftp) {
    const diff = (eftp - ftp) / ftp * 100;
    return { diff, stato: diff > 3 ? 'sopra' : diff < -3 ? 'sotto' : 'ok' };
  }

  const durataSopraCp = (p, cp, wPrime) => (p > cp ? wPrime / (p - cp) : Infinity);

  const G = 9.81, RHO = 1.225, CDA = 0.32, CRR = 0.004, EFF = 0.97;
  /** Potenza (W) per andare a v km/h su una pendenza in % con la massa di atleta + bici. */
  function potenza(vKmh, pendenza, massa) {
    const v = vKmh / 3.6, rotolamento = massa * G * CRR * v, aero = 0.5 * RHO * CDA * v ** 3, gravita = massa * G * Math.sin(Math.atan(pendenza / 100)) * v;
    const totale = Math.max(0, (rotolamento + aero + gravita) / EFF);
    return { totale, rotolamento, aero, gravita };
  }
  /** Velocità (km/h) con quella potenza (bisezione). */
  function velocita(watt, pendenza, massa) {
    let lo = 0.1, hi = 130;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (potenza(m, pendenza, massa).totale > watt) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }

  const LIVELLI_VAM = [['Cicloturista', 600], ['Amatore', 800], ['Allenato', 1000], ['Granfondista', 1200], ['Élite', 1400], ['Professionista', 1600]];
  /** Una salita: pendenza, velocità, tempo e VAM alla potenza scelta; quanto la reggi sopra il CP; la tabella dei livelli. */
  function salita({ km, dislivello, massa, watt, cp, wPrime, massaAtleta }) {
    const pendenza = dislivello / (km * 1000) * 100, v = velocita(watt, pendenza, massa), tempoOre = km / v;
    const reggi = cp && wPrime ? durataSopraCp(watt, cp, wPrime) : Infinity;
    const livelli = LIVELLI_VAM.map(([nome, vam]) => { const t = dislivello / vam, w = potenza(km / t, pendenza, massa).totale;
      return { nome, vam, tempoOre: t, watt: Math.round(w), wkg: massaAtleta ? Math.round(w / massaAtleta * 100) / 100 : null }; });
    return { pendenza: Math.round(pendenza * 10) / 10, velocita: v, tempoOre, vam: Math.round(dislivello / tempoOre), reggi, esaurito: tempoOre * 3600 > reggi, livelli };
  }

  /** La borraccia: maltodestrine e fruttosio nel rapporto scelto, concentrazione in %, tonicità; al massimo metà del volume. */
  function idratazione({ ratio = '2:1', volume = 750, carbo = 60, sale = 1 }) {
    const max = volume * 0.5, c = Math.min(Math.max(0, carbo), max);
    const malto = ratio === '2:1' ? c * 2 / 3 : c / 1.8, fruttosio = ratio === '2:1' ? c / 3 : malto * 0.8;
    const conc = Math.round(c / volume * 1000) / 10;
    const tonicita = conc < 6 ? 'Ipotonica' : conc <= 8 ? 'Isotonica' : conc <= 15 ? 'Ipertonica' : 'Gel (molto concentrata)';
    return { carbo: c, limitato: carbo > max, max, malto, fruttosio, sale, conc, tonicita };
  }

  const Strumenti = { zone, confrontoFtp, durataSopraCp, potenza, velocita, salita, idratazione, LIVELLI_VAM };
  root.Strumenti = Strumenti;
  if (typeof module !== 'undefined' && module.exports) module.exports = Strumenti;
})(typeof window !== 'undefined' ? window : globalThis);

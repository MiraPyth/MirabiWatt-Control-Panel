/* MirabiWatt Palestra · avanzamento della seduta (02/11/2026). Pura, sopra la logica di MirabiWatt
 * (palestra.js, copiata nell'app come `Palestra`): un passo alla volta, avvicinamenti compresi. */
(function (root) {
  'use strict';
  const P = () => (typeof Palestra !== 'undefined' ? Palestra : root.Palestra);
  const REC_AVVICINAMENTO = 60;

  /** { iEs, passo, finita }: l'esercizio in corso e il suo prossimo passo. */
  function posizione(s) {
    for (let i = 0; i < s.esercizi.length; i++) {
      const passo = P().prossimoPasso(s.esercizi[i]);
      if (passo.tipo !== 'finito') return { iEs: i, passo, finita: false };
    }
    return { iEs: -1, passo: null, finita: true };
  }

  /** Segna fatto il passo corrente. { recSec, esercizioFinito } per il timer di recupero. */
  function segna(s) {
    const { iEs, passo, finita } = posizione(s);
    if (finita) return { recSec: 0, esercizioFinito: true };
    const e = s.esercizi[iEs];
    if (passo.tipo === 'avvicinamento') {
      e.avvicinamento[passo.indice].fatta = true;
      return { recSec: REC_AVVICINAMENTO, esercizioFinito: false };
    }
    e.serie[passo.indice].fatta = true;
    return { recSec: e.recSec || 90, esercizioFinito: P().prossimoPasso(e).tipo === 'finito' };
  }

  /** Cambia kg o ripetizioni della serie in corso; i kg valgono anche per le serie dopo non ancora fatte. */
  function aggiusta(s, campo, verso) {
    const { iEs, finita } = posizione(s);
    if (finita) return;
    const e = s.esercizi[iEs], j = e.serie.findIndex(x => !x.fatta);
    if (j < 0) return;
    if (campo === 'reps') { e.serie[j].reps = Math.max(0, (e.serie[j].reps || 0) + verso); return; }
    const passo = P().INCREMENTI[e.attrezzo] || 1;
    const kg = Math.max(0, Math.round(((e.serie[j].kg || 0) + verso * passo) * 10) / 10);
    for (let k = j; k < e.serie.length; k++) if (!e.serie[k].fatta) e.serie[k].kg = kg;
  }

  /** Le righe di un esercizio, ognuna con i suoi kg e le sue ripetizioni: prima gli avvicinamenti, poi le serie.
   *  Il kg di un avvicinamento segue il carico della prima serie finche' non lo si cambia a mano (a.kg). */
  function righe(e) {
    const av = (e.avvicinamento || []).map((a, i) => ({ tipo: 'avv', idx: i, kg: a.kg !== undefined ? a.kg : P().kgAvvicinamento(e, e.serie[0] && e.serie[0].kg, a.pct), reps: a.reps, fatta: !!a.fatta }));
    return [...av, ...e.serie.map((x, i) => ({ tipo: 'serie', idx: i, kg: x.kg, reps: x.reps, fatta: !!x.fatta }))];
  }
  const riga = (s, iEs, tipo, idx) => (tipo === 'avv' ? s.esercizi[iEs].avvicinamento : s.esercizi[iEs].serie)[idx];

  /** Cambia kg o ripetizioni di UNA riga; valori non numerici si ignorano, mai sotto zero. */
  function imposta(s, iEs, tipo, idx, campo, valore) {
    const r = riga(s, iEs, tipo, idx), v = typeof valore === 'string' ? Number(valore.replace(',', '.')) : valore;
    if (!r || valore === '' || valore == null || !Number.isFinite(v)) return;
    r[campo] = Math.max(0, campo === 'reps' ? Math.round(v) : Math.round(v * 10) / 10);
  }

  /** Conferma (o annulla, se gia' confermata) una riga qualsiasi. recSec > 0 = parte il recupero. */
  function conferma(s, iEs, tipo, idx) {
    const r = riga(s, iEs, tipo, idx), e = s.esercizi[iEs];
    if (!r) return { recSec: 0 };
    if (r.fatta) { r.fatta = false; return { recSec: 0 }; }
    if (tipo === 'avv' && r.kg === undefined) r.kg = P().kgAvvicinamento(e, e.serie[0] && e.serie[0].kg, r.pct);   // si fissa il carico fatto
    r.fatta = true;
    return { recSec: tipo === 'avv' ? REC_AVVICINAMENTO : (e.recSec || 90) };
  }

  const api = { posizione, segna, aggiusta, righe, imposta, conferma, REC_AVVICINAMENTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Seduta = api;
})(typeof window !== 'undefined' ? window : this);

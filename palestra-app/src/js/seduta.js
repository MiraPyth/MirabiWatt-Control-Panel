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

  const api = { posizione, segna, aggiusta, REC_AVVICINAMENTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Seduta = api;
})(typeof window !== 'undefined' ? window : this);

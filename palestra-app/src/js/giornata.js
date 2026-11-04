/* MirabiWatt Palestra · settimana e nutrizione (04/11/2026). Pura: la funzione che calcola il piano nutrizionale
 * (pianoNutrizione di MirabiWatt, copiata nell'app) arriva come argomento. */
(function (root) {
  'use strict';

  /** Minuti di una durata del piano: «50'», «1h15», «2h30», «60-75'» (si prende la parte bassa). */
  function minuti(dur) {
    const t = String(dur || '');
    const h = t.match(/^(\d+)\s*h\s*(\d+)?/);
    if (h) return Number(h[1]) * 60 + Number(h[2] || 0);
    const m = t.match(/^(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  /** riposo | palestra | bici: cosa si fa in quel giorno. */
  function genere(g) {
    if (!g || g.riposo) return 'riposo';
    if (String(g.zona || '').toUpperCase().includes('PALESTRA')) return 'palestra';
    return minuti(g.dur) > 0 ? 'bici' : 'riposo';
  }

  /** Tipo di giornata per la nutrizione: riposo | palestra | hit | lungo | endurance (come nel pannello). */
  function tipo(g) {
    const gen = genere(g);
    if (gen !== 'bici') return gen;
    const zona = String(g.zona || '').toUpperCase();
    if (zona.includes('HIT') || zona.includes('TEST') || zona.includes('GARA')) return 'hit';
    return minuti(g.dur) >= 150 ? 'lungo' : 'endurance';
  }

  function stato(g, oggiISO) {
    return g.data < oggiISO ? 'passato' : g.data === oggiISO ? 'oggi' : 'futuro';
  }

  function giorniA(dataISO, oggiISO) {
    return Math.round((new Date(dataISO + 'T12:00:00') - new Date(oggiISO + 'T12:00:00')) / 86400000);
  }

  /** Target e pasti del giorno, pronti da mostrare. piano(tipo, kg, opz) = pianoNutrizione di MirabiWatt. */
  function nutrizione(g, peso, fase, piano) {
    const t = tipo(g), min = minuti(g && g.dur);
    const n = piano(t, peso, { fase, minuti: min || undefined }), r = Math.round;
    return {
      tipo: t, fase, perche: n.perche, kcal: r(n.target.kcal), p: r(n.target.p), c: r(n.target.c), fat: r(n.target.fat),
      acquaL: n.consigli && n.consigli.acquaL,
      pasti: n.pasti.map(m => ({ nome: m.nome, kcal: r(m.kcal), p: r(m.p), c: r(m.c), fat: r(m.fat),
        cibi: m.cibi.map(c => ({ label: c.label, grammi: r(c.grams) })), nota: m.nota || null }))
    };
  }

  const api = { minuti, genere, tipo, stato, giorniA, nutrizione };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Giornata = api;
})(typeof window !== 'undefined' ? window : this);

// MirabiWatt · «Forza» per Analytics (11/11/2026): per ogni esercizio con un peso vero, il massimo sollevato, la migliore serie di ogni
// seduta (per l'andamento) e il massimale stimato. Pura, solo dati veri: serie non fatte, kg nulli o zero e corpo libero non contano.
const CARDINE = ['panca-piana-manubri', 'spinte-inclinata-manubri', 'lento-avanti-manubri', 'squat-bilanciere', 'stacco-rumeno-manubri',
    'lat-machine', 'rematore-petto-appoggiato', 'curl-panca-inclinata'];
const UNITA = { manubri: 'kg per manubrio', bilanciere: 'kg totali, barra compresa', cavo: 'kg', macchina: 'kg', elastico: 'kg' };
const arrotonda = x => Math.round(x * 10) / 10;

/** Massimale stimato (Epley: kg x (1 + ripetizioni/30)), solo fino a 12 ripetizioni: oltre e' una stima poco affidabile e non si da'. */
function stimaMassimale(kg, reps) {
    if (!(typeof kg === 'number' && kg > 0) || !(Number.isInteger(reps) && reps >= 1 && reps <= 12)) return null;
    return arrotonda(kg * (1 + reps / 30));
}

const migliore = (a, b) => (!a || b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a);

function forza({ sessioni = [], catalogo = {} }) {
    const per = new Map();
    for (const s of [...sessioni].sort((a, b) => (a.data + a.id).localeCompare(b.data + b.id))) {
        for (const e of s.esercizi || []) {
            const barra = typeof e.barra === 'number' && e.barra > 0 ? e.barra : 0;
            let top = null, e1 = null;
            for (const x of e.serie || []) {
                if (!x.fatta || !(typeof x.kg === 'number' && x.kg > 0)) continue;
                const kg = arrotonda(x.kg + barra);
                top = migliore(top, { kg, reps: x.reps });
                const st = stimaMassimale(kg, x.reps);
                if (st !== null && (e1 === null || st > e1)) e1 = st;
            }
            if (!top) continue;
            const v = per.get(e.id) || { id: e.id, nome: e.nome, sessioni: [] };
            v.sessioni.push({ data: s.data, kg: top.kg, reps: top.reps, e1rm: e1, conBarra: barra > 0 });
            per.set(e.id, v);
        }
    }
    const lifts = [...per.values()].map(v => {
        const c = catalogo[v.id] || {};
        const top = v.sessioni.reduce((m, x) => (!m || x.kg > m.kg || (x.kg === m.kg && x.reps >= m.reps) ? x : m), null);
        const stime = v.sessioni.map(x => x.e1rm).filter(x => x !== null);
        const conBarra = v.sessioni.some(x => x.conBarra) || c.attrezzo === 'bilanciere';
        return { id: v.id, nome: c.nome || v.nome || v.id, gruppo: c.gruppo || null, attrezzo: c.attrezzo || null,
            unita: conBarra ? UNITA.bilanciere : UNITA[c.attrezzo] || 'kg',
            massimo: { kg: top.kg, reps: top.reps, data: top.data }, e1rm: stime.length ? Math.max(...stime) : null,
            sessioni: v.sessioni.map(({ conBarra: _, ...r }) => r), volte: v.sessioni.length };
    });
    const ordine = id => { const i = CARDINE.indexOf(id); return i < 0 ? 999 : i; };
    return {
        cardine: lifts.filter(l => CARDINE.includes(l.id)).sort((a, b) => ordine(a.id) - ordine(b.id)),
        altri: lifts.filter(l => !CARDINE.includes(l.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    };
}

module.exports = { forza, stimaMassimale, CARDINE };

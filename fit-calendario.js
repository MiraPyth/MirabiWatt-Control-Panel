// MirabiWatt · calendario mensile dell'app Fit (11/11/2026). Pura: per ogni giorno del mese cio' che e' stato fatto (attivita' di intervals.icu
// e sedute di palestra salvate) e cio' che e' ancora da fare (eventi pianificati), con lo sport. Nessun dato inventato: sport sconosciuto = «altro».
const MappaMuscoli = require('./mappa-muscoli.js');
const pad = n => String(n).padStart(2, '0');
/** I muscoli piu' lavorati di una seduta fatta (stessa mappa dell'«ultimo allenamento»). */
const muscoliSessione = s => MappaMuscoli.classifica(MappaMuscoli.carico(s)).slice(0, 4).map(m => m.nome);
const SPORT = [[/weight|strength|crossfit/i, 'palestra'], [/ride|cycl/i, 'ciclismo'], [/run/i, 'corsa'], [/swim/i, 'nuoto']];
const sportDi = tipo => { const t = SPORT.find(([re]) => re.test(String(tipo || ''))); return t ? t[1] : 'altro'; };
const RIPOSO = /divano|day off|riposo/i;
const haSerieFatte = s => (s.esercizi || []).some(e => (e.serie || []).some(x => x.fatta));
const minutiTra = (a, b) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);

/** { da, a } con il primo e l'ultimo giorno di «AAAA-MM», o null se il mese non e' valido. */
function intervalloMese(mese) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(mese || ''));
    if (!m || +m[2] < 1 || +m[2] > 12) return null;
    const ultimo = new Date(+m[1], +m[2], 0).getDate();
    return { da: `${m[1]}-${m[2]}-01`, a: `${m[1]}-${m[2]}-${pad(ultimo)}` };
}

function calendarioMese({ mese, oggi, attivita = [], eventi = [], sessioni = [] }) {
    const r = intervalloMese(mese);
    if (!r) throw new Error('mese non valido (AAAA-MM)');
    const dentro = d => d >= r.da && d <= r.a;
    const ultimoGiorno = +r.a.slice(8);
    const giorni = Array.from({ length: ultimoGiorno }, (_, i) => ({ data: `${mese}-${pad(i + 1)}`, voci: [], sport: [], riposo: false }));
    const del = d => giorni.find(g => g.data === d);

    const conSeduta = new Set();
    for (const s of sessioni.filter(x => dentro(x.data) && haSerieFatte(x))) {
        conSeduta.add(s.data);
        const svolti = (s.esercizi || []).map(e => ({ nome: e.nome, serie: (e.serie || []).filter(x => x.fatta).length })).filter(e => e.nome && e.serie > 0);
        del(s.data).voci.push({ sport: 'palestra', nome: s.seduta, durataMin: minutiTra(s.inizio, s.fine), svolto: true, ...(svolti.length ? { esercizi: svolti } : {}),
            ...(muscoliSessione(s).length ? { muscoli: muscoliSessione(s) } : {}) });
    }
    for (const a of attivita.filter(x => dentro(x.date))) {
        const sport = sportDi(a.type);
        if (sport === 'palestra' && conSeduta.has(a.date)) continue;   // la seduta salvata e' la stessa cosa dell'attivita' di pesi
        del(a.date).voci.push({ sport, nome: a.name || '', durataMin: a.durationMin > 0 ? Math.round(a.durationMin) : null, svolto: true });
    }
    for (const e of eventi.filter(x => dentro(x.date))) {
        const g = del(e.date);
        if (e.categoria === 'NOTE') { if (RIPOSO.test(e.name || '')) g.riposo = true; continue; }
        const sport = sportDi(e.type);
        if (g.voci.some(v => v.svolto && v.sport === sport)) continue;   // gia' fatto
        g.voci.push({ sport, nome: e.name || '', durataMin: e.durationMin > 0 ? Math.round(e.durationMin) : null, svolto: false,
            ...(e.zone && e.zone.length ? { zone: e.zone } : {}), ...(e.esercizi && e.esercizi.length ? { esercizi: e.esercizi } : {}),
            ...(muscoliDaEsercizi(e.esercizi).length ? { muscoli: muscoliDaEsercizi(e.esercizi) } : {}) });
    }
    for (const g of giorni) g.sport = [...new Set(g.voci.map(v => v.sport))];
    return { mese, oggi, giorni };
}

/** Zone di potenza di un allenamento di intervals.icu (workout_doc.zoneTimes): [{ zona, min, watt }] delle sole zone con tempo, o null. */
function zoneDaDoc(doc) {
    const z = doc && Array.isArray(doc.zoneTimes) ? doc.zoneTimes.filter(x => x.secs > 0) : [];
    if (!z.length) return null;
    const watt = x => (x.maxWatts == null ? `oltre ${x.minWatts} W` : x.minWatts <= 1 ? `fino a ${x.maxWatts} W` : `${x.minWatts}-${x.maxWatts} W`);
    return z.map(x => ({ zona: x.id, min: Math.round(x.secs / 60), watt: watt(x) }));
}

/** Esercizi di una scheda del piano: [{ nome, serie, reps }], o null senza scheda. */
function eserciziDaScheda(scheda) {
    const e = scheda && Array.isArray(scheda.esercizi) ? scheda.esercizi : [];
    if (!e.length) return null;
    return e.map(x => ({ nome: x.nome, serie: x.serie, reps: x.unita && x.unita !== 'reps' ? `${x.repsTesto} ${x.unita}` : String(x.repsTesto),
        ...(x.gruppo ? { gruppo: x.gruppo } : {}), ...(x.rir != null ? { rir: String(x.rir) } : {}), ...(x.recSec > 0 ? { recSec: x.recSec } : {}) }));
}

/** Gruppi muscolari distinti degli esercizi, nell'ordine in cui compaiono. */
const muscoliDaEsercizi = esercizi => [...new Set((esercizi || []).map(x => x.gruppo).filter(Boolean))];

module.exports = { calendarioMese, intervalloMese, sportDi, zoneDaDoc, eserciziDaScheda };

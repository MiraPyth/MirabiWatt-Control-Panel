// MirabiWatt · calendario mensile dell'app Fit (11/11/2026). Pura: per ogni giorno del mese cio' che e' stato fatto (attivita' di intervals.icu
// e sedute di palestra salvate) e cio' che e' ancora da fare (eventi pianificati), con lo sport. Nessun dato inventato: sport sconosciuto = «altro».
const pad = n => String(n).padStart(2, '0');
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
        del(s.data).voci.push({ sport: 'palestra', nome: s.seduta, durataMin: minutiTra(s.inizio, s.fine), svolto: true });
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
        g.voci.push({ sport, nome: e.name || '', durataMin: e.durationMin > 0 ? Math.round(e.durationMin) : null, svolto: false });
    }
    for (const g of giorni) g.sport = [...new Set(g.voci.map(v => v.sport))];
    return { mese, oggi, giorni };
}

module.exports = { calendarioMese, intervalloMese, sportDi };

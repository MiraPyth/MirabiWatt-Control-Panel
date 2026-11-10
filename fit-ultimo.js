// MirabiWatt · «Allenamento recente» della Dashboard Fit (10/11/2026). Pura. L'ultimo allenamento tra le sedute di palestra salvate e le
// attivita' di intervals.icu, con SOLO le metriche pertinenti e vere: muscoli (dalle serie fatte, mappa-muscoli) per la palestra; distanza,
// potenza normalizzata e velocita' media per la bici. Calorie della palestra: stima MET dichiarata (kcalStimate). Mai numeri inventati.
const MappaMuscoli = require('./mappa-muscoli.js');

const MET_PALESTRA = 5;
const tipoDi = t => (/ride/i.test(t) ? 'ciclismo' : /run/i.test(t) ? 'corsa' : /swim/i.test(t) ? 'nuoto' : /weight|strength|crossfit/i.test(t) ? 'palestra' : 'altro');
const minutiTra = (a, b) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : 0);
const num = x => (typeof x === 'number' && isFinite(x) ? x : null);
const haSerieFatte = s => (s.esercizi || []).some(e => (e.serie || []).some(x => x.fatta));

function dallaSessione(s, pesoKg) {
    const durataMin = minutiTra(s.inizio, s.fine);
    return {
        chiave: String(s.inizio || `${s.data}T00:00`).slice(0, 16),
        tipo: 'palestra', nome: s.seduta, data: s.data, durataMin,
        kcal: pesoKg > 0 && durataMin > 0 ? Math.round(MET_PALESTRA * pesoKg * durataMin / 60) : null,
        kcalStimate: pesoKg > 0 && durataMin > 0,
        distanzaKm: null, npWatt: null, wattMedi: null, velMediaKmh: null,
        muscoli: MappaMuscoli.classifica(MappaMuscoli.carico(s)).slice(0, 6),
        fonte: 'palestra',
    };
}

function dallAttivita(a) {
    const tipo = tipoDi(String(a.type || '')), km = num(a.distanceKm), min = a.durationMin;
    return {
        chiave: `${a.date}T${a.start || '00:00'}`,
        tipo, nome: a.name || '', data: a.date, durataMin: Math.round(min),
        kcal: num(a.kcal), kcalStimate: false,
        distanzaKm: km, npWatt: tipo === 'ciclismo' ? num(a.np) : null, wattMedi: tipo === 'ciclismo' ? num(a.watt) : null,
        velMediaKmh: (tipo === 'ciclismo' || tipo === 'corsa') && km > 0 && min > 0 ? Math.round(km / (min / 60) * 10) / 10 : null,
        muscoli: [], fonte: 'intervals',
    };
}

/** L'ultimo allenamento, o null. */
function ultimoAllenamento({ sessioni = [], attivita = [], pesoKg = null }) {
    const valide = sessioni.filter(haSerieFatte);
    const giorniConSessione = new Set(valide.map(s => s.data));
    const candidati = [
        ...valide.map(s => dallaSessione(s, pesoKg)),
        ...attivita.filter(a => a.durationMin > 0 && a.type)
            .filter(a => !(tipoDi(String(a.type)) === 'palestra' && giorniConSessione.has(a.date)))   // la seduta salvata e' la stessa cosa dell'attivita' di pesi
            .map(dallAttivita),
    ];
    if (!candidati.length) return null;
    const u = candidati.reduce((m, x) => (x.chiave > m.chiave ? x : m));
    const { chiave, ...resto } = u;
    return resto;
}

module.exports = { ultimoAllenamento };

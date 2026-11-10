// MirabiWatt · obiettivi del giorno per gli anelli dell'app Fit (10/11/2026). Pura.
// PREVISTO dal piano del giorno (minuti dalla durata; calorie STIMATE: palestra = MET 5 x peso x ore, bici = FTP x fattore di
// intensita' della zona x 3,6 x ore, perche' 1 kJ meccanico ~ 1 kcal). SVOLTO dai dati veri: sedute di palestra salvate e
// attivita' di intervals.icu. Se manca un dato (FTP, peso, calorie) il campo e' null: l'app mostra «non disponibile», mai un numero inventato.
const { parseDurMin } = require('./season-plan.js');

const MET_PALESTRA = 5;
const IF_ZONA = { Z1: 0.55, Z2: 0.65, Z3: 0.8, TEMPO: 0.8, HIT: 0.85, TEST: 0.9, GARA: 0.85 };
const PESI = /weight|strength|crossfit|workout/i;
const MOVIMENTO = /ride|run|swim|walk|hike|row|ski|elliptical|stair|weight|strength|crossfit|workout|yoga|pilates/i;

const arr = x => Math.round(x);
const pct = (valore, obiettivo) => (valore != null && obiettivo > 0 ? arr(valore / obiettivo * 100) : null);
const minutiTra = (a, b) => (a && b ? Math.max(0, arr((Date.parse(b) - Date.parse(a)) / 60000)) : 0);

function previsto(giorno, pesoKg, ftp) {
    if (!giorno || giorno.riposo) return { minuti: 0, kcal: 0, fonte: 'piano' };
    const minuti = parseDurMin(giorno.dur), ore = minuti / 60, zona = String(giorno.zona || '').toUpperCase();
    let kcal = null;
    if (zona.includes('PALESTRA') || giorno.seduta) kcal = pesoKg > 0 ? arr(MET_PALESTRA * pesoKg * ore) : null;
    else if (IF_ZONA[zona] && ftp > 0) kcal = arr(ftp * IF_ZONA[zona] * 3.6 * ore);
    return { minuti, kcal, fonte: 'stima' };
}

function obiettiviGiorno({ data, giorno, attivita = [], sessioni = [], pesoKg = null, ftp = null, oreMovimentoObiettivo = null }) {
    const prev = previsto(giorno, pesoKg, ftp);
    const gym = sessioni.filter(s => s.data === data);
    let minuti = 0, kcalNote = 0, kcalNoteN = 0, kcalMancanti = 0, contate = 0, stimate = false;
    for (const s of gym) {
        const m = minutiTra(s.inizio, s.fine);
        minuti += m;
        if (pesoKg > 0 && m > 0) { kcalNote += MET_PALESTRA * pesoKg * m / 60; kcalNoteN++; stimate = true; }
    }
    for (const a of attivita) {
        if (a.date !== data || !(a.durationMin > 0) || !MOVIMENTO.test(String(a.type || ''))) continue;
        if (gym.length && PESI.test(String(a.type))) continue;           // la seduta salvata e' la stessa cosa dell'attivita' di pesi: non si somma due volte
        minuti += a.durationMin;
        contate++;
        if (typeof a.kcal === 'number') { kcalNote += a.kcal; kcalNoteN++; } else kcalMancanti++;
    }
    const kcal = kcalNoteN === 0 && (contate > 0 || gym.length > 0) ? null : arr(kcalNote);
    const svolto = { minuti: arr(minuti), kcal, kcalStimate: stimate, ...(kcalMancanti ? { kcalIncomplete: true } : {}) };
    const oreSvolte = Math.round(minuti / 60 * 100) / 100;
    const movimento = { oreSvolte, oreObiettivo: oreMovimentoObiettivo != null ? oreMovimentoObiettivo : null, fonte: 'allenamenti' };
    return {
        data, riposo: !giorno || !!giorno.riposo, previsto: prev, svolto, movimento,
        anelli: [
            { id: 'calorie', valore: svolto.kcal, obiettivo: prev.kcal, percento: pct(svolto.kcal, prev.kcal) },
            { id: 'minuti', valore: svolto.minuti, obiettivo: prev.minuti, percento: pct(svolto.minuti, prev.minuti) },
            { id: 'movimento', valore: oreSvolte, obiettivo: movimento.oreObiettivo, percento: pct(oreSvolte, movimento.oreObiettivo) },
        ],
    };
}

module.exports = { obiettiviGiorno, previsto, IF_ZONA, MET_PALESTRA };

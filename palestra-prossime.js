// MirabiWatt · prossime sedute di palestra per l'app Android (02/11/2026): l'app le scarica a casa o via Tailscale
// e in palestra si allena anche senza rete. Pura: settimane e schede arrivano come funzioni.
const giornoISO = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const lunediDi = iso => { const d = new Date(iso + 'T12:00:00'); return giornoISO(iso, -((d.getDay() + 6) % 7)); };

/** [{ data, giorno, nome, piano, fatta }] dei giorni di palestra da oggi (compreso) per `giorni` giorni. */
function prossimeSedute({ oggi, giorni, findDetailedWeek, pianoPalestra, sessioni = [] }) {
    const out = [], fatte = new Set(sessioni.map(s => `${s.data}|${s.seduta}`));
    for (let i = 0; i < giorni; i++) {
        const data = giornoISO(oggi, i), lun = lunediDi(data);
        const wk = findDetailedWeek(lun);
        const d = wk && wk.week && wk.week.days[Math.round((Date.parse(data) - Date.parse(lun)) / 86400000)];
        const piano = d && d.s ? pianoPalestra(d.s) : null;
        if (piano) out.push({ data, giorno: d.d || '', nome: d.s, piano, fatta: fatte.has(`${data}|${piano.seduta}`) });
    }
    return out;
}

module.exports = { prossimeSedute };

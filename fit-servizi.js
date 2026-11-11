// MirabiWatt · stato dei servizi collegati per la schermata Profilo dell'app Fit (11/11/2026). Pura: i controlli veri li fa server.js e passa
// qui solo l'esito. Mai chiavi, token o indirizzi: solo stato e una frase leggibile.
const dataLunga = d => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

function riassumiServizi({ garmin, intervals, strava }) {
    const g = !garmin.chiave ? { stato: 'non-configurato', dettaglio: 'Chiave Garmin non configurata sul server.' }
        : garmin.errore ? { stato: 'errore', dettaglio: garmin.errore }
        : { stato: 'collegato', dettaglio: garmin.ultimaPesata ? `Ultimo peso: ${dataLunga(garmin.ultimaPesata)}` : 'Collegato. Nessuna pesata recente.' };
    const i = intervals.ok ? { stato: 'collegato', dettaglio: 'Calendario, attività e forma.' } : { stato: 'errore', dettaglio: intervals.errore || 'intervals.icu non risponde.' };
    const s = strava.collegato ? { stato: 'collegato', dettaglio: strava.atleta ? `Atleta: ${strava.atleta}` : 'Collegato.' } : { stato: 'non-collegato', dettaglio: 'Non collegato.' };
    return { garmin: g, intervals: i, strava: s, healthConnect: { stato: 'non-disponibile', dettaglio: 'Serve uno smartwatch con dati salute: lo collegheremo più avanti.' } };
}

module.exports = { riassumiServizi };

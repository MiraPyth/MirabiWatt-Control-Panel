// MirabiWatt · client Garmin Personal API, sola lettura (10/11/2026) per l'app Fit. La chiave sta SOLO sul server
// (~/.config/mirabiwatt/garmin-api-key) e non compare mai in log, risposte o messaggi di errore. Il token dura 24 ore, non ha refresh:
// si riscambia la chiave quando manca meno di un'ora. Endpoint dal client ufficiale Garmin (vedi fit/docs/INTEGRAZIONI.md); la forma
// della risposta del peso e' stata verificata il 10/11/2026 (peso in grammi, dailyWeightSummaries[].allWeightMetrics[]).
const HOST = 'https://personal.connectapi.garmin.com';
const TOKEN_URL = `${HOST}/personalapitoken-service/personal-api/personal-api-key/token`;
const RINNOVO_PRIMA_S = 3600;

const arr = (x, dec = 0) => { const k = 10 ** dec; return Math.round(x * k) / k; };
const num = x => (typeof x === 'number' && isFinite(x) ? x : null);

/** exp (secondi) del JWT, o null. */
function scadenzaJwt(t) {
    try { const p = String(t).split('.')[1]; const e = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')).exp; return typeof e === 'number' ? e : null; } catch (e) { return null; }
}

/** [{ data, kg, grassoPct, acquaPct, muscoloKg, ossaKg, bmi, fonte, timestamp }], una per giorno (l'ultima), la piu' recente per prima. */
function normalizzaPeso(r) {
    const giorni = r && Array.isArray(r.dailyWeightSummaries) ? r.dailyWeightSummaries : [];
    const out = [];
    for (const g of giorni) {
        const valide = (g.allWeightMetrics || []).filter(m => num(m.weight) > 0);
        if (!valide.length) continue;
        const m = valide.reduce((a, b) => ((b.timestampGMT || 0) >= (a.timestampGMT || 0) ? b : a));
        out.push({
            data: g.summaryDate || m.calendarDate, kg: arr(m.weight / 1000, 2), grassoPct: num(m.bodyFat), acquaPct: num(m.bodyWater),
            muscoloKg: m.muscleMass > 0 ? arr(m.muscleMass / 1000, 1) : null, ossaKg: m.boneMass > 0 ? arr(m.boneMass / 1000, 1) : null,
            bmi: num(m.bmi), fonte: 'garmin', timestamp: m.timestampGMT || null,
        });
    }
    return out.sort((a, b) => b.data.localeCompare(a.data));
}

/** chiave: () => string|null; fetch: come quello standard; adesso: () => millisecondi. */
function creaGarmin({ chiave, fetch, adesso = () => Date.now() }) {
    let token = null, scade = 0;      // scade in secondi

    async function nuovoToken() {
        const k = chiave();
        if (!k) throw new Error('chiave Garmin non configurata sul server');
        const r = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: `ApiKey ${k}` } });
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Garmin non accetta la chiave (scaduta o eliminata)' : 'Garmin non risponde (scambio del token)');
        const t = String(await r.text()).trim();
        const e = scadenzaJwt(t);
        if (!e) throw new Error('Garmin non risponde (token non valido)');
        token = t; scade = e;
        return token;
    }
    const valido = () => token && scade - adesso() / 1000 > RINNOVO_PRIMA_S;

    async function leggi(percorso, giaRiprovato = false) {
        const t = valido() ? token : await nuovoToken();
        const r = await fetch(`${HOST}${percorso}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
        if (r.status === 401 && !giaRiprovato) { token = null; return leggi(percorso, true); }
        if (!r.ok) throw new Error(r.status === 401 ? 'Garmin non accetta la chiave (scaduta o eliminata)' : r.status === 429 ? 'Garmin: troppe richieste, riprova tra poco' : 'Garmin non risponde');
        const testo = await r.text();
        return testo && testo.trim() ? JSON.parse(testo) : null;
    }

    return {
        /** Pesate tra due date (AAAA-MM-GG, inclusive), normalizzate. */
        async peso(da, a) { return normalizzaPeso(await leggi(`/weight-service/weight/range/${da}/${a}?includeAll=true`)); },
    };
}

module.exports = { creaGarmin, normalizzaPeso, scadenzaJwt, HOST };

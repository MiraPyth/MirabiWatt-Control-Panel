// MirabiWatt · condivisione su Strava delle sedute di palestra (19/10/2026 notte, «come JEFIT»). Logica pura: l'attività
// da una seduta salvata, l'indirizzo di autorizzazione, quando rinnovare il token. Le chiamate di rete stanno in server.js;
// credenziali in .strava.env e token in .strava-token.json (entrambi 600, mai nei log).
const { rigaTesto } = require('./mappa-muscoli.js');
const REDIRECT ='http://mira-optiplex.tail2a9ecd.ts.net:3000/strava/callback';   // = «Authorization Callback Domain» dell'app Strava
const fmtKg = k => String(Math.round(k * 10) / 10).replace('.', ',');

/** Ora locale italiana «AAAA-MM-GGTHH:MM:SS» da un istante ISO (Strava vuole l'ora locale dell'attività). */
function oraLocale(iso) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`;
}

// «14 kg × 10 · 9» se il carico non cambia, «14 kg × 10 · 16 kg × 8» se cambia, «12 · 12» a corpo libero
function righe(e) {
    const f = e.serie.filter(x => x.fatta);
    if (!f.length) return null;
    const stesso = f.every(x => x.kg === f[0].kg);
    if (f[0].kg == null && stesso) return `${e.nome}: ${f.map(x => x.reps).join(' · ')}`;
    if (stesso) return `${e.nome}: ${fmtKg(f[0].kg)} kg × ${f.map(x => x.reps).join(' · ')}`;
    return `${e.nome}: ${f.map(x => (x.kg != null ? `${fmtKg(x.kg)} kg × ` : '') + x.reps).join(' · ')}`;
}

function attivitaDaSessione(s) {
    const durata = Math.max(60, Math.round((new Date(s.fine) - new Date(s.inizio)) / 1000));
    const elenco = s.esercizi.map(righe).filter(Boolean);
    const serie = s.esercizi.reduce((t, e) => t + e.serie.filter(x => x.fatta).length, 0);
    const kg = s.esercizi.reduce((t, e) => t + e.serie.filter(x => x.fatta).reduce((u, x) => u + (x.kg || 0) * (x.reps || 0), 0), 0);
    const nome = `🏋️ ${s.seduta}${s.schema ? ` · ${s.schema}` : ''}`;
    const testa = `${Math.round(durata / 60)}′ · ${serie} serie · ${Math.round(kg).toLocaleString('it-IT')} kg sollevati`;
    const muscoli = rigaTesto(s);
    const description = [testa, ...(muscoli ? [`Muscoli: ${muscoli}`] : []), '', ...elenco, ...(s.note ? ['', `Note: ${s.note}`] : []), '', 'Allenamento registrato con MirabiWatt'].join('\n');
    return { name: nome, type: 'WeightTraining', sport_type: 'WeightTraining', start_date_local: oraLocale(s.inizio), elapsed_time: durata, description, trainer: 1 };
}

function urlAutorizza(clientId) {
    const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: REDIRECT, approval_prompt: 'auto', scope: 'read,activity:write' });
    return `https://www.strava.com/oauth/authorize?${q}`;
}

/** Vero se il token manca o scade entro un minuto (secondi epoch). */
function daRinnovare(token, adessoS) {
    return !token || !token.expires_at || token.expires_at - adessoS < 60;
}

module.exports = { REDIRECT, attivitaDaSessione, urlAutorizza, daRinnovare, oraLocale };

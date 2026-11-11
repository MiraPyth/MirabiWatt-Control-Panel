// MirabiWatt · pianificare un allenamento dall'app Fit (11/11/2026). Pura: l'evento esce nel formato nativo di intervals.icu
// (testo con «- 10m 55%», «Z2 Pace»…), l'unico che intervals sincronizza poi sui dispositivi Garmin. Sintassi verificata con
// eventi di prova veri: Ride a %FTP, Run e Swim a «Zn Pace» (pace_zone), WeightTraining con durata e descrizione.
const { eventoAllenamento, SIGLA, TOGLI_SIGLA } = require('./intervals-evento.js');
const { testoDaPassi, durataTotaleSec, validaPassi } = require('./fit-passi.js');

const UID_APP = 'mirabiwatt-app-';
const SPORT = new Set(['ciclismo', 'palestra', 'corsa', 'nuoto']);
const TIPO_LIBERO = { corsa: 'Run', nuoto: 'Swim' };
const MAX_NOME = 80;
const DURATA_MAX_MIN = 480;

const dataValida = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;

/** Modelli che l'app puo' proporre: ciclismo = quelli con testo strutturato; palestra = sedute presenti nel piano corrente. */
function modelliDisponibili({ libreria, sedutePalestra, schemaPalestra, getDetail, pianoPalestra }) {
    const ciclismo = Object.keys(libreria).map(id => ({ id, d: getDetail(id) })).filter(x => x.d && x.d.icuText && x.d.totalMin > 0)
        .map(x => ({ id: x.id, nome: x.d.label || x.id, durataMin: x.d.totalMin }));
    const palestra = schemaPalestra ? sedutePalestra.map(n => ({ id: n, completo: `${n} (${schemaPalestra})` })).filter(x => pianoPalestra(x.completo))
        .map(x => { const d = getDetail(x.completo); return { id: x.id, nome: d.label || x.id, durataMin: d.totalMin || null }; }) : [];
    return { ciclismo, palestra };
}

/** Testo nativo per corsa e nuoto: zona di passo; sopra i 30 minuti con 10' di riscaldamento e 5' di defaticamento in Z1. */
function testoLibero({ durataMin, zona }) {
    if (durataMin < 30) return `- ${durataMin}m Z${zona} Pace`;
    return `Warmup\n- 10m Z1 Pace\n\n- ${durataMin - 15}m Z${zona} Pace\n\nCooldown\n- 5m Z1 Pace`;
}

const pulisciNome = n => String(n || '').replace(TOGLI_SIGLA, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME - SIGLA.length - 1).trim();

/** L'evento da inviare a intervals.icu. Rifiuta con un errore dal messaggio chiaro ogni input fuori misura. */
function eventoNuovo({ data, sport, modello, libero, personalizzato, libreria, sedutePalestra, schemaPalestra, getDetail, pianoPalestra, ftp, cp, casuale = () => Math.random().toString(36).slice(2, 8) }) {
    if (!dataValida(data)) throw new Error('data non valida (AAAA-MM-GG)');
    if (!SPORT.has(sport)) throw new Error('sport non valido');
    const idEsterno = `${UID_APP}${data}-${sport}-${casuale()}`;   // intervals.icu tiene il proprio uid: il nostro sta in external_id e riconosce gli eventi dell'app

    if ((sport === 'ciclismo' || sport === 'palestra') && !personalizzato) {
        const m = modelliDisponibili({ libreria, sedutePalestra, schemaPalestra, getDetail, pianoPalestra })[sport].find(x => x.id === modello);
        if (!m) throw new Error('modello non disponibile');
        const nomeCompleto = sport === 'palestra' ? `${modello} (${schemaPalestra})` : modello;
        const detail = getDetail(nomeCompleto);
        const e = eventoAllenamento({ s: nomeCompleto, zone: sport === 'palestra' ? 'Palestra' : '', note: '' }, data, detail);
        const { uid, ...senzaUid } = e;
        return { ...senzaUid, external_id: idEsterno };
    }

    if (personalizzato) {
        if (sport === 'palestra') throw new Error('sport non valido per un allenamento a passi');
        const nome = pulisciNome(personalizzato.nome);
        if (!nome) throw new Error('nome mancante');
        const errore = validaPassi(personalizzato.passi, sport);
        if (errore) throw new Error(errore);
        return { category: 'WORKOUT', type: sport === 'ciclismo' ? 'Ride' : TIPO_LIBERO[sport], start_date_local: `${data}T00:00:00`, name: `${SIGLA} ${nome}`,
            external_id: idEsterno, moving_time: durataTotaleSec(personalizzato.passi), description: testoDaPassi(personalizzato.passi, sport),
            ...(sport === 'ciclismo' && personalizzato.indoor ? { indoor: true } : {}) };
    }

    if (!libero || typeof libero !== 'object') throw new Error('serve un allenamento libero (nome, durata, zona)');
    const nome = pulisciNome(libero.nome);
    if (!nome) throw new Error('nome mancante');
    const durataMin = Number(libero.durataMin), zona = Number(libero.zona);
    if (!Number.isInteger(durataMin) || durataMin < 5 || durataMin > DURATA_MAX_MIN) throw new Error(`durata tra 5 e ${DURATA_MAX_MIN} minuti`);
    if (!Number.isInteger(zona) || zona < 1 || zona > 5) throw new Error('zona tra 1 e 5');
    return { category: 'WORKOUT', type: TIPO_LIBERO[sport], start_date_local: `${data}T00:00:00`, name: `${SIGLA} ${nome}`, external_id: idEsterno,
        moving_time: durataMin * 60, description: testoLibero({ durataMin, zona }) };
}

/** Identificativo scelto dall'app per una richiesta (6-16 caratteri minuscoli o cifre), o null: serve a ripetere una richiesta senza creare doppioni. */
const idRichiesta = r => (/^[a-z0-9]{6,16}$/.test(String(r || '')) ? String(r) : null);

/** L'evento gia' creato con quell'external_id tra quelli del giorno, o null. */
const trovaEsistente = (eventi, externalId) => (Array.isArray(eventi) ? eventi.find(e => e && e.external_id === externalId) || null : null);

module.exports = { modelliDisponibili, eventoNuovo, testoLibero, idRichiesta, trovaEsistente, UID_APP };

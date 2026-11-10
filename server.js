#!/usr/bin/env node
// MirabiWatt local server: serves the static panel and proxies intervals.icu
// so the API key never reaches the browser.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { getWorkoutDetail, baseName, pianoPalestra } = require('./workout-library.js');
const { SEASON, usaPiano, findDetailedWeek, findSummaryPhase, faseNutrizione, fmtISO, addDays, mondayOf, parseISO, parseDurMin } = require('./season-plan.js');
const piani = require('./piani.js');
const { eventoAllenamento } = require('./intervals-evento.js');
const palestraStore = require('./palestra-store.js');
const palestraProssime = require('./palestra-prossime.js');
const palestraAppRilascio = require('./palestra-app-release.js');
const palestraSettimana = require('./palestra-settimana.js');
const fitGarmin = require('./fit-garmin.js');
const fitApi = require('./fit-api.js');
// 10/11/2026: come MIRAGAME, il server legge direttamente la cartella dist/ dell'app (ultima.json + apk), senza pubblicazione a mano
const APP_ANDROID_DIR = process.env.MW_APP_DIST || palestraAppRilascio.DIST_PREDEFINITA;
const ripianifica = require('./ripianifica-ia.js');
const pianoMixed = require('./scripts/piano-mixed.js');
const coach = require('./coach.js');
const { pianoNutrizione } = require('./nutrition-library.js');
const COACH_WEBHOOK_PATH = path.join(__dirname, '.coach_webhook');   // segreto (600): mai nei log né nelle risposte
const COACH_ULTIMO_PATH = path.join(__dirname, 'coach-ultimo.json');
const strava = require('./strava.js');
const STRAVA_ENV_PATH = path.join(__dirname, '.strava.env');          // client id/secret (600)
const STRAVA_TOKEN_PATH = path.join(__dirname, '.strava-token.json'); // token OAuth (600)

// 19/10/2026 notte: sedute di palestra su Strava (come JEFIT). Un solo atleta, token rinnovato da sé.
function stravaCredenziali() {
    try {
        const v = Object.fromEntries(fs.readFileSync(STRAVA_ENV_PATH, 'utf8').split('\n').map(r => r.split('=')).filter(r => r.length === 2).map(([k, x]) => [k.trim(), x.trim()]));
        return v.STRAVA_CLIENT_ID && v.STRAVA_CLIENT_SECRET ? { id: v.STRAVA_CLIENT_ID, secret: v.STRAVA_CLIENT_SECRET } : null;
    } catch (e) { return null; }
}
function stravaToken() { try { return JSON.parse(fs.readFileSync(STRAVA_TOKEN_PATH, 'utf8')); } catch (e) { return null; } }
function stravaSalvaToken(t) { fs.writeFileSync(STRAVA_TOKEN_PATH, JSON.stringify(t), { mode: 0o600 }); fs.chmodSync(STRAVA_TOKEN_PATH, 0o600); }
function stravaRichiesta(metodo, percorso, corpo, bearer) {
    return new Promise((ok, ko) => {
        const dati = corpo ? new URLSearchParams(corpo).toString() : '';
        const r = https.request({ hostname: 'www.strava.com', path: percorso, method: metodo, headers: {
            'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(dati), 'User-Agent': 'MirabiWatt/1.0',
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) } }, res => {
            let t = ''; res.on('data', c => t += c);
            res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch (e) { /* non JSON */ }
                res.statusCode < 300 ? ok(j) : ko(new Error(`Strava ${res.statusCode}${j && j.message ? ': ' + j.message : ''}`)); });
        });
        r.on('error', ko); r.end(dati);
    });
}
async function stravaAccesso() {
    const cred = stravaCredenziali(), t = stravaToken();
    if (!cred || !t) throw new Error('Strava non collegato');
    if (!strava.daRinnovare(t, Date.now() / 1000)) return t.access_token;
    const n = await stravaRichiesta('POST', '/oauth/token', { client_id: cred.id, client_secret: cred.secret, grant_type: 'refresh_token', refresh_token: t.refresh_token });
    stravaSalvaToken({ ...t, access_token: n.access_token, refresh_token: n.refresh_token, expires_at: n.expires_at });
    return n.access_token;
}
/** Pubblica una seduta salvata; se è già su Strava non la ripubblica. */
async function stravaCondividi(id) {
    const s = palestraStore.trova(id);
    if (!s) throw new Error('seduta non trovata');
    if (s.stravaId) return { ok: true, id: s.stravaId, url: `https://www.strava.com/activities/${s.stravaId}`, gia: true };
    const a = await stravaRichiesta('POST', '/api/v3/activities', strava.attivitaDaSessione(s), await stravaAccesso());
    palestraStore.segna(id, { stravaId: a.id });
    return { ok: true, id: a.id, url: `https://www.strava.com/activities/${a.id}` };
}
function stravaAuto() { return leggiJSON(PREFERENZE_PATH, {}).stravaAuto !== false; }

// 19/10/2026 sera: COACH CLAUDIO, il recap della domenica alle 20:00 (timer utente mirabiwatt-coach.timer)
async function preparaRecap(oggi = new Date()) {
    const ws = fmtISO(mondayOf(oggi)), fine = fmtISO(addDays(parseISO(ws), 6)), prec = fmtISO(addDays(parseISO(ws), -7));
    const [acts, well] = await Promise.all([
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${ws}&newest=${fine}`),
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/wellness.json?oldest=${prec}&newest=${fine}`)
    ]);
    const attivita = (Array.isArray(acts) ? acts : []).map(a => ({ date: (a.start_date_local || '').slice(0, 10), type: a.type || '', name: a.name || '',
        durationMin: a.moving_time != null ? Math.round(a.moving_time / 60) : 0, tss: a.icu_training_load != null ? Math.round(a.icu_training_load) : 0 }));
    const wellness = (Array.isArray(well) ? well : []).map(w => ({ date: w.id, weight: w.weight != null ? w.weight : null, ctl: w.ctl, atl: w.atl }));
    const qui = findDetailedWeek(ws), nextWs = fmtISO(addDays(parseISO(ws), 7)), poi = findDetailedWeek(nextWs);
    const analisi = coach.analizza({ ws, oggi: fmtISO(oggi), giorniPiano: qui ? qui.week.days : [], attivita, sessioniPalestra: palestraStore.storico().sessioni, wellness });
    const pesi = wellness.filter(w => w.weight != null), peso = analisi.peso.media || (pesi.length ? pesi[pesi.length - 1].weight : 81);
    const fase = faseNutrizione(nextWs), giorni = poi ? poi.week.days : [];
    const tipi = {};
    for (const d of giorni) { const t = coach.tipoGiorno(d); if (!tipi[t]) tipi[t] = pianoNutrizione(t, peso, { fase, minuti: parseDurMin(d.dur) || undefined }).target; }
    if (!giorni.length) tipi.riposo = pianoNutrizione('riposo', peso, { fase }).target;
    const sommaria = poi ? null : findSummaryPhase(nextWs);
    const prossima = {
        ws: nextWs, fase: poi ? poi.phase.name : (sommaria ? sommaria.name : 'Fuori dal piano'), label: poi ? poi.week.label : 'fase da dettagliare',
        special: poi ? poi.week.special : (sommaria ? sommaria.focus : ''), perche: poi ? (poi.week.perche || '') : (sommaria ? sommaria.detail : ''),
        giorni, nutrizione: { fase, perche: pianoNutrizione('riposo', peso, { fase }).perche, tipi }
    };
    let commento = coach.commentoBase(analisi), ia = false;
    try {
        const t = await geminiGenerate(`Sei COACH CLAUDIO, l'allenatore personale (palestra per l'ipertrofia + ciclismo) di un amatore di ${Math.round(peso)} kg.
Scrivi in italiano, 3-4 frasi, tono incoraggiante ma onesto e concreto (mai sgridate), senza saluti né elenchi, il commento «Com'è andata» sulla settimana appena finita.
Usa SOLO questi dati, non inventare numeri: ${JSON.stringify(analisi)}
La prossima settimana: ${prossima.fase}, ${prossima.label}. Se qualcosa è andato storto dillo con calma e suggerisci una sola cosa pratica.`);
        if (t && t.trim().length > 40) { commento = t.trim().slice(0, 1200); ia = true; }
    } catch (e) { /* senza Gemini: il commento di base */ }
    const msg = coach.messaggio({ ws, analisi, commento, prossima });
    if (ia) msg.embeds[msg.embeds.length - 1].footer.text += ' Commento: Gemini.';
    return msg;
}

function postaWebhook(url, corpo) {
    return new Promise((ok, ko) => {
        const dati = JSON.stringify(corpo), u = new URL(url);
        const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dati), 'User-Agent': 'MirabiWatt-Coach/1.0' } }, res => {
            res.resume(); res.on('end', () => res.statusCode < 300 ? ok(res.statusCode) : ko(new Error(`Discord ${res.statusCode}`)));
        });
        r.on('error', ko); r.end(dati);
    });
}
// 19/10/2026: il piano stagionale attivo (piani/attivo.json) sostituisce quello scritto in season-plan.js
usaPiano(piani.leggi(piani.attivo()));

const REST_NAMES = new Set(['Riposo', 'Riposo o Passeggiata', 'Corpo libero e MSR']);

function loadEnv(file) {
    const env = {};
    if (fs.existsSync(file)) {
        fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
            const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
            if (m) env[m[1]] = m[2];
        });
    }
    return env;
}

const env = loadEnv(path.join(__dirname, '.env'));
const API_KEY = env.INTERVALS_API_KEY;
const ATHLETE_ID = env.INTERVALS_ATHLETE_ID || '0';
const PORT = env.PORT || 3000;
const GEMINI_API_KEY = env.GEMINI_API_KEY;
const GEMINI_MODEL = env.GEMINI_MODEL || 'gemini-flash-latest';

if (!API_KEY) {
    console.error('Missing INTERVALS_API_KEY in .env');
    process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`API_KEY:${API_KEY}`).toString('base64');

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => data += c);
        req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
        req.on('error', reject);
    });
}

// Modelli in ordine di preferenza — quota separata per modello, quindi su 429
// (quota esaurita, non un blocco momentaneo) passiamo al successivo invece di
// ritentare lo stesso modello all'infinito.
const GEMINI_MODEL_FALLBACKS = [GEMINI_MODEL, 'gemini-flash-lite-latest'].filter((v, i, a) => a.indexOf(v) === i);

function geminiGenerateOnce(prompt, model) {
    return new Promise((resolve, reject) => {
        if (!GEMINI_API_KEY) return reject(new Error('Missing GEMINI_API_KEY in .env'));
        // responseMimeType:'application/json' da 503 costante su questa chiave (verificato),
        // affidarsi al prompt + parsing tollerante. thinkingBudget:0 invece taglia ~110 token
        // di ragionamento invisibile per chiamata (risparmia quota) ma il modello "lite" lo
        // rifiuta con 400, quindi solo sui modelli non-lite.
        const generationConfig = model.includes('lite') ? undefined : { thinkingConfig: { thinkingBudget: 0 } };
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            ...(generationConfig ? { generationConfig } : {})
        });
        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed.candidates[0].content.parts[0].text;
                        resolve(text);
                    } catch (e) { reject(new Error('Gemini response non parsabile: ' + e.message)); }
                } else {
                    const err = new Error(`Gemini ${res.statusCode}: ${data.slice(0, 300)}`);
                    err.statusCode = res.statusCode;
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geminiGenerate(prompt, attempts = 4) {
    let lastErr;
    for (const model of GEMINI_MODEL_FALLBACKS) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await geminiGenerateOnce(prompt, model);
            } catch (e) {
                lastErr = e;
                if (e.statusCode === 429) {
                    console.error(`Gemini: quota esaurita su ${model}, passo al modello successivo (se disponibile).`);
                    break; // niente backoff: la quota non si libera aspettando pochi secondi
                }
                if (e.statusCode === 503) {
                    await sleep(1000 * Math.pow(2, i)); // 1s, 2s, 4s, 8s
                    continue;
                }
                throw e; // errore non transitorio, non ritentare
            }
        }
    }
    throw lastErr;
}

// ============================================
// EXERCISEDB (esercizi + GIF per "Corpo libero e MSR") — API pubblica, no auth,
// CORS aperto. Proxata comunque per cache + fallback se il servizio è giù.
// ============================================
const EXERCISE_CACHE = new Map(); // query -> { at, data }
const EXERCISE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const EXERCISE_FALLBACK = {
    waist: [
        { exerciseId: 'fallback-plank', name: 'plank', gifUrl: null, targetMuscles: ['abs'], instructions: ['Step:1 Appoggia avambracci e punte dei piedi a terra, corpo in linea retta.', 'Step:2 Contrai addome e glutei, non far cadere i fianchi.', 'Step:3 Tieni la posizione respirando regolarmente.'] },
        { exerciseId: 'fallback-birddog', name: 'bird dog', gifUrl: null, targetMuscles: ['abs', 'lower back'], instructions: ['Step:1 Parti a quattro zampe, schiena neutra.', 'Step:2 Estendi braccio e gamba opposti, tieni i fianchi fermi.', 'Step:3 Torna alla posizione di partenza e ripeti dall\'altro lato.'] },
        { exerciseId: 'fallback-deadbug', name: 'dead bug', gifUrl: null, targetMuscles: ['abs'], instructions: ['Step:1 Sdraiato supino, braccia verso il soffitto, ginocchia piegate a 90°.', 'Step:2 Abbassa braccio e gamba opposti verso il pavimento senza inarcare la schiena.', 'Step:3 Torna al centro e ripeti dall\'altro lato.'] }
    ],
    'upper legs': [
        { exerciseId: 'fallback-squat', name: 'bodyweight squat', gifUrl: null, targetMuscles: ['quads', 'glutes'], instructions: ['Step:1 Piedi larghezza spalle, scendi come per sederti su una sedia.', 'Step:2 Ginocchia in linea con le punte dei piedi.', 'Step:3 Risali spingendo sui talloni.'] },
        { exerciseId: 'fallback-lunge', name: 'walking lunge', gifUrl: null, targetMuscles: ['quads', 'glutes'], instructions: ['Step:1 Fai un passo lungo in avanti.', 'Step:2 Scendi finché entrambe le ginocchia sono a 90°.', 'Step:3 Spingi e porta l\'altra gamba avanti.'] },
        { exerciseId: 'fallback-calfraise', name: 'calf raise', gifUrl: null, targetMuscles: ['calves'], instructions: ['Step:1 In piedi, sali sulle punte dei piedi.', 'Step:2 Tieni un secondo in alto.', 'Step:3 Scendi controllando il movimento.'] }
    ]
};

function fetchJSON(hostname, pathAndQuery) {
    return new Promise((resolve, reject) => {
        https.get({ hostname, path: pathAndQuery, headers: { 'User-Agent': 'MirabiWatt/1.0' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`${hostname} ${res.statusCode}: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

async function getExercises(bodyPart, limit) {
    const cacheKey = `${bodyPart}:${limit}`;
    const cached = EXERCISE_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.at) < EXERCISE_CACHE_TTL_MS) return cached.data;

    try {
        // Solo attrezzatura da casa: corpo libero, elastici, al massimo manubri — niente sala pesi.
        const query = `/api/v1/exercises?bodyParts=${encodeURIComponent(bodyPart)}&equipments=${encodeURIComponent('body weight,band,dumbbell')}&limit=${limit}`;
        const json = await fetchJSON('oss.exercisedb.dev', query);
        const data = (json.data || []).map(e => ({
            id: e.exerciseId, name: e.name, gifUrl: e.gifUrl,
            targetMuscles: e.targetMuscles, instructions: e.instructions
        }));
        if (data.length) { EXERCISE_CACHE.set(cacheKey, { at: Date.now(), data }); return data; }
        throw new Error('empty result');
    } catch (e) {
        return EXERCISE_FALLBACK[bodyPart] || [];
    }
}

function intervalsGet(pathAndQuery) {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'intervals.icu',
            path: pathAndQuery,
            headers: { Authorization: AUTH_HEADER }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`intervals.icu ${res.statusCode}: ${data.slice(0, 300)}`));
                }
            });
        }).on('error', reject);
    });
}

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function todayLocalISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function intervalsPostEvent(body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = https.request({
            hostname: 'intervals.icu',
            path: `/api/v1/athlete/${ATHLETE_ID}/events?upsertOnUid=true`,
            method: 'POST',
            headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, res => {
            let resData = '';
            res.on('data', c => resData += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(resData)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`intervals.icu ${res.statusCode}: ${resData.slice(0, 300)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

const DAY_ORDER_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

async function pushWeekToIntervals(days, weekStartISO) {
    const profile = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}`);
    const rideSettings = (profile.sportSettings || []).find(s => (s.types || []).includes('Ride')) || {};
    const ftp = rideSettings.ftp || 320;
    const cp = rideSettings.mmp_model ? rideSettings.mmp_model.criticalPower : ftp - 30;

    const weekStart = new Date(weekStartISO + 'T00:00:00');
    const results = [];

    for (let i = 0; i < 7; i++) {
        const day = days[i];
        const name = baseName(day.s);
        const dayDate = new Date(weekStart); dayDate.setDate(dayDate.getDate() + i);
        const y = dayDate.getFullYear(), m = String(dayDate.getMonth() + 1).padStart(2, '0'), d = String(dayDate.getDate()).padStart(2, '0');
        const dateISO = `${y}-${m}-${d}`;

        if (REST_NAMES.has(name) || (day.zone === 'Rec')) {
            const restLabel = ['DIVANO', 'DAY OFF', 'RIPOSO TOTALE'][i % 3];
            const noteBody = {
                category: 'NOTE',
                start_date_local: `${dateISO}T00:00:00`,
                name: restLabel,
                description: day.note || 'Giornata di riposo programmata.',
                uid: `mirabiwatt-${dateISO}`
            };
            try {
                const created = await intervalsPostEvent(noteBody);
                results.push({ day: day.d, date: dateISO, ok: true, note: true, name: restLabel, eventId: created.id });
            } catch (e) {
                results.push({ day: day.d, date: dateISO, ok: false, note: true, name: restLabel, error: e.message });
            }
            continue;
        }

        const detail = getWorkoutDetail(day.s, ftp, cp);
        const eventBody = eventoAllenamento(day, dateISO, detail);

        try {
            const created = await intervalsPostEvent(eventBody);
            results.push({ day: day.d, date: dateISO, ok: true, name: day.s, structured: !!detail.icuText, eventId: created.id });
        } catch (e) {
            results.push({ day: day.d, date: dateISO, ok: false, name: day.s, error: e.message });
        }
    }
    return results;
}

// 10/11/2026: la settimana vera per l'app (usata da /api/palestra/settimana e da /api/fit/oggi)
async function settimanaVera(data) {
    const g = new Date(data + 'T12:00:00'), lun = fmtISO(addDays(g, -((g.getDay() + 6) % 7))), dom = fmtISO(addDays(new Date(lun + 'T12:00:00'), 6));
    const ev = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/events?oldest=${lun}&newest=${dom}`).catch(() => null);
    const eventi = Array.isArray(ev) ? ev.filter(e => e.category === 'WORKOUT').map(e => ({ date: String(e.start_date_local || '').slice(0, 10), name: e.name || '' })) : null;
    const st = palestraStore.storico();
    const s = palestraSettimana.settimanaPalestra({ lunedi: lun, eventi, sessioni: st.sessioni || [], findDetailedWeek, pianoPalestra, baseName,
        gare: (SEASON.events || []).map(e => ({ nome: e.name, data: e.date, priorita: e.priority, km: e.km, dislivello: e.elev })) });
    return { generato: new Date().toISOString(), ...s, ultimi: st.ultimi || {} };
}

// 10/11/2026: app Fit. Garmin Personal API (la chiave sta in un file riservato, mai in log o risposte) e profilo atleta in cache
const GARMIN_KEY_PATH = path.join(require('os').homedir(), '.config', 'mirabiwatt', 'garmin-api-key');
const garminFit = fitGarmin.creaGarmin({ chiave: () => { try { return fs.readFileSync(GARMIN_KEY_PATH, 'utf8').trim() || null; } catch (e) { return null; } }, fetch: (...a) => fetch(...a) });
let atletaCache = { t: 0, v: null };
async function atletaIntervals() {
    if (atletaCache.v && Date.now() - atletaCache.t < 3600000) return atletaCache.v;
    const profile = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}`);
    const ride = (profile.sportSettings || []).find(x => (x.types || []).includes('Ride')) || {};
    atletaCache = { t: Date.now(), v: { weightKg: profile.icu_weight || null, ftp: ride.ftp || null } };
    return atletaCache.v;
}
const fitRotte = fitApi.creaFitApi({
    garmin: garminFit, settimanaDel: settimanaVera, cartellaDati: __dirname,
    attivita: async (da, a) => (await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${da}&newest=${a}`)).map(x => ({ id: x.id, date: String(x.start_date_local || '').slice(0, 10), type: x.type || '', durationMin: x.moving_time != null ? Math.round(x.moving_time / 60) : null, kcal: x.calories != null ? Math.round(x.calories) : null, distanceKm: x.distance != null ? Math.round(x.distance / 10) / 100 : null, start: String(x.start_date_local || '').slice(11, 16) || null, name: x.name || '', np: x.icu_weighted_avg_watts != null ? Math.round(x.icu_weighted_avg_watts) : null, watt: x.icu_average_watts != null ? Math.round(x.icu_average_watts) : null })),
    sessioni: () => palestraStore.storico().sessioni || [],
    pesoKg: async () => (await atletaIntervals()).weightKg, ftp: async () => (await atletaIntervals()).ftp,
});

async function buildDashboard() {
    const today = new Date();
    const past = new Date(today); past.setDate(past.getDate() - 90);
    const future = new Date(today); future.setDate(future.getDate() + 90);

    const [profile, activities, wellness, events] = await Promise.all([
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}`),
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${fmtDate(past)}&newest=${fmtDate(today)}`),
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/wellness.json?oldest=${fmtDate(past)}&newest=${fmtDate(today)}`),
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/events?oldest=${fmtDate(today)}&newest=${fmtDate(future)}`)
    ]);

    const rideSettings = (profile.sportSettings || []).find(s => (s.types || []).includes('Ride')) || {};
    const lastActivity = Array.isArray(activities) && activities.length ? activities[0] : null;
    const wellnessList = Array.isArray(wellness) ? wellness : [];
    const todayWellness = wellnessList.length ? wellnessList[wellnessList.length - 1] : null;

    const ctlHistory = wellnessList.filter(x => x.ctl != null).map(x => ({ date: x.id, value: Math.round(x.ctl * 10) / 10 }));
    const eftpHistory = wellnessList
        .map(x => ({ date: x.id, sportInfo: (x.sportInfo || []).find(s => s.type === 'Ride') }))
        .filter(x => x.sportInfo && x.sportInfo.eftp)
        .map(x => ({ date: x.date, value: Math.round(x.sportInfo.eftp) }));
    const weightHistory = wellnessList.filter(x => x.weight != null).map(x => ({ date: x.id, value: Math.round(x.weight * 10) / 10 }));
    const lastWeighIn = weightHistory.length ? weightHistory[weightHistory.length - 1] : null;

    const upcoming = (Array.isArray(events) ? events : [])
        .filter(e => e.start_date_local && e.category !== 'NOTE')
        .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
    const nextEvent = upcoming.length ? upcoming[0] : null;

    return {
        profile: {
            name: profile.name,
            weightKg: profile.icu_weight || (lastWeighIn && lastWeighIn.value),
            restingHr: profile.icu_resting_hr,
            ftp: rideSettings.ftp,
            ftpUpdated: rideSettings.updated || null,
            cp: rideSettings.mmp_model ? rideSettings.mmp_model.criticalPower : null,
            wPrime: rideSettings.w_prime,
            lthr: rideSettings.lthr,
            maxHr: rideSettings.max_hr,
            powerZones: rideSettings.power_zones,
            powerZoneNames: rideSettings.power_zone_names,
            hrZones: rideSettings.hr_zones,
            hrZoneNames: rideSettings.hr_zone_names
        },
        lastWeighIn: lastWeighIn,
        history: { ctl: ctlHistory, eftp: eftpHistory, weight: weightHistory },
        lastActivity: lastActivity && {
            id: lastActivity.id,
            name: lastActivity.name,
            type: lastActivity.type,
            date: lastActivity.start_date_local,
            movingTime: lastActivity.moving_time,
            distance: lastActivity.distance,
            elevation: lastActivity.total_elevation_gain,
            normalizedPower: lastActivity.icu_weighted_avg_watts,
            avgPower: lastActivity.icu_average_watts,
            avgHr: lastActivity.average_heartrate,
            load: lastActivity.icu_training_load,
            ctl: lastActivity.icu_ctl,
            atl: lastActivity.icu_atl
        },
        form: todayWellness && {
            date: todayWellness.id,
            ctl: todayWellness.ctl,
            atl: todayWellness.atl,
            tsb: (todayWellness.ctl != null && todayWellness.atl != null)
                ? Math.round((todayWellness.ctl - todayWellness.atl) * 10) / 10
                : null,
            rampRate: todayWellness.rampRate
        },
        nextWorkout: nextEvent && {
            name: nextEvent.name,
            date: nextEvent.start_date_local,
            type: nextEvent.category || nextEvent.type,
            description: nextEvent.description
        },
        periodization: null, // placeholder until 2027 target events + ebook library are available
        goalProgress: null   // placeholder until a target event is defined
    };
}

// 31/10/2026: il prompt sa che giorno è e cosa è stato fatto QUESTA settimana; si ripianificano solo i giorni che
// restano (ripianifica-ia.js). Prima: giorni senza date e attività dei 14 giorni prima, Gemini riscriveva anche il passato.
async function replanWithAI(weekDays, reason, weekLabel, weekStart) {
    const adesso = new Date();
    const ws = /^\d{4}-\d{2}-\d{2}$/.test(weekStart || '') ? weekStart : fmtISO(mondayOf(adesso));
    const oggi = todayLocalISO(), fine = fmtISO(addDays(parseISO(ws), 6));
    const fino = fine < oggi ? fine : oggi;
    const ieri = fmtISO(addDays(parseISO(oggi), -1));
    const [acts, well] = await Promise.all([
        ws <= oggi ? intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${ws}&newest=${fino}`) : [],
        intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/wellness.json?oldest=${ieri}&newest=${oggi}`)
    ]);
    const attivita = (Array.isArray(acts) ? acts : []).map(a => ({ date: (a.start_date_local || '').slice(0, 10), name: a.name || '', type: a.type || '',
        tss: a.icu_training_load != null ? Math.round(a.icu_training_load) : null, durationMin: a.moving_time != null ? Math.round(a.moving_time / 60) : null }));
    // le sedute di palestra salvate dall'app contano come fatte anche se non arrivano su intervals.icu
    for (const s of palestraStore.storico().sessioni || [])
        if (s.data >= ws && s.data <= fino && !attivita.some(a => a.date === s.data && /weight/i.test(a.type)))
            attivita.push({ date: s.data, name: s.seduta, type: 'Palestra', tss: null, durationMin: s.inizio && s.fine ? Math.round((new Date(s.fine) - new Date(s.inizio)) / 60000) : null });
    const w = (Array.isArray(well) ? well : []).filter(x => x.ctl != null && x.atl != null).pop();
    const forma = w ? { ctl: Math.round(w.ctl), atl: Math.round(w.atl), tsb: Math.round((w.ctl - w.atl) * 10) / 10 } : {};
    const qui = findDetailedWeek(ws), poi = findDetailedWeek(fmtISO(addDays(parseISO(ws), 7)));
    const giorni = Array.isArray(weekDays) && weekDays.length === 7 ? weekDays : (qui ? qui.week.days : null);
    if (!giorni) throw new Error('Nessuna settimana pianificata in dettaglio qui.');
    const ctx = ripianifica.contesto({ ws, giorni, attivita, adesso, forma, prossima: poi ? poi.week.days.slice(0, 3) : [],
        etichetta: weekLabel || (qui ? `${qui.phase.name} — ${qui.week.label}` : '') });
    const text = await geminiGenerate(ripianifica.prompt(ctx, reason));
    // Tollerante a testo extra o fence ```json ... ``` attorno al JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Risposta AI senza JSON riconoscibile: ' + text.slice(0, 200));
    return ripianifica.applica(JSON.parse(jsonMatch[0]), ctx);
}

async function suggestMealAlternative(mealName, target, craving, dayTypeLabel) {
    const prompt = `Sei un nutrizionista sportivo che aiuta un ciclista amatoriale a variare i pasti senza sballare i macro.

Pasto da sostituire: "${mealName}" (contesto giornata: ${dayTypeLabel}).
Target nutrizionale approssimativo di QUESTO pasto: proteine ${target.p}g, grassi ${target.fat}g, carboidrati ${target.c}g (~${target.kcal}kcal).

L'atleta oggi ha questa voglia/richiesta: "${craving || 'nessuna preferenza specifica, solo varietà rispetto al solito'}"

Proponi UNA alternativa concreta (alimenti reali e quantità in grammi) che soddisfi la voglia espressa e si avvicini ragionevolmente al target (tolleranza accettabile ±20%). Non serve precisione al grammo, ma i numeri devono essere plausibili.

IMPORTANTE: per OGNI alimento stima anche le sue macro individuali (proteine/grassi/carboidrati/kcal per quella porzione, non per 100g) — devono sommare (circa) ai totali del pasto. Stesso identico livello di dettaglio che daresti per un pasto già pianificato, non un'approssimazione generica.

Rispondi SOLO con un oggetto JSON valido, nessun altro testo, in questa forma esatta:
{"items":[{"food":"nome alimento","grams":120,"p":numero,"fat":numero,"c":numero,"kcal":numero}, ...],"p":stima_proteine_totali_g,"fat":stima_grassi_totali_g,"c":stima_carboidrati_totali_g,"kcal":stima_kcal_totali,"note":"breve nota, 1 frase, in italiano"}`;

    const text = await geminiGenerate(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Risposta AI senza JSON riconoscibile: ' + text.slice(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.items)) throw new Error('Risposta AI malformata (items mancanti)');
    return parsed;
}

// ============================================
// AUTOMAZIONE: controllo settimanale via cron locale
// L'installazione/rimozione avviene SOLO su azione esplicita dell'utente
// (click sul pulsante nel cruscotto) — mai in autonomia da parte del server.
// ============================================
const { execSync } = require('child_process');
const CRON_SCRIPT_PATH = path.join(__dirname, 'scripts', 'plan-next-block.sh');
const CRON_LINE = `17 8 * * 1 /usr/bin/bash ${CRON_SCRIPT_PATH}`;

function readCrontab() {
    try {
        return execSync('crontab -l', { encoding: 'utf8' });
    } catch (e) {
        return ''; // nessun crontab esistente
    }
}

function writeCrontab(content) {
    execSync('crontab -', { input: content });
}

function cronStatus() {
    const current = readCrontab();
    return { installed: current.includes('plan-next-block.sh'), line: CRON_LINE };
}

function installCron() {
    const current = readCrontab();
    if (current.includes('plan-next-block.sh')) return { installed: true, alreadyPresent: true };
    const sep = current && !current.endsWith('\n') ? '\n' : '';
    writeCrontab(current + sep + CRON_LINE + '\n');
    return { installed: true, alreadyPresent: false };
}

function removeCron() {
    const current = readCrontab();
    const filtered = current.split('\n').filter(l => !l.includes('plan-next-block.sh')).join('\n');
    writeCrontab(filtered);
    return { installed: false };
}

function tailFile(filePath, maxLines) {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-maxLines).join('\n');
}

// ============================================
// ALTERNATIVE PASTO SALVATE (file JSON locale, niente database)
// ============================================
const SAVED_MEALS_PATH = path.join(__dirname, 'saved-meals.json');

function readSavedMeals() {
    if (!fs.existsSync(SAVED_MEALS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(SAVED_MEALS_PATH, 'utf8')); } catch (e) { return []; }
}

function writeSavedMeals(list) {
    fs.writeFileSync(SAVED_MEALS_PATH, JSON.stringify(list, null, 2));
}

// ============================================
// TEST FTP — aggiorna davvero l'FTP su intervals.icu (sport-settings Ride)
// + log locale con data e tipo di test (intervals.icu non lo traccia da solo)
// ============================================
const FTP_TESTS_PATH = path.join(__dirname, 'ftp-tests.json');

function readFtpTests() {
    if (!fs.existsSync(FTP_TESTS_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(FTP_TESTS_PATH, 'utf8')); } catch (e) { return []; }
}

function writeFtpTests(list) {
    fs.writeFileSync(FTP_TESTS_PATH, JSON.stringify(list, null, 2));
}

function intervalsPut(pathAndQuery, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = https.request({
            hostname: 'intervals.icu',
            path: pathAndQuery,
            method: 'PUT',
            headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, res => {
            let resData = '';
            res.on('data', c => resData += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(resData)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`intervals.icu ${res.statusCode}: ${resData.slice(0, 300)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function updateAthleteFtp(newFtp) {
    const allSettings = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/sport-settings`);
    const rideSettings = allSettings.find(s => (s.types || []).includes('Ride'));
    if (!rideSettings) throw new Error('Impostazioni Ride non trovate su intervals.icu');
    rideSettings.ftp = newFtp;
    rideSettings.indoor_ftp = newFtp;
    return intervalsPut(`/api/v1/athlete/${ATHLETE_ID}/sport-settings/${rideSettings.id}?recalcHrZones=false`, rideSettings);
}

const STATICI = new Set(['.html', '.js', '.css', '.gif', '.woff2', '.svg', '.png', '.ico']);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.gif': 'image/gif', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };


// ============================================
// 14/10/2026: Analisi FTP (curve di potenza), Fitness (forma su periodi lunghi), nome dell'atleta, obiettivi
// ============================================
const PREFERENZE_PATH = path.join(__dirname, 'preferenze.json');
const CAMPI_ATTIVITA = ['durata', 'distanza', 'fc', 'watt', 'np', 'load', 'intensita', 'orario', 'kj', 'kcal', 'compliance', 'zone']; // come Cal.CAMPI_ATTIVITA
const OBIETTIVI_PATH = path.join(__dirname, 'obiettivi.json');
const leggiJSON = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; } };
const scriviJSON = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));
const dataOk = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x));
const testo = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
let curveCache = { ts: 0, dati: null };
async function curveDiPotenza() {
    if (curveCache.dati && Date.now() - curveCache.ts < 10 * 60000) return curveCache.dati;
    const pc = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/power-curves?type=Ride&curves=42d,84d,s0,all`);
    const giorno = x => String(x || '').slice(0, 10);
    const curve = (pc.list || []).map(c => {
        const ecp = (c.powerModels || []).find(m => m.type === 'ECP') || (c.powerModels || [])[0] || {};
        const fft = (c.powerModels || []).find(m => m.type === 'FFT_CURVES') || ecp; // l'eFTP di intervals.icu
        const mp = c.mapPlot || {};
        return { id: c.id, label: c.label, start: giorno(c.start_date_local), end: giorno(c.end_date_local), days: c.days, peso: c.weight,
            secs: c.secs || [], watts: c.values || [], wkg: c.watts_per_kg || [], cp: ecp.criticalPower || null, wPrime: ecp.wPrime || null, pMax: ecp.pMax || null, eftp: fft.ftp || null,
            map: mp.mapWatts ? { watts: mp.mapWatts, wkg: Math.round(mp.map * 100) / 100, secs: mp.mapSecs } : null,
            vo2max: c.vo2max_5m != null ? Math.round(c.vo2max_5m * 10) / 10 : null, cs5m: c.compound_score_5m != null ? Math.round(c.compound_score_5m) : null };
    });
    const dati = { curve, peso: (curve.find(c => c.peso) || {}).peso || null };
    curveCache = { ts: Date.now(), dati };
    return dati;
}
// 13/10/2026: Attrezzatura. Il gear di intervals.icu (sincronizzato da Strava) e i km degli ultimi 42 giorni per bici.
let gearCache = { ts: 0, dati: null };
async function attrezzatura() {
    if (gearCache.dati && Date.now() - gearCache.ts < 10 * 60000) return gearCache.dati;
    const oggi = todayLocalISO(), da = fmtDate(new Date(Date.now() - 41 * 86400000));
    const [lista, attivita] = await Promise.all([intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/gear.json`), intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${da}&newest=${oggi}`)]);
    const km = m => Math.round((Number(m) || 0) / 100) / 10;
    const gear = (Array.isArray(lista) ? lista : []).map(x => ({ id: String(x.id), tipo: x.type, nome: x.name || x.type, note: x.notes || null,
        acquisto: x.purchased || null, ritiro: x.retired || null, km: Math.round(km(x.distance)), ore: Math.round((x.time || 0) / 3600), attivita: x.activities || 0,
        componente: !!x.component, componenti: Array.isArray(x.component_ids) ? x.component_ids.map(String) : null,
        virtuale: (x.activity_filters || []).some(f => f.field_id === 'type' && (f.value || []).includes('VirtualRide') && !f.not),
        promemoria: (Array.isArray(x.reminders) ? x.reminders : []).map(r => ({ id: r.id, nome: r.name || 'Promemoria', kmSoglia: Math.round(km(r.distance)),
            giorniSoglia: r.days || 0, oreSoglia: Math.round((r.time || 0) / 3600), attivitaSoglia: r.activities || 0, percento: Number(r.percent_used) || 0,
            kmUsati: Math.round(km(r.distance_used)), giorniUsati: r.days_used || 0, dal: String(r.last_reset || '').slice(0, 10), rinviato: r.snoozed_until || null })) }));
    const noti = new Set(gear.map(x => x.id)), kmRecenti = {};
    for (const a of Array.isArray(attivita) ? attivita : []) {
        const id = a && a.gear && a.gear.id != null ? String(a.gear.id) : null;
        if (id && noti.has(id)) kmRecenti[id] = Math.round(((kmRecenti[id] || 0) + km(a.distance)) * 10) / 10;
    }
    const dati = { aggiornato: new Date().toISOString(), gear, kmRecenti };
    gearCache = { ts: Date.now(), dati };
    return dati;
}
function json(res, status, corpo) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corpo)); }

const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/dashboard')) {
        try {
            const data = await buildDashboard();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/meal-alternative') {
        try {
            const body = await readBody(req);
            const result = await suggestMealAlternative(body.mealName, body.target, body.craving || '', body.dayTypeLabel || '');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/replan-ai') {
        try {
            const body = await readBody(req);
            const result = await replanWithAI(body.days, body.reason || '', body.weekLabel || '', body.weekStart);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/exercises')) {
        try {
            const u = new URL(req.url, 'http://x');
            const bodyPart = u.searchParams.get('bodyPart') || 'waist';
            const limit = Math.min(parseInt(u.searchParams.get('limit') || '4', 10), 10);
            const data = await getExercises(bodyPart, limit);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data }));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/power-curves') {
        try { json(res, 200, await curveDiPotenza()); } catch (e) { json(res, 502, { error: e.message }); }
        return;
    }
    if (req.method === 'GET' && req.url === '/api/gear') {
        try { json(res, 200, await attrezzatura()); } catch (e) { json(res, 502, { error: e.message }); }
        return;
    }
    if (req.method === 'GET' && req.url.startsWith('/api/fitness')) {
        const u = new URL(req.url, 'http://x'), start = u.searchParams.get('start'), end = u.searchParams.get('end');
        const giorni = dataOk(start) && dataOk(end) ? (Date.parse(end) - Date.parse(start)) / 86400000 : NaN;
        if (!(giorni >= 0 && giorni <= 740)) { json(res, 400, { error: 'start e end (YYYY-MM-DD), end dopo start, al massimo 2 anni' }); return; }
        try {
            const w = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${start}&newest=${end}`);
            json(res, 200, { start, end, giorni: (Array.isArray(w) ? w : []).map(x => ({ data: x.id, ctl: x.ctl != null ? Math.round(x.ctl * 10) / 10 : null,
                atl: x.atl != null ? Math.round(x.atl * 10) / 10 : null, carico: x.ctlLoad != null ? Math.round(x.ctlLoad) : 0, ramp: x.rampRate != null ? Math.round(x.rampRate * 10) / 10 : null })) });
        } catch (e) { json(res, 502, { error: e.message }); }
        return;
    }
    if (req.url === '/api/preferenze') {
        if (req.method === 'GET') { json(res, 200, leggiJSON(PREFERENZE_PATH, {})); return; }
        if (req.method === 'POST') {
            try {
                const b = await readBody(req), pref = { ...leggiJSON(PREFERENZE_PATH, {}) };
                if (b.nome !== undefined) pref.nome = testo(b.nome, 40);
                if (Array.isArray(b.campiAttivita)) pref.campiAttivita = [...new Set(b.campiAttivita.filter(c => CAMPI_ATTIVITA.includes(c)))];
                const bici = Number(b.pesoBici); if (b.pesoBici !== undefined && bici >= 3 && bici <= 30) pref.pesoBici = Math.round(bici * 10) / 10;
                scriviJSON(PREFERENZE_PATH, pref); json(res, 200, pref);
            } catch (e) { json(res, 400, { error: e.message }); }
            return;
        }
    }
    if (req.method === 'POST' && req.url === '/api/abbina') {
        // 13/10/2026: abbina un'attività all'allenamento pianificato su intervals.icu (come trascinarlo nel loro calendario)
        try {
            const b = await readBody(req), att = String(b.activityId || ''), ev = Number(b.eventId);
            if (!/^[\w-]{1,40}$/.test(att) || !(ev > 0)) { json(res, 400, { error: 'Servono activityId ed eventId.' }); return; }
            const r = await intervalsPut(`/api/v1/activity/${encodeURIComponent(att)}`, { paired_event_id: ev });
            json(res, 200, { ok: true, activityId: att, eventId: r.paired_event_id != null ? r.paired_event_id : ev });
        } catch (e) {
            if (/intervals\.icu 422/.test(e.message)) json(res, 422, { error: 'Attività arrivata da Strava: intervals.icu non permette di modificarla via API. Abbinala su intervals.icu oppure collega Zwift direttamente a intervals.icu.' });
            else json(res, 502, { error: e.message });
        }
        return;
    }
    // 19/10/2026 sera: recap di COACH CLAUDIO. ?prova=1 prepara e restituisce senza mandare.
    if (req.method === 'POST' && req.url.startsWith('/api/coach/recap')) {
        try {
            const msg = await preparaRecap();
            const prova = new URL(req.url, 'http://x').searchParams.get('prova') === '1';
            if (!prova) {
                const url = fs.readFileSync(COACH_WEBHOOK_PATH, 'utf8').trim();
                await postaWebhook(url, msg);
                fs.writeFileSync(COACH_ULTIMO_PATH, JSON.stringify({ inviato: new Date().toISOString(), msg }, null, 1));
            }
            json(res, 200, { ok: true, inviato: !prova, msg });
        } catch (e) { json(res, 502, { ok: false, error: String(e.message).replace(/https:\/\/discord\.com\/api\/webhooks\/\S+/g, '[webhook]') }); }
        return;
    }
    // 19/10/2026 sera: ricette di Mira Ricettario (:8100, stessa macchina) vicine ai macro di un pasto
    if (req.method === 'GET' && req.url.startsWith('/api/ricette-pasto')) {
        const q = new URL(req.url, 'http://x').searchParams, out = new URLSearchParams();
        for (const k of ['kcal', 'p', 'c', 'g', 'pasto', 'dieta', 'n']) if (q.get(k)) out.set(k, q.get(k));
        http.get({ host: '127.0.0.1', port: 8100, path: '/api/per-macro?' + out.toString(), timeout: 5000 }, r => {
            let s = ''; r.on('data', c => s += c);
            r.on('end', () => { res.writeHead(r.statusCode, { 'Content-Type': 'application/json' }); res.end(s); });
        }).on('error', () => json(res, 502, { ricette: [], error: 'Mira Ricettario non risponde' }));
        return;
    }
    // 19/10/2026: app di allenamento in palestra, sessioni salvate in palestra-storico.json
    if (req.method === 'GET' && req.url === '/api/palestra/storico') { json(res, 200, palestraStore.storico()); return; }
    // 10/11/2026: l'app controlla qui se c'è una build nuova e la scarica dentro l'app, come MIRAGAME (dist/ dell'app)
    if (palestraAppRilascio.servi(req, res, APP_ANDROID_DIR)) return;
    // 10/11/2026: la settimana vera per l'app di palestra: gli eventi di intervals.icu (dove vanno le modifiche fatte da
    // MirabiWatt) con il piano per durata, zona e scheda; le sedute non fatte restano scegliibili (anche quelle di ieri)
    if (req.method === 'GET' && req.url.startsWith('/api/palestra/settimana')) {
        try {
            const data = new URL(req.url, 'http://x').searchParams.get('data') || todayLocalISO();
            if (!dataOk(data)) { json(res, 400, { error: 'data (AAAA-MM-GG) non valida' }); return; }
            json(res, 200, await settimanaVera(data));
        } catch (e) { json(res, 502, { error: String(e.message) }); }
        return;
    }
    // 10/11/2026: app Fit (Expo): peso Garmin, obiettivi del giorno, profilo e foto
    if (await fitRotte.servi(req, res)) return;
    // 02/11/2026: app Android di palestra, scarica le prossime sedute per allenarsi anche senza rete
    if (req.method === 'GET' && req.url.startsWith('/api/palestra/prossime')) {
        const n = Math.min(28, Math.max(1, Number(new URL(req.url, 'http://x').searchParams.get('giorni')) || 14));
        const st = palestraStore.storico();
        const sedute = palestraProssime.prossimeSedute({ oggi: todayLocalISO(), giorni: n, findDetailedWeek, pianoPalestra, sessioni: st.sessioni || [] });
        json(res, 200, { generato: new Date().toISOString(), sedute, ultimi: st.ultimi || {} });
        return;
    }
    if (req.method === 'POST' && req.url === '/api/palestra/sessioni') {
        let id;
        try { id = palestraStore.salva(await readBody(req)); }
        catch (e) { json(res, 400, { ok: false, error: e.message }); return; }
        // 19/10/2026 notte: se Strava è collegato e l'invio automatico è acceso, la seduta va anche su Strava
        let st = null;
        if (stravaToken() && stravaAuto()) { try { st = await stravaCondividi(id); } catch (e) { st = strava.esitoErrore(e); } }
        json(res, 200, { ok: true, id, strava: st });
        return;
    }
    if (req.method === 'GET' && req.url === '/api/strava/stato') {
        const t = stravaToken();
        json(res, 200, { configurato: !!stravaCredenziali(), collegato: !!t, atleta: t && t.atleta || null, auto: stravaAuto() });
        return;
    }
    // 19/10/2026 sera: «Verifica collegamento» in Tools. Legge solo il profilo atleta (GET /athlete): nessuna attività creata
    if (req.method === 'GET' && req.url === '/api/strava/verifica') {
        const t = stravaToken();
        if (!stravaCredenziali() || !t) { json(res, 200, { ok: false, collegato: false }); return; }
        try {
            const a = await stravaRichiesta('GET', '/api/v3/athlete', null, await stravaAccesso());
            json(res, 200, { ok: true, atleta: `${a.firstname || ''} ${a.lastname || ''}`.trim() || 'atleta', scope: stravaToken().scope || null });
        } catch (e) { json(res, 200, { ok: false, collegato: true, error: e.message }); }
        return;
    }
    if (req.method === 'POST' && req.url === '/api/strava/condividi') {
        try { const { id } = await readBody(req); json(res, 200, await stravaCondividi(id)); }
        catch (e) { const x = strava.esitoErrore(e); json(res, x.sovrapposta ? 200 : 502, x); }
        return;
    }
    if (req.method === 'POST' && req.url === '/api/strava/auto') {
        const { auto } = await readBody(req), pref = leggiJSON(PREFERENZE_PATH, {});
        pref.stravaAuto = !!auto;
        fs.writeFileSync(PREFERENZE_PATH, JSON.stringify(pref, null, 2));
        json(res, 200, { auto: pref.stravaAuto });
        return;
    }
    if (req.method === 'GET' && req.url === '/strava/collega') {
        const cred = stravaCredenziali();
        if (!cred) { json(res, 400, { error: 'manca .strava.env' }); return; }
        res.writeHead(302, { Location: strava.urlAutorizza(cred.id) }); res.end();
        return;
    }
    if (req.method === 'GET' && req.url.startsWith('/strava/callback')) {
        const q = new URL(req.url, 'http://x').searchParams, cred = stravaCredenziali();
        const pagina = (titolo, testo) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Strava · MirabiWatt</title><body style="font:16px system-ui;padding:24px;max-width:520px;margin:auto"><h2>${titolo}</h2><p>${testo}</p><p><a href="/">← MirabiWatt</a></p>`); };
        if (!cred || !q.get('code') || !/activity:write/.test(q.get('scope') || '')) { pagina('Strava non collegato', 'Serve l\'autorizzazione a pubblicare le attività («activity:write»). Riprova da MirabiWatt e lascia la spunta.'); return; }
        try {
            const t = await stravaRichiesta('POST', '/oauth/token', { client_id: cred.id, client_secret: cred.secret, code: q.get('code'), grant_type: 'authorization_code' });
            stravaSalvaToken({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, scope: q.get('scope'), atleta: t.athlete ? `${t.athlete.firstname || ''} ${t.athlete.lastname || ''}`.trim() : null });
            pagina('✓ Strava collegato', 'Da ora le sedute di palestra salvate nell\'app finiscono anche su Strava.');
        } catch (e) { pagina('Strava non collegato', 'Strava ha rifiutato il codice: riprova.'); }
        return;
    }
    // 19/10/2026: piani stagionali salvati (piani/*.json) e scelta di quello attivo
    if (req.method === 'GET' && req.url === '/api/piani') {
        let inizioPalestra = null;
        try { inizioPalestra = piani.leggi('mixed-body-building').inizioPalestra || null; } catch (e) { /* piano assente */ }
        json(res, 200, { attivo: piani.attivo(), piani: piani.elenco(), inizioPalestra, finestra: [pianoMixed.INIZIO_MIN, pianoMixed.INIZIO_MAX] });
        return;
    }
    // il lunedì in cui parte la palestra: il piano mixed si rigenera, le settimane prima restano full cycling
    if (req.method === 'POST' && req.url === '/api/piani/inizio') {
        try {
            const { inizio } = await readBody(req);
            const piano = pianoMixed.scrivi(inizio);
            if (piani.attivo() === piano.id) usaPiano(piano);
            json(res, 200, { inizioPalestra: piano.inizioPalestra });
        } catch (e) { json(res, 400, { error: e.message }); }
        return;
    }
    if (req.method === 'POST' && req.url === '/api/piani') {
        try {
            const { id } = await readBody(req);
            usaPiano(piani.leggi(piani.scegli(id)));
            json(res, 200, { attivo: id });
        } catch (e) { json(res, 400, { error: 'piano sconosciuto' }); }
        return;
    }
    if (req.method === 'GET' && req.url.split('?')[0] === '/piano-attivo.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
        res.end(`usaPiano(${JSON.stringify(piani.leggi(piani.attivo()))});\n`);
        return;
    }
    if (req.url === '/api/obiettivi' && req.method === 'GET') { json(res, 200, { obiettivi: leggiJSON(OBIETTIVI_PATH, []) }); return; }
    if (req.url === '/api/obiettivi' && req.method === 'POST') {
        try {
            const b = await readBody(req), nome = testo(b.nome, 80);
            if (!nome || !dataOk(b.data)) { json(res, 400, { error: 'Servono nome e data (AAAA-MM-GG).' }); return; }
            const num = x => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : null);
            const o = { id: 'ob' + Date.now().toString(36), nome, data: b.data, priorita: ['A', 'B', 'C'].includes(b.priorita) ? b.priorita : 'B',
                km: num(b.km), dislivello: num(b.dislivello), note: testo(b.note, 300) };
            const lista = leggiJSON(OBIETTIVI_PATH, []).concat(o).sort((x, y) => x.data.localeCompare(y.data));
            scriviJSON(OBIETTIVI_PATH, lista); json(res, 200, { obiettivo: o });
        } catch (e) { json(res, 400, { error: e.message }); }
        return;
    }
    if (req.url.startsWith('/api/obiettivi/') && req.method === 'DELETE') {
        const id = req.url.split('/').pop();
        scriviJSON(OBIETTIVI_PATH, leggiJSON(OBIETTIVI_PATH, []).filter(x => x.id !== id));
        json(res, 200, { ok: true });
        return;
    }
    if (req.method === 'GET' && req.url.startsWith('/api/calendar')) {
        // Calendario stile intervals.icu (14/10/2026): attività vere e forma (CTL, ATL, ramp) di un intervallo di date.
        try {
            const u = new URL(req.url, 'http://x');
            const start = u.searchParams.get('start'), end = u.searchParams.get('end');
            const ok = x => x && /^\d{4}-\d{2}-\d{2}$/.test(x);
            const giorni = ok(start) && ok(end) ? (Date.parse(end) - Date.parse(start)) / 86400000 : NaN;
            if (!(giorni >= 0 && giorni <= 100)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'start e end (YYYY-MM-DD), end dopo start, al massimo 100 giorni' }));
                return;
            }
            const [activities, wellness, events] = await Promise.all([
                intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${start}&newest=${end}`),
                intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/wellness.json?oldest=${start}&newest=${end}`),
                intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/events?oldest=${start}&newest=${end}`).catch(() => [])
            ]);
            // 13/10/2026: gli allenamenti pianificati su intervals.icu e a quale attività sono abbinati (anche quelle da Strava)
            const eventi = (Array.isArray(events) ? events : []).filter(e => e.category === 'WORKOUT')
                .map(e => ({ id: e.id, date: String(e.start_date_local || '').slice(0, 10), name: e.name || '', attivitaAbbinata: e.paired_activity_id != null ? String(e.paired_activity_id) : null }));
            const abbinate = new Set(eventi.map(e => e.attivitaAbbinata).filter(Boolean));
            const num = v => (v != null && isFinite(v) ? Math.round(v) : null);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                start, end,
                activities: (Array.isArray(activities) ? activities : []).map(a => ({
                    id: a.id, date: (a.start_date_local || '').slice(0, 10), start: (a.start_date_local || '').slice(11, 16) || null, name: a.name || '', type: a.type || '',
                    strava: !a.name && a.source === 'STRAVA' || undefined, indoor: a.type === 'VirtualRide' || !!a.trainer,
                    tss: a.icu_training_load != null ? Math.round(a.icu_training_load) : null,
                    durationMin: a.moving_time != null ? Math.round(a.moving_time / 60) : null,
                    distanceKm: a.distance != null ? Math.round(a.distance / 10) / 100 : null,
                    hr: num(a.average_heartrate), watt: num(a.icu_average_watts), np: num(a.icu_weighted_avg_watts), intensita: num(a.icu_intensity),
                    kj: a.icu_joules != null ? Math.round(a.icu_joules / 1000) : null, kcal: num(a.calories), compliance: num(a.compliance),
                    zone: Array.isArray(a.icu_zone_times) ? ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'].map(z => (a.icu_zone_times.find(x => x.id === z) || {}).secs || 0) : null,
                    abbinata: a.paired_event_id != null || abbinate.has(String(a.id))
                })),
                eventi,
                wellness: (Array.isArray(wellness) ? wellness : []).map(w => ({
                    date: w.id, ctl: w.ctl != null ? Math.round(w.ctl * 10) / 10 : null, atl: w.atl != null ? Math.round(w.atl * 10) / 10 : null,
                    rampRate: w.rampRate != null ? Math.round(w.rampRate * 10) / 10 : null
                }))
            }));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/week-actual')) {
        // Attività reali della settimana da intervals.icu, per il confronto piano/realtà
        // lato frontend (season-plan.js, matchWeekToActual).
        try {
            const u = new URL(req.url, 'http://x');
            const startISO = u.searchParams.get('start');
            if (!startISO || !/^\d{4}-\d{2}-\d{2}$/.test(startISO)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'parametro start (YYYY-MM-DD) mancante o non valido' }));
                return;
            }
            // Non fmtDate(new Date(...)): passa da toISOString() (UTC) e con server in
            // Europe/Rome sposta le date di un giorno indietro. Si resta in locale.
            const [sy, sm, sd] = startISO.split('-').map(Number);
            const start = new Date(sy, sm - 1, sd);
            const end = new Date(start); end.setDate(end.getDate() + 6);
            const fmtLocalDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const activities = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${startISO}&newest=${fmtLocalDate(end)}`);
            const result = (Array.isArray(activities) ? activities : []).map(a => ({
                date: (a.start_date_local || '').slice(0, 10),
                name: a.name,
                type: a.type,
                tss: a.icu_training_load != null ? Math.round(a.icu_training_load) : null,
                durationMin: a.moving_time != null ? Math.round(a.moving_time / 60) : null
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ weekStart: startISO, activities: result }));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/settimana-piano')) {
        // 14/10/2026: la settimana del piano stagionale giorno per giorno, per la scheda MirabiWatt del Control Panel
        const data = new URL(req.url, 'http://x').searchParams.get('data') || todayLocalISO();
        if (!dataOk(data)) { json(res, 400, { error: 'data (AAAA-MM-GG) non valida' }); return; }
        const g = new Date(data + 'T12:00:00'), lun = addDays(g, -((g.getDay() + 6) % 7));
        const wk = findDetailedWeek(fmtISO(lun)), riposo = s => REST_NAMES.has(baseName(s || ''));
        json(res, 200, { lunedi: fmtISO(lun), fase: wk ? wk.phase.name : null, settimana: wk ? wk.week.label : null,
            gare: (SEASON.events || []).map(e => ({ nome: e.name, data: e.date, priorita: e.priority, km: e.km, dislivello: e.elev })),
            giorni: wk ? wk.week.days.map((d, i) => ({ data: fmtISO(addDays(lun, i)), giorno: d.d, nome: baseName(d.s || ''), dur: d.dur || '', zona: d.zone || '', riposo: riposo(d.s) || d.zone === 'Rec' })) : [] });
        return;
    }
    if (req.method === 'GET' && req.url === '/api/next-workout') {
        // "Prossimo allenamento" letto dal piano stagionale (season-plan.js), non dal
        // calendario intervals.icu: quest'ultimo resta vuoto finché non fai "Manda su
        // intervals.icu", il piano invece sa sempre cosa tocca fare.
        try {
            const todayISO = todayLocalISO();
            let found = null, dateISO = null;
            for (let i = 0; i < 10 && !found; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const iso = fmtISO(d);
                const wk = findDetailedWeek(iso);
                if (!wk) continue;
                const dayIdx = (d.getDay() + 6) % 7; // Lun=0..Dom=6
                const day = wk.week.days[dayIdx];
                if (day.s === 'Riposo' || day.s === 'Riposo o Passeggiata') continue;
                if (iso === todayISO) {
                    const todayActs = await intervalsGet(`/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${todayISO}&newest=${todayISO}`);
                    if (Array.isArray(todayActs) && todayActs.length > 0) continue; // oggi già fatto
                }
                found = day;
                dateISO = iso;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(found ? { name: found.s, dateISO, isToday: dateISO === todayISO } : null));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/ftp-tests') {
        try {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readFtpTests()));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/ftp-tests') {
        try {
            const body = await readBody(req);
            const value = parseInt(body.value, 10);
            if (!value || value < 50 || value > 700) throw new Error('Valore FTP non plausibile');
            if (!body.date || !body.testType) throw new Error('Data e tipo di test sono obbligatori');

            const updated = await updateAthleteFtp(value);
            const list = readFtpTests();
            const entry = { date: body.date, value, testType: body.testType, savedAt: new Date().toISOString() };
            if (body.cp) entry.cp = parseInt(body.cp, 10);
            if (body.wPrime) entry.wPrime = parseInt(body.wPrime, 10);
            if (body.maxHr) entry.maxHr = parseInt(body.maxHr, 10);
            if (body.rawInputs) entry.rawInputs = body.rawInputs;
            list.push(entry);
            writeFtpTests(list);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, entry, ftp: updated.ftp }));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/saved-meals') {
        try {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readSavedMeals()));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/saved-meals') {
        try {
            const body = await readBody(req);
            const list = readSavedMeals();
            const entry = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                mealName: body.mealName,
                items: body.items,
                p: body.p, fat: body.fat, c: body.c, kcal: body.kcal,
                note: body.note || '',
                craving: body.craving || '',
                savedAt: new Date().toISOString()
            };
            list.push(entry);
            writeSavedMeals(list);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(entry));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'DELETE' && req.url.startsWith('/api/saved-meals/')) {
        try {
            const id = req.url.split('/').pop();
            const list = readSavedMeals().filter(m => m.id !== id);
            writeSavedMeals(list);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ removed: true }));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/automation/status') {
        try {
            const status = cronStatus();
            status.recentLog = tailFile(path.join(__dirname, 'automation-log.md'), 20);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/automation/install') {
        try {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(installCron()));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/automation/remove') {
        try {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(removeCron()));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/push-week') {
        try {
            const body = await readBody(req);
            if (!Array.isArray(body.days) || body.days.length !== 7 || !body.weekStart) {
                throw new Error('Payload non valido: servono 7 giorni e weekStart (YYYY-MM-DD)');
            }
            const results = await pushWeekToIntervals(body.days, body.weekStart);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ results }));
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    let filePath = req.url === '/' ? '/dashboard.html' : req.url.split('?')[0];
    try { filePath = path.join(__dirname, decodeURIComponent(filePath)); } catch (e) { res.writeHead(400); res.end(); return; }
    // 02/11/2026: solo file da pagina web. Prima usciva tutto: .env (chiavi), token Strava, webhook, dati personali in .json
    const rel = path.relative(__dirname, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep).some(x => x.startsWith('.') || x === 'node_modules')
        || !STATICI.has(path.extname(filePath))) { res.writeHead(404); res.end('Not found'); return; }

    fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(content);
    });
});

server.listen(PORT, () => console.log(`MirabiWatt server running on http://localhost:${PORT}`));

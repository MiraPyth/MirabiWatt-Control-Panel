// MirabiWatt · allenamento configurato a passi dall'app Fit (11/11/2026). Pura: i passi scelti dall'utente (riscaldamento, lavoro,
// ripetute con recupero, defaticamento) diventano il testo nativo di intervals.icu, che poi Garmin sincronizza.
// Le ripetute sono sempre piatte (un blocco «Nx» con lavoro e recupero): intervals.icu non supporta le ripetizioni annidate.
const RUOLI = ['riscaldamento', 'lavoro', 'defaticamento'];
const INTESTAZIONE = { riscaldamento: 'Warmup', lavoro: 'Main Set', defaticamento: 'Cooldown' };
const ZONA_MAX = { ciclismo: 7, corsa: 5, nuoto: 5 };
const MAX_PASSI = 40;
const DURATA_MIN_SEC = 5;
const DURATA_MAX_SEC = 8 * 3600;
const TOTALE_MAX_SEC = 8 * 3600;
const RIPETIZIONI = [2, 50];

/** 10 -> «10s», 90 -> «1m30s», 600 -> «10m», 3750 -> «1h2m30s». */
function durataIcu(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}${s ? `${s}s` : ''}`;
}

const bersaglio = (zona, sport) => (sport === 'ciclismo' ? `Z${zona}` : `Z${zona} Pace`);
const riga = (sec, zona, sport) => `- ${durataIcu(sec)} ${bersaglio(zona, sport)}`;

/** Secondi totali dell'allenamento. */
function durataTotaleSec(passi) {
    return passi.reduce((n, p) => n + (p.tipo === 'ripetute' ? p.ripetizioni * (p.lavoro.durataSec + p.recupero.durataSec) : p.durataSec), 0);
}

/** Il testo nativo: intestazioni Warmup / Main Set / Cooldown, un blocco per passo, righe vuote tra i blocchi. */
function testoDaPassi(passi, sport) {
    const blocchi = [];
    let ultimo = null;
    for (const p of passi) {
        const ruolo = p.tipo === 'ripetute' ? 'lavoro' : p.ruolo;
        const corpo = p.tipo === 'ripetute'
            ? `${p.ripetizioni}x\n${riga(p.lavoro.durataSec, p.lavoro.zona, sport)}\n${riga(p.recupero.durataSec, p.recupero.zona, sport)}`
            : riga(p.durataSec, p.zona, sport);
        blocchi.push(ruolo !== ultimo ? `${INTESTAZIONE[ruolo]}\n${corpo}` : corpo);
        ultimo = ruolo;
    }
    return blocchi.join('\n\n');
}

const durataOk = s => Number.isInteger(s) && s >= DURATA_MIN_SEC && s <= DURATA_MAX_SEC;

/** Messaggio sul primo problema dei passi, o null se vanno bene. */
function validaPassi(passi, sport) {
    if (!ZONA_MAX[sport]) return 'sport non valido per un allenamento a passi';
    if (!Array.isArray(passi)) return 'passi non validi';
    if (!passi.length) return 'serve almeno un passo';
    if (passi.length > MAX_PASSI) return `troppi passi (massimo ${MAX_PASSI})`;
    const zonaOk = z => Number.isInteger(z) && z >= 1 && z <= ZONA_MAX[sport];
    let rango = 0;
    for (const p of passi) {
        if (!p || (p.tipo !== 'passo' && p.tipo !== 'ripetute')) return 'passo non valido';
        const ruolo = p.tipo === 'ripetute' ? 'lavoro' : p.ruolo;
        const r = RUOLI.indexOf(ruolo);
        if (r < 0) return 'ruolo del passo non valido';
        if (r < rango) return ruolo === 'riscaldamento' ? 'il riscaldamento va all\'inizio' : 'il defaticamento va alla fine';
        rango = r;
        const parti = p.tipo === 'ripetute' ? [p.lavoro, p.recupero] : [p];
        if (p.tipo === 'ripetute' && (!Number.isInteger(p.ripetizioni) || p.ripetizioni < RIPETIZIONI[0] || p.ripetizioni > RIPETIZIONI[1])) return `le ripetizioni vanno da ${RIPETIZIONI[0]} a ${RIPETIZIONI[1]}`;
        for (const x of parti) {
            if (!x || !durataOk(x.durataSec)) return 'la durata di ogni passo va da 5 secondi a 8 ore';
            if (!zonaOk(x.zona)) return `la zona va da 1 a ${ZONA_MAX[sport]}`;
        }
    }
    if (durataTotaleSec(passi) > TOTALE_MAX_SEC) return 'allenamento troppo lungo (massimo 8 ore)';
    return null;
}

module.exports = { testoDaPassi, durataTotaleSec, durataIcu, validaPassi };

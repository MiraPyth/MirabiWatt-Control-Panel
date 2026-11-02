// Genera piani/mixed-body-building.json. Richieste dell'utente:
// - 19/10/2026: lun/mer/ven palestra, mar HIT (Zwift Race d'inverno, VO2max all'aperto), gio endurance, un lungo outdoor
//   sabato O domenica (di base domenica, sabato libero per spostarlo);
// - 19/10 sera: un piano per migliorare fisico e prestazione in generale, NON centrato sulle gare (Tratturo Magno e Nove
//   Colli sono eventi facoltativi: «settimana evento» scelta da Ripianifica); costruzione in inverno, definizione da gennaio.
// Struttura annuale e numeri: sintesi-ricomposizione-corporea.md (Pyramid Training/Nutrition, RP, studi).
// Le settimane prima dell'inizio della palestra sono copiate dal piano full cycling (storico vero).
// Uso: node scripts/piano-mixed.js [AAAA-MM-GG]   (lunedì d'inizio, di base il 26/10)
const fs = require('fs');
const path = require('path');
const { parseISO, addDays, fmtISO, mondayOf } = require('../season-plan.js');
const { SCHEMI_PALESTRA } = require('../workout-library.js');
const FILE_FULL = path.join(__dirname, '..', 'piani', 'full-cycling.json');
const FILE_MIX = path.join(__dirname, '..', 'piani', 'mixed-body-building.json');
// 25/10/2026: settimane decise a mano (es. fuori casa con gli elastici), per lunedì: { "AAAA-MM-GG": settimana }.
// Sostituiscono la settimana generata e restano anche quando il piano si rigenera con un altro inizio.
const FILE_SPECIALI = path.join(__dirname, '..', 'piani', 'settimane-speciali.json');
const INIZIO_PREDEFINITO = '2026-10-26';
const INIZIO_MIN = '2026-10-19', INIZIO_MAX = '2026-11-09';
const DEFINIZIONE_DA = '2027-01-04', DEFINIZIONE_FINO = '2027-03-28';
const MANTENIMENTO_FINO = '2027-09-26', TRANSIZIONE_FINO = '2027-10-10';
const giorno = (iso, n) => fmtISO(addDays(parseISO(iso), n));

/** Le fasi del piano full cycling prima di `inizio`, tagliate alla settimana. */
function prima(full, inizio) {
    const out = [];
    for (const f of full.detailedPhases) {
        if (f.start >= inizio) break;
        const settimane = f.weeks.filter((_, i) => giorno(fmtISO(mondayOf(parseISO(f.start))), i * 7) < inizio);
        out.push(f.end < inizio ? f : { ...f, end: giorno(inizio, -1), weeks: settimane });
    }
    return out;
}

const NOTA_LUNGO = 'Outdoor, sabato o domenica: quella col meteo migliore. Per farlo sabato: Ripianifica → domenica non disponibile.';
const PERCHE_BICI = {
    base: 'In bici: martedì la seduta intensa, il resto in Z2. Una sola HIT a intensità piena mantiene il VO2max (Spiering 2021) e il volume aerobico a bassa intensità non toglie muscolo (Schumann 2022).',
    scarico: 'Anche la bici cala del 30-40%: la fatica si smaltisce insieme, palestra e sella.',
    definizione: 'In definizione la bici prende un po\' di spazio (endurance più lunga): aiuta il deficit senza toccare il muscolo. Il deficit si fa nei giorni di palestra e riposo, mai sotto i lunghi e la HIT (disponibilità energetica, IOC RED-S 2018).'
};

// Una settimana tipo. g = { schema, gio, gioS, lungo, lungoS, lungoZ, mar, special, nutrizione, noteLun, noteMar, bici }
function settimana(label, g) {
    const durPal = { scarico: '45\'', mantenimento: '50\'' }[g.schema] || (/adattamento [12]/.test(g.schema) ? '50\'' : '75\'');
    const pal = (s, note) => ({ s: `${s} (${g.schema})`, dur: durPal, zone: 'Palestra', ...(note ? { note } : {}) });
    const days = [
        pal('Petto-Spalle', g.noteLun),
        { s: 'Zwift Race', dur: g.mar || '60-75\'', zone: 'HIT', critical: true, note: g.noteMar || 'Seduta intensa della settimana. Quando smetti i rulli: intervalli VO2max all\'aperto (30/15, 4×8\' o 5×5\').' },
        pal('Gambe-Core', 'Gambe mai a cedimento: giovedì pedali e nel weekend c\'è il lungo.'),
        { s: g.gioS || 'EnduranceCorto', dur: g.gio, zone: 'Z2', note: 'Rulli o outdoor, conversazionale.' },
        pal('Schiena-Bicipiti', 'Niente gambe: arrivi fresco al lungo.'),
        { s: 'Riposo', note: 'Libero. Se il lungo lo fai oggi, domenica diventa il riposo.' },
        { s: g.lungoS || 'EnduranceLungo', dur: g.lungo, zone: g.lungoZ || 'Z2', critical: true, note: NOTA_LUNGO }
    ];
    ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach((d, i) => { days[i] = { ...days[i], d }; });
    return { label, special: g.special, nutrizione: g.nutrizione,
        perche: `In palestra: ${SCHEMI_PALESTRA[g.schema].perche} ${PERCHE_BICI[g.bici || 'base']}`, days };
}

const SETT_COSTRUZIONE = [
    { schema: 'costruzione 1', gio: '1h15', lungo: '2h45', special: 'Parte la costruzione: mesociclo di 4 settimane + scarico. Volume di partenza, RIR 3, e un piccolo surplus calorico (+150 kcal).' },
    { schema: 'costruzione 2', gio: '1h30', lungo: '3h', gioS: 'EnduranceMedio', special: 'Stesse serie, RIR 2. Dove hai chiuso tutte le serie al massimo delle ripetizioni, sali di peso.' },
    { schema: 'costruzione 3', gio: '1h30', lungo: '3h', gioS: 'EnduranceMedio', special: 'Una serie in più su petto, spalle, bicipiti e addome. Dormi almeno 7 ore: è lì che il muscolo cresce.' },
    { schema: 'costruzione 4', gio: '1h30', lungo: '3h15', gioS: 'EnduranceMedio', lungoS: 'MedioLungo', lungoZ: 'Z2/Z3bassa', special: 'La settimana più dura del mesociclo: isolamenti fino a RIR 0. Poi scarico.' },
    { schema: 'scarico', gio: '1h', lungo: '2h', gioS: 'EnduranceCadenza', mar: '45-60\'', bici: 'scarico', special: 'Scarico vero, in palestra e in bici. Non è tempo perso: è dove la fatica se ne va e il muscolo cresce.', noteMar: 'Versione corta: gara breve o solo il primo giro tirato.' }
];
const SETT_DEFINIZIONE = [
    { schema: 'definizione 1', gio: '1h30', lungo: '3h', gioS: 'EnduranceMedio', bici: 'definizione', special: 'Parte la definizione: deficit di circa 400-500 kcal nei giorni di palestra e riposo, proteine a 2,4 g/kg. Obiettivo −0,4/−0,8 kg a settimana.' },
    { schema: 'definizione 2', gio: '1h45', lungo: '3h', gioS: 'EnduranceMedio', bici: 'definizione', special: 'Stessi carichi della costruzione: se il peso sul bilanciere tiene, il muscolo resta.' },
    { schema: 'definizione 3', gio: '1h45', lungo: '3h15', gioS: 'EnduranceMedio', bici: 'definizione', special: 'Se il peso non scende da 2 settimane, togli 150 kcal dai giorni di palestra. Se scende più di 0,8 kg a settimana, aggiungile.' },
    { schema: 'definizione 4', gio: '1h45', lungo: '3h30', gioS: 'EnduranceMedio', lungoS: 'MedioLungo', lungoZ: 'Z2/Z3bassa', bici: 'definizione', special: 'Ultima settimana del mesociclo. Poi scarico e pausa dalla dieta.' },
    { schema: 'scarico', gio: '1h', lungo: '2h', gioS: 'EnduranceCadenza', mar: '45-60\'', bici: 'scarico', nutrizione: 'mantenimento', special: 'Scarico + pausa dalla dieta: una settimana a calorie di mantenimento (Pyramid Nutrition: 1-2 settimane ogni ~8 di dieta; MATADOR). Ripartono fame, umore e prestazione.' }
];

/** Sostituisce le settimane il cui lunedì è fra le chiavi di `speciali`. */
function applicaSpeciali(fasi, speciali) {
    if (!speciali || !Object.keys(speciali).length) return fasi;
    return fasi.map(f => {
        const l0 = fmtISO(mondayOf(parseISO(f.start)));
        return { ...f, weeks: f.weeks.map((w, i) => speciali[giorno(l0, i * 7)] || w) };
    });
}

function genera(full, inizio = INIZIO_PREDEFINITO, speciali = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inizio || '') || parseISO(inizio).getDay() !== 1) throw new Error('l\'inizio deve essere un lunedì');
    if (inizio < INIZIO_MIN || inizio > INIZIO_MAX) throw new Error(`inizio tra ${INIZIO_MIN} e ${INIZIO_MAX}`);

    const riadatt = {
        id: 'riadatt', name: 'Ri-adattamento palestra', start: inizio, end: giorno(inizio, 27), nutrizione: 'mantenimento',
        weeks: [
            settimana('Sett. 1', { schema: 'adattamento 1', gio: '1h15', lungo: '2h30', nutrizione: 'mantenimento',
                special: 'Si cambia rotta: tre palestre, la seduta intensa del martedì, un\'endurance e il lungo nel weekend. Prima settimana in palestra dopo anni: poche serie, lontano dal cedimento. Il dolore muscolare dei primi giorni è previsto.',
                noteLun: 'Prima seduta: carichi con cui faresti 4 ripetizioni in più di quelle scritte.', noteMar: 'Spalle indolenzite dalla palestra: in bici non pesa, corri normale.' }),
            settimana('Sett. 2', { schema: 'adattamento 2', gio: '1h15', lungo: '2h45', nutrizione: 'mantenimento',
                special: 'Stesse serie, un po\' più vicino al limite. Se mercoledì le gambe sono ancora indolenzite da lunedì, resta leggero.' }),
            settimana('Sett. 3', { schema: 'adattamento 3', gio: '1h30', lungo: '3h', nutrizione: 'mantenimento',
                special: 'Serie piene della scheda, RIR 2-3.' }),
            settimana('Sett. 4', { schema: 'adattamento 4', gio: '1h30', lungo: '3h', gioS: 'EnduranceAgile', nutrizione: 'mantenimento',
                special: 'Ultima di ri-adattamento: annota i carichi di ogni esercizio, sono la partenza della costruzione.' })
        ]
    };
    const costruzione = {
        id: 'costruzione', name: 'Costruzione', start: giorno(inizio, 28), end: giorno(inizio, 62), nutrizione: 'costruzione',
        weeks: SETT_COSTRUZIONE.map((g, i) => settimana(i === 4 ? 'Sett. 5 — Scarico' : `Sett. ${i + 1}`, { nutrizione: 'costruzione', ...g }))
    };
    const fasi = [riadatt, costruzione];

    // tra la fine della costruzione e la definizione: le feste, a schema libero
    const dopoCostruzione = giorno(costruzione.end, 1);
    const inizioDef = dopoCostruzione > DEFINIZIONE_DA ? dopoCostruzione : DEFINIZIONE_DA;
    if (dopoCostruzione < inizioDef) {
        const n = Math.round((parseISO(inizioDef) - parseISO(dopoCostruzione)) / (7 * 86400000));
        fasi.push({ id: 'feste', name: 'Feste', start: dopoCostruzione, end: giorno(inizioDef, -1), nutrizione: 'mantenimento',
            weeks: Array.from({ length: n }, (_, i) => settimana(`Sett. ${i + 1}`, { schema: 'costruzione 2', gio: '1h', lungo: '2h30', nutrizione: 'mantenimento',
                special: 'Feste: schema libero. Bastano 2 palestre e un\'uscita per non perdere niente; calorie al mantenimento, senza contare ogni grammo.' })) });
    }
    const nDef = Math.round((parseISO(DEFINIZIONE_FINO) - parseISO(inizioDef)) / (7 * 86400000)) + 1;
    fasi.push({ id: 'definizione', name: 'Definizione', start: inizioDef, end: DEFINIZIONE_FINO, nutrizione: 'definizione',
        weeks: Array.from({ length: nDef }, (_, i) => settimana(i % 5 === 4 ? `Sett. ${i + 1} — Scarico e pausa dieta` : `Sett. ${i + 1}`,
            { nutrizione: 'definizione', ...SETT_DEFINIZIONE[i % 5] })) });

    return {
        id: 'mixed-body-building',
        nome: 'Piano invernale mixed body building',
        inizioPalestra: inizio,
        start: full.start,
        events: full.events,
        eventiFacoltativi: true,
        detailedPhases: applicaSpeciali([...prima(full, inizio), ...fasi], speciali),
        summaryPhases: [
            { id: 'mantenimento', name: 'Mantenimento e prestazione', start: giorno(DEFINIZIONE_FINO, 1), end: MANTENIMENTO_FINO, hours: '7-10h', hit: '1-2', nutrizione: 'mantenimento',
              focus: 'Stagione all\'aperto: più bici, palestra a 2 sedute di forza e mantenimento, calorie al mantenimento.',
              zoneMix: { z1z2: 75, z3: 13, z4plus: 12 },
              detail: 'Dopo la dieta 4-8 settimane al mantenimento stabilizzano peso e prestazione (Trexler 2014). La palestra scende a 2 sedute con un terzo del volume e carichi pieni: basta a mantenere il muscolo (Bickel 2011, Spiering 2021). Il martedì diventa VO2max all\'aperto (30/15 Rønnestad, 4×8\' Seiler, 5×5\' hard-start), al massimo un\'altra seduta di qualità a settimana. Le gare sono «settimane evento» facoltative.' },
            { id: 'transizione', name: 'Transizione', start: giorno(MANTENIMENTO_FINO, 1), end: TRANSIZIONE_FINO, hours: 'libere', hit: '0', nutrizione: 'mantenimento',
              focus: 'Due settimane libere, poi si riparte con la costruzione dai carichi raggiunti.',
              zoneMix: { z1z2: 100, z3: 0, z4plus: 0 },
              detail: 'Saltare la pausa tra un ciclo e l\'altro è la causa più comune di esaurimento (Friel). Due settimane senza piano, attivo ma libero.' }
        ],
        planB: {
            ridotta: 'Tieni martedì, una palestra (lunedì) e il lungo accorciato del 40%. Il resto è riposo.',
            recupero: full.planB.recupero,
            evento: 'Settimana evento: volume −40/−50%, una sola palestra leggera di parte alta, openers il giorno prima, carboidrati pieni nei 2 giorni prima. Il giorno dopo il piano riprende.'
        }
    };
}

/** Rigenera il file del piano con un nuovo inizio; restituisce il piano. */
function leggiSpeciali(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; }
}

function scrivi(inizio = INIZIO_PREDEFINITO, fileFull = FILE_FULL, fileMix = FILE_MIX, fileSpeciali = FILE_SPECIALI) {
    const piano = genera(JSON.parse(fs.readFileSync(fileFull, 'utf8')), inizio, leggiSpeciali(fileSpeciali));
    fs.writeFileSync(fileMix, JSON.stringify(piano, null, 2) + '\n');
    return piano;
}

module.exports = { genera, scrivi, INIZIO_MIN, INIZIO_MAX, INIZIO_PREDEFINITO };

if (require.main === module) {
    scrivi(process.argv[2] || INIZIO_PREDEFINITO);
    console.log('piani/mixed-body-building.json scritto');
}

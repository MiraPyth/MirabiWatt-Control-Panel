// MirabiWatt Workout Library — traduce i nomi delle sessioni in step concreti
// (potenza calcolata sul FTP/CP live dell'atleta) + testo in formato nativo
// intervals.icu, pronto per il push via API (POST .../events, campo "description").
// Sintassi nativa VERIFICATA con push reali: righe "- durata target%" sequenziali,
// blocchi "Nx" per le ripetute a UN SOLO livello (le ripetute annidate NON sono
// supportate da intervals.icu — confermato da test reale + forum ufficiale).

function w(pct, ftp) { return Math.round(ftp * pct); }
function pctLabel(lo, hi) { return lo === hi ? `${Math.round(lo * 100)}%` : `${Math.round(lo * 100)}-${Math.round(hi * 100)}%`; }
function wattsLabel(lo, hi, ftp) { return lo === hi ? `${w(lo, ftp)}W` : `${w(lo, ftp)}-${w(hi, ftp)}W`; }

function baseName(sessionName) {
    return (sessionName || '').replace(/\s*\(.*?\)\s*$/, '').trim();
}

// Costruisce sia i durMin/watts per la UI sia il testo nativo intervals.icu da UNA
// sola lista di step (niente doppia definizione, niente rischio di disallineamento).
// Step flat: { text, durMin|durSec, lo, hi, cadence?, warmup?, cooldown? }
// Step ripetuto: { text, repeat: N, subSteps: [{durMin|durSec, lo, hi, cadence?}, ...], warmup?, cooldown? }
// (lo/hi = frazione di FTP, cadence in rpm). Un solo livello di ripetute: intervals.icu
// non supporta ripetute annidate.
function durLabel(s) { return s.durSec != null ? `${s.durSec}s` : `${s.durMin}m`; }
function durAsMin(s) { return s.durSec != null ? s.durSec / 60 : s.durMin; }

function compile(steps, ftp) {
    let totalMin = 0;
    const uiSteps = [];
    const lines = [];

    steps.forEach(s => {
        const header = s.warmup ? 'Warmup\n' : s.cooldown ? 'Cooldown\n' : '';
        if (s.repeat) {
            const blockMin = s.subSteps.reduce((sum, sub) => sum + durAsMin(sub), 0) * s.repeat;
            totalMin += blockMin;
            uiSteps.push({
                text: s.text, durMin: Math.round(blockMin),
                target: s.subSteps.map(sub => pctLabel(sub.lo, sub.hi) + (sub.cadence ? ` @ ${sub.cadence}rpm` : '')).join(' / '),
                watts: s.subSteps.map(sub => wattsLabel(sub.lo, sub.hi, ftp)).join(' / ')
            });
            const subLines = s.subSteps.map(sub => {
                const cadencePart = sub.cadence ? ` ${sub.cadence}rpm` : '';
                return `- ${durLabel(sub)} ${pctLabel(sub.lo, sub.hi)}${cadencePart}`;
            }).join('\n');
            lines.push(`${header}${s.repeat}x\n${subLines}`);
        } else {
            totalMin += durAsMin(s);
            uiSteps.push({
                text: s.text, durMin: durAsMin(s),
                target: pctLabel(s.lo, s.hi) + ' FTP' + (s.cadence ? ` @ ${s.cadence}rpm` : ''),
                watts: wattsLabel(s.lo, s.hi, ftp)
            });
            const cadencePart = s.cadence ? ` ${s.cadence}rpm` : '';
            lines.push(`${header}- ${durLabel(s)} ${pctLabel(s.lo, s.hi)}${cadencePart}`);
        }
    });

    return { totalMin, uiSteps, icuText: lines.join('\n\n') };
}

// Definizioni: { text, durMin, lo, hi, warmup?, cooldown? } — lo/hi in frazione di FTP.
// Z1 <=0.55 | Z2 0.56-0.75 | Z3 0.76-0.90 | Z4 0.91-1.05 | Z5 1.06-1.20 | Z6 1.21-1.50
const DEFS = {
    // 19/10/2026 sera: il giorno prima di un evento (settimana evento). Breve, qualche apertura sopra soglia per arrivare
    // «svegli» ma freschi (HNP «Peak race week»; Friel).
    'Openers': [
        { text: 'Riscaldamento progressivo', durMin: 15, lo: 0.55, hi: 0.7, warmup: true },
        { text: '3×[1\' a 105-110% / 2\' facile]', repeat: 3, subSteps: [{ durMin: 1, lo: 1.05, hi: 1.1 }, { durMin: 2, lo: 0.5, hi: 0.6 }] },
        { text: '3×[15" in sprint seduto / 1\'45" facile]', repeat: 3, subSteps: [{ durSec: 15, lo: 1.3, hi: 1.5 }, { durSec: 105, lo: 0.5, hi: 0.6 }] },
        { text: 'Defaticamento', durMin: 10, lo: 0.45, hi: 0.55, cooldown: true }
    ],
    'EnduranceCadenza': [
        { text: 'Riscaldamento, cadenza 90-95rpm', durMin: 15, lo: 0.56, hi: 0.75, cadence: '90-95', warmup: true },
        { text: '10x[1\' >100rpm / 1\' 80rpm] lavoro di cadenza (alternata, non fissa)', repeat: 10, subSteps: [
            { durMin: 1, lo: 0.56, hi: 0.75, cadence: '100+' },
            { durMin: 1, lo: 0.56, hi: 0.75, cadence: '80' }
        ] },
        { text: 'Facile', durMin: 10, lo: 0.45, hi: 0.55 },
        { text: '5\' a CP/CP-10W, cadenza 95-100rpm', durMin: 5, lo: 0.88, hi: 0.97, cadence: '95-100' },
        { text: 'Recupero facile tra le due ripetute', durMin: 5, lo: 0.4, hi: 0.5 },
        { text: '5\' a CP/CP-10W, cadenza 95-100rpm', durMin: 5, lo: 0.88, hi: 0.97, cadence: '95-100' },
        { text: '6x[1\'+1\'] come il riscaldamento (alternata, non fissa)', repeat: 6, subSteps: [
            { durMin: 1, lo: 0.56, hi: 0.75, cadence: '100+' },
            { durMin: 1, lo: 0.56, hi: 0.75, cadence: '80' }
        ] },
        { text: 'Defaticamento', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'EnduranceAgile': [
        { text: 'Riscaldamento 85-90rpm', durMin: 15, lo: 0.56, hi: 0.75, cadence: '85-90', warmup: true },
        { text: '10x[5\' a 90-95rpm + allungo 60" a cadenza crescente 110→125rpm, max Z3 bassa]', repeat: 10, subSteps: [
            { durMin: 5, lo: 0.56, hi: 0.75, cadence: '90-95' },
            { durSec: 60, lo: 0.76, hi: 0.83, cadence: '110-125' }
        ] },
        { text: 'Defaticamento, non sotto 85rpm', durMin: 10, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'EnduranceCorto': [
        { text: 'Riscaldamento', durMin: 10, lo: 0.5, hi: 0.6, warmup: true },
        { text: 'Tutto in Z2, 80-100rpm, percorso pianeggiante', durMin: 75, lo: 0.56, hi: 0.75, cadence: '80-100' },
        { text: 'Scarico finale', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'EnduranceMedio': [
        { text: 'Riscaldamento', durMin: 10, lo: 0.5, hi: 0.6, warmup: true },
        { text: 'Z2 a 90-100rpm — inserisci di tua iniziativa ~15 sprint di agilità 10" durante l\'uscita', durMin: 100, lo: 0.56, hi: 0.75, cadence: '90-100' },
        { text: 'Scarico finale', durMin: 10, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'EnduranceLungo': [
        { text: 'Prima ora Z2 bassa', durMin: 60, lo: 0.56, hi: 0.65, warmup: true },
        { text: 'Z2 alta/Z3 bassa — inserisci sprint 10" ogni 5\' di tua iniziativa', durMin: 120, lo: 0.65, hi: 0.83 },
        { text: 'Z3 continuativa (quarta ora), evita soste', durMin: 60, lo: 0.76, hi: 0.9 },
        { text: 'Defaticamento', durMin: 25, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'MedioMini': [
        { text: 'Riscaldamento', durMin: 15, lo: 0.56, hi: 0.65, warmup: true },
        { text: 'Blocco continuativo in Z3', durMin: 40, lo: 0.76, hi: 0.9 },
        { text: 'Rientro Z2', durMin: 15, lo: 0.56, hi: 0.75 },
        { text: 'Scarico', durMin: 10, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'MedioLungo': [
        { text: 'Riscaldamento cadenza alta 95-105rpm', durMin: 30, lo: 0.56, hi: 0.75, cadence: '95-105', warmup: true },
        { text: 'Vallonato/pianura — MAI sopra Z3 bassa (niente Z4)', durMin: 150, lo: 0.76, hi: 0.83 },
        { text: 'Scarico', durMin: 30, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'MedioCorto': [
        { text: 'Riscaldamento, cadenza 90-100rpm', durMin: 15, lo: 0.56, hi: 0.75, cadence: '90-100', warmup: true },
        { text: '2x5\' a CP/CP-5W (ultimi 30" a Z6, accelerazione impegnativa)', durMin: 12, lo: 0.9, hi: 0.98 },
        { text: '1h su base Z3, sprint 20" con rapportone ogni 5\'', durMin: 60, lo: 0.76, hi: 0.9 },
        { text: 'Scarico', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'MedioBillat': [
        { text: 'Riscaldamento', durMin: 20, lo: 0.56, hi: 0.75, warmup: true },
        { text: '75\' Z3 bassa/media', durMin: 75, lo: 0.78, hi: 0.85 },
        { text: 'Rientro Z2', durMin: 40, lo: 0.56, hi: 0.75 },
        { text: 'Scarico', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'MedioSaints': [
        { text: 'Riscaldamento', durMin: 22, lo: 0.56, hi: 0.75, warmup: true },
        { text: '60\' Z3 in pianura/vallonato', durMin: 60, lo: 0.76, hi: 0.9 },
        { text: 'Facile', durMin: 10, lo: 0.5, hi: 0.6 },
        { text: '12\' a CP/CP-10W', durMin: 12, lo: 0.88, hi: 0.97 },
        { text: 'Recupero', durMin: 10, lo: 0.5, hi: 0.6 },
        { text: 'Defaticamento', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'SweetBillat': [
        { text: 'Riscaldamento', durMin: 22, lo: 0.56, hi: 0.75, warmup: true },
        { text: '60\' Z3 alta / sweet spot', durMin: 60, lo: 0.84, hi: 0.94 },
        { text: 'Rientro Z2', durMin: 10, lo: 0.56, hi: 0.75 },
        { text: 'Scarico', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'CPSalita': [
        { text: 'Riscaldamento', durMin: 15, lo: 0.56, hi: 0.75, warmup: true },
        { text: 'Salita lunga, Z4 bassa (con allunghi Z6 di 30" ogni 2\' di tua iniziativa)', durMin: 40, lo: 0.91, hi: 0.97 },
        { text: '2x5\' in Z5', durMin: 10, lo: 1.06, hi: 1.15 },
        { text: 'Rientro Z2', durMin: 20, lo: 0.56, hi: 0.75 },
        { text: 'Defaticamento', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'CPRipetute': [
        { text: 'Riscaldamento', durMin: 20, lo: 0.56, hi: 0.75, warmup: true },
        { text: '6x10\' in Z4 (10\' recupero Z1 tra le rip. — incluso nel blocco)', durMin: 120, lo: 0.91, hi: 1.03 },
        { text: 'Rientro Z2', durMin: 10, lo: 0.56, hi: 0.75 },
        { text: 'Defaticamento', durMin: 10, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'VO2 Ripetute': [
        { text: 'Riscaldamento', durMin: 22, lo: 0.56, hi: 0.75, warmup: true },
        { text: '5x5\' a MMP10 (~105-110% FTP), 5\' recupero tra le rip. — incluso nel blocco', durMin: 50, lo: 1.05, hi: 1.1 },
        { text: 'Rientro Z2', durMin: 8, lo: 0.56, hi: 0.75, cooldown: true }
    ],
    'VO2Medio': [
        { text: 'Riscaldamento', durMin: 30, lo: 0.56, hi: 0.75, warmup: true },
        { text: '10\' Z4, ultimo minuto Z4alta/Z5bassa', durMin: 10, lo: 0.91, hi: 1.06 },
        { text: 'Facile', durMin: 10, lo: 0.5, hi: 0.6 },
        { text: '5x6\' (3\' a CP + 3\' in Z5), 8\' recupero — incluso nel blocco', durMin: 90, lo: 0.95, hi: 1.1 },
        { text: 'Defaticamento', durMin: 10, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'Polarizzato': [
        { text: 'Riscaldamento', durMin: 15, lo: 0.56, hi: 0.75, warmup: true },
        { text: '80% del tempo in Z2, tratti in soglia Z4 su salite/segmenti di almeno 10\' (distribuiscili tu durante il giro)', durMin: 150, lo: 0.65, hi: 0.75 },
        { text: 'Defaticamento', durMin: 15, lo: 0.4, hi: 0.5, cooldown: true }
    ],
    'Scarico': [
        { text: 'Tutto Z1, picchi max Z2 bassa. Evita muri.', durMin: 70, lo: 0.45, hi: 0.6, warmup: true, cooldown: true }
    ],
    'Test CP': [
        { text: 'Riscaldamento', durMin: 20, lo: 0.56, hi: 0.75, warmup: true },
        { text: 'Massimale 5\' (a sensazione, target indicativo)', durMin: 5, lo: 1.1, hi: 1.25 },
        { text: 'Recupero', durMin: 40, lo: 0.5, hi: 0.65 },
        { text: 'Massimale 15\' (a sensazione, target indicativo)', durMin: 15, lo: 0.9, hi: 1.0 },
        { text: 'Rientro', durMin: 10, lo: 0.5, hi: 0.6, cooldown: true }
    ]
};

function uscitaLibera(label, minuti, testo) {
    return { label, totalMin: minuti, isFreeform: true, uiSteps: [{ text: testo, durMin: minuti, target: 'Z1-Z2' }], icuText: null,
        plainDescription: `${testo} Se invece hai la MTB con te: ${minuti}-60' in Z2.` };
}

const LIBRARY = {
    'Riposo': () => ({ label: 'Riposo', totalMin: 0, uiSteps: [{ text: 'Riposo completo. Stretching leggero se va.' }], icuText: null, isRest: true }),
    'Riposo o Passeggiata': () => ({ label: 'Riposo attivo', totalMin: 0, uiSteps: [{ text: 'Passeggiata leggera facoltativa + stretching.' }], icuText: null, isRest: true }),

    'Corpo libero e MSR': () => ({
        label: 'Corpo libero e MSR', totalMin: 50,
        uiSteps: [
            { text: 'Riscaldamento articolare: cerchi con le braccia, rotazioni anche, 10x squat a corpo libero, 10x affondo in camminata per lato, 10x cat-cow', durMin: 10 },
            { text: 'Core: 3x30-45\'\' plank, 2x20-30\'\' plank laterale per lato, 3x10 bird-dog per lato, 3x10 dead bug per lato', durMin: 10 },
            { text: 'Gambe/equilibrio: 3x15 squat a corpo libero, 3x10 affondi bulgari per gamba (o affondi normali senza rialzo), 3x8 stacco su una gamba per gamba, 3x15 calf raises', durMin: 15 },
            { text: 'Foam roller (MSR): quadricipiti 1-2\' a gamba, banda ileotibiale 1-2\' a gamba, polpacci 1\' a gamba, glutei 1-2\' a lato — piano, mai sulla zona lombare/articolazioni', durMin: 15 }
        ],
        icuText: null,
        plainDescription: 'Sessione di muscolatura, equilibrio e defaticamento per ciclisti — 50\'. Riscaldamento (10\'), core (10\'), gambe/equilibrio (15\'), foam roller (15\').'
    }),

    // 25/10/2026, settimana fuori casa: uscita a piedi (o in MTB se c'è) e il giro in mountain bike del weekend.
    // Niente watt: sulla MTB si va a sensazione e frequenza cardiaca.
    'Uscita a pranzo': () => uscitaLibera('Uscita a pranzo', 45, 'Camminata veloce, meglio se in salita, o corsa leggera: devi riuscire a parlare. A metà, se ti va, 6 allunghi da 20" in progressione con 1\' di camminata in mezzo: tengono sveglie le gambe senza fatica.'),
    'Uscita facoltativa': () => uscitaLibera('Uscita facoltativa', 40, 'Solo se ti avanza tempo: camminata veloce o corsa leggera, tutto facile. Se salta non perdi niente: settimana di scarico. In alternativa 15\' di mobilità con l\'elastico.'),
    'MTB Endurance': () => ({
        label: 'MTB Endurance', totalMin: 135, isFreeform: true,
        uiSteps: [
            { text: 'Primi 20\' facili su strada o sterrato scorrevole', durMin: 20, target: 'Z1-Z2' },
            { text: 'Giro in Z2 a sensazione: in salita seduto, rapporto agile, respiro controllato. Sui tratti ripidi non inseguire il ritmo: se serve, a piedi', durMin: 100, target: 'Z2, al massimo Z3 sui muri' },
            { text: 'Ultimi 15\' sciolti, discese tranquille', durMin: 15, target: 'Z1' }
        ],
        icuText: null,
        plainDescription: 'Giro in mountain bike di 2h-2h30, tutto aerobico: è la seduta lunga della settimana di scarico. Sulla MTB la potenza non c\'è: vai a sensazione e frequenza cardiaca, in salita seduto e agile. Mangia ogni 40-45\' e bevi spesso.'
    }),

    'Ramp Test': (ftp) => {
        // Ramp continuo (approssimazione della staircase Zwift): 15' da ~60% a ~160% FTP
        const c = compile([
            { text: 'Riscaldamento', durMin: 10, lo: 0.5, hi: 0.65, warmup: true },
            { text: 'Defaticamento', durMin: 5, lo: 0.4, hi: 0.5, cooldown: true }
        ], ftp);
        return {
            label: 'Ramp Test (Zwift)', totalMin: 30,
            uiSteps: [
                { text: 'Riscaldamento', durMin: 10, target: '50-65% FTP', watts: wattsLabel(0.5, 0.65, ftp) },
                { text: 'Ramp continuo: potenza in salita costante fino a cedimento', durMin: 15, target: '60→160% FTP', watts: `${w(0.6, ftp)}→${w(1.6, ftp)}W` },
                { text: 'Defaticamento', durMin: 5, target: '<50% FTP', watts: `<${w(0.5, ftp)}W` }
            ],
            icuText: `Warmup\n- 10m 50-65%\n\nRamp Test\n- 15m ramp 60-160%\n\nCooldown\n- 5m 50%`
        };
    },

    'Zwift Race': (ftp) => ({
        label: 'Zwift Race', totalMin: 70, isFreeform: true,
        uiSteps: [
            { text: 'Riscaldamento libero', durMin: 10, target: 'Z1-Z2', watts: wattsLabel(0.55, 0.75, ftp) },
            { text: 'Gara: sforzo variabile, tipicamente sopra soglia nei momenti chiave', durMin: 50, target: 'Z4-Z6', watts: `${w(0.9, ftp)}-${w(1.4, ftp)}W+` },
            { text: 'Defaticamento', durMin: 10, target: 'Z1', watts: `<${w(0.55, ftp)}W` }
        ],
        icuText: null, // una gara non è pre-programmabile a step: è per natura un evento libero
        plainDescription: 'Partecipa a una gara Zwift a tua scelta (~60-75 min). Riscaldati 10\' prima, defatica 10\' dopo.'
    }),

    '30/15 Short Intervals': (ftp) => ({
        label: '30/15 Short Intervals (Rønnestad)', totalMin: 60,
        uiSteps: [
            { text: 'Riscaldamento', durMin: 15, target: '55-70% FTP', watts: wattsLabel(0.55, 0.7, ftp) },
            { text: '3 serie di 13x[30" hard/15" facile] (9.5\'/serie), 3\' recupero tra le serie', durMin: 35, target: '120-130% on / 40% off', watts: `${w(1.2, ftp)}-${w(1.3, ftp)}W on / ${w(0.4, ftp)}W off` },
            { text: 'Defaticamento', durMin: 10, target: '50% FTP', watts: wattsLabel(0.5, 0.5, ftp) }
        ],
        // Ripetute annidate NON supportate da intervals.icu — 3 blocchi da 13x scritti "piatti"
        icuText: 'Warmup\n- 15m 55-70%\n\nMain Set\n13x\n- 30s 120-130%\n- 15s 40%\n\n- 3m 55%\n\n13x\n- 30s 120-130%\n- 15s 40%\n\n- 3m 55%\n\n13x\n- 30s 120-130%\n- 15s 40%\n\nCooldown\n- 10m 50%'
    })
};

// Genera automaticamente le voci sequenziali (senza ripetute) da DEFS, così i numeri
// mostrati nel dettaglio e quelli inviati a intervals.icu vengono sempre dalla stessa fonte.
Object.keys(DEFS).forEach(name => {
    LIBRARY[name] = (ftp) => {
        const c = compile(DEFS[name], ftp);
        return { label: name, totalMin: c.totalMin, uiSteps: c.uiSteps, icuText: c.icuText };
    };
});

// Palestra del «Piano invernale mixed body building» (19/10/2026; scheda 2 dal 19/10 sera, dopo «The Muscle and Strength
// Pyramid: Training» di Helms e «Scientific Principles of Hypertrophy Training» di Renaissance Periodization).
// Priorità dell'utente: spalle, petto, bicipiti, addome → «specializzazione» (Pyramid, tab. 3.9): circa 1,5 volte il
// volume sui gruppi prioritari (14-18 serie/settimana), 6-12 sugli altri; gambe moderate e pesanti perché c'è la bici.
// Mesociclo RP: si parte vicino al volume minimo efficace (MEV) con RIR 3, si scende a RIR 0-1 e si aggiunge una serie
// sui prioritari, poi scarico. RIR = ripetizioni lasciate in canna. Lo schema della settimana sta tra parentesi nel nome
// della seduta: «Petto-Spalle (costruzione 2)».
const SCHEMI_PALESTRA = {
    'adattamento 1': { delta: -1, rir: '4', nota: 'Ri-adattamento, settimana 1: una serie in meno, carichi leggeri, si reimpara il movimento.',
        perche: 'Dopo anni di stop tendini e tecnica si riadattano più lentamente dei muscoli: si parte sotto il volume minimo efficace, lontano dal cedimento (RP: «parti basso, è più facile salire che rimediare»).' },
    'adattamento 2': { delta: -1, rir: '3', nota: 'Ri-adattamento, settimana 2: stesse serie, un po\' più vicino al limite.',
        perche: 'Si alza lo sforzo prima del volume: il corpo si abitua al carico senza accumulare la fatica che porta indolenzimento per giorni.' },
    'adattamento 3': { delta: 0, rir: '2-3', nota: 'Ri-adattamento, settimana 3: serie piene.',
        perche: 'Volume pieno della scheda, ancora a 2-3 ripetizioni dal cedimento: è già uno stimolo di crescita per chi torna dopo una pausa.' },
    'adattamento 4': { delta: 0, rir: '2', nota: 'Ri-adattamento, settimana 4: annota i carichi, sono la partenza della costruzione.',
        perche: 'Si fissano i carichi di riferimento: da qui parte la doppia progressione (prima le ripetizioni, poi il peso).' },
    'costruzione 1': { delta: 0, rir: '3', nota: 'Costruzione, settimana 1 del mesociclo: volume di partenza, RIR 3.',
        perche: 'Il mesociclo parte vicino al volume minimo efficace (MEV): lascia spazio per salire nelle settimane dopo (RP, cap. 2).' },
    'costruzione 2': { delta: 0, rir: '2', nota: 'Costruzione, settimana 2: stesse serie, RIR 2.',
        perche: 'Progressione dello sforzo: più vicino al cedimento a parità di serie. Doppia progressione: chiudi il massimo delle ripetizioni e la volta dopo sali di peso.' },
    'costruzione 3': { delta: 0, deltaPrio: 1, rir: '1-2', nota: 'Costruzione, settimana 3: una serie in più su petto, spalle, bicipiti e addome.',
        perche: 'Il volume è la leva con la relazione dose-risposta più chiara (Pelland 2024, Schoenfeld 2017): si aggiunge sui gruppi che vuoi far crescere di più.' },
    'costruzione 4': { delta: 0, deltaPrio: 1, rir: '0-1', nota: 'Costruzione, settimana 4: la più dura. Isolamenti fino a RIR 0, multiarticolari a RIR 1.',
        perche: 'Fine mesociclo vicino al volume massimo recuperabile (MRV): massimo stimolo, poi serve lo scarico per smaltire la fatica accumulata.' },
    'scarico': { meta: true, rir: '4', nota: 'Scarico: metà delle serie, carichi −10%, RIR 4. Serve a recuperare e a crescere nel blocco dopo.',
        perche: 'La fatica si accumula più in fretta dei muscoli: una settimana leggera ogni 4-6 la smaltisce e risensibilizza il muscolo allo stimolo (Bell 2023; RP, gestione della fatica).' },
    'definizione 1': { delta: 0, deltaAltri: -1, rir: '2', nota: 'Definizione: stessi carichi, una serie in meno sui gruppi non prioritari.',
        perche: 'In deficit il muscolo si mantiene tenendo alto il carico (l\'intensità), anche con meno volume (Spiering 2021, Bickel 2011).' },
    'definizione 2': { delta: 0, deltaAltri: -1, rir: '1-2', nota: 'Definizione: stessi carichi, RIR 1-2.',
        perche: 'Il recupero in deficit è peggiore: meno volume sui gruppi di supporto, sforzo pieno sui prioritari.' },
    'definizione 3': { delta: 0, deltaAltri: -1, rir: '1-2', nota: 'Definizione: tieni i carichi della costruzione, anche se le ripetizioni calano un po\'.',
        perche: 'Perdere una ripetizione in deficit è normale; perdere carico è il segnale che si sta perdendo muscolo.' },
    'definizione 4': { delta: 0, deltaAltri: -1, rir: '1', nota: 'Definizione, ultima settimana del mesociclo: poi scarico.',
        perche: 'Stessa logica del mesociclo di costruzione, con meno volume totale per rispettare il recupero in deficit.' },
    'mantenimento': { meta: true, rir: '1-2', nota: 'Mantenimento: un terzo del volume, carichi pieni.',
        perche: 'Forza e massa si mantengono anche con 1/3 del volume se il carico resta alto (Bickel 2011, Spiering 2021): spazio alla bici in estate.' }
};
// 25/10/2026: settimana fuori casa con gli elastici, che fa da scarico dopo la Base 1
SCHEMI_PALESTRA['elastici'] = { delta: 0, rir: '3', nota: 'Settimana fuori casa con gli elastici: 2 serie per esercizio, RIR 3, movimento lento e controllato. È lo scarico dopo tre settimane di Base 1.',
    perche: 'Lo scarico taglia il volume ma tiene il movimento: la fatica se ne va e il muscolo non perde lo stimolo (Bell 2023). A RIR 3 con gli elastici non si accumula fatica, e tendini e spalle si preparano al ritorno in palestra di lunedì.' };
// vecchi nomi delle schede (storico e piani generati prima del 19/10 sera)
SCHEMI_PALESTRA['ipertrofia'] = SCHEMI_PALESTRA['costruzione 2'];
SCHEMI_PALESTRA['ipertrofia +'] = SCHEMI_PALESTRA['costruzione 4'];

const SEDUTE_PALESTRA = {
    'Petto-Spalle': 'Spinta: petto (2 angoli), spalle e tricipiti, più bicipiti e addome. Prima il petto alto, che è il punto da sviluppare, poi gli isolamenti a tensione in allungamento.',
    'Gambe-Core': 'Gambe pesanti e poche serie per la forza in bici (Mujika 2016: 4-8 ripetizioni migliorano gli sforzi lunghi), più spalle laterali e posteriori e addome. Mai a cedimento sulle gambe: giovedì si pedala.',
    'Schiena-Bicipiti': 'Tirata: dorsali con due direzioni (gomiti larghi e gomiti stretti), seconda seduta del petto, bicipiti in allungamento e terza dose di spalle laterali. Niente gambe: arrivi fresco al lungo.',
    'Elastici Spinta': 'Spinta con gli elastici: petto, spalle e tricipiti, più addome anti-rotazione. Elastico fissato dietro la schiena o a una porta.',
    'Elastici Gambe-Core': 'Gambe e glutei con gli elastici, leggero: nel weekend c\'è la MTB. Più addome.',
    'Elastici Tirata': 'Tirata con gli elastici: dorsali, spalle posteriori (la postura da ciclista) e bicipiti. Elastico fissato in alto (porta) o sotto i piedi.'
};

// tipo: composto (multiarticolare parte alta), gambe (multiarticolare gambe, mai sotto RIR 2), iso (isolamento).
// id = chiave dello storico (stesso esercizio in due sedute = stesso id); gif = ExerciseDB, copia in palestra-gif/.
const ESERCIZI_PALESTRA = {
    'Petto-Spalle': [
        { id: 'spinte-inclinata-manubri', partenza: [12, 14], nome: 'Spinte su panca inclinata 30° con manubri', gruppo: 'petto alto', tipo: 'composto', prio: true, serie: 3, reps: '6-10', gif: 'B3Rxp6L', attrezzo: 'manubri',
          perche: 'La Pyramid chiede almeno una spinta inclinata: sviluppa il petto alto, la parte che dà forma al busto. Primo esercizio perché è la priorità, fatto da freschi.',
          consigli: ['Panca a 30°, non di più: oltre lavorano le spalle.', 'Scendi fino all\'allungamento del petto, gomiti a 45°.', 'Discesa in 2-3", salita decisa.'] },
        { id: 'panca-piana-manubri', partenza: [14, 16], nome: 'Panca piana con manubri', gruppo: 'petto', tipo: 'composto', prio: true, serie: 3, reps: '6-10', gif: 'SpYC0Kp', attrezzo: 'manubri',
          perche: 'Il multiarticolare più efficiente per il petto: tanto stimolo in poche serie. I manubri permettono più escursione del bilanciere, quindi più tensione in allungamento.',
          consigli: ['Scapole strette e basse, piedi ben piantati.', 'Scendi controllato, gomiti a 45°.', 'Spingi senza battere i manubri.'] },
        { id: 'lento-avanti-manubri', partenza: [10, 12], nome: 'Lento avanti seduto con manubri', gruppo: 'spalle', tipo: 'composto', prio: true, serie: 3, reps: '8-12', gif: 'znQUdHY', attrezzo: 'manubri',
          perche: 'Spinta verticale: deltoide anteriore e laterale insieme. Completa i 6 schemi motori di base della Pyramid.',
          consigli: ['Schiena appoggiata, addome contratto.', 'Parti con i manubri all\'altezza delle orecchie.', 'Non bloccare i gomiti in alto.'] },
        { id: 'alzate-laterali-manubri', partenza: [4, 6], nome: 'Alzate laterali con manubri', gruppo: 'spalle, deltoide laterale', tipo: 'iso', prio: true, serie: 3, reps: '12-20', gif: 'DsgkuIt', attrezzo: 'manubri',
          perche: 'Il deltoide laterale dà la larghezza delle spalle e quasi nessun multiarticolare lo allena abbastanza: serve un isolamento diretto, 3 volte a settimana.',
          consigli: ['Carico leggero: se dondoli col busto è troppo.', 'Sali fino all\'altezza delle spalle.', 'Spingi i manubri lontano, non in alto.'] },
        { id: 'croci-cavi', partenza: [5, 10], nome: 'Croci ai cavi o pec deck', gruppo: 'petto', tipo: 'iso', prio: true, serie: 2, reps: '10-15', gif: 'xLYSdtg', attrezzo: 'cavo',
          perche: 'Isolamento del petto con tensione anche in allungamento (i cavi non «scaricano» in basso come i manubri): volume aggiuntivo senza fatica per spalle e tricipiti.',
          consigli: ['Gomiti morbidi e fermi.', 'Chiudi davanti al petto e tieni 1".', 'Apri lento fino all\'allungamento.'] },
        { id: 'overhead-tricipiti-cavo', partenza: [10, 15], nome: 'Estensioni tricipiti sopra la testa al cavo', gruppo: 'tricipiti, capo lungo', tipo: 'iso', serie: 2, reps: '10-15', gif: '2IxROQ1', attrezzo: 'cavo',
          perche: 'Con il braccio sopra la testa il capo lungo del tricipite lavora allungato: cresce più che nei push-down (Maeo 2023, citato nella Pyramid). Il tricipite è 2/3 del braccio.',
          consigli: ['Di spalle al cavo, gomiti stretti vicino alla testa.', 'Scendi fino a sentire l\'allungamento dietro il braccio.', 'Estendi senza muovere i gomiti.'] },
        { id: 'pushdown-corda', partenza: [15, 20], nome: 'Push-down ai cavi con corda', gruppo: 'tricipiti', tipo: 'iso', serie: 2, reps: '10-15', gif: 'dU605di', attrezzo: 'cavo',
          perche: 'Completa il tricipite nella posizione accorciata, poco faticoso e veloce da recuperare.',
          consigli: ['Gomiti incollati ai fianchi.', 'In basso apri la corda.', 'Risali fino a 90°.'] },
        { id: 'curl-cavi', partenza: [5, 10], nome: 'Curl ai cavi (bayesian)', gruppo: 'bicipiti', tipo: 'iso', prio: true, serie: 2, reps: '10-15', gif: 'G08RZcQ', attrezzo: 'cavo',
          perche: 'Prima delle 2 sedute di bicipiti della settimana: frequenza 2 per un gruppo prioritario. Col braccio dietro il busto il bicipite lavora allungato.',
          consigli: ['Di spalle al cavo basso, braccio un po\' dietro il corpo.', 'Gomito fermo, stringi in alto 1".', 'Discesa lenta fino all\'allungamento.'] },
        { id: 'crunch-cavi', partenza: [20, 30], nome: 'Crunch ai cavi', gruppo: 'addome', tipo: 'iso', prio: true, serie: 3, reps: '10-15', gif: 'WW95auq', attrezzo: 'cavo',
          perche: 'L\'addome cresce come gli altri muscoli: con carico e progressione, non con centinaia di ripetizioni. Il cavo permette di aumentare il peso.',
          consigli: ['In ginocchio, corda ai lati della testa.', 'Arrotola il busto verso le ginocchia.', 'Fianchi fermi.'] }
    ],
    'Gambe-Core': [
        { id: 'squat-bilanciere', partenza: [40, 50], nome: 'Squat con bilanciere (o hack squat)', gruppo: 'quadricipiti e glutei', tipo: 'gambe', serie: 3, reps: '5-8', gif: 'qXTaZnJ', attrezzo: 'bilanciere',
          perche: 'Forza pesante delle gambe: 3-4 serie da 4-10 ripetizioni massime, 2 volte a settimana, migliorano la resa in bici negli sforzi lunghi (Mujika, Rønnestad & Martin 2016; Vikmoen 2017). Mai a cedimento.',
          consigli: ['Bilanciere sui trapezi, petto alto.', 'Scendi almeno a parallelo con le ginocchia in linea con le punte.', 'Risali spingendo su tutto il piede.'] },
        { id: 'stacco-rumeno-manubri', partenza: [16, 20], nome: 'Stacco rumeno (bilanciere o manubri)', gruppo: 'femorali e glutei', tipo: 'gambe', serie: 3, reps: '6-10', gif: 'rR0LJzx', attrezzo: 'manubri',
          perche: 'Femorali e glutei sotto carico in allungamento, la condizione che produce più crescita (Pyramid, livello 4). In bici i femorali lavorano poco: questo riequilibra.',
          consigli: ['Ginocchia appena flesse e ferme.', 'Porta indietro il bacino, pesi vicini alle gambe.', 'Scendi finché la schiena resta piatta.'] },
        { id: 'leg-curl-seduto', partenza: [25, 35], nome: 'Leg curl seduto', gruppo: 'femorali', tipo: 'iso', serie: 2, reps: '10-15', gif: 'Zg3XY7P', attrezzo: 'macchina',
          perche: 'Da seduti i femorali sono più allungati che da sdraiati e crescono di più (Maeo 2021). Isolamento consigliato dalla Pyramid per ogni gruppo.',
          consigli: ['Bacino fermo contro lo schienale.', 'Talloni verso i glutei senza strappi.', 'Ritorno lento.'] },
        { id: 'leg-extension', partenza: [25, 35], nome: 'Leg extension', gruppo: 'quadricipiti', tipo: 'iso', serie: 2, reps: '12-15', gif: 'my33uHU', attrezzo: 'macchina',
          perche: 'Il retto femorale cresce poco con lo squat: serve un isolamento (Pyramid). Poco faticoso per il recupero della bici.',
          consigli: ['Schiena appoggiata, ginocchio in linea con il perno.', 'Estendi e tieni 1" in alto.', 'Discesa controllata.'] },
        { id: 'calf-raise', partenza: [40, 60], nome: 'Calf raise in piedi', gruppo: 'polpacci', tipo: 'iso', serie: 3, reps: '10-15', gif: 'ykUOVze', attrezzo: 'macchina',
          perche: 'Polpacci: rispondono soprattutto alla parte bassa del movimento, in allungamento. Isolamento consigliato dalla Pyramid.',
          consigli: ['Talloni giù fino all\'allungamento completo, pausa 1".', 'Sali più in alto che puoi.', 'Niente rimbalzi.'] },
        { id: 'alzate-laterali-cavi', partenza: [2.5, 5], nome: 'Alzate laterali ai cavi', gruppo: 'spalle, deltoide laterale', tipo: 'iso', prio: true, serie: 3, reps: '12-20', gif: 'goJ6ezq', attrezzo: 'cavo',
          perche: 'Seconda dose settimanale di deltoide laterale: oltre ~11 serie a seduta per lo stesso muscolo il rendimento cala, meglio distribuire (Pyramid, frequenza).',
          consigli: ['Un braccio alla volta, cavo dal basso, davanti al corpo.', 'Sali fino all\'altezza della spalla.', 'Discesa lenta.'] },
        { id: 'alzate-posteriori-macchina', partenza: [15, 25], nome: 'Alzate posteriori alla macchina (reverse pec deck)', gruppo: 'spalle posteriori', tipo: 'iso', serie: 2, reps: '12-20', gif: 'myfUsKf', attrezzo: 'macchina',
          perche: 'Il deltoide posteriore completa la spalla «tonda» e contrasta la postura chiusa da ciclista.',
          consigli: ['Petto contro lo schienale.', 'Apri le braccia larghe, gomiti morbidi.', 'Stringi le scapole solo alla fine.'] },
        { id: 'hanging-knee-raise', nome: 'Hanging leg raise (o alla sedia romana)', gruppo: 'addome', tipo: 'iso', prio: true, serie: 3, reps: '10-15', gif: '03lzqwk', attrezzo: 'corpo',
          perche: 'Addome inferiore e flessori dell\'anca con il bacino che si arrotola: seconda dose della settimana.',
          consigli: ['Senza dondolare.', 'Porta le ginocchia al petto arrotolando il bacino.', 'Scendi lento.'] },
        { id: 'pallof-press', partenza: [5, 10], nome: 'Pallof press', gruppo: 'addome, anti-rotazione', tipo: 'iso', serie: 2, reps: '10 per lato', gif: '9pa4H5m', attrezzo: 'cavo',
          perche: 'Stabilità del tronco contro la rotazione: è quello che tiene fermo il busto quando spingi forte sui pedali in salita.',
          consigli: ['Di fianco al cavo, maniglia al petto.', 'Spingi avanti senza ruotare il busto.', 'Tieni 2" a braccia tese.'] }
    ],
    'Schiena-Bicipiti': [
        { id: 'lat-machine', partenza: [35, 45], nome: 'Lat machine presa larga (o trazioni)', gruppo: 'dorsali', tipo: 'composto', serie: 3, reps: '6-10', gif: '7F1DVzn', attrezzo: 'cavo',
          perche: 'Tirata verticale: larghezza della schiena, la «V» che fa sembrare la vita più stretta.',
          consigli: ['Petto in fuori, barra verso lo sterno.', 'Gomiti verso i fianchi.', 'Risali fino a braccia distese.'] },
        { id: 'rematore-petto-appoggiato', partenza: [12, 16], nome: 'Rematore con petto appoggiato, gomiti larghi', gruppo: 'dorsali alti e trapezio', tipo: 'composto', serie: 3, reps: '8-12', gif: '7vG5o25', attrezzo: 'manubri',
          perche: 'La Pyramid chiede due rematori diversi: questo a gomiti larghi spessore alto della schiena. Col petto appoggiato la zona lombare non si affatica (c\'è già la bici).',
          consigli: ['Petto sulla panca inclinata.', 'Tira con i gomiti larghi verso l\'alto.', 'Scapole strette in alto 1".'] },
        { id: 'pulldown-braccia-tese', partenza: [15, 20], nome: 'Pulldown a braccia tese al cavo', gruppo: 'dorsali', tipo: 'iso', serie: 2, reps: '10-15', gif: 'x69MAlq', attrezzo: 'cavo',
          perche: 'Secondo schema della Pyramid per la schiena (estensione di spalla): dorsale isolato senza stancare i bicipiti, che servono dopo.',
          consigli: ['Braccia quasi tese, busto leggermente in avanti.', 'Porta la barra alle cosce.', 'Risali lento fino all\'allungamento.'] },
        { id: 'spinte-inclinata-manubri', partenza: [12, 14], nome: 'Spinte su panca inclinata con manubri', gruppo: 'petto, 2ª volta in settimana', tipo: 'composto', prio: true, serie: 3, reps: '8-12', gif: 'B3Rxp6L', attrezzo: 'manubri',
          perche: 'Seconda seduta del petto: frequenza 2 a settimana per distribuire le 14-17 serie del gruppo prioritario.',
          consigli: ['Stessa panca a 30° di lunedì.', 'Carichi di lunedì come riferimento, qualche ripetizione in più.', 'Discesa in 2-3".'] },
        { id: 'chest-press-macchina', partenza: [30, 40], nome: 'Chest press alla macchina', gruppo: 'petto', tipo: 'composto', serie: 2, reps: '10-15', gif: 'DOoWcnA', attrezzo: 'macchina',
          perche: 'Volume di petto stabile e poco tecnico: alla macchina si arriva vicino al cedimento in sicurezza, senza assistente.',
          consigli: ['Maniglie all\'altezza del petto.', 'Scapole strette contro lo schienale.', 'Non bloccare i gomiti.'] },
        { id: 'face-pull', partenza: [10, 15], nome: 'Face pull ai cavi', gruppo: 'spalle posteriori, postura da ciclista', tipo: 'iso', serie: 2, reps: '12-15', gif: 'wqNPGCg', attrezzo: 'cavo',
          perche: 'Deltoide posteriore e rotatori esterni: contrasta la chiusura di spalle e petto della posizione in bici.',
          consigli: ['Corda all\'altezza degli occhi.', 'Tira verso la fronte aprendo i gomiti.', 'Ruota le mani all\'indietro alla fine.'] },
        { id: 'curl-panca-inclinata', partenza: [8, 10], nome: 'Curl su panca inclinata con manubri', gruppo: 'bicipiti', tipo: 'iso', prio: true, serie: 3, reps: '8-12', gif: 'ae9UoXQ', attrezzo: 'manubri',
          perche: 'Con le braccia dietro il busto il bicipite lavora allungato: è la variante di curl con più crescita (Pedrosa 2023, ripreso dalla Pyramid).',
          consigli: ['Panca a 45-60°, braccia che pendono dietro.', 'Gomiti fermi, ruota i palmi in alto salendo.', 'Discesa completa e lenta.'] },
        { id: 'curl-martello', partenza: [10, 12], nome: 'Curl a martello', gruppo: 'bicipiti e brachiale', tipo: 'iso', prio: true, serie: 2, reps: '10-12', gif: '2NpxjC1', attrezzo: 'manubri',
          perche: 'Brachiale e brachioradiale: danno spessore al braccio visto di lato.',
          consigli: ['Palmi che si guardano.', 'Gomiti fermi ai fianchi.', 'Senza slancio.'] },
        { id: 'alzate-laterali-manubri', partenza: [4, 6], nome: 'Alzate laterali con manubri', gruppo: 'spalle, deltoide laterale', tipo: 'iso', prio: true, serie: 3, reps: '12-20', gif: 'DsgkuIt', attrezzo: 'manubri',
          perche: 'Terza dose di deltoide laterale: muscolo piccolo, recupera in fretta e regge bene la frequenza alta.',
          consigli: ['Carico leggero.', 'Sali fino all\'altezza delle spalle.', 'Discesa lenta.'] },
        { id: 'ab-wheel', nome: 'Ab wheel o crunch inverso', gruppo: 'addome', tipo: 'iso', prio: true, serie: 3, reps: '8-15', gif: 'NAgVB3t', attrezzo: 'corpo',
          perche: 'Addome sotto carico in allungamento (la ruota lo allunga sotto tensione): terza dose della settimana.',
          consigli: ['In ginocchio, addome contratto, schiena neutra.', 'Avanti solo finché la schiena non si inarca.', 'Se è troppo: crunch inverso a terra.'] }
    ],
    // 25/10/2026: settimana fuori casa. Elastico = attrezzo 'elastico' (nella colonna dei kg va la resistenza scritta
    // sull'elastico). Animazioni ExerciseDB «resistance band». Due serie: è la settimana di scarico.
    'Elastici Spinta': [
        { id: 'el-panca', nome: 'Spinte su panca o a terra con elastico', gruppo: 'petto', tipo: 'iso', prio: true, serie: 2, reps: '12-15', gif: 'khlHMqs', attrezzo: 'elastico',
          perche: 'Il movimento della panca senza panca: l\'elastico dietro la schiena dà più resistenza in fondo alla spinta, dove il petto è più forte.',
          consigli: ['Elastico sotto le scapole, mani alla larghezza delle spalle.', 'Spingi in avanti e un po\' in alto, gomiti a 45°.', '2" a scendere, niente rimbalzi.'] },
        { id: 'el-lento-avanti', nome: 'Lento avanti seduto con elastico', gruppo: 'spalle', tipo: 'iso', prio: true, serie: 2, reps: '10-15', gif: 'S93zLTG', attrezzo: 'elastico',
          perche: 'Le spalle sono una tua priorità: tenerle in movimento anche fuori casa evita di ripartire da zero lunedì.',
          consigli: ['Elastico sotto il sedere o sotto i piedi.', 'Addome contratto, schiena non inarcata.', 'Su fino quasi a braccia tese.'] },
        { id: 'el-alzate-laterali', nome: 'Alzate laterali con elastico', gruppo: 'spalle, deltoide laterale', tipo: 'iso', prio: true, serie: 2, reps: '15-20', gif: 'sTg7iys', attrezzo: 'elastico',
          perche: 'Il deltoide laterale risponde bene a ripetizioni alte e carichi leggeri: perfetto con l\'elastico.',
          consigli: ['Piedi sull\'elastico, gomiti appena piegati.', 'Sali fino all\'altezza delle spalle, non oltre.', 'Scendi lento, l\'elastico non deve tirarti giù.'] },
        { id: 'el-piegamenti-stretti', nome: 'Piegamenti a presa stretta (con elastico se vuoi più carico)', gruppo: 'tricipiti e petto', tipo: 'iso', serie: 2, reps: '8-12', gif: 'ufaxB52', attrezzo: 'elastico',
          perche: 'Tricipiti e petto insieme, con il peso del corpo. L\'elastico sulla schiena li rende più duri.',
          consigli: ['Mani sotto le spalle, gomiti vicini al corpo.', 'Corpo dritto dalla testa ai talloni.', 'Troppo duri? Ginocchia a terra.'] },
        { id: 'el-tricipiti', nome: 'Estensioni dei tricipiti con elastico', gruppo: 'tricipiti', tipo: 'iso', serie: 2, reps: '12-15', gif: 'obe5LMq', attrezzo: 'elastico',
          perche: 'Isolamento dei tricipiti: sono due terzi del braccio, contano più dei bicipiti per la circonferenza.',
          consigli: ['Gomito fermo vicino al corpo.', 'Si muove solo l\'avambraccio.', 'Stendi del tutto e ritorna lento.'] },
        { id: 'el-pallof', nome: 'Pallof press con elastico', gruppo: 'addome, anti-rotazione', tipo: 'iso', serie: 2, reps: '10 per lato', gif: '9pa4H5m', attrezzo: 'elastico',
          perche: 'Addome che resiste alla rotazione: è quello che tiene fermo il bacino in sella.',
          consigli: ['Elastico fissato di lato all\'altezza del petto.', 'Spingi le mani in avanti e tienile 2" senza ruotare.', 'Più lontano dall\'ancoraggio = più difficile.'] }
    ],
    'Elastici Gambe-Core': [
        { id: 'el-squat', nome: 'Squat con elastico', gruppo: 'quadricipiti e glutei', tipo: 'iso', serie: 2, reps: '12-15', gif: 'TUZLh71', attrezzo: 'elastico',
          perche: 'Gambe in movimento senza accumulare fatica: nel weekend c\'è la MTB e deve trovarle fresche.',
          consigli: ['Elastico sotto i piedi, mani alle spalle.', 'Scendi finché la schiena resta dritta.', 'Spingi sui talloni.'] },
        { id: 'el-stacco-rumeno', nome: 'Stacco rumeno con elastico', gruppo: 'femorali e glutei', tipo: 'iso', serie: 2, reps: '12-15', gif: 'kuMiR2T', attrezzo: 'elastico',
          perche: 'Femorali e glutei, i muscoli che in bici lavorano meno ma tengono la schiena.',
          consigli: ['Ginocchia appena piegate e ferme.', 'Fianchi indietro, schiena dritta.', 'Risali stringendo i glutei.'] },
        { id: 'el-affondi', nome: 'Split squat con elastico', gruppo: 'quadricipiti e glutei', tipo: 'iso', serie: 2, reps: '10 per gamba', gif: 'y8bYM8w', attrezzo: 'elastico',
          perche: 'Una gamba alla volta: equilibrio e forza a destra e a sinistra, come sui pedali.',
          consigli: ['Passo lungo, busto dritto.', 'Il ginocchio dietro scende verso terra.', 'Spingi con la gamba davanti.'] },
        { id: 'el-ponte-glutei', nome: 'Ponte per i glutei con elastico', gruppo: 'glutei', tipo: 'iso', serie: 2, reps: '15', gif: 'E4R8Hz1', attrezzo: 'elastico',
          perche: 'Glutei attivi = più potenza in pedalata e meno carico sulla schiena.',
          consigli: ['Elastico sopra le anche, tenuto a terra con le mani.', 'Sali fino ad allineare spalle, anche e ginocchia.', '1" fermo in alto.'] },
        { id: 'el-polpacci', nome: 'Polpacci su una gamba con elastico', gruppo: 'polpacci', tipo: 'iso', serie: 2, reps: '15 per gamba', gif: '9JprnPh', attrezzo: 'elastico',
          perche: 'Polpacci e caviglie: utili sulla MTB quando spingi in piedi sui pedali o porti la bici a mano.',
          consigli: ['Seduto, elastico sotto la pianta del piede.', 'Spingi la punta fino in fondo.', 'Ritorna lento.'] },
        { id: 'el-crunch', nome: 'Crunch in piedi con elastico', gruppo: 'addome', tipo: 'iso', prio: true, serie: 2, reps: '12-15', gif: 'Kzg30R7', attrezzo: 'elastico',
          perche: 'Addome sotto carico anche senza cavi: è il sostituto del crunch ai cavi della palestra.',
          consigli: ['Elastico fissato in alto, dietro di te.', 'Arrotola il busto verso il basso con l\'addome, non con le braccia.', 'Fianchi fermi.'] }
    ],
    'Elastici Tirata': [
        { id: 'el-lat', nome: 'Lat pulldown con elastico, presa stretta', gruppo: 'dorsali', tipo: 'iso', serie: 2, reps: '12-15', gif: 'DptumMx', attrezzo: 'elastico',
          perche: 'La lat machine fuori casa: dorsali larghi, spalle aperte e una postura migliore in sella.',
          consigli: ['Elastico fissato in alto (porta).', 'Tira i gomiti verso i fianchi, petto in fuori.', 'Ritorna lento fino a braccia tese.'] },
        { id: 'el-rematore', nome: 'Rematore seduto con elastico', gruppo: 'dorsali alti e trapezio', tipo: 'iso', serie: 2, reps: '12-15', gif: 'Nu7jqFE', attrezzo: 'elastico',
          perche: 'Schiena alta e trapezio: bilancia le ore passate curvo sul manubrio, che chiudono le spalle.',
          consigli: ['Seduto, elastico attorno ai piedi.', 'Schiena dritta, tira verso l\'ombelico.', 'Stringi le scapole 1" alla fine.'] },
        { id: 'el-aperture-posteriori', nome: 'Aperture posteriori con elastico', gruppo: 'spalle posteriori, postura da ciclista', tipo: 'iso', serie: 2, reps: '15-20', gif: 'sTfvVsG', attrezzo: 'elastico',
          perche: 'Il face pull fuori casa: spalle posteriori forti tengono le spalle indietro, in bici e fuori.',
          consigli: ['Braccia tese davanti, elastico tra le mani.', 'Apri fino a portare le braccia in linea con le spalle.', 'Senza alzare le spalle verso le orecchie.'] },
        { id: 'el-curl', nome: 'Curl con elastico', gruppo: 'bicipiti', tipo: 'iso', prio: true, serie: 2, reps: '12-15', gif: 'XFc3vpY', attrezzo: 'elastico',
          perche: 'Bicipiti, una delle tue priorità: due serie leggere bastano a non perdere niente in una settimana.',
          consigli: ['Gomiti fermi ai fianchi.', 'Sali fino in fondo, stringi 1".', 'Scendi lento fino a braccia tese.'] },
        { id: 'el-curl-sopra-testa', nome: 'Curl sopra la testa con elastico, un braccio', gruppo: 'bicipiti', tipo: 'iso', prio: true, serie: 2, reps: '12 per braccio', gif: 'UNAB8ak', attrezzo: 'elastico',
          perche: 'Bicipite in allungamento, come il curl ai cavi della palestra: è la posizione che lo fa crescere di più.',
          consigli: ['Elastico fissato in alto, braccio alto e teso.', 'Piega il gomito portando la mano verso la testa.', 'Il gomito non scende.'] },
        { id: 'el-y-raise', nome: 'Y-raise con elastico', gruppo: 'spalle e trapezio basso', tipo: 'iso', serie: 2, reps: '12-15', gif: 'aHDy5O5', attrezzo: 'elastico',
          perche: 'Trapezio basso e spalle: le scapole stanno al loro posto, utile dopo ore in bici.',
          consigli: ['Elastico sotto i piedi, braccia tese.', 'Sali a «Y», pollici verso l\'alto.', 'Leggero: deve essere facile.'] }
    ]
};
const RISCALDAMENTO_PALESTRA = 'Riscaldamento: 5\' cyclette o vogatore, mobilità delle spalle con elastico, 2 serie leggere del primo esercizio (50% e 75% del carico)';
const RISCALDAMENTO_ELASTICI = 'Riscaldamento: 5\' di mobilità (cerchi con le braccia, rotazioni delle anche, 10 squat a corpo libero) e una serie leggera del primo esercizio con l\'elastico più morbido';
const riscaldamentoDi = seduta => /^Elastici\b/.test(seduta) ? RISCALDAMENTO_ELASTICI : RISCALDAMENTO_PALESTRA;
const REC_PALESTRA = { composto: 150, gambe: 180, iso: 90 };     // secondi; Pyramid liv. 5: oltre ~90" l'ipertrofia non cambia
const MIN_SERIE = { composto: 3.25, gambe: 3.75, iso: 2.25 };    // minuti per serie, recupero compreso

function seriePalestra(es, sc) {
    if (sc === SCHEMI_PALESTRA.scarico) return Math.max(1, Math.ceil(es.serie / 2));
    if (sc === SCHEMI_PALESTRA.mantenimento) return Math.max(1, Math.round(es.serie / 3));
    return Math.max(1, es.serie + (sc.delta || 0) + (es.prio ? (sc.deltaPrio || 0) : (sc.deltaAltri || 0)));
}
function repsPalestra(es) { return es.reps; }
// gambe pesanti mai sotto RIR 2 (c'è la bici), multiarticolari della parte alta mai a cedimento
function rirPalestra(es, sc) {
    if (es.tipo === 'gambe' && ['0-1', '1', '1-2', '2'].includes(sc.rir)) return '2-3';
    if (es.tipo === 'composto' && sc.rir === '0-1') return '1';
    return sc.rir;
}
function schemaDi(nomeCompleto) {
    const chiave = ((nomeCompleto || '').match(/\(([^)]+)\)/) || [])[1];
    return SCHEMI_PALESTRA[chiave] ? chiave : 'adattamento 3';
}
const fmtRec = s => s >= 120 ? `${Math.floor(s / 60)}'${s % 60 ? (s % 60) + '"' : ''}` : `${s}"`;

// La scheda strutturata per l'app di allenamento (palestra-ui.js): numeri, non testo.
function pianoPalestra(nomeCompleto) {
    const seduta = baseName(nomeCompleto), lista = ESERCIZI_PALESTRA[seduta];
    if (!lista) return null;
    const schema = schemaDi(nomeCompleto), sc = SCHEMI_PALESTRA[schema];
    return {
        seduta, schema, nota: sc.nota, perche: sc.perche, scopo: SEDUTE_PALESTRA[seduta], riscaldamento: riscaldamentoDi(seduta),
        esercizi: lista.map(es => {
            const testo = repsPalestra(es, sc), r = (testo.match(/\d+(-\d+)?/) || ['0'])[0].split('-').map(Number);
            return { id: es.id, nome: es.nome, gruppo: es.gruppo, gif: es.gif, attrezzo: es.attrezzo, consigli: es.consigli, perche: es.perche, partenza: es.partenza || null,
                tipo: es.tipo, prio: !!es.prio, serie: seriePalestra(es, sc), facoltative: 0,
                reps: [r[0], r[r.length - 1]], repsTesto: testo, unita: /"/.test(testo) ? 's' : 'reps',
                rir: rirPalestra(es, sc), recSec: REC_PALESTRA[es.tipo] };
        })
    };
}

function schedaPalestra(seduta, nomeCompleto) {
    const p = pianoPalestra(nomeCompleto);
    const minuti = 10 + p.esercizi.reduce((t, e) => t + e.serie * MIN_SERIE[e.tipo], 0);
    const righe = p.esercizi.map(e => `${e.nome} — ${e.serie}×${e.repsTesto} · RIR ${e.rir} · rec ${fmtRec(e.recSec)} (${e.gruppo})`);
    return {
        label: `${seduta} · palestra`, totalMin: Math.round(minuti / 5) * 5, palestra: true, icuText: null, scopo: p.scopo, perche: p.perche,
        uiSteps: [{ text: p.riscaldamento, durMin: 10 }, ...righe.map((text, i) => ({ text, perche: p.esercizi[i].perche }))],
        plainDescription: `${p.scopo}\n\n${p.nota}\nPerché: ${p.perche}\nRIR = ripetizioni che lasci in canna.\n\n${p.riscaldamento}.\n${righe.map(r => `• ${r}`).join('\n')}`
    };
}
Object.keys(ESERCIZI_PALESTRA).forEach(seduta => { LIBRARY[seduta] = (ftp, cp, nome) => schedaPalestra(seduta, nome); });

function getWorkoutDetail(sessionName, ftp, cp) {
    const key = baseName(sessionName);
    const fn = LIBRARY[key];
    if (!fn) return { label: sessionName, totalMin: null, uiSteps: [{ text: 'Dettaglio non ancora disponibile per questa sessione — verrà inviata come nota semplice.' }], icuText: null };
    const d = fn(ftp || 320, cp || (ftp || 320) - 30, sessionName);
    if (!d.uiSteps) d.uiSteps = d.steps; // retro-compat
    return d;
}

if (typeof module !== 'undefined') module.exports = { getWorkoutDetail, baseName, LIBRARY, pianoPalestra, ESERCIZI_PALESTRA, SCHEMI_PALESTRA, SEDUTE_PALESTRA };

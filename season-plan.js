// MirabiWatt Season Plan Engine — 2026-2027
// Macrociclo: Friel Base/Build/Peak/Race con blocchi Rønnestad in inverno.
// Riferimenti: training-knowledge-synthesis.md (nel repo).
//
// Regole ferree in ogni fase (dal cross-check delle fonti):
//  - max 2-3 sedute HIT/settimana (martedì Zwift conta come una)
//  - pavimento ~75% sedute a bassa intensità, anche in inverno
//  - carico duro concentrato in blocchi con scarico vero, mai piatto

// 19/10/2026: questo è il «Piano invernale full cycling», salvato anche in piani/full-cycling.json. Il piano
// attivo (piani/attivo.json) arriva con usaPiano(): nel browser da /piano-attivo.js, nel server da piani.js.
const SEASON = {
    id: 'full-cycling',
    nome: 'Piano invernale full cycling',
    start: '2026-09-21',
    events: [
        { id: 'tratturo', name: 'Granfondo Tratturo Magno', date: '2027-03-14', dateConfirmed: true, priority: 'B', km: 104, elev: 1800 },
        { id: 'novecolli', name: 'Granfondo Nove Colli (percorso lungo)', date: '2027-05-23', dateConfirmed: true, priority: 'A', km: 200, elev: 3814, maxGrad: 18, maxAlt: 791 }
    ],

    // Fasi con dettaglio giorno-per-giorno (le prossime ~10 settimane)
    // Volumi ricalibrati (2026-09-21) sulla disponibilità reale dichiarata: 8-12h/settimana.
    detailedPhases: [
        {
            id: 'prep', name: 'Prep — Riattivazione', start: '2026-09-21', end: '2026-10-04',
            weeks: [
                { label: 'Sett. 1', special: 'Controllato il tuo storico: ultime 2 settimane quasi ferme (TSB fino a +23), poi oggi (20/9) 4h a sorpresa. Niente test massimale a freddo: martedì fai un Ramp Test su Zwift — 20\', si ferma da solo, zero pacing da gestire, ci dà comunque un eFTP fresco. Volume ~8h: parto dal basso della tua fascia (8-12h) perché vieni da 2 settimane ferme, non perché 8h sia il tetto.',
                  days: [
                    { d: 'Lun', s: 'Riposo', note: 'Passiva, stretching se va.' },
                    { d: 'Mar', s: 'Ramp Test', dur: '20-25\'', zone: 'Test', critical: true, note: 'Su Zwift/rulli — ramp test standard, non il tuo protocollo 5\'+15\'. Meno costoso, dato comunque affidabile.' },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30-2h', zone: 'Z2', note: 'Rulli.' },
                    { d: 'Gio', s: 'EnduranceAgile', dur: '1h30', zone: 'Z2', note: 'Rulli, lavoro di cadenza.' },
                    { d: 'Ven', s: 'MedioMini', dur: '2h', zone: 'Z2/Z3', note: 'Libero pomeriggio da giovedì → outdoor se meteo ok.' },
                    { d: 'Sab', s: 'Corpo libero e MSR', note: 'Facoltativa ma consigliata.' },
                    { d: 'Dom', s: 'EnduranceCorto', dur: '2h30', zone: 'Z2', critical: true, note: 'Outdoor.' }
                  ] },
                { label: 'Sett. 2', special: 'Niente secondo test dedicato: se in una delle uscite outdoor ti viene naturale spingere forte 15-20\' con buone sensazioni, bene — ci basta l\'eFTP che intervals.icu calcola da solo su quello sforzo, confrontato col ramp test. Nessun obbligo. Volume verso 8h30-9h.',
                  days: [
                    { d: 'Lun', s: 'Riposo', note: '' },
                    { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true, note: 'Prima uscita "vera" — non tirare al 100%, è ancora riattivazione.' },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30', zone: 'Z2', note: 'Rulli.' },
                    { d: 'Gio', s: 'EnduranceAgile', dur: '1h15', zone: 'Z2', note: 'Rulli.' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '2h', zone: 'Z2', note: 'Pomeriggio libero, outdoor se possibile — occasione per lo sforzo libero di cui sopra, se ti va.' },
                    { d: 'Sab', s: 'Riposo', note: '' },
                    { d: 'Dom', s: 'EnduranceMedio', dur: '2h45', zone: 'Z2', critical: true, note: 'Outdoor.' }
                  ] }
            ]
        },
        {
            id: 'base1', name: 'Base 1 — Aerobico puro', start: '2026-10-05', end: '2026-11-01',
            weeks: [
                { label: 'Sett. 1', special: 'Volume verso 9h — dentro la tua fascia 8-12h, in crescita rispetto alla Prep.', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30', zone: 'Z2', note: 'Rulli.' },
                    { d: 'Gio', s: 'EnduranceMedio', dur: '1h30', zone: 'Z2', note: 'Rulli/outdoor.' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '2h', zone: 'Z2', note: 'Pomeriggio libero, outdoor se possibile.' },
                    { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'EnduranceLungo', dur: '3h', zone: 'Z2', critical: true, note: 'Outdoor.' }
                ]},
                { label: 'Sett. 2', special: 'Volume verso 10h.', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h45', zone: 'Z2' },
                    { d: 'Gio', s: 'EnduranceMedio', dur: '1h45', zone: 'Z2' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '2h15', zone: 'Z2' },
                    { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'MedioLungo', dur: '3h30', zone: 'Z2/Z3bassa', critical: true, note: 'Outdoor.' }
                ]},
                { label: 'Sett. 3', special: 'Punta della fase, ~11h30 — dentro il tuo tetto di 12h. Poi scarico.', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '2h', zone: 'Z2' },
                    { d: 'Gio', s: 'EnduranceMedio', dur: '2h', zone: 'Z2' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '2h30', zone: 'Z2' },
                    { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'MedioLungo', dur: '4h', zone: 'Z2/Z3bassa', critical: true, note: 'Outdoor, ultima lunga prima dello scarico.' }
                ]},
                { label: 'Sett. 4 — Scarico', special: 'Settimana di scarico: cala il volume (~7h, non i tuoi 8-12h abituali) di proposito — non è un premio, è dove consolidi quello che hai costruito. Qui il volume basso è voluto, non un limite mancato.', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '45-60\'', zone: 'HIT', critical: true, note: 'Versione corta.' },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30', zone: 'Z2' },
                    { d: 'Gio', s: 'Corpo libero e MSR', note: 'Facoltativa ma consigliata, settimana di scarico.' },
                    { d: 'Ven', s: 'EnduranceCadenza', dur: '1h30', zone: 'Z2' },
                    { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'EnduranceCorto', dur: '2h30', zone: 'Z2' }
                ]}
            ]
        },
        {
            id: 'base2', name: 'Base 2 — Blocco Rønnestad', start: '2026-11-02', end: '2026-11-29',
            weeks: [
                { label: 'Sett. 1 — FORTE', special: 'Settimana concentrata (~10h30, verso il tuo tetto): 2 sedute qualità. Le gambe pesanti qui sono previste — il recupero vero arriva nelle 3 settimane leggere che seguono.', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '2h', zone: 'Z2', note: 'Rulli.' },
                    { d: 'Gio', s: '30/15 Short Intervals', dur: '1h', zone: 'HIT', critical: true, note: 'Rulli — 30\'\' hard/15\'\' easy x13, 3 serie. 2ª qualità della settimana.' },
                    { d: 'Ven', s: 'MedioMini', dur: '2h30', zone: 'Z2/Z3', note: 'Pomeriggio libero.' },
                    { d: 'Sab', s: 'Corpo libero e MSR', note: 'Facoltativa ma consigliata.' },
                    { d: 'Dom', s: 'MedioLungo', dur: '3h30-4h', zone: 'Z2/Z3bassa', critical: true, note: 'Outdoor se possibile.' }
                ]},
                { label: 'Sett. 2 — leggera', special: 'Leggera ma comunque ~9h30 — niente 2ª HIT, ma il volume Z2 resta dentro la tua disponibilità.', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30', zone: 'Z2' },
                    { d: 'Gio', s: 'EnduranceMedio', dur: '1h45', zone: 'Z2', note: 'Niente 2ª HIT questa settimana.' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '2h', zone: 'Z2' },
                    { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'EnduranceLungo', dur: '3h15', zone: 'Z2', critical: true, note: 'Outdoor.' }
                ]},
                { label: 'Sett. 3 — leggera', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30', zone: 'Z2' },
                    { d: 'Gio', s: 'EnduranceMedio', dur: '1h45', zone: 'Z2' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '2h', zone: 'Z2' },
                    { d: 'Sab', s: 'Riposo' }, { d: 'Dom', s: 'EnduranceLungo', dur: '3h', zone: 'Z2', critical: true, note: 'Outdoor (giornate più corte: valuta orario).' }
                ]},
                { label: 'Sett. 4 — leggera', days: [
                    { d: 'Lun', s: 'Riposo' }, { d: 'Mar', s: 'Zwift Race', dur: '60-75\'', zone: 'HIT', critical: true },
                    { d: 'Mer', s: 'EnduranceCorto', dur: '1h30', zone: 'Z2', note: 'Rulli (buio presto).' },
                    { d: 'Gio', s: 'EnduranceMedio', dur: '1h30', zone: 'Z2', note: 'Rulli.' },
                    { d: 'Ven', s: 'EnduranceMedio', dur: '1h45', zone: 'Z2', note: 'Rulli o outdoor breve.' },
                    { d: 'Sab', s: 'Corpo libero e MSR', note: 'Facoltativa ma consigliata.' }, { d: 'Dom', s: 'MedioLungo', dur: '2h45', zone: 'Z2/Z3bassa', critical: true, note: 'Outdoor se possibile, altrimenti rulli spezzato.' }
                ]}
            ]
        }
    ],

    // Fasi successive: solo a livello di sommario finché non ci arriviamo (si dettagliano
    // in base a come rispondi realmente ai dati CTL/TSB, non ha senso fissarle 8 mesi prima)
    summaryPhases: [
        { id: 'base3', name: 'Base 3 / Inverno (blocco + feste)', start: '2026-11-30', end: '2027-01-03', hours: '8-11h', hit: '1-2', focus: 'Blocco Rønnestad #2 + settimane natalizie volutamente leggere. Usa Piano B senza sensi di colpa durante le feste.', zoneMix: { z1z2: 75, z3: 15, z4plus: 10 }, detail: 'Stesso schema di Base 2: 1 settimana forte (5 sedute qualità, verso il tuo tetto di 12h) seguita da 3 leggere (verso 8-9h, un solo HIT). Introduco sweet spot (CPSalita, MedioBillat) nella settimana forte oltre al 30/15 già visto. Le settimane di Natale/Capodanno restano intenzionalmente più leggere (7-8h) per stare con la famiglia senza sensi di colpa — è già previsto, non un cedimento al piano.' },
        { id: 'build1', name: 'Build 1', start: '2027-01-04', end: '2027-02-14', hours: '9-12h', hit: '1-2', focus: 'Sweet spot/soglia (30/15, 4x8, CPSalita). Ri-test CP indoor+outdoor a metà fase.', zoneMix: { z1z2: 68, z3: 20, z4plus: 12 }, detail: 'Qui il lavoro a soglia/sweet spot aumenta di frequenza (non di rischio: resta 1-2 HIT/sett, il resto è Z2 lungo). Introduco 4x8\' (Seiler) accanto al 30/15 già rodato, più CPSalita per iniziare a specializzare verso le salite del Tratturo Magno. A metà fase rifacciamo il test CP indoor+outdoor per aggiornare le zone con dati freschi.' },
        { id: 'specific-taper', name: 'Specifico + mini-taper', start: '2027-02-15', end: '2027-03-14', hours: '8-12h', hit: '1-2', focus: 'Salite specifiche per il Tratturo Magno, scarico breve nell\'ultima settimana.', zoneMix: { z1z2: 65, z3: 22, z4plus: 13 }, detail: 'Volume verso il tetto nelle prime 2-3 settimane (uscite con salite vere, SweetSerie/CPSalita/SerieLungo), poi mini-taper nell\'ultima settimana (~7-8h, non un taper completo — il Tratturo è la gara B) prima della gara.', raceId: 'tratturo' },
        { id: 'recovery-build2', name: 'Recupero + Build 2', start: '2027-03-15', end: '2027-04-18', hours: '7-12h', hit: '1-2', focus: 'Settimana di recupero post-gara, poi durabilità: uscite lunghe back-to-back per i 3814m di Nove Colli.', zoneMix: { z1z2: 70, z3: 20, z4plus: 10 }, detail: 'Settimana 1 di recupero attivo dopo il Tratturo Magno (~7h, Z1-Z2 solo). Poi risalita verso il tetto con uscite lunghe nel weekend (anche back-to-back sab+dom) per costruire la resistenza specifica ai 3814m di dislivello di Nove Colli — più CP/soglia su salite lunghe (CPSFR, CPLungo) che VO2max puro.' },
        { id: 'peak', name: 'Peak', start: '2027-04-19', end: '2027-05-09', hours: '9-11h', hit: '2', focus: 'Qualità corta e specifica, 1 simulazione gara lunga con nutrizione da gara.', zoneMix: { z1z2: 60, z3: 20, z4plus: 20 }, detail: 'Qui NON spingo verso il tuo tetto di 12h di proposito: si affina, non si accumula. Volume leggermente sotto il picco di Build2, intensità/qualità in salita (CPRipetute, VO2Medio). Una uscita lunga di simulazione gara con la nutrizione vera che userai a Nove Colli.' },
        { id: 'taper', name: 'Taper', start: '2027-05-10', end: '2027-05-23', hours: '4-7h', hit: '1', focus: 'Scarico classico, openers, arrivo fresco.', zoneMix: { z1z2: 70, z3: 15, z4plus: 15 }, detail: 'Taper vero: volume tagliato del 40-60% rispetto al Peak, di proposito ben sotto la tua disponibilità — è l\'unica fase dove "meno" è l\'obiettivo. Frequenza e un po\' di intensità restano (openers, brevi accelerazioni) per arrivare freschi ma non "spenti" a Nove Colli.', raceId: 'novecolli' }
    ],

    // Regole di Piano B: come derivare una versione ridotta/di recupero da una settimana piena
    planB: {
        ridotta: 'Tieni SOLO martedì (anche in Z2 se le gambe sono pesanti) + una uscita lunga più corta del 40%. Tutto il resto diventa Riposo o Z1 leggero.',
        recupero: 'Fermati. Riposo passivo o "Riposo o Passeggiata" tutti i giorni. Riprendi la settimana prossima da dove sei, non da dove dovevi essere.'
    }
};

function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function fmtISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function mondayOf(date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; return addDays(d, -day); }

// Trova la settimana di dettaglio corrispondente a una data, se esiste
function findDetailedWeek(dateISO) {
    const date = parseISO(dateISO);
    for (const phase of SEASON.detailedPhases) {
        const phaseStart = parseISO(phase.start);
        const phaseEnd = parseISO(phase.end);
        if (date < phaseStart || date > phaseEnd) continue;
        const weekIdx = Math.floor((mondayOf(date) - mondayOf(phaseStart)) / (7 * 86400000));
        const week = phase.weeks[weekIdx];
        if (!week) continue;
        const weekStart = addDays(mondayOf(phaseStart), weekIdx * 7);
        return { phase, week, weekStart: fmtISO(weekStart) };
    }
    return null;
}

function findSummaryPhase(dateISO) {
    const date = parseISO(dateISO);
    return SEASON.summaryPhases.find(p => date >= parseISO(p.start) && date <= parseISO(p.end)) || null;
}

function parseDurMin(s) {
    if (!s) return 0;
    const hm = s.match(/^(\d+)h(\d+)?/);
    if (hm) return parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
    const m = s.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

// 19/10/2026 sera: «settimana evento» (piano mixed, gare facoltative): mini-taper. Volume −40/−50%, una palestra di
// parte alta leggera, openers il giorno prima dell'evento, riposo il giorno dopo. weekStartISO serve a trovare l'evento.
function applyEvento(days, weekStartISO) {
    const fmt = m => { m = Math.max(30, Math.round(m / 5) * 5); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${m}'`; };
    const date = days.map((_, i) => weekStartISO ? fmtISO(addDays(parseISO(weekStartISO), i)) : null);
    const ev = (SEASON.events || []).find(e => date.includes(e.date));
    const iEv = ev ? date.indexOf(ev.date) : -1;
    let palestraFatta = false;
    return days.map((d, i) => {
        if (i === iEv) return { d: d.d, s: `🏁 ${ev.name}`, zone: 'Gara', critical: true, evento: true, dur: '', note: 'Evento: carboidrati pieni nei 2 giorni prima, riscaldamento come da tuo protocollo, parti più piano di come ti senti.' };
        if (iEv >= 0 && i === iEv - 1) return { d: d.d, s: 'Openers', dur: '45\'', zone: 'Z2/HIT', note: 'Il giorno prima dell\'evento: breve, qualche apertura per arrivare svegli ma freschi.' };
        if (iEv >= 0 && i === iEv + 1) return { d: d.d, s: 'Riposo o Passeggiata', zone: 'Rec', note: 'Il giorno dopo l\'evento: recupero. Poi il piano riprende.' };
        if (d.zone === 'Palestra') {
            if (palestraFatta || !/^Petto-Spalle\b/.test(d.s)) return { d: d.d, s: 'Riposo', zone: 'Rec', note: 'Settimana evento: palestra sospesa.' };
            palestraFatta = true;
            return { ...d, s: 'Petto-Spalle (scarico)', dur: '45\'', note: 'Settimana evento: solo parte alta, leggera.' };
        }
        if (d.s === 'Riposo' || d.s === 'Riposo o Passeggiata' || !d.dur) return d;
        return { ...d, dur: fmt(parseDurMin(d.dur) * 0.5), note: ((d.note || '') + ' Settimana evento: metà volume.').trim() };
    });
}

// 19/10/2026 sera: la fase nutrizionale di un giorno (mantenimento / costruzione / definizione): dalla settimana del
// piano (es. la pausa dalla dieta), poi dalla fase, poi mantenimento.
function faseNutrizione(dateISO) {
    const w = findDetailedWeek(dateISO);
    if (w) return w.week.nutrizione || w.phase.nutrizione || 'mantenimento';
    const s = findSummaryPhase(dateISO);
    return (s && s.nutrizione) || 'mantenimento';
}

function applyPlanB(days, level, weekStartISO) {
    if (level === 'piena') return days;
    if (level === 'evento') return applyEvento(days, weekStartISO);
    if (level === 'recupero') {
        return days.map(d => ({ d: d.d, s: 'Riposo o Passeggiata', zone: 'Rec', note: 'Piano recupero: fermati, non inseguire il piano.' }));
    }
    // ridotta: tieni martedì e la sessione non-martedì più lunga (di solito domenica), tutto il resto -> riposo/Z1
    let longIdx = -1, longMin = -1;
    days.forEach((d, i) => {
        if (d.d === 'Mar') return;
        const min = parseDurMin(d.dur);
        if (min > longMin) { longMin = min; longIdx = i; }
    });
    return days.map((d, i) => {
        if (d.d === 'Mar') return d;
        if (i === longIdx) return { ...d, s: d.s + ' (ridotta)', note: (d.note || '') + ' Accorcia di circa il 40%.' };
        if (d.s === 'Riposo' || d.s === 'Riposo o Passeggiata') return d;
        return { d: d.d, s: 'Riposo', zone: 'Rec', note: 'Piano ridotto: sessione saltata.' };
    });
}

const DAY_ORDER = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Ripianifica la settimana quando uno o più giorni diventano indisponibili. Le sessioni
// critiche si spostano solo su un vero Riposo libero (mai sopra un altro allenamento); il
// volume delle sessioni non critiche saltate viene travasato sulla Z2 più lunga rimasta,
// per mantenere il volume settimanale invece di perderlo. Non è un vero motore di carico
// (servirebbe la potenza per un TSS reale), solo ricalibrazione su volume e piazzamento.
//
// lockedDaySet: giorni già "decisi dalla realtà" (fatti o riposo confermati) — mai
// bersaglio di uno spostamento, nemmeno se sono un Riposo pianificato ma già passato.
function replanWeek(days, unavailableSet, lockedDaySet) {
    if (!unavailableSet || unavailableSet.size === 0) return { days, notes: [] };

    const locked = lockedDaySet || new Set();
    const result = days.map(d => ({ ...d }));
    const notes = [];
    const idxOf = code => result.findIndex(d => d.d === code);
    const isRiposo = s => s === 'Riposo' || s === 'Riposo o Passeggiata';
    const isFreeRiposo = i => isRiposo(result[i].s) && !unavailableSet.has(result[i].d) && !result[i]._usedAsSlot && !locked.has(result[i].d);

    // Evita due giorni duri consecutivi quando possibile; excludeIdx scarta il giorno che
    // si sta liberando (altrimenti risulterebbe falsamente adiacente a se stesso).
    function isAdjacentToCritical(i, excludeIdx) {
        return (i > 0 && i - 1 !== excludeIdx && result[i - 1].critical)
            || (i < 6 && i + 1 !== excludeIdx && result[i + 1].critical);
    }
    function nearestFreeRiposo(fromIdx) {
        const candidates = [];
        for (let i = 0; i < 7; i++) if (isFreeRiposo(i)) candidates.push(i);
        if (candidates.length === 0) return -1;
        const nonAdjacent = candidates.filter(i => !isAdjacentToCritical(i, fromIdx));
        const pool = nonAdjacent.length > 0 ? nonAdjacent : candidates;
        let best = -1, bestDist = Infinity;
        for (const i of pool) {
            const dist = Math.abs(i - fromIdx);
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
        return best;
    }

    function fmtMin(min) {
        const h = Math.floor(min / 60), m = min % 60;
        return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
    }

    // 1) Sessioni CRITICHE sui giorni indisponibili: spostate solo su un vero Riposo libero.
    unavailableSet.forEach(dayCode => {
        const idx = idxOf(dayCode);
        if (idx === -1 || !result[idx].critical) return;
        const day = { ...result[idx] };

        const slot = nearestFreeRiposo(idx);
        if (slot === -1) {
            notes.push(`${dayCode}: ${day.s} non ricollocabile — nessun giorno di Riposo libero questa settimana su cui spostarla senza cancellare un altro allenamento. Salta senza recupero: valuta uno spostamento manuale.`);
            result[idx] = { d: dayCode, s: 'Riposo', zone: 'Rec', note: `Imprevisto: ${day.s} saltata, nessun Riposo disponibile per ospitarla.` };
            return;
        }

        const target = result[slot];
        let msg = `${day.s} spostata da ${dayCode} a ${target.d} (unico vero Riposo libero, nessun altro allenamento toccato).`;
        if (isAdjacentToCritical(slot, idx)) {
            msg += ' ⚠ Resta comunque affiancata a un\'altra sessione critica (nessun altro Riposo libero questa settimana) — valuta di alleggerirla o spostarla manualmente.';
        }
        notes.push(msg);
        result[slot] = { ...day, d: target.d, _usedAsSlot: true, note: (day.note || '') + ` (spostata da ${dayCode} per imprevisto)` };
        result[idx] = { d: dayCode, s: 'Riposo', zone: 'Rec', note: 'Imprevisto: sessione spostata su un giorno di Riposo.' };
    });

    // 2) Sessioni NON critiche sui giorni indisponibili: il volume perso viene travasato
    //    sulla sessione Z2 più lunga rimasta libera, invece di sparire e basta.
    unavailableSet.forEach(dayCode => {
        const idx = idxOf(dayCode);
        if (idx === -1) return;
        const day = result[idx];
        if (day.critical || day._usedAsSlot) return; // già gestita sopra, o è un nuovo slot appena riempito
        if (isRiposo(day.s)) return; // era già un giorno di riposo, nulla da recuperare

        const lostMin = parseDurMin(day.dur);
        result[idx] = { d: dayCode, s: 'Riposo', zone: 'Rec', note: 'Imprevisto: giornata non disponibile.' };
        if (lostMin <= 0) {
            notes.push(`${dayCode}: sessione leggera saltata, nessun volume da recuperare.`);
            return;
        }

        // Candidato: il giorno Z2 (non critico, non indisponibile, non bloccato dalla storia) più lungo.
        let bestIdx = -1, bestMin = -1;
        result.forEach((d, i) => {
            if (i === idx || d.critical || isRiposo(d.s) || unavailableSet.has(d.d) || locked.has(d.d)) return;
            const min = parseDurMin(d.dur);
            if (min > bestMin) { bestMin = min; bestIdx = i; }
        });

        if (bestIdx === -1) {
            notes.push(`${dayCode}: ${day.s} saltata, ma nessun altro giorno Z2 libero su cui travasare il volume perso (~${fmtMin(lostMin)}).`);
            return;
        }

        const target = result[bestIdx];
        const newMin = parseDurMin(target.dur) + lostMin;
        result[bestIdx] = { ...target, dur: fmtMin(newMin), note: (target.note ? target.note + ' ' : '') + `Allungata di ${fmtMin(lostMin)} per recuperare il volume di ${dayCode} (${day.s}), a parità di stimolo settimanale.` };
        notes.push(`${dayCode}: ${day.s} saltata, ${fmtMin(lostMin)} travasati su ${target.d} (ora ${fmtMin(newMin)}) per mantenere il volume settimanale.`);
    });

    // riordina secondo DAY_ORDER e ripulisci i campi interni
    result.sort((a, b) => DAY_ORDER.indexOf(a.d) - DAY_ORDER.indexOf(b.d));
    result.forEach(d => { delete d._usedAsSlot; });
    return { days: result, notes };
}

// Confronta il piano con cosa è successo davvero (da intervals.icu) per i giorni già
// trascorsi. Confronto onesto, non un vero match fisiologico: solo durata/TSS totali.
// Stati per ciascun giorno: rest-ok, missed (perso, da passare a replanWeek), today-pending,
// future, done-match (durata simile), done-divergent (fatto ma diverso — volume non perso).
function matchWeekToActual(days, weekStartISO, todayISO, activitiesByDate) {
    const isRest = s => s === 'Riposo' || s === 'Riposo o Passeggiata';
    return days.map((day, i) => {
        const dateISO = fmtISO(addDays(parseISO(weekStartISO), i));
        const dayActivities = activitiesByDate[dateISO] || [];

        if (dayActivities.length === 0) {
            // Il controllo sulla data viene SEMPRE prima di "era un Riposo pianificato":
            // un Riposo di sabato prossimo non è ancora "confermato dalla realtà", è solo
            // il piano — non va bloccato come se fosse già successo (altrimenti replanWeek
            // potrebbe scartarlo come bersaglio valido per uno spostamento, vedi lockedDaySet).
            if (dateISO > todayISO) return { dateISO, status: 'future', activities: [] };
            if (dateISO === todayISO) return { dateISO, status: isRest(day.s) ? 'rest-ok' : 'today-pending', activities: [] };
            if (isRest(day.s)) return { dateISO, status: 'rest-ok', activities: [] };
            return { dateISO, status: 'missed', activities: [] };
        }

        // 13/10/2026: abbinata al pianificato su intervals.icu (a mano o in automatico): è la sessione del piano, fatta
        if (dayActivities.some(a => a.abbinata)) {
            return { dateISO, status: 'done-match', activities: dayActivities, actualMin: dayActivities.reduce((s, a) => s + (a.durationMin || 0), 0), actualTSS: dayActivities.reduce((s, a) => s + (a.tss || 0), 0) };
        }
        const actualMin = dayActivities.reduce((s, a) => s + (a.durationMin || 0), 0);
        const actualTSS = dayActivities.reduce((s, a) => s + (a.tss || 0), 0);
        const plannedMin = parseDurMin(day.dur);

        if (isRest(day.s) || plannedMin === 0) {
            return { dateISO, status: 'done-divergent', activities: dayActivities, actualMin, actualTSS };
        }

        const ratio = actualMin / plannedMin;
        const status = (ratio >= 0.7 && ratio <= 1.4) ? 'done-match' : 'done-divergent';
        return { dateISO, status, activities: dayActivities, actualMin, actualTSS };
    });
}

// Sostituisce il piano in uso senza cambiare l'oggetto SEASON (lo tengono tutti per riferimento).
function usaPiano(dati) {
    const copia = JSON.parse(JSON.stringify(dati));
    Object.keys(SEASON).forEach(k => { delete SEASON[k]; });
    Object.assign(SEASON, copia);
}

if (typeof module !== 'undefined') module.exports = { SEASON, usaPiano, applyEvento, faseNutrizione, parseDurMin, findDetailedWeek, findSummaryPhase, applyPlanB, replanWeek, matchWeekToActual, fmtISO, mondayOf, addDays, parseISO };

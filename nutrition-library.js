// MirabiWatt Nutrition Library — pasti composti da alimenti reali con macro/kcal
// calcolati (non stimati a vista), scalati sul peso live dell'atleta.
// Fonte valori macro: tabelle nutrizionali standard per 100g, arrotondate.

const FOODS = {
    pollo: { label: 'Petto di pollo/tacchino', p: 31, f: 3.6, c: 0 },
    salmone: { label: 'Salmone', p: 20, f: 13, c: 0 },
    ceci: { label: 'Ceci cotti', p: 8, f: 2.6, c: 27 },
    tofu: { label: 'Tofu', p: 12, f: 6, c: 2 },
    uovo: { label: 'Uova intere', p: 12, f: 10, c: 1 },
    albume: { label: 'Albume', p: 11, f: 0, c: 0.7 },
    avena: { label: 'Avena (secca)', p: 13, f: 7, c: 60 },
    riso: { label: 'Riso bianco (cotto)', p: 2.7, f: 0.3, c: 28 },
    pasta: { label: 'Pasta (cotta)', p: 5, f: 1, c: 25 },
    patate: { label: 'Patate lesse', p: 2, f: 0.1, c: 17 },
    yogurtG: { label: 'Yogurt greco', p: 10, f: 2, c: 4 },
    banana: { label: 'Banana', p: 1.1, f: 0.3, c: 23 },
    mela: { label: 'Mela', p: 0.3, f: 0.2, c: 14 },
    mandorle: { label: 'Mandorle', p: 21, f: 49, c: 22 },
    olio: { label: 'Olio EVO', p: 0, f: 100, c: 0 },
    verdure: { label: 'Verdure miste', p: 2, f: 0.3, c: 5 },
    proteinaPolvere: { label: 'Proteine in polvere', p: 80, f: 5, c: 8 },
    paneBianco: { label: 'Pane bianco', p: 9, f: 1, c: 49 },
    miele: { label: 'Miele', p: 0.3, f: 0, c: 82 },
    maltodestrine: { label: 'Maltodestrine/gel', p: 0, f: 0, c: 95 },
    latteParz: { label: 'Latte parz. scremato', p: 3.3, f: 1.5, c: 5 },
    parmigiano: { label: 'Parmigiano', p: 33, f: 29, c: 0 }
};

// Opzioni intercambiabili per i pasti marcati "swap: true" — grammature scelte per
// dare una quantità di proteine comparabile (~35g), macro/kcal calcolati per davvero.
const PROTEIN_SWAPS = [
    { key: 'carne', label: 'Carne', items: [{ food: 'pollo', grams: 150 }] },
    { key: 'pesce', label: 'Pesce', items: [{ food: 'salmone', grams: 180 }] },
    { key: 'legumi', label: 'Legumi', items: [{ food: 'ceci', grams: 280 }, { food: 'parmigiano', grams: 20 }] },
    { key: 'uova', label: 'Uova', items: [{ food: 'uovo', grams: 150 }, { food: 'albume', grams: 100 }] }
];

function computeSwapOption(opt) {
    const items = opt.items.map(i => macro(i.food, i.grams));
    const m = sumMacros(items);
    return { key: opt.key, label: opt.label, items, ...m, kcal: kcalOf(m) };
}

function macro(foodKey, grams) {
    const f = FOODS[foodKey];
    return { food: foodKey, label: f.label, grams: Math.round(grams), p: f.p * grams / 100, fat: f.f * grams / 100, c: f.c * grams / 100 };
}
function sumMacros(items) { return items.reduce((a, b) => ({ p: a.p + b.p, fat: a.fat + b.fat, c: a.c + b.c }), { p: 0, fat: 0, c: 0 }); }
function kcalOf(m) { return Math.round(m.p * 4 + m.fat * 9 + m.c * 4); }

// Ogni voce items scala con weightScale (peso_atleta / 83.6, il peso di riferimento
// su cui sono state calibrate le grammature) tranne i condimenti fissi (olio).
function buildMeals(dayType, weightKg) {
    const scale = weightKg / 83.6;
    const sc = g => Math.round(g * scale);

    let meals;
    if (dayType === 'riposo') {
        meals = [
            { name: 'Colazione', items: [macro('uovo', sc(150)), macro('avena', sc(50)), macro('banana', sc(120))] },
            { name: 'Spuntino mattina', items: [macro('mandorle', sc(20)), macro('mela', sc(150))] },
            { name: 'Pranzo', items: [macro('pollo', sc(150)), macro('riso', sc(180)), macro('verdure', sc(150)), macro('olio', 8)], swap: true },
            { name: 'Spuntino pomeriggio', items: [macro('yogurtG', sc(150)), macro('mela', sc(100))] },
            { name: 'Cena', items: [macro('salmone', sc(180)), macro('patate', sc(100)), macro('verdure', sc(150)), macro('olio', 8)], swap: true }
        ];
    } else {
        // martedì HIT/Zwift e uscita lunga — stesso impianto ad alto carboidrato
        meals = [
            { name: 'Colazione pre-sessione', items: [macro('uovo', sc(100)), macro('paneBianco', sc(80)), macro('banana', sc(120)), macro('miele', sc(15))] },
            { name: 'Durante la sessione', items: [macro('maltodestrine', sc(100)), macro('paneBianco', sc(40))], note: 'Solo se la sessione supera i 75-90\'. Sorseggia/mangia distribuendo, non tutto insieme.' },
            { name: 'Recovery (entro 20\' dalla fine)', items: [macro('proteinaPolvere', sc(30)), macro('latteParz', sc(300))] },
            { name: 'Pranzo', items: [macro('pollo', sc(160)), macro('pasta', sc(420)), macro('verdure', sc(150)), macro('olio', 10)], swap: true },
            { name: 'Spuntino pomeriggio', items: [macro('yogurtG', sc(150)), macro('mela', sc(150)), macro('banana', sc(120)), macro('mandorle', sc(10))] },
            { name: 'Cena', items: [macro('salmone', sc(160)), macro('riso', sc(380)), macro('verdure', sc(150)), macro('olio', 8)], swap: true }
        ];
    }

    // Chiudi il gap proteico con uno spuntino serale (come da foglio Alimentazione originale
    // dell'utente: "bibitone di proteine a lento assorbimento prima di dormire")
    const proteinTarget = Math.round(weightKg * 2.2);
    const runningTotal = sumMacros(meals.flatMap(m => m.items));
    const gapP = proteinTarget - runningTotal.p;
    if (gapP > 3) {
        meals.push({ name: 'Spuntino serale', items: [macro('proteinaPolvere', gapP / 0.8)], note: 'Chiude il fabbisogno proteico giornaliero — proteine a lento assorbimento prima di dormire.' });
    }

    return meals;
}

// 19/10/2026 sera: nutrizione per fase (mantenimento / costruzione / definizione) e per giorno, da «The Muscle and
// Strength Pyramid: Nutrition» (Helms) e dagli studi in sintesi-ricomposizione-corporea.md.
// - Mantenimento stimato: 30 kcal/kg (vita quotidiana) + la seduta del giorno; si corregge col peso vero (recap domenica).
// - Costruzione: +100/+200 kcal (intermedio: +0,5-1% del peso al mese). Definizione: −0,5/−1% a settimana, deficit
//   ≤500 kcal (Murphy & Koehler 2022) nei giorni di palestra e riposo, quasi niente sotto la bici (IOC RED-S 2018).
// - Proteine 2,0 g/kg in costruzione, 2,4 in definizione; grassi 25% / 20% delle kcal, mai sotto 0,5 g/kg; carboidrati
//   il resto, mai sotto 1 g/kg.
const FASI_NUTRIZIONE = {
    mantenimento: { proteine: 2.0, grassiPct: 0.25, delta: { riposo: 0, palestra: 0, endurance: 0, hit: 0, lungo: 0 },
        perche: 'Calorie al fabbisogno: il peso resta stabile, l\'allenamento fa il lavoro. Si usa nel ri-adattamento, nelle feste, nelle pause dalla dieta e d\'estate (Trexler 2014: dopo una dieta il mantenimento stabilizza peso e prestazione).' },
    costruzione: { proteine: 2.0, grassiPct: 0.25, delta: { riposo: 100, palestra: 200, endurance: 150, hit: 150, lungo: 150 },
        perche: 'Surplus piccolo, circa +150 kcal: per un intermedio bastano +0,5-1% del peso al mese (Pyramid Nutrition). Surplus più grandi aggiungono soprattutto grasso (Helms 2023).' },
    definizione: { proteine: 2.4, grassiPct: 0.20, delta: { riposo: -500, palestra: -450, endurance: -250, hit: -150, lungo: -100 },
        perche: 'Deficit per perdere 0,5-1% del peso a settimana tenendo il muscolo: proteine alte (2,3-2,8 g/kg, Pyramid) e mai più di ~500 kcal al giorno (Murphy & Koehler 2022). Il deficit sta nei giorni di palestra e riposo: sotto i lunghi e la HIT si mangia, per la salute di ossa e ormoni (IOC RED-S).' }
};
const KCAL_ORA_KG = { palestra: 4.5, endurance: 7.5, lungo: 7.5, hit: 10 };     // kcal per ora per kg
const MIN_PREDEFINITI = { palestra: 75, endurance: 90, lungo: 180, hit: 70 };
const CIBI_CARBO = ['avena', 'riso', 'pasta', 'patate', 'paneBianco', 'banana', 'mela', 'miele', 'maltodestrine'];
const CIBI_PROTEICI = ['pollo', 'salmone', 'uovo', 'albume', 'yogurtG', 'tofu'];
const CIBI_GRASSI = ['olio', 'mandorle'];

function mantenimentoKcal(dayType, weightKg, minuti) {
    const k = KCAL_ORA_KG[dayType];
    return 30 * weightKg + (k ? k * weightKg * (minuti || MIN_PREDEFINITI[dayType]) / 60 : 0);
}

function targetGiorno(dayType, weightKg, fase, minuti) {
    const f = FASI_NUTRIZIONE[fase] || FASI_NUTRIZIONE.mantenimento;
    const kcal = Math.round((mantenimentoKcal(dayType, weightKg, minuti) + (f.delta[dayType] || 0)) / 10) * 10;
    const p = Math.round(f.proteine * weightKg);
    const fat = Math.round(Math.max(0.5 * weightKg, kcal * f.grassiPct / 9));
    const c = Math.round(Math.max(1 * weightKg, (kcal - 4 * p - 9 * fat) / 4));
    const t = { p, fat, c };
    t.kcal = kcalOf(t);
    return t;
}

// porta i pasti del modello al bersaglio: carboidrati, poi proteine (spuntino serale o porzioni), poi grassi
function scalaPasti(meals, target, weightKg) {
    meals = meals.filter(m => m.name !== 'Spuntino serale').map(m => ({ ...m, items: m.items.map(i => ({ ...i })) }));
    const tutti = () => meals.flatMap(m => m.items);
    const riscala = (chiavi, fattore) => meals.forEach(m => { m.items = m.items.map(i => chiavi.includes(i.food) ? macro(i.food, i.grams * fattore) : i); });
    for (let giro = 0; giro < 3; giro++) {
        const carbo = sumMacros(tutti().filter(i => CIBI_CARBO.includes(i.food))).c, altri = sumMacros(tutti()).c - carbo;
        if (carbo > 0) riscala(CIBI_CARBO, Math.min(3, Math.max(0.25, (target.c - altri) / carbo)));
        const prot = sumMacros(tutti()).p;
        if (prot > target.p * 1.05) {
            const daCibi = sumMacros(tutti().filter(i => CIBI_PROTEICI.includes(i.food))).p;
            if (daCibi > 0) riscala(CIBI_PROTEICI, Math.max(0.5, (daCibi - (prot - target.p)) / daCibi));
        }
        const grassi = sumMacros(tutti().filter(i => CIBI_GRASSI.includes(i.food))).fat, altriG = sumMacros(tutti()).fat - grassi;
        if (grassi > 0) riscala(CIBI_GRASSI, Math.min(3, Math.max(0, (target.fat - altriG) / grassi)));
    }
    const gap = target.p - sumMacros(tutti()).p;
    if (gap > 3) meals.push({ name: 'Spuntino serale', items: [macro('proteinaPolvere', gap / 0.8)], note: 'Chiude il fabbisogno proteico: proteine a lento assorbimento prima di dormire.' });
    meals.forEach(m => { m.items = m.items.filter(i => i.grams >= 5); });
    return meals.filter(m => m.items.length);
}

function consigliGiorno(dayType, weightKg, kcal, minuti) {
    const oreBici = ['endurance', 'lungo', 'hit'].includes(dayType) ? (minuti || MIN_PREDEFINITI[dayType]) / 60 : 0;
    const centinaia = x => Math.round(x / 100) * 100;
    return {
        acquaL: Math.round((weightKg / 23 + oreBici * 0.6) * 10) / 10,
        frutta: Math.ceil(kcal / 1000), verdura: Math.ceil(kcal / 1000),
        integratori: [
            { nome: 'Creatina monoidrato', dose: `${Math.round(0.04 * weightKg)} g al giorno, a qualsiasi ora`, perche: 'L\'integratore più studiato: più forza e più massa nel lungo periodo; non serve carico né abbinarla ai carboidrati (Pyramid Nutrition).' },
            { nome: 'Vitamina D3', dose: `${centinaia(20 * weightKg)}-${centinaia(40 * weightKg)} UI al giorno da ottobre a marzo`, perche: 'Con poco sole la carenza è comune e pesa su immunità, umore e prestazione (Pyramid: 20-80 UI/kg secondo il sole).' },
            { nome: 'Omega-3 (EPA+DHA)', dose: '2-3 g di EPA+DHA al giorno (somma sull\'etichetta)', perche: 'Utili per infiammazione, articolazioni e umore, sia in costruzione che in definizione (Pyramid).' },
            { nome: 'Caffeina', dose: `circa ${Math.round(3 * weightKg / 10) * 10} mg 30-60′ prima della seduta intensa (facoltativa)`, perche: 'Aumenta la prestazione nelle sedute dure (Helms 2014); evitarla nel pomeriggio tardi se disturba il sonno.' }
        ]
    };
}

/** Target, pasti e consigli del giorno. dayType: riposo | palestra | endurance | hit | lungo. opz: { fase, minuti }. */
function pianoNutrizione(dayType, weightKg, opz = {}) {
    const w = weightKg || 81, fase = FASI_NUTRIZIONE[opz.fase] ? opz.fase : 'mantenimento';
    const target = targetGiorno(dayType, w, fase, opz.minuti);
    const modello = dayType === 'riposo' || dayType === 'palestra' ? 'riposo' : 'hit';
    let meals = buildMeals(modello, w);
    if (dayType === 'palestra') meals = meals.map(m => m.name === 'Spuntino pomeriggio' ? { ...m, name: 'Spuntino pre-palestra (1-2 h prima)' } : m);
    meals = scalaPasti(meals, target, w);
    const pasti = meals.map(m => { const s = sumMacros(m.items); return { nome: m.name, cibi: m.items.map(i => ({ label: i.label, grams: i.grams })), nota: m.note || null, ...s, kcal: kcalOf(s) }; });
    const t = sumMacros(meals.flatMap(m => m.items));
    return { fase, target, mantenimento: Math.round(mantenimentoKcal(dayType, w, opz.minuti)), perche: FASI_NUTRIZIONE[fase].perche,
        consigli: consigliGiorno(dayType, w, target.kcal, opz.minuti), meals, pasti,
        totale: { p: Math.round(t.p), fat: Math.round(t.fat), c: Math.round(t.c), kcal: kcalOf(t) } };
}

if (typeof module !== 'undefined') module.exports = { FOODS, macro, sumMacros, kcalOf, buildMeals, PROTEIN_SWAPS, computeSwapOption, pianoNutrizione, FASI_NUTRIZIONE, targetGiorno };

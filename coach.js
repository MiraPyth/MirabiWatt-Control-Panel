// MirabiWatt · COACH CLAUDIO (19/10/2026 sera): il recap della domenica alle 20:00 su Discord. Logica pura: cosa è
// successo nella settimana (bici da intervals.icu, palestra dallo storico, forma e peso), il consiglio sulle calorie dal
// ritmo del peso, e il messaggio nel formato di «Claudio l'Economo» (titolo + riquadri colorati + fonti).
// I dati li raccoglie server.js (/api/coach/recap); il webhook sta in .coach_webhook (600), mai stampato.
const { parseISO, addDays, fmtISO, parseDurMin } = require('./season-plan.js');
const { baseName } = require('./workout-library.js');

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const giorno = (iso, n) => fmtISO(addDays(parseISO(iso), n));
const eRiposo = d => !d || /^Riposo/.test(d.s || '') || d.zone === 'Rec';
const eBici = a => /Ride/.test(a.type || '');
const virgola = (x, n = 1) => x.toFixed(n).replace('.', ',');
const ore = m => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;

/** Il tipo di giorno per la nutrizione (stessa regola della pagina Nutrizione). */
function tipoGiorno(d) {
    if (eRiposo(d)) return 'riposo';
    const z = (d.zone || '').toUpperCase();
    if (z.includes('PALESTRA')) return 'palestra';
    if (z.includes('HIT') || z.includes('TEST') || z.includes('GARA')) return 'hit';
    const m = parseDurMin(d.dur);
    return m >= 150 ? 'lungo' : m > 0 ? 'endurance' : 'riposo';
}

const media = xs => xs.length ? Math.round(xs.reduce((t, x) => t + x, 0) / xs.length * 100) / 100 : null;

function analizza({ ws, giorniPiano, attivita, sessioniPalestra, wellness, oggi }) {
    // oggi: si contano solo i giorni già passati (il recap gira la domenica sera; una prova a metà settimana resta onesta)
    const fine = oggi && oggi < giorno(ws, 6) ? oggi : giorno(ws, 6), dentro = d => d >= ws && d <= fine;
    const date = giorniPiano.map((_, i) => giorno(ws, i));
    giorniPiano = giorniPiano.filter((_, i) => date[i] <= fine);
    wellness = (wellness || []).filter(x => x.date <= fine);
    const bici = attivita.filter(a => eBici(a) && dentro(a.date));
    const giorniBici = giorniPiano.map((d, i) => ({ d, data: date[i] })).filter(x => !eRiposo(x.d) && x.d.zone !== 'Palestra');
    const sedute = (sessioniPalestra || []).filter(s => dentro(s.data));
    const previsteP = giorniPiano.filter(d => d.zone === 'Palestra').map(d => baseName(d.s));
    const fatteNomi = new Set(sedute.map(s => s.seduta));
    const fatteSerie = sedute.reduce((t, s) => t + s.esercizi.reduce((u, e) => u + e.serie.filter(x => x.fatta).length, 0), 0);
    // carichi saliti: miglior carico della settimana contro l'ultima seduta prima della settimana
    const progressi = [];
    const prima = (sessioniPalestra || []).filter(s => s.data < ws).sort((a, b) => a.data.localeCompare(b.data));
    const visti = new Set();
    for (const s of sedute) for (const e of s.esercizi) {
        const kg = Math.max(0, ...e.serie.filter(x => x.fatta && x.kg != null).map(x => x.kg));
        if (!kg || visti.has(e.id)) continue;
        const ultima = [...prima].reverse().find(p => p.esercizi.some(x => x.id === e.id && x.serie.some(y => y.fatta)));
        if (!ultima) continue;
        const prec = Math.max(0, ...ultima.esercizi.find(x => x.id === e.id).serie.filter(x => x.fatta && x.kg != null).map(x => x.kg));
        if (kg > prec) { progressi.push({ nome: e.nome || e.id, da: prec, a: kg }); visti.add(e.id); }
    }
    const w = wellness.filter(x => dentro(x.date)).sort((a, b) => a.date.localeCompare(b.date));
    const conCtl = w.filter(x => x.ctl != null), ultimo = conCtl[conCtl.length - 1];
    const pesi = (da, a) => wellness.filter(x => x.weight != null && x.date >= da && x.date <= a).map(x => x.weight);
    const mQui = media(pesi(ws, fine)), mPrima = media(pesi(giorno(ws, -7), giorno(ws, -1)));
    return {
        ws, fine: giorno(ws, 6),
        bici: { previste: giorniBici.length, fatte: giorniBici.filter(x => bici.some(a => a.date === x.data)).length,
                minuti: bici.reduce((t, a) => t + (a.durationMin || 0), 0), tss: bici.reduce((t, a) => t + (a.tss || 0), 0) },
        palestra: { previste: previsteP.length, fatte: sedute.length, serie: fatteSerie, mancate: previsteP.filter(n => !fatteNomi.has(n)), progressi },
        forma: conCtl.length ? { ctlDa: Math.round(conCtl[0].ctl), ctlA: Math.round(ultimo.ctl), tsb: Math.round(ultimo.ctl - ultimo.atl) } : null,
        peso: { media: mQui, delta: mQui != null && mPrima != null ? Math.round((mQui - mPrima) * 100) / 100 : null }
    };
}

// ritmo del peso per fase (Pyramid Nutrition): costruzione +0,5-1%/mese, definizione −0,5/−1%/settimana, mantenimento stabile
const RITMI = { costruzione: [0.05, 0.35], definizione: [-1.0, -0.4], mantenimento: [-0.3, 0.3] };
function consiglioPeso(fase, deltaKg, pesoKg) {
    if (deltaKg == null || !pesoKg) return { stato: 'senza-dati', testo: 'Pesati 2-3 volte a settimana (sincronizzato su intervals.icu): il ritmo del peso decide se correggere le calorie.' };
    const pct = deltaKg / pesoKg * 100, [lo, hi] = RITMI[fase] || RITMI.mantenimento;
    const ritmo = `${deltaKg > 0 ? '+' : ''}${virgola(deltaKg, 2)} kg sulla settimana prima`;
    if (pct > hi) return { stato: 'su', testo: `Peso ${ritmo}: più veloce del previsto per la ${fase}. Togli circa 150 kcal al giorno (meno carboidrati nei giorni di palestra e riposo).` };
    if (pct < lo) return { stato: 'giu', testo: `Peso ${ritmo}: più ${fase === 'definizione' ? 'veloce' : 'basso'} del previsto per la ${fase}. Aggiungi circa 150 kcal al giorno${fase === 'definizione' ? ': scendere troppo in fretta costa muscolo' : ''}.` };
    return { stato: 'ok', testo: `Peso ${ritmo}: nel ritmo giusto per la ${fase}. Calorie invariate.` };
}

const NOMI_TIPO = { riposo: 'Riposo', palestra: 'Palestra', endurance: 'Endurance', hit: 'Seduta intensa', lungo: 'Uscita lunga' };
const FONTI = 'Fonti: The Muscle and Strength Pyramid (Training e Nutrition), RP Scientific Principles of Hypertrophy Training e gli studi in «Fondamenti di Body Building». Dati: intervals.icu e MirabiWatt.';

function messaggio({ ws, analisi: a, commento, prossima: p }) {
    const dom = parseISO(giorno(ws, 6));
    const fatta = [
        `Bici **${a.bici.fatte}/${a.bici.previste}** sedute · ${ore(a.bici.minuti)} · ${a.bici.tss} TSS`,
        `Palestra **${a.palestra.fatte}/${a.palestra.previste}** sedute · ${a.palestra.serie} serie fatte` + (a.palestra.mancate.length ? ` · saltata: ${a.palestra.mancate.join(', ')}` : '')
    ];
    if (a.palestra.progressi.length) fatta.push('📈 Carichi saliti: ' + a.palestra.progressi.map(x => `${x.nome} ${virgola(x.da, x.da % 1 ? 1 : 0)} → ${virgola(x.a, x.a % 1 ? 1 : 0)} kg`).join(' · '));
    if (a.forma) fatta.push(`Forma: CTL ${a.forma.ctlDa} → ${a.forma.ctlA} · TSB ${a.forma.tsb}`);
    if (a.peso.media != null) fatta.push(`Peso medio ${virgola(a.peso.media, 2)} kg` + (a.peso.delta != null ? ` (${a.peso.delta > 0 ? '+' : ''}${virgola(a.peso.delta, 2)} kg sulla settimana prima)` : ''));

    const giorni = p.giorni.map(d => `${d.d} · ${d.s}${d.dur ? ` · ${d.dur}` : ''}`);
    const prossima = [`**${p.fase} · ${p.label}** — ${p.special || ''}`.trim(), '', ...giorni].join('\n');

    const n = p.nutrizione, cons = consiglioPeso(n.fase, a.peso.delta, a.peso.media);
    const tipi = Object.entries(n.tipi).map(([t, x]) => `${NOMI_TIPO[t] || t} · ${x.kcal} kcal · P${x.p} C${x.c} G${x.fat}`);
    const alim = [`Fase **${n.fase}**`, ...tipi, '', `⚖️ ${cons.testo}`, '💊 Creatina 3 g ogni giorno · vitamina D d\'inverno · 2-3 g di omega-3.'].join('\n');

    const perche = [p.perche, '', n.perche].filter(x => x !== undefined).join('\n');
    const emb = (t, d, c) => ({ title: t, description: String(d).slice(0, 1500), color: c });
    const embeds = [
        emb('📊 La settimana appena fatta', fatta.join('\n'), 0x22C55E),
        emb('🧭 Com\'è andata', commento || 'Nessun commento questa settimana.', 0x3B82F6),
        emb('📅 La prossima settimana', prossima, 0xA855F7),
        emb('🍽️ Alimentazione', alim, 0xF97316),
        emb('🔬 Perché', perche, 0xEAB308)
    ];
    embeds[embeds.length - 1].footer = { text: FONTI };
    return { content: `🏋️ **Recap della settimana** · domenica ${dom.getDate()} ${MESI[dom.getMonth()]}`, embeds, allowed_mentions: { parse: [] } };
}

/** Il commento «Com'è andata» senza IA: quando Gemini non risponde. */
function commentoBase(a) {
    const r = [];
    const tot = a.bici.previste + a.palestra.previste, fatte = a.bici.fatte + a.palestra.fatte;
    r.push(fatte >= tot ? 'Settimana completa: tutte le sedute fatte.' : `${fatte} sedute su ${tot}: ${a.palestra.mancate.length ? `in palestra è saltata ${a.palestra.mancate.join(', ')}` : 'qualche uscita in meno in bici'}. Si riparte dal piano, senza recuperi forzati.`);
    if (a.palestra.progressi.length) r.push(`I carichi salgono (${a.palestra.progressi.length} esercizi): la doppia progressione sta funzionando.`);
    if (a.forma && a.forma.tsb < -20) r.push(`TSB ${a.forma.tsb}: fatica alta, dormi bene e non aggiungere niente.`);
    return r.join(' ');
}

module.exports = { analizza, consiglioPeso, messaggio, tipoGiorno, commentoBase };

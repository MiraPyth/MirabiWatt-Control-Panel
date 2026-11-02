// MirabiWatt · prompt di «Ripianifica con IA» (31/10/2026). Gemini deve sapere che giorno è, cosa è stato fatto davvero
// QUESTA settimana fino ad adesso e quali giorni restano: si ripianificano solo oggi (se non c'è già un'attività) e i
// giorni futuri. Il passato non si riscrive: applica() rimette i giorni passati come da piano anche se Gemini li cambia.
// Logica pura, niente rete; il server ci mette i dati (tests/ripianifica_ia.test.js).
const { parseISO, addDays, fmtISO } = require('./season-plan.js');
const { baseName } = require('./workout-library.js');

const NOMI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const RIPOSI = ['Riposo', 'Riposo o Passeggiata'];
const z2 = n => String(n).padStart(2, '0');
const breve = iso => { const d = parseISO(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
const eRiposo = g => !g || !g.s || RIPOSI.includes(baseName(g.s)) || g.zone === 'Rec';

/** adesso: Date (ora locale del server, Europe/Rome). attivita: [{date, name, type, tss, durationMin}] anche fuori settimana. */
function contesto({ ws, giorni, attivita = [], adesso, forma = {}, prossima = [], etichetta = '' }) {
    const oggi = fmtISO(adesso);
    const date = NOMI.map((_, i) => fmtISO(addDays(parseISO(ws), i)));
    const lista = date.map((data, i) => {
        const fatto = attivita.filter(a => a.date === data);
        return { d: NOMI[i], data, quando: data < oggi ? 'passato' : data === oggi ? 'oggi' : 'futuro', piano: giorni[i] || null, fatto };
    });
    return { ws, oggi, adesso, etichetta, forma, giorni: lista,
        prossima: prossima.map((g, i) => ({ d: NOMI[i], data: fmtISO(addDays(parseISO(ws), 7 + i)), piano: g })) };
}

/** I giorni che si possono ancora cambiare: i futuri, e oggi se non c'è ancora un'attività. */
function modificabili(c) {
    return c.giorni.filter(g => g.quando === 'futuro' || (g.quando === 'oggi' && !g.fatto.length)).map(g => g.d);
}

const seduta = g => (eRiposo(g) ? 'Riposo' : `${g.s}${g.dur ? ' ' + g.dur : ''}${g.zone ? ` (${g.zone})` : ''}${g.critical ? ' [chiave]' : ''}`);
const attivitaTesto = a => `${a.type || 'Attività'} «${a.name || 'senza nome'}» ${a.durationMin != null ? a.durationMin + "'" : 'durata ?'}${a.tss != null ? ', TSS ' + a.tss : ''}`;

function prompt(c, motivo) {
    const libere = modificabili(c);
    if (!libere.length) throw new Error('Questa settimana è già passata: non c\'è più niente da ripianificare.');
    const a = c.adesso;
    const quando = `${GIORNI_LUNGHI[a.getDay()]} ${a.getDate()} ${MESI[a.getMonth()]} ${a.getFullYear()}, ore ${z2(a.getHours())}:${z2(a.getMinutes())}`;
    const riga = g => `- ${g.d} ${breve(g.data)} — previsto: ${seduta(g.piano)} — fatto: ${g.fatto.length ? g.fatto.map(attivitaTesto).join(' + ') : 'niente'}`;
    const passati = c.giorni.filter(g => !libere.includes(g.d));
    const daFare = c.giorni.filter(g => libere.includes(g.d));
    const fatte = passati.flatMap(g => g.fatto);
    const tss = fatte.reduce((t, x) => t + (x.tss || 0), 0), min = fatte.reduce((t, x) => t + (x.durationMin || 0), 0);
    const saltate = passati.filter(g => !eRiposo(g.piano) && !g.fatto.length).map(g => `${g.piano.s} (${g.d})`);
    const extra = passati.filter(g => eRiposo(g.piano) && g.fatto.length).map(g => g.d);
    const f = c.forma || {};
    return `Sei un coach di ciclismo e palestra. Ripianifichi SOLO i giorni che restano della settimana in corso di un amatore.

ADESSO: ${quando} (ora italiana).
SETTIMANA: da lunedì ${breve(c.giorni[0].data)} a domenica ${breve(c.giorni[6].data)}${c.etichetta ? ` — ${c.etichetta}` : ''}.

GIÀ SUCCESSO (storia: NON si cambia, serve solo a capire il carico già fatto):
${passati.length ? passati.map(riga).join('\n') : '- niente, la settimana non è ancora iniziata'}

CONTO DELLA SETTIMANA FIN QUI: ${fatte.length} attività, ${min}', TSS ${tss}.
Sedute saltate: ${saltate.length ? saltate.join(', ') : 'nessuna'}.${extra.length ? `\nAttività fatte in giorni di riposo: ${extra.join(', ')}.` : ''}

DA RIPIANIFICARE (solo questi giorni, il resto è chiuso):
${daFare.map(g => `- ${g.d} ${breve(g.data)} — previsto: ${seduta(g.piano)}${g.quando === 'oggi' ? ' (è oggi: conta l\'ora attuale)' : ''}`).join('\n')}

STATO DI FORMA OGGI (intervals.icu): CTL (fitness) ${f.ctl ?? '?'}, ATL (fatica) ${f.atl ?? '?'}, TSB (forma) ${f.tsb ?? '?'}.
${c.prossima.length ? `\nINIZIO DELLA SETTIMANA DOPO (non si cambia, ma non va compromessa):\n${c.prossima.map(g => `- ${g.d} ${breve(g.data)} — ${seduta(g.piano)}`).join('\n')}\n` : ''}
REGOLE:
- Non recuperare le sedute saltate accumulandole: quello che è saltato è perso. Puoi spostarne UNA in un giorno libero solo se ha senso per il carico e per la settimana dopo.
- Tieni conto del carico già fatto: dopo giorni pesanti (TSS alto, TSB molto negativo) scegli recupero o volume facile, non intensità.
- Massimo 2-3 sedute dure (HIT) a settimana, almeno il 75% a bassa intensità, mai due dure di fila.
- Le sedute [chiave] sono le più importanti: se il loro giorno è passato senza farle, non rimetterle a forza.
- Le sedute «Palestra» sono pesi (o elastici), non HIT: non metterle il giorno prima di un lungo e lasciane il nome com'è.
- Usa i nomi di seduta del piano quando puoi: ${NOMI_SEDUTE.join(', ')}. Oppure «Riposo».
- Durata ("dur") nel formato del piano: 45' oppure 1h30 oppure 2h-2h30.

RICHIESTA DELL'ATLETA (interpretala con buon senso):
"${String(motivo || '').replace(/"/g, '\'')}"

Rispondi SOLO con un oggetto JSON valido, nessun altro testo:
{"days":[{"d":"${daFare[0].d}","s":"nome seduta","dur":"...","zone":"Z2 | Z1-Z2 | HIT | Palestra | Rec | ...","note":"cosa fare in una frase"}${daFare.length > 1 ? ', … un oggetto per ciascuno di: ' + daFare.map(g => g.d).join(', ') : ''}],"rationale":"2-4 frasi in italiano: cosa proponi e perché, citando il carico di questa settimana"}`;
}

const NOMI_SEDUTE = ['EnduranceCorto', 'EnduranceMedio', 'EnduranceLungo', 'MTB Endurance', 'Uscita facoltativa', 'Scarico',
    'Corpo libero e MSR', 'Riposo o Passeggiata', 'Zwift Race', 'Petto-Spalle', 'Gambe-Core', 'Schiena-Bicipiti',
    'Elastici Spinta', 'Elastici Gambe-Core', 'Elastici Tirata'];

/** Fonde la risposta di Gemini con il piano: 7 giorni, i chiusi restano come da piano. */
function applica(parsed, c) {
    if (!parsed || !Array.isArray(parsed.days)) throw new Error('Risposta AI malformata (giorni mancanti)');
    const libere = new Set(modificabili(c));
    const proposti = {};
    for (const g of parsed.days) if (g && NOMI.includes(g.d) && typeof g.s === 'string' && g.s.trim()) proposti[g.d] = g;
    const days = c.giorni.map(g => {
        const p = libere.has(g.d) && proposti[g.d];
        if (!p) return g.piano;
        const nuovo = { d: g.d, s: p.s.trim(), dur: String(p.dur || ''), zone: String(p.zone || '') };
        if (p.note) nuovo.note = String(p.note);
        return nuovo;
    });
    return { days, rationale: String(parsed.rationale || ''), ripianificati: [...libere] };
}

module.exports = { contesto, modificabili, prompt, applica };

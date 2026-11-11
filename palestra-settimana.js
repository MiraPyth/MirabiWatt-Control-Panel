// MirabiWatt · la settimana per l'app Android di palestra (10/11/2026). Il piano stagionale e' statico: le modifiche fatte da
// MirabiWatt vanno a intervals.icu come eventi [MW]. Qui la settimana si costruisce dagli eventi (fonte 'intervals'), con
// il piano per durata, zona e scheda; senza eventi si ricade sul piano (fonte 'piano'). Le sedute di palestra del piano che non
// sono piu' in calendario restano scegliibili in «altre», e una seduta fatta in un altro giorno della settimana conta come fatta.
// Pura: piano, schede ed eventi arrivano come dati.
const GG = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const RIPOSI = new Set(['Riposo', 'Riposo o Passeggiata', 'Corpo libero e MSR']);
const giornoISO = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const conSchema = nome => /\(.*\)\s*$/.test(nome || '');

/** 45 -> «45'», 60 -> «1h», 75 -> «1h15», 125 -> «2h05» (stesso formato del piano). */
const formatoDurata = m => (m < 60 ? `${m}'` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`);
const SPORT_TIPO = [[/weight|strength|crossfit/i, 'palestra'], [/ride/i, 'ciclismo'], [/run/i, 'corsa'], [/swim/i, 'nuoto']];
/** palestra | ciclismo | corsa | nuoto | altro, dal tipo dell'evento; senza tipo dalla scheda o dalla zona del piano; null se non e' un allenamento. */
function sportDi(type, seduta, zona, riposo) {
    if (riposo) return null;
    if (type) { const t = SPORT_TIPO.find(([re]) => re.test(type)); return t ? t[1] : 'altro'; }
    if (seduta || String(zona).toUpperCase().includes('PALESTRA')) return 'palestra';
    return /^(Z\d|HIT|TEST|GARA|TEMPO)/i.test(zona || '') ? 'ciclismo' : null;
}

/** Come un evento di intervals.icu («[MW] Petto-Spalle») diventa la sua scheda del piano: nome pulito, giorno del piano, nome con lo schema, scheda. */
function risolutore({ lunedi, findDetailedWeek, pianoPalestra, baseName }) {
    const wk = findDetailedWeek(lunedi), piano = wk && wk.week ? wk.week.days : [];
    const pulisci = n => baseName(String(n || '').replace(/^\[(MirabiWatt|MW)\]\s*/, ''));
    const perNome = nome => piano.find(d => d.s && baseName(d.s) === nome);
    const daPalestra = piano.find(d => d.s && conSchema(d.s) && pianoPalestra(d.s));
    const schema = daPalestra ? (daPalestra.s.match(/\(([^)]*)\)\s*$/) || [])[1] : null;
    const nomeCompleto = (nome, p) => (p && conSchema(p.s) ? p.s : schema ? `${nome} (${schema})` : nome);
    const scheda = full => (conSchema(full) ? pianoPalestra(full) || null : null);
    return { wk, piano, pulisci, perNome, nomeCompleto, scheda };
}

/** La scheda del piano per un evento di palestra della settimana che inizia di `lunedi`, o null. */
function schedaDiEvento({ nomeEvento, lunedi, findDetailedWeek, pianoPalestra, baseName }) {
    const r = risolutore({ lunedi, findDetailedWeek, pianoPalestra, baseName });
    const nome = r.pulisci(nomeEvento);
    return r.scheda(r.nomeCompleto(nome, r.perNome(nome)));
}

function settimanaPalestra({ lunedi, eventi, sessioni = [], gare = [], findDetailedWeek, pianoPalestra, baseName }) {
    const { wk, piano, pulisci, perNome, nomeCompleto, scheda } = risolutore({ lunedi, findDetailedWeek, pianoPalestra, baseName });
    const riposo = (nome, zona) => RIPOSI.has(nome) || zona === 'Rec';

    let fonte = 'piano', giorni;
    if (Array.isArray(eventi) && eventi.length) {
        fonte = 'intervals';
        giorni = GG.map((g, i) => {
            const data = giornoISO(lunedi, i), delGiorno = eventi.filter(e => e.date === data);
            const ev = delGiorno.find(e => (e.categoria || 'WORKOUT') !== 'NOTE'), nota = delGiorno.find(e => e.categoria === 'NOTE');
            if (!ev) return { data, giorno: g, nome: nota ? nota.name : 'Riposo', dur: '', zona: '', riposo: true, sport: null, tss: null, seduta: null, nomePiano: null };
            const nome = pulisci(ev.name), p = perNome(nome), full = nomeCompleto(nome, p), s = scheda(full);
            const zona = (p && p.zone) || (s ? 'Palestra' : '');
            const dur = ev.durationMin > 0 ? formatoDurata(Math.round(ev.durationMin)) : (p && p.dur) || '';
            const rip = riposo(nome, zona);
            return { data, giorno: g, nome, dur, zona, riposo: rip, sport: sportDi(ev.type, s, zona, rip), tss: typeof ev.tss === 'number' ? Math.round(ev.tss) : null, seduta: s, nomePiano: s ? full : null };
        });
    } else {
        giorni = piano.map((d, i) => {
            const nome = baseName(d.s || ''), s = d.s ? scheda(d.s) : null;
            const rip = riposo(nome, d.zone);
            return { data: giornoISO(lunedi, i), giorno: d.d || GG[i], nome, dur: d.dur || '', zona: d.zone || '', riposo: rip, sport: sportDi(null, s, d.zone, rip), tss: null, seduta: s, nomePiano: s ? d.s : null };
        });
    }

    // altre sedute del piano non in calendario (solo se la settimana viene da intervals.icu)
    const inCalendario = new Set(giorni.filter(g => g.seduta).map(g => g.seduta.seduta));
    const altre = fonte === 'intervals' ? piano.filter(d => d.s && scheda(d.s) && !inCalendario.has(scheda(d.s).seduta))
        .map(d => ({ giornoPiano: d.d || '', nome: baseName(d.s), nomePiano: d.s, seduta: scheda(d.s), fatta: false, fattaIl: null })) : [];

    // sessioni salvate nella settimana: prima a pari data, poi, in ordine di data, alla prima seduta non ancora fatta
    const fine = giornoISO(lunedi, 6);
    const libere = sessioni.filter(s => s.data >= lunedi && s.data <= fine).sort((a, b) => (a.data + (a.id || '')).localeCompare(b.data + (b.id || '')));
    const slot = [...giorni.filter(g => g.seduta).map(g => ({ g, nome: g.seduta.seduta, data: g.data })), ...altre.map(a => ({ g: a, nome: a.seduta.seduta, data: null }))];
    const assegna = (s, e) => { e.g.fatta = true; e.g.fattaIl = s.data; libere.splice(libere.indexOf(s), 1); };
    for (const e of slot) { const s = libere.find(x => baseName(x.seduta) === e.nome && x.data === e.data); if (s && !e.g.fatta) assegna(s, e); }
    for (const e of slot) { if (e.g.fatta) continue; const s = libere.find(x => baseName(x.seduta) === e.nome); if (s) assegna(s, e); }
    for (const e of slot) if (!e.g.fatta) { e.g.fatta = false; e.g.fattaIl = null; }
    for (const g of giorni) if (!g.seduta) { g.fatta = false; g.fattaIl = null; }

    return { lunedi, fonte, fase: wk && wk.phase ? wk.phase.name : null, settimana: wk && wk.week ? wk.week.label : null, gare, giorni, altre };
}

module.exports = { settimanaPalestra, schedaDiEvento };

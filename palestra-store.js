// MirabiWatt · sessioni di palestra salvate sull'OptiPlex (19/10/2026), in palestra-storico.json accanto al server.
// Una sessione risalvata con lo stesso id la sostituisce (es. doppio tocco su Salva o correzione).
const fs = require('fs');
const path = require('path');
const { ultimiDaStorico } = require('./palestra.js');

const PATH = path.join(__dirname, 'palestra-storico.json');
const numero = x => x === null || (typeof x === 'number' && isFinite(x) && x >= 0 && x < 1000);

function leggi(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
}

function valida(s) {
    if (!s || typeof s !== 'object') throw new Error('sessione mancante');
    if (typeof s.id !== 'string' || !s.id) throw new Error('id mancante');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data || '')) throw new Error('data non valida');
    if (typeof s.seduta !== 'string' || !Array.isArray(s.esercizi)) throw new Error('seduta o esercizi mancanti');
    for (const e of s.esercizi) {
        if (typeof e.id !== 'string' || !Array.isArray(e.serie)) throw new Error('esercizio non valido');
        for (const x of e.serie) if (!numero(x.kg) || !numero(x.reps) || typeof x.fatta !== 'boolean') throw new Error(`serie non valida in ${e.id}`);
    }
}

function salva(sessione, file = PATH) {
    valida(sessione);
    // nello storico solo quello che serve a ricordare: niente consigli, GIF, proposte
    const pulita = {
        id: sessione.id, data: sessione.data, seduta: sessione.seduta, schema: sessione.schema || '', inizio: sessione.inizio || null,
        fine: sessione.fine || null, note: String(sessione.note || '').slice(0, 1000),
        esercizi: sessione.esercizi.map(e => ({ id: e.id, nome: e.nome || e.id, serie: e.serie.map(x => ({ kg: x.kg, reps: x.reps, fatta: x.fatta })) }))
    };
    const vecchia = leggi(file).find(s => s.id === pulita.id);
    if (vecchia && vecchia.stravaId) pulita.stravaId = vecchia.stravaId;   // già su Strava: un nuovo salvataggio non la ripubblica
    const tutte = leggi(file).filter(s => s.id !== pulita.id);
    tutte.push(pulita);
    tutte.sort((a, b) => (a.data + a.id).localeCompare(b.data + b.id));
    fs.writeFileSync(file + '.tmp', JSON.stringify(tutte, null, 1));
    fs.renameSync(file + '.tmp', file);
    return pulita.id;
}

function scrivi(file, tutte) {
    fs.writeFileSync(file + '.tmp', JSON.stringify(tutte, null, 1));
    fs.renameSync(file + '.tmp', file);
}

function trova(id, file = PATH) {
    return leggi(file).find(s => s.id === id) || null;
}

/** Aggiunge campi a una seduta salvata (es. stravaId dopo la pubblicazione). */
function segna(id, campi, file = PATH) {
    const tutte = leggi(file), s = tutte.find(x => x.id === id);
    if (!s) return false;
    Object.assign(s, campi);
    scrivi(file, tutte);
    return true;
}

function storico(file = PATH) {
    const sessioni = leggi(file);
    return { sessioni, ultimi: ultimiDaStorico(sessioni) };
}

module.exports = { PATH, salva, storico, trova, segna };

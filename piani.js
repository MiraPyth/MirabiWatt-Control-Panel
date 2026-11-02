// MirabiWatt · piani stagionali salvati sull'OptiPlex (19/10/2026). Un file JSON per piano in piani/, con id e nome;
// la scelta del piano attivo in piani/attivo.json. Senza scelta vale il piano di sempre, «full-cycling».
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'piani');
const PREDEFINITO = 'full-cycling';
const ID_VALIDO = /^[a-z0-9-]+$/;

function elenco(dir = DIR) {
    // solo i piani veri: in piani/ ci sono anche attivo.json e settimane-speciali.json (25/10/2026)
    return fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'attivo.json').map(f => {
        const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return { id: p.id, nome: p.nome };
    }).filter(p => p.id && p.nome).sort((a, b) => a.nome.localeCompare(b.nome));
}

function leggi(id, dir = DIR) {
    if (!ID_VALIDO.test(id || '')) throw new Error(`piano non valido: ${id}`);
    return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
}

function attivo(dir = DIR) {
    try {
        const id = JSON.parse(fs.readFileSync(path.join(dir, 'attivo.json'), 'utf8')).id;
        if (ID_VALIDO.test(id || '') && fs.existsSync(path.join(dir, `${id}.json`))) return id;
    } catch (e) { /* mai scelto */ }
    return PREDEFINITO;
}

function scegli(id, dir = DIR) {
    leggi(id, dir); // deve esistere ed essere un id pulito
    fs.writeFileSync(path.join(dir, 'attivo.json'), JSON.stringify({ id, scelto: new Date().toISOString() }) + '\n');
    return id;
}

module.exports = { DIR, elenco, leggi, attivo, scegli };

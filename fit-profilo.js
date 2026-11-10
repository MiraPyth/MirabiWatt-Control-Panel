// MirabiWatt · profilo dell'app Fit (10/11/2026): nome, foto, unita', obiettivi e notifiche, salvati su file nella cartella dati del
// server (fit-profilo.json + foto-<hash>.jpg|png). Validazione rigida: campi sconosciuti o fuori regola sono rifiutati con un messaggio.
// Nessun obiettivo e' preimpostato: finche' Tiziano non lo imposta, l'app mostra «obiettivo non impostato».
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = 'fit-profilo.json';
const MAX_FOTO = 1.5 * 1024 * 1024;

const DEFAULT = () => ({
    nome: '', foto: null,
    unita: { peso: 'kg', distanza: 'km' },
    obiettivi: { oreMovimento: null, achievements: {} },
    notifiche: { allenamentiDaFare: true, allenamentiFatti: true, obiettiviGiornalieri: true, orario: '08:00' },
});

const eObj = x => x && typeof x === 'object' && !Array.isArray(x);
const attesi = (obj, ammessi, etichetta) => { for (const k of Object.keys(obj)) if (!ammessi.includes(k)) throw new Error(`campo non ammesso in ${etichetta}: ${k}`); };

function leggi(dir) {
    let salvato = {};
    try { const j = JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8')); if (eObj(j)) salvato = j; } catch (e) { /* assente o danneggiato: default */ }
    const d = DEFAULT();
    return { ...d, ...salvato, unita: { ...d.unita, ...(salvato.unita || {}) }, obiettivi: { ...d.obiettivi, ...(salvato.obiettivi || {}) }, notifiche: { ...d.notifiche, ...(salvato.notifiche || {}) } };
}

function scrivi(dir, p) {
    const f = path.join(dir, FILE);
    fs.writeFileSync(f + '.tmp', JSON.stringify(p, null, 1));
    fs.renameSync(f + '.tmp', f);
}

/** Applica una modifica parziale (solo i campi indicati), valida e salva. Torna il profilo completo. */
function aggiorna(dir, patch) {
    if (!eObj(patch)) throw new Error('richiesta non valida');
    attesi(patch, ['nome', 'unita', 'obiettivi', 'notifiche'], 'profilo');
    const p = leggi(dir);
    if ('nome' in patch) {
        const n = String(patch.nome == null ? '' : patch.nome).trim();
        if (n.length > 40) throw new Error('il nome puo\' avere al massimo 40 caratteri');
        p.nome = n;
    }
    if ('unita' in patch) {
        if (!eObj(patch.unita)) throw new Error('unita\' non valide');
        attesi(patch.unita, ['peso', 'distanza'], 'unita\'');
        if ('peso' in patch.unita) { if (!['kg', 'lb'].includes(patch.unita.peso)) throw new Error('unita\' del peso: kg o lb'); p.unita.peso = patch.unita.peso; }
        if ('distanza' in patch.unita) { if (!['km', 'mi'].includes(patch.unita.distanza)) throw new Error('unita\' della distanza: km o mi'); p.unita.distanza = patch.unita.distanza; }
    }
    if ('obiettivi' in patch) {
        if (!eObj(patch.obiettivi)) throw new Error('obiettivi non validi');
        attesi(patch.obiettivi, ['oreMovimento', 'achievements'], 'obiettivi');
        if ('oreMovimento' in patch.obiettivi) {
            const o = patch.obiettivi.oreMovimento;
            if (o !== null && !(typeof o === 'number' && o > 0 && o <= 24)) throw new Error('le ore di movimento devono essere tra 0 e 24 (o null per toglierle)');
            p.obiettivi.oreMovimento = o;
        }
        if ('achievements' in patch.obiettivi) {
            if (!eObj(patch.obiettivi.achievements)) throw new Error('soglie non valide');
            const a = { ...p.obiettivi.achievements };
            for (const [id, s] of Object.entries(patch.obiettivi.achievements)) {
                if (s === null) delete a[id];
                else if (typeof s === 'number' && s > 0) a[id] = s;
                else throw new Error(`soglia non valida per ${id}: serve un numero maggiore di zero`);
            }
            p.obiettivi.achievements = a;
        }
    }
    if ('notifiche' in patch) {
        if (!eObj(patch.notifiche)) throw new Error('notifiche non valide');
        attesi(patch.notifiche, ['allenamentiDaFare', 'allenamentiFatti', 'obiettiviGiornalieri', 'orario'], 'notifiche');
        for (const [k, v] of Object.entries(patch.notifiche)) {
            if (k === 'orario') { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new Error('orario non valido (HH:MM)'); p.notifiche.orario = v; }
            else { if (typeof v !== 'boolean') throw new Error(`notifiche: ${k} deve essere vero o falso`); p.notifiche[k] = v; }
        }
    }
    scrivi(dir, p);
    return p;
}

const estensione = tipo => ({ 'image/jpeg': 'jpg', 'image/png': 'png' }[tipo]);
const FIRMA = { jpg: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, png: b => b.length > 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG' };

/** Salva la foto profilo (JPEG o PNG fino a 1,5 MB), toglie la precedente e aggiorna il profilo. */
function salvaFoto(dir, dati, tipo) {
    const ext = estensione(tipo);
    if (!ext) throw new Error('la foto deve essere JPEG o PNG');
    if (!Buffer.isBuffer(dati) || dati.length > MAX_FOTO) throw new Error('la foto puo\' pesare al massimo 1,5 MB');
    if (!FIRMA[ext](dati)) throw new Error('foto non valida');
    const p = leggi(dir), nome = `foto-${crypto.createHash('sha1').update(dati).digest('hex').slice(0, 8)}.${ext}`;
    fs.writeFileSync(path.join(dir, nome), dati);
    if (p.foto && p.foto !== nome) { try { fs.unlinkSync(path.join(dir, p.foto)); } catch (e) { /* gia' tolta */ } }
    p.foto = nome;
    scrivi(dir, p);
    return p;
}

/** { tipo, dati } della foto attuale, o null. */
function leggiFoto(dir) {
    const p = leggi(dir);
    if (!p.foto || path.basename(p.foto) !== p.foto) return null;
    try { return { tipo: p.foto.endsWith('.png') ? 'image/png' : 'image/jpeg', dati: fs.readFileSync(path.join(dir, p.foto)) }; } catch (e) { return null; }
}

module.exports = { leggi, aggiorna, salvaFoto, leggiFoto, DEFAULT };

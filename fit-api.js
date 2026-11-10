// MirabiWatt · rotte /api/fit/* per l'app Fit (10/11/2026): peso da Garmin, obiettivi del giorno per gli anelli, profilo e foto.
// Le dipendenze arrivano da fuori (server.js le collega a Garmin, intervals.icu, sedute salvate): qui nessuna rete e nessun segreto.
// Regola: se un dato non si puo' leggere lo si dice (503/502, «avvisi»), mai un numero inventato.
const { obiettiviGiorno } = require('./fit-oggi.js');
const profilo = require('./fit-profilo.js');

const MAX_JSON = 16 * 1024;
const MAX_FOTO = 1.5 * 1024 * 1024;
const pad = n => String(n).padStart(2, '0');
const isoLocale = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const arr2 = x => Math.round(x * 100) / 100;

function json(res, stato, corpo) {
    res.writeHead(stato, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(corpo));
}

/** Legge il corpo fino a `limite` byte: { dati } oppure { troppo: true } (il resto si scarta, la richiesta si chiude in modo pulito). */
function leggiCorpo(req, limite) {
    return new Promise(ok => {
        const parti = []; let n = 0, troppo = false;
        req.on('data', c => { n += c.length; if (n > limite) { troppo = true; parti.length = 0; } else if (!troppo) parti.push(c); });
        req.on('end', () => ok(troppo ? { troppo: true } : { dati: Buffer.concat(parti) }));
        req.on('error', () => ok({ troppo: true }));
    });
}

function creaFitApi({ garmin, settimanaDel, attivita, sessioni, pesoKg, ftp, cartellaDati, adesso = () => new Date() }) {
    const oggi = () => isoLocale(adesso());
    const giorniFa = n => { const d = adesso(); d.setDate(d.getDate() - n); return isoLocale(d); };

    async function peso(req, res, u) {
        const g = u.searchParams.has('giorni') ? Number(u.searchParams.get('giorni')) : 60;
        if (!Number.isInteger(g) || g < 1 || g > 365) return json(res, 400, { error: 'giorni deve essere un intero tra 1 e 365' });
        try {
            const da = giorniFa(g), a = oggi(), serie = await garmin.peso(da, a);
            const variazione = serie.length >= 2 ? { kg: arr2(serie[0].kg - serie[1].kg), da: serie[1].data, a: serie[0].data } : null;
            json(res, 200, { generato: adesso().toISOString(), fonte: 'garmin', da, a, serie, ultimo: serie[0] || null, variazione });
        } catch (e) {
            const msg = String(e.message || 'Garmin non risponde');
            json(res, /non configurata/.test(msg) ? 503 : 502, { error: msg, ...(/non configurata/.test(msg) ? { nonDisponibile: true } : {}) });
        }
    }

    async function giornata(req, res) {
        const data = oggi();
        let settimana;
        try { settimana = await settimanaDel(data); } catch (e) { return json(res, 502, { error: 'settimana non disponibile' }); }
        const giorno = ((settimana && settimana.giorni) || []).find(x => x.data === data) || null;
        const avvisi = [];
        let att = [];
        try { att = await attivita(data, data); } catch (e) { avvisi.push('Attività di oggi non disponibili: intervals.icu non risponde.'); }
        const prof = profilo.leggi(cartellaDati);
        const valore = async f => { try { const v = await f(); return typeof v === 'number' && v > 0 ? v : null; } catch (e) { return null; } };   // mancante = null, mai inventato
        const [kg, watt] = await Promise.all([valore(pesoKg), valore(ftp)]);
        const obiettivi = obiettiviGiorno({ data, giorno, attivita: att, sessioni: sessioni(), pesoKg: kg, ftp: watt, oreMovimentoObiettivo: prof.obiettivi.oreMovimento });
        json(res, 200, { generato: adesso().toISOString(), data, nome: prof.nome,
            giorno: giorno ? { nome: giorno.nome, dur: giorno.dur, zona: giorno.zona, riposo: !!giorno.riposo, haSeduta: !!giorno.seduta } : null, obiettivi, avvisi });
    }

    async function profiloRotta(req, res) {
        if (req.method === 'GET') return json(res, 200, profilo.leggi(cartellaDati));
        const c = await leggiCorpo(req, MAX_JSON);
        if (c.troppo) return json(res, 413, { error: 'richiesta troppo grande' });
        let patch;
        try { patch = JSON.parse(c.dati.toString('utf8')); } catch (e) { return json(res, 400, { error: 'JSON non valido' }); }
        try { json(res, 200, profilo.aggiorna(cartellaDati, patch)); } catch (e) { json(res, 400, { error: e.message }); }
    }

    async function fotoRotta(req, res) {
        if (req.method === 'GET') {
            const f = profilo.leggiFoto(cartellaDati);
            if (!f) return json(res, 404, { error: 'nessuna foto' });
            res.writeHead(200, { 'Content-Type': f.tipo, 'Content-Length': f.dati.length, 'Cache-Control': 'no-store' });
            return res.end(f.dati);
        }
        const c = await leggiCorpo(req, MAX_FOTO);
        if (c.troppo) return json(res, 413, { error: 'la foto può pesare al massimo 1,5 MB' });
        try { json(res, 200, { foto: profilo.salvaFoto(cartellaDati, c.dati, String(req.headers['content-type'] || '').split(';')[0]).foto }); }
        catch (e) { json(res, 400, { error: e.message }); }
    }

    /** true se la richiesta era per /api/fit/* (e l'ha servita). */
    async function servi(req, res) {
        const u = new URL(req.url, 'http://x'), p = u.pathname;
        if (req.method === 'GET' && p === '/api/fit/peso') { await peso(req, res, u); return true; }
        if (req.method === 'GET' && p === '/api/fit/oggi') { await giornata(req, res); return true; }
        if ((req.method === 'GET' || req.method === 'PUT') && p === '/api/fit/profilo') { await profiloRotta(req, res); return true; }
        if ((req.method === 'GET' || req.method === 'PUT') && p === '/api/fit/foto') { await fotoRotta(req, res); return true; }
        return false;
    }

    return { servi };
}

module.exports = { creaFitApi };

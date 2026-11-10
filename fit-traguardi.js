// MirabiWatt · Achievements e Record personali dell'app Fit (10/11/2026). Pura, calcolata solo su dati veri.
// Le soglie sono di default (in linea col profilo di Tiziano: FTP 305 W, picco 5 s sui 900 W, palestra in ri-adattamento) e si possono
// cambiare dal profilo: {id: soglia}. Un dato mancante da' percentuale null e «non raggiunto»: mai un traguardo regalato.
const BICI = /ride/i;

const DEFINIZIONI = [
    { id: 'serie-7', categoria: 'Costanza', nome: '7 giorni di fila', descr: '7 giorni di allenamento consecutivi (un giorno di riposo in mezzo è ammesso)', metrica: 'serieRecord', soglia: 7, unita: 'giorni' },
    { id: 'serie-14', categoria: 'Costanza', nome: '14 giorni di fila', descr: '14 giorni di allenamento consecutivi', metrica: 'serieRecord', soglia: 14, unita: 'giorni' },
    { id: 'serie-30', categoria: 'Costanza', nome: '30 giorni di fila', descr: '30 giorni di allenamento consecutivi', metrica: 'serieRecord', soglia: 30, unita: 'giorni' },
    { id: 'sedute-10', categoria: 'Palestra', nome: '10 sedute', descr: 'Completa 10 sedute di palestra', metrica: 'sedutePalestra', soglia: 10, unita: 'sedute' },
    { id: 'sedute-25', categoria: 'Palestra', nome: '25 sedute', descr: 'Completa 25 sedute di palestra', metrica: 'sedutePalestra', soglia: 25, unita: 'sedute' },
    { id: 'sedute-50', categoria: 'Palestra', nome: '50 sedute', descr: 'Completa 50 sedute di palestra', metrica: 'sedutePalestra', soglia: 50, unita: 'sedute' },
    { id: 'mille-chili', categoria: 'Palestra', nome: 'Mille chili', descr: 'Solleva 1.000 kg in una sola seduta', metrica: 'volumeMaxSeduta', soglia: 1000, unita: 'kg' },
    { id: 'panca-80', categoria: 'Palestra', nome: 'Panca a 80 kg', descr: 'Panca piana con manubri: 80 kg in totale (somma dei due manubri)', metrica: 'pancaTotale', soglia: 80, unita: 'kg' },
    { id: 'uscite-10', categoria: 'Bici', nome: '10 uscite', descr: 'Completa 10 uscite in bici', metrica: 'usciteBici', soglia: 10, unita: 'uscite' },
    { id: 'lunga-3h', categoria: 'Bici', nome: 'Uscita da 3 ore', descr: 'Un\'uscita in bici da almeno 3 ore', metrica: 'biciMaxMinuti', soglia: 180, unita: 'min' },
    { id: 'ftp-320', categoria: 'Potenza', nome: 'FTP 320 W', descr: 'Raggiungi 320 W di FTP', metrica: 'ftp', soglia: 320, unita: 'W' },
    { id: 'ftp-330', categoria: 'Potenza', nome: 'FTP 330 W', descr: 'Raggiungi 330 W di FTP', metrica: 'ftp', soglia: 330, unita: 'W' },
    { id: 'p5s-1000', categoria: 'Potenza', nome: 'Sprint da 1.000 W', descr: 'Raggiungi 1.000 W di picco su 5 secondi', metrica: 'p5s', soglia: 1000, unita: 'W' },
];

const sommaVolume = s => (s.esercizi || []).reduce((t, e) => t + (e.unita === 's' ? 0 : (e.serie || []).filter(x => x.fatta).reduce((u, x) => u + (x.kg || 0) * (x.reps || 0), 0)), 0);
const haSerieFatte = s => (s.esercizi || []).some(e => (e.serie || []).some(x => x.fatta));
const wattA = (curva, secondi) => {
    if (!curva || !Array.isArray(curva.secs) || !Array.isArray(curva.watts)) return null;
    const i = curva.secs.indexOf(secondi);
    return i >= 0 && typeof curva.watts[i] === 'number' ? Math.round(curva.watts[i]) : null;
};

/** Le metriche su cui si misurano achievements e record, dai dati veri. */
function valori({ sessioni = [], attivita = [], serieRecord = 0, ftp = null, curva = null }) {
    const fatte = sessioni.filter(haSerieFatte);
    const bici = attivita.filter(a => BICI.test(String(a.type || '')) && a.durationMin >= 15);
    const kgPanca = fatte.flatMap(s => (s.esercizi || []).filter(e => e.id === 'panca-piana-manubri').flatMap(e => (e.serie || []).filter(x => x.fatta && typeof x.kg === 'number').map(x => x.kg)));
    return {
        sedutePalestra: fatte.length,
        volumeMaxSeduta: fatte.reduce((m, s) => Math.max(m, Math.round(sommaVolume(s))), 0),
        pancaTotale: kgPanca.length ? Math.max(...kgPanca) * 2 : null,
        usciteBici: bici.length,
        biciMaxMinuti: bici.reduce((m, a) => Math.max(m, Math.round(a.durationMin)), 0),
        biciMaxKm: bici.reduce((m, a) => Math.max(m, typeof a.distanceKm === 'number' ? a.distanceKm : 0), 0),
        serieRecord,
        ftp: typeof ftp === 'number' ? ftp : null,
        p5s: wattA(curva, 5), p1m: wattA(curva, 60), p5m: wattA(curva, 300), p20m: wattA(curva, 1200),
    };
}

/** Achievements con avanzamento. soglie = { id: soglia } dal profilo. */
function achievements(v, soglie = {}) {
    return DEFINIZIONI.map(d => {
        const soglia = soglie[d.id] > 0 ? soglie[d.id] : d.soglia, valore = typeof v[d.metrica] === 'number' ? v[d.metrica] : null;
        return { id: d.id, categoria: d.categoria, nome: d.nome, descr: d.descr, unita: d.unita, soglia, valore,
            percento: valore == null ? null : Math.min(100, Math.round(valore / soglia * 100)), raggiunto: valore != null && valore >= soglia };
    });
}

/** Record personali: solo le voci che hanno un dato vero. */
function record(v) {
    const voci = [
        { id: 'p5s', etichetta: 'Potenza 5 s', valore: v.p5s, unita: 'W' }, { id: 'p1m', etichetta: 'Potenza 1 min', valore: v.p1m, unita: 'W' },
        { id: 'p5m', etichetta: 'Potenza 5 min', valore: v.p5m, unita: 'W' }, { id: 'p20m', etichetta: 'Potenza 20 min', valore: v.p20m, unita: 'W' },
        { id: 'biciPiuLunga', etichetta: 'Uscita più lunga', valore: v.biciMaxMinuti, unita: 'min' },
        { id: 'volumeMaxSeduta', etichetta: 'Seduta più pesante', valore: v.volumeMaxSeduta, unita: 'kg' },
        { id: 'pancaTotale', etichetta: 'Panca piana con manubri', valore: v.pancaTotale, unita: 'kg' },
        { id: 'serieRecord', etichetta: 'Serie di allenamento più lunga', valore: v.serieRecord, unita: 'giorni' },
    ];
    return voci.filter(r => typeof r.valore === 'number' && r.valore > 0);
}

module.exports = { DEFINIZIONI, valori, achievements, record };

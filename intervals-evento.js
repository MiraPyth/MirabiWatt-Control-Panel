// MirabiWatt · l'evento intervals.icu di una seduta del piano (19/10/2026). Sigla corta «[MW]»: «[MirabiWatt]»
// allungava i nomi fino a renderli illeggibili. Le sedute di palestra vanno come WeightTraining con la durata.
const { baseName } = require('./workout-library.js');

const SIGLA = '[MW]';
// toglie la sigla dai nomi, anche da quelli inviati prima del 19/10 con «[MirabiWatt]»
const TOGLI_SIGLA = /^\[(MirabiWatt|MW)\]\s*/;

function eventoAllenamento(day, dateISO, detail) {
    const palestra = day.zone === 'Palestra' || !!detail.palestra;
    const evento = {
        category: 'WORKOUT',
        type: palestra ? 'WeightTraining' : (day.icuType || 'Ride'),  // 25/10/2026: MTB e uscite a piedi hanno il loro tipo
        start_date_local: `${dateISO}T00:00:00`,
        name: `${SIGLA} ${palestra ? baseName(day.s) : day.s}`,
        uid: `mirabiwatt-${dateISO}`,
        indoor: palestra || /rulli|zwift/i.test(day.note || '') || /rulli|zwift/i.test(day.s || '')
    };
    if (palestra && detail.totalMin) evento.moving_time = detail.totalMin * 60;
    if (detail.icuText) {
        evento.description = detail.icuText;
    } else if (detail.plainDescription) {
        evento.description = detail.plainDescription + (day.note ? `\n\n${day.note}` : '');
    } else if (day.note) {
        evento.description = day.note;
    }
    return evento;
}

module.exports = { SIGLA, TOGLI_SIGLA, eventoAllenamento };

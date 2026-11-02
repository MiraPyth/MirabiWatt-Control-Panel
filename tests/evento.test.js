// «Settimana evento» (19/10/2026 sera): le gare sono eventi facoltativi. Se l'utente decide di partecipare, da
// Ripianifica sceglie «Evento» per quella settimana: mini-taper (volume −40/−50%, una palestra leggera di parte alta,
// openers il giorno prima, l'evento nel suo giorno). Dopo l'evento il piano riprende.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const SP = require('../season-plan.js');
const { getWorkoutDetail } = require('../workout-library.js');
const MIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'piani', 'mixed-body-building.json'), 'utf8'));
const min = s => { if (!s) return 0; const h = s.match(/^(\d+)h(\d+)?/); return h ? +h[1] * 60 + (+h[2] || 0) : parseInt(s, 10) || 0; };

test('settimana del Tratturo Magno: evento la domenica, openers il sabato, volume circa dimezzato', () => {
  const prima = JSON.parse(JSON.stringify(SP.SEASON));
  try {
    SP.usaPiano(MIX);
    const ws = '2027-03-08', w = SP.findDetailedWeek(ws).week;
    const ev = SP.applyPlanB(w.days, 'evento', ws);
    assert.strictEqual(ev.length, 7);
    const dom = ev[6], sab = ev[5];
    assert.match(dom.s, /Tratturo Magno/);
    assert.ok(dom.critical && dom.evento);
    assert.strictEqual(sab.s, 'Openers');
    assert.ok(getWorkoutDetail('Openers', 300, 280).icuText, 'openers strutturati per intervals.icu');
    const palestre = ev.filter(d => d.zone === 'Palestra');
    assert.strictEqual(palestre.length, 1, 'una sola palestra');
    assert.match(palestre[0].s, /^Petto-Spalle \(scarico\)/);
    const prova = d => d.evento ? 0 : min(d.dur);
    const vol = days => days.reduce((t, d) => t + prova(d), 0);
    assert.ok(vol(ev) <= vol(w.days) * 0.6, `volume ${vol(ev)} su ${vol(w.days)}`);
  } finally { SP.usaPiano(prima); }
});

test('settimana senza eventi: nessuna gara inventata, solo lo scarico', () => {
  const prima = JSON.parse(JSON.stringify(SP.SEASON));
  try {
    SP.usaPiano(MIX);
    const ws = '2027-02-01', w = SP.findDetailedWeek(ws).week;
    const ev = SP.applyPlanB(w.days, 'evento', ws);
    assert.ok(!ev.some(d => d.evento));
    assert.ok(!ev.some(d => d.s === 'Openers'));
  } finally { SP.usaPiano(prima); }
});

test('Ripianifica ha il pulsante Evento accanto a Piena / Ridotta / Recupero', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  assert.match(html, /id="btn-evento"/);
  assert.match(html, /setPlanLevel\('evento'\)/);
});

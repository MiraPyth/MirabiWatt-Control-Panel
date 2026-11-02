// Condivisione su Strava delle sedute di palestra (19/10/2026 notte), come faceva JEFIT: al salvataggio un'attività
// «Allenamento con i pesi» con orario e durata veri e la descrizione esercizio per esercizio. Niente rete qui.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../strava.js');

const SESSIONE = {
  id: '2026-10-26T16:30:00.000Z', data: '2026-10-26', seduta: 'Petto-Spalle', schema: 'adattamento 1',
  inizio: '2026-10-26T16:30:00.000Z', fine: '2026-10-26T17:42:00.000Z', note: 'spalla dx un po\' rigida',
  esercizi: [
    { id: 'spinte-inclinata-manubri', nome: 'Spinte su panca inclinata 30° con manubri', serie: [{ kg: 14, reps: 10, fatta: true }, { kg: 14, reps: 9, fatta: true }] },
    { id: 'alzate-laterali-manubri', nome: 'Alzate laterali con manubri', serie: [{ kg: 6, reps: 15, fatta: true }, { kg: 6, reps: 12, fatta: false }] },
    { id: 'crunch-cavi', nome: 'Crunch ai cavi', serie: [{ kg: 20, reps: 12, fatta: false }] },
    { id: 'hanging-knee-raise', nome: 'Hanging leg raise', serie: [{ kg: null, reps: 12, fatta: true }] }
  ]
};

test('attività Strava: allenamento con i pesi, ora locale italiana e durata vera', () => {
  const a = S.attivitaDaSessione(SESSIONE);
  assert.strictEqual(a.sport_type, 'WeightTraining');
  assert.strictEqual(a.type, 'WeightTraining');
  assert.strictEqual(a.name, '🏋️ Petto-Spalle · adattamento 1');
  assert.strictEqual(a.start_date_local, '2026-10-26T17:30:00', 'ora di Roma (dal 25/10 è ora solare, UTC+1)');
  assert.strictEqual(a.elapsed_time, 72 * 60);
  assert.strictEqual(S.attivitaDaSessione({ ...SESSIONE, inizio: '2026-07-01T16:00:00.000Z', fine: '2026-07-01T17:00:00.000Z' }).start_date_local, '2026-07-01T18:00:00', 'ora legale UTC+2');
});

test('descrizione in stile JEFIT: solo le serie fatte, esercizio per esercizio, totali e note', () => {
  const d = S.attivitaDaSessione(SESSIONE).description;
  assert.match(d, /Spinte su panca inclinata 30° con manubri: 14 kg × 10 · 9/);
  assert.match(d, /Alzate laterali con manubri: 6 kg × 15/);
  assert.ok(!/Crunch/.test(d), 'esercizio senza serie fatte: non compare');
  assert.match(d, /Hanging leg raise: 12$/m, 'corpo libero: solo le ripetizioni');
  assert.match(d, /4 serie/);
  assert.match(d, /72′/);
  assert.match(d, /Note: spalla dx un po' rigida/);
  assert.match(d, /MirabiWatt/);
});

test('descrizione: riga dei muscoli lavorati, in ordine di serie', () => {
  const d = S.attivitaDaSessione(SESSIONE).description;
  assert.match(d, /^Muscoli: petto 2 · spalle 2 · tricipiti 1 · addome 1$/m, 'pari merito: ordine anatomico; sotto 1 serie non compare');
});

test('carichi diversi nella stessa serie di un esercizio: kg per serie', () => {
  const s = { ...SESSIONE, esercizi: [{ id: 'x', nome: 'Panca', serie: [{ kg: 14, reps: 10, fatta: true }, { kg: 16, reps: 8, fatta: true }] }] };
  assert.match(S.attivitaDaSessione(s).description, /Panca: 14 kg × 10 · 16 kg × 8/);
});

test('autorizzazione: indirizzo Strava con permesso di scrittura e ritorno sul nostro dominio', () => {
  const u = new URL(S.urlAutorizza('12345'));
  assert.strictEqual(u.origin + u.pathname, 'https://www.strava.com/oauth/authorize');
  assert.strictEqual(u.searchParams.get('client_id'), '12345');
  assert.strictEqual(u.searchParams.get('redirect_uri'), 'http://mira-optiplex.tail2a9ecd.ts.net:3000/strava/callback');
  assert.match(u.searchParams.get('scope'), /activity:write/);
  assert.strictEqual(u.searchParams.get('response_type'), 'code');
});

test('token: da rinnovare un minuto prima della scadenza', () => {
  assert.strictEqual(S.daRinnovare({ expires_at: 1000 }, 900), false);
  assert.strictEqual(S.daRinnovare({ expires_at: 1000 }, 950), true);
  assert.strictEqual(S.daRinnovare(null, 0), true);
});

// 02/11/2026: «Strava non ha accettato la seduta (Strava 409: error)». Il 409 sulla creazione manuale = c'e' gia'
// un'attivita' nello stesso orario (di solito l'orologio che ha registrato la palestra): riprovare non serve.
test('409: attivita sovrapposta, spiegata e senza riprovare', () => {
  const e = S.esitoErrore(new Error('Strava 409: error'));
  assert.strictEqual(e.ok, false);
  assert.strictEqual(e.sovrapposta, true);
  assert.match(e.error, /già.*stesso orario/i);
});
test('altri errori: messaggio originale', () => {
  assert.deepStrictEqual(S.esitoErrore(new Error('Strava 401: Authorization Error')), { ok: false, error: 'Strava 401: Authorization Error' });
});

// 19/10/2026 sera: la mappa dei muscoli lavorati in una seduta (davanti + dietro, a calore), come le immagini delle
// app partner di Strava ma in stile MirabiWatt. Serie fatte = 1 serie piena sul muscolo principale, ½ sui secondari.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../mappa-muscoli.js');

const SESSIONE = {
  id: '2026-10-26T16:30:00.000Z', data: '2026-10-26', seduta: 'Petto-Spalle', schema: 'adattamento 1',
  inizio: '2026-10-26T16:30:00.000Z', fine: '2026-10-26T17:42:00.000Z',
  esercizi: [
    { id: 'panca-piana-manubri', nome: 'Panca piana con manubri', serie: [{ kg: 14, reps: 10, fatta: true }, { kg: 14, reps: 9, fatta: true }, { kg: 14, reps: 8, fatta: false }] },
    { id: 'alzate-laterali-manubri', nome: 'Alzate laterali', serie: [{ kg: 6, reps: 15, fatta: true }] },
    { id: 'curl-cavi', nome: 'Curl ai cavi', serie: [{ kg: 10, reps: 12, fatta: false }] }
  ]
};

test('carico per muscolo: solo le serie fatte, ½ serie ai muscoli secondari', () => {
  const c = M.carico(SESSIONE);
  assert.strictEqual(c.petto, 2);
  assert.strictEqual(c.tricipiti, 1, 'panca: tricipiti secondari, 2 × ½');
  assert.strictEqual(c.spalle, 2, 'alzate 1 + panca 2 × ½');
  assert.ok(!c.bicipiti, 'curl senza serie fatte: bicipiti a zero');
});

test('esercizio sconosciuto: muscolo ricavato dal gruppo della scheda', () => {
  const c = M.carico({ ...SESSIONE, esercizi: [{ id: 'nuovo', gruppo: 'femorali e glutei', serie: [{ kg: 20, reps: 10, fatta: true }] }] });
  assert.strictEqual(c.femorali, 1);
});

test('classifica: muscoli in ordine di serie, con il nome da mostrare', () => {
  const cl = M.classifica(M.carico(SESSIONE));
  assert.deepStrictEqual(cl.map(x => x.id).slice(0, 2).sort(), ['petto', 'spalle']);
  assert.strictEqual(cl[2].id, 'tricipiti');
  assert.strictEqual(cl[3].id, 'trapezio', 'anche i secondari minori, in fondo');
  assert.ok(cl.every(x => x.nome && x.serie > 0));
});

test('immagine: figura davanti e dietro, muscoli lavorati colorati a calore e gli altri spenti', () => {
  const svg = M.svg(SESSIONE);
  assert.match(svg, /^<svg[^>]+viewBox="0 0 1080 1080"/);
  assert.match(svg, /data-vista="davanti"/);
  assert.match(svg, /data-vista="dietro"/);
  const colore = id => (svg.match(new RegExp(`data-muscolo="${id}"[^>]*fill="([^"]+)"`)) || [])[1];
  assert.notStrictEqual(colore('petto'), M.SPENTO, 'petto lavorato');
  assert.strictEqual(colore('bicipiti'), M.SPENTO, 'bicipiti spenti');
  assert.strictEqual(colore('femorali'), M.SPENTO);
});

test('immagine: titolo, scheda, durata, serie e kg della seduta', () => {
  const svg = M.svg(SESSIONE);
  assert.match(svg, />Petto-Spalle</);
  assert.match(svg, /adattamento 1/);
  assert.match(svg, />72′</);
  assert.match(svg, />3</, 'serie fatte');
  assert.match(svg, />356</, 'kg sollevati: 14×10 + 14×9 + 6×15');
  assert.match(svg, /MirabiWatt/);
});

test('immagine: il testo della seduta è sempre escapato', () => {
  const svg = M.svg({ ...SESSIONE, seduta: '<script>x</script>' });
  assert.ok(!svg.includes('<script>'));
  assert.match(svg, /&lt;script&gt;/);
});

// 10/11/2026: profilo dell'app Fit salvato sul server MirabiWatt (nome, foto, unita', obiettivi, notifiche). File finti in una cartella temporanea.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../fit-profilo.js');

const cartella = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-profilo-'));

test('senza file: profilo di default, senza nome ne foto', () => {
  const p = P.leggi(cartella());
  assert.strictEqual(p.nome, '');
  assert.strictEqual(p.foto, null);
  assert.deepStrictEqual(p.unita, { peso: 'kg', distanza: 'km' });
  assert.strictEqual(p.obiettivi.oreMovimento, null, 'nessun obiettivo inventato');
  assert.deepStrictEqual(p.obiettivi.achievements, {});
  assert.strictEqual(p.notifiche.allenamentiDaFare, true);
});

test('aggiorna: solo i campi indicati cambiano, il resto resta', () => {
  const d = cartella();
  P.aggiorna(d, { nome: '  Tiziano ' });
  const p = P.aggiorna(d, { unita: { peso: 'lb' }, obiettivi: { oreMovimento: 1.5 } });
  assert.strictEqual(p.nome, 'Tiziano', 'spazi tolti');
  assert.deepStrictEqual(p.unita, { peso: 'lb', distanza: 'km' });
  assert.strictEqual(p.obiettivi.oreMovimento, 1.5);
  assert.deepStrictEqual(P.leggi(d), p, 'persistito su file');
});

test('validazione: valori fuori regola rifiutati con un messaggio chiaro', () => {
  const d = cartella();
  const rifiuta = (patch, re) => assert.throws(() => P.aggiorna(d, patch), re);
  rifiuta({ nome: 'x'.repeat(41) }, /nome/);
  rifiuta({ unita: { peso: 'stone' } }, /unit/);
  rifiuta({ obiettivi: { oreMovimento: 25 } }, /ore di movimento/);
  rifiuta({ obiettivi: { oreMovimento: -1 } }, /ore di movimento/);
  rifiuta({ obiettivi: { achievements: { 'ftp-320': 0 } } }, /soglia/);
  rifiuta({ notifiche: { orario: '25:61' } }, /orario/);
  rifiuta({ notifiche: { allenamentiDaFare: 'si' } }, /notifiche/);
  rifiuta({ qualcosaDiStrano: 1 }, /campo non ammesso/);
});

test('soglie degli achievements: si possono impostare e togliere (null)', () => {
  const d = cartella();
  P.aggiorna(d, { obiettivi: { achievements: { 'ftp-320': 315, 'sedute-10': 8 } } });
  const p = P.aggiorna(d, { obiettivi: { achievements: { 'sedute-10': null } } });
  assert.deepStrictEqual(p.obiettivi.achievements, { 'ftp-320': 315 });
});

test('obiettivo di movimento: si puo togliere con null', () => {
  const d = cartella();
  P.aggiorna(d, { obiettivi: { oreMovimento: 2 } });
  assert.strictEqual(P.aggiorna(d, { obiettivi: { oreMovimento: null } }).obiettivi.oreMovimento, null);
});

test('file danneggiato: si riparte dal default, non si rompe', () => {
  const d = cartella();
  fs.writeFileSync(path.join(d, 'fit-profilo.json'), '{non json');
  assert.strictEqual(P.leggi(d).nome, '');
});

test('foto: solo JPEG o PNG fino a 1,5 MB, salvata come file, il profilo ne ricorda il nome', () => {
  const d = cartella();
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
  const p = P.salvaFoto(d, jpeg, 'image/jpeg');
  assert.match(p.foto, /^foto-[0-9a-f]{8}\.jpg$/);
  assert.ok(fs.existsSync(path.join(d, p.foto)));
  assert.deepStrictEqual(P.leggiFoto(d), { tipo: 'image/jpeg', dati: jpeg });
  assert.throws(() => P.salvaFoto(d, Buffer.alloc(10), 'image/gif'), /JPEG o PNG/);
  assert.throws(() => P.salvaFoto(d, Buffer.alloc(1.6 * 1024 * 1024), 'image/png'), /1,5 MB/);
  assert.throws(() => P.salvaFoto(d, Buffer.from('non e un jpeg'), 'image/jpeg'), /non valida/);
});

test('nuova foto: la vecchia si cancella (niente file orfani)', () => {
  const d = cartella();
  const jpeg = n => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50, n)]);
  const a = P.salvaFoto(d, jpeg(1), 'image/jpeg').foto, b = P.salvaFoto(d, jpeg(2), 'image/jpeg').foto;
  assert.notStrictEqual(a, b);
  assert.ok(!fs.existsSync(path.join(d, a)));
  assert.ok(fs.existsSync(path.join(d, b)));
});

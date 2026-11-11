// 11/11/2026: allenamento configurato a passi nell'app -> testo nativo di intervals.icu (che Garmin sincronizza). Puro.
const test = require('node:test');
const assert = require('node:assert');
const { testoDaPassi, durataTotaleSec, durataIcu, validaPassi } = require('../fit-passi.js');
const { eventoNuovo } = require('../fit-pianifica.js');

// l'esempio dell'utente: 1) riscaldamento 10 minuti in Z1; 2) 3 volte in Z5 per 10 secondi con 30 secondi di recupero in Z1
const ESEMPIO = [
  { tipo: 'passo', ruolo: 'riscaldamento', durataSec: 600, zona: 1 },
  { tipo: 'ripetute', ripetizioni: 3, lavoro: { durataSec: 10, zona: 5 }, recupero: { durataSec: 30, zona: 1 } },
];

test('durate nel formato di intervals.icu', () => {
  assert.strictEqual(durataIcu(10), '10s');
  assert.strictEqual(durataIcu(90), '1m30s');
  assert.strictEqual(durataIcu(600), '10m');
  assert.strictEqual(durataIcu(3600), '1h');
  assert.strictEqual(durataIcu(3750), '1h2m30s');
});

test('l esempio dell utente diventa riscaldamento + ripetute, senza ripetizioni annidate', () => {
  assert.strictEqual(testoDaPassi(ESEMPIO, 'ciclismo'), 'Warmup\n- 10m Z1\n\nMain Set\n3x\n- 10s Z5\n- 30s Z1');
  assert.strictEqual(durataTotaleSec(ESEMPIO), 600 + 3 * 40);
});

test('corsa e nuoto usano le zone di passo', () => {
  assert.strictEqual(testoDaPassi(ESEMPIO.map(p => (p.tipo === 'passo' ? p : { ...p, lavoro: { ...p.lavoro, zona: 4 } })), 'corsa'), 'Warmup\n- 10m Z1 Pace\n\nMain Set\n3x\n- 10s Z4 Pace\n- 30s Z1 Pace');
});

test('riscaldamento, lavoro e defaticamento ognuno sotto la sua intestazione; passi di lavoro separati da riga vuota', () => {
  const passi = [
    { tipo: 'passo', ruolo: 'riscaldamento', durataSec: 900, zona: 2 },
    { tipo: 'passo', ruolo: 'lavoro', durataSec: 1200, zona: 4 },
    { tipo: 'passo', ruolo: 'lavoro', durataSec: 300, zona: 1 },
    { tipo: 'ripetute', ripetizioni: 4, lavoro: { durataSec: 240, zona: 5 }, recupero: { durataSec: 120, zona: 1 } },
    { tipo: 'passo', ruolo: 'defaticamento', durataSec: 600, zona: 1 },
  ];
  assert.strictEqual(testoDaPassi(passi, 'ciclismo'),
    'Warmup\n- 15m Z2\n\nMain Set\n- 20m Z4\n\n- 5m Z1\n\n4x\n- 4m Z5\n- 2m Z1\n\nCooldown\n- 10m Z1');
});

test('validazione: vuoto, ordine dei ruoli, durate, zone, ripetizioni, troppi passi e allenamento troppo lungo', () => {
  const ok = [{ tipo: 'passo', ruolo: 'lavoro', durataSec: 600, zona: 2 }];
  assert.strictEqual(validaPassi(ok, 'ciclismo'), null);
  assert.match(validaPassi([], 'ciclismo'), /almeno un passo/i);
  assert.match(validaPassi('x', 'ciclismo'), /passi/i);
  assert.match(validaPassi([{ tipo: 'passo', ruolo: 'lavoro', durataSec: 600, zona: 2 }, { tipo: 'passo', ruolo: 'riscaldamento', durataSec: 300, zona: 1 }], 'ciclismo'), /riscaldamento/i);
  assert.match(validaPassi([{ tipo: 'passo', ruolo: 'defaticamento', durataSec: 300, zona: 1 }, { tipo: 'passo', ruolo: 'lavoro', durataSec: 600, zona: 2 }], 'ciclismo'), /defaticamento/i);
  assert.match(validaPassi([{ tipo: 'passo', ruolo: 'lavoro', durataSec: 4, zona: 2 }], 'ciclismo'), /durata/i);
  assert.match(validaPassi([{ tipo: 'passo', ruolo: 'lavoro', durataSec: 600, zona: 8 }], 'ciclismo'), /zona/i);
  assert.match(validaPassi([{ tipo: 'passo', ruolo: 'lavoro', durataSec: 600, zona: 6 }], 'corsa'), /zona/i);
  assert.match(validaPassi([{ tipo: 'ripetute', ripetizioni: 1, lavoro: { durataSec: 10, zona: 5 }, recupero: { durataSec: 30, zona: 1 } }], 'ciclismo'), /ripetizioni/i);
  assert.match(validaPassi([{ tipo: 'ripetute', ripetizioni: 51, lavoro: { durataSec: 10, zona: 5 }, recupero: { durataSec: 30, zona: 1 } }], 'ciclismo'), /ripetizioni/i);
  assert.match(validaPassi([{ tipo: 'boh' }], 'ciclismo'), /passo non valido/i);
  assert.match(validaPassi(Array.from({ length: 41 }, () => ok[0]), 'ciclismo'), /troppi passi/i);
  assert.match(validaPassi([{ tipo: 'passo', ruolo: 'lavoro', durataSec: 8 * 3600, zona: 2 }, { tipo: 'passo', ruolo: 'lavoro', durataSec: 60, zona: 2 }], 'ciclismo'), /troppo lungo/i);
  assert.match(validaPassi(ok, 'palestra'), /sport/i);
});

test('evento personalizzato: nome con sigla, tipo, testo nativo, durata totale e id esterno', () => {
  const base = { libreria: {}, sedutePalestra: [], schemaPalestra: null, getDetail: () => ({}), pianoPalestra: () => null, ftp: 305, cp: 292 };
  const e = eventoNuovo({ ...base, data: '2026-11-25', sport: 'ciclismo', personalizzato: { nome: 'Sprint 10 secondi', passi: ESEMPIO }, casuale: () => 'zz11' });
  assert.strictEqual(e.category, 'WORKOUT');
  assert.strictEqual(e.type, 'Ride');
  assert.strictEqual(e.name, '[MW] Sprint 10 secondi');
  assert.strictEqual(e.moving_time, 720);
  assert.strictEqual(e.description, 'Warmup\n- 10m Z1\n\nMain Set\n3x\n- 10s Z5\n- 30s Z1');
  assert.ok(e.external_id.endsWith('zz11'));
  assert.throws(() => eventoNuovo({ ...base, data: '2026-11-25', sport: 'ciclismo', personalizzato: { nome: '', passi: ESEMPIO } }), /nome/i);
  assert.throws(() => eventoNuovo({ ...base, data: '2026-11-25', sport: 'ciclismo', personalizzato: { nome: 'x', passi: [] } }), /almeno un passo/i);
  const c = eventoNuovo({ ...base, data: '2026-11-25', sport: 'nuoto', personalizzato: { nome: 'Nuoto a passi', passi: [{ tipo: 'passo', ruolo: 'lavoro', durataSec: 1200, zona: 2 }] }, casuale: () => 'q' });
  assert.strictEqual(c.type, 'Swim');
  assert.strictEqual(c.description, 'Main Set\n- 20m Z2 Pace');
});

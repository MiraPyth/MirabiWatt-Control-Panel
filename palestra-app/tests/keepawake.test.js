// Lo schermo non deve spegnersi durante la seduta (recupero compreso): flag nativo sulla finestra.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('MainActivity tiene lo schermo acceso (FLAG_KEEP_SCREEN_ON)', () => {
  const f = path.join(__dirname, '..', 'android/app/src/main/java/it/mirabiwatt/palestra/MainActivity.java');
  const src = fs.readFileSync(f, 'utf8');
  assert.match(src, /FLAG_KEEP_SCREEN_ON/);
  assert.match(src, /addFlags/);
});

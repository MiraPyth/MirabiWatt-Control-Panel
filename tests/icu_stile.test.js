// 31/10/2026, l'utente: «far assomigliare il più possibile MirabiWatt a intervals.icu (assomigliare è diverso da UGUALE)…
// alcune pagine (Oggi) non si allargano per la grandezza dello schermo: non sono responsive».
// Causa del secondo punto: calendario.css fermava ogni vista tranne il Calendario a 72rem (1152px).
// Lo stile nuovo sta in icu.css, caricato dopo i fogli delle viste e prima di quelli per il telefono.
// jsdom non misura il layout: si controllano le regole CSS che lo decidono.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const http = require('http');
const DIR = path.join(__dirname, '..');
const leggi = f => fs.readFileSync(path.join(DIR, f), 'utf8');
function regola(testo, selettore) {
  const re = new RegExp(`(^|[}\\s,])${selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g');
  let m, tutto = '';
  while ((m = re.exec(testo))) tutto += m[2] + ';';
  return tutto;
}

test('icu.css caricato dopo le viste e prima dei fogli per il telefono', () => {
  const html = leggi('dashboard.html');
  const i = n => html.indexOf(`href="${n}"`);
  assert.ok(i('icu.css') > 0, 'icu.css collegato');
  for (const prima of ['mira-tema.css', 'calendario.css', 'analisi.css', 'palestra.css', 'bibbia.css']) assert.ok(i(prima) < i('icu.css'), prima);
  for (const dopo of ['mobile.css', 'mobile-home.css']) assert.ok(i(dopo) > i('icu.css'), dopo);
});

test('nessuna vista ferma a 72rem: Oggi e le altre si allargano con lo schermo', () => {
  for (const f of ['calendario.css', 'analisi.css', 'icu.css']) assert.doesNotMatch(leggi(f), /\.dash-view[^{]*\{[^}]*max-width:\s*72rem/, f);
});

test('Oggi su schermo largo: griglia a 12 colonne, l\'allenamento accanto alla forma, tre schede in fila sotto', () => {
  const c = leggi('icu.css');
  assert.match(regola(c, '.mw-oggi-griglia'), /grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(regola(c, '#oggi-allenamento'), /grid-column:\s*span 7/);
  assert.match(regola(c, '#oggi-forma'), /grid-column:\s*span 5/);
  assert.match(regola(c, '#oggi-settimana'), /grid-column:\s*1\s*\/\s*-1/);
  for (const id of ['#oggi-obiettivo', '#oggi-nutrizione', '#oggi-ultima']) assert.match(regola(c, id), /grid-column:\s*span 4/, id);
  // sotto i 1100px una colonna (prima a 900 le due colonne stringevano troppo la sessione)
  assert.match(c, /@media \(max-width: 1100px\)\s*\{[^@]*\.mw-oggi-griglia > \*\s*\{\s*grid-column:\s*1\s*\/\s*-1/);
});

test('palette di intervals.icu: chiaro #f4f4fa con blu #1976d2, scuro come la Dark Mode', () => {
  const c = leggi('icu.css');
  const chiaro = regola(c, 'html[data-tema="chiaro"]');
  assert.match(chiaro, /--bg:\s*#f4f4fa/);
  assert.match(chiaro, /--accent:\s*#1976d2/);
  assert.match(chiaro, /--fit:\s*#34ace4/);
  assert.match(chiaro, /--fat:\s*#6633cc/);
  const scuro = regola(c, ':root');
  assert.match(scuro, /--bg:\s*#141018/);
  assert.match(scuro, /--card:\s*#242030/);
  assert.match(scuro, /--accent:\s*#64b5f6/);
});

test('Roboto servita dal server (niente Google Fonts), il server conosce i .woff2', async () => {
  const c = leggi('icu.css');
  assert.match(c, /@font-face\s*\{[^}]*font-family:\s*Roboto[^}]*url\(fonts\/roboto-500\.woff2\)/);
  for (const p of ['300', '400', '500', '700']) assert.ok(fs.existsSync(path.join(DIR, 'fonts', `roboto-${p}.woff2`)), p);
  assert.match(leggi('server.js'), /'\.woff2':\s*'font\/woff2'/);
  const r = await new Promise((ok, ko) => http.get('http://127.0.0.1:3000/fonts/roboto-400.woff2', ok).on('error', ko));
  r.resume();
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.headers['content-type'], 'font/woff2');
});

test('barra laterale come intervals: 200px, sotto i 1280px solo icone (56px)', () => {
  const c = leggi('icu.css');
  assert.match(regola(c, '.mw-sidebar'), /width:\s*200px/);
  assert.match(c, /@media \(min-width: 761px\) and \(max-width: 1279px\)\s*\{[^@]*\.mw-sidebar[^{]*\{[^}]*width:\s*56px/);
});

test('schede e pulsanti: spigoli da 4px, niente bordo colorato a sinistra, focus visibile', () => {
  const c = leggi('icu.css');
  assert.match(regola(c, '.mw-card'), /border-radius:\s*4px/);
  assert.match(regola(c, '.mw-tb'), /border-radius:\s*4px/);
  assert.match(regola(c, '.mw-oggi-allenamento'), /border-left:\s*0/);
  assert.match(regola(c, '.mw-sessione'), /border-left:\s*0/);
  assert.match(c, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/);
});

test('niente occhiello sopra il titolo di Oggi (la barra in alto dice già «Oggi»)', () => {
  assert.match(regola(leggi('icu.css'), '.mw-oggi-testa .mw-pan-sopra'), /display:\s*none/);
});

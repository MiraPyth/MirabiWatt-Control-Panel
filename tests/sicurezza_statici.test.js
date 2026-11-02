// 02/11/2026: il server statico restituiva QUALSIASI file della cartella, compresi .env (chiavi intervals.icu e
// Gemini), il token Strava e il webhook del coach, a chiunque in LAN o su Tailscale. Ora solo file da pagina web.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const stato = p => new Promise((ok, ko) => http.get({ host: '127.0.0.1', port: 3000, path: p }, r => { r.resume(); ok(r.statusCode); }).on('error', ko));

for (const p of ['/.env', '/.strava-token.json', '/.strava.env', '/.coach_webhook', '/saved-meals.json', '/preferenze.json',
                 '/obiettivi.json', '/coach-ultimo.json', '/piani/attivo.json', '/%2Eenv', '/fonts/../.env', '/node_modules/x.js', '/.git/config'])
  test(`negato: ${p}`, async () => assert.strictEqual(await stato(p), 404));

for (const p of ['/', '/dashboard.html', '/palestra.js', '/icu.css', '/palestra-gif/SpYC0Kp.gif', '/fonts/roboto-400.woff2'])
  test(`servito: ${p}`, async () => assert.strictEqual(await stato(p), 200));

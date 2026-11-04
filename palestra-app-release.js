// MirabiWatt · rilascio dell'app Android di palestra (04/11/2026). L'app, dalle Impostazioni, chiede qui se c'è una
// versione nuova (GET /api/palestra/app) e la scarica (GET /api/palestra/app.apk). La cartella di rilascio sta fuori da
// git (app-android/): latest.json { versione, note? } e mw-palestra.apk, messi lì da tools/pubblica.sh dell'app.
const fs = require('fs');
const path = require('path');

const URL_APK = '/api/palestra/app.apk';

/** { versione, url, note? } se la cartella ha il rilascio completo, altrimenti null. */
function info(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'latest.json'), 'utf8'));
    if (!j.versione || !fs.statSync(path.join(dir, 'mw-palestra.apk')).isFile()) return null;
    return { versione: String(j.versione), url: URL_APK, ...(j.note ? { note: String(j.note) } : {}) };
  } catch (e) { return null; }
}

/** Gestisce le due rotte; true se la richiesta è stata servita (anche con 404), false se non è per questo modulo. */
function servi(req, res, dir) {
  if (req.method !== 'GET') return false;
  const url = req.url.split('?')[0];
  if (url !== '/api/palestra/app' && url !== URL_APK) return false;
  const i = info(dir);
  if (!i) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'nessun rilascio dell\'app' })); return true; }
  if (url === '/api/palestra/app') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(i)); return true; }
  const file = path.join(dir, 'mw-palestra.apk');
  res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': fs.statSync(file).size,
    'Content-Disposition': `attachment; filename="mw-palestra-${i.versione}.apk"`, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
  return true;
}

module.exports = { info, servi, URL_APK };

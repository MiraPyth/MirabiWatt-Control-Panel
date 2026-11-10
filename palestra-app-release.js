// MirabiWatt · aggiornamento dell'app Android di palestra, come MIRAGAME (10/11/2026). L'app, dal Profilo o in automatico, chiede
// qui se c'e' una build piu' nuova (GET /api/palestra/app) e la scarica dentro l'app (GET /api/palestra/app.apk). Il server
// legge la cartella dist/ dell'app: ultima.json (scritto da scripts/apk.sh: versione, codice, data della build, nome dell'apk) e
// l'apk indicato. Nessuna pubblicazione a mano: si compila e basta.
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL_APK = '/api/palestra/app.apk';
const DIST_PREDEFINITA = path.join(os.homedir(), 'Mirabiwatt-Android-App', 'dist');

/** { file, json } se la cartella ha ultima.json e l'apk che indica (solo un nome di file, mai un percorso), altrimenti null. */
function leggi(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'ultima.json'), 'utf8'));
    if (!j.versione || typeof j.apk !== 'string' || path.basename(j.apk) !== j.apk || !j.apk.endsWith('.apk')) return null;
    const file = path.join(dir, j.apk);
    return fs.statSync(file).isFile() ? { file, json: j } : null;
  } catch (e) { return null; }
}

/** { ok, versione, codice, costruito, byte, url } o null. */
function info(dir) {
  const r = leggi(dir);
  if (!r) return null;
  return { ok: true, versione: String(r.json.versione), codice: r.json.codice, costruito: r.json.costruito, byte: fs.statSync(r.file).size, url: URL_APK };
}

/** Gestisce le due rotte; true se la richiesta e' stata servita (anche con 404), false se non e' per questo modulo. */
function servi(req, res, dir) {
  if (req.method !== 'GET') return false;
  const url = req.url.split('?')[0];
  if (url !== '/api/palestra/app' && url !== URL_APK) return false;
  const r = leggi(dir);
  if (!r) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'nessuna build dell\'app' })); return true; }
  if (url === '/api/palestra/app') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(info(dir))); return true; }
  res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': fs.statSync(r.file).size,
    'Content-Disposition': `attachment; filename="${path.basename(r.file)}"`, 'Cache-Control': 'no-store' });
  fs.createReadStream(r.file).pipe(res);
  return true;
}

module.exports = { info, servi, URL_APK, DIST_PREDEFINITA };

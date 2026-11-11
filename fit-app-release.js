// MirabiWatt · aggiornamento OTA dell'app MirabiWatt Fit (11/11/2026): come l'app palestra, ma sul canale /api/fit/app e dalla cartella
// fit/dist/ dell'app (ultima.json scritto da fit/scripts/rilascia.sh + l'apk che indica). Nessuna pubblicazione a mano: si compila e basta.
const os = require('os');
const path = require('path');
const { creaRilascio } = require('./palestra-app-release.js');

const DIST_FIT = path.join(os.homedir(), 'Mirabiwatt-Android-App', 'fit', 'dist');

module.exports = { ...creaRilascio('/api/fit/app'), DIST_FIT };

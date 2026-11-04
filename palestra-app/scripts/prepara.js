// MirabiWatt Palestra · prepara www/ per Capacitor (02/11/2026): sorgente + logica di MirabiWatt + GIF + font + icone.
// La logica della seduta (palestra.js) e le GIF si copiano da ~/mirabiwatt-control-panel: una sola fonte.
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const MW = process.env.MIRABIWATT_DIR || path.join(R, '..');
const WWW = path.join(R, 'www');
const ICONE = ['barbell', 'check', 'x', 'plus', 'minus', 'play', 'skip-forward', 'arrow-clockwise', 'arrow-left', 'cloud-check', 'cloud-slash', 'calendar-blank', 'bicycle', 'moon', 'fork-knife', 'flag-checkered', 'drop', 'timer'];

fs.rmSync(WWW, { recursive: true, force: true });
fs.cpSync(path.join(R, 'src'), WWW, { recursive: true });
fs.copyFileSync(path.join(MW, 'palestra.js'), path.join(WWW, 'js', 'palestra.js'));
fs.copyFileSync(path.join(MW, 'nutrition-library.js'), path.join(WWW, 'js', 'nutrition-library.js'));
fs.cpSync(path.join(MW, 'palestra-gif'), path.join(WWW, 'gif'), { recursive: true });

fs.mkdirSync(path.join(WWW, 'fonts'), { recursive: true });
const fb = path.join(R, 'node_modules', '@fontsource', 'barlow-condensed', 'files');
for (const w of [600, 700]) fs.copyFileSync(path.join(fb, `barlow-condensed-latin-${w}-normal.woff2`), path.join(WWW, 'fonts', `barlow-condensed-${w}.woff2`));
for (const w of [400, 500, 700]) fs.copyFileSync(path.join(MW, 'fonts', `roboto-${w}.woff2`), path.join(WWW, 'fonts', `roboto-${w}.woff2`));

// icone Phosphor (regular) dai file ufficiali del pacchetto, in un unico script
const dir = path.join(R, 'node_modules', '@phosphor-icons', 'core', 'assets', 'regular');
const mappa = Object.fromEntries(ICONE.map(n => [n, fs.readFileSync(path.join(dir, `${n}.svg`), 'utf8').replace(/<\?xml[^>]*>/, '').trim()]));
fs.writeFileSync(path.join(WWW, 'js', 'icone.js'), `window.ICONE = ${JSON.stringify(mappa)};\n`);
console.log(`www pronto: ${fs.readdirSync(path.join(WWW, 'gif')).length} GIF, ${ICONE.length} icone`);

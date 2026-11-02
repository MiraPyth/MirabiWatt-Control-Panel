// Nutrizione · alternativa AI (13/10/2026): si vede che sta lavorando (secondi che passano, pulsante bloccato),
// il riquadro si chiude con ✕ e da solo dopo il salvataggio.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(process.env.HOME, 'oglight-mira/node_modules/jsdom'));
const DIR = path.join(__dirname, '..');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const FISSO = new Date(2026, 9, 14, 10, 0, 0).getTime();
const PROFILO = { name: 'Magician', ftp: 305, cp: 281, wPrime: 24960, weightKg: 82.25, ftpUpdated: '2026-09-24T07:32:19Z',
  powerZones: [55, 75, 90, 105, 120, 150, 999], powerZoneNames: ['Active Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 Max', 'Anaerobic', 'Neuromuscular'] };
const CURVE = { peso: 82.25, curve: ['42d', '84d', 's0', 'all'].map((id, k) => ({ id, label: id, start: '2026-09-02', end: '2026-10-14', peso: 82.25,
  secs: [1, 5, 60, 180, 300, 600, 720, 1200], watts: [958, 945, 422, 380, 360, 312, 311, 291], wkg: [11.67, 11.51, 5.05, 4.54, 4.3, 3.73, 3.72, 3.48],
  cp: 281 + k, wPrime: 25200, eftp: 287 + k * 10, map: null, vo2max: 54.8, cs5m: 1550 })) };
const FITNESS = { giorni: Array.from({ length: 50 }, (_, i) => { const d = new Date(2026, 7, 25 + i); return { data: d.toLocaleDateString('sv-SE'), ctl: 45 + i / 20, atl: 40 + (i % 9), carico: 40 + (i % 4) * 15 }; }) };

function pagina() {
  let html = fs.readFileSync(path.join(DIR, 'dashboard.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w.-]+\.js)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(DIR, f), 'utf8')}</script>`);
  const vc = new VirtualConsole(), errori = [], richieste = [];
  vc.on('jsdomError', e => errori.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://192.168.1.38:3000/',
    beforeParse(w) {
      const Vero = w.Date;
      class Finto extends Vero { constructor(...a) { super(...(a.length ? a : [FISSO])); } static now() { return FISSO; } }
      w.Date = Finto;
      w.lucide = { createIcons() {} }; w.scrollTo = () => {}; w.confirm = () => true; w.alert = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (u, o = {}) => {
        const s = String(u), body = o.body ? JSON.parse(o.body) : null;
        richieste.push({ url: s, metodo: o.method || 'GET', body });
        let r = {};
        if (s.startsWith('/api/dashboard')) r = { profile: PROFILO, history: { ctl: [], eftp: [], weight: [] }, form: { ctl: 47, atl: 36, tsb: 11 },
          lastActivity: { id: 'i195817930', name: '[MirabiWatt] EnduranceLungo', type: 'Ride', date: '2026-10-10T09:00:00', movingTime: 5340, distance: 38500, load: 77 } };
        else if (s === '/api/power-curves') r = CURVE;
        else if (s.startsWith('/api/fitness')) r = FITNESS;
        else if (s === '/api/preferenze') r = o.method === 'POST' ? body : {};
        else if (s === '/api/obiettivi') r = { obiettivi: [] };
        else if (s.startsWith('/api/calendar')) r = { activities: [], wellness: [{ date: '2026-10-13', ctl: 47, atl: 36, rampRate: -4 }] };
        else if (s.startsWith('/api/automation')) r = { installed: false };
        else if (s === '/api/meal-alternative') { await new Promise(ok => setTimeout(ok, 1200)); r = { items: [{ food: 'Pancake <proteici>', grams: 120, kcal: 320 }], p: 30, fat: 10, c: 60, kcal: 450, note: 'Più dolce.' }; }
        else if (s === '/api/saved-meals' && o.method === 'POST') r = { ok: true, id: 'm1' };
        else if (s.startsWith('/api/ftp-tests') || s.startsWith('/api/saved-meals')) r = [];
        const t = JSON.stringify(r);
        return { ok: true, status: 200, json: async () => JSON.parse(t) };
      };
    } });
  return { w: dom.window, d: dom.window.document, errori, richieste };
}
const testo = el => el.textContent.replace(/\s+/g, ' ').trim();

test('alternativa: attesa visibile, poi salvo e il riquadro si chiude; oppure lo chiudo con ✕', async () => {
  const { d, errori, richieste } = pagina();
  await tick(250);
  d.querySelector('.sidebar-item[data-view="view-nutrition"]').click();
  await tick(50);
  d.getElementById('meal-craving-0').value = 'qualcosa di dolce';
  const bottone = d.querySelector('[data-alt="0"]');
  assert.ok(bottone, 'pulsante Alternativa del primo pasto');
  bottone.click();
  await tick(1100);
  const box = d.getElementById('meal-alt-0');
  assert.ok(!box.classList.contains('hidden'));
  assert.ok(box.querySelector('.mw-attesa'), 'indicatore di attesa');
  assert.match(testo(box), /Cerco un'alternativa… 1 s/);
  assert.ok(bottone.disabled, 'niente doppie richieste mentre aspetta');
  await tick(300);
  assert.ok(!bottone.disabled);
  assert.match(testo(box), /Pancake <proteici> — 120g/);
  assert.ok(!box.innerHTML.includes('<proteici>'));
  box.querySelector('[data-salva-alt="0"]').click();
  await tick(60);
  assert.ok(richieste.some(r => r.url === '/api/saved-meals' && r.metodo === 'POST'));
  assert.ok(box.classList.contains('hidden'), 'salvata: il riquadro si chiude');
  assert.match(d.getElementById('mw-toast').textContent, /Salvata.*Salvate/);
  // di nuovo, e questa volta la chiudo senza salvare
  bottone.click();
  await tick(1300);
  box.querySelector('[data-chiudi-alt="0"]').click();
  assert.ok(box.classList.contains('hidden'));
  assert.deepStrictEqual(errori, []);
});

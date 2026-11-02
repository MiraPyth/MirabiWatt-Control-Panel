// 19/10/2026 sera: due difetti grafici segnalati da Tiziano che jsdom non può misurare (niente layout), quindi
// si controllano le regole CSS che li evitano.
// 1) Calendario: .mw-cal con overflow-x:auto è il contenitore di scorrimento dell'intestazione sticky; con top:56px
//    l'intestazione scendeva di 56px DENTRO il calendario e copriva la prima settimana del mese (date e allenamenti).
//    Ora .mw-cal scorre da solo (altezza = finestra − barra strumenti) e l'intestazione sta a top:0.
// 2) Tracker palestra: la barra dei pallini degli esercizi (overflow-x:auto) in una colonna flex ad altezza fissa
//    veniva schiacciata a zero → step tagliati. Testa e pallini non si restringono.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const css = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function regola(testo, selettore) {
  const re = new RegExp(`(^|[}\\s])${selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g');
  let m, tutto = '';
  while ((m = re.exec(testo))) tutto += m[2] + ';';
  return tutto;
}

test('calendario: l\'intestazione dei giorni non copre la prima settimana', () => {
  const c = css('calendario.css');
  assert.match(regola(c, '.mw-cal-testa'), /top:\s*0\s*[;}]?/, 'sticky in cima al calendario, non 56px più giù');
  const cal = regola(c, '.mw-cal');
  assert.match(cal, /overflow:\s*auto/, 'il calendario scorre da solo in entrambe le direzioni');
  assert.match(cal, /max-height:\s*calc\(100vh - var\(--mw-tb-h/, 'alto quanto la finestra meno la barra strumenti');
  assert.match(css('calendario-ui.js'), /--mw-tb-h/, 'l\'altezza vera della barra (che va a capo) misurata in pagina');
});

test('tracker palestra: testa e pallini degli esercizi non vengono schiacciati', () => {
  const p = css('palestra.css');
  assert.match(regola(p, '.mw-palestra > *'), /flex-shrink:\s*0/);
});

// 3) Tools (19/10/2026 sera): nella colonna del modulo (max 320px) campi e menu non si stringevano sotto la loro larghezza
//    naturale e debordavano sopra le schede dei risultati. Colonne che possono stringersi, campi al 100%, menu largo su 2 colonne.
test('Tools: i campi delle calcolatrici restano nella loro colonna', () => {
  const a = css('analisi.css');
  assert.match(regola(a, '.mw-form'), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(regola(a, '.mw-form label'), /min-width:\s*0/);
  const campi = regola(a, '.mw-form input, .mw-form select');
  assert.match(campi, /width:\s*100%/);
  assert.match(campi, /min-width:\s*0/);
  assert.match(regola(a, '.mw-form .mw-largo'), /grid-column:\s*1\s*\/\s*-1/);
  assert.match(css('strumenti-ui.js'), /<label class="mw-largo">Rapporto/);
});

/* MirabiWatt Palestra · rete e coda offline (02/11/2026). Pura: la rete arriva come funzione.
 * In palestra spesso non c'e' segnale: le sedute finite restano in coda sul telefono e partono appena
 * il server MirabiWatt risponde (rete di casa o Tailscale). */
(function (root) {
  'use strict';
  const SERVER = ['http://192.168.1.38:3000', 'http://100.101.135.102:3000'];

  /** Aggiunge (o sostituisce, stesso id) una seduta alla coda. */
  function accoda(coda, seduta) {
    return [...(coda || []).filter(s => s.id !== seduta.id), seduta];
  }

  /** Prova a inviare tutte le sedute in coda; restano solo quelle rifiutate o non partite. */
  async function svuota(coda, invia) {
    const resta = [];
    let inviate = 0;
    for (const s of coda || []) {
      try { await invia(s); inviate++; } catch (e) { resta.push(s); }
    }
    return { coda: resta, inviate };
  }

  /** Il primo server che risponde (prova(url) rifiuta se non raggiungibile), o null. */
  async function scegliServer(prova, elenco = SERVER) {
    for (const url of elenco) {
      try { await prova(url); return url; } catch (e) { /* il prossimo */ }
    }
    return null;
  }

  function freschezza(ms, adesso = Date.now()) {
    if (!ms) return 'mai scaricate';
    const min = Math.max(0, Math.round((adesso - ms) / 60000));
    if (min < 60) return `aggiornate ${min} min fa`;
    const ore = Math.round(min / 60);
    if (ore < 36) return `aggiornate ${ore} h fa`;
    return `aggiornate ${Math.round(ore / 24)} giorni fa`;
  }

  const api = { SERVER, accoda, svuota, scegliServer, freschezza };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sync = api;
})(typeof window !== 'undefined' ? window : this);

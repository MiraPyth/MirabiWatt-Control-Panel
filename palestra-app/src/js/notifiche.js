/* MirabiWatt Palestra · notifica di fine recupero (04/11/2026). Con l'app in background il timer della pagina non
 * suona: la notifica locale la programma Android all'ora di fine recupero. Il plugin arriva come argomento. */
(function (root) {
  'use strict';
  const ID = 1, CANALE = 'recupero';

  function crea(plugin) {
    let pronto = null;
    // permesso e canale si preparano una volta sola; se il permesso e' negato la notifica non parte e basta
    const prepara = () => pronto || (pronto = (async () => {
      if (!plugin) return false;
      try {
        let p = await plugin.checkPermissions();
        if (p.display !== 'granted') p = await plugin.requestPermissions();
        if (p.display !== 'granted') return false;
        if (plugin.createChannel) await plugin.createChannel({ id: CANALE, name: 'Fine recupero', description: 'Avvisa quando il recupero tra le serie e finito', importance: 5, vibration: true, visibility: 1 });
        return true;
      } catch (e) { return false; }
    })());

    return {
      async programma(quandoMs, titolo, corpo) {
        if (!(await prepara())) return;
        try { await plugin.schedule({ notifications: [{ id: ID, title: titolo, body: corpo, channelId: CANALE, schedule: { at: new Date(quandoMs), allowWhileIdle: true } }] }); } catch (e) { /* senza notifica si va avanti */ }
      },
      async annulla() {
        if (!plugin) return;
        try { await plugin.cancel({ notifications: [{ id: ID }] }); } catch (e) { /* niente da annullare */ }
      },
      prepara
    };
  }

  const api = { crea };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Notifiche = api;
})(typeof window !== 'undefined' ? window : this);

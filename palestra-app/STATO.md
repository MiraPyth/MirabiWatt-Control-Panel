# MirabiWatt Palestra (app Android)

App per allenarsi in palestra con le sedute pianificate in MirabiWatt (`~/mirabiwatt-control-panel`).

## Come funziona
- Scarica le prossime 14 giornate da `GET /api/palestra/prossime` (MirabiWatt :3000). Prova prima la rete di casa
  (192.168.1.38), poi Tailscale (100.101.135.102).
- In palestra lavora senza rete. La seduta in corso si salva a ogni tocco (`mwp_bozza`); le sedute finite vanno in
  coda (`mwp_coda`) e partono verso `POST /api/palestra/sessioni` appena il server risponde.
- La logica della seduta (proposta carichi, avvicinamenti, riepilogo) è `palestra.js` di MirabiWatt, copiata da
  `scripts/prepara.js`: una sola fonte. Anche le GIF arrivano da lì.

## Struttura
- `src/` sorgente web: `index.html`, `css/tokens.css` (chiaro/scuro), `css/app.css`, `js/sync.js` e `js/seduta.js`
  (puri, testati), `js/app.js` (schermate Home, Allenamento, Recupero, Fine).
- `scripts/prepara.js` genera `www/` (sorgente + palestra.js + GIF + font Barlow Condensed/Roboto + icone Phosphor).
- `scripts/apk.sh` = prepara + test + `cap sync` + Gradle. APK in `dist/`.
- `android/` progetto Capacitor 8 (SDK 36). HTTP in chiaro permesso solo verso i due indirizzi dell'OptiPlex
  (`res/xml/network_security_config.xml`).

## Strumenti
`. ~/android-dev/env.sh` (JDK 21 Temurin + Android SDK in `~/android-dev`, niente root). `npm test`, `npm run apk`.

## Limiti noti (v0.1.0)
- Legge il piano stagionale: una settimana ripianificata con l'IA (su intervals.icu) non si vede ancora.
- Icona e splash sono quelli predefiniti di Capacitor.
- Schermo sempre acceso finché l'app è aperta (FLAG_KEEP_SCREEN_ON, v0.1.2).

## Versione 0.3.0 (04/11/2026)
- Tre sezioni in basso: **Calendario** (settimana del piano, card cliccabili con foglio di dettaglio; bici blu, palestra ambra,
  obiettivi rosa in sezione separata), **Oggi** (solo l'allenamento di oggi) e **Nutrizione** (target e pasti, `pianoNutrizione`
  copiata da MirabiWatt).
- Tracking: ogni riga ha kg e ripetizioni propri (campi modificabili) e una spunta che conferma e avvia il recupero.
- Uscita dalla seduta: popup «Riprendi più tardi» / «Cancella allenamento».
- Fine recupero: notifica locale (`@capacitor/local-notifications`, permessi POST_NOTIFICATIONS e USE_EXACT_ALARM).
- Da fare: fase nutrizionale ancora fissa su «mantenimento» (serve un endpoint nel server); il calendario mostra solo la
  settimana corrente; il timer di recupero è a tutto schermo; il piano (`/api/settimana-piano`) e gli eventi intervals.icu
  possono non coincidere dopo una ripianificazione.

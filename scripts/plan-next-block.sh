#!/bin/bash
# MirabiWatt - controllo settimanale automatico: genera il blocco di allenamento
# successivo in season-plan.js quando ci si avvicina alla fine del dettaglio
# già scritto, DOPO aver confrontato pianificato vs fatto davvero su intervals.icu.
# Lanciato da cron ogni lunedì mattina (vedi crontab -l).

set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

REPO_DIR="/home/tizianodebianmedia/mirabiwatt-control-panel"
MEMORY_DIR="/home/tizianodebianmedia/.claude/projects/-home-tizianodebianmedia-mirabiwatt-control-panel/memory"
LOG_FILE="$REPO_DIR/automation-log.md"

cd "$REPO_DIR"

PROMPT=$(cat <<'PROMPT_EOF'
Sei l'assistente che mantiene il piano di allenamento stagionale 2026-2027 di Tiziano in questo repository (mirabiwatt-control-panel). Esegui in autonomia, senza fare domande: nessuno leggerà richieste di chiarimento, quindi prendi la decisione migliore possibile con i dati reali disponibili e documenta il ragionamento nei file indicati sotto.

CONTESTO DA LEGGERE PRIMA DI TUTTO:
1. Leggi MEMORY.md nella cartella di memoria di progetto e tutti i file collegati (in particolare season_2026_2027_project.md, training_history_feedback.md, check_history_before_prescribing.md, user_own_training_system.md, intervals_icu_existing_library.md, dashboard_v2_redesign.md, intervals_icu_workout_syntax.md).
2. Leggi training-knowledge-synthesis.md in questo repository per i riferimenti scientifici (periodizzazione a blocchi di Rønnestad, modello polarizzato, ecc.).
3. Leggi season-plan.js — in particolare SEASON.events (le due gare obiettivo con le rispettive date) e SEASON.detailedPhases (le settimane già dettagliate giorno per giorno).
4. Leggi workout-library.js per il vocabolario di allenamenti già disponibile (i nomi delle sessioni con relativo "compile()"/DEFS) — usa questi nomi quando calzano, prima di inventarne di nuovi.

STEP 1 — Serve davvero generare un nuovo blocco adesso?
Trova l'ultima settimana con dettaglio giorno-per-giorno in SEASON.detailedPhases (l'ultimo elemento dell'ultima fase). Calcola quanti giorni mancano da oggi alla fine di quella settimana.
- Se mancano più di 14 giorni: non generare nulla. Vai comunque allo STEP 5 per loggare che hai controllato e non era ancora il momento, poi fermati.
- Se mancano 14 giorni o meno (anche se il dettaglio è già scaduto): procedi con gli step successivi.

STEP 2 — Analisi di aderenza (FONDAMENTALE, non saltare, non inventare dati)
Leggi INTERVALS_API_KEY e INTERVALS_ATHLETE_ID dal file .env in questa cartella. Interroga l'API di intervals.icu con lo stesso pattern già usato in server.js (Basic auth, utente "API_KEY", password la chiave):
  GET https://intervals.icu/api/v1/athlete/{id}/activities?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
  GET https://intervals.icu/api/v1/athlete/{id}/wellness.json?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
per l'intero periodo coperto dalle ultime 3-4 settimane già dettagliate in season-plan.js.

Confronta, giorno per giorno, cosa era PIANIFICATO (season-plan.js: nome sessione, durata, zona, se "critical") con cosa è stato REALMENTE fatto (le attività vere: tipo, durata, potenza, carico/TSS). Per ogni settimana valuta in 2-3 frasi:
- Aderenza alta (fatto sostanzialmente come da piano), media (modificato ma nello spirito), o bassa (saltate sedute chiave, specialmente quelle "critical: true").
- Il trend reale di CTL/ATL/TSB rispetto a quello atteso dal piano — sovraccarico, sottocarico, o in linea.
Non procedere allo step successivo senza aver fatto questa analisi con i dati reali appena scaricati.

STEP 3 — Genera il blocco successivo
Sulla base dell'analisi di aderenza, del profilo atletico REALE attuale (FTP/CP/peso presi dal profilo intervals.icu appena interrogato), delle regole fisse della stagione (dalla memoria di progetto: massimo 2-3 sedute HIT a settimana, almeno il 75% delle sedute a bassa intensità anche in inverno, martedì Zwift/HIT come ancora preferita ma spostabile se serve, struttura a blocchi di Rønnestad con 1 settimana concentrata + settimane più leggere, obiettivi e date in SEASON.events), genera 3-4 nuove settimane di dettaglio giorno-per-giorno da aggiungere in coda a SEASON.detailedPhases in season-plan.js, con la STESSA identica struttura dati delle settimane già presenti (campi d, s, dur, zone, critical, note — copia lo schema esatto delle settimane esistenti come esempio).

Regole di adattamento:
- Se l'aderenza è stata bassa o gli indicatori di fatica non sono buoni, non continuare ciecamente la progressione già pianificata: alleggerisci il carico e spiega il motivo nel campo "special" della prima nuova settimana.
- Se l'aderenza è stata alta e la forma sta migliorando in modo sano, procedi secondo l'impostazione del piano (o accelera leggermente solo se chiaramente sensato e coerente con le regole fisse sopra).
- Usa i nomi di allenamento già presenti in workout-library.js quando calzano. Se serve davvero un tipo di sessione nuovo, aggiungilo alle DEFS di workout-library.js seguendo lo stesso schema (step con lo/hi come frazione di FTP, mai ripetute annidate — vedi il commento in cima al file, è un vincolo reale di intervals.icu confermato con test).
- Verifica la sintassi con "node -c season-plan.js" e, se modificato, "node -c workout-library.js" prima di considerarti finito.

STEP 4 — Aggiorna la memoria di progetto
Aggiorna il file di memoria season_2026_2027_project.md (o creane uno nuovo se più adatto, seguendo esattamente il formato frontmatter già usato dagli altri file in quella cartella) con: quali settimane hai aggiunto e con che date, cosa ha mostrato l'analisi di aderenza, e perché hai preso le decisioni prese. Se crei un nuovo file, aggiungi la riga corrispondente in MEMORY.md.

STEP 5 — Log
Aggiungi sempre una riga in fondo al file automation-log.md nella root di questo repository (crealo con un titolo se non esiste ancora) con: data e ora di questa esecuzione, se hai generato un nuovo blocco oppure no, e in 2-3 frasi il motivo/risultato.

VINCOLI STRETTI:
- NON fare git commit né git push.
- NON modificare dashboard.html, server.js, nutrition-library.js.
- NON inviare nulla su intervals.icu (nessuna richiesta POST/PUT/DELETE verso /events — solo GET per leggere e analizzare).
- Non porre domande e non aspettare conferme: documenta ogni decisione nei file indicati sopra invece di chiedere.
PROMPT_EOF
)

{
  echo "=== Esecuzione $(date -Iseconds) ==="
  claude -p "$PROMPT" \
    --dangerously-skip-permissions \
    --add-dir "$MEMORY_DIR" \
    --permission-mode bypassPermissions
  EXIT_CODE=$?
  echo "=== Fine esecuzione $(date -Iseconds) (exit $EXIT_CODE) ==="
} >> "$REPO_DIR/cron-run.log" 2>&1

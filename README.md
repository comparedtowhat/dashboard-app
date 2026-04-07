# Link Dashboard

Minimaler persönlicher Link-Dashboard (für New Tab) — Express + SQLite.

Deployment auf Vercel

Das Projekt ist jetzt für zwei Betriebsarten vorbereitet:

- lokal: `Express + SQLite`
- auf Vercel: `Serverless API + Upstash Redis`

Privater Zugriff

- Wenn `DASHBOARD_PASSWORD` gesetzt ist, schützt die App die komplette Oberfläche und die API per Login.
- Das ist der empfohlene Weg, wenn die Seite auch auf der öffentlichen Production-Domain privat bleiben soll.
- Nach dem Setzen der Variable ist ein neuer Deploy nötig.

Wichtig: die bisherige `SQLite`-Datei ist auf Vercel **nicht** dauerhaft nutzbar, weil das Dateisystem dort nicht persistent ist. Für Vercel muss deshalb ein Redis-Store per Upstash konfiguriert werden.

Vercel-Setup

1. Repository bei Vercel importieren
2. In Vercel eine `Redis`-/`Upstash`-Integration anbinden
3. Diese Environment Variables setzen:
   - `DASHBOARD_PASSWORD`
   - bevorzugt: `REDIS_URL`
   - alternativ: `UPSTASH_REDIS_REST_URL`
   - alternativ: `UPSTASH_REDIS_REST_TOKEN`
4. Deploy ausführen

Danach läuft:

- Frontend auf `/`
- API auf `/api/...`
- Health-Check auf `/health`

Hinweis zur Datenmigration

- Deine lokale Datei `data.db` wird nicht automatisch nach Vercel übernommen.
- Beim ersten Start auf Vercel werden Beispiel-Daten angelegt.
- Wenn du deine echten lokalen Daten übernehmen willst, kannst du das Migrationsskript weiter unten verwenden.

Migration von lokaler SQLite nach Upstash Redis

Wenn du bestehende lokale Daten aus `data.db` nach Upstash Redis übernehmen willst:

1. Lokal die Vercel-Env-Variablen setzen:
   - bevorzugt: `REDIS_URL`
   - alternativ: `UPSTASH_REDIS_REST_URL`
   - alternativ: `UPSTASH_REDIS_REST_TOKEN`
2. Optional `DB_FILE` setzen, falls deine SQLite-Datei nicht `./data.db` ist.
3. Migration starten:

```bash
npm run migrate:vercel-kv
```

Das Skript liest Kategorien und Links aus deiner lokalen SQLite-Datenbank und schreibt den kompletten Zustand nach Redis unter den Key `dashboard:data`.

Achtung:

- Bereits vorhandene Daten in Redis werden dabei überschrieben.
- Am besten die Migration vor dem ersten produktiven Einsatz oder bewusst als kompletter Replace ausführen.

Schnellstart

```bash
npm install
npm start
```

Öffne dann http://localhost:3000

Health-Check

Im Browser öffnen oder per CLI prüfen:

```bash
curl http://localhost:3000/health
```

Erwartete Antwort enthält mindestens: `ok`, `version`, `uptime`, `timestamp`

Features

- Links nach Kategorien gruppiert
- Links hinzufügen / bearbeiten / löschen
- Kategorien erstellen / löschen
- Daten persistiert in `data.db` (SQLite)
- Auf Vercel persistiert in Upstash Redis

Git/Deployment-Hinweis

- `data.db` ist absichtlich nicht versioniert (`.gitignore`).
- Beim ersten Start wird die DB automatisch erstellt und mit Beispiel-Daten befüllt.
- Für produktive Daten solltest du ein persistentes Volume/Verzeichnis für die SQLite-Datei verwenden.
- Auf Vercel wird stattdessen Upstash Redis verwendet.

Optionaler DB-Pfad (`DB_FILE`)

- Standard ist `./data.db` im Projektordner.
- Mit `DB_FILE` kannst du den Speicherort überschreiben (absolut oder relativ zu `db.js`).
- Falls das Zielverzeichnis noch nicht existiert, wird es automatisch erstellt.

Beispiele:

```powershell
$env:DB_FILE='D:\app-data\dashboard\data.db'; npm start
```

```bash
DB_FILE=/var/lib/dashboard/data.db npm start
```

Weitere Konfiguration

- `PORT` (optional): Standard ist `3000`
- `DASHBOARD_PASSWORD`: aktiviert Passwortschutz für die gesamte App
- `REDIS_URL`: aktiviert Redis-Speicherung auf Vercel
- alternativ `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

Beispiel:

```bash
PORT=4000 npm start
```

Dateien

- `server.js` — Express API + statische Dateien
- `createApp.js` — gemeinsame Express-App für lokal und Vercel
- `api/index.js` — Vercel Serverless Entry
- `db.js` — Storage-Layer für SQLite lokal oder Upstash Redis
- `public/` — frontend (HTML/CSS/JS)

Tipps

- Für Browser-New-Tab: setze die neue Tab-Seite auf `http://localhost:3000` oder kopiere die `public/index.html` in eine statische-Host-Umgebung.

Windows: robuster Start + Autostart

```bash
npm run start:helper
```

Startet den Server bei Bedarf im Hintergrund und öffnet `http://localhost:3000`.

Autostart beim Login einrichten:

```bash
npm run autostart:install
```

Richtet für höhere Zuverlässigkeit zwei Mechanismen ein:

- Startup-Ordner-Eintrag
- Geplanter Task beim Benutzer-Login

Autostart wieder entfernen:

```bash
npm run autostart:remove
```

Alternativ per Doppelklick: `start-dashboard.cmd`

Troubleshooting

- Port `3000` bereits belegt (`EADDRINUSE`):
  - anderen Port nutzen, z. B. `PORT=4000 npm start`
- PowerShell blockiert Skripte:
  - `npm run start:helper` nutzt bereits `-ExecutionPolicy Bypass`
  - alternativ temporär in einer Shell: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- DB-Datei kann nicht geöffnet werden (`SQLITE_CANTOPEN`):
  - prüfe, ob der Pfad aus `DB_FILE` schreibbar ist
  - bei relativen Pfaden wird relativ zu `db.js` aufgelöst

Contributing

- Fork/Branch erstellen und lokal mit `npm install` + `npm start` testen.
- Änderungen klein halten und auf einen Zweck pro Commit fokussieren.
- Commit-Messages klar formulieren (z. B. `Fix ...`, `Add ...`, `Refactor ...`).
- Danach Pull Request gegen `main` erstellen.

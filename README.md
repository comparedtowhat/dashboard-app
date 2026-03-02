# Link Dashboard

Minimaler persönlicher Link-Dashboard (für New Tab) — Express + SQLite.

Schnellstart

```bash
npm install
npm start
```

Öffne dann http://localhost:3000

Health-Check

```bash
http://localhost:3000/health
```

Erwartete Antwort enthält mindestens: `ok`, `version`, `uptime`, `timestamp`

Features

- Links nach Kategorien gruppiert
- Links hinzufügen / bearbeiten / löschen
- Kategorien erstellen / löschen
- Daten persistiert in `data.db` (SQLite)

Git/Deployment-Hinweis

- `data.db` ist absichtlich nicht versioniert (`.gitignore`).
- Beim ersten Start wird die DB automatisch erstellt und mit Beispiel-Daten befüllt.
- Für produktive Daten solltest du ein persistentes Volume/Verzeichnis für die SQLite-Datei verwenden.

Dateien

- `server.js` — Express API + statische Dateien
- `db.js` — SQLite-Initialisierung und Helper
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

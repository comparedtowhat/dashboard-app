[README.md](https://github.com/user-attachments/files/25532607/README.md)
# Link Dashboard

Minimaler persönlicher Link-Dashboard (für New Tab) — Express + SQLite.

Schnellstart

```bash
npm install
npm start
```

Öffne dann http://localhost:3000

Features

- Links nach Kategorien gruppiert
- Links hinzufügen / bearbeiten / löschen
- Kategorien erstellen / löschen
- Daten persistiert in `data.db` (SQLite)

Dateien

- `server.js` — Express API + statische Dateien
- `db.js` — SQLite-Initialisierung und Helper
- `public/` — frontend (HTML/CSS/JS)

Tipps

- Für Browser-New-Tab: setze die neue Tab-Seite auf `http://localhost:3000` oder kopiere die `public/index.html` in eine statische-Host-Umgebung.

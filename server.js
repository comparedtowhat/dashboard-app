const db = require('./db');
const { createApp } = require('./createApp');
const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Storage: ${db.storageType}`);
  if (db.dbFile) {
    console.log(`SQLite DB: ${db.dbFile}`);
  }
});

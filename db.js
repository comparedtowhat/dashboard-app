const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const configuredDbFile = process.env.DB_FILE;
const dbFile = configuredDbFile
  ? (path.isAbsolute(configuredDbFile)
      ? configuredDbFile
      : path.resolve(__dirname, configuredDbFile))
  : path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    panel TEXT DEFAULT 'Work'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category_id INTEGER,
    description TEXT,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);
});

// Ensure sort_order columns exist (safe on re-run)
db.serialize(() => {
  db.get("PRAGMA table_info(categories)", (err) => {
    // add sort_order if missing
    db.all("PRAGMA table_info(categories)", (e, rows) => {
      if (!e) {
        const has = rows.some(r => r.name === 'sort_order');
        if (!has) {
          db.run("ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0");
        }
      }
    });
  });

  db.get("PRAGMA table_info(links)", (err) => {
    db.all("PRAGMA table_info(links)", (e, rows) => {
      if (!e) {
        const hasSort = rows.some(r => r.name === 'sort_order');
        if (!hasSort) {
          db.run("ALTER TABLE links ADD COLUMN sort_order INTEGER DEFAULT 0");
        }
        const hasDesc = rows.some(r => r.name === 'description');
        if (!hasDesc) {
          db.run("ALTER TABLE links ADD COLUMN description TEXT");
        }
      }
    });
  });
});

// Wenn die DB leer ist, lege einige Beispiel-Daten an
db.get('SELECT COUNT(*) as cnt FROM categories', (err, row) => {
  if (err) return console.error('DB seed check failed:', err.message);
  if (!row || row.cnt === 0) {
    const sampleCats = [
      { name: 'Allgemein', panel: 'Work' },
      { name: 'Arbeit', panel: 'Work' },
      { name: 'Lesen', panel: 'Work' }
    ];
    const sampleLinks = [
      { name: 'GitHub', url: 'https://github.com', cat: 'Allgemein' },
      { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', cat: 'Lesen' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', cat: 'Arbeit' },
      { name: 'Hacker News', url: 'https://news.ycombinator.com', cat: 'Lesen' },
      { name: 'Reddit', url: 'https://www.reddit.com', cat: 'Allgemein' },
      { name: 'Dev.to', url: 'https://dev.to', cat: 'Lesen' },
      { name: 'Pocket', url: 'https://getpocket.com', cat: 'Lesen' },
      { name: 'Gmail', url: 'https://mail.google.com', cat: 'Arbeit' },
      { name: 'Todoist', url: 'https://todoist.com', cat: 'Arbeit' },
      { name: 'YouTube', url: 'https://www.youtube.com', cat: 'Allgemein' }
    ];

    const insertCat = db.prepare('INSERT INTO categories(name, panel) VALUES(?,?)');
    for (const c of sampleCats) insertCat.run(c.name, c.panel || 'Work');
    insertCat.finalize(() => {
      db.all('SELECT id,name FROM categories', (err2, rows) => {
        if (err2) return console.error('Seed fetch categories failed:', err2.message);
        const map = {};
        rows.forEach(r => (map[r.name] = r.id));

        const insertLink = db.prepare('INSERT INTO links(name,url,category_id) VALUES(?,?,?)');
        for (const l of sampleLinks) {
          insertLink.run(l.name, l.url, map[l.cat] || null);
        }
        insertLink.finalize();
        console.log('Seed data inserted.');
      });
    });
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function getCategoriesWithLinks() {
  const cats = await all('SELECT id, name, panel, sort_order FROM categories ORDER BY sort_order, name');
  for (const c of cats) {
    c.links = await all('SELECT id, name, url, description, sort_order FROM links WHERE category_id = ? ORDER BY sort_order, name', [c.id]);
  }
  return cats;
}

module.exports = {
  getCategoriesWithLinks,
  createCategory: (name, panel = 'Work') => run('INSERT INTO categories(name, panel) VALUES(?,?)', [name, panel]),
  updateCategoryName: (id, name) => run('UPDATE categories SET name = ? WHERE id = ?', [name, id]),
  deleteCategory: (id) => run('DELETE FROM categories WHERE id = ?', [id]),
  createLink: (name, url, categoryId, description = null) => run('INSERT INTO links(name, url, category_id, description) VALUES(?,?,?,?)', [name, url, categoryId, description]),
  updateLink: (id, name, url, categoryId, description = null) => run('UPDATE links SET name = ?, url = ?, category_id = ?, description = ? WHERE id = ?', [name, url, categoryId, description, id]),
  deleteLink: (id) => run('DELETE FROM links WHERE id = ?', [id]),
  setCategoryOrder: (id, order) => run('UPDATE categories SET sort_order = ? WHERE id = ?', [order, id]),
  setLinkOrder: (id, order, categoryId) => run('UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?', [order, categoryId, id]),
  getRaw: (sql, params) => all(sql, params),
};

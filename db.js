const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category_id INTEGER,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);
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
  const cats = await all('SELECT id, name FROM categories ORDER BY name');
  for (const c of cats) {
    c.links = await all('SELECT id, name, url FROM links WHERE category_id = ? ORDER BY name', [c.id]);
  }
  return cats;
}

module.exports = {
  getCategoriesWithLinks,
  createCategory: (name) => run('INSERT INTO categories(name) VALUES(?)', [name]),
  deleteCategory: (id) => run('DELETE FROM categories WHERE id = ?', [id]),
  createLink: (name, url, categoryId) => run('INSERT INTO links(name, url, category_id) VALUES(?,?,?)', [name, url, categoryId]),
  updateLink: (id, name, url, categoryId) => run('UPDATE links SET name = ?, url = ?, category_id = ? WHERE id = ?', [name, url, categoryId, id]),
  deleteLink: (id) => run('DELETE FROM links WHERE id = ?', [id]),
  getRaw: (sql, params) => all(sql, params),
};

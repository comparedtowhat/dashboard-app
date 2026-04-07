const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DASHBOARD_STATE_KEY = 'dashboard:data';

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

function createConstraintError(message) {
  const error = new Error(message);
  error.code = 'SQLITE_CONSTRAINT';
  return error;
}

function createSeedState() {
  const categories = sampleCats.map((cat, index) => ({
    id: index + 1,
    name: cat.name,
    panel: cat.panel || 'Work',
    sort_order: index
  }));

  const categoryIdByName = new Map(categories.map((cat) => [cat.name, cat.id]));
  const links = sampleLinks.map((link, index) => ({
    id: index + 1,
    name: link.name,
    url: link.url,
    category_id: categoryIdByName.get(link.cat) || null,
    description: null,
    sort_order: index
  }));

  return {
    nextCategoryId: categories.length + 1,
    nextLinkId: links.length + 1,
    categories,
    links
  };
}

function normalizeState(state) {
  if (!state || !Array.isArray(state.categories) || !Array.isArray(state.links)) {
    return createSeedState();
  }

  const categories = state.categories.map((cat, index) => ({
    id: Number(cat.id),
    name: String(cat.name),
    panel: cat.panel || 'Work',
    sort_order: Number.isFinite(Number(cat.sort_order)) ? Number(cat.sort_order) : index
  }));

  const links = state.links.map((link, index) => ({
    id: Number(link.id),
    name: String(link.name),
    url: String(link.url),
    category_id: link.category_id == null ? null : Number(link.category_id),
    description: link.description == null ? null : String(link.description),
    sort_order: Number.isFinite(Number(link.sort_order)) ? Number(link.sort_order) : index
  }));

  const nextCategoryId = Number.isFinite(Number(state.nextCategoryId))
    ? Number(state.nextCategoryId)
    : categories.reduce((max, cat) => Math.max(max, cat.id), 0) + 1;
  const nextLinkId = Number.isFinite(Number(state.nextLinkId))
    ? Number(state.nextLinkId)
    : links.reduce((max, link) => Math.max(max, link.id), 0) + 1;

  return { nextCategoryId, nextLinkId, categories, links };
}

function sortByOrderThenName(items) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' });
  });
}

function createLocalSqliteStore() {
  const configuredDbFile = process.env.DB_FILE;
  const dbFile = configuredDbFile
    ? (path.isAbsolute(configuredDbFile)
        ? configuredDbFile
        : path.resolve(__dirname, configuredDbFile))
    : path.join(__dirname, 'data.db');

  const dbDir = path.dirname(dbFile);
  if (dbDir && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

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

  db.serialize(() => {
    db.all('PRAGMA table_info(categories)', (e, rows) => {
      if (!e) {
        const has = rows.some((row) => row.name === 'sort_order');
        if (!has) {
          db.run('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0');
        }
      }
    });

    db.all('PRAGMA table_info(links)', (e, rows) => {
      if (!e) {
        const hasSort = rows.some((row) => row.name === 'sort_order');
        if (!hasSort) {
          db.run('ALTER TABLE links ADD COLUMN sort_order INTEGER DEFAULT 0');
        }
        const hasDesc = rows.some((row) => row.name === 'description');
        if (!hasDesc) {
          db.run('ALTER TABLE links ADD COLUMN description TEXT');
        }
      }
    });
  });

  db.get('SELECT COUNT(*) as cnt FROM categories', (err, row) => {
    if (err) return console.error('DB seed check failed:', err.message);
    if (!row || row.cnt === 0) {
      const insertCat = db.prepare('INSERT INTO categories(name, panel, sort_order) VALUES(?,?,?)');
      sampleCats.forEach((cat, index) => insertCat.run(cat.name, cat.panel || 'Work', index));
      insertCat.finalize(() => {
        db.all('SELECT id,name FROM categories', (err2, rows) => {
          if (err2) return console.error('Seed fetch categories failed:', err2.message);
          const map = {};
          rows.forEach((entry) => {
            map[entry.name] = entry.id;
          });

          const insertLink = db.prepare('INSERT INTO links(name,url,category_id,sort_order) VALUES(?,?,?,?)');
          sampleLinks.forEach((link, index) => {
            insertLink.run(link.name, link.url, map[link.cat] || null, index);
          });
          insertLink.finalize();
          console.log('Seed data inserted.');
        });
      });
    }
  });

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(err) {
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

  async function getCategoriesWithLinks() {
    const cats = await all('SELECT id, name, panel, sort_order FROM categories ORDER BY sort_order, name');
    for (const c of cats) {
      c.links = await all('SELECT id, name, url, description, sort_order FROM links WHERE category_id = ? ORDER BY sort_order, name', [c.id]);
    }
    return cats;
  }

  return {
    storageType: 'sqlite',
    dbFile,
    getCategoriesWithLinks,
    createCategory: (name, panel = 'Work') => run('INSERT INTO categories(name, panel) VALUES(?,?)', [name, panel]),
    updateCategoryName: (id, name) => run('UPDATE categories SET name = ? WHERE id = ?', [name, id]),
    deleteCategory: (id) => run('DELETE FROM categories WHERE id = ?', [id]),
    createLink: (name, url, categoryId, description = null) => run('INSERT INTO links(name, url, category_id, description) VALUES(?,?,?,?)', [name, url, categoryId, description]),
    updateLink: (id, name, url, categoryId, description = null) => run('UPDATE links SET name = ?, url = ?, category_id = ?, description = ? WHERE id = ?', [name, url, categoryId, description, id]),
    deleteLink: (id) => run('DELETE FROM links WHERE id = ?', [id]),
    setCategoryOrder: (id, order) => run('UPDATE categories SET sort_order = ? WHERE id = ?', [order, id]),
    setLinkOrder: (id, order, categoryId) => run('UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?', [order, categoryId, id])
  };
}

function createVercelKvStore() {
  const apiUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const apiToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  async function kvRequest(command, ...parts) {
    const endpoint = apiUrl.replace(/\/$/, '');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command.toUpperCase(), ...parts])
    });

    if (!response.ok) {
      throw new Error(`KV request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error);
    }
    return payload.result;
  }

  async function loadState() {
    const raw = await kvRequest('get', DASHBOARD_STATE_KEY);
    if (!raw) {
      const seed = createSeedState();
      await saveState(seed);
      return seed;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = createSeedState();
      await saveState(parsed);
      return parsed;
    }

    return normalizeState(parsed);
  }

  async function saveState(state) {
    await kvRequest('set', DASHBOARD_STATE_KEY, JSON.stringify(normalizeState(state)));
  }

  async function updateState(mutator) {
    const current = await loadState();
    const next = await mutator(normalizeState(current));
    const normalized = normalizeState(next);
    await saveState(normalized);
    return normalized;
  }

  return {
    storageType: 'vercel-kv',
    dbFile: null,
    async getCategoriesWithLinks() {
      const state = await loadState();
      return sortByOrderThenName(state.categories).map((category) => ({
        id: category.id,
        name: category.name,
        panel: category.panel,
        sort_order: category.sort_order,
        links: sortByOrderThenName(state.links.filter((link) => link.category_id === category.id)).map((link) => ({
          id: link.id,
          name: link.name,
          url: link.url,
          description: link.description,
          sort_order: link.sort_order
        }))
      }));
    },
    async createCategory(name, panel = 'Work') {
      let createdId = null;
      await updateState(async (state) => {
        if (state.categories.some((cat) => cat.name.toLowerCase() === String(name).toLowerCase())) {
          throw createConstraintError('Kategorie existiert bereits');
        }

        createdId = state.nextCategoryId;
        state.categories.push({
          id: createdId,
          name,
          panel,
          sort_order: state.categories.length
        });
        state.nextCategoryId += 1;
        return state;
      });
      return { id: createdId, changes: 1 };
    },
    async updateCategoryName(id, name) {
      await updateState(async (state) => {
        const existing = state.categories.find((cat) => cat.id === Number(id));
        if (!existing) return state;
        if (state.categories.some((cat) => cat.id !== Number(id) && cat.name.toLowerCase() === String(name).toLowerCase())) {
          throw createConstraintError('Kategorie existiert bereits');
        }
        existing.name = name;
        return state;
      });
      return { changes: 1 };
    },
    async deleteCategory(id) {
      await updateState(async (state) => {
        state.categories = state.categories.filter((cat) => cat.id !== Number(id));
        state.links = state.links.filter((link) => link.category_id !== Number(id));
        return state;
      });
      return { changes: 1 };
    },
    async createLink(name, url, categoryId, description = null) {
      let createdId = null;
      await updateState(async (state) => {
        createdId = state.nextLinkId;
        const sameCategoryLinks = state.links.filter((link) => link.category_id === Number(categoryId));
        state.links.push({
          id: createdId,
          name,
          url,
          category_id: categoryId == null ? null : Number(categoryId),
          description,
          sort_order: sameCategoryLinks.length
        });
        state.nextLinkId += 1;
        return state;
      });
      return { id: createdId, changes: 1 };
    },
    async updateLink(id, name, url, categoryId, description = null) {
      await updateState(async (state) => {
        const link = state.links.find((entry) => entry.id === Number(id));
        if (!link) return state;
        link.name = name;
        link.url = url;
        link.category_id = categoryId == null ? null : Number(categoryId);
        link.description = description;
        return state;
      });
      return { changes: 1 };
    },
    async deleteLink(id) {
      await updateState(async (state) => {
        state.links = state.links.filter((link) => link.id !== Number(id));
        return state;
      });
      return { changes: 1 };
    },
    async setCategoryOrder(id, order) {
      await updateState(async (state) => {
        const category = state.categories.find((entry) => entry.id === Number(id));
        if (category) {
          category.sort_order = Number(order) || 0;
        }
        return state;
      });
      return { changes: 1 };
    },
    async setLinkOrder(id, order, categoryId) {
      await updateState(async (state) => {
        const link = state.links.find((entry) => entry.id === Number(id));
        if (link) {
          link.sort_order = Number(order) || 0;
          link.category_id = categoryId == null ? null : Number(categoryId);
        }
        return state;
      });
      return { changes: 1 };
    }
  };
}

const hasVercelKvConfig = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
);
const store = hasVercelKvConfig ? createVercelKvStore() : createLocalSqliteStore();

module.exports = store;


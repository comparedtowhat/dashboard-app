const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DASHBOARD_STATE_KEY = 'dashboard:data';

function resolveDbFile() {
  const configuredDbFile = process.env.DB_FILE;
  return configuredDbFile
    ? (path.isAbsolute(configuredDbFile)
        ? configuredDbFile
        : path.resolve(__dirname, '..', configuredDbFile))
    : path.resolve(__dirname, '..', 'data.db');
}

function openDatabase(dbFile) {
  return new sqlite3.Database(dbFile);
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function kvRequest(command, ...parts) {
  const apiUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const apiToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!apiUrl || !apiToken) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }

  const response = await fetch(apiUrl.replace(/\/$/, ''), {
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

async function loadSqliteState(dbFile) {
  const db = openDatabase(dbFile);

  try {
    const categories = await all(db, 'SELECT id, name, panel, COALESCE(sort_order, 0) AS sort_order FROM categories ORDER BY sort_order, name');
    const links = await all(db, 'SELECT id, name, url, category_id, description, COALESCE(sort_order, 0) AS sort_order FROM links ORDER BY sort_order, name');

    const nextCategoryRow = await get(db, 'SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM categories');
    const nextLinkRow = await get(db, 'SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM links');

    return {
      nextCategoryId: Number(nextCategoryRow?.nextId || 1),
      nextLinkId: Number(nextLinkRow?.nextId || 1),
      categories: categories.map((cat) => ({
        id: Number(cat.id),
        name: String(cat.name),
        panel: cat.panel || 'Work',
        sort_order: Number(cat.sort_order) || 0
      })),
      links: links.map((link) => ({
        id: Number(link.id),
        name: String(link.name),
        url: String(link.url),
        category_id: link.category_id == null ? null : Number(link.category_id),
        description: link.description == null ? null : String(link.description),
        sort_order: Number(link.sort_order) || 0
      }))
    };
  } finally {
    db.close();
  }
}

async function main() {
  const dbFile = resolveDbFile();
  const state = await loadSqliteState(dbFile);

  await kvRequest('set', DASHBOARD_STATE_KEY, JSON.stringify(state));

  console.log(`SQLite source: ${dbFile}`);
  console.log(`Migrated categories: ${state.categories.length}`);
  console.log(`Migrated links: ${state.links.length}`);
  console.log(`KV key written: ${DASHBOARD_STATE_KEY}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { loadSqliteState, main };

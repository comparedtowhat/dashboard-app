const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { version } = require('./package.json');

const AUTH_COOKIE_NAME = 'dashboard_auth';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) return cookies;
  for (const part of headerValue.split(';')) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function createAuthToken(password) {
  return crypto
    .createHash('sha256')
    .update(`dashboard-auth:${password}`)
    .digest('hex');
}

function safeEqual(left, right) {
  const leftBuf = Buffer.from(String(left));
  const rightBuf = Buffer.from(String(right));
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function buildAuthCookie(token) {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=2592000'
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function buildLogoutCookie() {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function renderLoginPage(errorMessage = '') {
  const errorMarkup = errorMessage
    ? `<p class="error">${escapeHtml(errorMessage)}</p>`
    : '';

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dashboard Login</title>
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0c1217;
      --card: rgba(16, 24, 31, 0.92);
      --border: rgba(255, 255, 255, 0.1);
      --text: #eef4f7;
      --muted: #98a9b5;
      --accent: #d8b36a;
      --danger: #ff8d8d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top, rgba(216, 179, 106, 0.18), transparent 35%),
        linear-gradient(160deg, #0a0f13, #111c24 55%, #0c1217);
      color: var(--text);
      padding: 24px;
    }
    .card {
      width: min(100%, 420px);
      padding: 32px;
      border: 1px solid var(--border);
      border-radius: 22px;
      background: var(--card);
      backdrop-filter: blur(14px);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 2rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    p {
      margin: 0 0 20px;
      color: var(--muted);
      line-height: 1.5;
    }
    .error {
      color: var(--danger);
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 10px;
      font-size: 0.95rem;
      color: var(--muted);
    }
    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      outline: none;
      font: inherit;
      margin-bottom: 14px;
    }
    input:focus {
      border-color: rgba(216, 179, 106, 0.8);
      box-shadow: 0 0 0 4px rgba(216, 179, 106, 0.12);
    }
    button {
      width: 100%;
      border: 0;
      border-radius: 14px;
      padding: 14px 16px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #111;
      background: linear-gradient(135deg, #f0d08f, var(--accent));
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Geschütztes Dashboard</h1>
    <p>Bitte gib das Passwort ein, um auf dein Link-Dashboard zuzugreifen.</p>
    ${errorMarkup}
    <form method="post" action="/login">
      <label for="password">Passwort</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Anmelden</button>
    </form>
  </main>
</body>
</html>`;
}

function createApp() {
  const app = express();
  const dashboardPassword = process.env.DASHBOARD_PASSWORD || '';
  const authEnabled = Boolean(dashboardPassword);
  const expectedAuthToken = authEnabled ? createAuthToken(dashboardPassword) : '';

  app.use(bodyParser.json());

  app.get('/login', (req, res) => {
    if (!authEnabled) {
      return res.redirect('/');
    }
    const cookies = parseCookies(req.headers.cookie);
    if (safeEqual(cookies[AUTH_COOKIE_NAME] || '', expectedAuthToken)) {
      return res.redirect('/');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).type('html').send(renderLoginPage(req.query.error ? 'Falsches Passwort.' : ''));
  });

  app.post('/login', express.urlencoded({ extended: false }), (req, res) => {
    if (!authEnabled) {
      return res.redirect('/');
    }
    const password = String(req.body?.password || '');
    if (!safeEqual(createAuthToken(password), expectedAuthToken)) {
      return res.redirect('/login?error=1');
    }
    res.setHeader('Set-Cookie', buildAuthCookie(expectedAuthToken));
    return res.redirect('/');
  });

  app.post('/api/login', (req, res) => {
    if (!authEnabled) {
      return res.json({ success: true, authEnabled: false });
    }
    const password = String(req.body?.password || '');
    if (!safeEqual(createAuthToken(password), expectedAuthToken)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    res.setHeader('Set-Cookie', buildAuthCookie(expectedAuthToken));
    return res.json({ success: true });
  });

  app.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', buildLogoutCookie());
    res.redirect('/login');
  });

  app.post('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', buildLogoutCookie());
    res.json({ success: true });
  });

  app.use((req, res, next) => {
    if (!authEnabled) return next();
    if (req.path === '/login' || req.path === '/logout' || req.path === '/api/login' || req.path === '/api/logout') {
      return next();
    }

    const cookies = parseCookies(req.headers.cookie);
    const authenticated = safeEqual(cookies[AUTH_COOKIE_NAME] || '', expectedAuthToken);
    if (authenticated) return next();

    res.setHeader('Cache-Control', 'no-store');
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login');
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'protected-index.html'));
  });

  app.get('/app.js', (req, res) => {
    res.type('application/javascript').sendFile(path.join(__dirname, 'public', 'app.js'));
  });

  app.get('/style.css', (req, res) => {
    res.type('text/css').sendFile(path.join(__dirname, 'public', 'style.css'));
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (req, res) => {
    res.status(200).json({
      ok: true,
      version,
      uptime: Math.floor(process.uptime()),
      storage: db.storageType,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/categories', async (req, res) => {
    try {
      const cats = await db.getCategoriesWithLinks();
      res.json(cats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      const { name, panel } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name' });
      const result = await db.createCategory(name, panel || 'Work');
      res.json({ id: result.id, name, panel: panel || 'Work' });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Kategorie existiert bereits' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.deleteCategory(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Missing name' });
      await db.updateCategoryName(id, name);
      res.json({ success: true });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Kategorie existiert bereits' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/reorder/categories', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
      for (let i = 0; i < ids.length; i += 1) {
        await db.setCategoryOrder(ids[i], i);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/reorder/links', async (req, res) => {
    try {
      const { links } = req.body;
      if (!Array.isArray(links)) return res.status(400).json({ error: 'links array required' });
      for (const l of links) {
        const id = Number(l.id);
        const order = Number(l.sort_order) || 0;
        const cat = l.categoryId ? Number(l.categoryId) : null;
        await db.setLinkOrder(id, order, cat);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/links', async (req, res) => {
    try {
      const { name, url, categoryId, description } = req.body;
      if (!name || !url) return res.status(400).json({ error: 'Missing fields' });
      const result = await db.createLink(name, url, categoryId || null, description || null);
      res.json({ id: result.id, name, url, categoryId, description: description || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/links/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, url, categoryId, description } = req.body;
      if (!name || !url) return res.status(400).json({ error: 'Missing fields' });
      await db.updateLink(id, name, url, categoryId || null, description || null);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/links/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.deleteLink(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createApp };

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
const { version } = require('./package.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    version,
    uptime: Math.floor(process.uptime()),
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

// Reorder categories: body { ids: [id1, id2, ...] }
app.post('/api/reorder/categories', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    for (let i = 0; i < ids.length; i++) {
      await db.setCategoryOrder(ids[i], i);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder/move links: body { links: [{id, categoryId, sort_order}, ...] }
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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`SQLite DB: ${db.dbFile}`);
});

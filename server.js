const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const result = await db.createCategory(name);
    res.json({ id: result.id, name });
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

app.post('/api/links', async (req, res) => {
  try {
    const { name, url, categoryId } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Missing fields' });
    const result = await db.createLink(name, url, categoryId || null);
    res.json({ id: result.id, name, url, categoryId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/links/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, url, categoryId } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Missing fields' });
    await db.updateLink(id, name, url, categoryId || null);
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
});

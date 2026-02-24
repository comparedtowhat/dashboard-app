async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json().catch(() => ({}));
}

const categoriesEl = document.getElementById('categories');
const catTemplate = document.getElementById('category-template');
const linkTemplate = document.getElementById('link-template');

async function load() {
  const cats = await api('/categories');
  renderCategories(cats);
}

function renderCategories(cats) {
  categoriesEl.innerHTML = '';
  for (const c of cats) {
    const node = catTemplate.content.cloneNode(true);
    node.querySelector('.cat-name').textContent = c.name;
    const delCatBtn = node.querySelector('.del-cat');
    delCatBtn.addEventListener('click', async () => {
      if (!confirm(`Kategorie "${c.name}" löschen?`)) return;
      await api(`/categories/${c.id}`, 'DELETE');
      load();
    });

    const linksList = node.querySelector('.links-list');
    for (const l of c.links) {
      const ln = linkTemplate.content.cloneNode(true);
      const a = ln.querySelector('.link-anchor');
      a.textContent = l.name;
      a.href = l.url;

      ln.querySelector('.edit-link').addEventListener('click', async () => {
        const newName = prompt('Name', l.name);
        if (newName === null) return;
        const newUrl = prompt('URL', l.url);
        if (newUrl === null) return;
        await api(`/links/${l.id}`, 'PUT', { name: newName.trim(), url: newUrl.trim(), categoryId: c.id });
        load();
      });

      ln.querySelector('.del-link').addEventListener('click', async () => {
        if (!confirm(`Link "${l.name}" löschen?`)) return;
        await api(`/links/${l.id}`, 'DELETE');
        load();
      });

      linksList.appendChild(ln);
    }

    categoriesEl.appendChild(node);
  }
}

document.getElementById('addCategoryBtn').addEventListener('click', async () => {
  const name = prompt('Neue Kategorie:');
  if (!name) return;
  await api('/categories', 'POST', { name: name.trim() });
  load();
});

document.getElementById('addLinkBtn').addEventListener('click', async () => {
  const name = prompt('Link-Name:');
  if (!name) return;
  const url = prompt('URL (mit http/https):');
  if (!url) return;

  // choose category
  const cats = await api('/categories');
  let categoryId = null;
  if (cats.length === 0) {
    const create = confirm('Keine Kategorien vorhanden — neue erstellen?');
    if (create) {
      const cname = prompt('Kategorie-Name:');
      if (!cname) return;
      const res = await api('/categories', 'POST', { name: cname.trim() });
      categoryId = res.id;
    }
  } else {
    const names = cats.map((x, i) => `${i + 1}: ${x.name}`).join('\n');
    const sel = prompt(`Wähle Kategorie:\n${names}\n(Nummer eingeben oder leer für keine)`);
    const idx = parseInt(sel, 10) - 1;
    if (!isNaN(idx) && cats[idx]) categoryId = cats[idx].id;
  }

  await api('/links', 'POST', { name: name.trim(), url: url.trim(), categoryId });
  load();
});

// initial load
load();

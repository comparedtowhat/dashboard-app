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
const panelTabsEl = document.getElementById('panelTabs');
const headerDateTimeEl = document.getElementById('headerDateTime');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const themeButtons = document.querySelectorAll('.theme-toggle .toggle-btn');
const closeSettings = document.getElementById('closeSettings');
const resetSettings = document.getElementById('resetSettings');

// Link modal elements
const linkModal = document.getElementById('linkModal');
const linkForm = document.getElementById('linkForm');
const linkFormTitle = document.getElementById('linkFormTitle');
const linkName = document.getElementById('linkName');
const linkUrl = document.getElementById('linkUrl');
const linkDescription = document.getElementById('linkDescription');
const linkCategory = document.getElementById('linkCategory');
const linkCancel = document.getElementById('linkCancel');
const omSymbolEl = document.getElementById('omSymbol');
const notesPanelEl = document.getElementById('notesPanel');
const notesInputEl = document.getElementById('notesInput');
const clearNotesBtn = document.getElementById('clearNotesBtn');
let editingLinkId = null;

let panels = ['Work', 'My things', 'Yoga'];
let activePanel = localStorage.getItem('activePanel') || 'Work';
let settings = loadSettings();

function updateHeaderDateTime() {
  if (!headerDateTimeEl) return;
  const now = new Date();
  const weekdayRaw = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(now);
  const weekday = weekdayRaw.replace('.', '');
  const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now);
  headerDateTimeEl.textContent = `${weekday} · ${date} · ${time}`;
}

function savePanels() {
  localStorage.setItem('panels', JSON.stringify(panels));
}

function loadPanels() {
  const saved = localStorage.getItem('panels');
  if (saved) {
    panels = JSON.parse(saved);
  }
}

function renderPanelTabs() {
  panelTabsEl.innerHTML = '';
  for (const p of panels) {
    const btn = document.createElement('button');
    btn.className = 'panel-btn' + (p === activePanel ? ' active' : '');
    btn.textContent = p;
    btn.dataset.panel = p;
    btn.draggable = true;
    btn.addEventListener('dragstart', (e) => {
      btn.classList.add('dragging');
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'panel', panel: p }));
      e.dataTransfer.effectAllowed = 'move';
    });
    btn.addEventListener('dragend', () => {
      btn.classList.remove('dragging');
      clearDropIndicators();
    });
    btn.addEventListener('click', () => switchPanel(p));
    panelTabsEl.appendChild(btn);
  }
}

function persistPanelOrder() {
  const ordered = Array.from(panelTabsEl.querySelectorAll('.panel-btn')).map(btn => btn.dataset.panel).filter(Boolean);
  if (ordered.length !== panels.length) return;
  panels = ordered;
  savePanels();
  renderPanelTabs();
}

function switchPanel(panelName) {
  activePanel = panelName;
  localStorage.setItem('activePanel', panelName);
  renderPanelTabs();
  load();
}

function syncPanelsFromCategories(cats) {
  const known = new Set(panels);
  let changed = false;
  for (const c of cats) {
    const panelName = c.panel || 'Work';
    if (!known.has(panelName)) {
      panels.push(panelName);
      known.add(panelName);
      changed = true;
    }
  }
  if (changed) {
    savePanels();
    renderPanelTabs();
  }
}

async function load() {
  try {
    const cats = await api('/categories');
    syncPanelsFromCategories(cats);
    const filtered = cats.filter(c => (c.panel || 'Work') === activePanel);
    renderCategories(filtered);
  } catch (err) {
    console.error('Failed to load categories:', err);
    categoriesEl.innerHTML = '<p style="opacity:.7">Fehler beim Laden der Daten — ist der Server gestartet?</p>';
  }
}

function renderCategories(cats) {
  categoriesEl.innerHTML = '';
  for (const c of cats) {
    const node = catTemplate.content.cloneNode(true);
    const section = node.querySelector('.card');
    section.dataset.id = c.id;
    section.draggable = true;
    const catNameEl = node.querySelector('.cat-name');
    catNameEl.textContent = c.name;
    const renameCatBtn = node.querySelector('.rename-cat');
    renameCatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (catNameEl.querySelector('.cat-rename-input')) return;

      const originalName = c.name;
      let done = false;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cat-rename-input';
      input.value = originalName;
      input.setAttribute('aria-label', 'Kategorie umbenennen');

      catNameEl.classList.add('editing');
      catNameEl.textContent = '';
      catNameEl.appendChild(input);
      input.focus();
      input.select();

      const cleanup = () => {
        catNameEl.classList.remove('editing');
        input.removeEventListener('keydown', onKeyDown);
        input.removeEventListener('blur', onBlur);
      };

      const finish = async (save) => {
        if (done) return;
        done = true;
        cleanup();

        const trimmed = input.value.trim();
        if (!save || !trimmed || trimmed === originalName) {
          catNameEl.textContent = originalName;
          return;
        }

        catNameEl.textContent = trimmed;
        try {
          await api(`/categories/${c.id}`, 'PUT', { name: trimmed });
          await load();
        } catch (err) {
          catNameEl.textContent = originalName;
          alert('Fehler: ' + err.message);
        }
      };

      const onKeyDown = (evt) => {
        evt.stopPropagation();
        if (evt.key === 'Enter') {
          evt.preventDefault();
          finish(true);
          return;
        }
        if (evt.key === 'Escape') {
          evt.preventDefault();
          finish(false);
        }
      };

      const onBlur = () => {
        finish(true);
      };

      input.addEventListener('keydown', onKeyDown);
      input.addEventListener('blur', onBlur);
    });
    const delCatBtn = node.querySelector('.del-cat');
    delCatBtn.addEventListener('click', async () => {
      if (!confirm(`Kategorie "${c.name}" löschen?`)) return;
      await api(`/categories/${c.id}`, 'DELETE');
      load();
    });
    const linksList = node.querySelector('.links-list');
    section.addEventListener('dragstart', (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('.link-item')) {
        return;
      }
      if (target && target.closest && target.closest('button, a, input, textarea, select')) {
        e.preventDefault();
        return;
      }
      section.classList.add('dragging');
      // mark drag as category with id
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'category', id: c.id }));
      e.dataTransfer.effectAllowed = 'move';
    });
    section.addEventListener('dragend', () => {
      section.classList.remove('dragging');
      clearDropIndicators();
    });

    for (const l of c.links) {
      const frag = linkTemplate.content.cloneNode(true);
      const li = frag.querySelector('.link-item');
      li.dataset.id = l.id;
      li.dataset.categoryId = c.id;
      const a = li.querySelector('.link-anchor');
      a.textContent = l.name;
      a.href = l.url;
      const descEl = li.querySelector('.link-desc');
      if (descEl) descEl.textContent = l.description || '';

      // drag handle on link
      const handle = li.querySelector('.link-left');
      handle.addEventListener('dragstart', (e) => {
        li.classList.add('dragging');
        // mark drag as link with id and source category
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'link', id: l.id, fromCategory: c.id }));
        e.dataTransfer.effectAllowed = 'move';
      });
      handle.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        removePlaceholders();
      });

      li.querySelector('.edit-link').addEventListener('click', async () => {
        showLinkModal('edit', { id: l.id, name: l.name, url: l.url, description: l.description || null, categoryId: c.id });
      });

      li.querySelector('.del-link').addEventListener('click', async () => {
        if (!confirm(`Link "${l.name}" löschen?`)) return;
        await api(`/links/${l.id}`, 'DELETE');
        load();
      });

      linksList.appendChild(li);
    }

    // allow dropping links into this list
    linksList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const after = getDragAfterElement(linksList, e.clientY, '.link-item');
      const dragging = document.querySelector('.link-item.dragging');
      if (!dragging) return;
      if (after == null) linksList.appendChild(dragging);
      else linksList.insertBefore(dragging, after);
    });
    linksList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const after = getDragAfterElement(linksList, e.clientY, '.link-item');
      let placeholder = linksList.querySelector('.link-placeholder');
      if (!placeholder) {
        placeholder = document.createElement('li');
        placeholder.className = 'link-placeholder placeholder';
      }
      if (after == null) linksList.appendChild(placeholder);
      else linksList.insertBefore(placeholder, after);
    });

    linksList.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // ensure dropped item was a link
      try {
        const raw = e.dataTransfer.getData('text/plain');
        const data = raw ? JSON.parse(raw) : null;
        if (!data || data.type !== 'link') return;
      } catch (err) {
        // ignore malformed
        return;
      }
      removePlaceholders();
      await persistLinksOrder();
    });

    categoriesEl.appendChild(node);
  }
}

// drag helper for finding insertion point
function getDragAfterElement(container, pointer, selector, axis = 'y') {
  const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)` )];
  for (const child of draggableElements) {
    const box = child.getBoundingClientRect();
    const offset = axis === 'x'
      ? pointer - box.left - box.width / 2
      : pointer - box.top - box.height / 2;
    if (offset < 0) return child;
  }
  return null;
}

// persist category order to server
async function persistCategoryOrder() {
  const ids = Array.from(categoriesEl.querySelectorAll('.card')).map(s => Number(s.dataset.id));
  try {
    await api('/reorder/categories', 'POST', { ids });
    // reload UI to reflect saved order
    await load();
  } catch (err) {
    alert('Fehler beim Speichern der Kategorie-Reihenfolge: ' + err.message);
  }
}

// persist links order and category assignments
async function persistLinksOrder() {
  const links = [];
  const categorySections = categoriesEl.querySelectorAll('.card');
  categorySections.forEach(section => {
    const catId = Number(section.dataset.id);
    const items = section.querySelectorAll('.links-list .link-item');
    Array.from(items).forEach((li, idx) => {
      links.push({ id: Number(li.dataset.id), categoryId: catId, sort_order: idx });
    });
  });
  try {
    await api('/reorder/links', 'POST', { links });
    // reload UI so moved links appear in their new categories
    await load();
  } catch (err) {
    alert('Fehler beim Speichern der Link-Reihenfolge: ' + err.message);
  }
}

window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.error || e.message, e.filename + ':' + e.lineno);
});

function removePlaceholders() {
  document.querySelectorAll('.placeholder').forEach(n => n.remove());
}

function clearDropIndicators() {
  document.querySelectorAll('.dnd-drop-target').forEach(n => n.classList.remove('dnd-drop-target'));
  categoriesEl.classList.remove('dnd-drop-end');
  panelTabsEl.classList.remove('dnd-drop-end');
}

// allow dropping categories
categoriesEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  const after = getDragAfterElement(categoriesEl, e.clientY, '.card');
  const dragging = document.querySelector('.card.dragging');
  if (!dragging) return;
  clearDropIndicators();
  if (after == null) categoriesEl.appendChild(dragging);
  else {
    categoriesEl.insertBefore(dragging, after);
    after.classList.add('dnd-drop-target');
  }
  if (after == null) categoriesEl.classList.add('dnd-drop-end');
});
categoriesEl.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  // only persist category order if a category was dragged
  try {
    const raw = e.dataTransfer.getData('text/plain');
    const data = raw ? JSON.parse(raw) : null;
    if (data && data.type === 'category') {
      await persistCategoryOrder();
    } else if (data && data.type === 'link') {
      // a link was dropped somewhere outside lists — persist links state
      await persistLinksOrder();
    }
  } catch (err) {
    console.warn('Could not parse drag data on categories drop', err);
  } finally {
    clearDropIndicators();
  }
});

// allow dropping panels to reorder
panelTabsEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  const after = getDragAfterElement(panelTabsEl, e.clientX, '.panel-btn', 'x');
  const dragging = panelTabsEl.querySelector('.panel-btn.dragging');
  if (!dragging) return;
  clearDropIndicators();
  if (after == null) panelTabsEl.appendChild(dragging);
  else {
    panelTabsEl.insertBefore(dragging, after);
    after.classList.add('dnd-drop-target');
  }
  if (after == null) panelTabsEl.classList.add('dnd-drop-end');
});

panelTabsEl.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  try {
    const raw = e.dataTransfer.getData('text/plain');
    const data = raw ? JSON.parse(raw) : null;
    if (data && data.type === 'panel') {
      persistPanelOrder();
    }
  } catch (err) {
    console.warn('Could not parse panel drag data', err);
  } finally {
    clearDropIndicators();
  }
});

// Settings
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('ld_settings') || '{}');
    return { theme: s.theme || 'system' };
  } catch (e) {
    return { theme: 'system' };
  }
}

function saveSettings() {
  localStorage.setItem('ld_settings', JSON.stringify(settings));
}

function applySettings() {
  // remove any theme classes first
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  if (settings.theme === 'light') document.documentElement.classList.add('theme-light');
  else if (settings.theme === 'dark') document.documentElement.classList.add('theme-dark');
  else if (settings.theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
  }
  // update toggle buttons
  if (themeButtons && themeButtons.length) {
    themeButtons.forEach(b => b.classList.toggle('active', b.dataset.theme === settings.theme));
    // when settings.theme is 'system', mark the system button active
    if (settings.theme === 'system') {
      themeButtons.forEach(b => b.classList.toggle('active', b.dataset.theme === 'system'));
    }
  }
}

settingsBtn?.addEventListener('click', () => {
  settingsPanel.setAttribute('aria-hidden', 'false');
  settingsPanel.classList.add('open');
});
closeSettings?.addEventListener('click', () => {
  settingsPanel.setAttribute('aria-hidden', 'true');
  settingsPanel.classList.remove('open');
});
if (themeButtons && themeButtons.length) {
  themeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = btn.dataset.theme || 'system';
      settings.theme = t;
      saveSettings();
      applySettings();
    });
  });
}
resetSettings?.addEventListener('click', () => {
  settings = { theme: 'system' };
  saveSettings();
  applySettings();
  load();
});

applySettings();

// react to OS theme changes when user selected 'system'
if (window.matchMedia) {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', () => { if (settings.theme === 'system') applySettings(); });
    } else if (mq && mq.addListener) {
      mq.addListener(() => { if (settings.theme === 'system') applySettings(); });
    }
  } catch (e) { /* ignore */ }
}

// Set size for decorative OM symbol based on distance from top to the header rule.
function setOmSize() {
  try {
    const headerRule = document.querySelector('.header-rule');
    const fallback = 28; // px
    let dist = fallback;
    if (headerRule) {
      const rect = headerRule.getBoundingClientRect();
      dist = Math.max(12, Math.round(rect.top));
    }
    document.documentElement.style.setProperty('--top-to-line', `${dist}px`);
    setNotesPanelBounds();
  } catch (e) {
    // ignore
  }
}

function setNotesPanelBounds() {
  if (!notesPanelEl || !omSymbolEl) return;
  const headerRule = document.querySelector('.header-rule');
  const top = headerRule ? Math.round(headerRule.getBoundingClientRect().bottom + 14) : 120;
  const omTop = Math.round(omSymbolEl.getBoundingClientRect().top);
  const bottomGap = Math.max(120, window.innerHeight - omTop + 10);
  notesPanelEl.style.top = `${top}px`;
  notesPanelEl.style.bottom = `${bottomGap}px`;
}
// initialize and keep in sync on resize/load
setOmSize();
window.addEventListener('resize', setOmSize);
window.addEventListener('load', setOmSize);

// If user provided a raster OM image at /assets/om.png, show it and hide the SVG fallback.
async function tryShowOmImage() {
  const imgEl = document.getElementById('omImage');
  const svgEl = document.getElementById('omSvg');
  if (!imgEl) return;
  try {
    const res = await fetch('/assets/om.png', { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error('no image');
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image')) throw new Error('not-image');
    // show image
    imgEl.style.display = '';
    if (svgEl) svgEl.style.display = 'none';
  } catch (e) {
    // keep SVG visible as fallback
    if (imgEl) imgEl.style.display = 'none';
    if (svgEl) svgEl.style.display = '';
  } finally {
    setNotesPanelBounds();
  }
}
tryShowOmImage();

if (notesInputEl) {
  notesInputEl.value = localStorage.getItem('ld_notes') || '';
  notesInputEl.addEventListener('input', () => {
    localStorage.setItem('ld_notes', notesInputEl.value);
  });
}

clearNotesBtn?.addEventListener('click', () => {
  if (!notesInputEl) return;
  if (!confirm('Notizen wirklich löschen?')) return;
  notesInputEl.value = '';
  localStorage.removeItem('ld_notes');
  notesInputEl.focus();
});

document.getElementById('addCategoryBtn').addEventListener('click', async () => {
  const name = prompt('Neue Kategorie:');
  if (!name) return;
  try {
    await api('/categories', 'POST', { name: name.trim(), panel: activePanel });
    load();
  } catch (err) {
    alert('Fehler: ' + err.message);
  }
});
// open link modal for adding
document.getElementById('addLinkBtn').addEventListener('click', async () => {
  showLinkModal('add');
});

// Modal helper functions
async function populateCategorySelect(selectedId = null) {
  linkCategory.innerHTML = '';
  const cats = await api('/categories');
  const filtered = cats.filter(c => (c.panel || 'Work') === activePanel);
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '— keine —';
  linkCategory.appendChild(emptyOpt);
  for (const c of filtered) {
    const opt = document.createElement('option');
    opt.value = String(c.id);
    opt.textContent = c.name;
    linkCategory.appendChild(opt);
  }
  if (selectedId) linkCategory.value = String(selectedId);
}

function showLinkModal(mode = 'add', link = null) {
  editingLinkId = link && link.id ? link.id : null;
  linkFormTitle.textContent = mode === 'edit' ? 'Link bearbeiten' : 'Neuen Link';
  linkName.value = link && link.name ? link.name : '';
  linkUrl.value = link && link.url ? link.url : '';
  linkDescription.value = link && link.description ? link.description : '';
  populateCategorySelect(link && link.categoryId ? link.categoryId : null).then(() => {
    if (link && link.categoryId) linkCategory.value = String(link.categoryId);
    linkModal.setAttribute('aria-hidden', 'false');
    linkModal.classList.add('open');
    linkName.focus();
  });
}

function closeLinkModal() {
  editingLinkId = null;
  linkForm.reset();
  linkModal.setAttribute('aria-hidden', 'true');
  linkModal.classList.remove('open');
}

linkCancel.addEventListener('click', () => closeLinkModal());

linkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = linkName.value.trim();
  const url = linkUrl.value.trim();
  const description = linkDescription.value.trim() || null;
    const categoryId = linkCategory.value ? Number(linkCategory.value) : null;
    if (!categoryId) {
      alert('Kategorie auswählen');
      linkCategory.focus();
      return;
    }
  try {
    if (editingLinkId) {
      await api(`/links/${editingLinkId}`, 'PUT', { name, url, description, categoryId });
    } else {
      await api('/links', 'POST', { name, url, description, categoryId });
    }
    closeLinkModal();
    await load();
  } catch (err) {
    alert('Fehler: ' + err.message);
  }
});

function isTypingContext(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.closest('input, textarea, select')) return true;
  return !!target.closest('[contenteditable="true"]');
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && linkModal.classList.contains('open')) {
    closeLinkModal();
    return;
  }

  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isTypingContext(e.target)) return;

  if (/^[1-9]$/.test(e.key)) {
    const index = Number(e.key) - 1;
    const panelName = panels[index];
    if (!panelName) return;
    e.preventDefault();
    if (panelName !== activePanel) {
      switchPanel(panelName);
    }
  }
});

document.getElementById('addPanelBtn').addEventListener('click', () => {
  const name = prompt('Neuer Panel-Name:');
  if (!name) return;
  const trimmed = name.trim();
  if (panels.includes(trimmed)) {
    alert('Panel existiert bereits!');
    return;
  }
  panels.push(trimmed);
  savePanels();
  renderPanelTabs();
});

document.getElementById('deletePanelBtn').addEventListener('click', async () => {
  if (panels.length <= 1) {
    alert('Das letzte Panel kann nicht gelöscht werden.');
    return;
  }

  const cats = await api('/categories');
  const panelCats = cats.filter(c => (c.panel || 'Work') === activePanel);
  const msg = panelCats.length > 0
    ? `Panel "${activePanel}" inklusive ${panelCats.length} Kategorien löschen?`
    : `Panel "${activePanel}" löschen?`;

  if (!confirm(msg)) return;

  for (const c of panelCats) {
    await api(`/categories/${c.id}`, 'DELETE');
  }

  const idx = panels.indexOf(activePanel);
  panels = panels.filter(p => p !== activePanel);
  const nextPanel = panels[Math.max(0, Math.min(idx, panels.length - 1))];
  activePanel = nextPanel || 'Work';
  localStorage.setItem('activePanel', activePanel);
  savePanels();
  renderPanelTabs();
  load();
});

// initial load
updateHeaderDateTime();
setInterval(updateHeaderDateTime, 1000);
loadPanels();
renderPanelTabs();
load();

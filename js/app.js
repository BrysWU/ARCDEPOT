// Complete app.js for Arc Raiders Data Explorer
// This script fetches JSON files from the RaidTheory/arcraiders-data repo and renders an interactive viewer.

const RAW_BASE = 'https://raw.githubusercontent.com/RaidTheory/arcraiders-data/main/';

const state = {
  datasetFile: 'projects.json',
  rawData: null,
  items: [],
  page: 1,
  pageSize: 40,
  filteredItems: [],
  selectedItem: null
};

const els = {
  dataset: document.getElementById('dataset'),
  search: document.getElementById('search'),
  filterKey: document.getElementById('filterKey'),
  filterValue: document.getElementById('filterValue'),
  reload: document.getElementById('reload'),
  clearFilters: document.getElementById('clearFilters'),
  itemsList: document.getElementById('itemsList'),
  detailPane: document.getElementById('detailPane'),
  detailTitle: document.getElementById('detailTitle'),
  detailBody: document.getElementById('detailBody'),
  rawJson: document.getElementById('rawJson'),
  datasetInfo: document.getElementById('datasetInfo'),
  listMeta: document.getElementById('listMeta'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageInfo: document.getElementById('pageInfo'),
  repoLink: document.getElementById('repoLink'),
  detailLinks: document.getElementById('detailLinks')
};

function init() {
  // wire events
  els.dataset.addEventListener('change', onDatasetChange);
  els.search.addEventListener('input', applyFilters);
  els.filterKey.addEventListener('input', applyFilters);
  els.filterValue.addEventListener('input', applyFilters);
  els.reload.addEventListener('click', () => loadDataset(true));
  els.clearFilters.addEventListener('click', clearFilters);
  els.prevPage.addEventListener('click', () => changePage(-1));
  els.nextPage.addEventListener('click', () => changePage(1));

  // initial load
  loadDataset();
}

function onDatasetChange(e) {
  state.datasetFile = e.target.value;
  state.page = 1;
  loadDataset();
}

async function loadDataset(force = false) {
  const url = RAW_BASE + state.datasetFile;
  els.datasetInfo.textContent = `Loading ${state.datasetFile} ...`;
  try {
    const resp = await fetch(url, {cache: 'no-cache'});
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`);
    const data = await resp.json();
    state.rawData = data;
    state.items = normalizeDataToArray(data);
    state.filteredItems = state.items.slice();
    els.datasetInfo.textContent = `${state.datasetFile} — ${state.items.length.toLocaleString()} entries`;
    state.page = 1;
    renderList();
    clearSelection();
  } catch (err) {
    els.datasetInfo.textContent = `Error loading ${state.datasetFile}: ${err.message}`;
    state.rawData = null;
    state.items = [];
    state.filteredItems = [];
    renderList();
  }
}

function normalizeDataToArray(data) {
  // Projects and many files are often an object keyed by id; convert to array but preserve keys where possible
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // If object with numeric keys or named keys, produce array with { _key, ...value}
    return Object.entries(data).map(([k, v]) => {
      if (v && typeof v === 'object') {
        return Object.assign({_key: k}, v);
      }
      // primitive -> wrap
      return {_key: k, value: v};
    });
  }
  return [];
}

function applyFilters() {
  const q = (els.search.value || '').trim().toLowerCase();
  const fk = (els.filterKey.value || '').trim();
  const fv = (els.filterValue.value || '').trim().toLowerCase();

  state.filteredItems = state.items.filter(item => {
    // search by name or id or key
    const candidate = (getBestTitle(item) + ' ' + (item._key || '') + ' ' + JSON.stringify(item)).toLowerCase();
    if (q && !candidate.includes(q)) return false;

    if (fk && fv) {
      const val = deepFind(item, fk);
      if (val === undefined || String(val).toLowerCase().indexOf(fv) === -1) return false;
    }
    return true;
  });

  state.page = 1;
  renderList();
}

function deepFind(obj, keyPath) {
  try {
    const parts = keyPath.split('.');
    let cur = obj;
    for (const p of parts) {
      if (!cur) return undefined;
      cur = cur[p];
    }
    return cur;
  } catch {
    return undefined;
  }
}

function getBestTitle(item) {
  if (!item) return '';
  return (item.name || item.title || item.id || item._key || item.key || '').toString();
}

function renderList() {
  els.itemsList.innerHTML = '';
  const total = state.filteredItems.length;
  const start = (state.page - 1) * state.pageSize;
  const pageItems = state.filteredItems.slice(start, start + state.pageSize);

  els.listMeta.textContent = `${total.toLocaleString()} entries`;
  els.pageInfo.textContent = `Page ${state.page} — showing ${Math.min(total, start + 1)}–${Math.min(total, start + pageItems.length)} of ${total}`;

  if (total === 0) {
    els.itemsList.innerHTML = '<li class="empty">No items</li>';
    return;
  }

  for (const it of pageItems) {
    const li = document.createElement('li');
    li.className = 'item-row';
    li.tabIndex = 0;
    const title = getBestTitle(it) || '(no title)';
    li.innerHTML = `<span class="item-title">${escapeHtml(title)}</span>
                    <span class="item-key">${escapeHtml(it._key || it.id || '')}</span>`;
    li.addEventListener('click', () => showDetail(it));
    li.addEventListener('keypress', (e) => { if (e.key === 'Enter') showDetail(it); });
    els.itemsList.appendChild(li);
  }
}

function changePage(delta) {
  const totalPages = Math.max(1, Math.ceil(state.filteredItems.length / state.pageSize));
  state.page = Math.min(totalPages, Math.max(1, state.page + delta));
  renderList();
}

function showDetail(item) {
  state.selectedItem = item;
  els.detailTitle.textContent = getBestTitle(item) || (item._key || 'Unknown item');
  els.rawJson.textContent = JSON.stringify(item, null, 2);
  els.detailLinks.innerHTML = '';

  // add link to raw entry on GitHub (best-effort)
  if (item._key) {
    const rawUrl = `https://github.com/RaidTheory/arcraiders-data/blob/main/${state.datasetFile}`;
    const direct = document.createElement('a');
    direct.href = rawUrl;
    direct.target = '_blank';
    direct.rel = 'noopener';
    direct.textContent = 'Open dataset on GitHub';
    els.detailLinks.appendChild(direct);
  }

  // Clear detail body and build structured sections
  const container = document.createElement('div');
  container.className = 'detail-structured';

  // 1) Basic info table (id/key, category, tier, rarity)
  const basic = buildBasicInfoTable(item);
  if (basic) container.appendChild(basic);

  // 2) Stats table
  const stats = buildStatsSection(item);
  if (stats) container.appendChild(stats);

  // 3) Blueprint / recipe
  const bp = buildBlueprintSection(item);
  if (bp) container.appendChild(bp);

  // 4) Drops / locations / spawn info
  const drops = buildLocationsSection(item);
  if (drops) container.appendChild(drops);

  // 5) Map representation (if maps data is loaded into rawData and item references a map)
  const mapSection = buildMapReferenceSection(item);
  if (mapSection) container.appendChild(mapSection);

  // 6) Fallback: show entire object keys for further exploration
  const keysDiv = document.createElement('div');
  keysDiv.className = 'section';
  keysDiv.innerHTML = `<h3>Fields</h3><p class="muted">Top-level keys on this entry: ${Object.keys(item).join(', ')}</p>`;
  container.appendChild(keysDiv);

  els.detailBody.innerHTML = '';
  els.detailBody.appendChild(container);
  // open the raw panel (not expanded automatically; user can toggle)
  // scroll to top of detail pane
  els.detailPane.scrollIntoView({behavior: 'smooth'});
}

function clearSelection() {
  state.selectedItem = null;
  els.detailTitle.textContent = 'Select an item';
  els.rawJson.textContent = '';
  els.detailBody.innerHTML = '<p class="hint">Choose an entry from the list to view structured details. The viewer attempts to detect stats, blueprints/recipes, locations/drops and maps.</p>';
  els.detailLinks.innerHTML = '';
}

/* Build helper sections --------------------------------- */

function buildBasicInfoTable(item) {
  const keys = ['id', 'name', 'title', '_key', 'category', 'type', 'rarity', 'tier', 'level', 'quality'];
  const present = keys.filter(k => deepFind(item, k) !== undefined);
  if (present.length === 0) return null;
  const div = document.createElement('div');
  div.className = 'section';
  div.innerHTML = '<h3>Basic Info</h3>';
  const table = document.createElement('table');
  table.className = 'info-table';
  for (const k of present) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.className = 'key';
    td1.textContent = k;
    const td2 = document.createElement('td');
    td2.className = 'value';
    td2.textContent = String(deepFind(item, k));
    tr.appendChild(td1);
    tr.appendChild(td2);
    table.appendChild(tr);
  }
  div.appendChild(table);
  return div;
}

function buildStatsSection(item) {
  // Common patterns: 'stats', 'attributes', 'properties', 'modifiers'
  const candidates = ['stats', 'attributes', 'properties', 'modifiers', 'statList'];
  let statsObj = null;
  for (const c of candidates) {
    const v = deepFind(item, c);
    if (v && typeof v === 'object') {
      statsObj = v;
      break;
    }
  }
  // Also sometimes top-level numeric fields exist, collect numeric top-level props
  const numericTopLevel = Object.entries(item)
    .filter(([k, v]) => (typeof v === 'number'))
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
  if (!statsObj && Object.keys(numericTopLevel).length === 0) return null;

  const div = document.createElement('div');
  div.className = 'section';
  div.innerHTML = '<h3>Stats</h3>';

  const table = document.createElement('table');
  table.className = 'stats-table';

  const statsToShow = statsObj && typeof statsObj === 'object' ? statsObj : numericTopLevel;
  // If statsToShow is an array, convert to object
  const finalStats = Array.isArray(statsToShow) ? arrayToKeyValue(statsToShow) : statsToShow;

  for (const [k, v] of Object.entries(finalStats)) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.className = 'key'; td1.textContent = k;
    const td2 = document.createElement('td'); td2.className = 'value'; td2.textContent = typeof v === 'object' ? JSON.stringify(v) : v;
    tr.appendChild(td1); tr.appendChild(td2);
    table.appendChild(tr);
  }
  div.appendChild(table);
  return div;
}

function arrayToKeyValue(arr) {
  const out = {};
  for (const el of arr) {
    if (el && typeof el === 'object') {
      if (el.name && (el.value !== undefined)) out[el.name] = el.value;
      else {
        const k = Object.keys(el)[0];
        out[k] = el[k];
      }
    }
  }
  return out;
}

function buildBlueprintSection(item) {
  // Common keys for recipe/blueprint: 'blueprint', 'recipe', 'ingredients', 'materials', 'requires'
  const keys = ['blueprint', 'recipe', 'ingredients', 'materials', 'requires', 'requirements'];
  for (const k of keys) {
    const v = deepFind(item, k);
    if (v && (Array.isArray(v) || typeof v === 'object')) {
      const div = document.createElement('div');
      div.className = 'section';
      div.innerHTML = `<h3>Blueprint / Recipe (${k})</h3>`;
      const list = document.createElement('ul');
      list.className = 'bp-list';

      // v might be an object with counts or an array of entries
      if (Array.isArray(v)) {
        for (const el of v) {
          list.appendChild(bpListItem(el));
        }
      } else if (typeof v === 'object') {
        // If object keys -> quantity
        for (const [name, qty] of Object.entries(v)) {
          list.appendChild(bpListItem({name, qty}));
        }
      }
      div.appendChild(list);
      return div;
    }
  }
  return null;
}

function bpListItem(el) {
  const li = document.createElement('li');
  let name = '';
  let qty = '';
  if (el && typeof el === 'object') {
    name = el.name || el.id || el.item || Object.keys(el)[0];
    qty = el.qty || el.quantity || el.count || el.q || el[Object.keys(el)[0]] || '';
  } else {
    name = String(el);
  }
  li.textContent = `${qty ? qty + ' × ' : ''}${name}`;
  return li;
}

function buildLocationsSection(item) {
  // Look for 'drops', 'locations', 'spawnLocations', 'spawn', 'foundIn', 'droppedBy'
  const keys = ['drops', 'locations', 'spawnLocations', 'spawn', 'foundIn', 'droppedBy', 'loot', 'lootTable', 'dropLocations'];
  for (const k of keys) {
    const v = deepFind(item, k);
    if (v) {
      const div = document.createElement('div');
      div.className = 'section';
      div.innerHTML = `<h3>Locations / Drops (${k})</h3>`;
      if (Array.isArray(v)) {
        const ul = document.createElement('ul');
        for (const el of v) {
          const li = document.createElement('li');
          li.textContent = typeof el === 'object' ? JSON.stringify(el) : String(el);
          ul.appendChild(li);
        }
        div.appendChild(ul);
      } else if (typeof v === 'object') {
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(v, null, 2);
        div.appendChild(pre);
      } else {
        const p = document.createElement('p');
        p.textContent = String(v);
        div.appendChild(p);
      }
      return div;
    }
  }
  return null;
}

function buildMapReferenceSection(item) {
  // If an item references a map id or coordinates, try to show context by looking up maps.json (if user selected maps)
  if (!state.rawData) return null;
  // detect map id or mapName fields
  const mapKeys = ['map', 'mapId', 'mapName', 'location', 'zone'];
  for (const k of mapKeys) {
    const v = deepFind(item, k);
    if (v) {
      // attempt to load maps.json if available (we don't re-fetch, rely on user dataset toggle)
      // if the currently-loaded dataset is maps.json, use it; otherwise try to fetch maps.json separately (best-effort)
      return buildInlineMapPreview(v);
    }
  }
  return null;
}

function buildInlineMapPreview(mapRefValue) {
  // Try to fetch maps.json once and cache
  // We'll fetch maps.json even if not currently selected, so we can display map names and details
  // Keep a small cache on window
  if (!window.__mapsCachePromise) {
    window.__mapsCachePromise = fetch(RAW_BASE + 'maps.json').then(r => r.ok ? r.json() : null).catch(() => null);
  }
  const div = document.createElement('div');
  div.className = 'section';
  div.innerHTML = `<h3>Map Reference</h3><p>Referenced: <em>${escapeHtml(String(mapRefValue))}</em></p><div id="mapPreviewArea">Loading map info…</div>`;
  window.__mapsCachePromise.then(mapsData => {
    const area = div.querySelector('#mapPreviewArea');
    if (!mapsData) {
      area.textContent = 'maps.json not available or failed to load.';
      return;
    }
    // normalize to array
    const arr = Array.isArray(mapsData) ? mapsData : Object.values(mapsData || {});
    // Try to match by id/name
    const match = arr.find(m => {
      return (m.id && String(m.id) === String(mapRefValue)) ||
             (m.name && String(m.name).toLowerCase() === String(mapRefValue).toLowerCase()) ||
             (m.key && String(m.key) === String(mapRefValue));
    }) || arr.find(m => String(m.name).toLowerCase().includes(String(mapRefValue).toLowerCase()));
    if (!match) {
      area.textContent = 'No exact map match found. Showing first few maps:';
      const ul = document.createElement('ul');
      for (const m of arr.slice(0, 8)) {
        const li = document.createElement('li');
        li.textContent = `${m.name || m.id || m.key || '(unknown)'} — ${m.description || ''}`;
        ul.appendChild(li);
      }
      area.appendChild(ul);
      return;
    }
    // render brief map info
    const mdiv = document.createElement('div');
    mdiv.className = 'map-card';
    mdiv.innerHTML = `<strong>${escapeHtml(match.name || match.id || match.key)}</strong>
                      <p class="muted">${escapeHtml(match.description || '')}</p>
                      <pre>${escapeHtml(JSON.stringify(match, null, 2))}</pre>`;
    area.innerHTML = '';
    area.appendChild(mdiv);
  });
  return div;
}

/* Utility helpers -------------------------------------- */

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"'`]/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'}[c];
  });
}

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function buildTableFromObject(obj) {
  const table = document.createElement('table');
  for (const [k, v] of Object.entries(obj)) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.className = 'key'; td1.textContent = k;
    const td2 = document.createElement('td'); td2.className = 'value'; td2.textContent = typeof v === 'object' ? JSON.stringify(v) : String(v);
    tr.appendChild(td1); tr.appendChild(td2);
    table.appendChild(tr);
  }
  return table;
}

function arrayShallowToObj(arr) {
  const out = {};
  for (const el of arr) {
    if (typeof el === 'object' && el !== null) {
      const k = el.name || el.id || Object.keys(el)[0];
      const v = el.value || el.qty || el.quantity || el.count || el[k] || el;
      out[k] = v;
    }
  }
  return out;
}

document.addEventListener('DOMContentLoaded', init);
/* Full client-side app for Arc Raiders Tracker */
/* Loads data from RaidTheory/arcraiders-data raw files, renders map markers,
   results list, detailed item view, and a questline viewer. */

const RAW_BASE = 'https://raw.githubusercontent.com/RaidTheory/arcraiders-data/main/';

const DOM = {
  datasetSelect: document.getElementById('datasetSelect'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  reloadBtn: document.getElementById('reloadBtn'),
  clearBtn: document.getElementById('clearBtn'),
  resultsList: document.getElementById('resultsList'),
  resultsCount: document.getElementById('resultsCount'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  pageIndicator: document.getElementById('pageIndicator'),
  mapElement: document.getElementById('map'),
  cardTitle: document.getElementById('cardTitle'),
  cardMeta: document.getElementById('cardMeta'),
  detailTitle: document.getElementById('detailTitle'),
  detailContent: document.getElementById('detailContent'),
  rawData: document.getElementById('rawData'),
  importDataBtn: document.getElementById('importDataBtn'),
  fileInput: document.getElementById('fileInput'),
  openRepo: document.getElementById('openRepo'),
  showQuestViewerBtn: document.getElementById('showQuestViewer'),
  questModal: document.getElementById('questModal'),
  questArea: document.getElementById('questArea'),
  closeQuestModal: document.getElementById('closeQuestModal'),
  importQuestsBtn: document.getElementById('importQuestsBtn'),
  markerClusterToggle: document.getElementById('markerClusterToggle'),
  zoomAllBtn: document.getElementById('zoomAll'),
  toggleGridBtn: document.getElementById('toggleGrid'),
  toggleMapBtn: document.getElementById('toggleMap')
};

let state = {
  datasetFile: DOM.datasetSelect.value,
  rawData: null,
  items: [],
  filtered: [],
  page: 1,
  pageSize: 30,
  selected: null,
  markers: [],
  mapsIndex: null,
  quests: null
};

// Initialize map
const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let markerCluster = L.markerClusterGroup();
if (DOM.markerClusterToggle.checked) {
  markersLayer = markerCluster;
  markerCluster.addTo(map);
}

function setClusterEnabled(enabled) {
  if (enabled) {
    if (!map.hasLayer(markerCluster)) map.addLayer(markerCluster);
  } else {
    if (map.hasLayer(markerCluster)) map.removeLayer(markerCluster);
    // ensure a plain LayerGroup exists for use
    markersLayer = L.layerGroup();
    markersLayer.addTo(map);
  }
}

// Wire UI events
DOM.datasetSelect.addEventListener('change', onDatasetChange);
DOM.searchInput.addEventListener('input', applyFilters);
DOM.typeFilter.addEventListener('input', applyFilters);
DOM.reloadBtn.addEventListener('click', () => loadDataset(true));
DOM.clearBtn.addEventListener('click', clearFilters);
DOM.prevBtn.addEventListener('click', () => changePage(-1));
DOM.nextBtn.addEventListener('click', () => changePage(1));
DOM.importDataBtn.addEventListener('click', () => DOM.fileInput.click());
DOM.fileInput.addEventListener('change', handleLocalFile);
DOM.showQuestViewerBtn.addEventListener('click', openQuestModal);
DOM.closeQuestModal.addEventListener('click', closeQuestModal);
DOM.importQuestsBtn.addEventListener('click', () => DOM.fileInput.click());
DOM.markerClusterToggle.addEventListener('change', (e) => {
  setClusterEnabled(e.target.checked);
  renderMarkers();
});
DOM.zoomAllBtn.addEventListener('click', zoomToMarkers);
DOM.toggleGridBtn.addEventListener('click', () => alert('Grid view: Coming soon — will show card-grid of items.'));
DOM.toggleMapBtn.addEventListener('click', () => map.invalidateSize());

// Initial load
loadDataset();

async function loadDataset(force = false) {
  const file = DOM.datasetSelect.value;
  state.datasetFile = file;
  DOM.resultsCount.textContent = `Loading ${file}...`;
  try {
    const res = await fetch(RAW_BASE + file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = await res.json();
    state.rawData = json;
    state.items = normalizeToArray(json);
    state.filtered = state.items.slice();
    state.page = 1;
    DOM.resultsCount.textContent = `${state.items.length.toLocaleString()} entries`;
    // prefetch maps.json for map meta
    if (!state.mapsIndex) {
      try {
        const mapsRes = await fetch(RAW_BASE + 'maps.json');
        if (mapsRes.ok) {
          const mapsJson = await mapsRes.json();
          state.mapsIndex = normalizeToArray(mapsJson);
        }
      } catch (e) { /* ignore */ }
    }
    renderList();
    renderMarkers();
    clearDetail();
  } catch (err) {
    DOM.resultsCount.textContent = `Failed to load ${file}: ${err.message}`;
    state.rawData = null;
    state.items = [];
    state.filtered = [];
    renderList();
    renderMarkers();
  }
}

function normalizeToArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    return Object.entries(data).map(([k, v]) => {
      if (v && typeof v === 'object') {
        return Object.assign({ _key: k }, v);
      }
      return { _key: k, value: v };
    });
  }
  return [];
}

function applyFilters() {
  const q = (DOM.searchInput.value || '').trim().toLowerCase();
  const t = (DOM.typeFilter.value || '').trim().toLowerCase();
  state.filtered = state.items.filter(it => {
    // search in name, title, id, key or JSON
    const title = (it.name || it.title || it.id || it._key || '').toString().toLowerCase();
    if (q && !title.includes(q) && JSON.stringify(it).toLowerCase().indexOf(q) === -1) return false;
    if (t) {
      // look for type/category fields
      const category = (it.type || it.category || it.tag || '').toString().toLowerCase();
      if (!category.includes(t) && JSON.stringify(it).toLowerCase().indexOf(t) === -1) return false;
    }
    return true;
  });
  state.page = 1;
  renderList();
  renderMarkers();
}

function renderList() {
  DOM.resultsList.innerHTML = '';
  const total = state.filtered.length;
  const start = (state.page - 1) * state.pageSize;
  const pageItems = state.filtered.slice(start, start + state.pageSize);
  DOM.pageIndicator.textContent = `Page ${state.page} — ${start + 1}–${Math.min(total, start + pageItems.length)} of ${total}`;
  if (total === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No results';
    DOM.resultsList.appendChild(li);
    return;
  }
  for (const item of pageItems) {
    const li = document.createElement('li');
    const name = item.name || item.title || item.id || item._key || '(untitled)';
    li.innerHTML = `<div><strong>${escapeHtml(name)}</strong><div class="small muted">${escapeHtml(item._key || '')}</div></div>`;
    li.addEventListener('click', () => showDetail(item));
    DOM.resultsList.appendChild(li);
  }
}

function changePage(delta) {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(totalPages, Math.max(1, state.page + delta));
  renderList();
}

function clearFilters() {
  DOM.searchInput.value = '';
  DOM.typeFilter.value = '';
  state.filtered = state.items.slice();
  state.page = 1;
  renderList();
  renderMarkers();
}

function showDetail(item) {
  state.selected = item;
  DOM.detailTitle.textContent = item.name || item.title || item._key || (item.id || 'Item');
  DOM.rawData.textContent = JSON.stringify(item, null, 2);
  DOM.detailContent.innerHTML = '';
  DOM.cardTitle.textContent = item.name || item.title || item._key || 'Selected';

  // basic info
  const basic = document.createElement('div');
  basic.className = 'section';
  basic.innerHTML = '<h3>Basic</h3>';
  const table = document.createElement('table');
  table.className = 'info-table';
  const fields = ['_key', 'id', 'name', 'title', 'type', 'category', 'rarity', 'tier', 'level'];
  for (const f of fields) {
    const val = deepFind(item, f);
    if (val !== undefined) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.className = 'key'; td1.textContent = f;
      const td2 = document.createElement('td'); td2.className = 'value'; td2.textContent = typeof val === 'object' ? JSON.stringify(val) : String(val);
      tr.appendChild(td1); tr.appendChild(td2); table.appendChild(tr);
    }
  }
  basic.appendChild(table);
  DOM.detailContent.appendChild(basic);

  // stats
  const statsSection = buildStatsSection(item);
  if (statsSection) DOM.detailContent.appendChild(statsSection);

  // blueprint
  const bpSection = buildBlueprintSection(item);
  if (bpSection) DOM.detailContent.appendChild(bpSection);

  // drops/locations
  const locs = buildLocationsSection(item);
  if (locs) DOM.detailContent.appendChild(locs);

  // links
  const linkDiv = document.createElement('div');
  linkDiv.className = 'section';
  linkDiv.innerHTML = `<h3>Links</h3><p class="small muted">Open dataset file on GitHub: <a href="https://github.com/RaidTheory/arcraiders-data/blob/main/${state.datasetFile}" target="_blank" rel="noopener">${state.datasetFile}</a></p>`;
  DOM.detailContent.appendChild(linkDiv);

  // zoom marker if present
  if (hasCoordinates(item)) {
    const c = extractCoordinates(item);
    if (c) {
      map.panTo([c.lat, c.lng]);
      map.setZoom(10);
    }
  }
}

function clearDetail() {
  state.selected = null;
  DOM.detailTitle.textContent = 'No item selected';
  DOM.detailContent.innerHTML = '<p class="muted">Select an item in the list or on the map to view details.</p>';
  DOM.rawData.textContent = '';
  DOM.cardTitle.textContent = 'Select a marker or item';
  DOM.cardMeta.textContent = '';
}

/* MARKERS & MAP */

function renderMarkers() {
  // Clear existing
  if (markerCluster && markerCluster.clearLayers) markerCluster.clearLayers();
  markersLayer.clearLayers();

  const list = state.filtered;
  state.markers = [];

  for (const item of list) {
    const coords = extractCoordinates(item);
    let marker = null;
    if (coords) {
      const icon = createIconForItem(item);
      marker = L.marker([coords.lat, coords.lng], { icon });
      marker.bindPopup(popupHtmlForItem(item));
      marker.on('click', () => { showDetail(item); });
    } else {
      // If item references a map but no coords, try to use map center
      const mapRef = findMapReference(item);
      if (mapRef && state.mapsIndex) {
        const m = findMapByRef(mapRef);
        if (m && (m.center || m.location || m.coords)) {
          const center = m.center || m.location || m.coords;
          const parsed = extractCoordinates(center);
          if (parsed) {
            const icon = createIconForItem(item);
            marker = L.marker([parsed.lat, parsed.lng], { icon });
            marker.bindPopup(popupHtmlForItem(item));
            marker.on('click', () => { showDetail(item); });
          }
        }
      }
    }
    if (marker) {
      state.markers.push(marker);
      if (DOM.markerClusterToggle.checked) markerCluster.addLayer(marker);
      else markersLayer.addLayer(marker);
    }
  }

  // If no markers, show a gentle center
  if (state.markers.length > 0) map.fitBounds(L.featureGroup(state.markers).getBounds().pad(0.2));
}

function popupHtmlForItem(item) {
  const name = escapeHtml(item.name || item.title || item._key || item.id || 'Item');
  const k = escapeHtml(item._key || item.id || '');
  const type = escapeHtml(item.type || item.category || '');
  return `<div style="min-width:180px"><strong>${name}</strong><div class="small muted">${k} ${type ? ' • ' + type : ''}</div><div style="margin-top:6px"><button class="btn small" onclick="window.__app_showDetailFromPopup('${encodeURIComponent(JSON.stringify(item))}')">Open</button></div></div>`;
}

// Bridge function to open from popup's inline onclick (we encode item JSON)
window.__app_showDetailFromPopup = (encoded) => {
  try {
    const item = JSON.parse(decodeURIComponent(encoded));
    showDetail(item);
  } catch (e) { console.warn('failed to open popup item', e); }
};

function createIconForItem(item) {
  // Use different colors for weapon, blueprint, quest, map features, default
  const type = (item.type || item.category || '').toString().toLowerCase();
  let color = '#6fb3ff';
  if (type.includes('weapon')) color = '#ff8a8a';
  if (type.includes('blueprint') || type.includes('recipe') || type.includes('project')) color = '#ffd26b';
  if (type.includes('quest')) color = '#9b6bff';
  if (type.includes('bot')) color = '#7ee7b7';
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="10" fill="${color}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/></svg>`);
  return L.icon({
    iconUrl: `data:image/svg+xml;utf8,${svg}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
}

/* COORDINATE EXTRACTION HEURISTICS */

function hasCoordinates(obj) {
  return !!extractCoordinates(obj);
}

function extractCoordinates(obj) {
  if (!obj) return null;
  // If obj itself has lat/lng
  if (typeof obj.lat === 'number' && typeof obj.lng === 'number') return { lat: obj.lat, lng: obj.lng };
  if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number') return { lat: obj.latitude, lng: obj.longitude };
  if (typeof obj.x === 'number' && typeof obj.y === 'number') return { lat: obj.y, lng: obj.x }; // assume x=lng, y=lat
  // If obj has coords array like [x,y] or [lat,lng]
  if (Array.isArray(obj) && obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
    return { lat: obj[1], lng: obj[0] };
  }
  // If the top-level item has position/coords fields
  const paths = ['position', 'pos', 'coords', 'location', 'spawn'];
  for (const p of paths) {
    const v = deepFind(obj, p);
    if (v) {
      const parsed = extractCoordinates(v);
      if (parsed) return parsed;
    }
  }
  // Some items may use 'mapX' 'mapY' or 'x','y'
  if (obj.mapX !== undefined && obj.mapY !== undefined) {
    return { lat: obj.mapY, lng: obj.mapX };
  }
  if (obj.x !== undefined && obj.y !== undefined && typeof obj.x === 'number' && typeof obj.y === 'number') {
    return { lat: obj.y, lng: obj.x };
  }
  // If object contains nested fields with coords as strings like "12.34,56.78"
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (typeof val === 'string' && val.includes(',') && val.split(',').length === 2) {
      const parts = val.split(',').map(s => parseFloat(s.trim())).filter(n => !Number.isNaN(n));
      if (parts.length === 2) return { lat: parts[0], lng: parts[1] };
    }
  }
  return null;
}

/* MAP LOOKUP HELPERS */

function findMapReference(item) {
  const keys = ['map', 'mapId', 'mapName', 'zone', 'area', 'locationMap'];
  for (const k of keys) {
    const v = deepFind(item, k);
    if (v) return v;
  }
  return null;
}

function findMapByRef(ref) {
  if (!state.mapsIndex) return null;
  const r = String(ref).toLowerCase();
  return state.mapsIndex.find(m => (m.name && String(m.name).toLowerCase() === r) || (m.id && String(m.id).toLowerCase() === r) || (m.key && String(m.key).toLowerCase() === r));
}

/* STATS, BLUEPRINTS, LOCATIONS RENDERERS */

function buildStatsSection(item) {
  const candidates = ['stats', 'attributes', 'properties', 'modifiers'];
  let stats = null;
  for (const c of candidates) {
    const v = deepFind(item, c);
    if (v && typeof v === 'object') {
      stats = v;
      break;
    }
  }
  // Also include numeric top-level props
  const numeric = Object.entries(item).filter(([k, v]) => typeof v === 'number').reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
  if (!stats && Object.keys(numeric).length === 0) return null;
  const sec = document.createElement('div'); sec.className = 'section'; sec.innerHTML = '<h3>Stats</h3>';
  const table = document.createElement('table'); table.className = 'stats-table';
  const target = stats || numeric;
  const entries = Array.isArray(target) ? arrayToKeyValue(target) : target;
  for (const [k, v] of Object.entries(entries)) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.className = 'key'; td1.textContent = k;
    const td2 = document.createElement('td'); td2.className = 'value'; td2.textContent = typeof v === 'object' ? JSON.stringify(v) : String(v);
    tr.appendChild(td1); tr.appendChild(td2); table.appendChild(tr);
  }
  sec.appendChild(table);
  return sec;
}

function arrayToKeyValue(arr) {
  const out = {};
  for (const el of arr) {
    if (el && typeof el === 'object') {
      if (el.name && el.value !== undefined) out[el.name] = el.value;
      else {
        const k = Object.keys(el)[0];
        out[k] = el[k];
      }
    }
  }
  return out;
}

function buildBlueprintSection(item) {
  const keys = ['blueprint', 'recipe', 'ingredients', 'materials', 'requires', 'requirements', 'components'];
  for (const k of keys) {
    const v = deepFind(item, k);
    if (v && (Array.isArray(v) || typeof v === 'object')) {
      const sec = document.createElement('div'); sec.className = 'section'; sec.innerHTML = `<h3>Blueprint / Recipe — ${k}</h3>`;
      const ul = document.createElement('ul'); ul.className = 'small';
      if (Array.isArray(v)) {
        for (const el of v) ul.appendChild(bpListItem(el));
      } else {
        for (const [name, qty] of Object.entries(v)) {
          const li = document.createElement('li'); li.textContent = `${qty} × ${name}`; ul.appendChild(li);
        }
      }
      sec.appendChild(ul);
      return sec;
    }
  }
  return null;
}

function bpListItem(el) {
  const li = document.createElement('li');
  if (typeof el === 'string') li.textContent = el;
  else if (el && typeof el === 'object') {
    const name = el.name || el.id || el.item || Object.keys(el)[0];
    const qty = el.qty || el.count || el.quantity || el.q || el.amount || '';
    li.textContent = `${qty ? qty + '× ' : ''}${name}`;
  } else li.textContent = String(el);
  return li;
}

function buildLocationsSection(item) {
  const keys = ['drops', 'locations', 'spawnLocations', 'spawn', 'foundIn', 'droppedBy', 'loot', 'lootTable', 'dropLocations'];
  for (const k of keys) {
    const v = deepFind(item, k);
    if (v) {
      const sec = document.createElement('div'); sec.className = 'section'; sec.innerHTML = `<h3>Locations / Drops (${k})</h3>`;
      if (Array.isArray(v)) {
        const ul = document.createElement('ul');
        for (const el of v) {
          const li = document.createElement('li');
          li.textContent = typeof el === 'object' ? JSON.stringify(el) : String(el);
          ul.appendChild(li);
        }
        sec.appendChild(ul);
      } else if (typeof v === 'object') {
        const pre = document.createElement('pre'); pre.textContent = JSON.stringify(v, null, 2); sec.appendChild(pre);
      } else {
        const p = document.createElement('p'); p.textContent = String(v); sec.appendChild(p);
      }
      return sec;
    }
  }
  return null;
}

/* QUEST VIEWER */

function openQuestModal() {
  DOM.questModal.setAttribute('aria-hidden', 'false');
  DOM.questArea.innerHTML = '<p class="muted">Detecting quests in loaded datasets...</p>';
  // Try to find quests in loaded items
  const guesses = detectQuestsInData();
  if (guesses && guesses.length > 0) {
    renderQuestGraph(guesses);
  } else {
    DOM.questArea.innerHTML = `<p class="muted">No explicit quests found in the current dataset. You can import quest JSON files using the import button.</p>`;
  }
}

function closeQuestModal() {
  DOM.questModal.setAttribute('aria-hidden', 'true');
}

function detectQuestsInData() {
  // Heuristic: items with type/category 'quest' or having 'questID' or 'prerequisites'
  const q = state.items.filter(it => {
    const t = (it.type || it.category || '').toString().toLowerCase();
    if (t.includes('quest')) return true;
    if (it.questID || it.prerequisites || it.requires) return true;
    if (it.questName || it.quest) return true;
    return false;
  });
  // Normalize into quest objects
  const quests = q.map(it => {
    return {
      id: it._key || it.id || it.questID || it.key || (it.name && slugify(it.name)) || null,
      name: it.name || it.title || it.questName || it._key || it.id || '(quest)',
      raw: it,
      reqs: it.prerequisites || it.requires || it.requiresQuest || []
    };
  }).filter(q => q.id);
  return quests;
}

function renderQuestGraph(quests) {
  // Build adjacency: id -> quest
  const byId = {};
  quests.forEach(q => byId[q.id] = q);
  // Render nodes with dependencies
  const container = document.createElement('div');
  container.className = 'quest-graph';
  for (const q of quests) {
    const node = document.createElement('div'); node.className = 'quest-node';
    node.innerHTML = `<h4>${escapeHtml(q.name)}</h4><div class="quest-deps">ID: ${escapeHtml(q.id)}</div>`;
    // prerequisites
    const reqs = Array.isArray(q.reqs) ? q.reqs : (typeof q.reqs === 'string' ? [q.reqs] : []);
    if (reqs.length) {
      const deps = document.createElement('div'); deps.className = 'quest-deps';
      deps.innerHTML = `<strong>Requires:</strong> ${reqs.map(r => escapeHtml(String(r))).join(', ')}`;
      node.appendChild(deps);
    }
    const viewBtn = document.createElement('button'); viewBtn.className = 'btn small'; viewBtn.textContent = 'Open';
    viewBtn.addEventListener('click', () => showDetail(q.raw));
    node.appendChild(viewBtn);
    container.appendChild(node);
  }
  DOM.questArea.innerHTML = '';
  DOM.questArea.appendChild(container);
  // Note: For more advanced graph visuals (arrows/flow), integrate a graph lib (D3, dagre-d3, cytoscape) — future enhancement.
}

/* FILE IMPORT HANDLING (local JSON) */

function handleLocalFile(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const json = JSON.parse(ev.target.result);
      // If JSON looks like a dataset (array/object), allow user to merge or replace
      if (confirm('Load this JSON into the current dataset view? (OK = replace current in-memory dataset)')) {
        state.rawData = json;
        state.items = normalizeToArray(json);
        state.filtered = state.items.slice();
        state.page = 1;
        renderList();
        renderMarkers();
        clearDetail();
        alert('Local JSON loaded into the viewer. This does not change the remote repo.');
      }
    } catch (err) {
      alert('Failed to parse JSON: ' + err.message);
    }
  };
  reader.readAsText(f);
  // clear input to allow re-importing same file later
  e.target.value = '';
}

/* UTILITIES */

function deepFind(obj, path) {
  if (!obj) return undefined;
  if (!path) return undefined;
  if (path.indexOf('.') === -1) return obj[path];
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur) return undefined;
    cur = cur[p];
  }
  return cur;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"'`]/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'}[c];
  });
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function findInArrayByKey(arr, key, value) {
  return arr.find(a => String(a[key]) === String(value));
}

/* Zoom helper */
function zoomToMarkers() {
  if (!state.markers || state.markers.length === 0) {
    alert('No markers to zoom to (try filtering to show markers).');
    return;
  }
  const group = L.featureGroup(state.markers);
  map.fitBounds(group.getBounds().pad(0.2));
}

/* Simple utility: find nested object keys with numeric property for heuristics */
function findNumericGeoProps(obj) {
  const keys = Object.keys(obj || {});
  if (keys.includes('lat') && keys.includes('lng')) return {lat: obj.lat, lng: obj.lng};
  if (keys.includes('x') && keys.includes('y')) return {lat: obj.y, lng: obj.x};
  return null;
}

/* Basic helper to convert array of objects into key/value */
function arrayToObj(arr) {
  const out = {};
  (arr || []).forEach(el => {
    if (el && typeof el === 'object') {
      const k = el.name || el.id || Object.keys(el)[0];
      const v = el.value || el.qty || el.count || el[k];
      out[k] = v;
    }
  });
  return out;
}

/* INITIALIZE lightweight state in global for popup calls */
window.__app_state = state;
window.__app_showDetailFromPopup = window.__app_showDetailFromPopup;

/* Utility: find nested JSON keys to attempt to create coordinates when passed map center objects */
function tryParsePossibleCenter(obj) {
  if (!obj) return null;
  const v = extractCoordinates(obj);
  return v;
}
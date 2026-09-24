var DEFAULTS = { type: 'FeatureCollection', features: [] };

var zones = { type: 'FeatureCollection', features: [] };
var map = null;
var drawnItems = null;
var activeTool = null;
var editingZoneIndex = -1;

/* ===== SAVE ===== */
var saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  var statusEl = document.getElementById('save-status');
  if (statusEl) statusEl.textContent = 'Unsaved...';
  saveTimeout = setTimeout(function() {
    tool.setValue(JSON.parse(JSON.stringify(zones)));
    if (statusEl) statusEl.textContent = 'All changes saved';
  }, 400);
}

function saveNow() {
  clearTimeout(saveTimeout);
  tool.setValue(JSON.parse(JSON.stringify(zones)));
  var statusEl = document.getElementById('save-status');
  if (statusEl) statusEl.textContent = 'All changes saved';
  tool.notify('Zones saved successfully', 'success');
}

/* ===== ESCAPE HTML ===== */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ===== RENDER ZONE LIST ===== */
function renderZonesList() {
  var container = document.getElementById('zones-list');
  if (!container) return;
  container.innerHTML = '';

  if (zones.features.length === 0) {
    container.innerHTML = '<div class="empty-state">No zones defined yet.<br>Draw a shape on the map, then click <strong>+ New Zone From Drawing</strong>.</div>';
    return;
  }

  zones.features.forEach(function(feature, idx) {
    var props = feature.properties || {};
    var card = document.createElement('div');
    card.className = 'zone-card' + (editingZoneIndex === idx ? ' selected' : '');
    card.dataset.zoneIndex = idx;

    var swatch = document.createElement('div');
    swatch.className = 'zone-card-color';
    swatch.style.backgroundColor = props.color || '#4f46e5';

    var info = document.createElement('div');
    info.className = 'zone-card-info';
    info.innerHTML =
      '<div class="zone-card-name">' + esc(props.name || 'Zone ' + (idx + 1)) + '</div>' +
      '<div class="zone-card-meta">Min: $' + (props.min_order || 0) + ' &middot; Fee: $' + (props.fee || 0) + '</div>';

    var actions = document.createElement('div');
    actions.className = 'zone-card-actions';
    actions.innerHTML =
      '<button title="Edit" class="edit-btn">✎</button>' +
      '<button title="Zoom to" class="zoom-btn">⊕</button>' +
      '<button title="Delete" class="delete-btn">✕</button>';

    /* Edit */
    actions.querySelector('.edit-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      editZone(idx);
    });

    /* Zoom to */
    actions.querySelector('.zoom-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      zoomToZone(idx);
    });

    /* Delete */
    actions.querySelector('.delete-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      deleteZone(idx);
    });

    /* Click card → select + zoom */
    card.addEventListener('click', function() {
      selectZone(idx);
    });

    card.appendChild(swatch);
    card.appendChild(info);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

/* ===== MAP INTERACTIONS ===== */
function zoomToZone(idx) {
  if (!map || idx < 0 || idx >= zones.features.length) return;
  var feature = zones.features[index];
  var layer = findLayerByFeature(feature);
  if (layer) {
    map.fitBounds(layer.getBounds(), { padding: [30, 30] });
  }
}

function selectZone(idx) {
  editingZoneIndex = idx;
  highlightZone(idx);
  renderZonesList();
}

function highlightZone(idx) {
  if (!map) return;
  /* Reset all layer styles */
  drawnItems.eachLayer(function(layer) {
    var zoneIdx = layer._zoneIndex;
    if (zoneIdx !== undefined && zoneIdx >= 0 && zoneIdx < zones.features.length) {
      var color = zones.features[zoneIdx].properties.color || '#4f46e5';
      layer.setStyle({
        color: color,
        fillColor: color,
        fillOpacity: zoneIdx === idx ? 0.35 : 0.15,
        weight: zoneIdx === idx ? 3 : 2,
        opacity: zoneIdx === idx ? 1 : 0.7
      });
    }
  });
}

function findLayerByFeature(feature) {
  var found = null;
  drawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex !== undefined && layer._zoneIndex >= 0 && layer._zoneIndex < zones.features.length) {
      if (zones.features[layer._zoneIndex] === feature) {
        found = layer;
      }
    }
  });
  return found;
}

/* ===== ZONE CRUD ===== */
function editZone(idx) {
  editingZoneIndex = idx;
  var feature = zones.features[idx];
  if (!feature) return;
  var props = feature.properties || {};

  document.getElementById('zone-name').value = props.name || '';
  document.getElementById('zone-color').value = props.color || '#4f46e5';
  document.getElementById('zone-min-order').value = props.min_order || 0;
  document.getElementById('zone-fee').value = props.fee || 0;
  document.getElementById('zone-form').style.display = '';
  document.getElementById('add-zone-btn').style.display = 'none';

  highlightZone(idx);
  zoomToZone(idx);
  renderZonesList();
  tool.resize();
}

function deleteZone(idx) {
  if (idx < 0 || idx >= zones.features.length) return;
  zones.features.splice(idx, 1);

  /* Remove the corresponding map layer */
  var toRemove = null;
  drawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === idx) toRemove = layer;
  });
  if (toRemove) drawnItems.removeLayer(toRemove);

  /* Re-index remaining layers */
  reindexLayers();

  editingZoneIndex = -1;
  clearZoneForm();
  renderZonesList();
  scheduleSave();
  tool.notify('Zone deleted', 'info');
}

function saveZone() {
  var name = document.getElementById('zone-name').value.trim();
  if (!name) { tool.notify('Zone name is required', 'warning'); return; }

  var color = document.getElementById('zone-color').value;
  var minOrder = parseFloat(document.getElementById('zone-min-order').value) || 0;
  var fee = parseFloat(document.getElementById('zone-fee').value) || 0;

  if (editingZoneIndex >= 0 && editingZoneIndex < zones.features.length) {
    /* Update existing zone properties */
    zones.features[editingZoneIndex].properties = {
      name: name, color: color, min_order: minOrder, fee: fee
    };
    /* Update the corresponding layer style */
    drawnItems.eachLayer(function(layer) {
      if (layer._zoneIndex === editingZoneIndex) {
        layer.setStyle({ color: color, fillColor: color });
      }
    });
    tool.notify('Zone updated', 'success');
  } else {
    /* Create new zone from the last drawn shape */
    var newFeature = extractFromDrawnLayers(name, color, minOrder, fee);
    if (!newFeature) {
      tool.notify('Draw a shape on the map first, then try again', 'warning');
      return;
    }
    zones.features.push(newFeature);
    /* Tag the newest layer */
    reindexLayers();
    tool.notify('Zone created', 'success');
  }

  editingZoneIndex = -1;
  clearZoneForm();
  renderZonesList();
  highlightZone(-1);
  scheduleSave();
}

function extractFromDrawnLayers(name, color, minOrder, fee) {
  /* Check if a new drawing exists: find layer without _zoneIndex */
  var candidate = null;
  drawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === undefined) {
      candidate = layer;
    }
  });
  if (!candidate) return null;

  var geometry = layerToGeoJSON(candidate);
  if (!geometry) return null;

  return {
    type: 'Feature',
    properties: { name: name, color: color, min_order: minOrder, fee: fee },
    geometry: geometry
  };
}

function layerToGeoJSON(layer) {
  if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
    var latlngs = layer.getLatLngs();
    var coords = latlngsToCoords(latlngs);
    /* Ensure ring is closed */
    if (coords.length > 0 && coords[0].length > 0) {
      var ring = coords[0];
      if (ring.length > 0) {
        var first = ring[0], last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
        }
      }
    }
    return { type: 'Polygon', coordinates: coords };
  }
  if (layer instanceof L.Circle) {
    var center = layer.getLatLng();
    return {
      type: 'Point',
      coordinates: [center.lng, center.lat],
      radius: layer.getRadius()
    };
  }
  return null;
}

function latlngsToCoords(latlngs) {
  if (!latlngs) return [];
  if (Array.isArray(latlngs) && latlngs.length > 0) {
    if (latlngs[0] instanceof L.LatLng) {
      return [latlngs.map(function(ll) { return [ll.lng, ll.lat]; })];
    }
    if (Array.isArray(latlngs[0])) {
      return latlngs.map(function(ring) {
        return ring.map(function(ll) {
          if (ll instanceof L.LatLng) return [ll.lng, ll.lat];
          if (Array.isArray(ll) && ll.length === 2) return [ll[1], ll[0]];
          return [0, 0];
        });
      });
    }
  }
  return [];
}

function clearZoneForm() {
  document.getElementById('zone-form').style.display = 'none';
  document.getElementById('add-zone-btn').style.display = '';
  document.getElementById('zone-name').value = '';
  document.getElementById('zone-min-order').value = '0';
  document.getElementById('zone-fee').value = '0';
  editingZoneIndex = -1;
  highlightZone(-1);
  renderZonesList();
  tool.resize();
}

/* ===== LAYER INDEXING ===== */
function reindexLayers() {
  var idx = 0;
  drawnItems.eachLayer(function(layer) {
    layer._zoneIndex = idx;
    idx++;
  });
}

/* ===== MAP INIT ===== */
function initMap() {
  var mapEl = document.getElementById('delivery-map');
  if (!mapEl) return;

  map = L.map('delivery-map', {
    center: [40.7128, -74.006],
    zoom: 12,
    zoomControl: true
  });

  /* OpenStreetMap tiles — free, no API key needed */
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  /* Feature group for drawn items */
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  /* Leaflet.draw controls — we manage manually via buttons */
  map.on(L.Draw.Event.CREATED, function(event) {
    var layer = event.layer;
    layer._zoneIndex = undefined; /* New drawing, not yet saved as zone */
    drawnItems.addLayer(layer);
    deactivateDraw();
    /* Auto-style */
    layer.setStyle({
      color: '#4f46e5',
      fillColor: '#4f46e5',
      fillOpacity: 0.15,
      weight: 2
    });
  });

  map.on(L.Draw.Event.EDITED, function() {
    /* Update GeoJSON for edited layers */
    syncAllLayersToZones();
    scheduleSave();
  });

  map.on(L.Draw.Event.DELETED, function() {
    syncAllLayersToZones();
    scheduleSave();
  });

  loadZonesOnMap();
}

function loadZonesOnMap() {
  if (!map || !drawnItems) return;
  drawnItems.clearLayers();

  zones.features.forEach(function(feature, idx) {
    var layer = geoJSONToLayer(feature);
    if (layer) {
      layer._zoneIndex = idx;
      var color = feature.properties.color || '#4f46e5';
      layer.setStyle({
        color: color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2
      });
      drawnItems.addLayer(layer);
    }
  });
}

function geoJSONToLayer(feature) {
  if (!feature || !feature.geometry) return null;
  var geom = feature.geometry;
  try {
    if (geom.type === 'Polygon') {
      var coords = geom.coordinates[0];
      var latlngs = coords.map(function(c) { return [c[1], c[0]]; });
      return L.polygon(latlngs);
    }
    if (geom.type === 'MultiPolygon') {
      var all = geom.coordinates.map(function(ring) {
        return ring.map(function(c) { return [c[1], c[0]]; });
      });
      return L.polygon(all);
    }
    if (geom.type === 'Point' && geom.radius) {
      return L.circle([geom.coordinates[1], geom.coordinates[0]], { radius: geom.radius });
    }
  } catch(e) {}
  return null;
}

function syncAllLayersToZones() {
  var newFeatures = [];
  drawnItems.eachLayer(function(layer) {
    var geom = layerToGeoJSON(layer);
    if (!geom) return;
    var idx = layer._zoneIndex;
    var props = { name: '', color: '#4f46e5', min_order: 0, fee: 0 };
    if (idx !== undefined && idx >= 0 && idx < zones.features.length) {
      props = zones.features[idx].properties || props;
    }
    newFeatures.push({ type: 'Feature', properties: props, geometry: geom });
  });

  /* Preserve existing properties by mapping old indices */
  var oldFeatures = zones.features;
  zones.features = newFeatures;
  reindexLayers();
}

/* ===== DRAWING TOOLS ===== */
var drawControl = null;

function activateDraw(type) {
  deactivateDraw();
  if (!map) return;

  var options = {
    polygon: { shapeOptions: { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 } },
    rectangle: { shapeOptions: { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 } },
    circle: { shapeOptions: { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 } }
  };

  if (type === 'polygon') {
    drawControl = new L.Draw.Polygon(map, options.polygon);
  } else if (type === 'rectangle') {
    drawControl = new L.Draw.Rectangle(map, options.rectangle);
  } else if (type === 'circle') {
    drawControl = new L.Draw.Circle(map, options.circle);
  }

  if (drawControl) {
    drawControl.enable();
    activeTool = type;
    updateToolButtons();
  }
}

function deactivateDraw() {
  if (drawControl) {
    drawControl.disable();
    drawControl = null;
  }
  activeTool = null;
  updateToolButtons();
}

function updateToolButtons() {
  ['draw-polygon', 'draw-circle', 'draw-rectangle'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.classList.remove('active-tool');
  });
  if (activeTool) {
    var activeId = 'draw-' + activeTool;
    var activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('active-tool');
  }
}

/* ===== READ-ONLY ===== */
function lockUI(isReadOnly) {
  var interactive = document.querySelectorAll('input, select, textarea, button');
  interactive.forEach(function(el) {
    if (isReadOnly) { el.setAttribute('disabled', 'disabled'); el.style.pointerEvents = 'none'; }
    else { el.removeAttribute('disabled'); el.style.pointerEvents = ''; }
  });
  var saveBar = document.getElementById('save-bar');
  if (saveBar) saveBar.style.display = isReadOnly ? 'none' : '';
}

/* ===== RENDER ===== */
function render(value) {
  var incoming = value;
  if (!incoming || !incoming.features) incoming = { type: 'FeatureCollection', features: [] };
  zones = {
    type: 'FeatureCollection',
    features: JSON.parse(JSON.stringify(incoming.features || []))
  };

  renderZonesList();
  if (map && drawnItems) {
    loadZonesOnMap();
  }
  tool.resize();
}

/* ===== EVENT DELEGATION ===== */
function initEventDelegation() {
  document.getElementById('draw-polygon').addEventListener('click', function() {
    if (activeTool === 'polygon') deactivateDraw(); else activateDraw('polygon');
  });
  document.getElementById('draw-circle').addEventListener('click', function() {
    if (activeTool === 'circle') deactivateDraw(); else activateDraw('circle');
  });
  document.getElementById('draw-rectangle').addEventListener('click', function() {
    if (activeTool === 'rectangle') deactivateDraw(); else activateDraw('rectangle');
  });
  document.getElementById('clear-drawing').addEventListener('click', function() {
    deactivateDraw();
    /* Remove unsaved layers (those without _zoneIndex) */
    var toRemove = [];
    drawnItems.eachLayer(function(layer) {
      if (layer._zoneIndex === undefined) toRemove.push(layer);
    });
    toRemove.forEach(function(l) { drawnItems.removeLayer(l); });
  });
  document.getElementById('edit-layers').addEventListener('click', function() {
    deactivateDraw();
    /* Toggle edit mode on drawnItems */
    if (drawnItems.editEnabled) {
      drawnItems.editEnabled = false;
      document.getElementById('edit-layers').classList.remove('active-tool');
    } else {
      drawnItems.editEnabled = true;
      document.getElementById('edit-layers').classList.add('active-tool');
      /* Each layer individually — use Leaflet.draw edit */
      if (drawnItems.getLayers().length > 0) {
        new L.EditToolbar.Edit(map, { featureGroup: drawnItems }).enable();
      }
    }
  });

  document.getElementById('add-zone-btn').addEventListener('click', function() {
    editingZoneIndex = -1;
    document.getElementById('zone-name').value = '';
    document.getElementById('zone-min-order').value = '0';
    document.getElementById('zone-fee').value = '0';
    document.getElementById('zone-color').value = '#4f46e5';
    document.getElementById('zone-form').style.display = '';
    document.getElementById('add-zone-btn').style.display = 'none';
    tool.resize();
  });
  document.getElementById('save-zone').addEventListener('click', saveZone);
  document.getElementById('cancel-zone').addEventListener('click', clearZoneForm);
  document.getElementById('save-all-btn').addEventListener('click', saveNow);
}

/* ===== BOOT ===== */
tool.onReady(function(val) {
  render(val);
  initMap();
  initEventDelegation();

  if (tool.isReadOnly()) lockUI(true);

  tool.onValueChange(function(v) { render(v); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });
});

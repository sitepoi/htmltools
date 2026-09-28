/* ===== DEFAULTS ===== */
var DEFAULTS = {
  categories: [],
  items: [],
  modifier_groups: []
};

var ALLERGENS = ['Gluten', 'Dairy', 'Nuts', 'Soy', 'Eggs', 'Shellfish', 'Sulfites', 'Sesame', 'Mustard', 'Celery'];
var TAGS = ['Popular', 'New', 'Chef Special', 'Spicy', 'Bestseller', 'Limited', 'Seasonal'];
var SPICE_NAMES = ['Not Spicy', 'Mild', 'Medium', 'Hot', 'Very Hot', 'Extra Hot'];

var data = { categories: [], items: [], modifier_groups: [] };
var selectedCategoryId = null;
var editingItemId = null;
var editingModGroupId = null;
var selectedItemIds = [];
var activeFilter = null;

/* ===== HELPERS ===== */
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deepMerge(target, source) {
  var output = JSON.parse(JSON.stringify(target));
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }
  return output;
}

/* ===== SAVE ===== */
var saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  var s = document.getElementById('save-status');
  if (s) s.textContent = 'Unsaved...';
  saveTimeout = setTimeout(function() {
    tool.setValue(JSON.parse(JSON.stringify(data)));
    var st = document.getElementById('save-status');
    if (st) st.textContent = 'All changes saved';
  }, 500);
}

function saveNow() {
  clearTimeout(saveTimeout);
  tool.setValue(JSON.parse(JSON.stringify(data)));
  var s = document.getElementById('save-status');
  if (s) s.textContent = 'All changes saved';
  tool.notify('Menu saved successfully', 'success');
}

/* ===== READ-ONLY ===== */
function lockUI(ro) {
  var els = document.querySelectorAll('input, select, textarea, button, .switch');
  els.forEach(function(el) {
    if (ro) { el.setAttribute('disabled', 'disabled'); el.style.pointerEvents = 'none'; }
    else { el.removeAttribute('disabled'); el.style.pointerEvents = ''; }
  });
  var sb = document.getElementById('save-bar');
  if (sb) sb.style.display = ro ? 'none' : '';
}

/* ===== LEFT PANEL: TABS ===== */
function initPanelTabs() {
  document.querySelectorAll('.panel-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.panel-content').forEach(function(c) { c.classList.remove('active'); });
      tab.classList.add('active');
      var target = document.querySelector('[data-tab-content="' + tab.dataset.tab + '"]');
      if (target) target.classList.add('active');
      if (tab.dataset.tab === 'modifier-groups') renderModGroups();
    });
  });
}

/* ===== LEFT PANEL: CATEGORIES ===== */
function renderCategories() {
  var list = document.getElementById('category-list');
  if (!list) return;
  list.innerHTML = '';

  data.categories.forEach(function(cat) {
    var itemCount = data.items.filter(function(i) { return i.category_id === cat.id; }).length;
    var el = document.createElement('div');
    el.className = 'category-item' + (selectedCategoryId === cat.id ? ' active' : '');
    el.dataset.catId = cat.id;
    el.innerHTML =
      '<span class="drag-handle">⋮⋮</span>' +
      '<span class="cat-name">' + esc(cat.name) + '</span>' +
      '<span class="cat-count">' + itemCount + '</span>' +
      '<span class="cat-actions">' +
        '<button class="cat-edit-btn" title="Edit">✎</button>' +
        '<button class="cat-delete-btn" title="Delete">✕</button>' +
      '</span>';

    el.addEventListener('click', function(e) {
      if (e.target.closest('.cat-actions')) return;
      selectCategory(cat.id);
    });

    el.querySelector('.cat-edit-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      editCategory(cat.id);
    });

    el.querySelector('.cat-delete-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      deleteCategory(cat.id);
    });

    list.appendChild(el);
  });

  /* Sortable */
  if (typeof Sortable !== 'undefined') {
    Sortable.create(list, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function() {
        var ids = [].map.call(list.querySelectorAll('.category-item'), function(el) { return el.dataset.catId; });
        data.categories.sort(function(a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
        scheduleSave();
      }
    });
  }

  /* Update bulk category dropdown */
  var bulkSelect = document.getElementById('bulk-category-select');
  if (bulkSelect) {
    var currentVal = bulkSelect.value;
    bulkSelect.innerHTML = '<option value="">Move to category...</option>';
    data.categories.forEach(function(c) {
      bulkSelect.innerHTML += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    });
    bulkSelect.value = currentVal;
  }

  /* Update modifier group checkboxes in drawer */
  renderModGroupCheckboxes();
}

function selectCategory(catId) {
  selectedCategoryId = catId;
  selectedItemIds = [];
  editingItemId = null;
  closeDrawer();
  renderCategories();
  renderItems();
}

function addCategory() {
  var form = document.getElementById('category-form');
  var input = document.getElementById('category-name-input');
  form.style.display = '';
  input.value = '';
  input.focus();
}

function saveCategory() {
  var input = document.getElementById('category-name-input');
  var name = input.value.trim();
  if (!name) { tool.notify('Category name required', 'warning'); return; }

  data.categories.push({ id: uid(), name: name });
  document.getElementById('category-form').style.display = 'none';
  input.value = '';
  renderCategories();
  scheduleSave();
  tool.notify('Category added', 'success');
}

function editCategory(catId) {
  var cat = data.categories.find(function(c) { return c.id === catId; });
  if (!cat) return;
  var form = document.getElementById('category-form');
  var input = document.getElementById('category-name-input');
  form.style.display = '';
  input.value = cat.name;
  input.dataset.editCatId = catId;
  input.focus();
}

function saveCategoryEdit() {
  var input = document.getElementById('category-name-input');
  var name = input.value.trim();
  var catId = input.dataset.editCatId;
  if (!name || !catId) return;
  var cat = data.categories.find(function(c) { return c.id === catId; });
  if (cat) cat.name = name;
  document.getElementById('category-form').style.display = 'none';
  input.value = '';
  delete input.dataset.editCatId;
  renderCategories();
  scheduleSave();
}

function deleteCategory(catId) {
  data.categories = data.categories.filter(function(c) { return c.id !== catId; });
  /* Unassign items */
  data.items.forEach(function(item) { if (item.category_id === catId) item.category_id = null; });
  if (selectedCategoryId === catId) selectedCategoryId = null;
  renderCategories();
  renderItems();
  scheduleSave();
}

/* ===== LEFT PANEL: MODIFIER GROUPS ===== */
function renderModGroups() {
  var list = document.getElementById('modgroup-list');
  if (!list) return;
  list.innerHTML = '';

  data.modifier_groups.forEach(function(mg) {
    var el = document.createElement('div');
    el.className = 'modgroup-item' + (editingModGroupId === mg.id ? ' active' : '');
    el.dataset.mgId = mg.id;
    el.innerHTML =
      '<span class="mg-name">' + esc(mg.group_name) + '</span>' +
      '<span class="mg-meta">' + (mg.selection_type === 'single' ? 'Single' : 'Multi') + (mg.is_required ? ' · Req' : '') + '</span>' +
      '<span class="mg-actions">' +
        '<button class="mg-edit-btn" title="Edit">✎</button>' +
        '<button class="mg-delete-btn" title="Delete">✕</button>' +
      '</span>';

    el.addEventListener('click', function(e) {
      if (e.target.closest('.mg-actions')) return;
      editModGroup(mg.id);
    });

    el.querySelector('.mg-edit-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      editModGroup(mg.id);
    });

    el.querySelector('.mg-delete-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      deleteModGroup(mg.id);
    });

    list.appendChild(el);
  });
}

function addModGroup() {
  editingModGroupId = null;
  var form = document.getElementById('modgroup-form');
  document.getElementById('modgroup-name-input').value = '';
  document.getElementById('modgroup-type-input').value = 'multi';
  document.getElementById('modgroup-required-input').checked = false;
  document.getElementById('modgroup-options-list').innerHTML = '';
  form.style.display = '';
  renderModGroups();
  tool.resize();
}

function editModGroup(mgId) {
  var mg = data.modifier_groups.find(function(g) { return g.id === mgId; });
  if (!mg) return;
  editingModGroupId = mgId;
  var form = document.getElementById('modgroup-form');
  document.getElementById('modgroup-name-input').value = mg.group_name;
  document.getElementById('modgroup-type-input').value = mg.selection_type;
  document.getElementById('modgroup-required-input').checked = !!mg.is_required;
  renderModGroupOptions(mg);
  form.style.display = '';
  renderModGroups();
  tool.resize();
}

function renderModGroupOptions(mg) {
  var container = document.getElementById('modgroup-options-list');
  if (!container) return;
  container.innerHTML = '';

  (mg.options || []).forEach(function(opt, idx) {
    var row = document.createElement('div');
    row.className = 'modgroup-option-row';
    row.dataset.optIdx = idx;
    row.innerHTML =
      '<span class="drag-handle">⋮⋮</span>' +
      '<input type="text" class="form-input form-input-sm" value="' + esc(opt.option_name) + '" placeholder="Option name" data-opt-field="name">' +
      '<input type="number" class="form-input form-input-sm" value="' + (opt.price_adjustment || 0) + '" step="0.01" placeholder="+/- $" data-opt-field="price">' +
      '<label style="font-size:10px;"><input type="radio" name="mg-default-opt" value="' + idx + '" ' + (opt.is_default ? 'checked' : '') + '> Default</label>' +
      '<label style="font-size:10px;"><input type="checkbox" ' + (opt.is_available !== false ? 'checked' : '') + ' data-opt-field="avail"> Avail</label>' +
      '<button type="button" class="opt-delete-btn">✕</button>';

    /* Live update */
    row.querySelector('[data-opt-field="name"]').addEventListener('input', function() {
      mg.options[idx].option_name = this.value;
    });
    row.querySelector('[data-opt-field="price"]').addEventListener('input', function() {
      mg.options[idx].price_adjustment = parseFloat(this.value) || 0;
    });
    row.querySelector('[data-opt-field="avail"]').addEventListener('change', function() {
      mg.options[idx].is_available = this.checked;
    });
    row.querySelector('input[type="radio"]').addEventListener('change', function() {
      mg.options.forEach(function(o, i) { o.is_default = (i === idx); });
    });
    row.querySelector('.opt-delete-btn').addEventListener('click', function() {
      mg.options.splice(idx, 1);
      renderModGroupOptions(mg);
    });

    container.appendChild(row);
  });

  /* Sortable */
  if (typeof Sortable !== 'undefined') {
    Sortable.create(container, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function() {
        var newOrder = [].map.call(container.querySelectorAll('.modgroup-option-row'), function(r) { return parseInt(r.dataset.optIdx); });
        mg.options = newOrder.map(function(i) { return mg.options[i]; });
        renderModGroupOptions(mg);
      }
    });
  }
}

function addModOption() {
  var mgId = editingModGroupId;
  if (!mgId) return;
  var mg = data.modifier_groups.find(function(g) { return g.id === mgId; });
  if (!mg) return;
  if (!mg.options) mg.options = [];
  mg.options.push({ id: uid(), option_name: '', price_adjustment: 0, is_default: false, is_available: true });
  renderModGroupOptions(mg);
}

function saveModGroup() {
  var name = document.getElementById('modgroup-name-input').value.trim();
  if (!name) { tool.notify('Group name required', 'warning'); return; }

  var mgData = {
    id: editingModGroupId || uid(),
    group_name: name,
    selection_type: document.getElementById('modgroup-type-input').value,
    is_required: document.getElementById('modgroup-required-input').checked,
    options: []
  };

  if (editingModGroupId) {
    var existing = data.modifier_groups.find(function(g) { return g.id === editingModGroupId; });
    if (existing) {
      mgData.options = existing.options || [];
      /* Update options from current inline edits already synced via live listeners */
      Object.assign(existing, mgData);
    }
  } else {
    data.modifier_groups.push(mgData);
  }

  editingModGroupId = null;
  document.getElementById('modgroup-form').style.display = 'none';
  renderModGroups();
  renderModGroupCheckboxes();
  scheduleSave();
  tool.notify('Modifier group saved', 'success');
}

function deleteModGroup(mgId) {
  data.modifier_groups = data.modifier_groups.filter(function(g) { return g.id !== mgId; });
  /* Remove from items */
  data.items.forEach(function(item) {
    if (item.modifier_group_ids) item.modifier_group_ids = item.modifier_group_ids.filter(function(id) { return id !== mgId; });
  });
  editingModGroupId = null;
  document.getElementById('modgroup-form').style.display = 'none';
  renderModGroups();
  renderModGroupCheckboxes();
  scheduleSave();
}

function renderModGroupCheckboxes() {
  var container = document.getElementById('modgroup-checkboxes');
  if (!container) return;
  var item = getEditingItem();
  var selectedIds = item ? (item.modifier_group_ids || []) : [];

  container.innerHTML = '';
  data.modifier_groups.forEach(function(mg) {
    var label = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = mg.id;
    cb.checked = selectedIds.indexOf(mg.id) !== -1;
    cb.addEventListener('change', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.modifier_group_ids) it.modifier_group_ids = [];
      if (this.checked) {
        if (it.modifier_group_ids.indexOf(mg.id) === -1) it.modifier_group_ids.push(mg.id);
      } else {
        it.modifier_group_ids = it.modifier_group_ids.filter(function(id) { return id !== mg.id; });
      }
      scheduleSave();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + mg.group_name + ' (' + (mg.selection_type === 'single' ? 'Single' : 'Multi') + ')'));
    container.appendChild(label);
  });
}

/* ===== CENTER: ITEMS GRID ===== */
function renderItems() {
  var grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  /* Filter by category */
  var items = data.items;
  if (selectedCategoryId) {
    items = items.filter(function(i) { return i.category_id === selectedCategoryId; });
  }

  /* Search */
  var query = (document.getElementById('search-input').value || '').toLowerCase();
  if (query) {
    items = items.filter(function(i) { return (i.item_name || '').toLowerCase().indexOf(query) !== -1; });
  }

  /* Filter chips */
  if (activeFilter === 'vegetarian') items = items.filter(function(i) { return i.is_vegetarian; });
  if (activeFilter === 'vegan') items = items.filter(function(i) { return i.is_vegan; });
  if (activeFilter === 'gluten_free') items = items.filter(function(i) { return i.is_gluten_free; });
  if (activeFilter === 'available') items = items.filter(function(i) { return i.is_available !== false; });

  /* Sort */
  var sortBy = document.getElementById('sort-select').value;
  if (sortBy === 'name_asc') items.sort(function(a, b) { return (a.item_name || '').localeCompare(b.item_name || ''); });
  if (sortBy === 'name_desc') items.sort(function(a, b) { return (b.item_name || '').localeCompare(a.item_name || ''); });
  if (sortBy === 'price_asc') items.sort(function(a, b) { return (a.price || 0) - (b.price || 0); });
  if (sortBy === 'price_desc') items.sort(function(a, b) { return (b.price || 0) - (a.price || 0); });

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">No items found</div>';
    return;
  }

  items.forEach(function(item) {
    var card = document.createElement('div');
    card.className = 'item-card' + (selectedItemIds.indexOf(item.id) !== -1 ? ' selected' : '');
    card.dataset.itemId = item.id;

    var photoHtml = item.primary_photo_url
      ? '<img src="' + item.primary_photo_url + '" alt="">'
      : '🍽️';

    /* Dietary badges */
    var badges = '';
    if (item.is_vegetarian) badges += '<span class="badge badge-veg">V</span>';
    if (item.is_vegan) badges += '<span class="badge badge-vegan">VG</span>';
    if (item.is_gluten_free) badges += '<span class="badge badge-gf">GF</span>';
    if (item.tags && item.tags.length > 0) {
      badges += '<span class="badge badge-tag">' + esc(item.tags[0]) + '</span>';
    }

    var priceDisplay = '$' + (item.price || 0).toFixed(2);
    var saleDisplay = item.sale_price ? '<span class="card-sale">$' + item.sale_price.toFixed(2) + '</span>' : '';

    card.innerHTML =
      '<div class="card-photo">' +
        '<div class="card-check">✓</div>' +
        photoHtml +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-name">' + esc(item.item_name || 'Untitled') + '</div>' +
        '<div class="card-pricing"><span class="card-price">' + priceDisplay + '</span>' + saleDisplay + '</div>' +
        '<div class="card-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        '<span>' + (item.calories ? item.calories + ' cal' : '') + '</span>' +
        '<span class="availability-dot ' + (item.is_available !== false ? 'on' : 'off') + '"></span>' +
      '</div>';

    card.addEventListener('click', function(e) {
      if (e.ctrlKey || e.metaKey) {
        /* Multi-select toggle */
        toggleItemSelection(item.id);
        return;
      }
      openItemDrawer(item.id);
    });

    grid.appendChild(card);
  });

  updateBulkBar();
}

function toggleItemSelection(itemId) {
  var idx = selectedItemIds.indexOf(itemId);
  if (idx === -1) selectedItemIds.push(itemId);
  else selectedItemIds.splice(idx, 1);
  renderItems();
}

function updateBulkBar() {
  var bar = document.getElementById('bulk-bar');
  var count = document.getElementById('bulk-count');
  if (bar) bar.style.display = selectedItemIds.length > 0 ? '' : 'none';
  if (count) count.textContent = selectedItemIds.length + ' selected';
}

function clearSelection() {
  selectedItemIds = [];
  renderItems();
}

/* ===== ITEM DRAWER ===== */
function openItemDrawer(itemId) {
  editingItemId = itemId;
  var item = data.items.find(function(i) { return i.id === itemId; });
  var panel = document.getElementById('right-panel');
  var title = document.getElementById('drawer-title');

  if (panel) panel.style.display = '';
  if (title) title.textContent = item ? 'Edit Item' : 'New Item';

  if (item) {
    document.getElementById('item-name').value = item.item_name || '';
    document.getElementById('item-slug').value = item.slug || '';
    document.getElementById('item-description').value = item.description || '';
    document.getElementById('item-price').value = item.price || '';
    document.getElementById('item-sale-price').value = item.sale_price || '';
    document.getElementById('is-vegetarian').checked = !!item.is_vegetarian;
    document.getElementById('is-vegan').checked = !!item.is_vegan;
    document.getElementById('is-gluten-free').checked = !!item.is_gluten_free;
    document.getElementById('spice-level').value = item.spice_level || 0;
    document.getElementById('spice-label').textContent = SPICE_NAMES[item.spice_level || 0];
    document.getElementById('item-calories').value = item.calories || '';
    document.getElementById('item-prep-time').value = item.prep_time_minutes || '';
    document.getElementById('is-available').checked = item.is_available !== false;
    document.getElementById('delete-item-btn').style.display = '';

    renderPrimaryPhoto(item);
    renderPhotoPool(item);
    renderAllergenPicker(item);
    renderTagPicker(item);
    renderModGroupCheckboxes();
  } else {
    /* New item */
    clearItemForm();
    document.getElementById('delete-item-btn').style.display = 'none';
    renderAllergenPicker(null);
    renderTagPicker(null);
    renderModGroupCheckboxes();
  }

  tool.resize();
}

function getEditingItem() {
  if (!editingItemId) return null;
  return data.items.find(function(i) { return i.id === editingItemId; }) || null;
}

function clearItemForm() {
  document.getElementById('item-name').value = '';
  document.getElementById('item-slug').value = '';
  document.getElementById('item-description').value = '';
  document.getElementById('item-price').value = '';
  document.getElementById('item-sale-price').value = '';
  document.getElementById('is-vegetarian').checked = false;
  document.getElementById('is-vegan').checked = false;
  document.getElementById('is-gluten-free').checked = false;
  document.getElementById('spice-level').value = 0;
  document.getElementById('spice-label').textContent = 'Not Spicy';
  document.getElementById('item-calories').value = '';
  document.getElementById('item-prep-time').value = '';
  document.getElementById('is-available').checked = true;
  document.getElementById('primary-photo-preview').innerHTML = '🍽️';
  document.getElementById('photo-pool').innerHTML = '';
  document.getElementById('delete-item-btn').style.display = 'none';
  renderAllergenPicker(null);
  renderTagPicker(null);
}

function closeDrawer() {
  document.getElementById('right-panel').style.display = 'none';
  editingItemId = null;
  tool.resize();
}

/* ===== ALLERGEN PICKER ===== */
function renderAllergenPicker(item) {
  var container = document.getElementById('allergen-picker');
  if (!container) return;
  container.innerHTML = '';
  var selected = item ? (item.allergens || []) : [];

  ALLERGENS.forEach(function(a) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selected.indexOf(a) !== -1 ? ' active' : '');
    chip.textContent = a;
    chip.addEventListener('click', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.allergens) it.allergens = [];
      var idx = it.allergens.indexOf(a);
      if (idx === -1) it.allergens.push(a);
      else it.allergens.splice(idx, 1);
      renderAllergenPicker(it);
      scheduleSave();
    });
    container.appendChild(chip);
  });
}

/* ===== TAG PICKER ===== */
function renderTagPicker(item) {
  var container = document.getElementById('tag-picker');
  if (!container) return;
  container.innerHTML = '';
  var selected = item ? (item.tags || []) : [];

  TAGS.forEach(function(t) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selected.indexOf(t) !== -1 ? ' active' : '');
    chip.textContent = t;
    chip.addEventListener('click', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.tags) it.tags = [];
      var idx = it.tags.indexOf(t);
      if (idx === -1) it.tags.push(t);
      else it.tags.splice(idx, 1);
      renderTagPicker(it);
      scheduleSave();
    });
    container.appendChild(chip);
  });
}

/* ===== PHOTOS ===== */
function renderPrimaryPhoto(item) {
  var preview = document.getElementById('primary-photo-preview');
  if (!preview) return;
  if (item && item.primary_photo_url) {
    preview.innerHTML = '<img src="' + item.primary_photo_url + '" alt="">';
  } else {
    preview.innerHTML = '🍽️';
  }
}

function renderPhotoPool(item) {
  var pool = document.getElementById('photo-pool');
  if (!pool) return;
  pool.innerHTML = '';
  if (!item || !item.photos || item.photos.length === 0) return;

  item.photos.forEach(function(photoUrl, idx) {
    var el = document.createElement('div');
    el.className = 'photo-pool-item' + (photoUrl === item.primary_photo_url ? ' primary' : '');
    el.innerHTML =
      '<img src="' + photoUrl + '" alt="">' +
      '<span class="pool-delete">✕</span>';

    el.addEventListener('click', function(e) {
      if (e.target.classList.contains('pool-delete')) return;
      /* Set as primary */
      item.primary_photo_url = photoUrl;
      renderPrimaryPhoto(item);
      renderPhotoPool(item);
      scheduleSave();
    });

    el.querySelector('.pool-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      var it = getEditingItem();
      if (!it) return;
      it.photos.splice(idx, 1);
      if (it.primary_photo_url === photoUrl) {
        it.primary_photo_url = it.photos.length > 0 ? it.photos[0] : null;
      }
      renderPrimaryPhoto(it);
      renderPhotoPool(it);
      scheduleSave();
    });

    pool.appendChild(el);
  });
}

function handlePrimaryPhoto(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    var item = getEditingItem();
    if (!item) {
      /* New item — store temporarily */
      if (!window._tempPrimaryPhoto) window._tempPrimaryPhoto = dataUrl;
      document.getElementById('primary-photo-preview').innerHTML = '<img src="' + dataUrl + '" alt="">';
      return;
    }
    item.primary_photo_url = dataUrl;
    if (!item.photos) item.photos = [];
    if (item.photos.indexOf(dataUrl) === -1) item.photos.push(dataUrl);
    renderPrimaryPhoto(item);
    renderPhotoPool(item);
    scheduleSave();
  };
  reader.readAsDataURL(file);
}

function handleGalleryPhotos(files) {
  var item = getEditingItem();
  if (!item) return;

  Array.prototype.forEach.call(files, function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      if (!item.photos) item.photos = [];
      if (item.photos.indexOf(dataUrl) === -1) item.photos.push(dataUrl);
      if (!item.primary_photo_url) {
        item.primary_photo_url = dataUrl;
        renderPrimaryPhoto(item);
      }
      renderPhotoPool(item);
      scheduleSave();
    };
    reader.readAsDataURL(file);
  });
}

/* ===== DRAWER INPUT HANDLERS ===== */
function initDrawerInputs() {
  /* Auto-slug from name */
  var nameInput = document.getElementById('item-name');
  var slugInput = document.getElementById('item-slug');
  if (nameInput && slugInput) {
    nameInput.addEventListener('input', function() {
      slugInput.value = slugify(nameInput.value);
      var item = getEditingItem();
      if (item) { item.item_name = nameInput.value; item.slug = slugInput.value; scheduleSave(); }
    });
    slugInput.addEventListener('input', function() {
      var item = getEditingItem();
      if (item) { item.slug = slugInput.value; scheduleSave(); }
    });
  }

  /* Bind all drawer inputs to live-update the editing item */
  var drawerFields = {
    'item-name': 'item_name',
    'item-slug': 'slug',
    'item-description': 'description',
    'item-price': 'price',
    'item-sale-price': 'sale_price',
    'item-calories': 'calories',
    'item-prep-time': 'prep_time_minutes'
  };

  Object.keys(drawerFields).forEach(function(fieldId) {
    var el = document.getElementById(fieldId);
    if (!el) return;
    var prop = drawerFields[fieldId];
    el.addEventListener('input', function() {
      var item = getEditingItem();
      if (!item) return;
      if (el.type === 'number') {
        item[prop] = parseFloat(el.value) || (prop === 'sale_price' ? null : 0);
      } else {
        item[prop] = el.value;
      }
      scheduleSave();
    });
  });

  /* Checkboxes */
  ['is-vegetarian', 'is-vegan', 'is-gluten-free'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var prop = id.replace(/-/g, '_');
    el.addEventListener('change', function() {
      var item = getEditingItem();
      if (!item) return;
      item[prop] = el.checked;
      scheduleSave();
    });
  });

  /* Availability */
  var availEl = document.getElementById('is-available');
  if (availEl) {
    availEl.addEventListener('change', function() {
      var item = getEditingItem();
      if (!item) return;
      item.is_available = availEl.checked;
      scheduleSave();
    });
  }

  /* Spice slider */
  var spiceEl = document.getElementById('spice-level');
  if (spiceEl) {
    spiceEl.addEventListener('input', function() {
      var val = parseInt(spiceEl.value);
      document.getElementById('spice-label').textContent = SPICE_NAMES[val];
      var item = getEditingItem();
      if (item) { item.spice_level = val; scheduleSave(); }
    });
  }

  /* Photo uploads */
  var primaryInput = document.getElementById('primary-photo-input');
  if (primaryInput) {
    primaryInput.addEventListener('change', function() {
      if (this.files && this.files[0]) handlePrimaryPhoto(this.files[0]);
    });
  }

  var galleryInput = document.getElementById('gallery-photo-input');
  if (galleryInput) {
    galleryInput.addEventListener('change', function() {
      if (this.files && this.files.length > 0) handleGalleryPhotos(this.files);
    });
  }
}

/* ===== SAVE / DELETE ITEM ===== */
function saveItem() {
  var name = document.getElementById('item-name').value.trim();
  var price = parseFloat(document.getElementById('item-price').value);
  if (!name) { tool.notify('Item name is required', 'warning'); return; }
  if (isNaN(price) || price < 0) { tool.notify('Valid price is required', 'warning'); return; }

  if (editingItemId) {
    /* Update existing — values already synced via live listeners */
  } else {
    /* Create new item */
    var newItem = {
      id: uid(),
      category_id: selectedCategoryId || null,
      item_name: name,
      slug: slugify(name),
      description: document.getElementById('item-description').value,
      price: price,
      sale_price: parseFloat(document.getElementById('item-sale-price').value) || null,
      primary_photo_url: window._tempPrimaryPhoto || null,
      photos: window._tempPrimaryPhoto ? [window._tempPrimaryPhoto] : [],
      allergens: [],
      is_vegetarian: document.getElementById('is-vegetarian').checked,
      is_vegan: document.getElementById('is-vegan').checked,
      is_gluten_free: document.getElementById('is-gluten-free').checked,
      spice_level: parseInt(document.getElementById('spice-level').value),
      calories: parseInt(document.getElementById('item-calories').value) || null,
      prep_time_minutes: parseInt(document.getElementById('item-prep-time').value) || null,
      tags: [],
      modifier_group_ids: [],
      is_available: document.getElementById('is-available').checked
    };
    data.items.push(newItem);
    editingItemId = newItem.id;
    window._tempPrimaryPhoto = null;
  }

  closeDrawer();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Item saved', 'success');
}

function deleteItem() {
  if (!editingItemId) return;
  data.items = data.items.filter(function(i) { return i.id !== editingItemId; });
  closeDrawer();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Item deleted', 'info');
}

/* ===== BULK ACTIONS ===== */
function bulkMove() {
  var targetCatId = document.getElementById('bulk-category-select').value;
  if (!targetCatId || selectedItemIds.length === 0) return;
  selectedItemIds.forEach(function(id) {
    var item = data.items.find(function(i) { return i.id === id; });
    if (item) item.category_id = targetCatId;
  });
  clearSelection();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Items moved', 'success');
}

function bulkToggleAvailable() {
  selectedItemIds.forEach(function(id) {
    var item = data.items.find(function(i) { return i.id === id; });
    if (item) item.is_available = !item.is_available;
  });
  clearSelection();
  renderItems();
  scheduleSave();
  tool.notify('Items toggled', 'success');
}

function bulkDelete() {
  data.items = data.items.filter(function(i) { return selectedItemIds.indexOf(i.id) === -1; });
  clearSelection();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Items deleted', 'info');
}

/* ===== INIT EVENT DELEGATION ===== */
function initEvents() {
  /* Panel tabs */
  initPanelTabs();

  /* Category buttons */
  document.getElementById('add-category-btn').addEventListener('click', addCategory);
  document.getElementById('save-category-btn').addEventListener('click', function() {
    var input = document.getElementById('category-name-input');
    if (input.dataset.editCatId) saveCategoryEdit();
    else saveCategory();
  });
  document.getElementById('cancel-category-btn').addEventListener('click', function() {
    var input = document.getElementById('category-name-input');
    document.getElementById('category-form').style.display = 'none';
    input.value = '';
    delete input.dataset.editCatId;
  });

  /* Category input Enter key */
  document.getElementById('category-name-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      if (this.dataset.editCatId) saveCategoryEdit();
      else saveCategory();
    }
  });

  /* Modifier group buttons */
  document.getElementById('add-modgroup-btn').addEventListener('click', addModGroup);
  document.getElementById('save-modgroup-btn').addEventListener('click', saveModGroup);
  document.getElementById('cancel-modgroup-btn').addEventListener('click', function() {
    editingModGroupId = null;
    document.getElementById('modgroup-form').style.display = 'none';
    renderModGroups();
  });
  document.getElementById('add-modoption-btn').addEventListener('click', addModOption);

  /* Search & sort */
  document.getElementById('search-input').addEventListener('input', function() { renderItems(); });
  document.getElementById('sort-select').addEventListener('change', function() { renderItems(); });

  /* Filter chips */
  document.querySelectorAll('#filter-chips .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      if (activeFilter === chip.dataset.filter) {
        activeFilter = null;
      } else {
        activeFilter = chip.dataset.filter;
      }
      document.querySelectorAll('#filter-chips .chip').forEach(function(c) { c.classList.remove('active'); });
      if (activeFilter) chip.classList.add('active');
      renderItems();
    });
  });

  /* Item drawer */
  document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
  document.getElementById('cancel-item-btn').addEventListener('click', closeDrawer);
  document.getElementById('save-item-btn').addEventListener('click', saveItem);
  document.getElementById('delete-item-btn').addEventListener('click', deleteItem);

  /* Bulk actions */
  document.getElementById('bulk-move-btn').addEventListener('click', bulkMove);
  document.getElementById('bulk-toggle-btn').addEventListener('click', bulkToggleAvailable);
  document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);
  document.getElementById('bulk-clear-btn').addEventListener('click', clearSelection);

  /* Save all */
  document.getElementById('save-all-btn').addEventListener('click', saveNow);

  /* Init drawer live inputs */
  initDrawerInputs();

  /* Add item button — click on empty category area */
  document.getElementById('items-grid').addEventListener('dblclick', function() {
    /* Create item in current category */
    editingItemId = null;
    openItemDrawer(null);
  });
}

/* ===== MAIN RENDER ===== */
function render(value) {
  var incoming = value;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) incoming = {};
  data = deepMerge(DEFAULTS, incoming);
  if (!data.categories) data.categories = [];
  if (!data.items) data.items = [];
  if (!data.modifier_groups) data.modifier_groups = [];

  renderCategories();
  renderItems();
  renderModGroups();
  closeDrawer();
  tool.resize();
}

/* ===== BOOT ===== */
tool.onReady(function(val) {
  render(val);
  initEvents();
  if (tool.isReadOnly()) lockUI(true);
  tool.onValueChange(function(v) { render(v); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });
});

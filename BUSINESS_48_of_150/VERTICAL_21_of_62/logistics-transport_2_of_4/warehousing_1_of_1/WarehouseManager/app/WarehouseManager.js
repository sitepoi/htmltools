/* ── Warehouse Manager ──
   Product database, warehouse definitions, inventory counts,
   and invoice management with auto stock adjustment.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function fmtNum(n) { const v = Number(n); return isNaN(v) ? '0' : v.toLocaleString('en-US'); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

/* ── Default DB shape (compact keys) ── */
function defaultDB() {
  return {
    p: [],  // products: [{i, n, s, u, d}]
    w: [],  // warehouses: [{i, n, l}]
    v: [],  // inventory: [{p, w, q}]
    n: [],  // invoices: [{i, m, c, t, s, e:[{p, w, q}]}]
    _v: 1   // schema version
  };
}

/* ── State ── */
let DB = defaultDB();
let currentTab = 'products';
let isReadOnly = false;
let confirmCb = null;

/* ── DB Access Helpers ── */
function getProduct(id) { return DB.p.find(x => x.i === id); }
function getWarehouse(id) { return DB.w.find(x => x.i === id); }
function getInvoice(id) { return DB.n.find(x => x.i === id); }
function getInventory(productId, warehouseId) {
  return DB.v.find(x => x.p === productId && x.w === warehouseId);
}
function getInventoryQty(productId, warehouseId) {
  const inv = getInventory(productId, warehouseId);
  return inv ? inv.q : 0;
}
function setInventory(productId, warehouseId, qty) {
  const inv = getInventory(productId, warehouseId);
  if (inv) {
    inv.q = qty;
  } else {
    DB.v.push({ p: productId, w: warehouseId, q: qty });
  }
}

/* ── Invoice Stock Impact ── */
function getInvoiceStockImpact(invoice) {
  // Returns the net quantity change this invoice causes.
  // draft → no impact, sent/paid → negative (consumed), cancelled → no impact (restored)
  if (invoice.s === 'sent' || invoice.s === 'paid') {
    return -1; // items are consumed
  }
  return 0; // draft or cancelled — no net consumption
}

function computeEffectiveInventory(productId, warehouseId) {
  // Base inventory + sum of invoice impacts
  let base = getInventoryQty(productId, warehouseId);
  // The inventory already reflects manual counts. Invoices adjust it.
  // We calculate: base - (sum of sent/paid invoice items for this product+warehouse)
  // But wait — the base inventory should already have been adjusted when invoices changed status.
  // So we just return the base. Invoice status changes adjust the inventory in-place.
  return base;
}

function applyInvoiceToInventory(invoice, multiplier) {
  // multiplier: +1 when invoice becomes sent/paid (subtract from stock)
  //             -1 when invoice becomes cancelled (add back to stock)
  (invoice.e || []).forEach(item => {
    const qty = (item.q || 0) * multiplier;
    const cur = getInventoryQty(item.p, item.w);
    setInventory(item.p, item.w, Math.max(0, cur - qty));
  });
}

function handleInvoiceStatusChange(invoice, oldStatus, newStatus) {
  // Determine net change to apply
  // oldStatus impact → newStatus impact
  const oldImpact = (oldStatus === 'sent' || oldStatus === 'paid') ? 1 : 0; // 1 means items were subtracted
  const newImpact = (newStatus === 'sent' || newStatus === 'paid') ? 1 : 0;

  if (oldImpact === newImpact) return; // no change in consumption state

  if (!oldImpact && newImpact) {
    // draft/cancelled → sent/paid: subtract items
    applyInvoiceToInventory(invoice, 1);
  } else if (oldImpact && !newImpact) {
    // sent/paid → draft/cancelled: restore items
    applyInvoiceToInventory(invoice, -1);
  }
}

/* ── Persistence ── */
function persist() {
  tool.setValue(DB);
  updateSizeIndicator();
}

function loadData(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    DB = Object.assign(defaultDB(), val);
    // Ensure all arrays exist
    if (!Array.isArray(DB.p)) DB.p = [];
    if (!Array.isArray(DB.w)) DB.w = [];
    if (!Array.isArray(DB.v)) DB.v = [];
    if (!Array.isArray(DB.n)) DB.n = [];
  } else {
    DB = defaultDB();
  }
}

/* ── Size Estimation ── */
function estimateSize() {
  try {
    return new Blob([JSON.stringify(DB)]).size;
  } catch (e) {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function updateSizeIndicator() {
  const sz = estimateSize();
  const ind = el('sizeIndicator');
  if (!ind) return;
  ind.textContent = formatSize(sz);
  ind.className = 'size-indicator ' + (sz > 900000 ? 'danger' : sz > 500000 ? 'warn' : 'ok');
  ind.title = 'Document size: ' + formatSize(sz) + ' (Firestore limit: 1 MB)';
}

/* ── Toast ── */
function toast(msg, severity) {
  severity = severity || 'info';
  const container = el('toastContainer');
  const div = document.createElement('div');
  div.className = 'toast toast-' + severity;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => { div.remove(); }, 3000);
}

/* ── Confirm Dialog ── */
function showConfirm(message, cb) {
  confirmCb = cb;
  el('confirmBody').textContent = message;
  el('confirmFooter').innerHTML =
    '<button class="btn btn-outline btn-sm" id="confirmCancel">Cancel</button>' +
    '<button class="btn btn-red btn-sm" id="confirmOk">Confirm</button>';
  el('confirmOverlay').style.display = 'flex';
  el('confirmCancel').onclick = closeConfirm;
  el('confirmOk').onclick = () => { closeConfirm(); if (confirmCb) confirmCb(); };
}

function closeConfirm() {
  el('confirmOverlay').style.display = 'none';
  confirmCb = null;
}

el('confirmClose').onclick = closeConfirm;
el('confirmOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeConfirm();
});

/* ── Modal ── */
function openModal(title, bodyHTML, footerHTML) {
  el('modalTitle').textContent = title;
  el('modalBody').innerHTML = bodyHTML;
  el('modalFooter').innerHTML = footerHTML || '';
  el('modalOverlay').style.display = 'flex';
}

function closeModal() {
  el('modalOverlay').style.display = 'none';
}

el('modalClose').onclick = closeModal;
el('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

/* ── Tab Navigation ── */
function switchTab(tab) {
  currentTab = tab;
  qsa('.tb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderCurrentTab();
}

el('topbarTabs').addEventListener('click', function(e) {
  const btn = e.target.closest('.tb-tab');
  if (!btn || isReadOnly && false) return; // allow tab switching in readonly
  switchTab(btn.dataset.tab);
});

/* ── Render: Products ── */
function renderProducts() {
  const searchTerm = (el('prodSearch') ? el('prodSearch').value : '').toLowerCase();
  let items = DB.p;
  if (searchTerm) {
    items = items.filter(x =>
      (x.n || '').toLowerCase().includes(searchTerm) ||
      (x.s || '').toLowerCase().includes(searchTerm)
    );
  }

  let rows = '';
  if (items.length === 0) {
    rows = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No products found</div><div class="empty-state-sub">Add your first product to get started</div></div></td></tr>';
  } else {
    items.forEach(prod => {
      rows += `<tr>
        <td><strong>${esc(prod.n)}</strong></td>
        <td><code>${esc(prod.s || '—')}</code></td>
        <td>${esc(prod.u || 'pcs')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(prod.d || '—')}</td>
        <td class="col-actions">
          <button class="btn btn-xs btn-outline" data-action="edit-product" data-id="${esc(prod.i)}" ${isReadOnly ? 'disabled' : ''}>✏️</button>
          <button class="btn btn-xs btn-outline" data-action="delete-product" data-id="${esc(prod.i)}" style="color:var(--red)" ${isReadOnly ? 'disabled' : ''}>🗑️</button>
        </td>
      </tr>`;
    });
  }

  el('mainContent').innerHTML = `
    <div class="page-header">
      <span class="page-title">📦 Products (${DB.p.length})</span>
      <div class="page-actions">
        <button class="btn btn-accent btn-sm" id="btnAddProduct" ${isReadOnly ? 'disabled' : ''}>+ Add Product</button>
      </div>
    </div>
    <div class="search-bar">
      <input class="search-input" id="prodSearch" type="text" placeholder="Search products..." value="${esc(searchTerm)}">
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Product Name</th><th>SKU</th><th>Unit</th><th>Description</th><th class="col-actions">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Bind events
  if (!isReadOnly) {
    el('btnAddProduct').onclick = () => openProductModal();
    el('prodSearch').addEventListener('input', renderProducts);
  }
  qsa('[data-action="edit-product"]').forEach(btn => {
    btn.onclick = () => openProductModal(btn.dataset.id);
  });
  qsa('[data-action="delete-product"]').forEach(btn => {
    btn.onclick = () => {
      const prod = getProduct(btn.dataset.id);
      if (!prod) return;
      showConfirm(`Delete product "${prod.n}"? This will also remove all inventory entries for this product.`, () => {
        DB.v = DB.v.filter(x => x.p !== btn.dataset.id);
        DB.n.forEach(inv => { inv.e = (inv.e || []).filter(x => x.p !== btn.dataset.id); });
        DB.p = DB.p.filter(x => x.i !== btn.dataset.id);
        persist();
        renderProducts();
        toast('Product deleted', 'success');
      });
    };
  });
}

function openProductModal(editId) {
  const prod = editId ? getProduct(editId) : null;
  const title = prod ? 'Edit Product' : 'Add Product';
  const data = prod || { n: '', s: '', u: 'pcs', d: '' };

  openModal(title, `
    <div class="form-group">
      <label class="form-label">Product Name *</label>
      <input class="form-input" id="mfName" value="${esc(data.n)}" placeholder="e.g. Widget A">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">SKU / Code</label>
        <input class="form-input" id="mfSku" value="${esc(data.s)}" placeholder="e.g. WGT-001">
      </div>
      <div class="form-group">
        <label class="form-label">Unit</label>
        <input class="form-input" id="mfUnit" value="${esc(data.u)}" placeholder="e.g. pcs, kg, m">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="mfDesc" placeholder="Optional description...">${esc(data.d)}</textarea>
    </div>
  `, `
    <button class="btn btn-outline btn-sm" id="modalCancel">Cancel</button>
    <button class="btn btn-accent btn-sm" id="modalSave">${prod ? 'Update' : 'Add'} Product</button>
  `);

  el('modalCancel').onclick = closeModal;
  el('modalSave').onclick = () => {
    const name = (el('mfName').value || '').trim();
    if (!name) { toast('Product name is required', 'error'); return; }
    const entry = {
      i: prod ? prod.i : genId(),
      n: name,
      s: (el('mfSku').value || '').trim(),
      u: (el('mfUnit').value || '').trim() || 'pcs',
      d: (el('mfDesc').value || '').trim()
    };
    if (prod) {
      // Update in-place
      Object.assign(prod, entry);
    } else {
      DB.p.push(entry);
    }
    persist();
    closeModal();
    renderProducts();
    toast(prod ? 'Product updated' : 'Product added', 'success');
  };
}

/* ── Render: Warehouses ── */
function renderWarehouses() {
  let rows = '';
  if (DB.w.length === 0) {
    rows = '<tr><td colspan="3"><div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">No warehouses defined</div><div class="empty-state-sub">Add warehouses to track inventory locations</div></div></td></tr>';
  } else {
    DB.w.forEach(wh => {
      const invCount = DB.v.filter(x => x.w === wh.i).length;
      rows += `<tr>
        <td><strong>${esc(wh.n)}</strong></td>
        <td>${esc(wh.l || '—')}</td>
        <td>${invCount} product(s) tracked</td>
        <td class="col-actions">
          <button class="btn btn-xs btn-outline" data-action="edit-warehouse" data-id="${esc(wh.i)}" ${isReadOnly ? 'disabled' : ''}>✏️</button>
          <button class="btn btn-xs btn-outline" data-action="delete-warehouse" data-id="${esc(wh.i)}" style="color:var(--red)" ${isReadOnly ? 'disabled' : ''}>🗑️</button>
        </td>
      </tr>`;
    });
  }

  el('mainContent').innerHTML = `
    <div class="page-header">
      <span class="page-title">🏗️ Warehouses (${DB.w.length})</span>
      <div class="page-actions">
        <button class="btn btn-accent btn-sm" id="btnAddWarehouse" ${isReadOnly ? 'disabled' : ''}>+ Add Warehouse</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Warehouse Name</th><th>Location</th><th>Products</th><th class="col-actions">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  if (!isReadOnly) {
    el('btnAddWarehouse').onclick = () => openWarehouseModal();
  }
  qsa('[data-action="edit-warehouse"]').forEach(btn => {
    btn.onclick = () => openWarehouseModal(btn.dataset.id);
  });
  qsa('[data-action="delete-warehouse"]').forEach(btn => {
    btn.onclick = () => {
      const wh = getWarehouse(btn.dataset.id);
      if (!wh) return;
      showConfirm(`Delete warehouse "${wh.n}"? All inventory entries and invoice items for this warehouse will also be removed.`, () => {
        DB.v = DB.v.filter(x => x.w !== btn.dataset.id);
        DB.n.forEach(inv => { inv.e = (inv.e || []).filter(x => x.w !== btn.dataset.id); });
        DB.w = DB.w.filter(x => x.i !== btn.dataset.id);
        persist();
        renderWarehouses();
        toast('Warehouse deleted', 'success');
      });
    };
  });
}

function openWarehouseModal(editId) {
  const wh = editId ? getWarehouse(editId) : null;
  const title = wh ? 'Edit Warehouse' : 'Add Warehouse';
  const data = wh || { n: '', l: '' };

  openModal(title, `
    <div class="form-group">
      <label class="form-label">Warehouse Name *</label>
      <input class="form-input" id="mfWName" value="${esc(data.n)}" placeholder="e.g. Main Warehouse">
    </div>
    <div class="form-group">
      <label class="form-label">Location</label>
      <input class="form-input" id="mfWLoc" value="${esc(data.l)}" placeholder="e.g. Building A, Floor 2">
    </div>
  `, `
    <button class="btn btn-outline btn-sm" id="modalCancel">Cancel</button>
    <button class="btn btn-accent btn-sm" id="modalSave">${wh ? 'Update' : 'Add'} Warehouse</button>
  `);

  el('modalCancel').onclick = closeModal;
  el('modalSave').onclick = () => {
    const name = (el('mfWName').value || '').trim();
    if (!name) { toast('Warehouse name is required', 'error'); return; }
    const entry = {
      i: wh ? wh.i : genId(),
      n: name,
      l: (el('mfWLoc').value || '').trim()
    };
    if (wh) {
      Object.assign(wh, entry);
    } else {
      DB.w.push(entry);
    }
    persist();
    closeModal();
    renderWarehouses();
    toast(wh ? 'Warehouse updated' : 'Warehouse added', 'success');
  };
}

/* ── Render: Inventory ── */
function renderInventory() {
  const products = DB.p;
  const warehouses = DB.w;

  if (products.length === 0 || warehouses.length === 0) {
    el('mainContent').innerHTML = `
      <div class="page-header">
        <span class="page-title">📊 Inventory</span>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">${products.length === 0 ? 'Add products' : 'Add warehouses'} to start tracking inventory</div>
        <div class="empty-state-sub">You need at least one product and one warehouse</div>
      </div>`;
    return;
  }

  // Build table
  let headCells = '<th>Product</th>';
  warehouses.forEach(w => { headCells += `<th>${esc(w.n)}</th>`; });
  headCells += '<th style="text-align:center">Total</th>';

  let bodyRows = '';
  products.forEach(prod => {
    let row = `<td><strong>${esc(prod.n)}</strong><br><span style="font-size:10px;color:var(--text3)">${esc(prod.s || '—')}</span></td>`;
    let total = 0;
    warehouses.forEach(wh => {
      const qty = getInventoryQty(prod.i, wh.i);
      total += qty;
      const cls = qty === 0 ? 'zero' : qty < 10 ? 'low' : 'ok';
      row += `<td><span class="inv-cell ${cls}" data-product="${esc(prod.i)}" data-warehouse="${esc(wh.i)}" ${isReadOnly ? '' : 'title="Click to edit"'} data-qty="${qty}">${fmtNum(qty)}</span></td>`;
    });
    row += `<td style="text-align:center;font-weight:700;font-family:var(--mono)">${fmtNum(total)}</td>`;
    bodyRows += `<tr>${row}</tr>`;
  });

  // Warehouse totals row
  let whTotalRow = '<td style="font-weight:700;color:var(--text2)">Warehouse Total</td>';
  warehouses.forEach(wh => {
    let wTotal = 0;
    products.forEach(prod => { wTotal += getInventoryQty(prod.i, wh.i); });
    whTotalRow += `<td style="text-align:center;font-weight:700;font-family:var(--mono);color:var(--text2)">${fmtNum(wTotal)}</td>`;
  });
  whTotalRow += '<td></td>';

  el('mainContent').innerHTML = `
    <div class="page-header">
      <span class="page-title">📊 Inventory Matrix</span>
      <div class="page-actions">
        <button class="btn btn-outline btn-sm" id="btnBulkUpdate" ${isReadOnly ? 'disabled' : ''}>📝 Bulk Update</button>
      </div>
    </div>
    <div class="inv-grid-wrap">
      <table class="inv-grid">
        <thead><tr>${headCells}</tr></thead>
        <tbody>${bodyRows}<tr style="background:var(--surface2)">${whTotalRow}</tr></tbody>
      </table>
    </div>`;

  // Click to edit inventory cell
  if (!isReadOnly) {
    qsa('.inv-cell').forEach(cell => {
      cell.addEventListener('click', function() {
        const productId = this.dataset.product;
        const warehouseId = this.dataset.warehouse;
        const curQty = getInventoryQty(productId, warehouseId);
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'inv-cell-input';
        input.value = curQty;
        input.min = '0';
        input.addEventListener('blur', function() {
          const newQty = clamp(parseInt(this.value) || 0, 0, 999999);
          setInventory(productId, warehouseId, newQty);
          persist();
          renderInventory();
        });
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') this.blur();
          if (e.key === 'Escape') { renderInventory(); }
        });
        this.innerHTML = '';
        this.appendChild(input);
        input.focus();
        input.select();
      });
    });

    el('btnBulkUpdate').onclick = openBulkInventoryModal;
  }
}

function openBulkInventoryModal() {
  const products = DB.p;
  const warehouses = DB.w;
  if (products.length === 0 || warehouses.length === 0) return;

  let rows = '';
  products.forEach(prod => {
    warehouses.forEach(wh => {
      const qty = getInventoryQty(prod.i, wh.i);
      rows += `<tr>
        <td>${esc(prod.n)}</td>
        <td>${esc(wh.n)}</td>
        <td><input type="number" class="bulk-inv-input" data-p="${esc(prod.i)}" data-w="${esc(wh.i)}" value="${qty}" min="0" style="width:80px;padding:4px 6px;border:1px solid var(--border);border-radius:var(--r3);text-align:center;font-family:var(--mono);font-size:12px"></td>
      </tr>`;
    });
  });

  openModal('Bulk Inventory Update', `
    <div class="table-wrap" style="max-height:50vh;overflow-y:auto">
      <table>
        <thead><tr><th>Product</th><th>Warehouse</th><th>Quantity</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `, `
    <button class="btn btn-outline btn-sm" id="modalCancel">Cancel</button>
    <button class="btn btn-accent btn-sm" id="modalBulkSave">Save All</button>
  `);

  el('modalCancel').onclick = closeModal;
  el('modalBulkSave').onclick = () => {
    qsa('.bulk-inv-input').forEach(input => {
      const qty = clamp(parseInt(input.value) || 0, 0, 999999);
      setInventory(input.dataset.p, input.dataset.w, qty);
    });
    persist();
    closeModal();
    renderInventory();
    toast('Inventory updated', 'success');
  };
}

/* ── Render: Invoices ── */
function renderInvoices() {
  const searchTerm = (el('invSearch') ? el('invSearch').value : '').toLowerCase();
  const statusFilter = el('invStatusFilter') ? el('invStatusFilter').value : 'all';
  let items = DB.n;

  if (searchTerm) {
    items = items.filter(x =>
      (x.m || '').toLowerCase().includes(searchTerm) ||
      (x.c || '').toLowerCase().includes(searchTerm)
    );
  }
  if (statusFilter !== 'all') {
    items = items.filter(x => x.s === statusFilter);
  }
  // Sort by date desc
  items = [...items].sort((a, b) => (b.t || '').localeCompare(a.t || ''));

  // Stats
  const totalInvoices = DB.n.length;
  const draftCount = DB.n.filter(x => x.s === 'draft').length;
  const sentCount = DB.n.filter(x => x.s === 'sent').length;
  const paidCount = DB.n.filter(x => x.s === 'paid').length;
  const cancelledCount = DB.n.filter(x => x.s === 'cancelled').length;

  let rows = '';
  if (items.length === 0) {
    rows = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-text">No invoices found</div><div class="empty-state-sub">Create your first invoice to track shipments</div></div></td></tr>';
  } else {
    items.forEach(inv => {
      const itemCount = (inv.e || []).length;
      const totalQty = (inv.e || []).reduce((s, x) => s + (x.q || 0), 0);
      const statusLabel = { draft: 'Draft', sent: 'Sent', paid: 'Paid', cancelled: 'Cancelled' }[inv.s] || inv.s;
      rows += `<tr>
        <td><strong>${esc(inv.m)}</strong></td>
        <td>${esc(inv.c || '—')}</td>
        <td>${esc(inv.t || '—')}</td>
        <td><span class="badge badge-${esc(inv.s)}">${statusLabel}</span></td>
        <td>${itemCount} lines</td>
        <td>${fmtNum(totalQty)} items</td>
        <td class="col-actions">
          <button class="btn btn-xs btn-outline" data-action="view-invoice" data-id="${esc(inv.i)}">👁️</button>
          <button class="btn btn-xs btn-outline" data-action="edit-invoice" data-id="${esc(inv.i)}" ${isReadOnly ? 'disabled' : ''}>✏️</button>
          <button class="btn btn-xs btn-outline" data-action="delete-invoice" data-id="${esc(inv.i)}" style="color:var(--red)" ${isReadOnly ? 'disabled' : ''}>🗑️</button>
        </td>
      </tr>`;
    });
  }

  el('mainContent').innerHTML = `
    <div class="page-header">
      <span class="page-title">🧾 Invoices</span>
      <div class="page-actions">
        <button class="btn btn-accent btn-sm" id="btnAddInvoice" ${isReadOnly ? 'disabled' : ''}>+ New Invoice</button>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${totalInvoices}</div></div>
      <div class="stat-card"><div class="stat-label">Draft</div><div class="stat-value" style="color:var(--text2)">${draftCount}</div></div>
      <div class="stat-card"><div class="stat-label">Sent</div><div class="stat-value" style="color:var(--blue)">${sentCount}</div></div>
      <div class="stat-card"><div class="stat-label">Paid</div><div class="stat-value" style="color:var(--green)">${paidCount}</div></div>
      <div class="stat-card"><div class="stat-label">Cancelled</div><div class="stat-value" style="color:var(--red)">${cancelledCount}</div></div>
    </div>
    <div class="search-bar">
      <input class="search-input" id="invSearch" type="text" placeholder="Search by invoice # or client..." value="${esc(searchTerm)}">
      <select class="form-select" id="invStatusFilter" style="max-width:150px">
        <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Status</option>
        <option value="draft" ${statusFilter === 'draft' ? 'selected' : ''}>Draft</option>
        <option value="sent" ${statusFilter === 'sent' ? 'selected' : ''}>Sent</option>
        <option value="paid" ${statusFilter === 'paid' ? 'selected' : ''}>Paid</option>
        <option value="cancelled" ${statusFilter === 'cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Status</th><th>Lines</th><th>Items</th><th class="col-actions">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Bind events
  if (!isReadOnly) {
    el('btnAddInvoice').onclick = () => openInvoiceModal();
    el('invSearch').addEventListener('input', renderInvoices);
    el('invStatusFilter').addEventListener('change', renderInvoices);
  }

  qsa('[data-action="view-invoice"]').forEach(btn => {
    btn.onclick = () => viewInvoice(btn.dataset.id);
  });
  qsa('[data-action="edit-invoice"]').forEach(btn => {
    btn.onclick = () => openInvoiceModal(btn.dataset.id);
  });
  qsa('[data-action="delete-invoice"]').forEach(btn => {
    btn.onclick = () => {
      const inv = getInvoice(btn.dataset.id);
      if (!inv) return;
      showConfirm(`Delete invoice "${inv.m}"? If it was sent/paid, inventory will be restored.`, () => {
        // Restore inventory if invoice was active
        if (inv.s === 'sent' || inv.s === 'paid') {
          applyInvoiceToInventory(inv, -1);
        }
        DB.n = DB.n.filter(x => x.i !== btn.dataset.id);
        persist();
        renderInvoices();
        toast('Invoice deleted', 'success');
      });
    };
  });
}

function generateInvoiceNumber() {
  const count = DB.n.length + 1;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `INV-${yy}${mm}-${String(count).padStart(4, '0')}`;
}

function openInvoiceModal(editId) {
  const products = DB.p;
  const warehouses = DB.w;
  if (products.length === 0) { toast('Add at least one product first', 'warning'); return; }
  if (warehouses.length === 0) { toast('Add at least one warehouse first', 'warning'); return; }

  const inv = editId ? getInvoice(editId) : null;
  const title = inv ? 'Edit Invoice' : 'New Invoice';
  const data = inv || { m: generateInvoiceNumber(), c: '', t: new Date().toISOString().slice(0, 10), s: 'draft', e: [] };

  // Build product/warehouse options
  let prodOpts = products.map(p => `<option value="${esc(p.i)}">${esc(p.n)} (${esc(p.s || '—')})</option>`).join('');
  let whOpts = warehouses.map(w => `<option value="${esc(w.i)}">${esc(w.n)}</option>`).join('');

  // Build items rows
  let itemsRows = '';
  (data.e || []).forEach((item, idx) => {
    itemsRows += `<tr class="invoice-item-row">
      <td><select class="inv-item-product">${prodOpts.replace(`value="${esc(item.p)}"`, `value="${esc(item.p)}" selected`)}</select></td>
      <td><select class="inv-item-warehouse">${whOpts.replace(`value="${esc(item.w)}"`, `value="${esc(item.w)}" selected`)}</select></td>
      <td><input type="number" class="inv-item-qty" value="${item.q || 0}" min="1"></td>
      <td><button class="btn btn-xs btn-outline inv-item-remove" style="color:var(--red)">✕</button></td>
    </tr>`;
  });

  openModal(title, `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Invoice Number *</label>
        <input class="form-input" id="mfInvNum" value="${esc(data.m)}" placeholder="INV-...">
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="mfInvDate" value="${esc(data.t)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Client Name</label>
        <input class="form-input" id="mfInvClient" value="${esc(data.c)}" placeholder="Client name...">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="mfInvStatus">
          <option value="draft" ${data.s === 'draft' ? 'selected' : ''}>📝 Draft</option>
          <option value="sent" ${data.s === 'sent' ? 'selected' : ''}>📤 Sent</option>
          <option value="paid" ${data.s === 'paid' ? 'selected' : ''}>✅ Paid</option>
          <option value="cancelled" ${data.s === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Invoice Items</label>
      <button class="btn btn-xs btn-outline" id="btnAddItem" style="margin-bottom:6px">+ Add Item</button>
      <div class="table-wrap" style="max-height:250px;overflow-y:auto">
        <table class="invoice-items-table">
          <thead><tr><th>Product</th><th>Warehouse</th><th>Qty</th><th></th></tr></thead>
          <tbody id="invItemsBody">${itemsRows || '<tr id="noItemsRow"><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">No items added yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `, `
    <button class="btn btn-outline btn-sm" id="modalCancel">Cancel</button>
    <button class="btn btn-accent btn-sm" id="modalSave">${inv ? 'Update' : 'Create'} Invoice</button>
  `);

  // Store old status for change detection
  const oldStatus = data.s;

  el('modalCancel').onclick = closeModal;

  // Add item button
  el('btnAddItem').onclick = () => {
    const noRow = el('noItemsRow');
    if (noRow) noRow.remove();
    const tbody = el('invItemsBody');
    const row = document.createElement('tr');
    row.className = 'invoice-item-row';
    row.innerHTML = `
      <td><select class="inv-item-product">${prodOpts}</select></td>
      <td><select class="inv-item-warehouse">${whOpts}</select></td>
      <td><input type="number" class="inv-item-qty" value="1" min="1"></td>
      <td><button class="btn btn-xs btn-outline inv-item-remove" style="color:var(--red)">✕</button></td>`;
    row.querySelector('.inv-item-remove').onclick = () => {
      row.remove();
      if (tbody.querySelectorAll('.invoice-item-row').length === 0) {
        tbody.innerHTML = '<tr id="noItemsRow"><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">No items added yet</td></tr>';
      }
    };
    tbody.appendChild(row);
  };

  // Remove item handlers for existing rows
  qsa('.inv-item-remove').forEach(btn => {
    btn.onclick = function() {
      const row = this.closest('.invoice-item-row');
      if (row) row.remove();
      const tbody = el('invItemsBody');
      if (tbody && tbody.querySelectorAll('.invoice-item-row').length === 0) {
        tbody.innerHTML = '<tr id="noItemsRow"><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">No items added yet</td></tr>';
      }
    };
  });

  // Save
  el('modalSave').onclick = () => {
    const num = (el('mfInvNum').value || '').trim();
    if (!num) { toast('Invoice number is required', 'error'); return; }

    // Collect items
    const itemRows = qsa('.invoice-item-row');
    const items = [];
    itemRows.forEach(row => {
      const prodSel = row.querySelector('.inv-item-product');
      const whSel = row.querySelector('.inv-item-warehouse');
      const qtyInput = row.querySelector('.inv-item-qty');
      if (prodSel && whSel && qtyInput) {
        const qty = parseInt(qtyInput.value) || 0;
        if (qty > 0) {
          items.push({ p: prodSel.value, w: whSel.value, q: qty });
        }
      }
    });

    if (items.length === 0) { toast('Add at least one item', 'warning'); return; }

    const newStatus = el('mfInvStatus').value;

    const entry = {
      i: inv ? inv.i : genId(),
      m: num,
      c: (el('mfInvClient').value || '').trim(),
      t: el('mfInvDate').value,
      s: newStatus,
      e: items
    };

    if (inv) {
      // Handle status change impact on inventory
      handleInvoiceStatusChange(inv, oldStatus, newStatus);
      Object.assign(inv, entry);
    } else {
      DB.n.push(entry);
      // If new invoice is immediately sent/paid, subtract from inventory
      if (entry.s === 'sent' || entry.s === 'paid') {
        applyInvoiceToInventory(entry, 1);
      }
    }

    persist();
    closeModal();
    renderInvoices();
    toast(inv ? 'Invoice updated' : 'Invoice created', 'success');
  };
}

function viewInvoice(invoiceId) {
  const inv = getInvoice(invoiceId);
  if (!inv) return;

  const products = DB.p;
  const warehouses = DB.w;
  const statusLabel = { draft: 'Draft', sent: 'Sent', paid: 'Paid', cancelled: 'Cancelled' }[inv.s] || inv.s;

  let itemsRows = '';
  (inv.e || []).forEach(item => {
    const prod = getProduct(item.p);
    const wh = getWarehouse(item.w);
    itemsRows += `<tr>
      <td>${esc(prod ? prod.n : 'Unknown')}</td>
      <td>${esc(wh ? wh.n : 'Unknown')}</td>
      <td>${fmtNum(item.q)} ${esc(prod ? prod.u : '')}</td>
    </tr>`;
  });

  const totalQty = (inv.e || []).reduce((s, x) => s + (x.q || 0), 0);

  openModal(`Invoice ${esc(inv.m)}`, `
    <div class="info-grid">
      <div class="info-item"><div class="info-item-label">Status</div><div class="info-item-value"><span class="badge badge-${esc(inv.s)}">${statusLabel}</span></div></div>
      <div class="info-item"><div class="info-item-label">Client</div><div class="info-item-value" style="font-family:var(--font)">${esc(inv.c || '—')}</div></div>
      <div class="info-item"><div class="info-item-label">Date</div><div class="info-item-value" style="font-family:var(--font)">${esc(inv.t || '—')}</div></div>
      <div class="info-item"><div class="info-item-label">Total Items</div><div class="info-item-value">${fmtNum(totalQty)}</div></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Product</th><th>Warehouse</th><th>Quantity</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </div>
  `, `<button class="btn btn-outline btn-sm" id="modalCancel">Close</button>`);
  el('modalCancel').onclick = closeModal;
}

/* ── Render: Data Info ── */
function renderInfo() {
  const sz = estimateSize();
  const pct = ((sz / 1048576) * 100).toFixed(1);
  const sizeStatus = sz > 900000 ? '⚠️ Critical — near 1 MB limit!' : sz > 500000 ? '⚠️ Moderate — monitor your data' : '✅ Healthy';

  // Count total invoice items
  const totalInvoiceItems = DB.n.reduce((s, inv) => s + (inv.e || []).length, 0);
  const totalInventoryEntries = DB.v.length;
  const totalStockQty = DB.v.reduce((s, x) => s + (x.q || 0), 0);

  el('mainContent').innerHTML = `
    <div class="page-header">
      <span class="page-title">ℹ️ Data & Storage Info</span>
    </div>

    <div class="info-section">
      <div class="info-section-title">📏 Document Size</div>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">Current Size</div>
          <div class="stat-value" style="color:${sz > 900000 ? 'var(--red)' : sz > 500000 ? 'var(--amber)' : 'var(--green)'}">${formatSize(sz)}</div>
          <div class="stat-sub">${pct}% of 1 MB limit</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Status</div>
          <div class="stat-value" style="font-size:14px;font-family:var(--font)">${sizeStatus}</div>
        </div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">📊 Record Counts</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-item-label">Products</div><div class="info-item-value">${DB.p.length}</div></div>
        <div class="info-item"><div class="info-item-label">Warehouses</div><div class="info-item-value">${DB.w.length}</div></div>
        <div class="info-item"><div class="info-item-label">Inventory Entries</div><div class="info-item-value">${totalInventoryEntries}</div></div>
        <div class="info-item"><div class="info-item-label">Total Stock Qty</div><div class="info-item-value">${fmtNum(totalStockQty)}</div></div>
        <div class="info-item"><div class="info-item-label">Invoices</div><div class="info-item-value">${DB.n.length}</div></div>
        <div class="info-item"><div class="info-item-label">Invoice Items</div><div class="info-item-value">${totalInvoiceItems}</div></div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">💡 Size Management Tips</div>
      <div class="card" style="font-size:12px;color:var(--text2);line-height:1.7">
        <p><strong>1. Archive old invoices</strong> — Use the button below to remove paid/cancelled invoices older than a selected date. These are typically no longer needed for active inventory tracking.</p>
        <p><strong>2. Compact data format</strong> — This tool uses abbreviated JSON keys (p, w, v, n) to minimize storage. Each product ≈ 60 bytes, each invoice ≈ 300 bytes.</p>
        <p><strong>3. Monitor regularly</strong> — Keep the document under 500 KB for safe operation. At ~900 KB you risk hitting Firestore's 1 MB limit.</p>
        <p><strong>4. Use sibling fields</strong> — If you outgrow one field, ask your admin to create a second CMS field (e.g. "warehouse_archive") and store archived data there using <code>tool.setField()</code>.</p>
        <p><strong>5. Estimate:</strong> With ${DB.p.length} products, ${DB.w.length} warehouses, and ${DB.n.length} invoices, you can store approximately <strong>${Math.floor((1048576 - sz) / 350).toLocaleString()}</strong> more invoice lines before hitting the limit.</p>
      </div>
    </div>

    <div class="info-section" ${isReadOnly ? 'style="display:none"' : ''}>
      <div class="info-section-title">🛠️ Maintenance</div>
      <div class="card">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div class="form-group" style="flex:1;min-width:180px;margin-bottom:0">
            <label class="form-label">Archive invoices older than</label>
            <input type="date" class="form-input" id="archiveDate" value="${new Date(Date.now() - 90*86400000).toISOString().slice(0,10)}">
          </div>
          <div class="form-group" style="flex:1;min-width:180px;margin-bottom:0">
            <label class="form-label">With status</label>
            <select class="form-select" id="archiveStatus">
              <option value="paid">Paid only</option>
              <option value="cancelled">Cancelled only</option>
              <option value="both" selected>Paid & Cancelled</option>
            </select>
          </div>
          <button class="btn btn-outline btn-sm" id="btnPreviewArchive" style="align-self:flex-end">🔍 Preview</button>
          <button class="btn btn-red btn-sm" id="btnArchive" style="align-self:flex-end">🗄️ Archive & Remove</button>
        </div>
        <div id="archivePreview" style="margin-top:10px;font-size:11px;color:var(--text2)"></div>
      </div>
    </div>
  `;

  if (!isReadOnly) {
    el('btnPreviewArchive').onclick = () => {
      const cutoff = el('archiveDate').value;
      const statusFilter = el('archiveStatus').value;
      const candidates = DB.n.filter(inv => {
        if (inv.t >= cutoff) return false;
        if (statusFilter === 'paid' && inv.s !== 'paid') return false;
        if (statusFilter === 'cancelled' && inv.s !== 'cancelled') return false;
        if (statusFilter === 'both' && inv.s !== 'paid' && inv.s !== 'cancelled') return false;
        return true;
      });
      const lineCount = candidates.reduce((s, inv) => s + (inv.e || []).length, 0);
      el('archivePreview').innerHTML = candidates.length === 0
        ? '✅ No invoices match the criteria.'
        : `📋 <strong>${candidates.length}</strong> invoices (${lineCount} line items) would be removed. Estimated space freed: <strong>${formatSize(candidates.length * 350)}</strong>.`;
    };

    el('btnArchive').onclick = () => {
      const cutoff = el('archiveDate').value;
      const statusFilter = el('archiveStatus').value;
      const candidates = DB.n.filter(inv => {
        if (inv.t >= cutoff) return false;
        if (statusFilter === 'paid' && inv.s !== 'paid') return false;
        if (statusFilter === 'cancelled' && inv.s !== 'cancelled') return false;
        if (statusFilter === 'both' && inv.s !== 'paid' && inv.s !== 'cancelled') return false;
        return true;
      });
      if (candidates.length === 0) { toast('No invoices to archive', 'info'); return; }
      showConfirm(`Permanently remove ${candidates.length} archived invoices? This cannot be undone.`, () => {
        // Already paid/cancelled invoices don't need inventory restoration
        DB.n = DB.n.filter(inv => {
          if (inv.t >= cutoff) return true;
          if (statusFilter === 'paid' && inv.s === 'paid') return false;
          if (statusFilter === 'cancelled' && inv.s === 'cancelled') return false;
          if (statusFilter === 'both' && (inv.s === 'paid' || inv.s === 'cancelled')) return false;
          return true;
        });
        persist();
        renderInfo();
        toast(`${candidates.length} invoices archived and removed`, 'success');
      });
    };
  }
}

/* ── Render Current Tab ── */
function renderCurrentTab() {
  switch (currentTab) {
    case 'products': renderProducts(); break;
    case 'warehouses': renderWarehouses(); break;
    case 'inventory': renderInventory(); break;
    case 'invoices': renderInvoices(); break;
    case 'info': renderInfo(); break;
    default: renderProducts();
  }
  tool.resize();
  updateSizeIndicator();
}

/* ── Lock/Unlock UI ── */
function lockUI(ro) {
  isReadOnly = !!ro;
  if (ro) {
    document.body.classList.add('readonly');
    el('readonlyBadge').style.display = '';
  } else {
    document.body.classList.remove('readonly');
    el('readonlyBadge').style.display = 'none';
  }
  renderCurrentTab();
}

/* ── INIT ── */
tool.onReady((val, fields) => {
  loadData(val);
  lockUI(tool.isReadOnly());
  renderCurrentTab();

  tool.onValueChange(v => {
    loadData(v);
    renderCurrentTab();
  });
  tool.onFieldsChange(f => {
    // Could react to sibling field changes here
  });
  tool.onReadonlyChange(ro => lockUI(ro));
});

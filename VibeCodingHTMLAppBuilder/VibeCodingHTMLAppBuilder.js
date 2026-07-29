/* ── VibeCoding HTML App Builder ──
   Chat-left + Code-right. Config as a right-side tab.
   Chat handles both initial generation & iterative refinement.
   Preview updates live on every code change.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ── State ── */
var DB = {
  toolName: '', toolDesc: '', requirements: '', audience: 'admin',
  storage: 'value', cmsTypes: '', cmsFields: '', siblingFields: 'no',
  features: ['ai'], featureNotes: '',
  layout: 'single-page', colorScheme: 'blue', themeSupport: 'light-only', styleNotes: '',
  code: { html: '', css: '', js: '' },
  history: [],
  chatMessages: [],  // legacy — migrated to CRUD sessions on first load
  _theme: 'light',
  activeSessionId: ''  // CRUD session ID — empty until first session created
};

var isReadOnly = false;
var currentTab = 'html';
var attachedFile = null; // { name, url, size, type, extractedText }
var interviewMode = false; // Guided interview mode — AI asks step-by-step questions
var _currentTemplate = null; // Currently viewed template in modal

/* ── Session State ── */
var _sessions = [];           // cached session objects from CRUD
var _activeSessionId = '';    // mirrors DB.activeSessionId
var _sessionsLoaded = false;  // true after first loadSessions completes
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';

/* ── Instance ID Resolution ──
   Each tool instance needs a stable, unique identifier so that chat sessions
   are isolated per CMS record AND per tool field instance within that record.

   Priority order for building the instance ID:
   1. Parent CMS record ID (from URL param, tool.param, or fields)
   2. A random suffix (unique per tool field instance, stored in DB)

   Result: "rec_<parentRecordId>_<randomSuffix>" or "inst_<random>" as fallback.
────────────────────────────────────────── */
function _resolveInstanceId() {
  // Already resolved with a stable ID that includes a parent record reference?
  if (DB._instanceId && DB._instanceId.length > 20) return DB._instanceId;

  var parentRecordId = '';

  // Source 1: URL query parameter (CMS may pass ?objectId=xxx or ?recordId=xxx)
  try {
    var qs = window.location.search || '';
    var m1 = qs.match(/[?&]objectId=([^&?#]+)/);
    var m2 = qs.match(/[?&]recordId=([^&?#]+)/);
    if (m1) parentRecordId = decodeURIComponent(m1[1]);
    else if (m2) parentRecordId = decodeURIComponent(m2[1]);
  } catch(e) { /* sandbox may block location access */ }

  // Source 2: tool.param('objectId') or tool.param('recordId')
  if (!parentRecordId) {
    try {
      var pid = tool.param('objectId', '');
      if (pid) parentRecordId = String(pid);
    } catch(e) {}
  }
  if (!parentRecordId) {
    try {
      var rid = tool.param('recordId', '');
      if (rid) parentRecordId = String(rid);
    } catch(e) {}
  }

  // Source 3: sibling fields may contain _id or id of the parent record
  if (!parentRecordId) {
    try {
      var fields = tool.getFields();
      if (fields) {
        if (fields._id) parentRecordId = String(fields._id);
        else if (fields.id) parentRecordId = String(fields.id);
      }
    } catch(e) {}
  }

  // Source 4: captured from _parentObjectId on a previously created session
  if (!parentRecordId && DB._parentRecordId) {
    parentRecordId = DB._parentRecordId;
  }

  // Build or rebuild the instance ID
  var randomSuffix = '';
  if (DB._instanceId && DB._instanceId.indexOf('_') !== -1) {
    // Extract existing random suffix if present
    var parts = DB._instanceId.split('_');
    if (parts.length >= 2) randomSuffix = parts[parts.length - 1];
  }
  if (!randomSuffix) {
    randomSuffix = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  if (parentRecordId) {
    DB._instanceId = 'rec_' + parentRecordId + '_' + randomSuffix;
  } else {
    DB._instanceId = 'inst_' + randomSuffix;
  }

  console.warn('[VIBECODING:INSTANCE] Resolved ID:', DB._instanceId,
    '| parentRecord:', parentRecordId || '(unknown)',
    '| URL:', (window.location.search || '(none)').substring(0, 80));
  persist();
  return DB._instanceId;
}

/* ── Template Store — 8 detailed pre-written prompts ── */
var TEMPLATES = [
  {
    id: 'invoice-manager', icon: '📊', category: 'Finance',
    title: 'Invoice Manager',
    desc: 'Create, track, and manage invoices with payment status, customer records, and PDF export.',
    prompt: 'I need a complete Invoice Management System for our organization.\n\n**Core Features:**\n- Create invoices with auto-generated invoice numbers (e.g. INV-001, INV-002)\n- Track invoice status: Draft → Sent → Paid → Overdue → Cancelled\n- Add line items with description, quantity, unit price, and auto-calculated total\n- Associate invoices with customers (name, email, phone, address)\n- Calculate subtotal, tax (configurable rate), and grand total automatically\n- Track due dates with visual overdue warnings (red highlight)\n- Full CRUD — create, view, edit, delete invoices\n\n**Views:**\n- Dashboard: total outstanding, paid this month, overdue count, recent invoices list\n- Invoice list: search, filter by status, sort by date or amount\n- Invoice detail: all line items, customer info, payment history\n- Create/Edit form with add/remove line items\n\n**Extra Features:**\n- Export invoice as PDF (print-friendly layout)\n- Send invoice directly to customer via email\n- Duplicate an existing invoice as new draft\n- Record payment with date, amount, and payment method\n\n**Data to Track:**\n- Invoice: number, customerName, customerEmail, issueDate, dueDate, lineItems (array), subtotal, taxRate, taxAmount, total, status, notes, paymentDate, paymentMethod\n- Dashboard counts and totals derived from invoice data\n\n**Users:** Finance team and office administrators\n**Style:** Professional, clean blue theme with light/dark mode support. Responsive layout.'
  },
  {
    id: 'task-tracker', icon: '✅', category: 'Projects',
    title: 'Task Tracker',
    desc: 'Kanban-style task board with columns, priorities, due dates, and team assignments.',
    prompt: 'I need a Task & Project Tracking tool for my team.\n\n**Core Features:**\n- Kanban board with columns: Backlog → To Do → In Progress → Review → Done\n- Each task has: title, description, priority (Low/Medium/High/Critical), due date, assignee\n- Drag tasks between columns (or use status dropdown)\n- Color-code by priority — red for critical, orange for high, blue for medium, gray for low\n- Task counter badges on each column header\n\n**Views:**\n- Board view: kanban columns side by side\n- List view: sortable table with all tasks\n- Task detail modal: full info, edit, delete, add notes\n- Quick-add form at the top of each column\n\n**Features:**\n- Filter by assignee, priority, or status\n- Search tasks by title or description\n- Due date warnings — overdue tasks highlighted in red\n- Assign tasks to team members (from permitted users list)\n- Task creation date and last modified timestamp\n\n**Data:**\n- Task: title, description, priority, status, assigneeName, assigneeId, dueDate, createdAt, updatedAt, notes\n\n**Users:** Team members, project managers\n**Style:** Clean, modern, light/dark themes. Board view should feel like Trello.'
  },
  {
    id: 'employee-directory', icon: '👥', category: 'HR',
    title: 'Employee Directory',
    desc: 'Searchable staff directory with contact info, department, role, and profile cards.',
    prompt: 'I need an Employee & Staff Directory for our organization.\n\n**Core Features:**\n- Directory listing with profile cards showing name, role, department, email, phone, photo (initials fallback)\n- Search by name, department, role, or any keyword\n- Filter by department or role\n- Sort by name, department, or join date\n- Click card to expand full profile details\n\n**Profile Details:**\n- Full name, job title, department, email, phone extension, office location\n- Manager name, direct reports count\n- Skills/tags, certifications\n- Join date, employee ID\n- Emergency contact (visible only on expanded view)\n\n**Features:**\n- Grid and list view toggle\n- Quick contact — click email to copy, click phone to copy\n- Export directory as CSV\n- Department summary stats (headcount per department)\n- Add/edit/remove employees (CRUD)\n\n**Data:**\n- Employee: firstName, lastName, title, department, email, phone, location, managerName, skills (array), certifications (array), joinDate, employeeId, emergencyContact, emergencyPhone\n\n**Users:** All staff, HR department\n**Style:** Professional, warm, accessible. Large readable cards with good contrast.'
  },
  {
    id: 'expense-reporter', icon: '💰', category: 'Finance',
    title: 'Expense Reporter',
    desc: 'Submit, track, and approve expense reports with receipt upload and budget tracking.',
    prompt: 'I need an Expense Report & Reimbursement tool.\n\n**Core Features:**\n- Create expense reports with date, category, description, amount, and receipt upload\n- Expense categories: Travel, Meals, Office Supplies, Software, Training, Other\n- Submit reports for approval workflow: Draft → Submitted → Approved → Rejected → Reimbursed\n- Approver can approve or reject with comments\n- Track reimbursement status and payment date\n\n**Views:**\n- My Expenses: list of user\'s own expense reports\n- Pending Approval: reports waiting for review (for managers)\n- All Expenses: full list with filters (for admins)\n- Summary dashboard: total submitted, approved, reimbursed this month\n\n**Features:**\n- Attach receipt files (PDF, image) via upload\n- Budget limit warnings per category\n- Email notification when report status changes\n- Export report as PDF for accounting\n- Multi-currency support with configurable rate\n\n**Data:**\n- Expense: date, category, description, amount, currency, receiptUrl, receiptName, status, submitterName, approverName, approverComment, submittedAt, approvedAt, reimbursedAt\n\n**Users:** All employees (submit), Managers (approve), Finance (audit)\n**Style:** Clean form-based, professional, with clear status indicators.'
  },
  {
    id: 'inventory-manager', icon: '📦', category: 'Operations',
    title: 'Inventory Manager',
    desc: 'Track stock levels, manage products, set reorder alerts, and log inventory movements.',
    prompt: 'I need an Inventory & Stock Management tool.\n\n**Core Features:**\n- Product catalog with SKU, name, description, category, unit price, cost price\n- Track current stock quantity per product\n- Low stock alerts — highlight when quantity falls below reorder threshold\n- Log inventory movements: Stock In (purchase), Stock Out (sale/use), Adjustment, Return\n- Each movement records date, quantity change, reason, and user\n\n**Views:**\n- Dashboard: total products, low stock count, total inventory value, recent movements\n- Product list: searchable, filterable, with stock status indicators\n- Product detail: full info, stock history log, quick adjust buttons\n- Movement log: full audit trail with filters\n\n**Features:**\n- Barcode/SKU search\n- Bulk stock adjustment\n- Export inventory report as CSV\n- Stock value calculation (quantity × cost price)\n- Category management\n- Expiry date tracking for perishable items\n\n**Data:**\n- Product: sku, name, description, category, unitPrice, costPrice, quantity, reorderLevel, expiryDate, location\n- Movement: productId, sku, type (in/out/adjust/return), quantity, reason, userName, timestamp\n\n**Users:** Warehouse staff, operations managers\n**Style:** Industrial, data-dense, with clear red/yellow/green stock indicators.'
  },
  {
    id: 'event-scheduler', icon: '📅', category: 'Planning',
    title: 'Event Scheduler',
    desc: 'Schedule meetings, track attendees, manage room bookings, and send reminders.',
    prompt: 'I need an Event & Meeting Scheduling tool.\n\n**Core Features:**\n- Calendar view showing all events (month, week, and list views)\n- Create events with title, date, start time, end time, location, description, organizer\n- Add attendees from permitted users list\n- Room/location booking with conflict detection\n- Recurring events: daily, weekly, bi-weekly, monthly\n\n**Views:**\n- Calendar: monthly grid with event dots, click to see day details\n- List: all upcoming events sorted by date\n- Day detail: all events for selected day with time slots\n- Event detail: full info, attendee list, edit, delete, send reminder\n\n**Features:**\n- Email reminders to attendees (configurable: 1 hour, 1 day, 1 week before)\n- Event type badges: Meeting, Training, Workshop, Social, Other\n- RSVP tracking: Accepted, Declined, Tentative\n- Export calendar as PDF for printing\n- Color coding by event type\n\n**Data:**\n- Event: title, type, date, startTime, endTime, location, description, organizer, attendees (array), recurring (boolean), recurrencePattern, reminderSent\n\n**Users:** All staff\n**Style:** Clean calendar aesthetic, professional, with subtle color accents per event type.'
  },
  {
    id: 'customer-crm', icon: '🤝', category: 'Sales',
    title: 'Customer CRM',
    desc: 'Manage customer contacts, track interactions, log notes, and monitor deal pipeline.',
    prompt: 'I need a Customer Relationship Management (CRM) tool.\n\n**Core Features:**\n- Customer/Contact database with company name, contact person, email, phone, address\n- Track interactions: calls, emails, meetings — each with date, type, summary, and follow-up date\n- Deal/Opportunity pipeline: stages from Lead → Qualified → Proposal → Negotiation → Won/Lost\n- Add notes and tags to each contact\n- Set follow-up reminders with due dates\n\n**Views:**\n- Dashboard: total contacts, active deals, deals by stage (pipeline chart), upcoming follow-ups\n- Contact list: searchable, filterable by company, status, tags\n- Contact detail: full info, interaction history, deals, notes\n- Pipeline view: deals grouped by stage (kanban-style)\n- Follow-ups: list of overdue and upcoming reminders\n\n**Features:**\n- Quick-add contact from minimal info (just name + company)\n- Deal value tracking with expected close date\n- Export contacts as CSV\n- Tag system for categorizing contacts (e.g. VIP, Newsletter, Prospect)\n- Activity timeline on each contact\n\n**Data:**\n- Contact: companyName, contactName, email, phone, address, status (Active/Inactive/Lead), tags (array), notes (array), createdAt\n- Deal: contactId, title, value, stage, expectedCloseDate, probability, notes\n- Interaction: contactId, type (Call/Email/Meeting), date, summary, followUpDate\n\n**Users:** Sales team, account managers\n**Style:** Professional, data-rich, with green for Won deals and red for Lost.'
  },
  {
    id: 'training-tracker', icon: '🎓', category: 'HR',
    title: 'Training Tracker',
    desc: 'Track employee training completion, certifications, course catalog, and expiry alerts.',
    prompt: 'I need a Training & Certification Tracking tool.\n\n**Core Features:**\n- Course catalog with course name, description, category, duration, provider\n- Assign courses to employees with due dates\n- Track completion status: Not Started, In Progress, Completed, Expired\n- Certification tracking with issue date and expiry date\n- Auto-flag expiring certifications (30, 60, 90 day warnings)\n\n**Views:**\n- Dashboard: total courses, completion rate, expiring certifications, recent completions\n- Course list: searchable catalog with completion stats\n- Employee training record: all courses assigned, completed, and certifications\n- Expiry report: certifications expiring within selected timeframe\n- My Training: current employee\'s assigned and completed courses\n\n**Features:**\n- Upload training materials (PDF, links) per course\n- Record training hours per employee\n- Bulk assign course to multiple employees\n- Export training report as PDF per employee\n- Certification renewal workflow with reminders\n\n**Data:**\n- Course: name, description, category, durationHours, provider, materialsUrl\n- Enrollment: employeeName, employeeId, courseId, status, assignedDate, completedDate, hoursCompleted, certificateUrl\n- Certification: employeeName, employeeId, certName, issuingBody, issueDate, expiryDate, certNumber\n\n**Users:** HR, managers, all employees (view own records)\n**Style:** Educational/academic feel, clean progress indicators, green for complete, amber for in-progress.'
  }
];

/* ── Full HTML Tool Rules (loaded from embedded DOM element) ── */
var htmlRulesText = ''; // populated in onReady from #html-rules-source

/* ── Persistence ── */
function persist() {
  tool.setValue(DB);
  // Also save current session to CRUD (debounced — saves happen frequently)
  if (_activeSessionId) saveCurrentSession();
  tool.resize();
}

/* ── Session CRUD (ai-chat-sessions-uniconbaseapps) ── */
function loadSessions(callback) {
  tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function(err, result) {
    if (err) { console.warn('[VIBECODING:SESSION] Query error:', err); _sessions = []; }
    else {
      var all = (result && result.objects) ? result.objects : [];
      var myId = _resolveInstanceId();
      var myParentId = DB._parentRecordId;
      // Strict filter: only show sessions with matching _toolInstanceId.
      // Legacy sessions (no _toolInstanceId) on the SAME parent record are auto-migrated.
      _sessions = [];
      var needsStamp = [];
      for (var i = 0; i < all.length; i++) {
        var obj = all[i];
        var pd = obj.productData || {};
        var dcb = pd.data_categoriesBased || {};
        var objInstId = dcb._toolInstanceId;
        if (objInstId === myId) {
          _sessions.push(obj);
        } else if (!objInstId && myParentId && obj._parentObjectId === myParentId) {
          // Legacy session on OUR parent record — auto-stamp and include
          needsStamp.push(obj);
          _sessions.push(obj);
        }
        // else: other instance's session — excluded
      }
      // Stamp legacy sessions asynchronously
      if (needsStamp.length > 0) {
        console.warn('[VIBECODING:SESSION] Stamping ' + needsStamp.length + ' legacy sessions with instance ID');
        for (var s = 0; s < needsStamp.length; s++) {
          (function(session) {
            tool.requestObjects('update', {
              mainObjectType: SESSION_TYPE,
              objectId: session.id,
              productData: { data_categoriesBased: { _toolInstanceId: myId } }
            }, function() {});
          })(needsStamp[s]);
        }
      }
      if (all.length !== _sessions.length) {
        console.warn('[VIBECODING:SESSION] Filtered — showing ' + _sessions.length + ' of ' + all.length + ' total (instance: ' + myId + ')');
      }
    }
    _sessionsLoaded = true;
    console.warn('[VIBECODING:SESSION] Loaded', _sessions.length, 'sessions');
    if (callback) callback(_sessions);
  });
}

function createSession(callback) {
  var user = tool.getUser() || {};
  var instId = _resolveInstanceId();
  tool.requestObjects('create', {
    mainObjectType: SESSION_TYPE,
    name: 'New Chat',
    productData: {
      data_categoriesBased: {
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: { userId: user.id || 'anon', userName: user.name || 'Anonymous' },
        _toolInstanceId: instId
      }
    }
  }, function(err, result) {
    if (err) { console.warn('[VIBECODING:SESSION] Create error:', err); if (callback) callback(null); return; }
    var session = result.object;
    // Capture _parentObjectId from the CMS response (set by CMS when scope='instance')
    if (session._parentObjectId && !DB._parentRecordId) {
      DB._parentRecordId = session._parentObjectId;
      console.warn('[VIBECODING:SESSION] Captured parent record ID:', session._parentObjectId);
      // Re-resolve to incorporate the parent ID into our instance identifier
      _resolveInstanceId();
    }
    _sessions.unshift(session);
    console.warn('[VIBECODING:SESSION] Created session:', session.id);
    if (callback) callback(session);
  });
}

function saveCurrentSession(callback) {
  if (!_activeSessionId) { if (callback) callback(null); return; }
  // Find session in cache
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === _activeSessionId) { session = _sessions[i]; break; }
  }
  if (!session) { if (callback) callback(null); return; }

  // Get messages from the session's productData
  var pd = session.productData || {};
  var dcb = pd.data_categoriesBased || {};
  var messages = dcb.messages || [];

  tool.requestObjects('update', {
    mainObjectType: SESSION_TYPE,
    objectId: _activeSessionId,
    productData: {
      data_categoriesBased: {
        messages: messages,
        updatedAt: new Date().toISOString()
      }
    }
  }, function(err, result) {
    if (err) console.warn('[VIBECODING:SESSION] Save error:', err);
    if (callback) callback(err ? null : result);
  });
}

function deleteSession(sessionId, callback) {
  tool.requestObjects('delete', { mainObjectType: SESSION_TYPE, objectId: sessionId }, function(err, result) {
    if (err) { console.warn('[VIBECODING:SESSION] Delete error:', err); if (callback) callback(false); return; }
    // Remove from cache
    for (var i = 0; i < _sessions.length; i++) {
      if (_sessions[i].id === sessionId) { _sessions.splice(i, 1); break; }
    }
    console.warn('[VIBECODING:SESSION] Deleted session:', sessionId);
    if (callback) callback(true);
  });
}

function switchSession(sessionId) {
  if (sessionId === _activeSessionId) return;
  // Save current session first
  if (_activeSessionId) saveCurrentSession();

  _activeSessionId = sessionId;
  DB.activeSessionId = sessionId;
  persist();

  // Find session and load its messages
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === sessionId) { session = _sessions[i]; break; }
  }
  if (session) {
    var pd = session.productData || {};
    var dcb = pd.data_categoriesBased || {};
    DB.chatMessages = dcb.messages || [];
  } else {
    DB.chatMessages = [];
  }
  renderChatMessages();
  renderSessionList();
  console.warn('[VIBECODING:SESSION] Switched to session:', sessionId, '| messages:', DB.chatMessages.length);
}

function autoTitleSession() {
  // Set session name from first user message
  if (!_activeSessionId) return;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === _activeSessionId) { session = _sessions[i]; break; }
  }
  if (!session) return;
  var pd = session.productData || {};
  var dcb = pd.data_categoriesBased || {};
  var messages = dcb.messages || [];
  // Find first user message
  for (var j = 0; j < messages.length; j++) {
    if (messages[j].role === 'user' && messages[j].text) {
      var title = messages[j].text.replace(/\n/g, ' ').substring(0, 60);
      if (title.length >= 60) title += '...';
      // Update session name
      tool.requestObjects('update', {
        mainObjectType: SESSION_TYPE,
        objectId: _activeSessionId,
        name: title
      }, function() {});
      session.name = title;
      renderSessionList();
      break;
    }
  }
}

/* ── Time formatting helper ── */
function formatTimeAgo(isoTime) {
  if (!isoTime) return '';
  var now = Date.now();
  var then;
  try { then = new Date(isoTime).getTime(); } catch(e) { return ''; }
  var diff = Math.max(0, Math.floor((now - then) / 1000)); // seconds
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  try { return new Date(isoTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch(e) { return ''; }
}

/* ── Render Session List Sidebar ── */
function renderSessionList() {
  var list = el('session-list');
  if (!list) return;
  // Update toggle count label
  var countLabel = el('session-count-label');
  if (countLabel) countLabel.textContent = '(' + (_sessions ? _sessions.length : 0) + ')';
  if (!_sessions || !_sessions.length) {
    list.innerHTML = '<div class="session-empty">No chats yet.<br>Send a message to start.</div>';
    return;
  }
  var html = '';
  // Sort by updatedAt descending
  var sorted = _sessions.slice().sort(function(a, b) {
    var pdA = (a.productData && a.productData.data_categoriesBased) ? a.productData.data_categoriesBased : {};
    var pdB = (b.productData && b.productData.data_categoriesBased) ? b.productData.data_categoriesBased : {};
    var ta = pdA.updatedAt || a.updated || '';
    var tb = pdB.updatedAt || b.updated || '';
    if (ta > tb) return -1;
    if (ta < tb) return 1;
    return 0;
  });
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    var pd = (s.productData && s.productData.data_categoriesBased) ? s.productData.data_categoriesBased : {};
    var name = s.name || 'New Chat';
    var timeAgo = formatTimeAgo(pd.updatedAt || s.updated || '');
    var isActive = s.id === _activeSessionId;
    var activeClass = isActive ? ' session-active' : '';
    // Use data-sid for event delegation instead of inline onclick
    html += '<div class="session-item' + activeClass + '" data-sid="' + esc(s.id) + '">' +
      '<span class="session-dot">' + (isActive ? '●' : '○') + '</span>' +
      '<div class="session-info">' +
        '<div class="session-name">' + esc(name) + '</div>' +
        '<div class="session-time">' + timeAgo + '</div>' +
      '</div>' +
      '<button class="session-delete" data-sid="' + esc(s.id) + '" title="Delete chat">✕</button>' +
    '</div>';
  }
  list.innerHTML = html;

  // Event delegation for session clicks
  var items = list.querySelectorAll('.session-item');
  for (var j = 0; j < items.length; j++) {
    items[j].onclick = function() {
      var sid = this.getAttribute('data-sid');
      if (sid) switchSession(sid);
    };
    // Delete button handler
    var delBtn = items[j].querySelector('.session-delete');
    if (delBtn) {
      delBtn.onclick = function(e) {
        e.stopPropagation();
        var sid = this.getAttribute('data-sid');
        if (sid) {
          deleteSession(sid, function(ok) {
            if (ok) {
              if (_activeSessionId === sid) {
                _activeSessionId = '';
                DB.activeSessionId = '';
                DB.chatMessages = [];
                persist();
                renderChatMessages();
              }
              renderSessionList();
            }
          });
        }
      };
    }
  }
}
function applyTheme(t) { DB._theme = t; document.documentElement.setAttribute('data-theme', t); var b = el('btn-theme'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌓'; }
function toggleTheme() { applyTheme(DB._theme === 'dark' ? 'light' : 'dark'); persist(); }
function showToast(msg, sev) { tool.notify(msg, sev || 'info'); }
function lockUI(ro) { isReadOnly = ro === true; document.body.classList.toggle('readonly', isReadOnly); }

/* ── Role-based UI ── */
function isDeveloper() {
  var user = tool.getUser();
  if (!user || !user.roles) return false;
  // Check for developer role (case-insensitive, handles arrays and comma-separated strings)
  var roles = Array.isArray(user.roles) ? user.roles : String(user.roles).split(',');
  for (var i = 0; i < roles.length; i++) {
    if (String(roles[i]).trim().toLowerCase() === 'developer') return true;
  }
  return false;
}

function updateDeveloperUI() {
  var dev = isDeveloper();
  // Show/hide HTML, CSS, JS code tabs
  qsa('.ctab[data-tab="html"], .ctab[data-tab="css"], .ctab[data-tab="js"]').forEach(function(t) {
    t.style.display = dev ? '' : 'none';
  });
  // Hide individual copy buttons for non-developers
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) {
    b.style.display = 'none';
  });
  // Hide Rules button for non-developers (too technical)
  var rulesBtn = el('btn-rules'); if (rulesBtn) rulesBtn.style.display = dev ? '' : 'none';
  // Hide technical Config sections for non-developers
  qsa('.config-tech-section').forEach(function(s) {
    s.style.display = dev ? '' : 'none';
  });
  // If currently on a code tab but not a developer, switch to preview
  if (!dev && (currentTab === 'html' || currentTab === 'css' || currentTab === 'js')) {
    switchTab('preview');
  }
}

/* ── Collect / Restore Form Data ── */
function collectFormData() {
  DB.toolName = (el('f-tool-name') && el('f-tool-name').value || '').trim();
  DB.toolDesc = (el('f-tool-desc') && el('f-tool-desc').value || '').trim();
  DB.requirements = (el('f-tool-requirements') && el('f-tool-requirements').value || '').trim();
  DB.audience = el('f-audience') && el('f-audience').value || 'admin';
  var sr = qs('input[name="storage"]:checked'); DB.storage = sr ? sr.value : 'value';
  DB.cmsTypes = (el('f-cms-types') && el('f-cms-types').value || '').trim();
  DB.cmsFields = (el('f-cms-fields') && el('f-cms-fields').value || '').trim();
  DB.siblingFields = el('f-sibling-fields') && el('f-sibling-fields').value || 'no';
  DB.features = []; qsa('.feat-check:checked').forEach(function(cb) { DB.features.push(cb.dataset.feat); });
  DB.featureNotes = (el('f-feature-notes') && el('f-feature-notes').value || '').trim();
  var lr = qs('input[name="layout"]:checked'); DB.layout = lr ? lr.value : (DB.layout || 'single-page');
  DB.colorScheme = (el('f-color-scheme') && el('f-color-scheme').value) || DB.colorScheme || 'blue';
  DB.themeSupport = (el('f-theme-support') && el('f-theme-support').value) || DB.themeSupport || 'light-only';
  DB.styleNotes = (el('f-style-notes') && el('f-style-notes').value || '').trim();
}

function restoreFormData() {
  var setV = function(id, v) { var e = el(id); if (e) e.value = v || ''; };
  setV('f-tool-name', DB.toolName); setV('f-tool-desc', DB.toolDesc);
  setV('f-tool-requirements', DB.requirements); setV('f-audience', DB.audience || 'admin');
  var sr = qs('input[name="storage"][value="' + (DB.storage || 'value') + '"]'); if (sr) sr.checked = true;
  setV('f-cms-types', DB.cmsTypes); setV('f-cms-fields', DB.cmsFields);
  setV('f-sibling-fields', DB.siblingFields || 'no');
  qsa('.feat-check').forEach(function(cb) { cb.checked = DB.features.indexOf(cb.dataset.feat) !== -1; });
  setV('f-feature-notes', DB.featureNotes);
  var lr = qs('input[name="layout"][value="' + (DB.layout || 'single-page') + '"]'); if (lr) lr.checked = true;
  setV('f-color-scheme', DB.colorScheme || 'blue');
  setV('f-theme-support', DB.themeSupport || 'light-only');
  setV('f-style-notes', DB.styleNotes);
  var cs = el('crud-section'); if (cs) cs.style.display = (DB.storage === 'crud' || DB.storage === 'both') ? '' : 'none';
}

/* ── Code Display ── */
function displayCode(part, code) {
  var ta = el('code-' + part); var linesEl = el(part + '-lines');
  console.warn('[VIBECODING:DISPLAY] displayCode(' + part + ') — element:', !!ta, '| code length:', (code||'').length);
  if (ta) { ta.value = code || ''; console.warn('[VIBECODING:DISPLAY]   → textarea.value set, now:', ta.value.length, 'chars'); var lc = (code || '').split('\n').length; if (linesEl) { var n = ''; for (var i = 1; i <= lc; i++) n += '<div>' + i + '</div>'; linesEl.innerHTML = n; } }
  if (ta && linesEl) ta.onscroll = function() { linesEl.scrollTop = ta.scrollTop; };
}
function displayAllCode(c) {
  console.warn('[VIBECODING:DISPLAY] Writing code — HTML:', (c.html||'').length, 'chars | CSS:', (c.css||'').length, 'chars | JS:', (c.js||'').length, 'chars');
  console.warn('[VIBECODING:DISPLAY] Elements — code-html:', !!el('code-html'), 'code-css:', !!el('code-css'), 'code-js:', !!el('code-js'));
  displayCode('html', c.html || ''); displayCode('css', c.css || ''); displayCode('js', c.js || '');
  updatePreview();
  updateChatBadge();
}

/* ── Live Preview ── */
function updatePreview() {
  var html = el('code-html') ? el('code-html').value : '';
  var css = el('code-css') ? el('code-css').value : '';
  var js = el('code-js') ? el('code-js').value : '';
  var fw = qs('.preview-frame-wrap'); var pe = el('preview-empty'); var frame = el('preview-frame');
  if (!html.trim() && !css.trim() && !js.trim()) { if (fw) fw.classList.remove('has-content'); if (pe) pe.style.display = ''; return; }
  if (fw) fw.classList.add('has-content'); if (pe) pe.style.display = 'none';
  if (frame) {
    var previewDoc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Preview</title>\n<style>\n@keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }\n/* ── Generated CSS ── */\n' + css + '\n</style>\n</head>\n<body>\n' +
    '<!-- ── Generated HTML ── -->\n' + html + '\n' +
    '<!-- ── Mock tool SDK for preview ── -->\n<script>\n' +
    '(function() {\n' +
    '  var _val = null, _ro = false, _fields = {}, _objects = {};\n' +
    '  var _listeners = { valueChange: [], readonlyChange: [], fieldsChange: [], userChange: [] };\n' +
    '  function fire(evt, arg) { (_listeners[evt]||[]).forEach(function(cb){ try{cb(arg)}catch(e){console.error(e)} }); }\n' +
    '  function genId() { return "prev_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }\n' +
    '  window.tool = {\n' +
    '    onReady: function(cb) { setTimeout(function() { cb(_val, _fields); }, 5); },\n' +
    '    getValue: function() { return _val; },\n' +
    '    setValue: function(d) { _val = d; fire("valueChange", d); },\n' +
    '    onValueChange: function(cb) { _listeners.valueChange.push(cb); },\n' +
    '    getFields: function() { return _fields; },\n' +
    '    setField: function(id, v) { _fields[id] = v; fire("fieldsChange", _fields); },\n' +
    '    setFields: function(obj) { for (var k in obj) _fields[k] = obj[k]; fire("fieldsChange", _fields); },\n' +
    '    watchField: function(id, cb) {},\n' +
    '    onFieldsChange: function(cb) { _listeners.fieldsChange.push(cb); },\n' +
    '    param: function(n, d) { return d; },\n' +
    '    isReadOnly: function() { return _ro; },\n' +
    '    onReadonlyChange: function(cb) { _listeners.readonlyChange.push(cb); },\n' +
    '    getUser: function() { return { id:"preview", name:"Preview User", email:"preview@test", roles:["developer"] }; },\n' +
    '    onUserChange: function(cb) { _listeners.userChange.push(cb); },\n' +
    '    getPermittedUsers: function() { return [{id:"u1",name:"Alice"},{id:"u2",name:"Bob"}]; },\n' +
    '    onPermittedUsersChange: function() {},\n' +
    '    reportValid: function(v, m) { console.log("reportValid:", v, m); },\n' +
    '    notify: function(m, s) {\n' +
    '      var t = document.createElement("div");\n' +
    '      t.style.cssText = "position:fixed;bottom:16px;right:16px;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;z-index:9999;animation:slideUp 0.3s;max-width:320px;color:#fff;";\n' +
    '      t.style.background = s==="error"?"#dc2626":s==="success"?"#16a34a":s==="warning"?"#d97706":"#2563eb";\n' +
    '      t.textContent = m; document.body.appendChild(t);\n' +
    '      setTimeout(function(){ t.remove(); }, 3500);\n' +
    '      console.log("NOTIFY ["+(s||"info")+"]:", m);\n' +
    '    },\n' +
    '    resize: function() {},\n' +
    '    openUrl: function(u) { window.open(u, "_blank"); },\n' +
    '    declareOutput: function() {},\n' +
    '    declareParams: function() {},\n' +
    '    reportMissingParams: function() {},\n' +
    '    requestUpload: function(accept, cb) {\n' +
    '      setTimeout(function(){ cb(null, {name:"preview-file.pdf",url:"#",size:1024,type:"application/pdf"}); }, 300);\n' +
    '    },\n' +
    '    requestFileContent: function(url, cb) {\n' +
    '      setTimeout(function(){ cb(null, "Mock file content for preview."); }, 200);\n' +
    '    },\n' +
    '    requestAI: function(prompt, ctx, cb) {\n' +
    '      setTimeout(function(){ cb(null, "This is a mock AI response. In the real CMS, tool.requestAI() will call the configured AI service."); }, 500);\n' +
    '    },\n' +
    '    requestObjects: function(action, params, cb) {\n' +
    '      var type = params.mainObjectType || "default";\n' +
    '      if (!_objects[type]) _objects[type] = [];\n' +
    '      var list = _objects[type];\n' +
    '      setTimeout(function() {\n' +
    '        try {\n' +
    '          if (action === "query") { cb(null, { objects: list.slice() }); }\n' +
    '          else if (action === "get") {\n' +
    '            var obj = null;\n' +
    '            for (var i = 0; i < list.length; i++) { if (list[i].id === params.objectId) { obj = list[i]; break; } }\n' +
    '            cb(null, { object: obj });\n' +
    '          }\n' +
    '          else if (action === "create") {\n' +
    '            var newObj = { id: genId(), name: params.name || "Untitled", cmsObjectType: type, productData: params.productData || { data_categoriesBased: {} }, created: new Date().toISOString(), updated: new Date().toISOString() };\n' +
    '            list.push(newObj); cb(null, { object: newObj });\n' +
    '          }\n' +
    '          else if (action === "update") {\n' +
    '            for (var j = 0; j < list.length; j++) {\n' +
    '              if (list[j].id === params.objectId) {\n' +
    '                if (params.name) list[j].name = params.name;\n' +
    '                if (params.productData) list[j].productData = params.productData;\n' +
    '                list[j].updated = new Date().toISOString();\n' +
    '                cb(null, { ok: true }); return;\n' +
    '              }\n' +
    '            }\n' +
    '            cb("Object not found", null);\n' +
    '          }\n' +
    '          else if (action === "delete") {\n' +
    '            for (var k = 0; k < list.length; k++) {\n' +
    '              if (list[k].id === params.objectId) { list.splice(k, 1); cb(null, { ok: true }); return; }\n' +
    '            }\n' +
    '            cb("Object not found", null);\n' +
    '          }\n' +
    '          else { cb("Unknown action: " + action, null); }\n' +
    '        } catch(e) { cb("CRUD error: " + e.message, null); }\n' +
    '      }, 100);\n' +
    '    }\n' +
    '  };\n' +
    '})();\n' +
    'var _consoleBuf = [];\n' +
    'function _postLog(level, args) {\n' +
    '  var msg = Array.prototype.slice.call(args).map(function(a){ try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)} }).join(" ");\n' +
    '  try { parent.postMessage({vibeConsole:{level:level, msg:msg, time:new Date().toISOString()}}, "*"); } catch(e) {}\n' +
    '}\n' +
    'var _origConsole = { log:console.log, warn:console.warn, error:console.error };\n' +
    'console.log = function(){ _postLog("log", arguments); _origConsole.log.apply(console, arguments); };\n' +
    'console.warn = function(){ _postLog("warn", arguments); _origConsole.warn.apply(console, arguments); };\n' +
    'console.error = function(){ _postLog("error", arguments); _origConsole.error.apply(console, arguments); };\n' +
    'window.onerror = function(m) { _postLog("error", ["Preview:", m]); return true; };\n' +
    '<\/script>\n' +
    '<!-- ── Generated JS ── -->\n<script>\n' + js + '\n<\/script>\n</body>\n</html>';
    console.warn('[VIBECODING:PREVIEW] Setting iframe srcdoc — html:', html.length, 'chars | css:', css.length, 'chars | js:', js.length, 'chars | total doc:', previewDoc.length, 'chars');
    frame.srcdoc = previewDoc;
  }
}

/* ── Tab Switching (right panel) ── */
function switchTab(tab) {
  // Block non-developers from accessing code tabs
  if (!isDeveloper() && (tab === 'html' || tab === 'css' || tab === 'js')) {
    tab = 'preview';
  }
  currentTab = tab;
  qsa('.ctab').forEach(function(t) { t.classList.remove('active'); });
  qsa('.content-editor').forEach(function(e) { e.classList.remove('active'); });
  var tb = qs('.ctab[data-tab="' + tab + '"]'); if (tb) tb.classList.add('active');
  var ed = el('editor-' + tab); if (ed) ed.classList.add('active');
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) { b.style.display = 'none'; });
  if (tab === 'html') { var b = el('btn-copy-html'); if (b) b.style.display = ''; }
  else if (tab === 'css') { var b = el('btn-copy-css'); if (b) b.style.display = ''; }
  else if (tab === 'js') { var b = el('btn-copy-js'); if (b) b.style.display = ''; }
  if (tab === 'preview') updatePreview();
  if (tab === 'console') renderConsole();
  if (tab === 'config') { collectFormData(); restoreFormData(); }
  tool.resize();
}

/* ── Copy / Download ── */
function copyToClipboard(text, label) {
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function() { showToast((label||'Code')+' copied!', 'success'); }).catch(function() { fallbackCopy(text, label); }); }
  else { fallbackCopy(text, label); }
}
function fallbackCopy(text, label) { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast((label||'Code')+' copied!', 'success'); } catch(e) { showToast('Copy failed', 'error'); } document.body.removeChild(ta); }
function copyCurrentTab() { var ta = el('code-' + currentTab); if (ta && ta.value.trim()) copyToClipboard(ta.value, currentTab.toUpperCase()); else showToast('No code to copy.', 'warning'); }
function copyAllBlocks() {
  var h = el('code-html') ? el('code-html').value.trim() : '', c = el('code-css') ? el('code-css').value.trim() : '', j = el('code-js') ? el('code-js').value.trim() : '';
  if (!h && !c && !j) { showToast('No code yet.', 'warning'); return; }
  copyToClipboard('[HTML]\n' + h + '\n\n[CSS]\n' + c + '\n\n[JS]\n' + j, 'All three blocks');
}
function downloadFiles() {
  var h = el('code-html') ? el('code-html').value.trim() : '', c = el('code-css') ? el('code-css').value.trim() : '', j = el('code-js') ? el('code-js').value.trim() : '';
  if (!h && !c && !j) { showToast('No code yet.', 'warning'); return; }
  var slug = (DB.toolName || 'tool').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'html-tool';
  function dl(content, ext) { if (!content) return; var b = new Blob([content], { type: ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'text/javascript' }); var u = URL.createObjectURL(b); var a = document.createElement('a'); a.href = u; a.download = slug + ext; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }
  dl(h, '.html'); dl(c, '.css'); dl(j, '.js');
  showToast('Files downloaded!', 'success');
}

/* ── Parse AI Response ── */
function parseGeneratedCode(text) {
  var r = { html: '', css: '', js: '' };
  var hm = text.match(/\[HTML\]\s*([\s\S]*?)(?=\[CSS\]|$)/i);
  var cm = text.match(/\[CSS\]\s*([\s\S]*?)(?=\[JS\]|$)/i);
  var jm = text.match(/\[JS\]\s*([\s\S]*?)$/i);
  if (hm) r.html = hm[1].trim(); if (cm) r.css = cm[1].trim(); if (jm) r.js = jm[1].trim();
  if (!r.html && !r.css && !r.js) {
    var blocks = text.match(/```(?:html)?\s*([\s\S]*?)```/g);
    if (blocks) blocks.forEach(function(b) {
      var content = b.replace(/```(?:\w+)?\s*/, '').replace(/```\s*$/, '').trim();
      var lang = b.match(/```(\w+)/); var l = lang ? lang[1].toLowerCase() : '';
      if (l === 'html' || (!l && !r.html)) r.html = content;
      else if (l === 'css') r.css = content;
      else if (l === 'js' || l === 'javascript') r.js = content;
    });
  }
  r.html = r.html.replace(/^```html\s*/, '').replace(/```\s*$/, '').trim();
  r.css = r.css.replace(/^```css\s*/, '').replace(/```\s*$/, '').trim();
  r.js = r.js.replace(/^```(?:js|javascript)\s*/, '').replace(/```\s*$/, '').trim();
  return r;
}

/* ── Build Prompts ── */
function buildFullPrompt() {
  collectFormData();
  var parts = [
    'You are building an HTML tool for the UniconHub CMS html-tool system (sandboxed iframe, window.tool SDK).',
    'Tool Name: ' + (DB.toolName || 'Untitled'), 'Description: ' + (DB.toolDesc || ''),
    'Audience: ' + DB.audience, 'Storage: ' + DB.storage,
    'Requirements: ' + (DB.requirements || '(none)'),
    'CMS Types: ' + (DB.cmsTypes || '(none)'), 'Fields: ' + (DB.cmsFields || '(none)'),
    'Features: ' + DB.features.join(', '), 'Layout: ' + DB.layout,
    'Color: ' + DB.colorScheme, 'Theme: ' + DB.themeSupport,
    'Style notes: ' + (DB.styleNotes || '(none)')
  ];
  var suffix = [
    'Generate COMPLETE tool as THREE blocks: [HTML], [CSS], [JS].',
    '[HTML]: body markup only — no html/head/style/script/body/DOCTYPE tags. CDN scripts allowed.',
    '[CSS]: stylesheet rules only — no <style> tag. CSS variables, theming, responsive.',
    '[JS]: JavaScript only — no <script> tag. tool.onReady(cb) entry point.',
    'CRITICAL JS RULES — ES5 ONLY (the sandbox does NOT support ES6+):',
    '  - Use var ONLY. Never use let or const.',
    '  - NEVER use spread operator (...). Use Object.assign() or manual copying instead.',
    '  - NEVER use template literals (`backticks`). Use string concatenation with + only.',
    '  - NEVER use arrow functions (=>). Always use function() {} syntax.',
    '  - NEVER use destructuring ({a,b}=obj or [a,b]=arr). Access properties directly.',
    '  - NEVER use default parameters (function(x=1)). Check with || inside the function.',
    '  - NEVER use for...of loops. Use for(var i=0;...) instead.',
    '  - NEVER use Map, Set, Symbol, Promise, async/await, or class syntax.',
    'CRITICAL: Define EVERY function you call. If you use onclick="loadData()" in HTML,',
    '  you MUST have a function loadData(){} defined in JS. No dangling references.',
    '  All event handlers (onclick, onchange, onsubmit, etc.) must reference defined functions.',
    '  All functions called in tool.onReady() must exist in the JS block.',
    'Complete, functional code. No placeholders, no TODO comments. Output ONLY the three blocks.'
  ];
  // Always use full rules — model has ~2.4M char context window
  parts.push('', htmlRulesText, '');
  return parts.concat(suffix).join('\n');
}

function buildChatPrompt(userMsg) {
  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);

  // ── Interview Mode: AI acts as business analyst ──
  if (interviewMode && !hasCode) {
    console.warn('[VIBECODING:BUILD-PROMPT] Interview mode — using analyst persona');
    var parts = [buildInterviewSystemPrompt()];
    parts.push('');
    parts.push('=== CONVERSATION HISTORY ===');
    for (var i = 0; i < DB.chatMessages.length; i++) {
      var m = DB.chatMessages[i];
      parts.push((m.role === 'user' ? 'USER' : 'AI') + ': ' + m.text);
    }
    parts.push('');
    parts.push('Continue the interview. Ask the next question. If enough info gathered (4+ answers), summarize and offer to generate code.');
    parts.push('');
    parts.push('=== HTML TOOL RULES (for when you generate code) ===');
    parts.push(htmlRulesText);
    parts.push('');
    parts.push('If user confirms they want code generated, output [HTML]/[CSS]/[JS] blocks following ALL rules above.');
    return parts.join('\n');
  }

  var parts = ['You are helping build/refine an HTML tool for UniconHub CMS (sandboxed iframe, window.tool SDK).'];

  // Include attached file content if present
  if (attachedFile) {
    parts.push('');
    parts.push('=== ATTACHED FILE ===');
    parts.push('Filename: ' + attachedFile.name);
    parts.push('Type: ' + attachedFile.type);
    parts.push('URL: ' + attachedFile.url);
    if (attachedFile.extractedText) {
      var excerpt = attachedFile.extractedText;
      if (excerpt.length > 50000) excerpt = excerpt.substring(0, 50000) + '\n... (truncated from ' + attachedFile.extractedText.length.toLocaleString() + ' chars)';
      parts.push('');
      parts.push('--- Extracted Text Content ---');
      parts.push(excerpt);
      parts.push('--- End Extracted Content ---');
    } else {
      parts.push('Note: This is an image or non-text file. The URL above points to the uploaded file for reference.');
    }
    parts.push('');
  }

  if (hasCode) {
    parts.push('=== CURRENT CODE ===');
    parts.push('[HTML]\n' + (DB.code.html || '(empty)'));
    parts.push('[CSS]\n' + (DB.code.css || '(empty)'));
    parts.push('[JS]\n' + (DB.code.js || '(empty)'));
    parts.push('');
    parts.push('=== USER REQUEST ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('Apply the requested change to the code above. Output the COMPLETE updated [HTML]/[CSS]/[JS] blocks.');
    parts.push('Even for small changes, output ALL three complete blocks — never output just fragments.');
    parts.push('Preserve all code not asked to change. Follow ALL html-tool rules and ES5 restrictions.');
  } else {
    // No code yet — this is an initial generation request
    parts.push('=== PROJECT CONFIG ===');
    parts.push('Name: ' + (DB.toolName || 'Not set — infer from request'));
    parts.push('Storage: ' + DB.storage + ' | Layout: ' + DB.layout + ' | Color: ' + DB.colorScheme);
    parts.push('Features: ' + DB.features.join(', '));
    parts.push('');
    parts.push('=== USER REQUEST (treat as requirements) ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('IMPORTANT — If the request is vague or missing key details, ask 1-2 clarifying questions BEFORE generating code.');
    parts.push('Format questions with clickable options like: [[opt1]] First option');
    parts.push('Only generate code when you have a clear picture of what to build.');
    parts.push('');
    parts.push('Generate a COMPLETE tool from scratch. Output ALL THREE blocks [HTML]/[CSS]/[JS].');
    parts.push('Follow all html-tool rules below.');
  }

  // Always include full rules — model has ~2.4M char context window, no need to condense
  parts.push(''); parts.push(htmlRulesText);
  parts.push('');
  parts.push('CRITICAL JS RULES — ES5 ONLY (the sandbox does NOT support ES6+):');
  parts.push('  NEVER use: let, const, spread (...), template literals (`), arrow functions (=>), destructuring, for...of, default params, Map, Set, Promise, async/await, class.');
  parts.push('  ALWAYS use: var, function() {}, string concatenation (+), for(var i=0;...), Object.assign().');
  parts.push('  EVERY onclick/event handler in HTML MUST reference a function DEFINED in JS. No dangling function calls.');
  parts.push('');
  parts.push('IMPORTANT: Always output ALL THREE blocks when providing code. If you are asking a question, use [[option_id]] format for clickable choices.');
  parts.push('Format for code: [HTML] ... [CSS] ... [JS] ...');

  return parts.join('\n');
}

/* ── Last-Resort Minimal Prompt — stripped to bare essentials ── */
function buildMinimalPrompt(userMsg) {
  return [
    'Build/refine an HTML tool for UniconHub CMS (sandboxed iframe, window.tool SDK).',
    'Output THREE blocks: [HTML] (body markup only), [CSS] (no <style> tag), [JS] (no <script> tag, use tool.onReady).',
    'ES5 ONLY: var, function(){}, string concat with +, for(var i;;) loops.',
    'No localStorage, fetch, alert, prompt, raw postMessage. No DOMContentLoaded.',
    'tool.setValue/getValue for persistence. tool.isReadOnly() for view mode. tool.resize() after DOM changes.',
    'tool.notify(msg, severity) for user feedback.',
    '',
    '=== USER REQUEST ===',
    userMsg,
    '',
    'Generate COMPLETE [HTML]/[CSS]/[JS] blocks. No placeholders, no TODOs.',
    'If request is vague, ask clarifying questions with [[option_id]] Format.'
  ].join('\n');
}

/* ── Condensed Rules (~5K chars) for when prompt exceeds CMS 20K limit ── */
function getCondensedRules() {
  return [
    'You are building an HTML tool for UniconHub CMS (sandboxed iframe, window.tool SDK).',
    '',
    '--- OUTPUT FORMAT (MANDATORY) ---',
    '[HTML] ...body markup only, no html/head/style/script/body/DOCTYPE tags...',
    '[CSS]  ...stylesheet rules only, no <style> tag...',
    '[JS]   ...JavaScript only, no <script> tag...',
    'Output ALL THREE blocks. Never merge them. Never add explanation between blocks.',
    '',
    '--- ENTRY POINT ---',
    'Use tool.onReady(cb) as the single entry point. Never use DOMContentLoaded or window.onload.',
    '',
    '── KEY SDK METHODS (window.tool) ──',
    'tool.getValue() → current saved value (any JSON)',
    'tool.setValue(data) → save value, triggers onValueChange',
    'tool.onValueChange(cb) → cb(newValue)',
    'tool.isReadOnly() → true when form is view-only',
    'tool.onReadonlyChange(cb) → cb(bool), lock/unlock UI',
    'tool.resize() → call after DOM changes that affect height',
    'tool.notify(msg, severity) → show toast: "info"|"success"|"warning"|"error"',
    'tool.param(name, default) → read admin-configured parameter',
    'tool.getUser() → {id, name, email, roles, locale} or null',
    'tool.getPermittedUsers() → [{id, name, email, roles}] for assignee pickers',
    'tool.reportValid(bool, msg) → false blocks form save, shows msg',
    'tool.openUrl(url) → open URL in new tab (use instead of window.open)',
    'tool.declareParams([{name,label,type,default,hint,severity}]) → declare configurable params',
    'tool.reportMissingParams(missing, msg) → trigger CMS warning banner for unconfigured params',
    'tool.getFields() → {fieldId: value} snapshot of sibling fields',
    'tool.setField(id, value) → write to sibling field',
    'tool.onFieldsChange(cb) → cb(allFields) when sibling fields change',
    '',
    '── AI PROMPT RELAY ──',
    'tool.requestAI(prompt, context, callback) → callback(err, responseText)',
    '  Requires allowAi: "yes" in toolParams. 60s timeout. 100K char limit.',
    '',
    '── FILE UPLOAD ──',
    'tool.requestUpload(accept, callback) → callback(err, {name, url, size, type})',
    '  Requires allowUpload: "yes".',
    '',
    '── FILE CONTENT EXTRACTION ──',
    'tool.requestFileContent(url, callback) → callback(err, textContent)',
    '  Requires allowFileContent: "yes".',
    '',
    '── PDF EXPORT ──',
    'tool.requestExportPdf({html?, filename?, landscape?}, callback) → callback(err, {name,url,size,type})',
    '  Requires allowExportPdf: "yes".',
    '',
    '── SEND EMAIL ──',
    'tool.requestSendEmail({to, subject, htmlBody, title?, attachments?}, callback) → callback(err, {ok:true})',
    '  Requires allowSendEmail: "yes". Attachments: [{filename, url}].',
    '',
    '── OBJECT CRUD (Multi-Type CMS Database) ──',
    'tool.requestObjects(action, params, callback) — CRUD across CMS object types.',
    '  Actions: query({mainObjectType, typeId?}) → {objects:[...]}',
    '           get({mainObjectType, objectId}) → {object:{...}}',
    '           create({mainObjectType, typeId?, name, productData:{data_categoriesBased:{...}}}) → {object:{...}}',
    '           update({mainObjectType, objectId, productData:{...}, name?}) → {ok:true}',
    '           delete({mainObjectType, objectId}) → {ok:true}',
    '           batch({operations:[{action, mainObjectType, ...}]}) → {ok:true, results:[...]} (max 500 ops)',
    '  Requires allowObjectCRUD: "yes" + allowedObjectTypes config.',
    '  Namespace types: <typeName>-<developerSubdomain> (shared) or <toolId>.<typeName>-<developerSubdomain> (isolated).',
    '',
    '── HARD RULES ──',
    'NO <script>, <style>, <html>, <head>, <body>, <!DOCTYPE> tags in any block.',
    'NO DOMContentLoaded or window.onload — use tool.onReady.',
    'NO localStorage or sessionStorage.',
    'NO fetch to external URLs (sandbox blocks it).',
    'NO alert(), confirm(), or prompt().',
    'NO raw postMessage — always use tool.* SDK.',
    'CDN <script> tags ARE allowed in the HTML block (Chart.js, Sortable, etc.).',
    'Values can be any JSON type — save objects/arrays with tool.setValue().',
    'All request* methods are async — use callbacks, not return values.',
    'Always produce complete, functional code — no placeholders, no TODO comments.',
    '',
    '── ES5 ONLY (CRITICAL) ──',
    'var only (never let/const). function(){} (never =>).',
    'String concatenation with + (never `backticks`).',
    'for(var i=0;...) loops (never for...of).',
    'No spread (...), destructuring, default params, Map, Set, Promise, async/await, class.',
    'Every onclick handler MUST reference a function DEFINED in the JS block.'
  ].join('\n');
}

/* ── File Upload ── */
function handleFileUpload() {
  // Accept images, PDFs, docs, text files
  tool.requestUpload('.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.doc,.docx,.txt,.md,.csv', function(err, file) {
    if (err) { showToast('Upload failed: ' + err, 'error'); return; }
    attachedFile = { name: file.name, url: file.url, size: file.size, type: file.type, extractedText: '' };
    showAttachment();

    // Try to extract text for supported types
    var extractable = /\.(pdf|docx?|txt|md|csv)$/i.test(file.name);
    if (extractable) {
      el('attach-status').textContent = 'Extracting text...';
      tool.requestFileContent(file.url, function(e2, content) {
        if (content) {
          attachedFile.extractedText = content;
          el('attach-status').textContent = '✓ Text extracted (' + content.length.toLocaleString() + ' chars)';
        } else {
          el('attach-status').textContent = e2 ? '⚠ ' + e2 : '✓ Ready (no text extraction)';
        }
      });
    } else {
      // Image or other — note URL will be shared with AI as reference
      el('attach-status').textContent = '✓ Attached (URL will be shared with AI)';
    }
    showToast('File attached: ' + file.name, 'success');
  });
}

function showAttachment() {
  if (!attachedFile) { el('chat-attachment').style.display = 'none'; return; }
  el('chat-attachment').style.display = 'flex';
  el('attach-name').textContent = attachedFile.name;
  el('attach-size').textContent = formatFileSize(attachedFile.size);
}

function clearAttachment() {
  attachedFile = null;
  el('chat-attachment').style.display = 'none';
  el('attach-status').textContent = '';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ── Template Gallery ── */
function renderTemplateGallery(container) {
  if (!container) return;
  // Show first 6 templates in the welcome area (rest in modal)
  var shown = TEMPLATES.slice(0, 6);
  var html = '';
  for (var i = 0; i < shown.length; i++) {
    var t = shown[i];
    html += '<div class="template-card" data-tpl-id="' + t.id + '" onclick="openTemplateModal(\'' + t.id + '\')">' +
      '<div class="template-card-icon">' + t.icon + '</div>' +
      '<div class="template-card-category">' + esc(t.category) + '</div>' +
      '<div class="template-card-title">' + esc(t.title) + '</div>' +
      '<div class="template-card-desc">' + esc(t.desc) + '</div>' +
      '<div class="template-card-action">View & Customize →</div>' +
    '</div>';
  }
  container.innerHTML = html;
}

function openTemplateModal(tplId) {
  var t = null;
  for (var i = 0; i < TEMPLATES.length; i++) {
    if (TEMPLATES[i].id === tplId) { t = TEMPLATES[i]; break; }
  }
  if (!t) return;
  _currentTemplate = t;
  el('tpl-icon').textContent = t.icon;
  el('tpl-title').textContent = t.title;
  el('tpl-desc').textContent = t.desc;
  el('tpl-modal-title').textContent = t.icon + ' ' + t.title;
  // Restore prompt textarea (in case modal was showing template list)
  var ta = el('tpl-prompt-text');
  if (ta) { ta.style.display = ''; ta.value = t.prompt; }
  // Restore prompt label
  var area = qs('#modal-template .template-prompt-area');
  if (area) {
    area.innerHTML = '<div class="template-prompt-label">✏️ Customize this prompt — edit any part, then send to AI:</div>' +
      '<textarea id="tpl-prompt-text" class="template-prompt-text" spellcheck="false">' + esc(t.prompt) + '</textarea>';
  }
  // Show action buttons
  var actions = qs('#modal-template .template-modal-actions');
  if (actions) actions.style.display = '';
  // Re-bind buttons (since innerHTML was replaced)
  var btnReset = el('btn-tpl-reset'); if (btnReset) btnReset.onclick = resetTemplatePrompt;
  var btnUse = el('btn-tpl-use'); if (btnUse) btnUse.onclick = useTemplatePrompt;
  openModal('modal-template');
}

function closeTemplateModal() {
  _currentTemplate = null;
  closeAllModals();
}

function resetTemplatePrompt() {
  if (_currentTemplate && el('tpl-prompt-text')) {
    el('tpl-prompt-text').value = _currentTemplate.prompt;
    showToast('Prompt reset to original.', 'info');
  }
}

function useTemplatePrompt() {
  var promptText = el('tpl-prompt-text') ? el('tpl-prompt-text').value.trim() : '';
  if (!promptText) { showToast('Prompt is empty.', 'warning'); return; }
  console.warn('[VIBECODING] Template prompt used — length:', promptText.length, 'template:', _currentTemplate ? _currentTemplate.title : 'none');
  closeAllModals();
  // Put the prompt in the chat input and send it
  var inp = el('chat-input');
  if (inp) {
    inp.value = promptText;
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
  }
  // Auto-send
  sendChatMessage();
}

/* ── Interview / Guided Mode ── */
function toggleInterviewMode() {
  interviewMode = !interviewMode;
  console.warn('[VIBECODING] Interview mode toggled:', interviewMode ? 'ON' : 'OFF');
  var btn = el('btn-guided-mode');
  if (btn) {
    if (interviewMode) { btn.classList.add('active'); btn.textContent = '🪄 Guided: ON'; }
    else { btn.classList.remove('active'); btn.textContent = '🪄 Guided'; }
  }
  // Update placeholder
  var inp = el('chat-input');
  if (inp) {
    inp.placeholder = interviewMode
      ? 'Answer the AI\'s question or describe your tool... (Enter to send)'
      : 'Describe your tool or ask for changes... (Enter to send, Shift+Enter for new line)';
  }
  var msg = interviewMode
    ? '🪄 **Guided Mode active.** The AI will interview you step by step to understand your needs. Just answer each question — or type freely.'
    : '📝 **Guided Mode off.** Back to free-form chat.';
  addChatMessage('ai', msg);
  tool.resize();
}

function buildInterviewSystemPrompt() {
  return [
    'YOU ARE A BUSINESS ANALYST INTERVIEWING THE USER to understand their tool requirements.',
    'Your job is to ask CLEAR, SIMPLE questions — one at a time — to gather all the details needed.',
    '',
    'RULES:',
    '1. Ask exactly ONE question per response. Keep it short and friendly.',
    '2. After each question, provide 2-5 multiple choice options the user can click.',
    '3. Format each option on its own line like this: [[option_id]] Brief option text',
    '   Example: [[people]] Staff & Personnel',
    '            [[tasks]] Tasks & Projects',
    '            [[other]] Something else',
    '4. Do NOT generate code until you have gathered enough information (at least 4-5 answers).',
    '5. When you have enough, say "I have enough to build your tool. Here\'s a summary:" then list what you understood, then ask "Shall I generate the code now?"',
    '6. If the user says yes/generate/go ahead, THEN output the [HTML]/[CSS]/[JS] blocks.',
    '7. If the user asks a question or gives extra info, adapt and continue the interview.',
    '8. Be conversational and encouraging. Use plain language — the user is NOT a developer.',
    '',
    'INTERVIEW FLOW (start here):',
    'Q1: "What kind of tool would you like me to build?" (present category options)',
    'Q2: Based on their answer, ask about the main things they need to track or manage.',
    'Q3: Ask who will use the tool and how many people.',
    'Q4: Ask about specific features — do they need search? export? email? notifications?',
    'Q5: Ask about visual style preferences — professional? colorful? minimal? dark mode?',
    'Then summarize and offer to generate.',
    '',
    'If at any point the user provides a detailed description instead of picking options,',
    'skip the remaining interview questions and generate the tool directly.'
  ].join('\n');
}

function parseAndRenderOptions(text) {
  // Check if text contains interview options like [[option_id]] Option text
  var lines = text.split('\n');
  var options = [];
  var textLines = [];
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^\[\[([a-zA-Z0-9_-]+)\]\]\s+(.+)/);
    if (match) {
      options.push({ id: match[1], text: match[2].trim() });
    } else {
      textLines.push(lines[i]);
    }
  }
  // Build HTML: text part + option buttons
  var html = textLines.join('\n');
  if (options.length > 0) {
    html += '<div class="chat-options">';
    for (var j = 0; j < options.length; j++) {
      var opt = options[j];
      html += '<button class="chat-option-btn" data-opt-id="' + esc(opt.id) + '" data-opt-text="' + esc(opt.text) + '" onclick="handleOptionClick(this)">' +
        '<span class="opt-num">' + (j + 1) + '</span>' + esc(opt.text) + '</button>';
    }
    html += '</div>';
  }
  return html;
}

function handleOptionClick(btn) {
  var optId = btn.getAttribute('data-opt-id');
  var optText = btn.getAttribute('data-opt-text');
  console.warn('[VIBECODING] Option clicked — id:', optId, 'text:', optText);
  // Disable all option buttons in this group
  var parent = btn.parentNode;
  if (parent) {
    var allBtns = parent.querySelectorAll('.chat-option-btn');
    for (var i = 0; i < allBtns.length; i++) {
      allBtns[i].classList.add('chat-option-used');
      allBtns[i].disabled = true;
    }
  }
  // Send the selected option as the user's response
  var inp = el('chat-input');
  if (inp) {
    inp.value = optText;
    inp.style.height = 'auto';
  }
  sendChatMessage();
}

function isInterviewQuestion(text) {
  // Detect if the AI response is an interview question (has [[options]])
  return /\[\[[a-zA-Z0-9_-]+\]\]/.test(text);
}

/* ── Deep AI Pipeline Diagnostics (quiet — uncomment to re-enable) ── */
function diagAI() { /* disabled for clean console */ }

function diagPromptStats() { /* quiet */ }

function diagResponse() { /* quiet */ }

/* ── Request Correlation ID ── */
var _reqIdCounter = 0;
var _currentReqId = '';
function nextReqId() { _reqIdCounter++; return 'REQ-' + _reqIdCounter + '-' + Date.now().toString(36); }

/* ── Manual AI Ping Test (run from console: diagPing()) ── */
function diagPing() {
  var reqId = nextReqId();
  var testPrompt = 'Reply with exactly: PONG ' + reqId;
  console.warn('[VIBECODING:PING:' + reqId + '] ══════ AI PING TEST ══════');
  console.warn('[VIBECODING:PING:' + reqId + '] Sending test prompt: "' + testPrompt + '"');
  console.warn('[VIBECODING:PING:' + reqId + '] promptSize=' + testPrompt.length + 'chars');
  
  var pingStart = Date.now();
  
  // Test streaming first
  if (typeof tool.requestAIStream === 'function') {
    console.warn('[VIBECODING:PING:' + reqId + '] Trying STREAMING...');
    var streamResponse = '';
    tool.requestAIStream(testPrompt, '', {
      onToken: function(t) { streamResponse += t; },
      onComplete: function() {
        var elapsed = Date.now() - pingStart;
        console.warn('[VIBECODING:PING:' + reqId + '] STREAM complete in ' + elapsed + 'ms — response: "' + streamResponse + '" (' + streamResponse.length + ' chars)');
        if (!streamResponse.trim()) {
          console.warn('[VIBECODING:PING:' + reqId + '] STREAM returned EMPTY — trying batch fallback...');
          diagPingBatch(reqId, testPrompt, pingStart);
        }
      },
      onError: function(err) {
        var elapsed = Date.now() - pingStart;
        console.warn('[VIBECODING:PING:' + reqId + '] STREAM ERROR in ' + elapsed + 'ms: ' + err);
        console.warn('[VIBECODING:PING:' + reqId + '] Trying batch fallback...');
        diagPingBatch(reqId, testPrompt, pingStart);
      }
    });
  } else {
    console.warn('[VIBECODING:PING:' + reqId + '] requestAIStream NOT available — using batch only');
    diagPingBatch(reqId, testPrompt, pingStart);
  }
}

function diagPingBatch(reqId, testPrompt, pingStart) {
  console.warn('[VIBECODING:PING:' + reqId + '] Trying BATCH requestAI...');
  tool.requestAI(testPrompt, '', function(err, response) {
    var elapsed = Date.now() - pingStart;
    if (response) {
      console.warn('[VIBECODING:PING:' + reqId + '] BATCH complete in ' + elapsed + 'ms — response: "' + response + '" (' + response.length + ' chars)');
    } else if (err) {
      console.warn('[VIBECODING:PING:' + reqId + '] BATCH ERROR in ' + elapsed + 'ms: ' + err);
    } else {
      console.warn('[VIBECODING:PING:' + reqId + '] BATCH returned NULL/EMPTY in ' + elapsed + 'ms — AI bridge appears DOWN');
    }
    console.warn('[VIBECODING:PING:' + reqId + '] ══════ PING TEST COMPLETE ══════');
  });
}

/* ── CMS-Side Diagnostic Hooks (add these to your CMS code) ──
   Copy these console.warn calls into your CMS parent-window code
   at each layer of the AI pipeline to trace exactly where it breaks.

   LAYER 1 — html-tool iframe bridge (receives postMessage from tool):
     console.warn('[CMS:BRIDGE] Received AI request from iframe — promptLen=' + prompt.length + ' chars, stream=' + isStream);

   LAYER 2 — AI gateway/router (forwards to model endpoint):
     console.warn('[CMS:GATEWAY] Forwarding to AI model — model=' + modelName + ', promptLen=' + prompt.length + ', stream=' + isStream);

   LAYER 3 — AI model response (raw response from model API):
     console.warn('[CMS:MODEL] Raw response received — status=' + status + ', bodyLen=' + body.length + ', first100chars=' + body.substring(0,100));

   LAYER 4 — Response sent back to iframe:
     console.warn('[CMS:BRIDGE] Sending AI response to iframe — responseLen=' + response.length + ', stream=' + isStream);

   LAYER 5 — Error path:
     console.warn('[CMS:BRIDGE] AI request FAILED — error=' + errorMsg + ', stack=' + errorStack);
────────────────────────────────────────── */
function sendChatMessage() {
  var input = el('chat-input'); if (!input) return;
  // Guard: prevent sending while AI is already processing
  if (_aiCallActive) { showToast('AI is already generating. Wait or press Stop.', 'warning'); return; }
  var msg = input.value.trim();
  if (!msg && !attachedFile) return;
  if (!msg) msg = 'Please analyze the attached file and suggest a tool design based on it.';

  var reqId = nextReqId();
  _currentReqId = reqId;

  // Build user message text including attachment info for chat display
  var displayMsg = msg;
  if (attachedFile) {
    displayMsg = '📎 **' + attachedFile.name + '** (' + formatFileSize(attachedFile.size) + ')\n' + msg;
  }
  addChatMessage('user', displayMsg);
  input.value = ''; input.style.height = 'auto';

  // Ensure a session exists — create one if this is the first message
  if (!_activeSessionId && _sessionsLoaded) {
    console.warn('[VIBECODING:SESSION] No active session — creating one...');
    createSession(function(newSession) {
      if (newSession) {
        _activeSessionId = newSession.id;
        DB.activeSessionId = newSession.id;
        persist();
        renderSessionList();
      }
    });
  }

  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  var prompt = buildChatPrompt(msg);

  // ── Clean console logging: what we send ──
  console.warn('[VIBECODING:SEND] ══════ REQUEST ══════');
  console.warn('[VIBECODING:SEND] Prompt:', prompt.length.toLocaleString(), 'chars | hasCode:', hasCode, '| interview:', interviewMode, '| attachment:', !!attachedFile);
  console.warn('[VIBECODING:SEND:FULL]', prompt);
  console.warn('[VIBECODING:SEND] ═══════════════════════');

  updateConnStatus('busy');
  setAiTimeout(prompt.length);
  _aiCallActive = true;

  // Use streaming if available, fall back to batch
  if (typeof tool.requestAIStream === 'function') {
    showThinkingBubble('AI is generating', true);
    var fullResponse = '';
    var streamStart = Date.now();

    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          // First token → create visible streaming message bubble in chat
          if (!_streamingMsgEl) {
            hideThinkingBubble();
            _beginStreamingMessage();
            console.warn('[VIBECODING:STREAM] 🔵 First token! Len:', token.length, 'Preview:', token.substring(0, 60));
          }
          fullResponse += token;
          setAiTimeout(prompt.length); // keepalive — reset timer on every token
          _appendStreamingToken(token);
        },
        onComplete: function() {
          var elapsed = Date.now() - streamStart;
          console.warn('[VIBECODING:RECEIVE] ══════ RESPONSE ══════');
          console.warn('[VIBECODING:RECEIVE] Stream complete —', fullResponse.length.toLocaleString(), 'chars | elapsed:', elapsed, 'ms');
          console.warn('[VIBECODING:RECEIVE:FULL]', fullResponse);
          console.warn('[VIBECODING:RECEIVE] ═══════════════════════');
          _aiCallActive = false;
          clearAiTimeout();
          hideThinkingBubble();
          if (fullResponse && fullResponse.trim() && fullResponse.length > 10) {
            _finalizeStreamingMessage(fullResponse, hasCode);
          } else {
            // Stream returned empty or just quotes — auto-retry with batch requestAI (may handle large prompts better)
            console.warn('[VIBECODING:RETRY] ⚠️ Streaming returned empty — auto-falling back to batch requestAI...');
            console.warn('[VIBECODING:RETRY]   Prompt size:', prompt.length, 'chars,', Math.round(prompt.length / 4), 'est tokens');
            updateConnStatus('busy');
            setAiTimeout(prompt.length);
            _aiCallActive = true;
            try {
              tool.requestAI(prompt, '', function(err2, response2) {
                var elapsed2 = Date.now() - streamStart;
                console.warn('[VIBECODING:RECEIVE] Retry batch —', (response2||'').length, 'chars | err:', err2 || 'none', '| elapsed:', elapsed2, 'ms');
                _aiCallActive = false;
                clearAiTimeout();
                hideThinkingBubble();
                if (response2 && response2.trim() && response2.length > 10) {
                  _finalizeStreamingMessage(response2, hasCode);
                } else if (err2) {
                  updateConnStatus('error');
                  addChatMessage('ai', '⚠️ **AI Error (retry):** ' + err2 + '\n\n🔧 The CMS AI service returned an error on retry. Check allowAi configuration.', true);
                } else {
                  // Both stream and batch failed — try last-resort minimal prompt
                  console.warn('[VIBECODING:LAST-RESORT] 🔴 Both stream AND batch retry returned empty — trying minimal prompt...');
                  var minimalPrompt = buildMinimalPrompt(msg);
                  console.warn('[VIBECODING:LAST-RESORT] Minimal prompt size:', minimalPrompt.length, 'chars');
                  updateConnStatus('busy');
                  setAiTimeout(minimalPrompt.length);
                  _aiCallActive = true;
                  tool.requestAI(minimalPrompt, '', function(err3, response3) {
                    _aiCallActive = false;
                    clearAiTimeout();
                    hideThinkingBubble();
                    if (response3 && response3.trim() && response3.length > 10) {
                      console.warn('[VIBECODING:LAST-RESORT] ✅ Minimal prompt succeeded! Response:', response3.length, 'chars');
                      _finalizeStreamingMessage(response3, hasCode);
                    } else {
                      updateConnStatus('error');
                      console.warn('[VIBECODING:LAST-RESORT] 🔴 Even minimal prompt failed — AI service is likely DOWN');
                      addChatMessage('ai', '⚠️ **AI service appears to be unavailable.**\n\nAll three attempts failed:\n• Streaming: returned empty\n• Batch with full prompt: returned empty\n• Batch with minimal prompt (~' + minimalPrompt.length + ' chars): also failed\n\n🔧 The CMS AI service may be down. Contact your CMS administrator to verify the AI gateway configuration.', true);
                    }
                    clearAttachment();
                    tool.resize();
                  });
                }
                clearAttachment();
                tool.resize();
              });
            } catch(e2) {
              console.warn('[VIBECODING:RETRY-EXC] 🔴 Retry requestAI THREW EXCEPTION');
              console.warn('  Error:', e2.message || e2);
              console.warn('  Stack:', (e2.stack || '(no stack)').substring(0, 300));
              _aiCallActive = false;
              clearAiTimeout();
              _setAiUIActive(false);
              hideThinkingBubble();
              updateConnStatus('error');
              addChatMessage('ai', '⚠️ **AI retry failed:** ' + (e2.message || 'Unknown') + '\n\n🔧 The AI service may not be available.', true);
              clearAttachment();
              tool.resize();
            }
          }
        },
        onError: function(err) {
          var elapsed = Date.now() - streamStart;
          console.warn('[VIBECODING:RECEIVE] Stream ERROR —', err, '| elapsed:', elapsed, 'ms');
          _aiCallActive = false;
          clearAiTimeout();
          hideThinkingBubble();
          updateConnStatus('error');
          addChatMessage('ai', '⚠️ **AI Stream Error:** ' + (err || 'Unknown stream failure') + '\n\n🔧 Check that allowAi is set to "yes" in field settings.', true);
          clearAttachment();
          tool.resize();
        }
      });
    } catch(e) {
      console.warn('[VIBECODING:STREAM-EXC] 🔴 requestAIStream THREW EXCEPTION — SDK may be broken');
      console.warn('  Error:', e.message || e);
      console.warn('  Error type:', typeof e);
      console.warn('  Stack:', (e.stack || '(no stack)').substring(0, 300));
      _aiCallActive = false;
      clearAiTimeout();
      hideThinkingBubble();
      updateConnStatus('error');
      addChatMessage('ai', '⚠️ **AI call failed:** ' + (e.message || 'Unknown error') + '\n\n🔧 The AI service may not be configured. Ask your CMS admin to verify allowAi is enabled.', true);
      clearAttachment();
      tool.resize();
    }
  } else {
    showThinkingBubble('AI is generating', false);
    var batchStart = Date.now();
    try {
      tool.requestAI(prompt, '', function(err, response) {
        var elapsed = Date.now() - batchStart;
        console.warn('[VIBECODING:RECEIVE] Batch complete —', (response||'').length, 'chars | err:', err || 'none', '| elapsed:', elapsed, 'ms');
        if (response && response.length > 10) console.warn('[VIBECODING:RECEIVE:FULL]', response);
        _aiCallActive = false;
        clearAiTimeout();
        hideThinkingBubble();
        if (response && response.trim() && response.length > 10) {
          updateConnStatus('ok');
          processAIResponse(response, hasCode);
        } else if (err) {
          updateConnStatus('error');
          addChatMessage('ai', '⚠️ **AI Error:** ' + err + '\n\n🔧 The CMS AI service returned an error. Check that allowAi is enabled and the AI service is configured.', true);
        } else {
          updateConnStatus('error');
          console.warn('[VIBECODING] requestAI returned NULL response with no error — possible causes: allowAi not enabled, AI service not configured, or request blocked');
          addChatMessage('ai', '⚠️ **No AI response received.**\n\nPossible causes:\n• allowAi not set to "yes" in field settings\n• AI service not configured for this tenant\n• The request was blocked or timed out\n\n🔧 Ask your CMS admin to verify the AI configuration.', true);
        }
        clearAttachment();
        tool.resize();
      });
    } catch(e) {
      console.warn('[VIBECODING:BATCH-EXC] 🔴 requestAI THREW EXCEPTION — SDK may be broken');
      console.warn('  Error:', e.message || e);
      console.warn('  Stack:', (e.stack || '(no stack)').substring(0, 300));
      _aiCallActive = false;
      clearAiTimeout();
      hideThinkingBubble();
      updateConnStatus('error');
      addChatMessage('ai', '⚠️ **AI call failed:** ' + (e.message || 'Unknown error') + '\n\n🔧 The AI service may not be available. Verify allowAi is set to "yes".', true);
      clearAttachment();
      tool.resize();
    }
  }
}

/* ── Visual Line Diff — uses jsdiff library (CDN) for proper LCS-based diffs ── */
function computeUnifiedDiff(oldCode, newCode) {
  // Use the diff library loaded via CDN — returns array of Change objects
  if (typeof diff === 'undefined' || !diff.diffLines) {
    // Fallback: simple line-by-line comparison if CDN didn't load
    console.warn('[VIBECODING:DIFF] diff library not loaded — using fallback');
    var oldLines = (oldCode || '').split('\n');
    var newLines = (newCode || '').split('\n');
    var result = [];
    var max = Math.max(oldLines.length, newLines.length);
    for (var i = 0; i < max; i++) {
      var ol = i < oldLines.length ? oldLines[i] : null;
      var nl = i < newLines.length ? newLines[i] : null;
      if (ol === nl) result.push({ type: 'same', text: ol || '' });
      else if (ol === null && nl !== null) result.push({ type: 'add', text: nl });
      else if (nl === null && ol !== null) result.push({ type: 'remove', text: ol });
      else { result.push({ type: 'remove', text: ol }); result.push({ type: 'add', text: nl }); }
    }
    return result;
  }

  var changes = diff.diffLines(oldCode || '', newCode || '');
  var result = [];

  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var lines = change.value.replace(/\n$/, '').split('\n');
    var type;
    if (change.added) type = 'add';
    else if (change.removed) type = 'remove';
    else type = 'same';

    for (var j = 0; j < lines.length; j++) {
      if (lines[j] !== '' || j < lines.length - 1 || change.value === '\n') {
        result.push({ type: type, text: lines[j] });
      }
    }
  }

  return result;
}

/* ── Build tabbed diff HTML for the three code blocks ── */
function buildDiffTabs(diffs) {
  // diffs: { html: [...], css: [...], js: [...], stats: { html:{added,removed}, css:{added,removed}, js:{added,removed} } }
  var tabs = [
    { id: 'html', icon: '📄', label: 'HTML', diff: diffs.html, added: diffs.stats.html.added, removed: diffs.stats.html.removed },
    { id: 'css', icon: '🎨', label: 'CSS', diff: diffs.css, added: diffs.stats.css.added, removed: diffs.stats.css.removed },
    { id: 'js', icon: '⚙️', label: 'JS', diff: diffs.js, added: diffs.stats.js.added, removed: diffs.stats.js.removed }
  ];

  var html = '<div class="chat-diff-tabs" data-diff-id="' + diffs._id + '">';
  
  // Tab header buttons
  html += '<div class="chat-diff-tab-header">';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var stat = '';
    if (t.added > 0) stat += ' +' + t.added;
    if (t.removed > 0) stat += ' −' + t.removed;
    if (!stat) stat = ' unchanged';
    var activeClass = i === 0 ? ' active' : '';
    html += '<button class="diff-tab-btn' + activeClass + '" data-diff-tab="' + t.id + '" data-diff-id="' + diffs._id + '">' + t.icon + ' ' + t.label + '<br><small style="font-weight:400;font-size:9px">' + stat + '</small></button>';
  }
  html += '</div>';

  // Tab body panels
  for (var j = 0; j < tabs.length; j++) {
    var tb = tabs[j];
    var activePanel = j === 0 ? ' active' : '';
    html += '<div class="chat-diff-tab-body' + activePanel + '" data-diff-panel="' + tb.id + '" data-diff-id="' + diffs._id + '">';
    
    if (!tb.diff || !tb.diff.length) {
      html += '<div class="chat-diff-line diff-same">(no changes)</div>';
    } else {
      for (var k = 0; k < tb.diff.length; k++) {
        var line = tb.diff[k];
        var cls = 'chat-diff-line diff-' + line.type;
        var prefix = line.type === 'add' ? '+ ' : (line.type === 'remove' ? '− ' : '  ');
        html += '<div class="' + cls + '">' + prefix + esc(line.text) + '</div>';
      }
    }
    
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/* ── Global diff click handler (delegated from renderChatMessages) ── */
function handleDiffTabClick(btn) {
  var tabId = btn.getAttribute('data-diff-tab');
  var diffId = btn.getAttribute('data-diff-id');
  
  // Deactivate all tab buttons in this diff group
  var header = btn.parentNode;
  if (header) {
    var allBtns = header.querySelectorAll('.diff-tab-btn');
    for (var i = 0; i < allBtns.length; i++) {
      allBtns[i].classList.remove('active');
    }
  }
  btn.classList.add('active');

  // Find all panels in this diff group and show only the matching one
  var container = btn.closest('.chat-diff-tabs');
  if (container) {
    var panels = container.querySelectorAll('.chat-diff-tab-body');
    for (var j = 0; j < panels.length; j++) {
      var p = panels[j];
      if (p.getAttribute('data-diff-panel') === tabId && p.getAttribute('data-diff-id') === diffId) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    }
  }
}

/* ── Process AI Response (shared by stream & batch) ── */
function processAIResponse(response, hasCode) {
  var isInterview = isInterviewQuestion(response);
  console.warn('[VIBECODING:PROCESS] Response:', response.length, 'chars | hasCode:', hasCode, '| isInterview:', isInterview);
  // Check if this is an interview question (has clickable [[options]])
  if (isInterviewQuestion(response)) {
    console.warn('[VIBECODING:PROCESS] Response is interview question — rendering option buttons');
    // Render as chat message with option buttons — handled in renderChatMessages
    addChatMessage('ai', response);
    return;
  }

  var parsed = parseGeneratedCode(response);
  console.warn('[VIBECODING:PARSE] HTML:', (parsed.html||'').length, 'chars | CSS:', (parsed.css||'').length, 'chars | JS:', (parsed.js||'').length, 'chars');
  
  // Guard: if response is very short and has no code blocks, treat as empty/junk
  if (!parsed.html && !parsed.css && !parsed.js && response.trim().length < 20) {
    console.warn('[VIBECODING:PROCESS] Response too short (' + response.trim().length + ' chars) with no code blocks — treating as empty');
    addChatMessage('ai', '⚠️ **AI returned an empty or invalid response.**\n\nRaw: ' + JSON.stringify(response) + '\n\n🔧 The AI model may be misconfigured. Try again or check the AI gateway logs.', true);
    return;
  }

  if (parsed.html || parsed.css || parsed.js) {
    console.warn('[VIBECODING:APPLY] About to apply code — html:', (parsed.html||'').length, 'css:', (parsed.css||'').length, 'js:', (parsed.js||'').length);
    // Got code! Turn off interview mode if it was on
    if (interviewMode) {
      interviewMode = false;
      var btn = el('btn-guided-mode');
      if (btn) { btn.classList.remove('active'); btn.textContent = '🪄 Guided'; }
    }

    // Snapshot old code for diff BEFORE replacing
    var oldHtml = hasCode ? (DB.code.html || '') : '';
    var oldCss = hasCode ? (DB.code.css || '') : '';
    var oldJs = hasCode ? (DB.code.js || '') : '';

    if (parsed.html) DB.code.html = parsed.html;
    if (parsed.css) DB.code.css = parsed.css;
    if (parsed.js) DB.code.js = parsed.js;
    console.warn('[VIBECODING:APPLY] DB.code now — html:', DB.code.html.length, 'css:', DB.code.css.length, 'js:', DB.code.js.length);
    console.warn('[VIBECODING:APPLY] Calling displayAllCode...');
    displayAllCode(DB.code);

    if (!hasCode) addToHistory(DB.code);

    var summary = extractSummary(response);

    // Build tabbed visual diff — DEVELOPERS ONLY (technical feature)
    var diffHtml = '';
    if (hasCode && isDeveloper()) {
      var dHtml = computeUnifiedDiff(oldHtml, DB.code.html);
      var dCss = computeUnifiedDiff(oldCss, DB.code.css);
      var dJs = computeUnifiedDiff(oldJs, DB.code.js);

      // Count stats
      var countStats = function(diff) {
        var a = 0, r = 0;
        for (var di = 0; di < diff.length; di++) {
          if (diff[di].type === 'add') a++;
          else if (diff[di].type === 'remove') r++;
        }
        return { added: a, removed: r };
      };

      var diffData = {
        _id: 'd' + Date.now().toString(36),
        html: dHtml, css: dCss, js: dJs,
        stats: {
          html: countStats(dHtml),
          css: countStats(dCss),
          js: countStats(dJs)
        }
      };

      // Only show tabs if there are actual changes
      var totalChanges = diffData.stats.html.added + diffData.stats.html.removed +
                         diffData.stats.css.added + diffData.stats.css.removed +
                         diffData.stats.js.added + diffData.stats.js.removed;
      if (totalChanges > 0) {
        diffHtml = buildDiffTabs(diffData);
      } else {
        diffHtml = '<p style="font-size:11px;color:var(--text3);margin-top:6px">📊 <b>Changes:</b> (no significant line changes detected)</p>';
      }
    } else if (hasCode && !isDeveloper()) {
      // Non-developer: simple text summary only, no diff tabs
      var oldTotal = (oldHtml||'').length + (oldCss||'').length + (oldJs||'').length;
      var newTotal = DB.code.html.length + DB.code.css.length + DB.code.js.length;
      if (oldTotal !== newTotal) {
        diffHtml = '<p style="font-size:11px;color:var(--text3);margin-top:6px">📊 <b>Code updated</b> — see Preview tab for changes.</p>';
      }
    }

    addChatMessage('ai', summary + '\n\n✅ *Code updated.*', false, diffHtml);
    persist();

    if (!hasCode) switchTab('preview');
    // Auto-review disabled — was doubling request time and Gateway batch path is broken.
    // To re-enable, call runAutoReview() manually from console.
    // runAutoReview();
  } else {
    addChatMessage('ai', response);
  }
}

/* ── Agentic Auto-Review ── */
function runAutoReview() {
  var reviewPrompt = [
    'You just generated an HTML tool for UniconHub CMS. Review YOUR OWN output for compliance with these rules:',
    '',
    '1. HTML block: Contains NO <html>, <head>, <style>, <script>, <body>, or <!DOCTYPE> tags. Body markup only.',
    '2. CSS block: Contains NO <style> tag. Pure CSS rules only.',
    '3. JS block: Contains NO <script> tag. Pure JavaScript only.',
    '4. JS uses tool.onReady(cb) as entry point. No DOMContentLoaded or window.onload.',
    '5. JS uses ONLY ES5: var (not let/const), no spread (...), no template literals (`), no arrow functions (=>), no destructuring, no for...of, no class/Promise/async.',
    '6. JS handles tool.isReadOnly(), tool.resize(), tool.setValue()/getValue().',
    '7. No localStorage, sessionStorage, fetch, alert, confirm, prompt, or raw postMessage in JS.',
    '8. All three blocks are present and complete. No placeholders or TODO comments.',
    '9. HTML event handlers (onclick, onchange) reference functions DEFINED in JS. No dangling calls.',
    '10. HTML is semantic and complete. CSS uses variables and is responsive. JS has error handling.',
    '',
    '=== CURRENT CODE (review this) ===',
    '[HTML]',
    DB.code.html || '(empty)',
    '',
    '[CSS]',
    DB.code.css || '(empty)',
    '',
    '[JS]',
    DB.code.js || '(empty)',
    '',
    'If you find ANY issues, output the CORRECTED three blocks. If everything is already perfect,',
    'respond with "✅ REVIEW PASSED — no issues found." and do NOT output code blocks.',
    'Be strict about the rules. Fix even minor issues. Output format if fixing: [HTML]...[CSS]...[JS]'
  ].join('\n');

  console.warn('[VIBECODING] runAutoReview — reviewPrompt length:', reviewPrompt.length);
  showThinkingBubble('AI is reviewing code', true);

  // Prefer streaming — batch path in AI Gateway returns errorMessage type
  if (typeof tool.requestAIStream === 'function') {
    var reviewText = '';
    tool.requestAIStream(reviewPrompt, '', {
      onToken: function(t) { reviewText += t; if (_streamCallback) _streamCallback(t); },
      onComplete: function() {
        hideThinkingBubble();
        console.warn('[VIBECODING] runAutoReview stream complete —', reviewText.length, 'chars');
        applyReviewFixes(reviewText);
        tool.resize();
      },
      onError: function(err) {
        hideThinkingBubble();
        console.warn('[VIBECODING] runAutoReview stream error —', err);
        addChatMessage('ai', '🔍 **Auto-review:** Skipped (stream error). Code from first pass is in place.');
        tool.resize();
      }
    });
  } else {
    // Fallback: batch (may not work if Gateway batch path is broken)
    tool.requestAI(reviewPrompt, '', function(err, response) {
      console.warn('[VIBECODING] runAutoReview batch callback — err:', err || 'null', 'response:', response ? (response.length + ' chars') : 'NULL');
      hideThinkingBubble();
      if (response && response.length > 10) {
        applyReviewFixes(response);
      } else {
        addChatMessage('ai', '🔍 **Auto-review:** Skipped (batch response empty). Code from first pass is in place.');
      }
      tool.resize();
    });
  }
}

function applyReviewFixes(response) {
  var fixed = parseGeneratedCode(response);
  if (fixed.html || fixed.css || fixed.js) {
    if (fixed.html) DB.code.html = fixed.html;
    if (fixed.css) DB.code.css = fixed.css;
    if (fixed.js) DB.code.js = fixed.js;
    displayAllCode(DB.code);
    addChatMessage('ai', '🔍 **Auto-review:** Found and fixed issues for rule compliance. Code updated.');
    persist();
  } else if (response.indexOf('REVIEW PASSED') !== -1 || response.indexOf('no issues') !== -1) {
    addChatMessage('ai', '🔍 **Auto-review:** ✅ All rule checks passed. Code is ready.');
  } else {
    addChatMessage('ai', '🔍 **Auto-review:** ' + response.substring(0, 300));
  }
}

function extractSummary(text) {
  // Strip the three code blocks (greedy this time — grab everything from [HTML] to end of [JS])
  var cleaned = text
    .replace(/\[HTML\][\s\S]*?\[CSS\]/gi, '')
    .replace(/\[CSS\][\s\S]*?\[JS\]/gi, '')
    .replace(/\[JS\][\s\S]*$/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Show up to 3000 chars of the AI's commentary — the bubble scrolls now
  if (cleaned.length > 3000) cleaned = cleaned.substring(0, 3000) + '...';
  return cleaned || 'Here are the updated files:';
}

function addChatMessage(role, text, isError, diffHtml) {
  if (!Array.isArray(DB.chatMessages)) DB.chatMessages = [];
  var user = tool.getUser() || {};
  DB.chatMessages.push({
    role: role, text: text, time: new Date().toISOString(), isError: !!isError,
    userId: role === 'ai' ? 'ai' : (user.id || 'anon'),
    userName: role === 'ai' ? 'AI Assistant' : (user.name || 'Anonymous'),
    diffHtml: diffHtml || ''
  });
  if (DB.chatMessages.length > 500) DB.chatMessages = DB.chatMessages.slice(-500);
  renderChatMessages();
  updateChatBadge();
  renderSessionList(); // update session list timestamps

  // Sync to CRUD session cache
  if (_activeSessionId) {
    for (var i = 0; i < _sessions.length; i++) {
      if (_sessions[i].id === _activeSessionId) {
        var pd = _sessions[i].productData || {};
        var dcb = pd.data_categoriesBased || {};
        dcb.messages = DB.chatMessages.slice();
        dcb.updatedAt = new Date().toISOString();
        pd.data_categoriesBased = dcb;
        _sessions[i].productData = pd;
        break;
      }
    }
    // Auto-title on first user message (count user messages, not total)
    if (role === 'user') {
      var userMsgCount = 0;
      for (var mi = 0; mi < DB.chatMessages.length; mi++) {
        if (DB.chatMessages[mi].role === 'user') userMsgCount++;
      }
      if (userMsgCount === 1) autoTitleSession();
    }
  }
}

var _thinkingTimer = null;
var _thinkingMsgEl = null;
var _thinkingStartTime = 0;

function showThinkingBubble(label, hasStreaming) {
  hideThinkingBubble();
  var container = el('chat-messages'); if (!container) return;
  _thinkingStartTime = Date.now();

  var bubble = document.createElement('div');
  bubble.className = 'chat-thinking';
  bubble.id = 'thinking-bubble';

  var bodyContent = hasStreaming
    ? '<div class="think-stream-label">Thinking…</div><div class="think-stream" id="think-stream"></div>'
    : '<div class="think-stream-label">Waiting for AI response…</div><div class="think-stream" id="think-stream" style="display:none"></div>';

  bubble.innerHTML =
    '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
      '<div class="chat-thinking-dots"><span></span><span></span><span></span></div>' +
      '<span class="chat-thinking-text" id="think-label">' + esc(label || 'AI is thinking') + '</span>' +
      '<span class="think-time" id="think-time">0:00</span>' +
      '<span class="think-toggle" id="think-toggle">▶</span>' +
      '<button class="think-cancel" id="think-cancel" title="Cancel this request" style="display:none">✕</button>' +
    '</div>' +
    '<div class="think-body" id="think-body" style="display:none">' +
      bodyContent +
    '</div>';

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  // Click header to toggle expand/collapse
  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  var streamEl = bubble.querySelector('#think-stream');
  var labelEl = bubble.querySelector('#think-stream-label');

  hdr.onclick = function() {
    if (!bodyEl || !toggleEl) return;
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  // Auto-expand on first token (only when hasStreaming)
  if (hasStreaming) {
    var firstToken = true;
    _streamCallback = function(token) {
      if (firstToken) {
        if (bodyEl) bodyEl.style.display = 'block';
        if (toggleEl) toggleEl.textContent = '▼';
        if (labelEl) labelEl.style.display = 'none';
        firstToken = false;
      }
      appendStreamToken(token);
    };
  } else {
    _streamCallback = null;
  }

  // Show cancel button after 5 seconds
  var cancelBtn = bubble.querySelector('#think-cancel');
  if (cancelBtn) {
    setTimeout(function() {
      if (_thinkingMsgEl === bubble && cancelBtn) cancelBtn.style.display = '';
    }, 5000);
    cancelBtn.onclick = function(e) {
      e.stopPropagation();
      cancelAiRequest();
    };
  }

  // Animate dots + elapsed timer with warnings at 15s and 30s
  var dots = 0;
  _thinkingTimer = setInterval(function() {
    dots = (dots + 1) % 4;
    var lbl = bubble.querySelector('#think-label');
    var elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    if (lbl) {
      if (elapsed > 30) lbl.textContent = '⚠ Still waiting (' + timeStr + ') — AI may be unavailable';
      else if (elapsed > 15) lbl.textContent = 'Waiting for AI response... ' + timeStr;
      else lbl.textContent = (label || 'AI is thinking') + Array(dots + 1).join('.');
    }
    var timeEl = bubble.querySelector('#think-time');
    if (timeEl) timeEl.textContent = timeStr;
  }, 500);
}

var _streamCallback = null;
var _consoleEntries = [];
var _aiTimeoutId = null;
var _connStatus = 'ok'; // ok | busy | error
var _aiCallActive = false; // true while waiting for AI callback
var _initialized = false;   // guard against CMS re-injecting HTML multiple times

/* ── Live Streaming Message State ── */
var _streamingMsgEl = null;   // DOM element reference for fast text append
var _streamingMsgIdx = -1;    // index of the streaming message in DB.chatMessages
var _streamCurrentTab = 'text'; // which tab is currently receiving tokens: text|html|css|js
var _streamTabEls = {};        // { text: <pre>, html: <pre>, css: <pre>, js: <pre> }
var _streamBuf = '';           // small buffer for detecting code-block boundaries

function _buildStreamingTabs(bubble) {
  // Replace the bubble's content with a tabbed code viewer
  bubble.innerHTML =
    '<div class="chat-msg-label">AI</div>' +
    '<div class="chat-stream-tabs">' +
      '<div class="stream-tab-header">' +
        '<button class="stream-tab-btn active" data-stab="text">💬</button>' +
        '<button class="stream-tab-btn" data-stab="html">📄 HTML</button>' +
        '<button class="stream-tab-btn" data-stab="css">🎨 CSS</button>' +
        '<button class="stream-tab-btn" data-stab="js">⚙️ JS</button>' +
      '</div>' +
      '<div class="stream-tab-panel active" data-stab-panel="text"><pre class="stream-pre"></pre></div>' +
      '<div class="stream-tab-panel" data-stab-panel="html"><pre class="stream-pre"></pre></div>' +
      '<div class="stream-tab-panel" data-stab-panel="css"><pre class="stream-pre"></pre></div>' +
      '<div class="stream-tab-panel" data-stab-panel="js"><pre class="stream-pre"></pre></div>' +
    '</div>' +
    '<div class="chat-msg-time">' + new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'}) + '</div>';

  // Capture pre elements for each tab
  var panels = bubble.querySelectorAll('.stream-tab-panel');
  for (var p = 0; p < panels.length; p++) {
    var panelId = panels[p].getAttribute('data-stab-panel');
    var pre = panels[p].querySelector('.stream-pre');
    if (panelId && pre) _streamTabEls[panelId] = pre;
  }

  // Wire tab button clicks
  var btns = bubble.querySelectorAll('.stream-tab-btn');
  for (var b = 0; b < btns.length; b++) {
    btns[b].onclick = function() {
      var tabId = this.getAttribute('data-stab');
      // Deactivate all
      var allBtns = bubble.querySelectorAll('.stream-tab-btn');
      var allPanels = bubble.querySelectorAll('.stream-tab-panel');
      for (var ab = 0; ab < allBtns.length; ab++) allBtns[ab].classList.remove('active');
      for (var ap = 0; ap < allPanels.length; ap++) allPanels[ap].classList.remove('active');
      // Activate selected
      this.classList.add('active');
      var panel = bubble.querySelector('.stream-tab-panel[data-stab-panel="' + tabId + '"]');
      if (panel) { panel.classList.add('active'); panel.querySelector('.stream-pre').scrollTop = panel.querySelector('.stream-pre').scrollHeight; }
    };
  }

  _streamingMsgEl = bubble;
  _streamCurrentTab = 'text';
  _streamBuf = '';
}

function _beginStreamingMessage() {
  _streamingMsgIdx = DB.chatMessages.length;
  DB.chatMessages.push({
    role: 'ai', text: '', time: new Date().toISOString(), isError: false,
    userId: 'ai', userName: 'AI Assistant', diffHtml: ''
  });
  renderChatMessages();
  updateChatBadge();
  // Find the new bubble and build tab structure inside it
  var container = el('chat-messages');
  if (container) {
    var bubbles = container.querySelectorAll('.chat-msg-ai');
    var bubble = bubbles[bubbles.length - 1];
    if (bubble) {
      _buildStreamingTabs(bubble);
    }
  }
  console.warn('[VIBECODING:STREAM] 🟢 Streaming msg with tabs — idx:', _streamingMsgIdx);
}

function _appendStreamingToken(token) {
  if (_streamingMsgIdx < 0) return;
  // Update DB state
  if (_streamingMsgIdx < DB.chatMessages.length) {
    DB.chatMessages[_streamingMsgIdx].text += token;
  }
  // Re-acquire DOM reference if stale
  if (_streamingMsgEl && !_streamingMsgEl.parentNode) {
    _streamingMsgEl = null;
    _streamTabEls = {};
  }
  if (!_streamingMsgEl) {
    var container = el('chat-messages');
    if (container) {
      var bubbles = container.querySelectorAll('.chat-msg-ai');
      if (bubbles.length > 0) {
        var bubble = bubbles[bubbles.length - 1];
        // Check if bubble has tab structure
        var existingTabs = bubble.querySelector('.chat-stream-tabs');
        if (existingTabs) {
          _streamingMsgEl = bubble;
          var panels = bubble.querySelectorAll('.stream-tab-panel');
          for (var p = 0; p < panels.length; p++) {
            var panelId = panels[p].getAttribute('data-stab-panel');
            var pre = panels[p].querySelector('.stream-pre');
            if (panelId && pre) _streamTabEls[panelId] = pre;
          }
        } else {
          // Rebuild tabs
          _buildStreamingTabs(bubble);
        }
      }
    }
  }

  // Detect code-block boundaries in the token stream
  _streamBuf += token;
  var newTab = _streamCurrentTab;
  if (_streamBuf.indexOf('[HTML]') !== -1) newTab = 'html';
  else if (_streamBuf.indexOf('[CSS]') !== -1) newTab = 'css';
  else if (_streamBuf.indexOf('[JS]') !== -1) newTab = 'js';

  if (newTab !== _streamCurrentTab) {
    // Switch active tab
    _streamCurrentTab = newTab;
    _streamBuf = ''; // reset buffer
    if (_streamingMsgEl) {
      // Update tab button highlighting
      var allBtns = _streamingMsgEl.querySelectorAll('.stream-tab-btn');
      var allPanels = _streamingMsgEl.querySelectorAll('.stream-tab-panel');
      for (var ab = 0; ab < allBtns.length; ab++) allBtns[ab].classList.remove('active');
      for (var ap = 0; ap < allPanels.length; ap++) allPanels[ap].classList.remove('active');
      var activeBtn = _streamingMsgEl.querySelector('.stream-tab-btn[data-stab="' + _streamCurrentTab + '"]');
      var activePanel = _streamingMsgEl.querySelector('.stream-tab-panel[data-stab-panel="' + _streamCurrentTab + '"]');
      if (activeBtn) activeBtn.classList.add('active');
      if (activePanel) activePanel.classList.add('active');
    }
  }

  // Append token to the active tab's pre element (skip the marker line itself)
  var targetPre = _streamTabEls[_streamCurrentTab];
  if (targetPre) {
    // Strip the marker from the first token in a new section
    var displayText = token;
    if (_streamCurrentTab !== 'text' && _streamBuf === token) {
      // This is the first token after switching — clean up marker artifacts
      displayText = token.replace(/^\[HTML\]\s*/i, '').replace(/^\[CSS\]\s*/i, '').replace(/^\[JS\]\s*/i, '');
    }
    targetPre.textContent += displayText;
    targetPre.scrollTop = targetPre.scrollHeight;
  }

  // Auto-scroll chat to bottom
  var chatContainer = el('chat-messages');
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

function _finalizeStreamingMessage(fullText, hasCode) {
  console.warn('[VIBECODING:STREAM] 🟢 Finalizing — fullText:', fullText.length, 'chars | hasCode:', hasCode);
  // Remove the placeholder streaming message — processAIResponse will add the final version
  if (_streamingMsgIdx >= 0 && _streamingMsgIdx < DB.chatMessages.length) {
    DB.chatMessages.splice(_streamingMsgIdx, 1);
  }
  _streamingMsgEl = null;
  _streamingMsgIdx = -1;
  _streamTabEls = {};
  _streamCurrentTab = 'text';
  _streamBuf = '';
  _setAiUIActive(false);
  // Now process the full response normally (adds the proper final message)
  updateConnStatus('ok');
  processAIResponse(fullText, hasCode);
  clearAttachment();
  tool.resize();
}

function updateConnStatus(status) {
  if (status !== _connStatus) console.warn('[VIBECODING:CONN] Status: ' + _connStatus + ' → ' + status);
  _connStatus = status;
  var dot = el('chat-conn-status');
  if (dot) { dot.className = 'chat-status-dot ' + status; dot.title = status === 'ok' ? 'Ready' : status === 'busy' ? 'AI working...' : 'Error — check console'; }
}

/* Toggle AI-active UI state: disable send button + input, show/hide stop button */
function _setAiUIActive(active) {
  var sendBtn = el('btn-chat-send');
  var stopBtn = el('btn-chat-stop');
  var input = el('chat-input');
  if (sendBtn) { sendBtn.disabled = active; sendBtn.style.opacity = active ? '0.4' : ''; }
  if (stopBtn) stopBtn.style.display = active ? '' : 'none';
  if (input) { input.disabled = active; input.style.opacity = active ? '0.5' : ''; }
}

function setAiTimeout(promptLen) {
  clearAiTimeout();
  _aiTimeoutId = setTimeout(function() {
    console.warn('[VIBECODING:TIMEOUT] 🔴 AI request timed out after 600 seconds');
    console.warn('  promptChars:', promptLen, 'estTokens:', Math.round(promptLen / 4));
    console.warn('  _aiCallActive was:', _aiCallActive);
    console.warn('  _connStatus was:', _connStatus);
    console.warn('  Likely cause: AI Gateway never called back — check JWT token and Gateway connectivity');
    _aiCallActive = false;
    hideThinkingBubble();
    _setAiUIActive(false);
    var errMsg = '⏰ **AI request timed out after 600 seconds.**\n\n' +
      'Possible causes:\n' +
      '• The AI Gateway or model is overloaded\n' +
      '• Prompt too large? (' + promptLen.toLocaleString() + ' chars — dynamic limit based on model)\n' +
      '• Network issue between browser and AI Gateway\n' +
      '• allowAi parameter not set to "yes"\n\n' +
      '🔧 Try sending again or simplifying your request.';
    addChatMessage('ai', errMsg, true);
    updateConnStatus('error');
    tool.resize();
  }, 605000); // 600s AI timeout + 5s buffer
}

function clearAiTimeout() {
  if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
}

function cancelAiRequest() {
  console.warn('[VIBECODING] Request CANCELLED by user');
  _aiCallActive = false;
  clearAiTimeout();
  _setAiUIActive(false);
  hideThinkingBubble();
  updateConnStatus('error');
  addChatMessage('ai', '⏹ **Request cancelled.** You can try again or check your AI configuration.', true);
  tool.resize();
}

/* ── Console capture from preview iframe ── */
function initConsoleCapture() {
  window.addEventListener('message', function(e) {
    if (e.data && e.data.vibeConsole) {
      var entry = e.data.vibeConsole;
      _consoleEntries.push(entry);
      if (_consoleEntries.length > 500) _consoleEntries.shift();
      if (currentTab === 'console') renderConsole();
      updateConsoleBadge();
    }
  });
}

function renderConsole() {
  var out = el('console-output');
  if (!out) return;
  if (!_consoleEntries.length) {
    out.innerHTML = '<div class="console-empty">🪲 Console output from preview will appear here.<br>Click buttons in the Preview tab and watch for logs.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < _consoleEntries.length; i++) {
    var e = _consoleEntries[i];
    var cls = e.level === 'error' ? 'console-err' : e.level === 'warn' ? 'console-warn' : 'console-log';
    var time = '';
    try { time = new Date(e.time).toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit'}); } catch(ex) {}
    html += '<div class="console-line ' + cls + '"><span class="console-time">' + time + '</span> ' + esc(e.msg) + '</div>';
  }
  out.innerHTML = html;
  out.scrollTop = out.scrollHeight;
  el('console-count').textContent = _consoleEntries.length + ' entries';
}

function updateConsoleBadge() {
  // Update tab badge if needed
}

function clearConsole() {
  _consoleEntries = [];
  renderConsole();
}

function appendStreamToken(token) {
  if (!_thinkingMsgEl) return;
  var stream = _thinkingMsgEl.querySelector('#think-stream');
  if (stream) {
    // Hide "Thinking…" label on first content
    var label = _thinkingMsgEl.querySelector('#think-stream-label');
    if (label && stream.textContent === '') label.style.display = 'none';
    stream.textContent += token;
    _thinkingMsgEl.scrollTop = _thinkingMsgEl.scrollHeight;
    var container = el('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

function hideThinkingBubble() {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (_thinkingMsgEl) {
    _thinkingMsgEl.style.opacity = '0';
    _thinkingMsgEl.style.transform = 'translateY(-8px)';
    _thinkingMsgEl.style.transition = 'opacity 0.2s, transform 0.2s';
    var el = _thinkingMsgEl;
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    _thinkingMsgEl = null;
  }
}

function renderChatMessages() {
  var container = el('chat-messages'); if (!container) return;
  // Preserve the thinking bubble if AI is currently streaming
  var thinkingEl = document.getElementById('thinking-bubble');
  if (!DB.chatMessages || !DB.chatMessages.length) {
    container.innerHTML = '<div class="chat-welcome">' +
      '<div class="chat-welcome-icon">👋</div>' +
      '<h3>Welcome to VibeCoding</h3>' +
      '<p>Pick a template below, or just <b>describe what you need</b> in the chat — the AI will build it for you.</p>' +
      '<div class="template-gallery" id="template-gallery"></div>' +
      '<div class="template-view-all"><button id="btn-view-all-templates">View all 8 templates →</button></div>' +
      '<p style="font-size:10px;color:var(--text3);margin-top:12px">💡 <b>Tip:</b> Try <b>🪄 Guided</b> mode — the AI will ask you questions step by step.</p>' +
    '</div>';
    // Render template cards into the gallery
    var gal = container.querySelector('#template-gallery');
    if (gal) renderTemplateGallery(gal);
    // Bind view-all button
    var vaBtn = container.querySelector('#btn-view-all-templates');
    if (vaBtn) vaBtn.onclick = function() {
      // Show all templates list in the modal
      _currentTemplate = null;
      openModal('modal-template');
    };
    return;
  }
  var html = '';
  for (var i = 0; i < DB.chatMessages.length; i++) {
    var m = DB.chatMessages[i];
    var timeStr = ''; try { timeStr = new Date(m.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch(e) {}
    var cls = m.role === 'user' ? 'chat-msg-user' : (m.isError ? 'chat-msg-ai chat-msg-err' : 'chat-msg-ai');
    var label = m.role === 'user' ? 'YOU' : (m.isError ? '⚠ ERROR' : 'AI');
    var text = esc(m.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[HTML\]/gi, '<b>[HTML]</b>').replace(/\[CSS\]/gi, '<b>[CSS]</b>').replace(/\[JS\]/gi, '<b>[JS]</b>').replace(/\n/g, '<br>');
    var diffBlock = m.diffHtml || '';
    html += '<div class="chat-msg ' + cls + '"><div class="chat-msg-label">' + label + '</div><div>' + text + '</div>' + diffBlock + '<div class="chat-msg-time">' + timeStr + '</div></div>';
  }
  container.innerHTML = html;

  // Bind diff tab button clicks (delegated)
  var diffBtns = container.querySelectorAll('.diff-tab-btn');
  for (var db = 0; db < diffBtns.length; db++) {
    diffBtns[db].onclick = function() { handleDiffTabClick(this); };
  }

  // Post-process: find AI messages with [[options]] and render clickable buttons
  var aiMsgs = container.querySelectorAll('.chat-msg-ai');
  for (var j = 0; j < aiMsgs.length; j++) {
    var msgEl = aiMsgs[j];
    var rawText = msgEl.querySelector('div:nth-child(2)');
    if (rawText) {
      var innerHTML = rawText.innerHTML;
      // Check if message has [[option_id]] patterns
      if (/\[\[[a-zA-Z0-9_-]+\]\]/.test(innerHTML)) {
        // Replace <br> back to \n for parsing, then render options
        var plainText = innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
        var rendered = parseAndRenderOptions(plainText);
        // Convert back: escape, process bold, convert newlines
        var escaped = esc(rendered).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        // But parseAndRenderOptions already returns HTML — we need to use it directly
        // Actually, let's rebuild: split on the options part
        var optIdx = rendered.indexOf('<div class="chat-options">');
        if (optIdx !== -1) {
          var beforeOpts = rendered.substring(0, optIdx);
          var optsHtml = rendered.substring(optIdx);
          rawText.innerHTML = esc(beforeOpts).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + optsHtml;
        }
      }
    }
  }

  container.scrollTop = container.scrollHeight;
}

function updateChatBadge() {
  var badge = el('chat-msg-count'); if (badge) badge.textContent = (DB.chatMessages || []).length;
}

/* ── Full Generation (from Config tab button) ── */
function runFullGeneration() {
  collectFormData(); persist();
  var reqId = nextReqId();
  _currentReqId = reqId;
  console.warn('[VIBECODING:' + reqId + '] ══════ FULL GENERATION ══════');
  var prompt = buildFullPrompt();
  var hasChat = DB.chatMessages && DB.chatMessages.length > 0;
  // ── Clean console logging: what we send ──
  console.warn('[VIBECODING:SEND] ══════ FULL GEN ══════');
  console.warn('[VIBECODING:SEND] Prompt:', prompt.length.toLocaleString(), 'chars | toolName:', DB.toolName || '(none)');
  console.warn('[VIBECODING:SEND:FULL]', prompt);
  console.warn('[VIBECODING:SEND] ═══════════════════════');
  updateConnStatus('busy');
  setAiTimeout(prompt.length);
  _aiCallActive = true;

  if (typeof tool.requestAIStream === 'function') {
    var fullResponse = '';
    showThinkingBubble('AI is generating full tool', true);

    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          if (!_streamingMsgEl) {
            hideThinkingBubble();
            _beginStreamingMessage();
            console.warn('[VIBECODING:STREAM] 🔵 [FullGen] First token! Len:', token.length);
          }
          fullResponse += token;
          setAiTimeout(prompt.length);
          _appendStreamingToken(token);
        },
        onComplete: function() {
          _aiCallActive = false;
          clearAiTimeout();
          hideThinkingBubble();
          if (fullResponse && fullResponse.trim() && fullResponse.length > 10) {
            console.warn('[VIBECODING:RECEIVE] Full gen stream —', fullResponse.length.toLocaleString(), 'chars');
            console.warn('[VIBECODING:RECEIVE:FULL]', fullResponse);
            _finalizeStreamingMessage(fullResponse, hasChat);
          } else {
            updateConnStatus('error');
            console.warn('[VIBECODING] Full gen stream returned EMPTY response');
            showToast('AI returned empty response. Try reducing requirements or check AI config.', 'error');
          }
        },
        onError: function(err) {
          _aiCallActive = false;
          clearAiTimeout();
          hideThinkingBubble();
          updateConnStatus('error');
          showToast('Generation failed: ' + err, 'error');
        }
      });
    } catch(e) {
      _aiCallActive = false;
      clearAiTimeout();
      hideThinkingBubble();
      updateConnStatus('error');
      showToast('AI call failed: ' + (e.message || 'Unknown'), 'error');
    }
  } else {
    showThinkingBubble('AI is generating full tool', false);
    try {
      tool.requestAI(prompt, '', function(err, response) {
        _aiCallActive = false;
        clearAiTimeout();
        hideThinkingBubble();
        if (response && response.trim() && response.length > 10) {
          updateConnStatus('ok');
          finishFullGeneration(response, hasChat);
        } else if (err) { updateConnStatus('error'); showToast('Generation failed: ' + err, 'error'); }
        else { updateConnStatus('error'); showToast('No AI response. Check allowAi.', 'error'); }
      });
    } catch(e) {
      _aiCallActive = false;
      clearAiTimeout();
      hideThinkingBubble();
      updateConnStatus('error');
      showToast('AI call failed: ' + (e.message || 'Unknown'), 'error');
    }
  }
}

function finishFullGeneration(response, hasChat) {
  var parsed = parseGeneratedCode(response);
  DB.code = parsed; displayAllCode(parsed); addToHistory(parsed);
  if (!hasChat) {
    addChatMessage('ai', '✅ **' + (DB.toolName || 'Your tool') + '** generated! I\'ve created HTML, CSS, and JS following html-tool-rules. Type below to refine it — "add dark mode", "make the table sortable", etc.');
  }
  persist();
  showToast('Tool generated! Preview it on the right.', 'success');
  switchTab('preview');
  // Auto-review disabled — was doubling request time
}

/* ── History ── */
function addToHistory(parsed) {
  var entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), toolName: DB.toolName || 'Untitled', toolDesc: DB.toolDesc || '', date: new Date().toISOString(), code: { html: parsed.html || '', css: parsed.css || '', js: parsed.js || '' }, config: { storage: DB.storage, features: DB.features.slice(), layout: DB.layout, colorScheme: DB.colorScheme } };
  DB.history.unshift(entry); if (DB.history.length > 20) DB.history = DB.history.slice(0, 20);
}

function renderHistory() {
  var list = el('history-list'); if (!list) return;
  if (!DB.history || !DB.history.length) { list.innerHTML = '<div class="empty-state">No generations yet.</div>'; return; }
  list.innerHTML = DB.history.map(function(h, i) {
    var d = new Date(h.date); var ds = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return '<div class="history-item"><div class="history-item-header"><span class="history-item-name">' + esc(h.toolName) + '</span><span class="history-item-date">' + ds + '</span></div><div class="history-item-desc">' + esc(h.toolDesc || '') + '</div><div class="history-item-actions"><button class="btn btn-sm btn-outline hist-load" data-idx="' + i + '">📂 Load</button><button class="btn btn-sm btn-ghost hist-delete" data-idx="' + i + '">🗑️</button></div></div>';
  }).join('');
  qsa('.hist-load').forEach(function(b) { b.onclick = function() { var e = DB.history[parseInt(this.dataset.idx)]; if (e) { DB.code = e.code; displayAllCode(e.code); closeAllModals(); switchTab('html'); showToast('Loaded: ' + e.toolName, 'info'); persist(); } }; });
  qsa('.hist-delete').forEach(function(b) { b.onclick = function(ev) { ev.stopPropagation(); DB.history.splice(parseInt(this.dataset.idx), 1); renderHistory(); persist(); }; });
}

/* ── Modals ── */
function openModal(id) {
  // Block rules modal for non-developers
  if (id === 'modal-rules' && !isDeveloper()) {
    showToast('The Rules reference is only available to developers.', 'info');
    return;
  }
  el('modal-backdrop').hidden = false; qsa('.modal').forEach(function(m) { m.style.display = 'none'; }); var m = el(id); if (m) m.style.display = 'flex'; if (id === 'modal-history') renderHistory(); if (id === 'modal-rules') { var rb = el('rules-body'); if (rb) rb.innerHTML = '<pre style="white-space:pre-wrap;font-size:10px;line-height:1.6;color:var(--text2)">' + esc(htmlRulesText) + '</pre>'; }
  // Template modal: show all templates as a quick-switch list
  if (id === 'modal-template' && !_currentTemplate) {
    // Opening without a specific template — show the list
    renderTemplateListInModal();
  }
}

function renderTemplateListInModal() {
  // Show all 8 templates as a selectable list in the template modal
  el('tpl-modal-title').textContent = '📋 All Templates';
  el('tpl-icon').textContent = '📋';
  el('tpl-title').textContent = 'Choose a Template';
  el('tpl-desc').textContent = 'Click any template to view and customize its detailed prompt.';
  var listHtml = '<div style="display:flex;flex-direction:column;gap:6px">';
  for (var i = 0; i < TEMPLATES.length; i++) {
    var t = TEMPLATES[i];
    listHtml += '<div class="template-card" style="flex-direction:row;align-items:center;gap:10px;padding:10px" onclick="openTemplateModal(\'' + t.id + '\')">' +
      '<span style="font-size:24px">' + t.icon + '</span>' +
      '<div style="flex:1"><div style="font-size:12px;font-weight:700">' + esc(t.title) + '</div>' +
      '<div style="font-size:10px;color:var(--text2)">' + esc(t.desc) + '</div></div>' +
      '<span style="font-size:10px;font-weight:600;color:var(--accent)">Select →</span>' +
    '</div>';
  }
  listHtml += '</div>';
  el('tpl-prompt-text').style.display = 'none';
  var area = qs('#modal-template .template-prompt-area');
  if (area) {
    var labelEl = area.querySelector('.template-prompt-label');
    area.innerHTML = (labelEl ? labelEl.outerHTML : '') + listHtml;
  }
  // Hide reset/use buttons since no prompt is selected
  var actions = qs('#modal-template .template-modal-actions');
  if (actions) actions.style.display = 'none';
}
function closeAllModals() { el('modal-backdrop').hidden = true; qsa('.modal').forEach(function(m) { m.style.display = 'none'; }); }

/* ── Render ── */
function render(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    DB = Object.assign({ toolName: '', toolDesc: '', requirements: '', audience: 'admin', storage: 'value', cmsTypes: '', cmsFields: '', siblingFields: 'no', features: ['ai'], featureNotes: '', layout: 'single-page', colorScheme: 'blue', themeSupport: 'light-only', styleNotes: '', code: { html: '', css: '', js: '' }, history: [], chatMessages: [], _theme: 'light' }, val);
    if (!DB.code || typeof DB.code !== 'object') DB.code = { html: '', css: '', js: '' };
    if (!Array.isArray(DB.history)) DB.history = [];
    if (!Array.isArray(DB.features)) DB.features = ['ai'];
    if (!Array.isArray(DB.chatMessages)) DB.chatMessages = [];
  }
  if (DB._theme) applyTheme(DB._theme);
  restoreFormData();
  displayAllCode(DB.code);
  renderChatMessages();
}

function syncFields() {}

/* ── Events ── */
function bindEvents() {
  el('btn-config').onclick = function() { switchTab('config'); };
  el('btn-generate-all').onclick = runFullGeneration;
  el('btn-theme').onclick = toggleTheme;
  el('btn-history').onclick = function() { openModal('modal-history'); };
  el('btn-rules').onclick = function() { openModal('modal-rules'); };
  el('btn-close-history').onclick = closeAllModals;
  el('btn-close-rules').onclick = closeAllModals;
  el('modal-backdrop').onclick = closeAllModals;

  qsa('.ctab').forEach(function(t) { t.onclick = function() { switchTab(this.dataset.tab); }; });
  el('btn-copy-html').onclick = function() { copyCurrentTab(); };
  el('btn-copy-css').onclick = function() { copyCurrentTab(); };
  el('btn-copy-js').onclick = function() { copyCurrentTab(); };
  el('btn-copy-all').onclick = copyAllBlocks;
  el('btn-download').onclick = downloadFiles;

  // Console
  var btnConsoleClear = el('btn-console-clear'); if (btnConsoleClear) btnConsoleClear.onclick = clearConsole;

  // Upload button
  var btnUpload = el('btn-upload'); if (btnUpload) btnUpload.onclick = handleFileUpload;
  el('attach-remove').onclick = clearAttachment;

  // Chat
  var btnSend = el('btn-chat-send'); if (btnSend) btnSend.onclick = sendChatMessage;
  var btnStop = el('btn-chat-stop'); if (btnStop) btnStop.onclick = cancelAiRequest;

  // Session list toggle (drawer)
  var sessionToggle = el('session-list-toggle');
  if (sessionToggle) {
    sessionToggle.onclick = function() {
      var wrap = el('session-list-wrap');
      var arrow = el('session-toggle-arrow');
      if (!wrap) return;
      var collapsed = wrap.classList.toggle('collapsed');
      if (arrow) arrow.textContent = collapsed ? '▶' : '▼';
    };
  }

  var btnNewSession = el('btn-new-session'); if (btnNewSession) btnNewSession.onclick = function() {
    createSession(function(session) {
      if (session) {
        // Save current session, switch to new
        if (_activeSessionId) saveCurrentSession();
        _activeSessionId = session.id;
        DB.activeSessionId = session.id;
        DB.chatMessages = [];
        persist();
        renderChatMessages();
        renderSessionList();
        showToast('New chat created', 'info');
      }
    });
  };
  var chatInput = el('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
    chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 160) + 'px'; });
  }

  // Guided / Interview mode toggle
  var btnGuided = el('btn-guided-mode'); if (btnGuided) btnGuided.onclick = toggleInterviewMode;

  // Template modal buttons
  var btnTplClose = el('btn-close-template'); if (btnTplClose) btnTplClose.onclick = closeTemplateModal;
  var btnTplReset = el('btn-tpl-reset'); if (btnTplReset) btnTplReset.onclick = resetTemplatePrompt;
  var btnTplUse = el('btn-tpl-use'); if (btnTplUse) btnTplUse.onclick = useTemplatePrompt;

  // Old chat-examples are gone — no need to bind them

  // Storage radio change
  qsa('input[name="storage"]').forEach(function(r) { r.onchange = function() { var cs = el('crud-section'); if (cs) cs.style.display = (this.value === 'crud' || this.value === 'both') ? '' : 'none'; collectFormData(); persist(); }; });

  // Auto-save form changes
  qsa('.form-input, input[type="radio"], input[type="checkbox"]').forEach(function(inp) { inp.addEventListener('change', function() { collectFormData(); persist(); }); if (inp.tagName === 'INPUT' && inp.type === 'text') inp.addEventListener('blur', function() { collectFormData(); persist(); }); });
  qsa('textarea.form-input').forEach(function(ta) { ta.addEventListener('blur', function() { collectFormData(); persist(); }); });

  // Keyboard
  document.addEventListener('keydown', function(e) { if (e.ctrlKey && e.key === 's') { e.preventDefault(); collectFormData(); persist(); showToast('Saved.', 'info'); } });

  // Code textarea change → live preview update
  qsa('.code-textarea').forEach(function(ta) { ta.addEventListener('input', function() { if (currentTab === 'preview') updatePreview(); }); });
}

/* ── Entry Point ── */
tool.onReady(function(val, fields) {
  // Guard: prevent double-initialization when CMS re-injects HTML on resize
  if (_initialized) { console.warn('[VIBECODING:INIT] Already initialized — skipping duplicate setup'); return; }
  _initialized = true;

  // Load full html-tool-rules from embedded DOM element (verbatim, 773 lines)
  var rulesSource = el('html-rules-source');
  if (rulesSource) htmlRulesText = rulesSource.textContent || '';

  tool.declareOutput({ type: 'object', description: 'VibeCoding HTML App Builder — project config and generated code', properties: { toolName: { type: 'string' }, code: { type: 'object', properties: { html: { type: 'string' }, css: { type: 'string' }, js: { type: 'string' } } }, chatMessages: { type: 'array' }, history: { type: 'array' } } });
  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for AI code generation.' },
    { name: 'allowUpload', label: 'Enable File Upload', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Lets users upload design files, mockups, or spec docs to share with the AI.' },
    { name: 'allowFileContent', label: 'Enable File Content Extraction', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Extracts text from uploaded PDFs, DOCX, etc. to include in AI prompts.' }
  ]);

  // Check if allowAi is configured — warn admin if not
  var aiParam = tool.param('allowAi');
  if (!aiParam || aiParam !== 'yes') {
    tool.reportMissingParams([{
      name: 'allowAi', label: 'Enable AI Prompt Relay',
      type: 'toggle', default: 'yes', severity: 'mandatory',
      hint: 'Set to "yes" to enable AI code generation via tool.requestAI().',
      reason: 'This tool requires AI access to generate HTML/CSS/JS code. Without it, the chat and generate buttons will not work.'
    }], 'AI Prompt Relay must be enabled for this tool to function. Set allowAi: yes in the field settings.');
  }

  render(val);
  // Resolve stable instance ID for session isolation (tries parent record ID first)
  _resolveInstanceId();
  bindEvents();
  initConsoleCapture();

  // ── Load sessions & auto-migrate legacy data ──
  loadSessions(function(sessions) {
    // Auto-migration: if we have legacy chatMessages but no activeSessionId
    var hasLegacyChat = DB.chatMessages && DB.chatMessages.length > 0;
    var hasActiveSession = DB.activeSessionId && DB.activeSessionId.length > 0;

    if (hasLegacyChat && !hasActiveSession) {
      console.warn('[VIBECODING:MIGRATE] Legacy chat detected — migrating to CRUD session...');
      // Snapshot legacy and clear IMMEDIATELY to prevent duplicate migration
      var legacyMessages = DB.chatMessages.slice();
      DB.chatMessages = [];
      persist();

      createSession(function(newSession) {
        if (newSession) {
          tool.requestObjects('update', {
            mainObjectType: SESSION_TYPE,
            objectId: newSession.id,
            productData: { data_categoriesBased: { messages: legacyMessages, updatedAt: new Date().toISOString(), _toolInstanceId: _resolveInstanceId() } }
          }, function() {
            _activeSessionId = newSession.id;
            DB.activeSessionId = newSession.id;
            persist();
            // Update cache
            for (var i = 0; i < _sessions.length; i++) {
              if (_sessions[i].id === newSession.id) {
                var pd = _sessions[i].productData || {};
                var dcb = pd.data_categoriesBased || {};
                dcb.messages = legacyMessages;
                pd.data_categoriesBased = dcb;
                _sessions[i].productData = pd;
                break;
              }
            }
            renderSessionList();
            console.warn('[VIBECODING:MIGRATE] Migration complete —', legacyMessages.length, 'messages moved');
          });
        }
      });
    } else if (hasActiveSession) {
      // Restore active session
      _activeSessionId = DB.activeSessionId;
      switchSession(_activeSessionId);
    }
    renderSessionList();
  });

  // ── Startup info ──
  console.warn('[VIBECODING:INIT] Stream:', typeof tool.requestAIStream === 'function' ? 'YES' : 'NO', '| Batch:', typeof tool.requestAI === 'function' ? 'YES' : 'NO', '| User:', (tool.getUser()||{}).name || 'anon', '| Dev:', isDeveloper(), '| RO:', tool.isReadOnly());
  console.warn('[VIBECODING:INIT] Rules:', htmlRulesText.length, 'chars | HasCode:', !!(DB.code.html || DB.code.css || DB.code.js));

  updateConnStatus('ok');
  if (tool.isReadOnly()) lockUI(true);
  updateDeveloperUI();

  // Initial UI: show config if no code generated yet
  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  if (!hasCode) switchTab('config');
  else if (isDeveloper()) switchTab('html');
  else switchTab('preview');

  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) { b.style.display = 'none'; });
  if (isDeveloper()) { var bHtml = el('btn-copy-html'); if (bHtml) bHtml.style.display = ''; }

  tool.resize();
});

tool.onValueChange(function(v) { render(v); });
tool.onFieldsChange(function(f) { syncFields(); });
tool.onReadonlyChange(function(ro) { lockUI(ro); });
tool.onUserChange(function(user) { updateDeveloperUI(); });

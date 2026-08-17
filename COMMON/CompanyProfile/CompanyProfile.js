/* ── Company Profile ──
   Comprehensive company/organization data collection tool.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }
function val(id) { return (el(id) || {}).value || ''; }
function setVal(id, v) { var e = el(id); if (e) e.value = v || ''; }
function parseLines(text) { return (text || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean); }
function parseCsv(text) { return (text || '').split(',').map(function(l){ return l.trim(); }).filter(Boolean); }

/* ── Section Definitions ── */
var SECTIONS = [
	{ id: 'basic',        icon: '📋', title: 'Basic Information',        desc: 'Core company identity and classification' },
	{ id: 'mission',      icon: '🎯', title: 'Mission, Vision & About',  desc: 'Organizational purpose and strategy' },
	{ id: 'taxes',        icon: '🧾', title: 'Sales Tax Definitions',    desc: 'Tax responsibilities and registration' },
	{ id: 'headquarters', icon: '🏛️', title: 'Headquarters & Main Office', desc: 'Primary address and contact info' },
	{ id: 'offices',      icon: '🏢', title: 'Other Offices & Branches',  desc: 'Additional locations' },
	{ id: 'billing',      icon: '💳', title: 'Billing Address',           desc: 'Invoicing and financial correspondence' },
	{ id: 'geographic',   icon: '🌍', title: 'Geographic Coverage',       desc: 'Operating areas for tender matching' },
	{ id: 'contacts',     icon: '👤', title: 'Contacts',                  desc: 'Key people and points of contact' },
	{ id: 'weblinks',     icon: '🔗', title: 'Weblinks & Social Media',   desc: 'Online presence and digital channels' },
	{ id: 'industry',     icon: '🏭', title: 'Industry & Operations',     desc: 'Sectors, capabilities, and codes' },
	{ id: 'documents',    icon: '📜', title: 'Documents & Certificates',  desc: 'Certifications and licenses' },
	{ id: 'refletters',   icon: '✉️', title: 'Reference Letters',         desc: 'Recommendations and references' },
	{ id: 'assets-owned', icon: '🏗️', title: 'Owned Assets',              desc: 'Equipment, vehicles, and facilities' },
	{ id: 'assets-partner',icon: '🤝', title: 'Partner Accessible Assets', desc: 'Resources through partnerships' },
	{ id: 'hr',           icon: '👥', title: 'Human Resources & Capacity', desc: 'Staff capabilities and expertise' },
	{ id: 'financials',   icon: '💰', title: 'Financials',                desc: 'Revenue and financial standing' },
	{ id: 'projects',     icon: '📁', title: 'Reference Projects',        desc: 'Past projects and client engagements' }
];

/* ── Dropdown Options ── */
var ASSET_TYPES = [
	'Vehicle', 'Heavy Equipment', 'Light Equipment', 'Machinery', 'Tools',
	'IT Hardware', 'Software', 'Office Equipment', 'Facility / Building',
	'Land / Real Estate', 'Vehicle Fleet', 'Laboratory Equipment',
	'Safety Equipment', 'Communication Devices', 'Medical Equipment',
	'Manufacturing Plant', 'Warehouse', 'Other'
];
var OWNERSHIP_TYPES = ['Owned', 'Leased', 'Financed', 'Rented', 'Shared', 'Other'];
var READINESS_TYPES = ['Ready (Immediate)', 'Ready (< 1 week)', 'Ready (< 1 month)', 'Requires Maintenance', 'Not Available', 'Seasonal'];
var RELIABILITY_TYPES = ['Highly Reliable', 'Reliable', 'Moderate', 'Variable', 'Uncertain'];
var EXPERTISE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master / Specialist'];
var SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
var EDUCATION_LEVELS = ['High School', 'Associate Degree', 'Bachelor\'s Degree', 'Master\'s Degree', 'Doctorate', 'Professional Certification', 'Trade Certification', 'Other'];
var DOC_TYPES = ['Business License', 'Insurance Certificate', 'ISO Certification', 'Safety Certification', 'Environmental Permit', 'Professional License', 'Tax Certificate', 'WCB / Workers Comp', 'Bond / Surety', 'Patent', 'Trademark', 'Copyright', 'Industry Certification', 'Supplier Registration', 'Other'];
var COMPANY_TYPES_EXTRA = {
	'nonprofit': ['Non-Profit Organization', 'Registered Charity', 'Foundation', 'Social Enterprise', 'NGO', 'Community Organization', 'Association'],
	'default': []
};

/* ── Default DB ── */
function emptyDB() {
	return {
		basicInfo:       { legalName:'', tradeName:'', companyType:'', yearEstablished:'', numEmployees:'', businessNumber:'' },
		mission:         { mission:'', vision:'', values:'', about:'', targets:'' },
		salesTaxDefinitions: [],
		headquarters:    { name:'', address:'', city:'', state:'', postal:'', country:'', email:'', phone:'', website:'' },
		otherOffices:    [],
		billingAddress:  { sameAsHQ:true, address:'', city:'', state:'', postal:'', country:'', email:'' },
		geographicCoverage: { countries:'', states:'', cities:'', excluded:'', notes:'' },
		contacts:        { primary:{ name:'', title:'', email:'', phone:'', linkedin:'' }, others:[] },
		weblinks:        { website:'', email:'', linkedin:'', facebook:'', instagram:'', twitter:'', youtube:'', tiktok:'', whatsapp:'', otherSocials:[], otherWebSources:[] },
		industryOps:     { primaryIndustry:'', subIndustries:'', specializations:'', unscspCodes:'', naicsCodes:'', otherKeywords:'', capabilities:[] },
		documents:       { certificates:[] },
		referenceLetters: [],
		assets:          { owned:[], partnerAccessible:[] },
		humanResources:  { staffCapabilities:[] },
		financials:      { annualRevenues:[], currentAssets:'', currentLiabilities:'', workingCapital:'' },
		referenceProjects: []
	};
}

var DB = emptyDB();
var isReadOnly = false;
var saveTimeout = null;
var modalCb = null;
var visibleSections = null; // null = all, or Set of section IDs
var selfSaving = false; // flag to prevent re-render on self-initiated saves
var currentSection = null; // currently active tab section id

/* ── Persistence ── */
function saveDB() {
	clearTimeout(saveTimeout);
	var indicator = el('cp-save-indicator');
	if (indicator) { indicator.className = 'cp-save-indicator saving'; }
	saveTimeout = setTimeout(function() {
		selfSaving = true;
		tool.setValue(DB);
		selfSaving = false;
		if (indicator) { indicator.className = 'cp-save-indicator'; }
		updateProgress();
		updateHeaderName();
		updateBadges();
	}, 400);
}

function loadDB(val) {
	if (val && typeof val === 'object') {
		DB = deepMerge(emptyDB(), val);
	} else {
		DB = emptyDB();
	}
}

function deepMerge(target, source) {
	var out = {};
	var keys = Object.keys(target).concat(Object.keys(source));
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i];
		if (out[k] !== undefined) continue;
		var tv = target[k], sv = source[k];
		if (sv === undefined) { out[k] = tv; continue; }
		if (tv === undefined) { out[k] = sv; continue; }
		if (Array.isArray(tv) && Array.isArray(sv)) { out[k] = sv; continue; }
		if (typeof tv === 'object' && tv !== null && typeof sv === 'object' && sv !== null && !Array.isArray(tv)) {
			out[k] = deepMerge(tv, sv);
		} else {
			out[k] = sv;
		}
	}
	return out;
}

/* ── Section Visibility ── */
function isSectionVisible(sectionId) {
	if (!visibleSections) return true;
	return visibleSections.has(sectionId);
}

function parseVisibleSections() {
	var raw = tool.param('visibleSections', 'all');
	if (!raw || raw === 'all' || raw === '*') { visibleSections = null; return; }
	visibleSections = new Set(raw.split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean));
}

/* ── UI Helpers ── */
function buildSelectOptions(options, selectedVal) {
	return options.map(function(o) {
		return '<option value="' + esc(o) + '"' + (o === selectedVal ? ' selected' : '') + '>' + esc(o) + '</option>';
	}).join('');
}

function buildSelect(name, options, selectedVal, extraClass) {
	extraClass = extraClass || '';
	return '<select class="cp-input cp-select ' + extraClass + '" data-field="' + name + '">' +
		'<option value="">— Select —</option>' + buildSelectOptions(options, selectedVal) + '</select>';
}

/* ── Initialize ── */
tool.onReady(function(val, fields) {
	loadDB(val);
	parseVisibleSections();
	buildNav();
	renderAll();
	updateProgress();
	updateHeaderName();

	if (tool.isReadOnly()) { isReadOnly = true; lockUI(true); }

	tool.onValueChange(function(v) {
		if (selfSaving) return; // skip re-render on self-initiated saves
		loadDB(v); renderAll(); updateProgress(); updateHeaderName(); updateBadges();
	});
	tool.onReadonlyChange(function(ro) { isReadOnly = ro; lockUI(ro); });
	tool.onFieldsChange(function(f) { /* react to sibling fields if needed */ });
	tool.resize();
});

/* ── Lock / Read-only ── */
function lockUI(ro) {
	var app = el('app');
	if (ro) { app.classList.add('cp-readonly'); }
	else { app.classList.remove('cp-readonly'); }
}

/* ── Navigation ── */
function buildNav() {
	var nav = el('cp-nav');
	var html = '';
	for (var i = 0; i < SECTIONS.length; i++) {
		var sec = SECTIONS[i];
		if (!isSectionVisible(sec.id)) continue;
		html += '<button class="cp-nav-item" data-nav="' + sec.id + '">' +
			'<span class="cp-nav-icon">' + sec.icon + '</span>' +
			'<span>' + esc(sec.title) + '</span>' +
			'<span class="cp-nav-badge" id="nav-badge-' + sec.id + '"></span>' +
			'</button>';
	}
	nav.innerHTML = html;

	nav.addEventListener('click', function(e) {
		var item = e.target.closest('[data-nav]');
		if (!item) return;
		var sectionId = item.getAttribute('data-nav');
		switchToSection(sectionId);
	});
}

function switchToSection(sectionId) {
	if (!isSectionVisible(sectionId)) return;
	currentSection = sectionId;
	// Hide all sections, show only the target
	var allSections = document.querySelectorAll('.cp-section');
	for (var i = 0; i < allSections.length; i++) {
		allSections[i].classList.remove('active');
	}
	var secEl = el('sec-' + sectionId);
	if (secEl) { secEl.classList.add('active'); }
	// Update nav active state
	updateNavActive();
	// Render the target section (ensure it has fresh data)
	renderSection(sectionId);
	tool.resize();
}

function renderSection(sectionId) {
	switch (sectionId) {
		case 'basic': renderBasicInfo(); break;
		case 'mission': renderMission(); break;
		case 'taxes': renderTaxes(); break;
		case 'headquarters': renderHeadquarters(); break;
		case 'offices': renderOffices(); break;
		case 'billing': renderBilling(); break;
		case 'geographic': renderGeographic(); break;
		case 'contacts': renderContacts(); break;
		case 'weblinks': renderWeblinks(); break;
		case 'industry': renderIndustry(); break;
		case 'documents': renderDocuments(); break;
		case 'refletters': renderRefLetters(); break;
		case 'assets-owned': renderAssetsOwned(); break;
		case 'assets-partner': renderAssetsPartner(); break;
		case 'hr': renderHR(); break;
		case 'financials': renderFinancials(); break;
		case 'projects': renderProjects(); break;
	}
}

function updateNavActive() {
	var items = document.querySelectorAll('.cp-nav-item');
	items.forEach(function(item) { item.classList.remove('active'); });
	if (currentSection) {
		var navItem = document.querySelector('[data-nav="' + currentSection + '"]');
		if (navItem) navItem.classList.add('active');
	}
}

/* ── Render All ── */
function renderAll() {
	// Hide sections not in visibleSections
	for (var i = 0; i < SECTIONS.length; i++) {
		var secEl = el('sec-' + SECTIONS[i].id);
		if (!secEl) continue;
		if (!isSectionVisible(SECTIONS[i].id)) {
			secEl.style.display = 'none';
		} else {
			secEl.style.display = '';
		}
	}

	// Render all sections (populate values)
	renderBasicInfo();
	renderMission();
	renderTaxes();
	renderHeadquarters();
	renderOffices();
	renderBilling();
	renderGeographic();
	renderContacts();
	renderWeblinks();
	renderIndustry();
	renderDocuments();
	renderRefLetters();
	renderAssetsOwned();
	renderAssetsPartner();
	renderHR();
	renderFinancials();
	renderProjects();

	// Activate first visible section (or restore current)
	if (!currentSection || !isSectionVisible(currentSection)) {
		// Find first visible section
		for (var j = 0; j < SECTIONS.length; j++) {
			if (isSectionVisible(SECTIONS[j].id)) {
				switchToSection(SECTIONS[j].id);
				break;
			}
		}
	} else {
		switchToSection(currentSection);
	}

	updateBadges();
	tool.resize();
}

/* ── Basic Info ── */
function renderBasicInfo() {
	var b = DB.basicInfo;
	setVal('f-legalName', b.legalName);
	setVal('f-tradeName', b.tradeName);
	setVal('f-companyType', b.companyType);
	setVal('f-yearEstablished', b.yearEstablished);
	setVal('f-numEmployees', b.numEmployees);
	setVal('f-businessNumber', b.businessNumber);
}

function readBasicInfo() {
	var b = DB.basicInfo;
	b.legalName = val('f-legalName');
	b.tradeName = val('f-tradeName');
	b.companyType = val('f-companyType');
	b.yearEstablished = val('f-yearEstablished');
	b.numEmployees = val('f-numEmployees');
	b.businessNumber = val('f-businessNumber');
}

/* ── Mission ── */
function renderMission() {
	var m = DB.mission;
	setVal('f-mission', m.mission);
	setVal('f-vision', m.vision);
	setVal('f-values', m.values);
	setVal('f-about', m.about);
	setVal('f-targets', m.targets);
}
function readMission() {
	var m = DB.mission;
	m.mission = val('f-mission');
	m.vision = val('f-vision');
	m.values = val('f-values');
	m.about = val('f-about');
	m.targets = val('f-targets');
}

/* ── Tax Definitions ── */
function renderTaxes() {
	var container = el('cp-taxes-container');
	var items = DB.salesTaxDefinitions;
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No tax definitions added yet. Click "Add Tax Definition" below.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var t = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(t.name || 'Tax #' + (i+1)) + ' — ' + esc(t.rate || '?') + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-tax" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Tax Name</label><input class="cp-input" data-field="name" data-section="taxes" data-idx="' + i + '" value="' + esc(t.name || '') + '" placeholder="e.g. Canada GST"></div>' +
				'<div><label class="cp-label">Rate</label><input class="cp-input" data-field="rate" data-section="taxes" data-idx="' + i + '" value="' + esc(t.rate || '') + '" placeholder="e.g. 5%"></div>' +
				'<div><label class="cp-label">Tax Number / ID</label><input class="cp-input" data-field="taxNumber" data-section="taxes" data-idx="' + i + '" value="' + esc(t.taxNumber || '') + '" placeholder="e.g. 123456789 RT0001"></div></div>' +
				'<div><label class="cp-label">Notes</label><input class="cp-input" data-field="notes" data-section="taxes" data-idx="' + i + '" value="' + esc(t.notes || '') + '" placeholder="Additional notes"></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addTax() {
	DB.salesTaxDefinitions.push({ name:'', rate:'', taxNumber:'', notes:'' });
	saveDB();
	renderTaxes();
}
function removeTax(idx) {
	DB.salesTaxDefinitions.splice(idx, 1);
	saveDB();
	renderTaxes();
}

/* ── Headquarters ── */
function renderHeadquarters() {
	var h = DB.headquarters;
	setVal('f-hq-name', h.name);
	setVal('f-hq-address', h.address);
	setVal('f-hq-city', h.city);
	setVal('f-hq-state', h.state);
	setVal('f-hq-postal', h.postal);
	setVal('f-hq-country', h.country);
	setVal('f-hq-email', h.email);
	setVal('f-hq-phone', h.phone);
	setVal('f-hq-website', h.website);
}
function readHeadquarters() {
	var h = DB.headquarters;
	h.name = val('f-hq-name');
	h.address = val('f-hq-address');
	h.city = val('f-hq-city');
	h.state = val('f-hq-state');
	h.postal = val('f-hq-postal');
	h.country = val('f-hq-country');
	h.email = val('f-hq-email');
	h.phone = val('f-hq-phone');
	h.website = val('f-hq-website');
}

/* ── Other Offices ── */
function renderOffices() {
	var container = el('cp-offices-container');
	var items = DB.otherOffices;
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No additional offices added yet.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var o = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(o.name || 'Office #' + (i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-office" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Office / Branch Name</label><input class="cp-input" data-field="name" data-idx="' + i + '" data-section="offices" value="' + esc(o.name || '') + '"></div>' +
				'<div><label class="cp-label">Type</label><select class="cp-input cp-select" data-field="type" data-idx="' + i + '" data-section="offices"><option value="branch"' + (o.type==='branch'?' selected':'') + '>Branch</option><option value="satellite"' + (o.type==='satellite'?' selected':'') + '>Satellite Office</option><option value="warehouse"' + (o.type==='warehouse'?' selected':'') + '>Warehouse</option><option value="retail"' + (o.type==='retail'?' selected':'') + '>Retail Location</option><option value="other"' + (o.type==='other'?' selected':'') + '>Other</option></select></div></div>' +
				'<div><label class="cp-label">Address</label><input class="cp-input" data-field="address" data-idx="' + i + '" data-section="offices" value="' + esc(o.address || '') + '"></div>' +
				'<div class="cp-array-item-row">' +
					'<div><label class="cp-label">City</label><input class="cp-input" data-field="city" data-idx="' + i + '" data-section="offices" value="' + esc(o.city || '') + '"></div>' +
					'<div><label class="cp-label">State/Province</label><input class="cp-input" data-field="state" data-idx="' + i + '" data-section="offices" value="' + esc(o.state || '') + '"></div>' +
					'<div><label class="cp-label">Postal Code</label><input class="cp-input" data-field="postal" data-idx="' + i + '" data-section="offices" value="' + esc(o.postal || '') + '"></div>' +
				'</div>' +
				'<div class="cp-array-item-row">' +
					'<div><label class="cp-label">Country</label><input class="cp-input" data-field="country" data-idx="' + i + '" data-section="offices" value="' + esc(o.country || '') + '"></div>' +
					'<div><label class="cp-label">Email</label><input class="cp-input" data-field="email" data-idx="' + i + '" data-section="offices" value="' + esc(o.email || '') + '"></div>' +
					'<div><label class="cp-label">Phone</label><input class="cp-input" data-field="phone" data-idx="' + i + '" data-section="offices" value="' + esc(o.phone || '') + '"></div>' +
				'</div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addOffice() {
	DB.otherOffices.push({ name:'', type:'branch', address:'', city:'', state:'', postal:'', country:'', email:'', phone:'' });
	saveDB();
	renderOffices();
}
function removeOffice(idx) {
	DB.otherOffices.splice(idx, 1);
	saveDB();
	renderOffices();
}

/* ── Billing ── */
function renderBilling() {
	var b = DB.billingAddress;
	el('f-billing-same').checked = b.sameAsHQ !== false;
	var fieldsDiv = el('cp-billing-fields');
	fieldsDiv.style.display = b.sameAsHQ !== false ? 'none' : '';
	setVal('f-billing-address', b.address);
	setVal('f-billing-city', b.city);
	setVal('f-billing-state', b.state);
	setVal('f-billing-postal', b.postal);
	setVal('f-billing-country', b.country);
	setVal('f-billing-email', b.email);
}
function readBilling() {
	var b = DB.billingAddress;
	b.sameAsHQ = el('f-billing-same').checked;
	b.address = val('f-billing-address');
	b.city = val('f-billing-city');
	b.state = val('f-billing-state');
	b.postal = val('f-billing-postal');
	b.country = val('f-billing-country');
	b.email = val('f-billing-email');
}

/* ── Geographic Coverage ── */
function renderGeographic() {
	var g = DB.geographicCoverage;
	setVal('f-geo-countries', g.countries);
	setVal('f-geo-states', g.states);
	setVal('f-geo-cities', g.cities);
	setVal('f-geo-excluded', g.excluded);
	setVal('f-geo-notes', g.notes);
}
function readGeographic() {
	var g = DB.geographicCoverage;
	g.countries = val('f-geo-countries');
	g.states = val('f-geo-states');
	g.cities = val('f-geo-cities');
	g.excluded = val('f-geo-excluded');
	g.notes = val('f-geo-notes');
}

/* ── Contacts ── */
function renderContacts() {
	var p = DB.contacts.primary;
	setVal('f-primary-name', p.name);
	setVal('f-primary-title', p.title);
	setVal('f-primary-email', p.email);
	setVal('f-primary-phone', p.phone);
	setVal('f-primary-linkedin', p.linkedin);

	var container = el('cp-contacts-container');
	var items = DB.contacts.others;
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No additional contacts.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var c = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(c.name || 'Contact #' + (i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-contact" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Name</label><input class="cp-input" data-field="name" data-idx="' + i + '" data-section="contacts" value="' + esc(c.name || '') + '"></div>' +
				'<div><label class="cp-label">Title</label><input class="cp-input" data-field="title" data-idx="' + i + '" data-section="contacts" value="' + esc(c.title || '') + '"></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Email</label><input class="cp-input" data-field="email" data-idx="' + i + '" data-section="contacts" value="' + esc(c.email || '') + '"></div>' +
				'<div><label class="cp-label">Phone</label><input class="cp-input" data-field="phone" data-idx="' + i + '" data-section="contacts" value="' + esc(c.phone || '') + '"></div>' +
				'<div><label class="cp-label">LinkedIn</label><input class="cp-input" data-field="linkedin" data-idx="' + i + '" data-section="contacts" value="' + esc(c.linkedin || '') + '"></div></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function readPrimaryContact() {
	var p = DB.contacts.primary;
	p.name = val('f-primary-name');
	p.title = val('f-primary-title');
	p.email = val('f-primary-email');
	p.phone = val('f-primary-phone');
	p.linkedin = val('f-primary-linkedin');
}
function addContact() {
	DB.contacts.others.push({ name:'', title:'', email:'', phone:'', linkedin:'' });
	saveDB();
	renderContacts();
}
function removeContact(idx) {
	DB.contacts.others.splice(idx, 1);
	saveDB();
	renderContacts();
}

/* ── Weblinks ── */
function renderWeblinks() {
	var w = DB.weblinks;
	setVal('f-wl-website', w.website);
	setVal('f-wl-email', w.email);
	setVal('f-wl-linkedin', w.linkedin);
	setVal('f-wl-facebook', w.facebook);
	setVal('f-wl-instagram', w.instagram);
	setVal('f-wl-twitter', w.twitter);
	setVal('f-wl-youtube', w.youtube);
	setVal('f-wl-tiktok', w.tiktok);
	setVal('f-wl-whatsapp', w.whatsapp);

	// Other socials
	var socContainer = el('cp-othersocial-container');
	var socItems = w.otherSocials || [];
	if (!socItems.length) {
		socContainer.innerHTML = '<div class="cp-array-item-empty">No additional social links.</div>';
	} else {
		var sh = '';
		for (var i = 0; i < socItems.length; i++) {
			sh += '<div class="cp-array-item"><div class="cp-array-item-header"><span class="cp-array-item-title">' + esc(socItems[i].platform || 'Link #'+(i+1)) + '</span>' +
				'<div class="cp-array-item-actions"><button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-othersocial" data-idx="' + i + '">✕</button></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Platform</label><input class="cp-input" data-field="platform" data-idx="'+i+'" data-section="othersocial" value="'+esc(socItems[i].platform||'')+'"></div>' +
				'<div><label class="cp-label">URL</label><input class="cp-input" data-field="url" data-idx="'+i+'" data-section="othersocial" value="'+esc(socItems[i].url||'')+'"></div></div></div>';
		}
		socContainer.innerHTML = sh;
	}

	// Other web sources
	var webContainer = el('cp-otherweb-container');
	var webItems = w.otherWebSources || [];
	if (!webItems.length) {
		webContainer.innerHTML = '<div class="cp-array-item-empty">No additional web sources.</div>';
	} else {
		var wh = '';
		for (var j = 0; j < webItems.length; j++) {
			wh += '<div class="cp-array-item"><div class="cp-array-item-header"><span class="cp-array-item-title">' + esc(webItems[j].label || 'Source #'+(j+1)) + '</span>' +
				'<div class="cp-array-item-actions"><button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-otherweb" data-idx="' + j + '">✕</button></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Label</label><input class="cp-input" data-field="label" data-idx="'+j+'" data-section="otherweb" value="'+esc(webItems[j].label||'')+'"></div>' +
				'<div><label class="cp-label">URL</label><input class="cp-input" data-field="url" data-idx="'+j+'" data-section="otherweb" value="'+esc(webItems[j].url||'')+'"></div></div></div>';
		}
		webContainer.innerHTML = wh;
	}
}
function readWeblinks() {
	var w = DB.weblinks;
	w.website = val('f-wl-website');
	w.email = val('f-wl-email');
	w.linkedin = val('f-wl-linkedin');
	w.facebook = val('f-wl-facebook');
	w.instagram = val('f-wl-instagram');
	w.twitter = val('f-wl-twitter');
	w.youtube = val('f-wl-youtube');
	w.tiktok = val('f-wl-tiktok');
	w.whatsapp = val('f-wl-whatsapp');
}
function addOtherSocial() {
	if (!DB.weblinks.otherSocials) DB.weblinks.otherSocials = [];
	DB.weblinks.otherSocials.push({ platform:'', url:'' });
	saveDB();
	renderWeblinks();
}
function removeOtherSocial(idx) {
	DB.weblinks.otherSocials.splice(idx, 1);
	saveDB();
	renderWeblinks();
}
function addOtherWeb() {
	if (!DB.weblinks.otherWebSources) DB.weblinks.otherWebSources = [];
	DB.weblinks.otherWebSources.push({ label:'', url:'' });
	saveDB();
	renderWeblinks();
}
function removeOtherWeb(idx) {
	DB.weblinks.otherWebSources.splice(idx, 1);
	saveDB();
	renderWeblinks();
}

/* ── Industry ── */
function renderIndustry() {
	var o = DB.industryOps;
	setVal('f-industry-primary', o.primaryIndustry);
	setVal('f-industry-sub', o.subIndustries);
	setVal('f-industry-specializations', o.specializations);
	setVal('f-unspsc', o.unscspCodes);
	setVal('f-naics', o.naicsCodes);
	setVal('f-otherkeywords', o.otherKeywords);
	renderCapabilities();
}
function readIndustry() {
	var o = DB.industryOps;
	o.primaryIndustry = val('f-industry-primary');
	o.subIndustries = val('f-industry-sub');
	o.specializations = val('f-industry-specializations');
	o.unscspCodes = val('f-unspsc');
	o.naicsCodes = val('f-naics');
	o.otherKeywords = val('f-otherkeywords');
}

function renderCapabilities() {
	var container = el('cp-capabilities-container');
	var items = DB.industryOps.capabilities || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No capabilities added yet.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var c = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(c.name || 'Capability #' + (i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-capability" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Name</label><input class="cp-input" data-field="name" data-idx="'+i+'" data-section="capabilities" value="'+esc(c.name||'')+'"></div>' +
				'<div><label class="cp-label">Service Categories</label><input class="cp-input" data-field="serviceCategories" data-idx="'+i+'" data-section="capabilities" value="'+esc(c.serviceCategories||'')+'"></div></div>' +
				'<div><label class="cp-label">Description</label><textarea class="cp-input cp-textarea" data-field="description" data-idx="'+i+'" data-section="capabilities" rows="2">'+esc(c.description||'')+'</textarea></div>' +
				'<div class="cp-array-item-row">' +
					'<div><label class="cp-label">Expertise Level</label><select class="cp-input cp-select" data-field="expertiseLevel" data-idx="'+i+'" data-section="capabilities">'+buildSelectOptions(EXPERTISE_LEVELS, c.expertiseLevel||'')+'</select></div>' +
					'<div><label class="cp-label">Certified?</label><select class="cp-input cp-select" data-field="certified" data-idx="'+i+'" data-section="capabilities"><option value="">—</option><option value="Yes"'+(c.certified==='Yes'?' selected':'')+'>Yes</option><option value="No"'+(c.certified==='No'?' selected':'')+'>No</option></select></div>' +
				'</div>' +
				'<div><label class="cp-label">Related Standards / Regulations</label><input class="cp-input" data-field="relatedStandards" data-idx="'+i+'" data-section="capabilities" value="'+esc(c.relatedStandards||'')+'"></div>' +
				'<div><label class="cp-label">Supporting Documents</label><input class="cp-input" data-field="supportingDocs" data-idx="'+i+'" data-section="capabilities" value="'+esc(c.supportingDocs||'')+'" placeholder="Document URLs or references"></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addCapability() {
	if (!DB.industryOps.capabilities) DB.industryOps.capabilities = [];
	DB.industryOps.capabilities.push({ name:'', description:'', serviceCategories:'', expertiseLevel:'', certified:'', relatedStandards:'', supportingDocs:'' });
	saveDB();
	renderCapabilities();
}
function removeCapability(idx) {
	DB.industryOps.capabilities.splice(idx, 1);
	saveDB();
	renderCapabilities();
}

/* ── Documents / Certificates ── */
function renderDocuments() {
	var container = el('cp-certs-container');
	var items = DB.documents.certificates || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No certificates or documents added.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var d = items[i];
		var validBadge = d.isValid === false ? '<span style="color:var(--cp-danger);font-size:10px;">● Expired</span>' : (d.isValid === true ? '<span style="color:var(--cp-success);font-size:10px;">● Valid</span>' : '');
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(d.name || 'Document #'+(i+1)) + ' ' + validBadge + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-cert" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Document Name</label><input class="cp-input" data-field="name" data-idx="'+i+'" data-section="certs" value="'+esc(d.name||'')+'"></div>' +
				'<div><label class="cp-label">Document Type</label><select class="cp-input cp-select" data-field="type" data-idx="'+i+'" data-section="certs">'+buildSelectOptions(DOC_TYPES, d.type||'')+'</select></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Effective Date</label><input type="date" class="cp-input" data-field="effectiveDate" data-idx="'+i+'" data-section="certs" value="'+esc(d.effectiveDate||'')+'"></div>' +
				'<div><label class="cp-label">Expiry Date</label><input type="date" class="cp-input" data-field="expiryDate" data-idx="'+i+'" data-section="certs" value="'+esc(d.expiryDate||'')+'"></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Currently Valid?</label><select class="cp-input cp-select" data-field="isValid" data-idx="'+i+'" data-section="certs"><option value="">—</option><option value="true"'+(d.isValid===true?' selected':'')+'>Yes</option><option value="false"'+(d.isValid===false?' selected':'')+'>No</option></select></div>' +
				'<div><label class="cp-label">File Reference</label><input class="cp-input" data-field="file" data-idx="'+i+'" data-section="certs" value="'+esc(d.file||'')+'" placeholder="File URL or path"></div></div>' +
				'<div><label class="cp-label">Description</label><input class="cp-input" data-field="description" data-idx="'+i+'" data-section="certs" value="'+esc(d.description||'')+'"></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addCert() {
	if (!DB.documents.certificates) DB.documents.certificates = [];
	DB.documents.certificates.push({ name:'', type:'', effectiveDate:'', expiryDate:'', file:'', isValid:null, description:'' });
	saveDB();
	renderDocuments();
}
function removeCert(idx) {
	DB.documents.certificates.splice(idx, 1);
	saveDB();
	renderDocuments();
}

/* ── Reference Letters ── */
function renderRefLetters() {
	var container = el('cp-refletters-container');
	var items = DB.referenceLetters || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No reference letters added.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var r = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(r.title || 'Letter #'+(i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-refletter" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Letter Title</label><input class="cp-input" data-field="title" data-idx="'+i+'" data-section="refletters" value="'+esc(r.title||'')+'"></div>' +
				'<div><label class="cp-label">Issued By</label><input class="cp-input" data-field="issuedBy" data-idx="'+i+'" data-section="refletters" value="'+esc(r.issuedBy||'')+'"></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Issue Date</label><input type="date" class="cp-input" data-field="issueDate" data-idx="'+i+'" data-section="refletters" value="'+esc(r.issueDate||'')+'"></div>' +
				'<div><label class="cp-label">File Reference</label><input class="cp-input" data-field="file" data-idx="'+i+'" data-section="refletters" value="'+esc(r.file||'')+'" placeholder="File URL or path"></div></div>' +
				'<div><label class="cp-label">Summary / Comments</label><textarea class="cp-input cp-textarea" data-field="summary" data-idx="'+i+'" data-section="refletters" rows="2">'+esc(r.summary||'')+'</textarea></div>' +
				'<div><label class="cp-label">Associated Projects</label><input class="cp-input" data-field="associatedProjects" data-idx="'+i+'" data-section="refletters" value="'+esc(r.associatedProjects||'')+'" placeholder="Project names or references"></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addRefLetter() {
	if (!DB.referenceLetters) DB.referenceLetters = [];
	DB.referenceLetters.push({ title:'', file:'', issuedBy:'', issueDate:'', summary:'', associatedProjects:'' });
	saveDB();
	renderRefLetters();
}
function removeRefLetter(idx) {
	DB.referenceLetters.splice(idx, 1);
	saveDB();
	renderRefLetters();
}

/* ── Assets: Owned ── */
function renderAssetsOwned() {
	var container = el('cp-assets-owned-container');
	var items = DB.assets.owned || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No owned assets added.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var a = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(a.name || 'Asset #'+(i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-asset-owned" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Asset Name</label><input class="cp-input" data-field="name" data-idx="'+i+'" data-section="assets-owned" value="'+esc(a.name||'')+'"></div>' +
				'<div><label class="cp-label">Asset Type</label><select class="cp-input cp-select" data-field="type" data-idx="'+i+'" data-section="assets-owned">'+buildSelectOptions(ASSET_TYPES, a.type||'')+'</select></div>' +
				'<div><label class="cp-label">Quantity</label><input type="number" class="cp-input" data-field="quantity" data-idx="'+i+'" data-section="assets-owned" value="'+esc(a.quantity||'')+'" min="0"></div></div>' +
				'<div><label class="cp-label">Asset Description</label><input class="cp-input" data-field="description" data-idx="'+i+'" data-section="assets-owned" value="'+esc(a.description||'')+'"></div>' +
				'<div class="cp-array-item-row">' +
					'<div><label class="cp-label">Ownership</label><select class="cp-input cp-select" data-field="ownership" data-idx="'+i+'" data-section="assets-owned">'+buildSelectOptions(OWNERSHIP_TYPES, a.ownership||'')+'</select></div>' +
					'<div><label class="cp-label">Readiness</label><select class="cp-input cp-select" data-field="readiness" data-idx="'+i+'" data-section="assets-owned">'+buildSelectOptions(READINESS_TYPES, a.readiness||'')+'</select></div>' +
				'</div>' +
				'<div><label class="cp-label">Technical Specs</label><textarea class="cp-input cp-textarea" data-field="technicalSpecs" data-idx="'+i+'" data-section="assets-owned" rows="2">'+esc(a.technicalSpecs||'')+'</textarea></div>' +
				'<div><label class="cp-label">Certifications</label><input class="cp-input" data-field="certifications" data-idx="'+i+'" data-section="assets-owned" value="'+esc(a.certifications||'')+'"></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addAssetOwned() {
	if (!DB.assets.owned) DB.assets.owned = [];
	DB.assets.owned.push({ name:'', type:'', quantity:'', description:'', ownership:'', readiness:'', technicalSpecs:'', certifications:'' });
	saveDB();
	renderAssetsOwned();
}
function removeAssetOwned(idx) {
	DB.assets.owned.splice(idx, 1);
	saveDB();
	renderAssetsOwned();
}

/* ── Assets: Partner ── */
function renderAssetsPartner() {
	var container = el('cp-assets-partner-container');
	var items = DB.assets.partnerAccessible || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No partner assets added.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var a = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(a.name || 'Partner Asset #'+(i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-asset-partner" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Asset Name</label><input class="cp-input" data-field="name" data-idx="'+i+'" data-section="assets-partner" value="'+esc(a.name||'')+'"></div>' +
				'<div><label class="cp-label">Asset Type</label><select class="cp-input cp-select" data-field="type" data-idx="'+i+'" data-section="assets-partner">'+buildSelectOptions(ASSET_TYPES, a.type||'')+'</select></div>' +
				'<div><label class="cp-label">Quantity</label><input type="number" class="cp-input" data-field="quantity" data-idx="'+i+'" data-section="assets-partner" value="'+esc(a.quantity||'')+'" min="0"></div></div>' +
				'<div><label class="cp-label">Asset Description</label><input class="cp-input" data-field="description" data-idx="'+i+'" data-section="assets-partner" value="'+esc(a.description||'')+'"></div>' +
				'<div class="cp-array-item-row">' +
					'<div><label class="cp-label">Reliability</label><select class="cp-input cp-select" data-field="reliability" data-idx="'+i+'" data-section="assets-partner">'+buildSelectOptions(RELIABILITY_TYPES, a.reliability||'')+'</select></div>' +
					'<div><label class="cp-label">Readiness</label><select class="cp-input cp-select" data-field="readiness" data-idx="'+i+'" data-section="assets-partner">'+buildSelectOptions(READINESS_TYPES, a.readiness||'')+'</select></div>' +
				'</div>' +
				'<div><label class="cp-label">Technical Specs</label><textarea class="cp-input cp-textarea" data-field="technicalSpecs" data-idx="'+i+'" data-section="assets-partner" rows="2">'+esc(a.technicalSpecs||'')+'</textarea></div>' +
				'<div><label class="cp-label">Certifications</label><input class="cp-input" data-field="certifications" data-idx="'+i+'" data-section="assets-partner" value="'+esc(a.certifications||'')+'"></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addAssetPartner() {
	if (!DB.assets.partnerAccessible) DB.assets.partnerAccessible = [];
	DB.assets.partnerAccessible.push({ name:'', type:'', quantity:'', description:'', reliability:'', readiness:'', technicalSpecs:'', certifications:'' });
	saveDB();
	renderAssetsPartner();
}
function removeAssetPartner(idx) {
	DB.assets.partnerAccessible.splice(idx, 1);
	saveDB();
	renderAssetsPartner();
}

/* ── Human Resources ── */
function renderHR() {
	var container = el('cp-hr-container');
	var items = DB.humanResources.staffCapabilities || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No staff members added.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var s = items[i];
		var skillCount = (s.skills && s.skills.length) ? s.skills.length : 0;
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(s.role || s.name || 'Staff #'+(i+1)) + (skillCount ? ' (' + skillCount + ' skills)' : '') + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-hr" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Name (Optional)</label><input class="cp-input" data-field="name" data-idx="'+i+'" data-section="hr" value="'+esc(s.name||'')+'"></div>' +
				'<div><label class="cp-label">Role</label><input class="cp-input" data-field="role" data-idx="'+i+'" data-section="hr" value="'+esc(s.role||'')+'"></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Experience</label><input class="cp-input" data-field="experience" data-idx="'+i+'" data-section="hr" value="'+esc(s.experience||'')+'" placeholder="e.g. 10 years"></div>' +
				'<div><label class="cp-label">Education Level</label><select class="cp-input cp-select" data-field="educationLevel" data-idx="'+i+'" data-section="hr">'+buildSelectOptions(EDUCATION_LEVELS, s.educationLevel||'')+'</select></div></div>' +
				'<div class="cp-nested-array" id="hr-skills-' + i + '">' + renderHRSkills(i, s.skills || []) + '</div>' +
				'<button class="cp-btn cp-btn-sm cp-btn-add" style="margin-top:6px;" data-action="add-skill" data-hr-idx="' + i + '">+ Add Skill</button>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function renderHRSkills(hrIdx, skills) {
	if (!skills.length) return '<div class="cp-array-item-empty" style="padding:12px;">No skills listed.</div>';
	var h = '';
	for (var i = 0; i < skills.length; i++) {
		var sk = skills[i];
		h += '<div class="cp-nested-item">' +
			'<input class="cp-input" placeholder="Skill Name" data-hr-idx="'+hrIdx+'" data-skill-idx="'+i+'" data-skill-field="name" value="'+esc(sk.name||'')+'" style="flex:2;">' +
			'<input class="cp-input" placeholder="Years" data-hr-idx="'+hrIdx+'" data-skill-idx="'+i+'" data-skill-field="years" value="'+esc(sk.years||'')+'" style="flex:1;">' +
			'<select class="cp-input cp-select" data-hr-idx="'+hrIdx+'" data-skill-idx="'+i+'" data-skill-field="level" style="flex:1.5;">'+buildSelectOptions(SKILL_LEVELS, sk.level||'')+'</select>' +
			'<input class="cp-input" placeholder="Certification" data-hr-idx="'+hrIdx+'" data-skill-idx="'+i+'" data-skill-field="certification" value="'+esc(sk.certification||'')+'" style="flex:1.5;">' +
			'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-skill" data-hr-idx="'+hrIdx+'" data-skill-idx="'+i+'">✕</button>' +
		'</div>';
	}
	return h;
}
function addHR() {
	if (!DB.humanResources.staffCapabilities) DB.humanResources.staffCapabilities = [];
	DB.humanResources.staffCapabilities.push({ name:'', role:'', experience:'', educationLevel:'', skills:[] });
	saveDB();
	renderHR();
}
function removeHR(idx) {
	DB.humanResources.staffCapabilities.splice(idx, 1);
	saveDB();
	renderHR();
}
function addSkill(hrIdx) {
	var staff = DB.humanResources.staffCapabilities[hrIdx];
	if (!staff.skills) staff.skills = [];
	staff.skills.push({ name:'', years:'', level:'', certification:'' });
	saveDB();
	renderHR();
}
function removeSkill(hrIdx, skillIdx) {
	var staff = DB.humanResources.staffCapabilities[hrIdx];
	if (staff && staff.skills) staff.skills.splice(skillIdx, 1);
	saveDB();
	renderHR();
}

/* ── Financials ── */
function renderFinancials() {
	// Annual revenues
	var revContainer = el('cp-revenues-container');
	var items = DB.financials.annualRevenues || [];
	if (!items.length) {
		revContainer.innerHTML = '<div class="cp-array-item-empty">No revenue entries.</div>';
	} else {
		var html = '';
		for (var i = 0; i < items.length; i++) {
			var r = items[i];
			html += '<div class="cp-array-item">' +
				'<div class="cp-array-item-header"><span class="cp-array-item-title">' + esc(r.year || 'Year #'+(i+1)) + '</span>' +
				'<div class="cp-array-item-actions"><button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-revenue" data-idx="'+i+'">✕</button></div></div>' +
				'<div class="cp-array-item-body"><div class="cp-array-item-row">' +
				'<div><label class="cp-label">Year</label><input type="number" class="cp-input" data-field="year" data-idx="'+i+'" data-section="revenues" value="'+esc(r.year||'')+'" placeholder="2024"></div>' +
				'<div><label class="cp-label">Annual Revenue ($)</label><input type="number" class="cp-input" data-field="revenue" data-idx="'+i+'" data-section="revenues" value="'+esc(r.revenue||'')+'" placeholder="0.00" step="0.01"></div>' +
				'<div><label class="cp-label">Net Income ($)</label><input type="number" class="cp-input" data-field="netIncome" data-idx="'+i+'" data-section="revenues" value="'+esc(r.netIncome||'')+'" placeholder="0.00" step="0.01"></div>' +
				'</div></div></div>';
		}
		revContainer.innerHTML = html;
	}

	// Summary
	setVal('f-currentAssets', DB.financials.currentAssets);
	setVal('f-currentLiabilities', DB.financials.currentLiabilities);
	setVal('f-workingCapital', DB.financials.workingCapital);
}
function readFinancialsSummary() {
	DB.financials.currentAssets = val('f-currentAssets');
	DB.financials.currentLiabilities = val('f-currentLiabilities');
	DB.financials.workingCapital = val('f-workingCapital');
}
function addRevenue() {
	if (!DB.financials.annualRevenues) DB.financials.annualRevenues = [];
	DB.financials.annualRevenues.push({ year:'', revenue:'', netIncome:'' });
	saveDB();
	renderFinancials();
}
function removeRevenue(idx) {
	DB.financials.annualRevenues.splice(idx, 1);
	saveDB();
	renderFinancials();
}

/* ── Reference Projects ── */
function renderProjects() {
	var container = el('cp-projects-container');
	var items = DB.referenceProjects || [];
	if (!items.length) {
		container.innerHTML = '<div class="cp-array-item-empty">No reference projects added.</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var p = items[i];
		html += '<div class="cp-array-item">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(p.name || 'Project #'+(i+1)) + '</span>' +
				'<div class="cp-array-item-actions">' +
					'<button class="cp-btn cp-btn-sm cp-btn-danger" data-action="remove-project" data-idx="' + i + '">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-array-item-body">' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Project Name</label><input class="cp-input" data-field="name" data-idx="'+i+'" data-section="projects" value="'+esc(p.name||'')+'"></div>' +
				'<div><label class="cp-label">Client Name</label><input class="cp-input" data-field="clientName" data-idx="'+i+'" data-section="projects" value="'+esc(p.clientName||'')+'"></div></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Contract Value</label><input class="cp-input" data-field="contractValue" data-idx="'+i+'" data-section="projects" value="'+esc(p.contractValue||'')+'" placeholder="e.g. $500,000"></div>' +
				'<div><label class="cp-label">Project Location</label><input class="cp-input" data-field="location" data-idx="'+i+'" data-section="projects" value="'+esc(p.location||'')+'"></div></div>' +
				'<div><label class="cp-label">Description / Scope</label><textarea class="cp-input cp-textarea" data-field="description" data-idx="'+i+'" data-section="projects" rows="2">'+esc(p.description||'')+'</textarea></div>' +
				'<div class="cp-array-item-row"><div><label class="cp-label">Start Date</label><input type="date" class="cp-input" data-field="startDate" data-idx="'+i+'" data-section="projects" value="'+esc(p.startDate||'')+'"></div>' +
				'<div><label class="cp-label">End Date</label><input type="date" class="cp-input" data-field="endDate" data-idx="'+i+'" data-section="projects" value="'+esc(p.endDate||'')+'"></div></div>' +
			'</div>' +
		'</div>';
	}
	container.innerHTML = html;
}
function addProject() {
	if (!DB.referenceProjects) DB.referenceProjects = [];
	DB.referenceProjects.push({ name:'', clientName:'', contractValue:'', location:'', description:'', startDate:'', endDate:'' });
	saveDB();
	renderProjects();
}
function removeProject(idx) {
	DB.referenceProjects.splice(idx, 1);
	saveDB();
	renderProjects();
}

/* ── Progress ── */
function updateProgress() {
	var totalFields = 0;
	var filledFields = 0;

	function count(str) {
		totalFields++;
		if (str && String(str).trim()) filledFields++;
	}
	function countArr(arr) {
		totalFields++;
		if (arr && arr.length > 0) filledFields++;
	}

	// Basic info
	var b = DB.basicInfo;
	count(b.legalName); count(b.companyType); count(b.yearEstablished); count(b.numEmployees);
	count(b.tradeName); count(b.businessNumber);

	// Mission
	var m = DB.mission;
	count(m.mission); count(m.vision); count(m.about);

	// Taxes
	countArr(DB.salesTaxDefinitions);

	// HQ
	var h = DB.headquarters;
	count(h.address); count(h.city); count(h.country); count(h.email); count(h.phone);

	// Offices
	countArr(DB.otherOffices);

	// Billing
	count(DB.billingAddress.address || DB.headquarters.address);

	// Geographic
	count(DB.geographicCoverage.countries);
	count(DB.geographicCoverage.cities);

	// Contacts
	var pc = DB.contacts.primary;
	count(pc.name); count(pc.email); count(pc.phone);
	countArr(DB.contacts.others);

	// Weblinks
	var w = DB.weblinks;
	count(w.website); count(w.email);

	// Industry
	var io = DB.industryOps;
	count(io.primaryIndustry);
	countArr(io.capabilities);

	// Documents
	countArr(DB.documents.certificates);

	// Reference letters
	countArr(DB.referenceLetters);

	// Assets
	countArr(DB.assets.owned);
	countArr(DB.assets.partnerAccessible);

	// HR
	countArr(DB.humanResources.staffCapabilities);

	// Financials
	countArr(DB.financials.annualRevenues);
	count(DB.financials.currentAssets);

	// Projects
	countArr(DB.referenceProjects);

	var pct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
	var fill = el('cp-progress-fill');
	var pctEl = el('cp-progress-pct');
	if (fill) fill.style.width = pct + '%';
	if (pctEl) pctEl.textContent = pct + '%';
}

function updateHeaderName() {
	var nameEl = el('cp-org-name-display');
	var name = DB.basicInfo.legalName || DB.basicInfo.tradeName || '—';
	if (nameEl) nameEl.textContent = name;
}

function updateBadges() {
	var badges = {
		'taxes': DB.salesTaxDefinitions.length,
		'offices': DB.otherOffices.length,
		'documents': (DB.documents.certificates||[]).length,
		'refletters': (DB.referenceLetters||[]).length,
		'assets-owned': (DB.assets.owned||[]).length,
		'assets-partner': (DB.assets.partnerAccessible||[]).length,
		'hr': (DB.humanResources.staffCapabilities||[]).length,
		'projects': (DB.referenceProjects||[]).length
	};
	Object.keys(badges).forEach(function(key) {
		var elId = 'cp-' + key + '-count';
		var elm = document.getElementById(elId);
		if (elm) elm.textContent = badges[key];
		var navBadge = document.getElementById('nav-badge-' + key);
		if (navBadge) navBadge.textContent = badges[key];
	});
}

/* ── Section Toggle ── */
function toggleSectionEl(sectionEl, collapse) {
	if (collapse === undefined) {
		sectionEl.classList.toggle('collapsed');
	} else if (collapse) {
		sectionEl.classList.add('collapsed');
	} else {
		sectionEl.classList.remove('collapsed');
	}
	tool.resize();
}

/* ── Global Event Delegation ── */
document.getElementById('app').addEventListener('click', function(e) {
	if (isReadOnly) return;

	var target = e.target;
	var actionBtn = target.closest('[data-action]');
	var action = target.getAttribute('data-action') || (actionBtn ? actionBtn.getAttribute('data-action') : null);
	if (!action) return;

	var btn = target.closest('[data-action]');
	var idx = parseInt(btn ? btn.getAttribute('data-idx') : '', 10);
	var hrIdx = parseInt(btn ? btn.getAttribute('data-hr-idx') : '', 10);
	var skillIdx = parseInt(btn ? btn.getAttribute('data-skill-idx') : '', 10);

	switch (action) {
		case 'add-tax': addTax(); break;
		case 'remove-tax': removeTax(idx); break;
		case 'add-office': addOffice(); break;
		case 'remove-office': removeOffice(idx); break;
		case 'add-contact': addContact(); break;
		case 'remove-contact': removeContact(idx); break;
		case 'add-othersocial': addOtherSocial(); break;
		case 'remove-othersocial': removeOtherSocial(idx); break;
		case 'add-otherweb': addOtherWeb(); break;
		case 'remove-otherweb': removeOtherWeb(idx); break;
		case 'add-capability': addCapability(); break;
		case 'remove-capability': removeCapability(idx); break;
		case 'add-cert': addCert(); break;
		case 'remove-cert': removeCert(idx); break;
		case 'add-refletter': addRefLetter(); break;
		case 'remove-refletter': removeRefLetter(idx); break;
		case 'add-asset-owned': addAssetOwned(); break;
		case 'remove-asset-owned': removeAssetOwned(idx); break;
		case 'add-asset-partner': addAssetPartner(); break;
		case 'remove-asset-partner': removeAssetPartner(idx); break;
		case 'add-hr': addHR(); break;
		case 'remove-hr': removeHR(idx); break;
		case 'add-skill': addSkill(hrIdx); break;
		case 'remove-skill': removeSkill(hrIdx, skillIdx); break;
		case 'add-revenue': addRevenue(); break;
		case 'remove-revenue': removeRevenue(idx); break;
		case 'add-project': addProject(); break;
		case 'remove-project': removeProject(idx); break;
	}
});

/* ── Global Input Change Handler (auto-save) ── */
document.getElementById('app').addEventListener('input', function(e) {
	if (isReadOnly) return;
	var target = e.target;
	if (!target.closest('.cp-input')) return;

	// Debounced save
	clearTimeout(saveTimeout);
	var indicator = el('cp-save-indicator');
	if (indicator) indicator.className = 'cp-save-indicator saving';

	saveTimeout = setTimeout(function() {
		readAllFromDOM();
		saveDB();
		if (indicator) indicator.className = 'cp-save-indicator';
		updateBadges();
	}, 600);
});

document.getElementById('app').addEventListener('change', function(e) {
	if (isReadOnly) return;
	var target = e.target;
	if (!target.closest('.cp-input, .cp-select')) return;

	// Billing same-as-HQ toggle
	if (target.id === 'f-billing-same') {
		var fieldsDiv = el('cp-billing-fields');
		fieldsDiv.style.display = target.checked ? 'none' : '';
		readBilling();
		saveDB();
		return;
	}

	// Immediate save on select/date changes
	readAllFromDOM();
	saveDB();
	updateBadges();
});

/* ── Read All Data From DOM ── */
function readAllFromDOM() {
	readBasicInfo();
	readMission();
	readHeadquarters();
	readBilling();
	// Sync billing from HQ if sameAsHQ is checked
	if (DB.billingAddress.sameAsHQ !== false) {
		var hq = DB.headquarters;
		DB.billingAddress.address = hq.address;
		DB.billingAddress.city = hq.city;
		DB.billingAddress.state = hq.state;
		DB.billingAddress.postal = hq.postal;
		DB.billingAddress.country = hq.country;
	}
	readGeographic();
	readPrimaryContact();
	readWeblinks();
	readIndustry();
	readFinancialsSummary();

	// Read all data-field array items
	readArrayFields('taxes', DB.salesTaxDefinitions, ['name','rate','taxNumber','notes']);
	readArrayFields('offices', DB.otherOffices, ['name','type','address','city','state','postal','country','email','phone']);
	readArrayFields('contacts', DB.contacts.others, ['name','title','email','phone','linkedin']);
	readArrayFields('othersocial', DB.weblinks.otherSocials || [], ['platform','url']);
	readArrayFields('otherweb', DB.weblinks.otherWebSources || [], ['label','url']);
	readArrayFields('capabilities', DB.industryOps.capabilities || [], ['name','description','serviceCategories','expertiseLevel','certified','relatedStandards','supportingDocs']);
	readArrayFields('certs', DB.documents.certificates || [], ['name','type','effectiveDate','expiryDate','file','isValid','description']);
	readArrayFields('refletters', DB.referenceLetters || [], ['title','file','issuedBy','issueDate','summary','associatedProjects']);
	readArrayFields('assets-owned', DB.assets.owned || [], ['name','type','quantity','description','ownership','readiness','technicalSpecs','certifications']);
	readArrayFields('assets-partner', DB.assets.partnerAccessible || [], ['name','type','quantity','description','reliability','readiness','technicalSpecs','certifications']);
	readArrayFields('hr', DB.humanResources.staffCapabilities || [], ['name','role','experience','educationLevel']);
	readArrayFields('revenues', DB.financials.annualRevenues || [], ['year','revenue','netIncome']);
	readArrayFields('projects', DB.referenceProjects || [], ['name','clientName','contractValue','location','description','startDate','endDate']);

	// Read HR skills
	readHRSkillsFromDOM();
}

function readArrayFields(section, arr, fields) {
	var allInputs = document.querySelectorAll('[data-section="' + section + '"]');
	allInputs.forEach(function(input) {
		var idx = parseInt(input.getAttribute('data-idx'), 10);
		var field = input.getAttribute('data-field');
		if (isNaN(idx) || !field || idx >= arr.length) return;
		if (input.type === 'checkbox') {
			arr[idx][field] = input.checked;
		} else if (input.tagName === 'SELECT') {
			var selVal = input.value;
			// Handle boolean stored as string
			if (field === 'isValid') {
				arr[idx][field] = selVal === 'true' ? true : (selVal === 'false' ? false : null);
			} else {
				arr[idx][field] = selVal;
			}
		} else {
			arr[idx][field] = input.value;
		}
	});
}

function readHRSkillsFromDOM() {
	var staff = DB.humanResources.staffCapabilities || [];
	for (var i = 0; i < staff.length; i++) {
		if (!staff[i].skills) staff[i].skills = [];
		var skillInputs = document.querySelectorAll('[data-hr-idx="' + i + '"]');
		skillInputs.forEach(function(input) {
			var skillIdx = parseInt(input.getAttribute('data-skill-idx'), 10);
			var field = input.getAttribute('data-skill-field');
			if (isNaN(skillIdx) || !field || skillIdx >= staff[i].skills.length) return;
			staff[i].skills[skillIdx][field] = input.value;
		});
	}
}

/* ── Previous / Next Section ── */
el('cp-expand-all').addEventListener('click', function() {
	navigateSection(-1);
});
el('cp-collapse-all').addEventListener('click', function() {
	navigateSection(1);
});

/* ── Dark / Light mode toggle (session only, no storage) ── */
var themeToggle = el('cp-theme-toggle');
if (themeToggle) {
	themeToggle.addEventListener('click', function() {
		el('app').classList.toggle('cp-dark');
	});
}

function navigateSection(direction) {
	// Build ordered list of visible sections
	var visible = [];
	for (var i = 0; i < SECTIONS.length; i++) {
		if (isSectionVisible(SECTIONS[i].id)) visible.push(SECTIONS[i].id);
	}
	if (visible.length === 0) return;
	var idx = visible.indexOf(currentSection);
	if (idx === -1) idx = 0;
	var newIdx = idx + direction;
	if (newIdx < 0) newIdx = visible.length - 1;
	if (newIdx >= visible.length) newIdx = 0;
	switchToSection(visible[newIdx]);
}

/* ── Declare Output Schema ── */
tool.declareOutput({
	type: 'object',
	description: 'Comprehensive company profile data',
	properties: {
		basicInfo: { type: 'object' },
		mission: { type: 'object' },
		salesTaxDefinitions: { type: 'array' },
		headquarters: { type: 'object' },
		otherOffices: { type: 'array' },
		billingAddress: { type: 'object' },
		geographicCoverage: { type: 'object' },
		contacts: { type: 'object' },
		weblinks: { type: 'object' },
		industryOps: { type: 'object' },
		documents: { type: 'object' },
		referenceLetters: { type: 'array' },
		assets: { type: 'object' },
		humanResources: { type: 'object' },
		financials: { type: 'object' },
		referenceProjects: { type: 'array' }
	}
});

tool.declareParams([
	{ name: 'visibleSections', label: 'Visible Sections', type: 'text', default: 'all', hint: 'Comma-separated section IDs, or "all". Options: basic,mission,taxes,headquarters,offices,billing,geographic,contacts,weblinks,industry,documents,refletters,assets-owned,assets-partner,hr,financials,projects' }
]);

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', function(e) {
	if (e.ctrlKey && e.shiftKey && e.key === 'E') {
		e.preventDefault();
		navigateSection(1);
	}
});

tool.resize();

/* ── Modal handlers ── */
function closeModal() {
	el('cp-modal-overlay').classList.remove('open');
	modalCb = null;
}
el('cp-modal-close').addEventListener('click', closeModal);
el('cp-modal-cancel').addEventListener('click', closeModal);
el('cp-modal-overlay').addEventListener('click', function(e) {
	if (e.target === el('cp-modal-overlay')) closeModal();
});
el('cp-modal-save').addEventListener('click', function() {
	if (modalCb) { modalCb(); closeModal(); }
});
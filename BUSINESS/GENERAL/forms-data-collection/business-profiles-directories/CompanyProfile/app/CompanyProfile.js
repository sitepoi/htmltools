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
	{ id: 'basic',         group: 'Foundation',         icon: 'building', title: 'Basic Information',          desc: 'Core company identity and classification' },
	{ id: 'mission',       group: 'Foundation',         icon: 'target',   title: 'Brand & Positioning',        desc: 'Purpose, direction and how the company presents itself' },
	{ id: 'industry',      group: 'Foundation',         icon: 'factory',  title: 'Industry & Capabilities',    desc: 'Sector classification, capabilities and procurement codes' },
	{ id: 'headquarters',  group: 'Contact & Locations', icon: 'pin',     title: 'Headquarters',               desc: 'Primary business address and contact information' },
	{ id: 'offices',       group: 'Contact & Locations', icon: 'offices', title: 'Other Offices & Branches',   navLabel: 'Offices & Branches', desc: 'Additional locations, branches and satellite offices', needs: ['locations'], count: function() { return DB.otherOffices.length; } },
	{ id: 'billing',       group: 'Contact & Locations', icon: 'card',    title: 'Billing Address',            desc: 'Address used for invoicing and financial correspondence', needs: ['salesTax'] },
	{ id: 'geographic',    group: 'Contact & Locations', icon: 'globe',   title: 'Geographic Coverage',        desc: 'Areas where the business operates, used for tender matching', needs: ['coverage', 'tenders'] },
	{ id: 'contacts',      group: 'Contact & Locations', icon: 'users',   title: 'Contacts',                   desc: 'Key people and points of contact', count: function() { return DB.contacts.others.length; } },
	{ id: 'weblinks',      group: 'Contact & Locations', icon: 'link',    title: 'Weblinks & Social Media',    navLabel: 'Weblinks & Social', desc: 'Online presence and digital channels' },
	{ id: 'taxes',         group: 'Commercial',         icon: 'receipt',  title: 'Sales Tax Registrations',    navLabel: 'Sales Tax', desc: 'Tax numbers, rates and responsibilities', needs: ['salesTax'], count: function() { return DB.salesTaxDefinitions.length; } },
	{ id: 'invoicing',     group: 'Commercial',         icon: 'receipt',  title: 'Invoicing',                  desc: 'Payment instructions and invoice branding' },
	{ id: 'financials',    group: 'Commercial',         icon: 'chart',    title: 'Financial Standing',         desc: 'Revenue history and financial position', needs: ['financials', 'tenders', 'grants'] },
	{ id: 'documents',     group: 'Compliance',         icon: 'shield',   title: 'Documents & Certificates',   navLabel: 'Documents', desc: 'Licences, certifications, insurance and supporting documents', needs: ['compliance', 'tenders'], count: function() { return (DB.documents.certificates || []).length; } },
	{ id: 'refletters',    group: 'Compliance',         icon: 'mail',     title: 'Reference Letters',          desc: 'Recommendations from clients and partners', needs: ['portfolio', 'tenders'], count: function() { return (DB.referenceLetters || []).length; } },
	{ id: 'assets-owned',  group: 'Capacity',           icon: 'truck',    title: 'Owned Assets',               desc: 'Equipment, vehicles, facilities and other owned resources', needs: ['fleet'], count: function() { return (DB.assets.owned || []).length; } },
	{ id: 'assets-partner',group: 'Capacity',           icon: 'share',    title: 'Partner Assets',             desc: 'Resources available through partnerships and alliances', needs: ['fleet'], count: function() { return (DB.assets.partnerAccessible || []).length; } },
	{ id: 'hr',            group: 'Capacity',           icon: 'users2',   title: 'Workforce & Skills',         desc: 'Team structure, roles and expertise', needs: ['workforce'], count: function() { return (DB.humanResources.staffCapabilities || []).length; } },
	{ id: 'projects',      group: 'Experience',         icon: 'folder',   title: 'Reference Projects',         desc: 'Past projects, clients and outcomes', needs: ['portfolio', 'tenders'], count: function() { return (DB.referenceProjects || []).length; } }
];

/* ── Profile focus areas (drive which sections are shown) ── */
var PROFILE_FOCUS_AREAS = [
	{ id: 'tenders',    label: 'Bids & tenders',        desc: 'Public procurement, RFPs, prequalification' },
	{ id: 'grants',     label: 'Grants & funding',      desc: 'Grant applications and public funding' },
	{ id: 'compliance', label: 'Certifications',        desc: 'Licences, insurance, safety and quality' },
	{ id: 'fleet',      label: 'Equipment & fleet',     desc: 'Owned and partner-accessible equipment' },
	{ id: 'locations',  label: 'Multiple locations',    desc: 'Branches, sites and satellite offices' },
	{ id: 'coverage',   label: 'Service coverage',      desc: 'Regions, cities and service radius' },
	{ id: 'salesTax',   label: 'Sales tax',             desc: 'Tax registrations and billing details' },
	{ id: 'workforce',  label: 'Workforce',             desc: 'Team capacity, roles and skills' },
	{ id: 'financials', label: 'Financial standing',    desc: 'Revenue history and financial ratios' },
	{ id: 'portfolio',  label: 'Projects & references', desc: 'Reference projects and client letters' }
];

/* ── Industries with the sections they usually need ── */
var INDUSTRIES = [
	{ id: 'construction',   label: 'Construction & Trades',              preset: ['tenders', 'compliance', 'fleet', 'workforce', 'portfolio', 'financials', 'salesTax'] },
	{ id: 'technology',     label: 'Technology & IT',                    preset: ['portfolio', 'workforce', 'compliance', 'salesTax'] },
	{ id: 'consulting',     label: 'Consulting & Professional Services', preset: ['portfolio', 'workforce', 'financials', 'salesTax'] },
	{ id: 'healthcare',     label: 'Healthcare & Life Sciences',         preset: ['compliance', 'workforce', 'salesTax'] },
	{ id: 'education',      label: 'Education & Training',               preset: ['grants', 'workforce', 'compliance'] },
	{ id: 'manufacturing',  label: 'Manufacturing',                      preset: ['tenders', 'compliance', 'fleet', 'workforce', 'portfolio', 'salesTax'] },
	{ id: 'retail',         label: 'Retail & Wholesale',                 preset: ['salesTax', 'locations'] },
	{ id: 'transportation', label: 'Transportation & Logistics',         preset: ['tenders', 'fleet', 'compliance', 'workforce', 'coverage', 'salesTax'] },
	{ id: 'energy',         label: 'Energy & Utilities',                 preset: ['tenders', 'compliance', 'fleet', 'workforce', 'portfolio', 'financials', 'salesTax'] },
	{ id: 'agriculture',    label: 'Agriculture & Food',                 preset: ['fleet', 'compliance', 'salesTax'] },
	{ id: 'hospitality',    label: 'Hospitality & Tourism',              preset: ['locations', 'workforce', 'salesTax'] },
	{ id: 'realestate',     label: 'Real Estate',                        preset: ['portfolio', 'locations', 'financials', 'salesTax'] },
	{ id: 'finance',        label: 'Finance & Insurance',                preset: ['compliance', 'workforce', 'financials'] },
	{ id: 'nonprofit',      label: 'Non-Profit & Social Services',       preset: ['grants', 'workforce', 'compliance'] },
	{ id: 'media',          label: 'Media & Communications',             preset: ['portfolio', 'workforce', 'salesTax'] },
	{ id: 'mining',         label: 'Mining & Natural Resources',         preset: ['tenders', 'compliance', 'fleet', 'workforce', 'financials', 'salesTax'] },
	{ id: 'pharma',         label: 'Pharmaceuticals & Life Sciences',    preset: ['compliance', 'workforce', 'financials', 'salesTax'] },
	{ id: 'environmental',  label: 'Environmental Services',             preset: ['tenders', 'compliance', 'fleet', 'workforce', 'portfolio', 'salesTax'] },
	{ id: 'security',       label: 'Security & Defense',                 preset: ['tenders', 'compliance', 'workforce', 'portfolio', 'salesTax'] },
	{ id: 'government',     label: 'Government & Public Sector',         preset: ['tenders', 'compliance', 'workforce', 'financials'] },
	{ id: 'other',          label: 'Other',                              preset: [] }
];

/* ── Starting templates for common profile scenarios ──
   Adding a new scenario is a data change: append one entry with the industry
   and the coverage areas it needs. No other code has to change. */
var PROFILE_TEMPLATES = [
	{ id: 'general',   label: 'General company',       desc: 'Identity, contacts and brand only',                    industry: 'other',        focus: [] },
	{ id: 'tenders',   label: 'Public tenders',        desc: 'Procurement, certifications, capacity and references', industry: 'construction', focus: ['tenders', 'compliance', 'fleet', 'workforce', 'portfolio', 'financials', 'salesTax', 'coverage'] },
	{ id: 'software',  label: 'Software / IT vendor',  desc: 'Projects, team and security documentation',            industry: 'technology',   focus: ['portfolio', 'workforce', 'compliance', 'salesTax'] },
	{ id: 'grants',    label: 'Nonprofit & grants',    desc: 'Funding, workforce and compliance evidence',           industry: 'nonprofit',    focus: ['grants', 'workforce', 'compliance', 'financials'] },
	{ id: 'healthcare',label: 'Healthcare provider',   desc: 'Certifications, workforce and tax registration',       industry: 'healthcare',   focus: ['compliance', 'workforce', 'salesTax'] }
];

/* ── Brand & positioning statements shown as editable cards ── */
var STATEMENTS = [
	{ key: 'mission', label: 'Mission statement', hint: 'Why the company exists today', icon: 'target' },
	{ key: 'vision',  label: 'Vision statement',  hint: 'What it is building toward',   icon: 'globe' },
	{ key: 'values',  label: 'Core values',       hint: 'Principles that guide decisions', icon: 'shield' },
	{ key: 'targets', label: 'Goals & targets',   hint: 'What success looks like',      icon: 'chart' },
	{ key: 'about',   label: 'About the company', hint: 'History, products and services', icon: 'building', wide: true }
];

/* ── Flexible custom data: field types and helpers ── */
var CUSTOM_FIELD_TYPES = [
	{ id: 'text',     label: 'Text' },
	{ id: 'textarea', label: 'Long text' },
	{ id: 'number',   label: 'Number' },
	{ id: 'date',     label: 'Date' },
	{ id: 'url',      label: 'Link' },
	{ id: 'email',    label: 'Email' }
];

var CURRENT_SCHEMA_VERSION = 3;
var INVOICE_LOGO_MAX_BYTES = 1024 * 1024;
var editingStatementKey = null;

function newId(prefix) {
	return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function findCustomSection(sectionId) {
	var list = (DB.profile && DB.profile.customSections) || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i].id === sectionId) return list[i];
	}
	return null;
}

function customFieldListFor(owner) {
	if (owner.indexOf('custom:') === 0) {
		var customSection = findCustomSection(owner.slice(7));
		if (!customSection) return [];
		if (!customSection.fields) customSection.fields = [];
		return customSection.fields;
	}
	if (!DB.profile.customFields) DB.profile.customFields = {};
	if (!DB.profile.customFields[owner]) DB.profile.customFields[owner] = [];
	return DB.profile.customFields[owner];
}

function customFieldTypeById(typeId) {
	for (var i = 0; i < CUSTOM_FIELD_TYPES.length; i++) {
		if (CUSTOM_FIELD_TYPES[i].id === typeId) return CUSTOM_FIELD_TYPES[i];
	}
	return CUSTOM_FIELD_TYPES[0];
}

/* ── Inline line icons (no external library) ── */
var ICON_PATHS = {
	building: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9 20.5v-4h6v4M8 7.5h.01M12 7.5h.01M16 7.5h.01M8 11.5h.01M12 11.5h.01M16 11.5h.01"/>',
	target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
	factory: '<path d="M3.5 20.5h17M4.5 20.5V9l5 3V9l5 3V9l4.9 2.9v8.6"/><path d="M8 20.5v-4M13 20.5v-4M18 20.5v-4"/>',
	pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
	offices: '<rect x="3" y="7" width="8" height="13.5" rx="1.6"/><rect x="13" y="3.5" width="8" height="17" rx="1.6"/><path d="M6 10.5h2M6 14h2M16 7h2M16 10.5h2M16 14h2"/>',
	card: '<rect x="2.8" y="5" width="18.4" height="14" rx="2.4"/><path d="M2.8 10h18.4M6.5 15h3.5"/>',
	globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z"/>',
	users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0"/><path d="M15.5 5.2a3.4 3.4 0 0 1 0 5.6M17.2 14.6a6.2 6.2 0 0 1 4 5.6"/>',
	users2: '<circle cx="12" cy="8" r="3.4"/><path d="M5.8 20.2a6.2 6.2 0 0 1 12.4 0"/><path d="M5 6.4a3 3 0 0 1 0 4.6M19 6.4a3 3 0 0 0 0 4.6"/>',
	link: '<path d="M9.6 14.4a4.6 4.6 0 0 0 6.5 0l2.6-2.6a4.6 4.6 0 0 0-6.5-6.5L10.6 7"/><path d="M14.4 9.6a4.6 4.6 0 0 0-6.5 0l-2.6 2.6a4.6 4.6 0 0 0 6.5 6.5l1.6-1.6"/>',
	receipt: '<path d="M5.5 3.5h13v17l-2.6-1.7-2.4 1.7-2.5-1.7-2.5 1.7-2.9-1.7v-15Z"/><path d="M9 8h6M9 11.6h6M9 15.2h3.5"/>',
	shield: '<path d="M12 3.2 19 6v6.1c0 4.4-2.9 7.6-7 8.9-4.1-1.3-7-4.5-7-8.9V6l7-2.8Z"/><path d="m9 12 2.1 2.1L15.4 10"/>',
	mail: '<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="m3.6 7 8.4 6 8.4-6"/>',
	truck: '<path d="M3 16.5V6.5h10.5v10M13.5 10h4l3 3.2v3.3h-7"/><circle cx="7" cy="18" r="1.9"/><circle cx="17.2" cy="18" r="1.9"/>',
	share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="m8.2 10.9 7.6-3.7M8.2 13.1l7.6 3.7"/>',
	chart: '<path d="M4 20V4M4 20h16"/><path d="M8 20v-5M12.5 20V9M17 20v-7.5"/>',
	folder: '<path d="M3 7.2a2 2 0 0 1 2-2h3.6l2 2.2H19a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.2Z"/>',
	check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
	chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
	moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.6 8.6 0 1 0 10.5 10.5Z"/>',
	pencil: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m15 6.5 3 3"/>',
	spark: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z"/>'
};

function iconSvg(name) {
	var body = ICON_PATHS[name];
	if (!body) return '';
	return '<svg class="cp-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
}

function sectionById(sectionId) {
	for (var i = 0; i < SECTIONS.length; i++) {
		if (SECTIONS[i].id === sectionId) return SECTIONS[i];
	}
	return null;
}

function industryById(industryId) {
	for (var i = 0; i < INDUSTRIES.length; i++) {
		if (INDUSTRIES[i].id === industryId) return INDUSTRIES[i];
	}
	return null;
}

function industryLabel(industryId) {
	var industry = industryById(industryId);
	return industry ? industry.label : '';
}

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
		schemaVersion:   CURRENT_SCHEMA_VERSION,
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
		invoicing:       { paymentInstructions:'', invoiceFooterNote:'', logoUrl:'', logoName:'' },
		referenceProjects: [],
		profile:         {
			focus: [], presetFocus: [], showAllSections: false, updatedAt: '', initialized: false,
			templateId: '', customFields: {}, customSections: []
		}
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
		updateCompletion();
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
	normalizeDB();
	ensureProfileDefaults();
}

/* Guarantees the flexible parts of the model always exist and are well formed.
   New optional keys can be added here without touching any saved record. */
function normalizeDB() {
	DB.schemaVersion = CURRENT_SCHEMA_VERSION;
	if (!DB.profile || typeof DB.profile !== 'object') {
		DB.profile = { focus: [], presetFocus: [], showAllSections: false, updatedAt: '', initialized: false, templateId: '', customFields: {}, customSections: [] };
	}
	if (!Array.isArray(DB.profile.focus)) DB.profile.focus = [];
	if (!Array.isArray(DB.profile.presetFocus)) DB.profile.presetFocus = [];
	if (DB.profile.showAllSections !== true) DB.profile.showAllSections = false;
	if (typeof DB.profile.templateId !== 'string') DB.profile.templateId = '';
	if (!DB.profile.customFields || typeof DB.profile.customFields !== 'object' || Array.isArray(DB.profile.customFields)) {
		DB.profile.customFields = {};
	}
	Object.keys(DB.profile.customFields).forEach(function(sectionId) {
		DB.profile.customFields[sectionId] = normalizeCustomFields(DB.profile.customFields[sectionId]);
	});
	if (!Array.isArray(DB.profile.customSections)) DB.profile.customSections = [];
	var seenSectionIds = new Set();
	DB.profile.customSections = DB.profile.customSections.filter(function(section) {
		if (!section || typeof section !== 'object') return false;
		if (!section.id || typeof section.id !== 'string') section.id = newId('cs');
		if (seenSectionIds.has(section.id)) section.id = newId('cs');
		seenSectionIds.add(section.id);
		section.title = String(section.title || 'Custom section').slice(0, 80);
		section.description = String(section.description || '').slice(0, 300);
		section.fields = normalizeCustomFields(section.fields);
		return true;
	});
	if (!DB.invoicing || typeof DB.invoicing !== 'object' || Array.isArray(DB.invoicing)) {
		DB.invoicing = { paymentInstructions: '', invoiceFooterNote: '', logoUrl: '', logoName: '' };
	}
	DB.invoicing.paymentInstructions = String(DB.invoicing.paymentInstructions || '');
	DB.invoicing.invoiceFooterNote = String(DB.invoicing.invoiceFooterNote || '').slice(0, 160);
	DB.invoicing.logoUrl = String(DB.invoicing.logoUrl || '');
	DB.invoicing.logoName = String(DB.invoicing.logoName || '').slice(0, 160);
}

function normalizeCustomFields(fields) {
	if (!Array.isArray(fields)) return [];
	var seenFieldIds = new Set();
	return fields.filter(function(field) {
		if (!field || typeof field !== 'object') return false;
		if (!field.id || typeof field.id !== 'string' || seenFieldIds.has(field.id)) field.id = newId('cf');
		seenFieldIds.add(field.id);
		field.label = String(field.label || '').slice(0, 120);
		field.type = customFieldTypeById(field.type).id;
		field.value = (field.value === undefined || field.value === null) ? '' : String(field.value);
		return true;
	});
}

/* Existing profiles created before the profile setup existed adopt the
   industry suggestion once, so nothing disappears from their sidebar. */
function ensureProfileDefaults() {
	if (!DB.profile) DB.profile = { focus: [], presetFocus: [], showAllSections: false, updatedAt: '', initialized: false };
	if (DB.profile.initialized) return;
	DB.profile.initialized = true;
	if (!DB.profile.focus.length && !DB.profile.presetFocus.length && DB.industryOps.primaryIndustry) {
		var preset = presetForIndustry(DB.industryOps.primaryIndustry);
		DB.profile.focus = preset.slice();
		DB.profile.presetFocus = preset.slice();
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
	if (sectionId.indexOf('custom-') === 0) return true;
	if (visibleSections && !visibleSections.has(sectionId)) return false;
	if (DB.profile && DB.profile.showAllSections) return true;
	return sectionMatchesProfile(sectionId);
}

function parseVisibleSections() {
	var raw = tool.param('visibleSections', 'all');
	if (!raw || raw === 'all' || raw === '*') { visibleSections = null; return; }
	visibleSections = new Set(raw.split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean));
}

function profileIsConfigured() {
	if (profileFocusSet().size) return true;
	if (DB.profile && DB.profile.templateId) return true;
	var industry = industryById(DB.industryOps.primaryIndustry);
	return !!(industry && industry.preset.length > 0);
}

function profileFocusSet() {
	var set = new Set();
	var list = (DB.profile && DB.profile.focus) || [];
	for (var i = 0; i < list.length; i++) set.add(list[i]);
	return set;
}

function focusToList(focusSet) {
	var out = [];
	for (var i = 0; i < PROFILE_FOCUS_AREAS.length; i++) {
		if (focusSet.has(PROFILE_FOCUS_AREAS[i].id)) out.push(PROFILE_FOCUS_AREAS[i].id);
	}
	return out;
}

function sectionMatchesProfile(sectionId) {
	var section = sectionById(sectionId);
	if (!section || !section.needs || !section.needs.length) return true;
	if (!profileIsConfigured()) return true;
	var focus = profileFocusSet();
	for (var i = 0; i < section.needs.length; i++) {
		if (focus.has(section.needs[i])) return true;
	}
	return false;
}

function presetForIndustry(industryId) {
	var industry = industryById(industryId);
	return industry ? industry.preset.slice() : [];
}

function sameStringList(a, b) {
	if (a.length !== b.length) return false;
	var set = new Set(a);
	for (var i = 0; i < b.length; i++) {
		if (!set.has(b[i])) return false;
	}
	return true;
}

/* Keeps manual focus choices, but adopts the industry suggestion when the
   current selection is still exactly the previous suggestion (untouched). */
function applyIndustryPreset(force) {
	var preset = presetForIndustry(DB.industryOps.primaryIndustry);
	var current = (DB.profile.focus || []).slice();
	var previousPreset = (DB.profile.presetFocus || []).slice();
	var untouched = sameStringList(current, previousPreset);
	DB.profile.presetFocus = preset.slice();
	if (force || untouched) {
		DB.profile.focus = preset.slice();
		return true;
	}
	return false;
}

function focusMatchesPreset() {
	var preset = presetForIndustry(DB.industryOps.primaryIndustry);
	return sameStringList(focusToList(profileFocusSet()), preset);
}

function toggleFocusArea(areaId) {
	var focus = profileFocusSet();
	if (focus.has(areaId)) focus.delete(areaId); else focus.add(areaId);
	DB.profile.focus = focusToList(focus);
	DB.profile.templateId = '';
	DB.profile.updatedAt = new Date().toISOString();
	saveDB();
	renderProfileSetup();
	buildNav();
	syncSectionVisibility();
	updateCompletion();
}

function toggleShowAllSections() {
	DB.profile.showAllSections = !DB.profile.showAllSections;
	saveDB();
	renderProfileSetup();
	buildNav();
	syncSectionVisibility();
	updateCompletion();
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
	injectStaticIcons();
	applySectionMeta();
	renderIndustryOptions();
	wireAppControls();
	buildNav();
	renderAll();
	updateHeaderName();
	updateThemeToggleIcon();

	if (tool.isReadOnly()) { isReadOnly = true; lockUI(true); }

	tool.onValueChange(function(v) {
		if (selfSaving) return; // skip re-render on self-initiated saves
		loadDB(v); renderAll(); updateHeaderName();
	});
	tool.onReadonlyChange(function(ro) { isReadOnly = ro; lockUI(ro); });
	tool.onFieldsChange(function(f) { /* react to sibling fields if needed */ });
	tool.resize();
});

/* ── Icons and section headings ── */
function injectStaticIcons() {
	var nodes = document.querySelectorAll('[data-icon]');
	for (var i = 0; i < nodes.length; i++) {
		var iconName = nodes[i].getAttribute('data-icon');
		if (iconName && ICON_PATHS[iconName]) nodes[i].innerHTML = iconSvg(iconName);
	}
}

function applySectionMeta() {
	for (var i = 0; i < SECTIONS.length; i++) {
		var section = SECTIONS[i];
		var sectionEl = el('sec-' + section.id);
		if (!sectionEl) continue;
		var iconEl = sectionEl.querySelector('.cp-section-icon');
		if (iconEl) iconEl.innerHTML = iconSvg(section.icon);
		var titleEl = sectionEl.querySelector('.cp-section-title');
		if (titleEl) titleEl.textContent = section.title;
		var descEl = sectionEl.querySelector('.cp-section-desc');
		if (descEl) descEl.textContent = section.desc;
		var headerEl = sectionEl.querySelector('.cp-section-header');
		if (!headerEl) continue;
		var stateEl = headerEl.querySelector('.cp-section-state');
		if (!stateEl) {
			stateEl = document.createElement('div');
			stateEl.className = 'cp-section-state';
			stateEl.id = 'cp-state-' + section.id;
			var badgeEl = headerEl.querySelector('.cp-section-badge');
			if (badgeEl) headerEl.insertBefore(stateEl, badgeEl);
			else headerEl.appendChild(stateEl);
		}
		if (!headerEl.querySelector('.cp-section-add')) {
			var addFieldButton = document.createElement('button');
			addFieldButton.type = 'button';
			addFieldButton.className = 'cp-btn cp-btn-icon cp-section-add';
			addFieldButton.setAttribute('data-custom-add', section.id);
			addFieldButton.title = 'Add a custom field to this section';
			addFieldButton.setAttribute('aria-label', 'Add a custom field to this section');
			addFieldButton.innerHTML = iconSvg('plus');
			headerEl.insertBefore(addFieldButton, stateEl);
		}
	}
}

function renderIndustryOptions() {
	var select = el('f-profile-industry');
	if (!select) return;
	var html = '<option value="">Select an industry</option>';
	for (var i = 0; i < INDUSTRIES.length; i++) {
		html += '<option value="' + INDUSTRIES[i].id + '">' + esc(INDUSTRIES[i].label) + '</option>';
	}
	select.innerHTML = html;
}

/* ── App-level controls ── */
function wireAppControls() {
	var app = el('app');
	if (!app) return;

	app.addEventListener('click', function(e) {
		var focusChip = e.target.closest('[data-focus]');
		if (focusChip) {
			if (!isReadOnly) toggleFocusArea(focusChip.getAttribute('data-focus'));
			return;
		}
		if (e.target.closest('#cp-scope-toggle')) {
			if (!isReadOnly) toggleShowAllSections();
			return;
		}
		var templateChip = e.target.closest('[data-template]');
		if (templateChip) {
			if (!isReadOnly) applyTemplate(templateChip.getAttribute('data-template'));
			return;
		}
		if (e.target.closest('[data-apply-preset]')) {
			if (isReadOnly) return;
			applyIndustryPreset(true);
			saveDB();
			renderProfileSetup();
			buildNav();
			syncSectionVisibility();
			updateCompletion();
			if (tool.notify) tool.notify('Suggested sections applied', 'info');
			return;
		}
		var statementEdit = e.target.closest('[data-stmt-edit]');
		if (statementEdit) {
			if (!isReadOnly) openStatementEditor(statementEdit.getAttribute('data-stmt-edit'));
			return;
		}
		var statementSave = e.target.closest('[data-stmt-save]');
		if (statementSave) {
			if (!isReadOnly) saveStatementEditor(statementSave.getAttribute('data-stmt-save'));
			return;
		}
		var statementCancel = e.target.closest('[data-stmt-cancel]');
		if (statementCancel) { cancelStatementEditor(); return; }
		var customAdd = e.target.closest('[data-custom-add]');
		if (customAdd) {
			if (!isReadOnly) addCustomField(customAdd.getAttribute('data-custom-add'));
			return;
		}
		var customRemove = e.target.closest('[data-custom-remove]');
		if (customRemove) {
			if (!isReadOnly) removeCustomField(customRemove.getAttribute('data-custom-owner'), customRemove.getAttribute('data-custom-remove'));
			return;
		}
		var customEdit = e.target.closest('[data-custom-edit]');
		if (customEdit) {
			if (!isReadOnly) openCustomSectionModal(customEdit.getAttribute('data-custom-edit'));
			return;
		}
		if (e.target.closest('#cp-add-custom-section')) {
			if (!isReadOnly) openCustomSectionModal(null);
			return;
		}
		var invoiceAction = e.target.closest('[data-invoice-action]');
		if (invoiceAction) {
			if (isReadOnly) return;
			var invoiceActionName = invoiceAction.getAttribute('data-invoice-action');
			if (invoiceActionName === 'upload') uploadInvoiceLogo();
			else if (invoiceActionName === 'remove') removeInvoiceLogo();
			return;
		}
		var gotoButton = e.target.closest('[data-goto-section]');
		if (gotoButton) { switchToSection(gotoButton.getAttribute('data-goto-section')); return; }
		var stepButton = e.target.closest('[data-nav-step]');
		if (stepButton) { navigateSection(parseInt(stepButton.getAttribute('data-nav-step'), 10) || 1); return; }
		var navItem = e.target.closest('[data-nav]');
		if (navItem) { switchToSection(navItem.getAttribute('data-nav')); }
	});

	app.addEventListener('input', function(e) {
		var customProp = e.target.closest('[data-custom-prop]');
		if (customProp && customProp.getAttribute('data-custom-prop') !== 'type') {
			updateCustomFieldProp(customProp);
		}
		if (e.target.id === 'cp-stmt-input') {
			var countEl = el('cp-stmt-count');
			if (countEl) countEl.textContent = statementWordCountLabel(e.target.value);
		}
	});

	app.addEventListener('change', function(e) {
		var customType = e.target.closest('[data-custom-prop="type"]');
		if (customType) {
			updateCustomFieldProp(customType);
		}
		if (e.target.id === 'f-invoice-logo-url' && !isReadOnly) {
			DB.invoicing.logoUrl = e.target.value.trim().slice(0, 500);
			DB.invoicing.logoName = DB.invoicing.logoUrl ? 'Logo from link' : '';
			saveDB();
			renderInvoicing();
		}
	});

	var modalBody = el('cp-modal-body');
	if (modalBody) {
		modalBody.addEventListener('click', function(e) {
			var deleteButton = e.target.closest('[data-custom-section-delete]');
			if (!deleteButton) return;
			if (deleteButton.getAttribute('data-armed') !== '1') {
				deleteButton.setAttribute('data-armed', '1');
				deleteButton.textContent = 'Click again to delete this section';
				return;
			}
			var sectionId = deleteButton.getAttribute('data-custom-section-delete');
			modalCb = null;
			closeModal();
			deleteCustomSection(sectionId);
		});
	}

	var themeButton = el('cp-theme-toggle');
	if (themeButton) {
		themeButton.addEventListener('click', function() {
			el('app').classList.toggle('cp-dark');
			updateThemeToggleIcon();
		});
	}
}

function updateThemeToggleIcon() {
	var button = el('cp-theme-toggle');
	if (!button) return;
	var isDark = el('app').classList.contains('cp-dark');
	button.innerHTML = iconSvg(isDark ? 'sun' : 'moon');
	button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
}

/* ── Navigation ── */
function buildNav() {
	var nav = el('cp-nav');
	if (!nav) return;
	var html = '';
	var lastGroup = '';
	for (var i = 0; i < SECTIONS.length; i++) {
		var section = SECTIONS[i];
		if (!isSectionVisible(section.id)) continue;
		if (section.group !== lastGroup) {
			html += '<div class="cp-nav-group">' + esc(section.group) + '</div>';
			lastGroup = section.group;
		}
		var trailing = '';
		var itemCount = section.count ? section.count() : 0;
		if (itemCount > 0) {
			trailing = '<span class="cp-nav-badge">' + itemCount + '</span>';
		} else if (sectionProgress(section.id).complete) {
			trailing = '<span class="cp-nav-done">' + iconSvg('check') + '</span>';
		}
		html += '<button type="button" class="cp-nav-item' + (currentSection === section.id ? ' active' : '') + '" data-nav="' + section.id + '">' +
			'<span class="cp-nav-icon">' + iconSvg(section.icon) + '</span>' +
			'<span class="cp-nav-label">' + esc(section.navLabel || section.title) + '</span>' + trailing +
			'</button>';
	}
	html = appendCustomNavItems(html);
	nav.innerHTML = html;
	updateScopeControls();
}
function appendCustomNavItems(html) {
	var customSections = (DB.profile && DB.profile.customSections) || [];
	if (!customSections.length) return html;
	html += '<div class="cp-nav-group">Custom sections</div>';
	for (var i = 0; i < customSections.length; i++) {
		var custom = customSections[i];
		var customId = 'custom-' + custom.id;
		var fieldCount = (custom.fields || []).length;
		html += '<button type="button" class="cp-nav-item' + (currentSection === customId ? ' active' : '') + '" data-nav="' + customId + '">' +
			'<span class="cp-nav-icon">' + iconSvg('spark') + '</span>' +
			'<span class="cp-nav-label">' + esc(custom.title) + '</span>' +
			(fieldCount ? '<span class="cp-nav-badge">' + fieldCount + '</span>' : '') +
			'</button>';
	}
	return html;
}

function visibleSectionList() {
	var list = [];
	for (var i = 0; i < SECTIONS.length; i++) {
		if (isSectionVisible(SECTIONS[i].id)) list.push(SECTIONS[i].id);
	}
	var customSections = (DB.profile && DB.profile.customSections) || [];
	for (var j = 0; j < customSections.length; j++) list.push('custom-' + customSections[j].id);
	return list;
}

function syncSectionVisibility() {
	for (var i = 0; i < SECTIONS.length; i++) {
		var sectionEl = el('sec-' + SECTIONS[i].id);
		if (!sectionEl) continue;
		sectionEl.style.display = isSectionVisible(SECTIONS[i].id) ? '' : 'none';
	}
	if (!currentSection || !isSectionVisible(currentSection)) {
		var list = visibleSectionList();
		if (list.length) switchToSection(list[0]);
	}
	renderPager();
}

function updateScopeControls() {
	var profileHidden = 0;
	var configHidden = 0;
	for (var i = 0; i < SECTIONS.length; i++) {
		var section = SECTIONS[i];
		if (visibleSections && !visibleSections.has(section.id)) { configHidden++; continue; }
		if (!sectionMatchesProfile(section.id)) profileHidden++;
	}
	var note = el('cp-hidden-note');
	if (note) {
		if (!profileHidden) {
			note.textContent = configHidden ? configHidden + ' sections hidden by configuration' : 'All sections match this profile';
		} else if (DB.profile.showAllSections) {
			note.textContent = profileHidden + ' sections hidden by this profile - currently showing all';
		} else {
			note.textContent = profileHidden + (profileHidden === 1 ? ' section hidden' : ' sections hidden') + ' by this profile';
		}
	}
	var toggle = el('cp-scope-toggle');
	if (toggle) toggle.textContent = DB.profile.showAllSections ? 'Hide sections not needed' : 'Show all sections';

	var industry = industryLabel(DB.industryOps.primaryIndustry);
	var chipValue = el('cp-profile-chip-value');
	var chipSub = el('cp-profile-chip-sub');
	var focusCount = profileFocusSet().size;
	if (chipValue) chipValue.textContent = industry || 'Not set';
	if (chipSub) {
		chipSub.textContent = industry
			? (focusCount + (focusCount === 1 ? ' area covered' : ' areas covered'))
			: 'Choose an industry in Basic Information';
	}
}

function sectionTitleById(sectionId) {
	if (sectionId.indexOf('custom-') === 0) {
		var customSection = findCustomSection(sectionId.slice(7));
		return customSection ? customSection.title : 'Section';
	}
	var section = sectionById(sectionId);
	return section ? section.title : 'Section';
}

function renderPager() {
	var pager = el('cp-pager');
	if (!pager) return;
	var list = visibleSectionList();
	if (list.length < 2) { pager.innerHTML = ''; return; }
	var index = list.indexOf(currentSection);
	if (index === -1) index = 0;
	var previousTitle = sectionTitleById(list[(index - 1 + list.length) % list.length]);
	var nextTitle = sectionTitleById(list[(index + 1) % list.length]);
	pager.innerHTML =
		'<button type="button" class="cp-pager-btn" data-nav-step="-1">' + iconSvg('chevronLeft') +
			'<span class="cp-pager-text"><span class="cp-pager-eyebrow">Previous</span><strong>' + esc(previousTitle) + '</strong></span></button>' +
		'<span class="cp-pager-count">' + (index + 1) + ' / ' + list.length + '</span>' +
		'<button type="button" class="cp-pager-btn cp-pager-next" data-nav-step="1">' +
			'<span class="cp-pager-text"><span class="cp-pager-eyebrow">Next</span><strong>' + esc(nextTitle) + '</strong></span>' + iconSvg('chevronRight') + '</button>';
}

/* ── Lock / Read-only ── */
function lockUI(ro) {
	var app = el('app');
	if (ro) { app.classList.add('cp-readonly'); }
	else { app.classList.remove('cp-readonly'); }
}

/* ── Navigation ── */
function switchToSection(sectionId) {
	if (!isSectionVisible(sectionId)) return;
	if (editingStatementKey && sectionId !== 'mission') editingStatementKey = null;
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
	renderPager();
	// Render the target section (ensure it has fresh data)
	renderSection(sectionId);
	tool.resize();
}

function renderSection(sectionId) {
	if (sectionId.indexOf('custom-') === 0) {
		var customSection = findCustomSection(sectionId.slice(7));
		if (customSection) renderOneCustomSection(customSection);
		return;
	}
	switch (sectionId) {
		case 'basic': renderBasicInfo(); break;
		case 'mission': renderMission(); break;
		case 'taxes': renderTaxes(); break;
		case 'headquarters': renderHeadquarters(); break;
		case 'offices': renderOffices(); break;
		case 'billing': renderBilling(); break;
		case 'invoicing': renderInvoicing(); break;
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
	renderInvoicing();
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
	renderCustomFieldBlocks();
	renderCustomSections();

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
	setVal('f-profile-industry', DB.industryOps.primaryIndustry);
	setVal('f-companyType', b.companyType);
	setVal('f-yearEstablished', b.yearEstablished);
	setVal('f-numEmployees', b.numEmployees);
	setVal('f-businessNumber', b.businessNumber);
	renderProfileSetup();
}

function readBasicInfo() {
	var b = DB.basicInfo;
	b.legalName = val('f-legalName');
	b.tradeName = val('f-tradeName');
	DB.industryOps.primaryIndustry = val('f-profile-industry');
	b.companyType = val('f-companyType');
	b.yearEstablished = val('f-yearEstablished');
	b.numEmployees = val('f-numEmployees');
	b.businessNumber = val('f-businessNumber');
}

function renderProfileSetup() {
	if (!DB.profile) DB.profile = { focus: [], presetFocus: [], showAllSections: false, updatedAt: '', initialized: true, templateId: '', customFields: {}, customSections: [] };
	renderTemplateChips();
	var focus = profileFocusSet();
	var grid = el('cp-focus-grid');
	if (grid) {
		var html = '';
		for (var i = 0; i < PROFILE_FOCUS_AREAS.length; i++) {
			var area = PROFILE_FOCUS_AREAS[i];
			var selected = focus.has(area.id);
			html += '<button type="button" class="cp-focus-chip" data-focus="' + area.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
				'<span class="cp-focus-box">' + iconSvg('check') + '</span>' +
				'<span class="cp-focus-text">' +
					'<span class="cp-focus-label">' + esc(area.label) + '</span>' +
					'<span class="cp-focus-desc">' + esc(area.desc) + '</span>' +
				'</span></button>';
		}
		grid.innerHTML = html;
	}

	var industry = industryLabel(DB.industryOps.primaryIndustry);
	var hint = el('cp-focus-hint');
	if (hint) hint.textContent = industry ? ('Suggested for ' + industry) : 'Pick an industry for suggestions';

	var note = el('cp-profile-note');
	if (note) {
		if (!profileIsConfigured()) {
			note.innerHTML = 'Nothing is hidden yet - every section is shown until an industry or area is chosen.';
		} else if (DB.profile.showAllSections) {
			note.innerHTML = 'All sections are shown. Hiding a section never deletes its data.';
		} else if (!focusMatchesPreset()) {
			note.innerHTML = 'Your selection differs from the ' + esc(industry || 'industry') + ' suggestion. ' +
				'<button type="button" class="cp-linkbtn" data-apply-preset>Use the suggested set</button>';
		} else {
			note.innerHTML = 'Only the sections that matter for these choices appear in the sidebar. Change this at any time.';
		}
	}

	var industrySelect = el('f-profile-industry');
	if (industrySelect && industrySelect.value !== DB.industryOps.primaryIndustry) {
		industrySelect.value = DB.industryOps.primaryIndustry || '';
	}
	updateIndustryReadout();
	updateScopeControls();
}

function updateIndustryReadout() {
	var readout = el('cp-industry-readout');
	if (readout) readout.textContent = industryLabel(DB.industryOps.primaryIndustry) || 'Not set';
}

/* ── Brand & positioning (statement cards) ── */
function renderMission() {
	var grid = el('cp-stmts');
	if (!grid) return;
	var html = '';
	for (var i = 0; i < STATEMENTS.length; i++) {
		var statement = STATEMENTS[i];
		var value = (DB.mission && DB.mission[statement.key]) || '';
		var isEditing = editingStatementKey === statement.key;
		html += '<article class="cp-stmt-card' + (statement.wide ? ' cp-stmt-wide' : '') + (isEditing ? ' editing' : '') + '">' +
			'<header class="cp-stmt-head">' +
				'<span class="cp-stmt-icon">' + iconSvg(statement.icon) + '</span>' +
				'<span class="cp-stmt-titles">' +
					'<span class="cp-stmt-label">' + esc(statement.label) + '</span>' +
					'<span class="cp-stmt-hint">' + esc(statement.hint) + '</span>' +
				'</span>' +
				(isEditing ? '' : '<button type="button" class="cp-stmt-edit" data-stmt-edit="' + statement.key + '">' + (value ? 'Edit' : 'Add') + '</button>') +
			'</header>';
		if (isEditing) {
			html += '<div class="cp-stmt-editor">' +
				'<textarea class="cp-input cp-textarea cp-stmt-input" id="cp-stmt-input" rows="' + (statement.wide ? 5 : 4) + '" placeholder="' + esc(statement.hint) + '">' + esc(value) + '</textarea>' +
				'<div class="cp-stmt-foot">' +
					'<span class="cp-stmt-count" id="cp-stmt-count">' + statementWordCountLabel(value) + '</span>' +
					'<button type="button" class="cp-btn cp-btn-sm" data-stmt-cancel="' + statement.key + '">Cancel</button>' +
					'<button type="button" class="cp-btn cp-btn-sm cp-btn-primary" data-stmt-save="' + statement.key + '">Save</button>' +
				'</div>' +
			'</div>';
		} else {
			html += '<p class="cp-stmt-text' + (value ? '' : ' empty') + '">' + (value ? esc(value) : 'Not added yet') + '</p>';
		}
		html += '</article>';
	}
	grid.innerHTML = html;
	var input = el('cp-stmt-input');
	if (input) {
		input.focus();
		input.setSelectionRange(input.value.length, input.value.length);
	}
}

function statementWordCountLabel(text) {
	var trimmed = String(text || '').trim();
	if (!trimmed) return '0 words';
	var count = trimmed.split(/\s+/).length;
	return count + (count === 1 ? ' word' : ' words');
}

function readMission() {
	// Statements are written straight into DB by the card editor.
}

function openStatementEditor(statementKey) {
	if (editingStatementKey && editingStatementKey !== statementKey) {
		saveStatementEditor(editingStatementKey, true);
	}
	editingStatementKey = statementKey;
	renderMission();
}

function saveStatementEditor(statementKey, silent) {
	var input = el('cp-stmt-input');
	if (!input) { editingStatementKey = null; return; }
	DB.mission[statementKey] = input.value.replace(/\s+$/, '');
	DB.profile.updatedAt = new Date().toISOString();
	editingStatementKey = null;
	renderMission();
	saveDB();
	updateCompletion();
	if (silent !== true && tool.notify) tool.notify('Saved', 'success');
}

function cancelStatementEditor() {
	editingStatementKey = null;
	renderMission();
}

/* ── Starting templates ── */
function renderTemplateChips() {
	var row = el('cp-template-chips');
	if (!row) return;
	var html = '';
	for (var i = 0; i < PROFILE_TEMPLATES.length; i++) {
		var template = PROFILE_TEMPLATES[i];
		html += '<button type="button" class="cp-template-chip' + (DB.profile.templateId === template.id ? ' is-active' : '') + '" data-template="' + template.id + '" title="' + esc(template.desc) + '">' + esc(template.label) + '</button>';
	}
	row.innerHTML = html;
}

function applyTemplate(templateId) {
	var template = null;
	for (var i = 0; i < PROFILE_TEMPLATES.length; i++) {
		if (PROFILE_TEMPLATES[i].id === templateId) template = PROFILE_TEMPLATES[i];
	}
	if (!template) return;
	DB.industryOps.primaryIndustry = template.industry;
	DB.profile.focus = template.focus.slice();
	DB.profile.presetFocus = template.focus.slice();
	DB.profile.templateId = template.id;
	DB.profile.showAllSections = false;
	DB.profile.initialized = true;
	DB.profile.updatedAt = new Date().toISOString();
	saveDB();
	renderBasicInfo();
	renderIndustry();
	buildNav();
	syncSectionVisibility();
	updateCompletion();
	if (tool.notify) tool.notify('Template applied: ' + template.label, 'success');
}

/* ── Custom fields inside the built-in sections ── */
function renderCustomFieldBlocks() {
	for (var i = 0; i < SECTIONS.length; i++) {
		var section = SECTIONS[i];
		var sectionEl = el('sec-' + section.id);
		if (!sectionEl) continue;
		var body = sectionEl.querySelector('.cp-section-body');
		var blockId = 'cp-custom-block-' + section.id;
		var existing = el(blockId);
		if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
		var fields = (DB.profile.customFields && DB.profile.customFields[section.id]) || [];
		if (!fields.length || !body) continue;
		var block = document.createElement('div');
		block.className = 'cp-custom-block';
		block.id = blockId;
		block.innerHTML = '<div class="cp-custom-head">' +
			'<span class="cp-custom-title">Additional details</span>' +
			'<span class="cp-custom-note">Extra fields for this profile</span>' +
			'</div>' + customFieldRowsHtml(section.id, fields);
		body.appendChild(block);
	}
}

function customFieldRowsHtml(owner, fields) {
	var html = '<div class="cp-custom-row cp-custom-row-head" aria-hidden="true">' +
		'<span>Field name</span><span>Type</span><span>Value</span><span></span>' +
		'</div>';
	for (var i = 0; i < fields.length; i++) html += customFieldRowHtml(owner, fields[i]);
	return html;
}

function customFieldRowHtml(owner, field) {
	var typeOptions = '';
	for (var i = 0; i < CUSTOM_FIELD_TYPES.length; i++) {
		var type = CUSTOM_FIELD_TYPES[i];
		typeOptions += '<option value="' + type.id + '"' + (type.id === field.type ? ' selected' : '') + '>' + esc(type.label) + '</option>';
	}
	var fieldAttrs = ' data-custom-owner="' + esc(owner) + '" data-custom-id="' + esc(field.id) + '"';
	var valueControl;
	if (field.type === 'textarea') {
		valueControl = '<textarea class="cp-input cp-textarea cp-custom-value" rows="2"' + fieldAttrs + ' data-custom-prop="value">' + esc(field.value) + '</textarea>';
	} else {
		var inputType = field.type === 'date' ? 'date' : (field.type === 'url' ? 'url' : (field.type === 'email' ? 'email' : 'text'));
		var inputMode = field.type === 'number' ? ' inputmode="decimal"' : '';
		valueControl = '<input type="' + inputType + '"' + inputMode + ' class="cp-input cp-custom-value"' + fieldAttrs + ' data-custom-prop="value" value="' + esc(field.value) + '" placeholder="Value">';
	}
	return '<div class="cp-custom-row">' +
		'<input type="text" class="cp-input cp-custom-label"' + fieldAttrs + ' data-custom-prop="label" value="' + esc(field.label) + '" placeholder="Field name">' +
		'<select class="cp-input cp-select cp-custom-type"' + fieldAttrs + ' data-custom-prop="type">' + typeOptions + '</select>' +
		valueControl +
		'<button type="button" class="cp-btn cp-btn-sm cp-btn-danger cp-custom-remove"' + fieldAttrs + ' data-custom-remove="' + esc(field.id) + '" title="Remove field">✕</button>' +
	'</div>';
}

function renderCustomOwner(owner) {
	if (owner.indexOf('custom:') === 0) {
		var customSection = findCustomSection(owner.slice(7));
		if (customSection) renderOneCustomSection(customSection);
	} else {
		renderCustomFieldBlocks();
	}
	updateCustomSectionStates();
}

function addCustomField(owner) {
	var fields = customFieldListFor(owner);
	var field = { id: newId('cf'), label: '', type: 'text', value: '' };
	fields.push(field);
	DB.profile.updatedAt = new Date().toISOString();
	renderCustomOwner(owner);
	buildNav();
	saveDB();
	var labelInput = document.querySelector('[data-custom-owner="' + owner + '"][data-custom-id="' + field.id + '"][data-custom-prop="label"]');
	if (labelInput) labelInput.focus();
}

function removeCustomField(owner, fieldId) {
	var fields = customFieldListFor(owner);
	for (var i = 0; i < fields.length; i++) {
		if (fields[i].id === fieldId) { fields.splice(i, 1); break; }
	}
	DB.profile.updatedAt = new Date().toISOString();
	renderCustomOwner(owner);
	buildNav();
	saveDB();
	updateCompletion();
}

function updateCustomFieldProp(control) {
	var owner = control.getAttribute('data-custom-owner');
	var fieldId = control.getAttribute('data-custom-id');
	var prop = control.getAttribute('data-custom-prop');
	var fields = customFieldListFor(owner);
	var field = null;
	for (var i = 0; i < fields.length; i++) {
		if (fields[i].id === fieldId) field = fields[i];
	}
	if (!field) return;
	field[prop] = control.value;
	DB.profile.updatedAt = new Date().toISOString();
	saveDB();
	updateCustomSectionStates();
	updateCompletion();
	if (prop === 'type') {
		renderCustomOwner(owner);
		buildNav();
	}
}

/* ── User-defined custom sections ── */
function ensureCustomSectionElements() {
	var main = el('cp-main');
	var pager = el('cp-pager');
	if (!main) return;
	var customSections = (DB.profile && DB.profile.customSections) || [];
	var wanted = {};
	for (var i = 0; i < customSections.length; i++) {
		var elementId = 'sec-custom-' + customSections[i].id;
		wanted[elementId] = true;
		if (!el(elementId)) {
			var sectionEl = document.createElement('section');
			sectionEl.className = 'cp-section';
			sectionEl.id = elementId;
			sectionEl.setAttribute('data-section', 'custom-' + customSections[i].id);
			sectionEl.setAttribute('data-custom-section', customSections[i].id);
			if (pager && pager.parentNode === main) main.insertBefore(sectionEl, pager);
			else main.appendChild(sectionEl);
		}
	}
	var existingSections = document.querySelectorAll('[data-custom-section]');
	for (var j = 0; j < existingSections.length; j++) {
		if (!wanted[existingSections[j].id]) existingSections[j].parentNode.removeChild(existingSections[j]);
	}
}

function renderCustomSections() {
	ensureCustomSectionElements();
	var customSections = (DB.profile && DB.profile.customSections) || [];
	for (var i = 0; i < customSections.length; i++) renderOneCustomSection(customSections[i]);
	updateCustomSectionStates();
}

function renderOneCustomSection(section) {
	var sectionEl = el('sec-custom-' + section.id);
	if (!sectionEl) return;
	var fields = section.fields || [];
	sectionEl.innerHTML =
		'<div class="cp-section-header">' +
			'<div class="cp-section-icon">' + iconSvg('spark') + '</div>' +
			'<div class="cp-section-title-group">' +
				'<h2 class="cp-section-title">' + esc(section.title) + '</h2>' +
				'<p class="cp-section-desc">' + esc(section.description || 'Custom section for this profile') + '</p>' +
			'</div>' +
			'<div class="cp-section-state" id="cp-state-custom-' + esc(section.id) + '"></div>' +
			'<button type="button" class="cp-btn cp-btn-icon cp-section-edit" data-custom-edit="' + esc(section.id) + '" title="Edit this section" aria-label="Edit this section">' + iconSvg('pencil') + '</button>' +
		'</div>' +
		'<div class="cp-section-body">' +
			(fields.length
				? '<div class="cp-custom-rows">' + customFieldRowsHtml('custom:' + section.id, fields) + '</div>'
				: '<div class="cp-array-item-empty">No fields yet. Add the first field, then fill it in.</div>') +
			'<button type="button" class="cp-btn cp-btn-add" data-custom-add="custom:' + esc(section.id) + '">Add field</button>' +
		'</div>';
	updateCustomSectionStates();
}

function updateCustomSectionStates() {
	var customSections = (DB.profile && DB.profile.customSections) || [];
	for (var i = 0; i < customSections.length; i++) {
		var section = customSections[i];
		var fields = section.fields || [];
		var filled = 0;
		for (var j = 0; j < fields.length; j++) {
			if (String(fields[j].value || '').trim()) filled++;
		}
		var stateEl = el('cp-state-custom-' + section.id);
		if (stateEl) {
			stateEl.textContent = fields.length ? (filled + ' of ' + fields.length) : 'Empty';
			stateEl.className = 'cp-section-state' + (fields.length && filled === fields.length ? ' complete' : '');
		}
	}
}

function openCustomSectionModal(sectionId) {
	var section = sectionId ? findCustomSection(sectionId) : null;
	el('cp-modal-title').textContent = section ? 'Edit custom section' : 'New custom section';
	el('cp-modal-body').innerHTML =
		'<div class="cp-field">' +
			'<label class="cp-label" for="cp-custom-title">Section title</label>' +
			'<input class="cp-input" id="cp-custom-title" maxlength="80" placeholder="e.g. Safety statistics" value="' + esc(section ? section.title : '') + '">' +
		'</div>' +
		'<div class="cp-field" style="margin-top:14px">' +
			'<label class="cp-label" for="cp-custom-desc">Short description <span class="cp-hint">(optional)</span></label>' +
			'<input class="cp-input" id="cp-custom-desc" maxlength="300" placeholder="What this section collects" value="' + esc(section ? section.description : '') + '">' +
		'</div>' +
		(section ? '<div class="cp-modal-danger"><button type="button" class="cp-btn cp-btn-sm cp-btn-danger" data-custom-section-delete="' + esc(section.id) + '">Delete this section</button></div>' : '');
	modalCb = function() {
		var title = val('cp-custom-title').trim();
		if (!title) {
			if (tool.notify) tool.notify('Give the section a title', 'warning');
			var titleInput = el('cp-custom-title');
			if (titleInput) titleInput.focus();
			return false;
		}
		var createdSectionId = null;
		if (section) {
			section.title = title.slice(0, 80);
			section.description = val('cp-custom-desc').trim().slice(0, 300);
		} else {
			var newSection = { id: newId('cs'), title: title.slice(0, 80), description: val('cp-custom-desc').trim().slice(0, 300), fields: [] };
			DB.profile.customSections.push(newSection);
			createdSectionId = newSection.id;
		}
		DB.profile.updatedAt = new Date().toISOString();
		saveDB();
		renderCustomSections();
		buildNav();
		renderPager();
		updateCompletion();
		if (createdSectionId) switchToSection('custom-' + createdSectionId);
		return true;
	};
	el('cp-modal-overlay').classList.add('open');
	var titleField = el('cp-custom-title');
	if (titleField) titleField.focus();
}

function deleteCustomSection(sectionId) {
	var customSections = DB.profile.customSections || [];
	for (var i = 0; i < customSections.length; i++) {
		if (customSections[i].id === sectionId) { customSections.splice(i, 1); break; }
	}
	if (currentSection === 'custom-' + sectionId) currentSection = null;
	DB.profile.updatedAt = new Date().toISOString();
	saveDB();
	renderCustomSections();
	buildNav();
	renderPager();
	updateCompletion();
	if (!currentSection || !isSectionVisible(currentSection)) {
		var list = visibleSectionList();
		if (list.length) switchToSection(list[0]);
	}
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

/* ── Invoicing ── */
function renderInvoicing() {
	if (!DB.invoicing) DB.invoicing = { paymentInstructions: '', invoiceFooterNote: '', logoUrl: '', logoName: '' };
	setVal('f-invoice-payment', DB.invoicing.paymentInstructions);
	setVal('f-invoice-footer', DB.invoicing.invoiceFooterNote);
	renderInvoiceSummary();
	renderInvoiceLogoField();
}

function readInvoicing() {
	if (!DB.invoicing) DB.invoicing = { paymentInstructions: '', invoiceFooterNote: '', logoUrl: '', logoName: '' };
	DB.invoicing.paymentInstructions = val('f-invoice-payment');
	DB.invoicing.invoiceFooterNote = val('f-invoice-footer').slice(0, 160);
	var logoUrlInput = el('f-invoice-logo-url');
	if (logoUrlInput) DB.invoicing.logoUrl = logoUrlInput.value.trim().slice(0, 500);
}

function renderInvoiceSummary() {
	var container = el('cp-invoice-summary');
	if (!container) return;
	var legalName = DB.basicInfo.legalName || '';
	var billingEmail = DB.billingAddress.email || '';
	var emailTarget = 'billing';
	if (!billingEmail && DB.headquarters.email) {
		billingEmail = DB.headquarters.email;
		emailTarget = 'headquarters';
	}
	var taxParts = [];
	for (var i = 0; i < (DB.salesTaxDefinitions || []).length; i++) {
		var tax = DB.salesTaxDefinitions[i];
		if (!tax || (!tax.name && !tax.taxNumber)) continue;
		taxParts.push((tax.name || 'Tax') + (tax.taxNumber ? ' ' + tax.taxNumber : ''));
	}
	var rows = [
		{ label: 'Legal name', value: legalName, target: 'basic' },
		{ label: 'Billing email', value: billingEmail, target: emailTarget },
		{ label: 'Tax numbers', value: taxParts.join(', '), target: 'taxes' }
	];
	var html = '<div class="cp-invoice-summary-head">' + iconSvg('receipt') + '<span>What invoices use</span></div>';
	for (var r = 0; r < rows.length; r++) {
		html += '<div class="cp-invoice-summary-row">' +
			'<span class="cp-invoice-summary-label">' + esc(rows[r].label) + '</span>' +
			'<span class="cp-invoice-summary-value' + (rows[r].value ? '' : ' is-empty') + '">' + esc(rows[r].value || 'Not set') + '</span>' +
			'<button type="button" class="cp-linkbtn" data-goto-section="' + rows[r].target + '">Open</button>' +
			'</div>';
	}
	html += '<p class="cp-invoice-summary-note">Read from Basic Information, Billing Address and Sales Tax. Nothing is copied.</p>';
	container.innerHTML = html;
}

function renderInvoiceLogoField() {
	var field = el('cp-invoice-logo-field');
	if (!field) return;
	var logoUrl = DB.invoicing.logoUrl || '';
	var logoName = DB.invoicing.logoName || '';
	var canUpload = typeof tool.requestUpload === 'function';
	var html = '';
	if (logoUrl) {
		html += '<div class="cp-logo-preview" id="cp-invoice-logo-preview">' +
			'<img id="cp-invoice-logo-img" src="' + esc(logoUrl) + '" alt="Invoice logo preview">' +
			'<span class="cp-logo-fallback">Preview unavailable - the image link did not load.</span>' +
			'<span class="cp-logo-meta"><strong>' + esc(logoName || 'Invoice logo') + '</strong><span class="cp-logo-note">Shown at the top of invoices.</span></span>' +
			'</div>';
	}
	html += '<div class="cp-logo-actions">';
	if (canUpload) {
		html += '<button type="button" class="cp-btn cp-btn-sm" data-invoice-action="upload">' + (logoUrl ? 'Replace logo' : 'Upload logo') + '</button>';
	} else {
		html += '<div class="cp-logo-url"><label class="cp-label" for="f-invoice-logo-url">Logo URL</label>' +
			'<input type="url" class="cp-input" id="f-invoice-logo-url" placeholder="https://example.com/logo.png" value="' + esc(logoUrl) + '"></div>';
	}
	if (logoUrl) {
		html += '<button type="button" class="cp-btn cp-btn-sm cp-btn-danger" data-invoice-action="remove">Remove</button>';
	}
	html += '</div>';
	html += '<span class="cp-field-help">PNG, JPG or SVG, up to 1 MB. ' +
		(canUpload ? 'Uploads go to CMS storage; only the link and the file name are saved.' : 'Paste a public image link; only the link is saved.') +
		'</span>';
	field.innerHTML = html;
	var logoImage = el('cp-invoice-logo-img');
	if (logoImage) {
		logoImage.addEventListener('error', function() {
			var preview = el('cp-invoice-logo-preview');
			if (preview) preview.classList.add('is-broken');
		});
	}
}

function uploadInvoiceLogo() {
	if (typeof tool.requestUpload !== 'function') {
		if (tool.notify) tool.notify('Uploads are not enabled - set allowUpload: yes in the field settings.', 'warning');
		return;
	}
	tool.requestUpload('.png,.jpg,.jpeg,.svg', function(uploadError, uploadedFile) {
		if (uploadError) {
			if (tool.notify) tool.notify('Logo upload failed: ' + uploadError, 'error');
			return;
		}
		if (!uploadedFile || !uploadedFile.url) {
			if (tool.notify) tool.notify('No logo file selected.', 'warning');
			return;
		}
		if (uploadedFile.size && uploadedFile.size > INVOICE_LOGO_MAX_BYTES) {
			if (tool.notify) tool.notify('The logo must be 1 MB or smaller.', 'warning');
			return;
		}
		if (!isAllowedInvoiceLogo(uploadedFile)) {
			if (tool.notify) tool.notify('Use a PNG, JPG or SVG image.', 'warning');
			return;
		}
		DB.invoicing.logoUrl = uploadedFile.url;
		DB.invoicing.logoName = String(uploadedFile.name || '').slice(0, 160);
		saveDB();
		renderInvoicing();
		if (tool.notify) tool.notify('Invoice logo saved.', 'success');
	});
}

function isAllowedInvoiceLogo(uploadedFile) {
	var fileType = String(uploadedFile.type || '').toLowerCase();
	if (fileType) {
		return fileType === 'image/png' || fileType === 'image/jpeg' || fileType === 'image/svg+xml';
	}
	var fileName = String(uploadedFile.name || '').toLowerCase();
	return /\.(png|jpe?g|svg)$/.test(fileName);
}

function removeInvoiceLogo() {
	DB.invoicing.logoUrl = '';
	DB.invoicing.logoName = '';
	saveDB();
	renderInvoicing();
	if (tool.notify) tool.notify('Invoice logo removed.', 'info');
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
	setVal('f-industry-sub', o.subIndustries);
	setVal('f-industry-specializations', o.specializations);
	setVal('f-unspsc', o.unscspCodes);
	setVal('f-naics', o.naicsCodes);
	setVal('f-otherkeywords', o.otherKeywords);
	updateIndustryReadout();
	renderCapabilities();
}
function readIndustry() {
	var o = DB.industryOps;
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
function sectionProgress(sectionId) {
	var done = 0;
	var total = 0;
	function need(value) { total++; if (value && String(value).trim()) done++; }
	function needList(list) { total++; if (list && list.length > 0) done++; }

	switch (sectionId) {
		case 'basic':
			need(DB.basicInfo.legalName);
			need(DB.industryOps.primaryIndustry);
			need(DB.basicInfo.companyType);
			break;
		case 'mission':
			need(DB.mission.mission);
			need(DB.mission.about);
			break;
		case 'industry':
			need(DB.industryOps.subIndustries);
			needList(DB.industryOps.capabilities);
			break;
		case 'headquarters':
			need(DB.headquarters.address);
			need(DB.headquarters.city);
			need(DB.headquarters.country);
			need(DB.headquarters.email);
			break;
		case 'offices':
			needList(DB.otherOffices);
			break;
		case 'billing':
			if (DB.billingAddress.sameAsHQ !== false) {
				need(DB.headquarters.address || DB.headquarters.email);
			} else {
				need(DB.billingAddress.address);
				need(DB.billingAddress.email);
			}
			break;
		case 'geographic':
			need(DB.geographicCoverage.countries);
			need(DB.geographicCoverage.cities);
			break;
		case 'contacts':
			need(DB.contacts.primary.name);
			need(DB.contacts.primary.email);
			break;
		case 'weblinks':
			need(DB.weblinks.website);
			need(DB.weblinks.email);
			break;
		case 'taxes':
			needList(DB.salesTaxDefinitions);
			break;
		case 'invoicing':
			// Optional section: it never blocks profile completeness.
			break;
		case 'financials':
			needList(DB.financials.annualRevenues);
			need(DB.financials.currentAssets);
			break;
		case 'documents':
			needList(DB.documents.certificates);
			break;
		case 'refletters':
			needList(DB.referenceLetters);
			break;
		case 'assets-owned':
			needList(DB.assets.owned);
			break;
		case 'assets-partner':
			needList(DB.assets.partnerAccessible);
			break;
		case 'hr':
			needList(DB.humanResources.staffCapabilities);
			break;
		case 'projects':
			needList(DB.referenceProjects);
			break;
	}
	return { done: done, total: total, complete: total > 0 && done === total };
}

function updateCompletion() {
	var totalSections = 0;
	var completeSections = 0;
	for (var i = 0; i < SECTIONS.length; i++) {
		var section = SECTIONS[i];
		var progress = sectionProgress(section.id);
		var stateEl = el('cp-state-' + section.id);
		if (stateEl) {
			if (progress.total === 0) {
				stateEl.textContent = 'Optional';
				stateEl.className = 'cp-section-state optional';
			} else {
				stateEl.textContent = progress.complete ? 'Complete' : (progress.done + ' of ' + progress.total);
				stateEl.className = 'cp-section-state' + (progress.complete ? ' complete' : '');
			}
		}
		if (!isSectionVisible(section.id)) continue;
		if (progress.total === 0) continue;
		totalSections++;
		if (progress.complete) completeSections++;
	}
	var customSections = (DB.profile && DB.profile.customSections) || [];
	for (var c = 0; c < customSections.length; c++) {
		var customSection = customSections[c];
		var customFields = customSection.fields || [];
		var filledFields = 0;
		for (var f = 0; f < customFields.length; f++) {
			if (String(customFields[f].value || '').trim()) filledFields++;
		}
		totalSections++;
		if (customFields.length && filledFields === customFields.length) completeSections++;
	}
	var pct = totalSections ? Math.round((completeSections / totalSections) * 100) : 0;
	var ring = el('cp-completion-ring');
	if (ring) ring.style.background = 'conic-gradient(var(--cp-accent) ' + pct + '%, var(--cp-line) ' + pct + '%)';
	var pctEl = el('cp-completion-pct');
	if (pctEl) pctEl.textContent = pct + '%';
	var countEl = el('cp-completion-count');
	if (countEl) countEl.textContent = completeSections + ' of ' + totalSections;
}

function updateHeaderName() {
	var nameEl = el('cp-org-name-display');
	var name = DB.basicInfo.legalName || DB.basicInfo.tradeName || 'Untitled company';
	if (nameEl) nameEl.textContent = name;
}

function updateBadges() {
	var counts = {
		'taxes': DB.salesTaxDefinitions.length,
		'offices': DB.otherOffices.length,
		'documents': (DB.documents.certificates || []).length,
		'refletters': (DB.referenceLetters || []).length,
		'assets-owned': (DB.assets.owned || []).length,
		'assets-partner': (DB.assets.partnerAccessible || []).length,
		'hr': (DB.humanResources.staffCapabilities || []).length,
		'projects': (DB.referenceProjects || []).length,
		'capabilities': (DB.industryOps.capabilities || []).length,
		'contacts': (DB.contacts.others || []).length,
		'revenues': (DB.financials.annualRevenues || []).length,
		'othersocial': (DB.weblinks.otherSocials || []).length,
		'otherweb': (DB.weblinks.otherWebSources || []).length
	};
	Object.keys(counts).forEach(function(key) {
		var countEl = document.getElementById('cp-' + key + '-count');
		if (countEl) countEl.textContent = counts[key] ? String(counts[key]) : '';
	});
	buildNav();
	updateCompletion();
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

	// Industry change re-applies the suggested section set when untouched
	if (target.id === 'f-profile-industry') {
		var previousIndustry = DB.industryOps.primaryIndustry;
		readAllFromDOM();
		DB.profile.templateId = '';
		DB.profile.updatedAt = new Date().toISOString();
		if (previousIndustry !== DB.industryOps.primaryIndustry) {
			var applied = applyIndustryPreset(false);
			if (applied && tool.notify) {
				tool.notify('Sections suggested for ' + industryLabel(DB.industryOps.primaryIndustry), 'info');
			}
		}
		saveDB();
		renderProfileSetup();
		buildNav();
		syncSectionVisibility();
		updateCompletion();
		return;
	}

	// Non-profit and charity profiles usually work with grants
	if (target.id === 'f-companyType') {
		var previousType = DB.basicInfo.companyType;
		readAllFromDOM();
		var newType = DB.basicInfo.companyType;
		if (previousType !== newType && (newType === 'nonprofit' || newType === 'registered-charity')) {
			var currentFocus = profileFocusSet();
			if (!currentFocus.has('grants')) {
				currentFocus.add('grants');
				DB.profile.focus = focusToList(currentFocus);
				renderProfileSetup();
				buildNav();
				syncSectionVisibility();
			}
		}
		saveDB();
		updateCompletion();
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
	readInvoicing();
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
function navigateSection(direction) {
	var visible = visibleSectionList();
	if (visible.length === 0) return;
	var index = visible.indexOf(currentSection);
	if (index === -1) index = 0;
	var newIndex = index + direction;
	if (newIndex < 0) newIndex = visible.length - 1;
	if (newIndex >= visible.length) newIndex = 0;
	switchToSection(visible[newIndex]);
}

/* ── Declare Output Schema ── */
tool.declareOutput({
	type: 'object',
	description: 'Comprehensive company profile data',
	properties: {
		schemaVersion: { type: 'number' },
		basicInfo: { type: 'object' },
		mission: { type: 'object' },
		salesTaxDefinitions: { type: 'array' },
		headquarters: { type: 'object' },
		otherOffices: { type: 'array' },
		billingAddress: { type: 'object' },
		invoicing: { type: 'object' },
		geographicCoverage: { type: 'object' },
		contacts: { type: 'object' },
		weblinks: { type: 'object' },
		industryOps: { type: 'object' },
		documents: { type: 'object' },
		referenceLetters: { type: 'array' },
		assets: { type: 'object' },
		humanResources: { type: 'object' },
		financials: { type: 'object' },
		referenceProjects: { type: 'array' },
		profile: { type: 'object' }
	}
});

tool.declareParams([
	{ name: 'visibleSections', label: 'Visible Sections', type: 'text', default: 'all', hint: 'Comma-separated section IDs, or "all". Sections can also be narrowed by the profile setup (industry and coverage areas). Options: basic,mission,industry,headquarters,offices,billing,geographic,contacts,weblinks,taxes,financials,documents,refletters,assets-owned,assets-partner,hr,projects' }
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
	if (!modalCb) return;
	var saveResult = modalCb();
	if (saveResult === false) return;
	closeModal();
});

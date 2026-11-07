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

/* ── Sections available before the profile is configured ── */
var BASIC_SECTION_IDS = ['basic', 'mission'];

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
var COMPANY_TYPE_OPTIONS = [
	{ value: 'corporation', label: 'Corporation (for-profit)' },
	{ value: 'llc', label: 'Limited liability company (LLC)' },
	{ value: 'partnership', label: 'Partnership' },
	{ value: 'sole-proprietorship', label: 'Sole proprietorship' },
	{ value: 'nonprofit', label: 'Non-profit organization' },
	{ value: 'registered-charity', label: 'Registered charity' },
	{ value: 'cooperative', label: 'Cooperative' },
	{ value: 'joint-venture', label: 'Joint venture' },
	{ value: 'public', label: 'Public company' },
	{ value: 'government', label: 'Government entity' },
	{ value: 'other', label: 'Other' }
];

function companyTypeLabel(companyType) {
	for (var i = 0; i < COMPANY_TYPE_OPTIONS.length; i++) {
		if (COMPANY_TYPE_OPTIONS[i].value === companyType) return COMPANY_TYPE_OPTIONS[i].label;
	}
	return companyType;
}

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
		brandAssets: [],
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
	if (!Array.isArray(DB.brandAssets)) DB.brandAssets = [];
	DB.brandAssets = DB.brandAssets.filter(function(brandAsset) {
		if (!brandAsset || typeof brandAsset !== 'object') return false;
		if (!brandAsset.id || typeof brandAsset.id !== 'string') brandAsset.id = newId('bi');
		brandAsset.kind = String(brandAsset.kind || '').slice(0, 60);
		brandAsset.name = String(brandAsset.name || '').slice(0, 120);
		brandAsset.url = String(brandAsset.url || '').slice(0, 1000);
		brandAsset.caption = String(brandAsset.caption || '').slice(0, 160);
		return !!brandAsset.url;
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
	return !sectionHiddenByProfile(sectionId);
}

/* Before an industry, template or area is chosen only the basics are shown.
   Nothing is deleted: the other sections return as soon as the profile is set. */
function sectionHiddenByProfile(sectionId) {
	if (!profileIsConfigured()) return BASIC_SECTION_IDS.indexOf(sectionId) === -1;
	return !sectionMatchesProfile(sectionId);
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

/* ── Record cards ──
   Every repeating list renders as read-first cards instead of an always-open
   form. A card shows the saved data, and one card at a time can be opened for
   editing. Save writes the fields, Cancel leaves the saved record untouched.
   Adding a list means adding one entry to RECORD_VIEWS - no new render code. */

var openRecordViewId = '';
var openRecordIndex = -1;
var recordEditorDraft = null;
var openFieldGroupId = '';

function recordView(viewId) { return RECORD_VIEWS[viewId] || null; }

function recordListFor(view) {
	var list = view && typeof view.list === 'function' ? view.list() : [];
	return Array.isArray(list) ? list : [];
}

function recordChipsHtml(chips) {
	var html = '';
	for (var i = 0; i < (chips || []).length; i++) {
		var chip = chips[i];
		if (!chip || !chip.label) continue;
		html += '<span class="cp-tag' + (chip.tone ? ' cp-tag-' + chip.tone : '') + '">' + esc(chip.label) + '</span>';
	}
	return html;
}

function recordFactsHtml(facts) {
	var html = '';
	for (var i = 0; i < (facts || []).length; i++) {
		var fact = facts[i];
		if (!fact || fact.value === undefined || fact.value === null || !String(fact.value).trim()) continue;
		html += '<div class="cp-card-fact">' +
			'<span class="cp-card-fact-label">' + esc(fact.label) + '</span>' +
			'<span class="cp-card-fact-value">' + esc(fact.value) + '</span>' +
			'</div>';
	}
	return html ? '<div class="cp-card-facts">' + html + '</div>' : '';
}

function formatAmount(value) {
	var text = String(value === undefined || value === null ? '' : value).trim();
	if (!text) return '';
	var amount = Number(text.replace(/,/g, ''));
	if (!isFinite(amount)) return text;
	return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function recordEmptyHtml(view) {
	return '<div class="cp-record-empty">' +
		'<span class="cp-record-empty-icon">' + iconSvg(view.icon || 'folder') + '</span>' +
		'<div class="cp-record-empty-text">' +
			'<strong>' + esc(view.emptyTitle || 'Nothing here yet') + '</strong>' +
			'<span>' + esc(view.emptyHint || 'Use the button below to add the first entry.') + '</span>' +
		'</div>' +
	'</div>';
}

function recordCardHtml(view, index, item) {
	var title = view.title ? view.title(item) : '';
	var subtitle = view.subtitle ? view.subtitle(item) : '';
	var chips = view.chips ? view.chips(item) : [];
	var facts = view.facts ? view.facts(item) : [];
	var note = view.note ? view.note(item) : '';
	var bodyHtml = view.bodyHtml ? view.bodyHtml(item) : '';
	var html = '<article class="cp-card">' +
		'<header class="cp-card-head">' +
			'<span class="cp-card-avatar">' + iconSvg(view.icon || 'folder') + '</span>' +
			'<div class="cp-card-titles">' +
				'<h4 class="cp-card-title' + (title ? '' : ' is-empty') + '">' + esc(title || view.untitled || 'Untitled') + '</h4>' +
				(subtitle ? '<p class="cp-card-sub">' + esc(subtitle) + '</p>' : '') +
			'</div>' +
			(chips.length ? '<div class="cp-card-tags">' + recordChipsHtml(chips) + '</div>' : '') +
			'<button type="button" class="cp-btn cp-btn-sm cp-card-edit" data-record-action="edit" data-record-view="' + view.id + '" data-record-idx="' + index + '">' + iconSvg('pencil') + 'Edit</button>' +
		'</header>' +
		(note ? '<p class="cp-card-note">' + esc(note) + '</p>' : '') +
		bodyHtml +
		recordFactsHtml(facts) +
	'</article>';
	return html;
}

function recordSelectHtml(field, value, fieldId) {
	var html = '<select class="cp-input cp-select" id="' + fieldId + '" data-record-field="' + field.key + '">';
	html += '<option value="">' + esc(field.emptyLabel || 'Not set') + '</option>';
	if (field.type === 'boolean') {
		html += '<option value="true"' + (value === 'true' ? ' selected' : '') + '>Yes</option>';
		html += '<option value="false"' + (value === 'false' ? ' selected' : '') + '>No</option>';
	} else {
		var options = field.options || [];
		for (var i = 0; i < options.length; i++) {
			var optionValue = typeof options[i] === 'object' ? options[i].value : options[i];
			var optionLabel = typeof options[i] === 'object' ? options[i].label : options[i];
			html += '<option value="' + esc(optionValue) + '"' + (optionValue === value ? ' selected' : '') + '>' + esc(optionLabel) + '</option>';
		}
	}
	return html + '</select>';
}

function recordFieldHtml(view, field, item) {
	var fieldId = 'rf-' + view.id + '-' + field.key;
	var rawValue = item && item[field.key] !== undefined && item[field.key] !== null ? item[field.key] : '';
	var value = field.type === 'boolean' ? (rawValue === true ? 'true' : (rawValue === false ? 'false' : '')) : String(rawValue);
	var control = '';
	if (field.type === 'textarea') {
		control = '<textarea class="cp-input cp-textarea" id="' + fieldId + '" data-record-field="' + field.key + '" rows="' + (field.rows || 3) + '"' +
			(field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') + '>' + esc(value) + '</textarea>';
	} else if (field.type === 'select' || field.type === 'boolean') {
		control = recordSelectHtml(field, value, fieldId);
	} else {
		var inputType = field.type || 'text';
		control = '<input type="' + inputType + '" class="cp-input" id="' + fieldId + '" data-record-field="' + field.key + '" value="' + esc(value) + '"' +
			(field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') +
			(field.min !== undefined ? ' min="' + field.min + '"' : '') +
			(field.maxLength ? ' maxlength="' + field.maxLength + '"' : '') + '>';
	}
	return '<div class="cp-field' + (field.span === 2 || field.type === 'textarea' ? ' cp-field-full' : '') + '">' +
		'<label class="cp-label" for="' + fieldId + '">' + esc(field.label) + '</label>' +
		control +
		(field.help ? '<span class="cp-field-help">' + esc(field.help) + '</span>' : '') +
	'</div>';
}

function recordSkillRowHtml(view, skill, rowIndex) {
	var fields = view.nested.fields || [];
	var html = '<div class="cp-skill-row" data-skill-row="' + rowIndex + '">';
	for (var i = 0; i < fields.length; i++) {
		var field = fields[i];
		var fieldId = 'rf-' + view.id + '-skill-' + rowIndex + '-' + field.key;
		var value = skill && skill[field.key] !== undefined && skill[field.key] !== null ? String(skill[field.key]) : '';
		html += '<div class="cp-skill-cell' + (field.span === 2 ? ' cp-skill-cell-wide' : '') + '">' +
			'<label class="cp-label" for="' + fieldId + '">' + esc(field.label) + '</label>';
		if (field.type === 'select') {
			html += '<select class="cp-input cp-select" id="' + fieldId + '" data-skill-field="' + field.key + '">' +
				'<option value="">Not set</option>' + buildSelectOptions(field.options || [], value) + '</select>';
		} else {
			html += '<input type="text" class="cp-input" id="' + fieldId + '" data-skill-field="' + field.key + '" value="' + esc(value) + '"' +
				(field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') + '>';
		}
		html += '</div>';
	}
	html += '<button type="button" class="cp-btn cp-btn-sm cp-btn-danger cp-skill-remove" data-record-action="skill-remove" data-skill-index="' + rowIndex + '" title="Remove this skill" aria-label="Remove this skill">&#10005;</button>';
	return html + '</div>';
}

function recordNestedHtml(view, item) {
	var nested = view.nested;
	var skills = item && Array.isArray(item[nested.key]) ? item[nested.key] : [];
	var html = '<div class="cp-card-nested">' +
		'<div class="cp-card-nested-head"><span class="cp-label">' + esc(nested.label) + '</span>' +
		'<span class="cp-hint">' + skills.length + ' listed</span></div>';
	if (!skills.length) {
		html += '<p class="cp-card-nested-empty">' + esc(nested.emptyText || 'Nothing listed yet.') + '</p>';
	}
	for (var i = 0; i < skills.length; i++) {
		html += recordSkillRowHtml(view, skills[i], i);
	}
	html += '<button type="button" class="cp-btn cp-btn-sm cp-btn-add" data-record-action="skill-add">+ ' + esc(nested.addLabel || 'Add row') + '</button>';
	return html + '</div>';
}

function recordEditorHtml(view, index, item) {
	var fields = view.fields || [];
	var formHtml = '';
	for (var i = 0; i < fields.length; i++) {
		formHtml += recordFieldHtml(view, fields[i], item);
	}
	var html = '<article class="cp-card editing" data-record-editor data-record-view="' + view.id + '" data-record-idx="' + index + '">' +
		'<header class="cp-card-head">' +
			'<span class="cp-card-avatar is-editing">' + iconSvg(view.icon || 'folder') + '</span>' +
			'<div class="cp-card-titles">' +
				'<h4 class="cp-card-title">' + esc(view.editorTitle || 'Edit entry') + '</h4>' +
				'<p class="cp-card-sub">' + esc(view.editorHint || 'Changes are applied when you save.') + '</p>' +
			'</div>' +
		'</header>' +
		'<div class="cp-card-form">' + formHtml + '</div>' +
		(view.nested ? recordNestedHtml(view, item) : '') +
		'<footer class="cp-card-foot">' +
			'<button type="button" class="cp-btn cp-btn-sm cp-btn-danger cp-card-remove" data-record-action="remove" data-record-view="' + view.id + '" data-record-idx="' + index + '">Remove</button>' +
			'<span class="cp-card-foot-note">Nothing is changed until you save.</span>' +
			'<button type="button" class="cp-btn cp-btn-sm" data-record-action="cancel">Cancel</button>' +
			'<button type="button" class="cp-btn cp-btn-sm cp-btn-primary" data-record-action="save">Save</button>' +
		'</footer>' +
	'</article>';
	return html;
}

function renderRecordList(viewId) {
	var view = recordView(viewId);
	if (!view) return;
	var container = el(view.containerId);
	if (!container) return;
	var items = recordListFor(view);
	if (!items.length) {
		container.innerHTML = recordEmptyHtml(view);
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) {
		var isOpen = openRecordViewId === viewId && openRecordIndex === i && recordEditorDraft;
		html += isOpen ? recordEditorHtml(view, i, recordEditorDraft.item) : recordCardHtml(view, i, items[i]);
	}
	container.innerHTML = html;
}

function focusRecordEditor() {
	var firstField = document.querySelector('[data-record-editor] .cp-input');
	if (firstField && typeof firstField.focus === 'function') {
		firstField.focus({ preventScroll: true });
	}
}

function openRecordEditor(viewId, index) {
	var view = recordView(viewId);
	if (!view) return;
	var items = recordListFor(view);
	if (index < 0 || index >= items.length) return;
	if (openRecordViewId === viewId && openRecordIndex === index) return;
	var previousViewId = openRecordViewId;
	if (recordEditorDraft) saveRecordEditor(true);
	openRecordViewId = viewId;
	openRecordIndex = index;
	recordEditorDraft = { item: JSON.parse(JSON.stringify(items[index])) };
	if (!Array.isArray(recordEditorDraft.item[view.nested ? view.nested.key : ''])) {
		// no-op: keeps the draft shape identical to the saved item
	}
	renderRecordList(viewId);
	if (previousViewId && previousViewId !== viewId) renderRecordList(previousViewId);
	focusRecordEditor();
}

function collectRecordEditorFields() {
	if (!recordEditorDraft) return;
	var editor = document.querySelector('[data-record-editor]');
	if (!editor) return;
	editor.querySelectorAll('[data-record-field]').forEach(function(input) {
		recordEditorDraft.item[input.getAttribute('data-record-field')] = input.value;
	});
}

function closeRecordEditor() {
	var previousViewId = openRecordViewId;
	openRecordViewId = '';
	openRecordIndex = -1;
	recordEditorDraft = null;
	if (previousViewId) renderRecordList(previousViewId);
}

function saveRecordEditor(silent) {
	if (!recordEditorDraft) return;
	var view = recordView(openRecordViewId);
	if (!view) { closeRecordEditor(); return; }
	collectRecordEditorFields();
	var editor = document.querySelector('[data-record-editor]');
	if (view.nested && editor) {
		var nestedSkills = [];
		editor.querySelectorAll('[data-skill-row]').forEach(function(row) {
			var skill = {};
			var hasValue = false;
			row.querySelectorAll('[data-skill-field]').forEach(function(input) {
				var value = input.value;
				skill[input.getAttribute('data-skill-field')] = value;
				if (String(value).trim()) hasValue = true;
			});
			if (hasValue) nestedSkills.push(skill);
		});
		recordEditorDraft.item[view.nested.key] = nestedSkills;
	}
	var items = recordListFor(view);
	var target = items[openRecordIndex];
	if (target) {
		Object.keys(recordEditorDraft.item).forEach(function(key) {
			if (view.fields && view.fields.some(function(field) { return field.key === key && field.type === 'boolean'; })) {
				var rawBoolean = recordEditorDraft.item[key];
				target[key] = rawBoolean === 'true' ? true : (rawBoolean === 'false' ? false : null);
			} else {
				target[key] = recordEditorDraft.item[key];
			}
		});
	}
	saveDB();
	closeRecordEditor();
	if (!silent && tool.notify) tool.notify(view.savedMessage || 'Changes saved.', 'success');
}

function addRecordItem(viewId) {
	var view = recordView(viewId);
	if (!view) return;
	var items = recordListFor(view);
	items.push(view.create());
	saveDB();
	openRecordEditor(viewId, items.length - 1);
	renderRecordList(viewId);
}

function removeRecordItem(viewId, index) {
	var view = recordView(viewId);
	if (!view) return;
	var items = recordListFor(view);
	if (index < 0 || index >= items.length) return;
	items.splice(index, 1);
	if (openRecordViewId === viewId) {
		openRecordViewId = '';
		openRecordIndex = -1;
		recordEditorDraft = null;
	}
	saveDB();
	renderRecordList(viewId);
	if (tool.notify) tool.notify(view.removedMessage || 'Entry removed.', 'info');
}

function requestRemoveRecord(button) {
	if (button.getAttribute('data-armed') !== '1') {
		button.setAttribute('data-armed', '1');
		button.textContent = 'Click again to remove';
		return;
	}
	removeRecordItem(button.getAttribute('data-record-view'), parseInt(button.getAttribute('data-record-idx'), 10));
}

function addRecordSkill() {
	if (!recordEditorDraft) return;
	collectRecordEditorFields();
	var view = recordView(openRecordViewId);
	if (!view || !view.nested) return;
	if (!Array.isArray(recordEditorDraft.item[view.nested.key])) recordEditorDraft.item[view.nested.key] = [];
	recordEditorDraft.item[view.nested.key].push(view.nested.create());
	renderRecordList(openRecordViewId);
	focusRecordEditor();
}

function removeRecordSkill(rowIndex) {
	if (!recordEditorDraft) return;
	collectRecordEditorFields();
	var view = recordView(openRecordViewId);
	if (!view || !view.nested) return;
	var skills = recordEditorDraft.item[view.nested.key] || [];
	skills.splice(rowIndex, 1);
	renderRecordList(openRecordViewId);
}

/* ── Field groups: single read card with one inline editor ── */
function fieldGroup(groupId) { return FIELD_GROUPS[groupId] || null; }

function fieldGroupCardHtml(group) {
	var data = group.target();
	var displayTitle = group.titleValue ? group.titleValue(data) : group.title;
	var chips = group.chips ? group.chips(data) : [];
	var facts = group.facts ? group.facts(data) : [];
	var note = group.note ? group.note(data) : '';
	var bodyHtml = group.bodyHtml ? group.bodyHtml(data) : '';
	return '<article class="cp-card cp-card-wide">' +
		'<header class="cp-card-head">' +
			'<span class="cp-card-avatar">' + iconSvg(group.icon || 'folder') + '</span>' +
			'<div class="cp-card-titles">' +
				'<h4 class="cp-card-title">' + esc(displayTitle || group.title) + '</h4>' +
				(group.hint ? '<p class="cp-card-sub">' + esc(group.subtitle || (group.titleValue ? group.title : group.hint)) + '</p>' : '') +
			'</div>' +
			(chips.length ? '<div class="cp-card-tags">' + recordChipsHtml(chips) + '</div>' : '') +
			'<button type="button" class="cp-btn cp-btn-sm cp-card-edit" data-group-action="edit" data-group-id="' + group.id + '">' + iconSvg('pencil') + 'Edit</button>' +
		'</header>' +
		(note ? '<p class="cp-card-note">' + esc(note) + '</p>' : '') +
		bodyHtml +
		recordFactsHtml(facts) +
	'</article>';
}

function fieldGroupEditorHtml(group, isFirstEntry) {
	var data = group.target();
	var formHtml = '';
	for (var i = 0; i < group.fields.length; i++) {
		var field = group.fields[i];
		var fieldId = 'gf-' + group.id + '-' + field.key;
		var rawValue = data[field.key] === undefined || data[field.key] === null ? '' : data[field.key];
		var value = String(rawValue);
		var control;
		if (field.type === 'textarea') {
			control = '<textarea class="cp-input cp-textarea" id="' + fieldId + '" data-group-field="' + field.key + '" rows="' + (field.rows || 3) + '"' +
				(field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') + '>' + esc(value) + '</textarea>';
		} else if (field.type === 'boolean') {
			control = '<select class="cp-input cp-select" id="' + fieldId + '" data-group-field="' + field.key + '">';
			control += '<option value="">Not set</option>';
			control += '<option value="true"' + (value === 'true' ? ' selected' : '') + '>Yes</option>';
			control += '<option value="false"' + (value === 'false' ? ' selected' : '') + '>No</option>';
			control += '</select>';
		} else if (field.type === 'select') {
			control = '<select class="cp-input cp-select" id="' + fieldId + '" data-group-field="' + field.key + '">';
			control += '<option value="">Not set</option>';
			for (var optionIndex = 0; optionIndex < (field.options || []).length; optionIndex++) {
				var option = field.options[optionIndex];
				var optionValue = typeof option === 'object' ? option.value : option;
				var optionLabel = typeof option === 'object' ? option.label : option;
				control += '<option value="' + esc(optionValue) + '"' + (optionValue === value ? ' selected' : '') + '>' + esc(optionLabel) + '</option>';
			}
			control += '</select>';
		} else {
		control = '<input type="' + (field.type || 'text') + '" class="cp-input" id="' + fieldId + '" data-group-field="' + field.key + '" value="' + esc(value) + '"' +
			(field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') +
			(field.maxLength ? ' maxlength="' + field.maxLength + '"' : '') + '>';
		}
		formHtml += '<div class="cp-field' + (field.span === 2 || field.type === 'textarea' ? ' cp-field-full' : '') + '">' +
			'<label class="cp-label" for="' + fieldId + '">' + esc(field.label) + '</label>' + control +
			(field.help ? '<span class="cp-field-help">' + esc(field.help) + '</span>' : '') +
		'</div>';
	}
	return '<article class="cp-card cp-card-wide editing" data-group-editor data-group-id="' + group.id + '">' +
		'<header class="cp-card-head">' +
			'<span class="cp-card-avatar is-editing">' + iconSvg(group.icon || 'folder') + '</span>' +
			'<div class="cp-card-titles">' +
				'<h4 class="cp-card-title">' + (isFirstEntry ? esc(group.title) : 'Edit ' + esc(group.title.toLowerCase())) + '</h4>' +
				'<p class="cp-card-sub">' + (isFirstEntry ? 'Fill this in once - every section reuses it.' : 'Nothing is changed until you save.') + '</p>' +
			'</div>' +
		'</header>' +
		'<div class="cp-card-form">' + formHtml + '</div>' +
		'<footer class="cp-card-foot">' +
			'<span class="cp-card-foot-note">' + (isFirstEntry ? 'Fill this in once - it is reused across every section.' : 'Nothing is changed until you save.') + '</span>' +
			(isFirstEntry ? '' : '<button type="button" class="cp-btn cp-btn-sm" data-group-action="cancel" data-group-id="' + group.id + '">Cancel</button>') +
			'<button type="button" class="cp-btn cp-btn-sm cp-btn-primary" data-group-action="save" data-group-id="' + group.id + '">Save</button>' +
		'</footer>' +
	'</article>';
}

function renderFieldGroup(groupId) {
	var group = fieldGroup(groupId);
	if (!group) return;
	var container = el(group.containerId);
	if (!container) return;
	var autoEdit = group.autoEditWhenEmpty && group.isEmpty && group.isEmpty(group.target());
	var isFirstEntry = autoEdit && openFieldGroupId !== groupId;
	container.innerHTML = (openFieldGroupId === groupId || autoEdit) ? fieldGroupEditorHtml(group, isFirstEntry) : fieldGroupCardHtml(group);
}

function openFieldGroupEditor(groupId) {
	if (openFieldGroupId === groupId) return;
	var previousGroupId = openFieldGroupId;
	if (previousGroupId) saveFieldGroup(previousGroupId, true);
	openFieldGroupId = groupId;
	renderFieldGroup(groupId);
	var firstField = document.querySelector('[data-group-editor] .cp-input');
	if (firstField) firstField.focus({ preventScroll: true });
}

function saveFieldGroup(groupId, silent) {
	var group = fieldGroup(groupId);
	if (!group) return;
	var editor = document.querySelector('[data-group-editor]');
	if (editor) {
		var target = group.target();
		editor.querySelectorAll('[data-group-field]').forEach(function(input) {
			var groupFieldKey = input.getAttribute('data-group-field');
			var isBooleanField = (group.fields || []).some(function(field) { return field.key === groupFieldKey && field.type === 'boolean'; });
			if (isBooleanField) {
				target[groupFieldKey] = input.value === 'true' ? true : (input.value === 'false' ? false : null);
			} else {
				target[groupFieldKey] = input.value;
			}
		});
		if (group.afterSave) group.afterSave(target);
		saveDB();
	}
	if (openFieldGroupId === groupId) openFieldGroupId = '';
	renderFieldGroup(groupId);
	if (editor && !silent && tool.notify) tool.notify(group.savedMessage || 'Changes saved.', 'success');
}

function cancelFieldGroup(groupId) {
	openFieldGroupId = '';
	renderFieldGroup(groupId);
}

function handleRecordAction(button) {
	var action = button.getAttribute('data-record-action');
	var viewId = button.getAttribute('data-record-view');
	var index = parseInt(button.getAttribute('data-record-idx'), 10);
	if (action === 'edit') openRecordEditor(viewId, index);
	else if (action === 'save') saveRecordEditor();
	else if (action === 'cancel') closeRecordEditor();
	else if (action === 'remove') requestRemoveRecord(button);
	else if (action === 'skill-add') addRecordSkill();
	else if (action === 'skill-remove') removeRecordSkill(parseInt(button.getAttribute('data-skill-index'), 10));
}

function handleGroupAction(button) {
	var action = button.getAttribute('data-group-action');
	var groupId = button.getAttribute('data-group-id') || openFieldGroupId;
	if (action === 'edit') openFieldGroupEditor(groupId);
	else if (action === 'save') saveFieldGroup(groupId);
	else if (action === 'cancel') cancelFieldGroup(groupId);
}

/* ── Read models for every repeating list ── */
var RECORD_VIEWS = {
	capabilities: {
		id: 'capabilities',
		containerId: 'cp-capabilities-container',
		icon: 'spark',
		untitled: 'Untitled capability',
		editorTitle: 'Edit capability',
		savedMessage: 'Capability saved.',
		removedMessage: 'Capability removed.',
		emptyTitle: 'No capabilities yet',
		emptyHint: 'Add what the company can deliver, with the evidence that supports it.',
		list: function() { return DB.industryOps.capabilities || []; },
		create: function() { return { name:'', description:'', serviceCategories:'', expertiseLevel:'', certified:'', relatedStandards:'', supportingDocs:'' }; },
		title: function(item) { return item.name; },
		chips: function(item) {
			return [
				{ label: item.expertiseLevel, tone: 'accent' },
				{ label: item.certified === 'Yes' ? 'Certified' : '', tone: 'success' }
			];
		},
		note: function(item) { return item.description; },
		facts: function(item) {
			return [
				{ label: 'Service categories', value: item.serviceCategories },
				{ label: 'Standards', value: item.relatedStandards },
				{ label: 'Supporting documents', value: item.supportingDocs }
			];
		},
		fields: [
			{ key: 'name', label: 'Capability name', span: 2, placeholder: 'e.g. Seismic bridge retrofit' },
			{ key: 'serviceCategories', label: 'Service categories', span: 2, placeholder: 'Comma-separated, e.g. Bridge design, Seismic retrofit' },
			{ key: 'description', label: 'What it means in practice', type: 'textarea', rows: 3, placeholder: 'What the company delivers, for whom, and with what result' },
			{ key: 'expertiseLevel', label: 'Expertise level', type: 'select', options: EXPERTISE_LEVELS },
			{ key: 'certified', label: 'Certified for this work', type: 'select', options: ['Yes', 'No'] },
			{ key: 'relatedStandards', label: 'Related standards or regulations', span: 2, placeholder: 'e.g. CSA S6, ISO 9001' },
			{ key: 'supportingDocs', label: 'Supporting documents', span: 2, placeholder: 'Links or references to evidence' }
		]
	},

	taxes: {
		id: 'taxes',
		containerId: 'cp-taxes-container',
		icon: 'receipt',
		untitled: 'Untitled tax registration',
		editorTitle: 'Edit tax registration',
		savedMessage: 'Tax registration saved.',
		removedMessage: 'Tax registration removed.',
		emptyTitle: 'No tax registrations yet',
		emptyHint: 'Add each sales tax number the company uses on invoices.',
		list: function() { return DB.salesTaxDefinitions; },
		create: function() { return { name:'', rate:'', taxNumber:'', notes:'' }; },
		title: function(item) { return item.name; },
		chips: function(item) { return [{ label: item.rate, tone: 'accent' }]; },
		facts: function(item) {
			return [
				{ label: 'Tax number', value: item.taxNumber },
				{ label: 'Notes', value: item.notes }
			];
		},
		fields: [
			{ key: 'name', label: 'Tax name', span: 2, placeholder: 'e.g. Canada GST' },
			{ key: 'rate', label: 'Rate', placeholder: 'e.g. 5%' },
			{ key: 'taxNumber', label: 'Tax number / ID', placeholder: 'e.g. 123456789 RT0001' },
			{ key: 'notes', label: 'Notes', span: 2, placeholder: 'Where this registration applies' }
		]
	},

	offices: {
		id: 'offices',
		containerId: 'cp-offices-container',
		icon: 'pin',
		untitled: 'Untitled office',
		editorTitle: 'Edit office',
		savedMessage: 'Office saved.',
		removedMessage: 'Office removed.',
		emptyTitle: 'No other offices yet',
		emptyHint: 'Add branches, warehouses and satellite locations.',
		list: function() { return DB.otherOffices; },
		create: function() { return { name:'', type:'branch', address:'', city:'', state:'', postal:'', country:'', email:'', phone:'' }; },
		title: function(item) { return item.name; },
		subtitle: function(item) { return [item.city, item.country].filter(Boolean).join(', '); },
		chips: function(item) { return [{ label: officeTypeLabel(item.type), tone: 'neutral' }]; },
		facts: function(item) {
			return [
				{ label: 'Address', value: [item.address, item.postal].filter(Boolean).join(', ') },
				{ label: 'Email', value: item.email },
				{ label: 'Phone', value: item.phone }
			];
		},
		fields: [
			{ key: 'name', label: 'Office name', span: 2, placeholder: 'e.g. Alberta Operations Centre' },
			{ key: 'type', label: 'Type', type: 'select', options: ['Branch', 'Satellite Office', 'Warehouse', 'Retail Location', 'Other'] },
			{ key: 'address', label: 'Street address', span: 2 },
			{ key: 'city', label: 'City' },
			{ key: 'state', label: 'State / province' },
			{ key: 'postal', label: 'Postal / ZIP' },
			{ key: 'country', label: 'Country' },
			{ key: 'email', label: 'Email', type: 'email' },
			{ key: 'phone', label: 'Phone' }
		]
	},

	contacts: {
		id: 'contacts',
		containerId: 'cp-contacts-container',
		icon: 'users',
		untitled: 'Untitled contact',
		editorTitle: 'Edit contact',
		savedMessage: 'Contact saved.',
		removedMessage: 'Contact removed.',
		emptyTitle: 'No other contacts yet',
		emptyHint: 'Add the people clients and partners should reach.',
		list: function() { return DB.contacts.others; },
		create: function() { return { name:'', title:'', email:'', phone:'', linkedin:'' }; },
		title: function(item) { return item.name; },
		chips: function(item) { return [{ label: item.title, tone: 'neutral' }]; },
		facts: function(item) {
			return [
				{ label: 'Email', value: item.email },
				{ label: 'Phone', value: item.phone },
				{ label: 'LinkedIn', value: item.linkedin }
			];
		},
		fields: [
			{ key: 'name', label: 'Full name', span: 2 },
			{ key: 'title', label: 'Title / position', span: 2 },
			{ key: 'email', label: 'Email', type: 'email' },
			{ key: 'phone', label: 'Phone' },
			{ key: 'linkedin', label: 'LinkedIn URL', type: 'url', span: 2 }
		]
	},

	certs: {
		id: 'certs',
		containerId: 'cp-certs-container',
		icon: 'shield',
		untitled: 'Untitled document',
		editorTitle: 'Edit document',
		savedMessage: 'Document saved.',
		removedMessage: 'Document removed.',
		emptyTitle: 'No documents yet',
		emptyHint: 'Add licences, insurance certificates and certifications.',
		list: function() { return DB.documents.certificates || []; },
		create: function() { return { name:'', type:'', effectiveDate:'', expiryDate:'', file:'', isValid:null, description:'' }; },
		title: function(item) { return item.name; },
		chips: function(item) {
			return [
				{ label: item.type, tone: 'neutral' },
				{ label: item.isValid === true ? 'Valid' : (item.isValid === false ? 'Expired' : ''), tone: item.isValid === false ? 'danger' : 'success' }
			];
		},
		facts: function(item) {
			return [
				{ label: 'Effective', value: item.effectiveDate },
				{ label: 'Expires', value: item.expiryDate },
				{ label: 'File', value: item.file },
				{ label: 'Description', value: item.description }
			];
		},
		fields: [
			{ key: 'name', label: 'Document name', span: 2 },
			{ key: 'type', label: 'Document type', type: 'select', options: DOC_TYPES },
			{ key: 'isValid', label: 'Currently valid', type: 'boolean' },
			{ key: 'effectiveDate', label: 'Effective date', type: 'date' },
			{ key: 'expiryDate', label: 'Expiry date', type: 'date' },
			{ key: 'file', label: 'File reference', span: 2, placeholder: 'File link or reference' },
			{ key: 'description', label: 'Description', span: 2 }
		]
	},

	refletters: {
		id: 'refletters',
		containerId: 'cp-refletters-container',
		icon: 'mail',
		untitled: 'Untitled reference letter',
		editorTitle: 'Edit reference letter',
		savedMessage: 'Reference letter saved.',
		removedMessage: 'Reference letter removed.',
		emptyTitle: 'No reference letters yet',
		emptyHint: 'Add letters from clients and partners who can vouch for the work.',
		list: function() { return DB.referenceLetters || []; },
		create: function() { return { title:'', file:'', issuedBy:'', issueDate:'', summary:'', associatedProjects:'' }; },
		title: function(item) { return item.title; },
		chips: function(item) { return [{ label: item.issuedBy, tone: 'neutral' }]; },
		note: function(item) { return item.summary; },
		facts: function(item) {
			return [
				{ label: 'Issued', value: item.issueDate },
				{ label: 'Projects', value: item.associatedProjects },
				{ label: 'File', value: item.file }
			];
		},
		fields: [
			{ key: 'title', label: 'Letter title', span: 2 },
			{ key: 'issuedBy', label: 'Issued by' },
			{ key: 'issueDate', label: 'Issue date', type: 'date' },
			{ key: 'associatedProjects', label: 'Projects it covers', span: 2 },
			{ key: 'file', label: 'File reference', span: 2 },
			{ key: 'summary', label: 'Summary / comments', type: 'textarea', rows: 3 }
		]
	},

	'assets-owned': {
		id: 'assets-owned',
		containerId: 'cp-assets-owned-container',
		icon: 'truck',
		untitled: 'Untitled asset',
		editorTitle: 'Edit owned asset',
		savedMessage: 'Asset saved.',
		removedMessage: 'Asset removed.',
		emptyTitle: 'No owned assets yet',
		emptyHint: 'Add equipment, vehicles and facilities the company owns.',
		list: function() { return DB.assets.owned || []; },
		create: function() { return { name:'', type:'', quantity:'', description:'', ownership:'', readiness:'', technicalSpecs:'', certifications:'' }; },
		title: function(item) { return item.name; },
		chips: function(item) {
			return [
				{ label: item.type, tone: 'neutral' },
				{ label: item.quantity ? 'x ' + item.quantity : '', tone: 'accent' },
				{ label: item.readiness, tone: readinessTone(item.readiness) }
			];
		},
		note: function(item) { return item.description; },
		facts: function(item) {
			return [
				{ label: 'Ownership', value: item.ownership },
				{ label: 'Certifications', value: item.certifications },
				{ label: 'Technical specs', value: item.technicalSpecs }
			];
		},
		fields: [
			{ key: 'name', label: 'Asset name', span: 2 },
			{ key: 'type', label: 'Asset type', type: 'select', options: ASSET_TYPES },
			{ key: 'quantity', label: 'Quantity', type: 'number', min: 0 },
			{ key: 'description', label: 'Description', span: 2 },
			{ key: 'ownership', label: 'Ownership', type: 'select', options: OWNERSHIP_TYPES },
			{ key: 'readiness', label: 'Readiness', type: 'select', options: READINESS_TYPES },
			{ key: 'technicalSpecs', label: 'Technical specs', type: 'textarea', rows: 2 },
			{ key: 'certifications', label: 'Certifications', span: 2 }
		]
	},

	othersocial: {
		id: 'othersocial',
		containerId: 'cp-othersocial-container',
		icon: 'link',
		untitled: 'Untitled social link',
		editorTitle: 'Edit social link',
		savedMessage: 'Social link saved.',
		removedMessage: 'Social link removed.',
		emptyTitle: 'No extra social links yet',
		emptyHint: 'Add any channel that is not covered by the social profiles card.',
		list: function() { return DB.weblinks.otherSocials || []; },
		create: function() { return { platform:'', url:'' }; },
		title: function(item) { return item.platform; },
		facts: function(item) { return [{ label: 'URL', value: item.url }]; },
		fields: [
			{ key: 'platform', label: 'Platform', span: 2, placeholder: 'e.g. Threads, Pinterest' },
			{ key: 'url', label: 'URL', type: 'url', span: 2, placeholder: 'https://' }
		]
	},

	otherweb: {
		id: 'otherweb',
		containerId: 'cp-otherweb-container',
		icon: 'globe',
		untitled: 'Untitled web source',
		editorTitle: 'Edit web source',
		savedMessage: 'Web source saved.',
		removedMessage: 'Web source removed.',
		emptyTitle: 'No other web sources yet',
		emptyHint: 'Add catalogues, directories or extra company pages.',
		list: function() { return DB.weblinks.otherWebSources || []; },
		create: function() { return { label:'', url:'' }; },
		title: function(item) { return item.label; },
		facts: function(item) { return [{ label: 'URL', value: item.url }]; },
		fields: [
			{ key: 'label', label: 'Label', span: 2, placeholder: 'e.g. Product catalogue' },
			{ key: 'url', label: 'URL', type: 'url', span: 2, placeholder: 'https://' }
		]
	},

	'assets-partner': {		id: 'assets-partner',
		containerId: 'cp-assets-partner-container',
		icon: 'share',
		untitled: 'Untitled partner asset',
		editorTitle: 'Edit partner asset',
		savedMessage: 'Partner asset saved.',
		removedMessage: 'Partner asset removed.',
		emptyTitle: 'No partner assets yet',
		emptyHint: 'Add resources available through partners and alliances.',
		list: function() { return DB.assets.partnerAccessible || []; },
		create: function() { return { name:'', type:'', quantity:'', description:'', reliability:'', readiness:'', technicalSpecs:'', certifications:'' }; },
		title: function(item) { return item.name; },
		chips: function(item) {
			return [
				{ label: item.type, tone: 'neutral' },
				{ label: item.quantity ? 'x ' + item.quantity : '', tone: 'accent' },
				{ label: item.readiness, tone: readinessTone(item.readiness) }
			];
		},
		note: function(item) { return item.description; },
		facts: function(item) {
			return [
				{ label: 'Reliability', value: item.reliability },
				{ label: 'Certifications', value: item.certifications },
				{ label: 'Technical specs', value: item.technicalSpecs }
			];
		},
		fields: [
			{ key: 'name', label: 'Asset name', span: 2 },
			{ key: 'type', label: 'Asset type', type: 'select', options: ASSET_TYPES },
			{ key: 'quantity', label: 'Quantity', type: 'number', min: 0 },
			{ key: 'description', label: 'Description', span: 2 },
			{ key: 'reliability', label: 'Reliability', type: 'select', options: RELIABILITY_TYPES },
			{ key: 'readiness', label: 'Readiness', type: 'select', options: READINESS_TYPES },
			{ key: 'technicalSpecs', label: 'Technical specs', type: 'textarea', rows: 2 },
			{ key: 'certifications', label: 'Certifications', span: 2 }
		]
	},

	hr: {
		id: 'hr',
		containerId: 'cp-hr-container',
		icon: 'users2',
		untitled: 'Untitled staff member',
		editorTitle: 'Edit staff member',
		savedMessage: 'Staff member saved.',
		removedMessage: 'Staff member removed.',
		emptyTitle: 'No staff members yet',
		emptyHint: 'Add the roles the team can staff, with the skills behind them.',
		list: function() { return DB.humanResources.staffCapabilities || []; },
		create: function() { return { name:'', role:'', experience:'', educationLevel:'', skills:[] }; },
		title: function(item) { return item.role || item.name; },
		subtitle: function(item) { return item.role && item.name ? item.name : ''; },
		chips: function(item) {
			return [
				{ label: item.experience, tone: 'accent' },
				{ label: item.educationLevel, tone: 'neutral' }
			];
		},
		bodyHtml: function(item) {
			var skills = item.skills || [];
			if (!skills.length) return '';
			var rows = '';
			for (var i = 0; i < skills.length; i++) {
				var skill = skills[i];
				rows += '<div class="cp-card-skill">' +
					'<span class="cp-card-skill-name">' + esc(skill.name || 'Unnamed skill') + '</span>' +
					(skill.years ? '<span class="cp-card-skill-meta">' + esc(skill.years) + ' yrs</span>' : '') +
					(skill.level ? '<span class="cp-tag cp-tag-neutral">' + esc(skill.level) + '</span>' : '') +
					(skill.certification ? '<span class="cp-card-skill-meta">' + esc(skill.certification) + '</span>' : '') +
				'</div>';
			}
			return '<div class="cp-card-skills">' + rows + '</div>';
		},
		nested: {
			key: 'skills',
			label: 'Skills',
			emptyText: 'No skills listed yet.',
			addLabel: 'Add skill',
			create: function() { return { name:'', years:'', level:'', certification:'' }; },
			fields: [
				{ key: 'name', label: 'Skill', placeholder: 'e.g. Structural design', span: 2 },
				{ key: 'years', label: 'Years', placeholder: 'e.g. 10' },
				{ key: 'level', label: 'Level', type: 'select', options: SKILL_LEVELS },
				{ key: 'certification', label: 'Certification', placeholder: 'e.g. P.Eng.' }
			]
		},
		fields: [
			{ key: 'role', label: 'Role', span: 2, placeholder: 'e.g. Site Superintendent' },
			{ key: 'name', label: 'Name (optional)' },
			{ key: 'experience', label: 'Experience', placeholder: 'e.g. 10 years' },
			{ key: 'educationLevel', label: 'Education level', type: 'select', options: EDUCATION_LEVELS }
		]
	},

	revenues: {
		id: 'revenues',
		containerId: 'cp-revenues-container',
		icon: 'chart',
		untitled: 'Untitled year',
		editorTitle: 'Edit revenue year',
		savedMessage: 'Revenue year saved.',
		removedMessage: 'Revenue year removed.',
		emptyTitle: 'No revenue history yet',
		emptyHint: 'Add one line per year so tender and grant reviews see the trend.',
		list: function() { return DB.financials.annualRevenues || []; },
		create: function() { return { year:'', revenue:'', netIncome:'' }; },
		title: function(item) { return item.year; },
		chips: function(item) { return [{ label: item.revenue ? 'Revenue ' + formatAmount(item.revenue) : '', tone: 'accent' }]; },
		facts: function(item) {
			return [
				{ label: 'Revenue', value: formatAmount(item.revenue) },
				{ label: 'Net income', value: formatAmount(item.netIncome) }
			];
		},
		fields: [
			{ key: 'year', label: 'Year', type: 'number', placeholder: '2025' },
			{ key: 'revenue', label: 'Annual revenue', type: 'number', placeholder: '0' },
			{ key: 'netIncome', label: 'Net income', type: 'number', placeholder: '0' }
		]
	},

	projects: {
		id: 'projects',
		containerId: 'cp-projects-container',
		icon: 'folder',
		untitled: 'Untitled project',
		editorTitle: 'Edit reference project',
		savedMessage: 'Project saved.',
		removedMessage: 'Project removed.',
		emptyTitle: 'No reference projects yet',
		emptyHint: 'Add completed work that proves the company can deliver.',
		list: function() { return DB.referenceProjects || []; },
		create: function() { return { name:'', clientName:'', contractValue:'', location:'', description:'', startDate:'', endDate:'' }; },
		title: function(item) { return item.name; },
		subtitle: function(item) { return item.clientName; },
		chips: function(item) {
			return [
				{ label: item.contractValue, tone: 'accent' },
				{ label: item.location, tone: 'neutral' }
			];
		},
		note: function(item) { return item.description; },
		facts: function(item) {
			return [
				{ label: 'Timeline', value: [item.startDate, item.endDate].filter(Boolean).join(' to ') }
			];
		},
		fields: [
			{ key: 'name', label: 'Project name', span: 2 },
			{ key: 'clientName', label: 'Client' },
			{ key: 'contractValue', label: 'Contract value', placeholder: 'e.g. $4.2M' },
			{ key: 'location', label: 'Location' },
			{ key: 'startDate', label: 'Start date', type: 'date' },
			{ key: 'endDate', label: 'End date', type: 'date' },
			{ key: 'description', label: 'Description / scope', type: 'textarea', rows: 3 }
		]
	}
};

function officeTypeLabel(type) {
	var labels = { branch: 'Branch', satellite: 'Satellite office', warehouse: 'Warehouse', retail: 'Retail location', other: 'Other' };
	return labels[type] || '';
}

function readinessTone(readiness) {
	if (!readiness) return 'neutral';
	if (readiness.indexOf('Ready (Immediate)') === 0 || readiness.indexOf('Ready (< 1') === 0) return 'success';
	if (readiness === 'Not Available') return 'danger';
	return 'warning';
}

var FIELD_GROUPS = {
	'hq-location': {
		id: 'hq-location',
		containerId: 'cp-hq-location',
		icon: 'pin',
		title: 'Headquarters location',
		hint: 'Where the business is registered and reached by post',
		target: function() { return DB.headquarters; },
		titleValue: function(data) { return data.name || 'Headquarters'; },
		subtitle: 'Main office',
		savedMessage: 'Headquarters saved.',
		facts: function(data) {
			return [
				{ label: 'Address', value: [data.address, data.city, data.state, data.postal].filter(Boolean).join(', ') },
				{ label: 'Country', value: data.country }
			];
		},
		fields: [
			{ key: 'name', label: 'Office / location name', span: 2, placeholder: 'e.g. Corporate Headquarters' },
			{ key: 'address', label: 'Street address', span: 2, placeholder: 'Street address, building, suite' },
			{ key: 'city', label: 'City' },
			{ key: 'state', label: 'State / province' },
			{ key: 'postal', label: 'Postal / ZIP code' },
			{ key: 'country', label: 'Country' }
		]
	},

	'hq-channels': {
		id: 'hq-channels',
		containerId: 'cp-hq-channels',
		icon: 'mail',
		title: 'Contact channels',
		hint: 'Used on the profile, invoices and tender documents',
		target: function() { return DB.headquarters; },
		savedMessage: 'Contact channels saved.',
		facts: function(data) {
			return [
				{ label: 'Email', value: data.email },
				{ label: 'Phone', value: data.phone },
				{ label: 'Website', value: data.website }
			];
		},
		fields: [
			{ key: 'email', label: 'Email', type: 'email', span: 2 },
			{ key: 'phone', label: 'Phone', span: 2 },
			{ key: 'website', label: 'Website', type: 'url', span: 2 }
		]
	},

	'billing-address': {
		id: 'billing-address',
		containerId: 'cp-billing-card',
		icon: 'card',
		title: 'Billing address',
		hint: 'Address used for invoicing and financial correspondence',
		target: function() { return DB.billingAddress; },
		savedMessage: 'Billing address saved.',
		chips: function(data) {
			return [{ label: data.sameAsHQ !== false ? 'Same as headquarters' : '', tone: 'success' }];
		},
		bodyHtml: function(data) {
			if (data.sameAsHQ === false) return '';
			var hq = DB.headquarters;
			var addressLine = [hq.address, hq.city, hq.state, hq.postal, hq.country].filter(Boolean).join(', ');
			return '<p class="cp-card-note">' + esc(addressLine || 'No headquarters address recorded yet.') + '</p>';
		},
		facts: function(data) {
			if (data.sameAsHQ !== false) {
				return [{ label: 'Billing email', value: data.email }];
			}
			return [
				{ label: 'Address', value: [data.address, data.city, data.state, data.postal].filter(Boolean).join(', ') },
				{ label: 'Country', value: data.country },
				{ label: 'Billing email', value: data.email }
			];
		},
		fields: [
			{ key: 'sameAsHQ', label: 'Use the headquarters address', type: 'boolean' },
			{ key: 'email', label: 'Billing email', type: 'email' },
			{ key: 'address', label: 'Street address', span: 2 },
			{ key: 'city', label: 'City' },
			{ key: 'state', label: 'State / province' },
			{ key: 'postal', label: 'Postal / ZIP code' },
			{ key: 'country', label: 'Country' }
		]
	},

	'weblink-channels': {
		id: 'weblink-channels',
		containerId: 'cp-weblink-channels',
		icon: 'link',
		title: 'Primary channels',
		hint: 'The links a client should use first',
		target: function() { return DB.weblinks; },
		savedMessage: 'Primary channels saved.',
		facts: function(data) {
			return [
				{ label: 'Website', value: data.website },
				{ label: 'Email', value: data.email },
				{ label: 'LinkedIn', value: data.linkedin }
			];
		},
		fields: [
			{ key: 'website', label: 'Website', type: 'url', span: 2, placeholder: 'https://' },
			{ key: 'email', label: 'Email', type: 'email', span: 2, placeholder: 'info@company.com' },
			{ key: 'linkedin', label: 'LinkedIn', type: 'url', span: 2, placeholder: 'https://linkedin.com/company/' }
		]
	},

	'weblink-social': {
		id: 'weblink-social',
		containerId: 'cp-weblink-social',
		icon: 'share',
		title: 'Social profiles',
		hint: 'Channels the company is active on',
		target: function() { return DB.weblinks; },
		savedMessage: 'Social profiles saved.',
		bodyHtml: function(data) {
			var channels = [
				{ label: 'Facebook', value: data.facebook },
				{ label: 'Instagram', value: data.instagram },
				{ label: 'X / Twitter', value: data.twitter },
				{ label: 'YouTube', value: data.youtube },
				{ label: 'TikTok', value: data.tiktok },
				{ label: 'WhatsApp', value: data.whatsapp }
			];
			var html = '';
			for (var i = 0; i < channels.length; i++) {
				if (!channels[i].value) continue;
				html += '<div class="cp-card-fact"><span class="cp-card-fact-label">' + esc(channels[i].label) + '</span><span class="cp-card-fact-value">' + esc(channels[i].value) + '</span></div>';
			}
			return html ? '<div class="cp-card-facts">' + html + '</div>' : '<p class="cp-card-note">No social profiles recorded yet.</p>';
		},
		fields: [
			{ key: 'facebook', label: 'Facebook', type: 'url', span: 2, placeholder: 'https://facebook.com/' },
			{ key: 'instagram', label: 'Instagram', type: 'url', span: 2, placeholder: 'https://instagram.com/' },
			{ key: 'twitter', label: 'X / Twitter', type: 'url', span: 2, placeholder: 'https://x.com/' },
			{ key: 'youtube', label: 'YouTube', type: 'url', span: 2, placeholder: 'https://youtube.com/@' },
			{ key: 'tiktok', label: 'TikTok', type: 'url', span: 2, placeholder: 'https://tiktok.com/@' },
			{ key: 'whatsapp', label: 'WhatsApp', span: 2, placeholder: 'WhatsApp number or link' }
		]
	},

	'invoice-payment': {
		id: 'invoice-payment',
		containerId: 'cp-invoice-payment-card',
		icon: 'receipt',
		title: 'Payment instructions',
		hint: 'Printed on the invoice as written',
		target: function() { return DB.invoicing; },
		savedMessage: 'Payment instructions saved.',
		note: function(data) { return data.paymentInstructions || 'No payment instructions recorded yet.'; },
		fields: [
			{ key: 'paymentInstructions', label: 'Payment instructions', type: 'textarea', rows: 7, placeholder: 'Bank name, account name, account number, IBAN, SWIFT, payment terms...', help: 'One instruction per line reads best.' }
		]
	},

	'invoice-footer': {
		id: 'invoice-footer',
		containerId: 'cp-invoice-footer-card',
		icon: 'mail',
		title: 'Invoice footer note',
		hint: 'One short line at the bottom of the invoice',
		target: function() { return DB.invoicing; },
		savedMessage: 'Invoice footer note saved.',
		note: function(data) { return data.invoiceFooterNote || 'No footer note recorded yet.'; },
		fields: [
			{ key: 'invoiceFooterNote', label: 'Footer note', span: 2, maxLength: 160, placeholder: 'Registered in Canada - GST/HST number on file', help: '160 characters maximum.' }
		]
	},

	'company-identity': {		id: 'company-identity',
		containerId: 'cp-company-identity',
		icon: 'building',
		title: 'Company identity',
		hint: 'Legal details reused across tenders, contracts and invoices',
		target: function() { return DB.basicInfo; },
		titleValue: function(data) { return data.legalName || data.tradeName; },
		subtitle: 'Legal name',
		autoEditWhenEmpty: true,
		isEmpty: function(data) {
			return !data.legalName && !data.tradeName && !data.companyType && !data.yearEstablished && !data.numEmployees && !data.businessNumber;
		},
		savedMessage: 'Company identity saved.',
		chips: function(data) {
		return [
			{ label: companyTypeLabel(data.companyType), tone: 'accent' },
			{ label: data.numEmployees ? data.numEmployees + ' employees' : '', tone: 'neutral' }
		];
		},
		facts: function(data) {
		return [
			{ label: 'Trade name', value: data.tradeName },
			{ label: 'Established', value: data.yearEstablished },
			{ label: 'Employees', value: data.numEmployees },
			{ label: 'Registration / business number', value: data.businessNumber }
		];
		},
		afterSave: function() {
		// Non-profit and charity records usually work with grants, so offer that area once.
		var companyType = DB.basicInfo.companyType;
		if (companyType !== 'nonprofit' && companyType !== 'registered-charity') return;
		var focus = profileFocusSet();
		if (focus.has('grants')) return;
		focus.add('grants');
		DB.profile.focus = focusToList(focus);
		},
		fields: [
		{ key: 'legalName', label: 'Legal company name', span: 2, placeholder: 'Registered legal name' },
		{ key: 'tradeName', label: 'Trade name / DBA', span: 2, placeholder: 'Doing business as (if different)' },
		{ key: 'companyType', label: 'Company type', type: 'select', options: COMPANY_TYPE_OPTIONS },
		{ key: 'yearEstablished', label: 'Year established', type: 'number', placeholder: 'e.g. 2010' },
		{ key: 'numEmployees', label: 'Number of employees', type: 'number', placeholder: 'e.g. 250' },
		{ key: 'businessNumber', label: 'Registration / business number', span: 2, placeholder: 'Government registration or business number' }
		]
		},

	'industry-classification': {
		id: 'industry-classification',
		containerId: 'cp-industry-classification',
		icon: 'factory',
		title: 'Classification',
		hint: 'How the business describes what it does',
		target: function() { return DB.industryOps; },
		savedMessage: 'Classification saved.',
		chips: function(data) {
			return parseCsv(data.subIndustries).map(function(tag) { return { label: tag, tone: 'accent' }; });
		},
		note: function(data) { return data.specializations || 'No specializations recorded yet.'; },
		facts: function(data) {
			return parseCsv(data.subIndustries).length ? [] : [{ label: 'Sub-industries', value: 'No sub-industries tagged yet' }];
		},
		fields: [
			{ key: 'subIndustries', label: 'Sub-industries', span: 2, placeholder: 'Comma-separated, e.g. Road construction, Bridge building', help: 'Each comma-separated value becomes a tag on the card.' },
			{ key: 'specializations', label: 'Specializations / special notes', type: 'textarea', rows: 3, placeholder: 'Any special expertise, niche focus, or notable capability' }
		]
	},

	'industry-codes': {
		id: 'industry-codes',
		containerId: 'cp-industry-codes',
		icon: 'shield',
		title: 'Procurement codes',
		hint: 'Used to match tender and vendor lists',
		target: function() { return DB.industryOps; },
		savedMessage: 'Procurement codes saved.',
		bodyHtml: function(data) {
			var groups = [
				{ label: 'UNSPSC', value: data.unscspCodes },
				{ label: 'NAICS', value: data.naicsCodes },
				{ label: 'Keywords / tags', value: data.otherKeywords }
			];
			var html = '';
			for (var i = 0; i < groups.length; i++) {
				var tags = parseCsv(groups[i].value);
				if (!tags.length) continue;
				html += '<div class="cp-card-tagrow"><span class="cp-card-tagrow-label">' + esc(groups[i].label) + '</span>' +
					'<div class="cp-card-tags is-inline">' + recordChipsHtml(tags.map(function(tag) { return { label: tag, tone: 'neutral' }; })) + '</div></div>';
			}
			return html || '<p class="cp-card-note">No procurement codes recorded yet. Add UNSPSC, NAICS or search keywords to be matched with tender lists.</p>';
		},
		fields: [
			{ key: 'unscspCodes', label: 'UNSPSC codes', span: 2, placeholder: 'Comma-separated, e.g. 72101500, 72102901' },
			{ key: 'naicsCodes', label: 'NAICS codes', span: 2, placeholder: 'Comma-separated, e.g. 236220, 237310' },
			{ key: 'otherKeywords', label: 'Other keywords / tags', span: 2, placeholder: 'Comma-separated search keywords' }
		]
	},

	'primary-contact': {
		id: 'primary-contact',
		containerId: 'cp-primary-contact-card',
		icon: 'users',
		title: 'Primary contact',
		hint: 'The person a client should reach first',
		target: function() { return DB.contacts.primary; },
		titleValue: function(data) { return data.name; },
		subtitle: 'Primary contact',
		savedMessage: 'Primary contact saved.',
		chips: function(data) { return [{ label: data.title, tone: 'accent' }]; },
		facts: function(data) {
			return [
				{ label: 'Email', value: data.email },
				{ label: 'Phone', value: data.phone },
				{ label: 'LinkedIn', value: data.linkedin }
			];
		},
		fields: [
			{ key: 'name', label: 'Full name', span: 2 },
			{ key: 'title', label: 'Title / position', span: 2 },
			{ key: 'email', label: 'Email', type: 'email' },
			{ key: 'phone', label: 'Phone' },
			{ key: 'linkedin', label: 'LinkedIn URL', type: 'url', span: 2 }
		]
	},

	'financial-position': {
		id: 'financial-position',
		containerId: 'cp-financial-position',
		icon: 'chart',
		title: 'Financial position',
		hint: 'Current balance sheet snapshot',
		target: function() { return DB.financials; },
		savedMessage: 'Financial position saved.',
		facts: function(data) {
			return [
				{ label: 'Current assets', value: formatAmount(data.currentAssets) },
				{ label: 'Current liabilities', value: formatAmount(data.currentLiabilities) },
				{ label: 'Working capital', value: formatAmount(data.workingCapital) }
			];
		},
		fields: [
			{ key: 'currentAssets', label: 'Current assets', type: 'number', placeholder: '0' },
			{ key: 'currentLiabilities', label: 'Current liabilities', type: 'number', placeholder: '0' },
			{ key: 'workingCapital', label: 'Working capital', type: 'number', placeholder: '0' }
		]
	},

	'geographic-coverage': {
		id: 'geographic-coverage',
		containerId: 'cp-geographic-card',
		icon: 'globe',
		title: 'Coverage',
		hint: 'Where the business can take work',
		target: function() { return DB.geographicCoverage; },
		savedMessage: 'Coverage saved.',
		bodyHtml: function(data) {
			function tagRow(label, text, tone) {
				var tags = parseLines(text);
				if (!tags.length) return '';
				var visibleTags = tags.slice(0, 8);
				var hiddenCount = tags.length - visibleTags.length;
				var chips = recordChipsHtml(visibleTags.map(function(tag) { return { label: tag, tone: tone }; }));
				if (hiddenCount > 0) chips += '<span class="cp-tag cp-tag-muted">+' + hiddenCount + ' more</span>';
				return '<div class="cp-card-tagrow"><span class="cp-card-tagrow-label">' + esc(label) + '</span><div class="cp-card-tags is-inline">' + chips + '</div></div>';
			}
			var html = tagRow('Countries', data.countries, 'accent') +
				tagRow('States / provinces', data.states, 'neutral') +
				tagRow('Cities / service areas', data.cities, 'neutral') +
				tagRow('Excluded', data.excluded, 'danger');
			return html || '<p class="cp-card-note">No coverage recorded yet.</p>';
		},
		facts: function(data) {
			return [{ label: 'Service radius / notes', value: data.notes }];
		},
		fields: [
			{ key: 'countries', label: 'Countries', type: 'textarea', rows: 2, placeholder: 'One country per line', help: 'One value per line.' },
			{ key: 'states', label: 'States / provinces', type: 'textarea', rows: 2, placeholder: 'One per line' },
			{ key: 'cities', label: 'Cities / service areas', type: 'textarea', rows: 3, placeholder: 'One per line' },
			{ key: 'excluded', label: 'Excluded cities / areas', type: 'textarea', rows: 2, placeholder: 'One per line' },
			{ key: 'notes', label: 'Service radius / coverage notes', span: 2, placeholder: 'e.g. Within 200km of Vancouver' }
		]
	}
};



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
		// An external change replaces the data, so any open card editor is dropped.
		openRecordViewId = ''; openRecordIndex = -1; recordEditorDraft = null; openFieldGroupId = '';
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
		if (sectionHiddenByProfile(section.id)) profileHidden++;
	}
	var note = el('cp-hidden-note');
	if (note) {
		if (!profileIsConfigured() && !DB.profile.showAllSections) {
			note.textContent = profileHidden + ' sections appear once you choose an industry, template or area';
		} else if (!profileHidden) {
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
	renderFieldGroup('company-identity');
	setVal('f-profile-industry', DB.industryOps.primaryIndustry);
	renderProfileSetup();
}

function readBasicInfo() {
	var b = DB.basicInfo;
	if (el('f-legalName')) b.legalName = val('f-legalName');
	if (el('f-tradeName')) b.tradeName = val('f-tradeName');
	if (el('f-profile-industry')) DB.industryOps.primaryIndustry = val('f-profile-industry');
	if (el('f-companyType')) b.companyType = val('f-companyType');
	if (el('f-yearEstablished')) b.yearEstablished = val('f-yearEstablished');
	if (el('f-numEmployees')) b.numEmployees = val('f-numEmployees');
	if (el('f-businessNumber')) b.businessNumber = val('f-businessNumber');
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
			note.innerHTML = 'Only Basic Information and Brand &amp; Positioning are shown until you choose an industry, a template or an area. Nothing is deleted - the matching sections appear immediately.';
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
	renderBrandAssets();
}

/* ── Brand images ──
   Logo, icon and company images used on documents and listings. They follow
   the same read-card pattern as the other sections: a gallery of saved images
   and one editor at a time. */
var BRAND_IMAGE_KINDS = [
	'Company logo',
	'Logo for dark backgrounds',
	'Logo for light backgrounds',
	'Icon / favicon',
	'Hero / banner',
	'Team photo',
	'Office photo',
	'Product photo',
	'Other'
];
var BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
var brandAssetDraft = null;

function brandAssetKindOptions(selectedKind) {
	var html = '<option value="">Choose an image type</option>';
	for (var i = 0; i < BRAND_IMAGE_KINDS.length; i++) {
		html += '<option value="' + esc(BRAND_IMAGE_KINDS[i]) + '"' + (BRAND_IMAGE_KINDS[i] === selectedKind ? ' selected' : '') + '>' + esc(BRAND_IMAGE_KINDS[i]) + '</option>';
	}
	return html;
}

function brandAssetCardHtml(item, index) {
	return '<article class="cp-brand-card">' +
		'<div class="cp-brand-thumb">' +
			'<img src="' + esc(item.url) + '" alt="' + esc(item.name || 'Brand image') + '">' +
			'<span class="cp-brand-thumb-fallback">' + iconSvg('spark') + 'Preview unavailable</span>' +
		'</div>' +
		'<div class="cp-brand-body">' +
			(item.kind ? '<span class="cp-tag cp-tag-accent">' + esc(item.kind) + '</span>' : '') +
			'<h4 class="cp-brand-name">' + esc(item.name || 'Untitled image') + '</h4>' +
			(item.caption ? '<p class="cp-brand-caption">' + esc(item.caption) + '</p>' : '') +
		'</div>' +
		'<button type="button" class="cp-btn cp-btn-sm cp-card-edit" data-brand-action="edit" data-brand-index="' + index + '">' + iconSvg('pencil') + 'Edit</button>' +
	'</article>';
}

function brandAssetEditorHtml() {
	var item = brandAssetDraft.item;
	var canUpload = typeof tool.requestUpload === 'function';
	var html = '<article class="cp-card cp-card-wide editing" data-brand-editor>' +
		'<header class="cp-card-head">' +
			'<span class="cp-card-avatar is-editing">' + iconSvg('spark') + '</span>' +
			'<div class="cp-card-titles">' +
				'<h4 class="cp-card-title">' + (brandAssetDraft.index === -1 ? 'Add a brand image' : 'Edit brand image') + '</h4>' +
				'<p class="cp-card-sub">The logo and company images used on documents, invoices and listings.</p>' +
			'</div>' +
		'</header>' +
		'<div class="cp-card-form">' +
			'<div class="cp-field"><label class="cp-label" for="bf-kind">Image type</label>' +
				'<select class="cp-input cp-select" id="bf-kind" data-brand-field="kind">' + brandAssetKindOptions(item.kind) + '</select>' +
			'</div>' +
			'<div class="cp-field"><label class="cp-label" for="bf-name">Name</label>' +
				'<input type="text" class="cp-input" id="bf-name" data-brand-field="name" value="' + esc(item.name) + '" placeholder="e.g. ApexCon logo">' +
			'</div>' +
			'<div class="cp-field cp-field-full">' +
				'<span class="cp-label">Image</span>' +
				'<div class="cp-logo-field">' +
					(item.url ? '<div class="cp-logo-preview"><img id="cp-brand-draft-img" src="' + esc(item.url) + '" alt="Brand image preview"><span class="cp-logo-fallback">Preview unavailable - the image link did not load.</span></div>' : '') +
					'<div class="cp-logo-actions">' +
						(canUpload ? '<button type="button" class="cp-btn cp-btn-sm" data-brand-action="upload">' + (item.url ? 'Replace image' : 'Upload image') + '</button>' : '') +
						(!canUpload ? '<div class="cp-logo-url"><label class="cp-label" for="bf-url">Image URL</label><input type="url" class="cp-input" id="bf-url" data-brand-field="url" value="' + esc(item.url) + '" placeholder="https://example.com/logo.png"></div>' : '') +
					'</div>' +
					'<span class="cp-field-help">PNG, JPG, SVG or WebP, up to 5 MB. ' + (canUpload ? 'Uploads go to CMS storage; only the link and the name are saved.' : 'Paste a public image link; only the link is saved.') + '</span>' +
				'</div>' +
			'</div>' +
			'<div class="cp-field cp-field-full"><label class="cp-label" for="bf-caption">Caption</label>' +
				'<input type="text" class="cp-input" id="bf-caption" data-brand-field="caption" maxlength="160" value="' + esc(item.caption) + '" placeholder="Where or how this image is used">' +
			'</div>' +
		'</div>' +
		'<footer class="cp-card-foot">' +
			'<button type="button" class="cp-btn cp-btn-sm cp-btn-danger cp-card-remove" data-brand-action="remove">Remove</button>' +
			'<span class="cp-card-foot-note">Nothing is changed until you save.</span>' +
			'<button type="button" class="cp-btn cp-btn-sm" data-brand-action="cancel">Cancel</button>' +
			'<button type="button" class="cp-btn cp-btn-sm cp-btn-primary" data-brand-action="save">Save</button>' +
		'</footer>' +
	'</article>';
	return html;
}

function renderBrandAssets() {
	var grid = el('cp-brand-assets');
	if (!grid) return;
	var items = DB.brandAssets || [];
	var html = '';
	if (brandAssetDraft && brandAssetDraft.index === -1) html += brandAssetEditorHtml();
	for (var i = 0; i < items.length; i++) {
		if (brandAssetDraft && brandAssetDraft.index === i) {
			html += brandAssetEditorHtml();
		} else {
			html += brandAssetCardHtml(items[i], i);
		}
	}
	if (!html) {
		html = '<div class="cp-record-empty">' +
			'<span class="cp-record-empty-icon">' + iconSvg('spark') + '</span>' +
			'<div class="cp-record-empty-text"><strong>No brand images yet</strong><span>Add the company logo first, then any image used on documents or listings.</span></div>' +
		'</div>';
	}
	grid.innerHTML = html;
	attachBrandImageErrorHandlers();
}

function attachBrandImageErrorHandlers() {
	var images = document.querySelectorAll('#cp-brand-assets .cp-brand-thumb img, #cp-brand-draft-img');
	for (var i = 0; i < images.length; i++) {
		images[i].addEventListener('error', function() {
			var thumb = this.closest('.cp-brand-thumb');
			if (thumb) { thumb.classList.add('is-broken'); return; }
			var preview = this.closest('.cp-logo-preview');
			if (preview) preview.classList.add('is-broken');
		});
	}
}

function addBrandAsset() {
	if (brandAssetDraft) saveBrandAsset(true);
	brandAssetDraft = {
		index: -1,
		item: { id: newId('bi'), kind: 'Company logo', name: '', url: '', caption: '' }
	};
	renderBrandAssets();
	var nameInput = el('bf-name');
	if (nameInput) nameInput.focus({ preventScroll: true });
	var editor = document.querySelector('[data-brand-editor]');
	if (editor && editor.scrollIntoView) editor.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function editBrandAsset(index) {
	var items = DB.brandAssets || [];
	if (index < 0 || index >= items.length) return;
	if (brandAssetDraft) saveBrandAsset(true);
	brandAssetDraft = { index: index, item: JSON.parse(JSON.stringify(items[index])) };
	renderBrandAssets();
	var nameInput = el('bf-name');
	if (nameInput) nameInput.focus({ preventScroll: true });
}

function collectBrandAssetFields() {
	if (!brandAssetDraft) return;
	var editor = document.querySelector('[data-brand-editor]');
	if (!editor) return;
	editor.querySelectorAll('[data-brand-field]').forEach(function(input) {
		brandAssetDraft.item[input.getAttribute('data-brand-field')] = input.value;
	});
}

function saveBrandAsset(silent) {
	if (!brandAssetDraft) return false;
	collectBrandAssetFields();
	if (!String(brandAssetDraft.item.url || '').trim()) {
		if (!silent && tool.notify) tool.notify('Upload or paste an image before saving.', 'warning');
		return false;
	}
	var item = brandAssetDraft.item;
	if (brandAssetDraft.index === -1) {
		DB.brandAssets.push(item);
	} else {
		DB.brandAssets[brandAssetDraft.index] = item;
	}
	saveDB();
	if (!silent && tool.notify) tool.notify('Brand image saved.', 'success');
	closeBrandAssetEditor();
	return true;
}

function closeBrandAssetEditor() {
	brandAssetDraft = null;
	renderBrandAssets();
}

function cancelBrandAsset() {
	closeBrandAssetEditor();
}

function removeBrandAsset(index) {
	var items = DB.brandAssets || [];
	if (index < 0 || index >= items.length) return;
	items.splice(index, 1);
	saveDB();
	closeBrandAssetEditor();
	if (tool.notify) tool.notify('Brand image removed.', 'info');
}

function requestRemoveBrandAsset(button) {
	if (button.getAttribute('data-armed') !== '1') {
		button.setAttribute('data-armed', '1');
		button.textContent = 'Click again to remove';
		return;
	}
	removeBrandAsset(brandAssetDraft ? brandAssetDraft.index : -1);
}

function isAllowedBrandImage(uploadedFile) {
	var fileType = String(uploadedFile.type || '').toLowerCase();
	if (fileType) {
		return fileType === 'image/png' || fileType === 'image/jpeg' || fileType === 'image/svg+xml' || fileType === 'image/webp';
	}
	return /\.(png|jpe?g|svg|webp)$/.test(String(uploadedFile.name || '').toLowerCase());
}

function uploadBrandAssetImage() {
	if (!brandAssetDraft) return;
	if (typeof tool.requestUpload !== 'function') {
		if (tool.notify) tool.notify('Uploads are not enabled - set allowUpload: yes in the field settings.', 'warning');
		return;
	}
	tool.requestUpload('image/*', function(uploadError, uploadedFile) {
		if (uploadError) {
			if (tool.notify) tool.notify('Image upload failed: ' + uploadError, 'error');
			return;
		}
		if (!uploadedFile || !uploadedFile.url) {
			if (tool.notify) tool.notify('No image selected.', 'warning');
			return;
		}
		if (uploadedFile.size && uploadedFile.size > BRAND_IMAGE_MAX_BYTES) {
			if (tool.notify) tool.notify('The image must be 5 MB or smaller.', 'warning');
			return;
		}
		if (!isAllowedBrandImage(uploadedFile)) {
			if (tool.notify) tool.notify('Use a PNG, JPG, SVG or WebP image.', 'warning');
			return;
		}
		collectBrandAssetFields();
		brandAssetDraft.item.url = uploadedFile.url;
		if (!String(brandAssetDraft.item.name || '').trim()) {
			brandAssetDraft.item.name = String(uploadedFile.name || '').replace(/\.[^.]+$/, '');
		}
		renderBrandAssets();
		if (tool.notify) tool.notify('Image added - save the card to keep it.', 'success');
	});
}

function handleBrandAction(button) {
	var action = button.getAttribute('data-brand-action');
	var index = parseInt(button.getAttribute('data-brand-index'), 10);
	if (action === 'edit') editBrandAsset(index);
	else if (action === 'upload') uploadBrandAssetImage();
	else if (action === 'save') saveBrandAsset();
	else if (action === 'cancel') cancelBrandAsset();
	else if (action === 'remove') requestRemoveBrandAsset(button);
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
		if (!body) continue;
		var block = document.createElement('div');
		block.className = 'cp-custom-block' + (fields.length ? '' : ' is-empty');
		block.id = blockId;
		block.innerHTML = fields.length ? (
			'<div class="cp-custom-head">' +
				'<span class="cp-custom-title">Additional details</span>' +
				'<span class="cp-custom-note">Extra fields for this profile</span>' +
			'</div>' + customFieldRowsHtml(section.id, fields) +
			'<button type="button" class="cp-btn cp-btn-add cp-custom-add" data-custom-add="' + esc(section.id) + '">+ Add another detail</button>'
		) : (
			'<button type="button" class="cp-linkbtn cp-custom-add-link" data-custom-add="' + esc(section.id) + '">+ Add a custom detail</button>'
		);
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
	if (labelInput) {
		labelInput.focus({ preventScroll: true });
		var addedRow = labelInput.closest('.cp-custom-row');
		if (addedRow && addedRow.scrollIntoView) addedRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}
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
	renderRecordList('taxes');
}
function addTax() {
	addRecordItem('taxes');
}
function removeTax(idx) {
	removeRecordItem('taxes', idx);
}

/* ── Headquarters ── */
function renderHeadquarters() {
	renderFieldGroup('hq-location');
	renderFieldGroup('hq-channels');
}
function readHeadquarters() {
	// Headquarters is edited through its cards; legacy inputs may still exist.
	if (!el('f-hq-address')) return;
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
	renderRecordList('offices');
}
function addOffice() {
	addRecordItem('offices');
}
function removeOffice(idx) {
	removeRecordItem('offices', idx);
}

/* ── Billing ── */
function renderBilling() {
	renderFieldGroup('billing-address');
}
function readBilling() {
	// Billing is edited through its card; legacy inputs may still exist.
	if (!el('f-billing-same')) return;
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
	renderInvoiceSummary();
	renderFieldGroup('invoice-payment');
	renderFieldGroup('invoice-footer');
	renderInvoiceLogoField();
}

function readInvoicing() {
	// Invoicing is edited through its cards; legacy inputs may still exist.
	if (!el('f-invoice-payment')) return;
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
	renderFieldGroup('geographic-coverage');
	setVal('f-geo-countries', g.countries);
	setVal('f-geo-states', g.states);
	setVal('f-geo-cities', g.cities);
	setVal('f-geo-excluded', g.excluded);
	setVal('f-geo-notes', g.notes);
}
function readGeographic() {
	if (!el('f-geo-countries')) return;
	var g = DB.geographicCoverage;
	g.countries = val('f-geo-countries');
	g.states = val('f-geo-states');
	g.cities = val('f-geo-cities');
	g.excluded = val('f-geo-excluded');
	g.notes = val('f-geo-notes');
}

/* ── Contacts ── */
function renderContacts() {
	renderFieldGroup('primary-contact');
	renderRecordList('contacts');
}
function readPrimaryContact() {
	var p = DB.contacts.primary;
	if (!el('f-primary-name')) return;
	p.name = val('f-primary-name');
	p.title = val('f-primary-title');
	p.email = val('f-primary-email');
	p.phone = val('f-primary-phone');
	p.linkedin = val('f-primary-linkedin');
}
function addContact() {
	addRecordItem('contacts');
}
function removeContact(idx) {
	removeRecordItem('contacts', idx);
}

/* ── Weblinks ── */
function renderWeblinks() {
	renderFieldGroup('weblink-channels');
	renderFieldGroup('weblink-social');
	renderRecordList('othersocial');
	renderRecordList('otherweb');
}
function readWeblinks() {
	// Weblinks are edited through their cards; legacy inputs may still exist.
	if (!el('f-wl-website')) return;
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
	addRecordItem('othersocial');
}
function removeOtherSocial(idx) {
	removeRecordItem('othersocial', idx);
}
function addOtherWeb() {
	addRecordItem('otherweb');
}
function removeOtherWeb(idx) {
	removeRecordItem('otherweb', idx);
}

/* ── Industry ── */
function renderIndustry() {
	renderFieldGroup('industry-classification');
	renderFieldGroup('industry-codes');
	updateIndustryReadout();
	renderRecordList('capabilities');
}
function readIndustry() {
	var o = DB.industryOps;
	if (el('f-industry-sub')) o.subIndustries = val('f-industry-sub');
	if (el('f-industry-specializations')) o.specializations = val('f-industry-specializations');
	if (el('f-unspsc')) o.unscspCodes = val('f-unspsc');
	if (el('f-naics')) o.naicsCodes = val('f-naics');
	if (el('f-otherkeywords')) o.otherKeywords = val('f-otherkeywords');
}

function renderCapabilities() {
	renderRecordList('capabilities');
}
function addCapability() {
	addRecordItem('capabilities');
}
function removeCapability(idx) {
	removeRecordItem('capabilities', idx);
}

/* ── Documents / Certificates ── */
function renderDocuments() {
	renderRecordList('certs');
}
function addCert() {
	addRecordItem('certs');
}
function removeCert(idx) {
	removeRecordItem('certs', idx);
}

/* ── Reference Letters ── */
function renderRefLetters() {
	renderRecordList('refletters');
}
function addRefLetter() {
	addRecordItem('refletters');
}
function removeRefLetter(idx) {
	removeRecordItem('refletters', idx);
}

/* ── Assets: Owned ── */
function renderAssetsOwned() {
	renderRecordList('assets-owned');
}
function addAssetOwned() {
	addRecordItem('assets-owned');
}
function removeAssetOwned(idx) {
	removeRecordItem('assets-owned', idx);
}

/* ── Assets: Partner ── */
function renderAssetsPartner() {
	renderRecordList('assets-partner');
}
function addAssetPartner() {
	addRecordItem('assets-partner');
}
function removeAssetPartner(idx) {
	removeRecordItem('assets-partner', idx);
}

/* ── Human Resources ── */
function renderHR() {
	renderRecordList('hr');
}
function addHR() {
	addRecordItem('hr');
}
function removeHR(idx) {
	removeRecordItem('hr', idx);
}
function addSkill(hrIdx) {
	// Skills are edited inside the staff card; this keeps the old action harmless.
	openRecordEditor('hr', hrIdx);
	addRecordSkill();
}
function removeSkill(hrIdx, skillIdx) {
	openRecordEditor('hr', hrIdx);
	removeRecordSkill(skillIdx);
}

/* ── Financials ── */
function renderFinancials() {
	renderRecordList('revenues');
	renderFieldGroup('financial-position');
}
function readFinancialsSummary() {
	if (!el('f-currentAssets')) return;
	DB.financials.currentAssets = val('f-currentAssets');
	DB.financials.currentLiabilities = val('f-currentLiabilities');
	DB.financials.workingCapital = val('f-workingCapital');
}
function addRevenue() {
	addRecordItem('revenues');
}
function removeRevenue(idx) {
	removeRecordItem('revenues', idx);
}

/* ── Reference Projects ── */
function renderProjects() {
	renderRecordList('projects');
}
function addProject() {
	addRecordItem('projects');
}
function removeProject(idx) {
	removeRecordItem('projects', idx);
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
	var brandButton = e.target.closest('[data-brand-action]');
	if (brandButton) {
		if (!isReadOnly) handleBrandAction(brandButton);
		return;
	}
	var recordButton = e.target.closest('[data-record-action]');
	if (recordButton) {
		if (!isReadOnly) handleRecordAction(recordButton);
		return;
	}
	var groupButton = e.target.closest('[data-group-action]');
	if (groupButton) {
		if (!isReadOnly) handleGroupAction(groupButton);
		return;
	}
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
	case 'add-brand-asset': addBrandAsset(); break;
		case 'remove-project': removeProject(idx); break;
	}
});

/* ── Global Input Change Handler (auto-save) ── */
document.getElementById('app').addEventListener('input', function(e) {
	if (isReadOnly) return;
	var target = e.target;
	if (!target.closest('.cp-input')) return;
	if (target.closest('[data-record-editor], [data-group-editor], [data-brand-editor]')) return;

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
	if (target.closest('[data-record-editor], [data-group-editor], [data-brand-editor]')) return;

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
		brandAssets: { type: 'array' },
		profile: { type: 'object' }
	}
});

tool.declareParams([
	{ name: 'visibleSections', label: 'Visible Sections', type: 'text', default: 'all', hint: 'Comma-separated section IDs, or "all". Sections can also be narrowed by the profile setup (industry and coverage areas). Options: basic,mission,industry,headquarters,offices,billing,geographic,contacts,weblinks,taxes,financials,documents,refletters,assets-owned,assets-partner,hr,projects' }
]);

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', function(e) {
	if (e.key === 'Escape') {
		if (brandAssetDraft) { closeBrandAssetEditor(); return; }
		if (recordEditorDraft) { closeRecordEditor(); return; }
		if (openFieldGroupId) { cancelFieldGroup(openFieldGroupId); return; }
	}
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

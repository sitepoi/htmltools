/* ── Personal Profile ──
   One reusable profile for a person, with sections that adapt to the
   application in front of them (résumé, university, scholarship, immigration,
   volunteer work, portfolio, care forms and so on).
   Built for the UniconHub CMS HTML-tool system.
──────────────────────────────────────── */

/* ── Helpers ── */
function esc(value) {
	return String(value === undefined || value === null ? '' : value)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function el(id) { return document.getElementById(id); }
function val(id) { return (el(id) || {}).value || ''; }
function setVal(id, value) { var node = el(id); if (node) node.value = value === undefined || value === null ? '' : String(value); }
function setChecked(id, checked) { var node = el(id); if (node) node.checked = !!checked; }
function newId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function countWords(text) {
	var trimmed = String(text || '').trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
}
function nowIso() { return new Date().toISOString(); }
function notify(message, severity) {
	if (typeof tool.notify === 'function') tool.notify(message, severity || 'info');
}
function daysUntilDate(isoDate) {
	if (!isoDate) return null;
	var target = new Date(isoDate + 'T00:00:00');
	if (isNaN(target.getTime())) return null;
	var today = new Date();
	today.setHours(0, 0, 0, 0);
	return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function formatShortDate(isoDate) {
	if (!isoDate) return '';
	var parsed = new Date(isoDate + 'T00:00:00');
	if (isNaN(parsed.getTime())) return String(isoDate);
	return parsed.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}
function getUserSafe() {
	try { return typeof tool.getUser === 'function' ? tool.getUser() : null; } catch (error) { return null; }
}

/* ── Sections ──
   `needs` lists the profile focus areas that make a section appear.
   A section without `needs` always appears. */
var SECTIONS = [
	{ id: 'basic',          group: 'Foundation',           icon: 'user',       title: 'Basic Information',            desc: 'Who you are and what this profile is for' },
	{ id: 'summary',        group: 'Foundation',           icon: 'spark',      title: 'Profile Summary',              desc: 'Your headline, story and direction' },
	{ id: 'contact',        group: 'Foundation',           icon: 'mail',       title: 'Contact & Web Presence',       navLabel: 'Contact & Links', desc: 'How you can be reached and found online' },
	{ id: 'languages',      group: 'Foundation',           icon: 'globe',      title: 'Languages',                    desc: 'Spoken and written languages', needs: ['languages', 'university', 'immigration', 'employment', 'scholarship'], count: function () { return DB.languages.length; } },

	{ id: 'personal',       group: 'Identity & Records',   icon: 'shield',     title: 'Personal Details',             desc: 'Private details that only official forms ask for', needs: ['immigration', 'government', 'health'] },
	{ id: 'identity',       group: 'Identity & Records',   icon: 'shield',     title: 'Identity & Status',            desc: 'Identity documents, passport and residency', needs: ['identity', 'immigration', 'government', 'credentials'] },
	{ id: 'documents',      group: 'Identity & Records',   icon: 'folder',     title: 'Documents & Records',          navLabel: 'Documents', desc: 'Reusable documents and expiry dates', needs: ['identity', 'immigration', 'university', 'employment', 'credentials', 'government', 'scholarship'], count: function () { return DB.documents.length; } },
	{ id: 'health',         group: 'Identity & Records',   icon: 'heart',      title: 'Health, Access & Emergency',   desc: 'Medical, insurance and emergency details', needs: ['health', 'immigration'] },

	{ id: 'education',      group: 'Education',            icon: 'book',       title: 'Education',                    desc: 'Schools, programs, grades and coursework', count: function () { return DB.education.length; } },
	{ id: 'testscores',     group: 'Education',            icon: 'chart',      title: 'Test Scores',                  desc: 'Standardized tests and language results', needs: ['tests', 'university', 'scholarship', 'research'], count: function () { return DB.testScores.length; } },
	{ id: 'certifications', group: 'Education',            icon: 'badge',      title: 'Certifications & Licences',    desc: 'Tickets, licences and credentials', needs: ['credentials', 'employment', 'portfolio'], count: function () { return DB.certifications.length; } },

	{ id: 'work',           group: 'Experience',           icon: 'briefcase',  title: 'Work Experience',              desc: 'Paid, freelance and internship roles', needs: ['employment', 'research', 'credentials'], count: function () { return DB.workExperience.length; } },
	{ id: 'skills',         group: 'Experience',           icon: 'tools',      title: 'Skills & Strengths',           desc: 'What you can do and the evidence', count: function () { return DB.skills.length; } },
	{ id: 'projects',       group: 'Experience',           icon: 'layers',     title: 'Projects & Portfolio',         desc: 'Work you built and the result', needs: ['portfolio', 'employment', 'university', 'research'], count: function () { return DB.projects.length; } },
	{ id: 'publications',   group: 'Experience',           icon: 'document',   title: 'Research & Publications',      desc: 'Papers, reports, theses and patents', needs: ['research', 'university', 'scholarship'], count: function () { return DB.publications.length; } },
	{ id: 'achievements',   group: 'Experience',           icon: 'award',      title: 'Awards & Achievements',        navLabel: 'Awards', desc: 'Recognition, results and honours', needs: ['university', 'scholarship', 'portfolio', 'employment', 'research'], count: function () { return DB.achievements.length; } },
	{ id: 'volunteer',      group: 'Experience',           icon: 'hands',      title: 'Volunteer & Community',        navLabel: 'Volunteering', desc: 'Service, causes and documented hours', needs: ['community', 'university', 'scholarship', 'volunteer'], count: function () { return DB.volunteer.length; } },
	{ id: 'extracurricular',group: 'Experience',           icon: 'users',      title: 'Activities & Leadership',      navLabel: 'Activities', desc: 'Clubs, teams, societies and leadership', needs: ['university', 'scholarship', 'community'], count: function () { return DB.extracurricular.length; } },

	{ id: 'references',     group: 'Applications',         icon: 'message',    title: 'References',                   desc: 'People who can speak about your work', needs: ['employment', 'university', 'scholarship', 'community', 'volunteer', 'credentials'], count: function () { return DB.references.length; } },
	{ id: 'essays',         group: 'Applications',         icon: 'pen',        title: 'Essays & Statements',          desc: 'A reusable bank of written material', needs: ['university', 'scholarship', 'research'], count: function () { return DB.essays.length; } },
	{ id: 'preferences',    group: 'Applications',         icon: 'target',     title: 'Goals & Preferences',          desc: 'What you are looking for next', needs: ['employment', 'university', 'immigration', 'scholarship'] },
{ id: 'funding',        group: 'Applications',         icon: 'wallet',     title: 'Funding & Financial Aid',      navLabel: 'Funding & Aid', desc: 'What funding you need and target', needs: ['scholarship', 'university', 'research'] }
];

/* ── Profile uses (drive the suggested section set) ── */
var PROFILE_KINDS = [
	{ id: 'general',     label: 'General personal profile', desc: 'A little of everything, kept ready for any form',      preset: [] },
	{ id: 'resume',      label: 'Résumé / CV',              desc: 'Work history, skills, education and references',       preset: ['employment', 'credentials', 'identity'] },
	{ id: 'job',         label: 'Job application',          desc: 'Résumé plus role preferences and licences',            preset: ['employment', 'credentials', 'identity'] },
	{ id: 'university',  label: 'University application',   desc: 'Education, test scores, activities and essays',        preset: ['university', 'tests', 'community'] },
	{ id: 'scholarship', label: 'Scholarship / fellowship', desc: 'Achievements, essays, service and funding',            preset: ['scholarship', 'research', 'community', 'tests'] },
	{ id: 'research',    label: 'Research & grants',        desc: 'Publications, projects and academic references',       preset: ['research', 'scholarship', 'university'] },
	{ id: 'volunteer',   label: 'Volunteer application',    desc: 'Service history, references and languages',            preset: ['volunteer', 'community', 'identity'] },
	{ id: 'portfolio',   label: 'Creative portfolio',       desc: 'Projects, recognition and links',                      preset: ['portfolio', 'employment', 'community'] },
	{ id: 'immigration', label: 'Immigration & relocation', desc: 'Identity, status, health and languages',               preset: ['immigration', 'identity', 'health', 'languages'] },
	{ id: 'government',  label: 'Government forms',         desc: 'Identity, residency and supporting records',           preset: ['government', 'identity', 'immigration'] },
	{ id: 'health',      label: 'Health & care forms',      desc: 'Medical details, insurance and emergency contact',     preset: ['health', 'identity', 'employment'] }
];

/* ── Focus areas (what the profile covers) ── */
var PROFILE_FOCUS_AREAS = [
	{ id: 'employment',  label: 'Jobs & résumés',          desc: 'Work history, skills and references' },
	{ id: 'credentials', label: 'Licences & credentials',  desc: 'Certifications, registration and compliance' },
	{ id: 'identity',    label: 'Identity & status',       desc: 'Identity numbers, citizenship and residency' },
	{ id: 'immigration', label: 'Immigration & relocation',desc: 'Permits, visas and moving abroad' },
	{ id: 'university',  label: 'University applications', desc: 'Education, tests, activities and essays' },
	{ id: 'scholarship', label: 'Scholarships & awards',   desc: 'Achievements, essays and funding' },
	{ id: 'research',    label: 'Research & grants',       desc: 'Publications, projects and academic references' },
	{ id: 'portfolio',   label: 'Creative portfolio',      desc: 'Projects, portfolio links and recognition' },
	{ id: 'community',   label: 'Community involvement',   desc: 'Volunteering, leadership and service' },
	{ id: 'volunteer',   label: 'Volunteer applications',  desc: 'Service history and references' },
	{ id: 'tests',       label: 'Standardized tests',      desc: 'Test scores and language evidence' },
	{ id: 'languages',   label: 'Languages',               desc: 'Spoken and written languages' },
	{ id: 'health',      label: 'Health & care',           desc: 'Medical, insurance and emergency details' },
	{ id: 'government',  label: 'Government forms',        desc: 'Identity and residency declarations' }
];

/* ── Dropdown options ── */
var PRONOUN_OPTIONS = ['', 'She / her', 'He / him', 'They / them', 'Prefer not to say'];
var GENDER_OPTIONS = ['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'];
var MARITAL_OPTIONS = ['', 'Single', 'Married', 'Common-law', 'Divorced', 'Widowed', 'Prefer not to say'];
var ID_TYPE_OPTIONS = ['', 'Passport', 'National ID card', 'Driver licence', 'Health card', 'Birth certificate', 'Other'];
var STATUS_TYPE_OPTIONS = ['', 'Citizen', 'Permanent resident', 'Work permit', 'Study permit', 'Visitor', 'Protected person', 'Other'];
var BLOOD_TYPE_OPTIONS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
var EDUCATION_CREDENTIALS = ['', 'High school diploma', 'Certificate', 'Diploma', 'Associate degree', 'Bachelor degree', 'Postgraduate diploma', 'Master degree', 'Doctorate', 'Professional degree', 'Trade certification', 'Other'];
var EDUCATION_STATUS = ['', 'Completed', 'In progress', 'Expected', 'Withdrawn'];
var TEST_OPTIONS = ['', 'SAT', 'ACT', 'IELTS', 'TOEFL iBT', 'Duolingo English Test', 'PTE Academic', 'GRE', 'GMAT', 'LSAT', 'MCAT', 'Subject test', 'Other'];
var EMPLOYMENT_TYPES = ['', 'Full-time', 'Part-time', 'Contract', 'Internship', 'Apprenticeship', 'Freelance', 'Self-employed', 'Volunteer'];
var WORK_MODES = ['', 'On-site', 'Hybrid', 'Remote'];
var SKILL_CATEGORIES = ['', 'Technical', 'Software & tools', 'Communication', 'Leadership', 'Design', 'Trades', 'Analytical', 'Customer service', 'Language', 'Other'];
var SKILL_LEVELS = ['', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
var LANGUAGE_LEVELS = ['', 'Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'];
var PUBLICATION_TYPES = ['', 'Journal article', 'Conference paper', 'Book or chapter', 'Thesis', 'Report', 'Patent', 'Other'];
var ACHIEVEMENT_LEVELS = ['', 'School', 'Regional', 'National', 'International', 'Professional'];
var ESSAY_TYPES = ['', 'Personal statement', 'Statement of purpose', 'Cover letter', 'Scholarship essay', 'Diversity statement', 'Research proposal', 'Other'];
var ESSAY_STATUS = ['', 'Draft', 'In review', 'Final'];
var REFERENCE_PERMISSION = ['', 'Permission given', 'Ask before contacting', 'Do not contact'];
var DOCUMENT_TYPES = ['', 'Passport', 'National ID', 'Birth certificate', 'Transcript', 'Diploma or certificate', 'Test score report', 'Employment letter', 'Reference letter', 'Police clearance', 'Medical record', 'Insurance', 'Financial statement', 'Other'];

/* ── Icons (inline, no external library) ── */
var ICON_PATHS = {
	user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0"/>',
	spark: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z"/>',
	mail: '<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="m3.6 7 8.4 6 8.4-6"/>',
	globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z"/>',
	shield: '<path d="M12 3.2 19 6v6.1c0 4.4-2.9 7.6-7 8.9-4.1-1.3-7-4.5-7-8.9V6l7-2.8Z"/><path d="m9 12 2.1 2.1L15.4 10"/>',
	folder: '<path d="M3 7.2a2 2 0 0 1 2-2h3.6l2 2.2H19a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.2Z"/>',
	heart: '<path d="M12 20.3S4 15.2 4 9.8A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.8c0 5.4-8 10.5-8 10.5Z"/>',
	book: '<path d="M4 5.5A2 2 0 0 1 6 3.5h5v17H6a2 2 0 0 1-2-2v-13Z"/><path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 0 2-2v-13Z"/>',
	chart: '<path d="M4 20V4M4 20h16"/><path d="M8 20v-5M12.5 20V9M17 20v-7.5"/>',
	badge: '<circle cx="12" cy="9" r="5.2"/><path d="m8.6 13.6-1.4 6.9 4.8-2.6 4.8 2.6-1.4-6.9"/>',
	briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18"/>',
	tools: '<path d="m14.5 6.5 3-3 3 3-3 3"/><path d="m16.5 8.5-9.8 9.8a2.1 2.1 0 0 1-3-3L13.5 5.5"/><path d="m5.5 15.5 3 3"/>',
	layers: '<path d="m12 3.5 8.5 4.4-8.5 4.4-8.5-4.4L12 3.5Z"/><path d="m4 12.4 8 4.2 8-4.2M4 16.6l8 4.2 8-4.2"/>',
	document: '<path d="M6 3.5h8l4 4v13H6v-17Z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6M9 8.5h2.5"/>',
	award: '<circle cx="12" cy="9" r="5.4"/><path d="m8.4 13.4-1.6 7 5.2-2.9 5.2 2.9-1.6-7"/>',
	hands: '<path d="M7 20.5V12l2.4-3.2a1.5 1.5 0 0 1 2.4 1.8L10.6 13"/><path d="M17 20.5V12l-2.4-3.2a1.5 1.5 0 0 0-2.4 1.8L13.4 13"/><path d="M3.5 13.5v7h17v-7"/>',
	users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0"/><path d="M15.5 5.2a3.4 3.4 0 0 1 0 5.6M17.2 14.6a6.2 6.2 0 0 1 4 5.6"/>',
	message: '<path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 9.5h8M8 12.8h5"/>',
	pen: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m15 6.5 3 3"/>',
	target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
	wallet: '<rect x="3" y="6" width="18" height="13" rx="2.4"/><path d="M3 10h18M16.5 14.5h1.5"/>',
	share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="m8.2 10.9 7.6-3.7M8.2 13.1l7.6 3.7"/>',
	copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5"/>',
	download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15"/>',
	upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M4.5 19.5h15"/>',
	check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
	warning: '<path d="M12 4.5 21 20H3L12 4.5Z"/><path d="M12 9.5v4.5M12 16.8h.01"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	pencil: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m15 6.5 3 3"/>',
	chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
	chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
	chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
	moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.6 8.6 0 1 0 10.5 10.5Z"/>'
};
function iconSvg(name) {
	var body = ICON_PATHS[name];
	if (!body) return '';
	return '<svg class="pp-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
}

/* ── Default data ── */
var CURRENT_SCHEMA_VERSION = 1;
var EXPORT_SENSITIVE_DEFAULT = false;

function emptyDB() {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		basicInfo: { legalName: '', preferredName: '', photoUrl: '', photoName: '' },
		personal: { birthYear: '', dateOfBirth: '', placeOfBirth: '', nationality: '', citizenship: '', maritalStatus: '', gender: '', pronouns: '' },
		summary: { headline: '', summary: '', objectives: '', values: '', interests: '' },
		contact: { email: '', phone: '', altPhone: '', address: '', city: '', state: '', postal: '', country: '', timeZone: '', website: '', linkedin: '', github: '', links: [] },
		identity: { idType: '', idNumber: '', idIssuedBy: '', idIssueDate: '', idExpiry: '', taxIdNumber: '', passportNumber: '', passportCountry: '', passportIssueDate: '', passportExpiry: '', statusType: '', statusDetail: '', statusExpiry: '', notes: '' },
		documents: [],
		health: { bloodType: '', allergies: '', conditions: '', medications: '', accessibilityNeeds: '', accommodations: '', insuranceProvider: '', policyNumber: '', insuranceExpiry: '', emergencyName: '', emergencyRelationship: '', emergencyPhone: '', emergencyEmail: '', notes: '' },
		education: [],
		testScores: [],
		certifications: [],
		workExperience: [],
		skills: [],
		projects: [],
		publications: [],
		achievements: [],
		volunteer: [],
		extracurricular: [],
		references: [],
		essays: [],
		languages: [],
		preferences: { jobTitles: '', jobIndustries: '', jobLocations: '', workModes: '', salaryExpectation: '', currency: '', availability: '', noticePeriod: '', studyFields: '', studyPrograms: '', studyCountries: '', studyIntake: '', relocationCountries: '', relocationCities: '', relocationTimeFrame: '' },
		funding: { needsAid: false, sponsorship: '', householdSize: '', scholarshipTargets: '', financialNotes: '' },
		profile: {
			kind: '',
			kindChosen: false,
			focus: [],
			presetFocus: [],
			showAllSections: false,
			initialized: false,
			prefilledFromAccount: false,
			exportIncludeSensitive: EXPORT_SENSITIVE_DEFAULT,
			customFields: {},
			customSections: [],
			updatedAt: ''
		}
	};
}

var DB = emptyDB();
var isReadOnly = false;
var saveTimeout = null;
var selfSaving = false;
var lastStagedJson = '';
var visibleSections = null;
var currentSection = null;
var modalCallback = null;
var _editingArrayItem = {};

/* ── Data loading and normalisation ── */
function deepMerge(target, source) {
	var merged = {};
	var keys = Object.keys(target).concat(Object.keys(source));
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (merged[key] !== undefined) continue;
		var targetValue = target[key];
		var sourceValue = source[key];
		if (sourceValue === undefined) { merged[key] = targetValue; continue; }
		if (targetValue === undefined) { merged[key] = sourceValue; continue; }
		if (Array.isArray(targetValue) && Array.isArray(sourceValue)) { merged[key] = sourceValue; continue; }
		if (typeof targetValue === 'object' && targetValue !== null && typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(targetValue)) {
			merged[key] = deepMerge(targetValue, sourceValue);
		} else {
			merged[key] = sourceValue;
		}
	}
	return merged;
}

function normalizeList(list, requiredFields) {
	if (!Array.isArray(list)) return [];
	var cleaned = [];
	list.forEach(function (item) {
		if (!item || typeof item !== 'object') return;
		var copy = {};
		Object.keys(item).forEach(function (key) { copy[key] = item[key] === undefined || item[key] === null ? '' : item[key]; });
		if (!copy.id) copy.id = newId('item');
		requiredFields.forEach(function (field) { if (copy[field] === undefined) copy[field] = ''; });
		cleaned.push(copy);
	});
	return cleaned;
}

function normalizeCustomFields(fields) {
	if (!Array.isArray(fields)) return [];
	var seen = {};
	return fields.filter(function (field) {
		if (!field || typeof field !== 'object') return false;
		if (!field.id || seen[field.id]) field.id = newId('cf');
		seen[field.id] = true;
		field.label = String(field.label || '').slice(0, 120);
		field.type = customFieldTypeById(field.type).id;
		field.value = field.value === undefined || field.value === null ? '' : String(field.value);
		return true;
	});
}

function normalizeDB() {
	DB.schemaVersion = CURRENT_SCHEMA_VERSION;
	// Private personal details used to sit in basicInfo. Move them once so old
	// records keep their values, and never ask for them on the first screen.
	if (!DB.personal || typeof DB.personal !== 'object' || Array.isArray(DB.personal)) DB.personal = emptyDB().personal;
	['birthYear', 'dateOfBirth', 'placeOfBirth', 'nationality', 'citizenship', 'maritalStatus', 'gender', 'pronouns'].forEach(function (key) {
		if (!DB.personal[key] && DB.basicInfo[key]) DB.personal[key] = DB.basicInfo[key];
		delete DB.basicInfo[key];
	});
	if (!DB.personal.birthYear && DB.personal.dateOfBirth) DB.personal.birthYear = String(DB.personal.dateOfBirth).slice(0, 4);
	DB.documents = normalizeList(DB.documents, ['title', 'type', 'number', 'issuedBy', 'issueDate', 'expiryDate', 'fileName', 'fileUrl', 'notes']);
	DB.education = normalizeList(DB.education, ['institution', 'credential', 'program', 'fieldOfStudy', 'status', 'startDate', 'endDate', 'gpa', 'gpaScale', 'honors', 'city', 'country', 'coursework', 'notes']);
	DB.testScores = normalizeList(DB.testScores, ['test', 'score', 'maxScore', 'date', 'expiryDate', 'referenceNumber', 'notes']);
	DB.certifications = normalizeList(DB.certifications, ['name', 'issuer', 'credentialId', 'issueDate', 'expiryDate', 'url', 'notes']);
	DB.workExperience = normalizeList(DB.workExperience, ['employer', 'title', 'employmentType', 'location', 'workMode', 'startDate', 'endDate', 'summary', 'achievements', 'skills']);
	DB.workExperience.forEach(function (role) { role.current = role.current === true; });
	DB.skills = normalizeList(DB.skills, ['name', 'category', 'level', 'years', 'evidence']);
	DB.projects = normalizeList(DB.projects, ['name', 'role', 'startDate', 'endDate', 'description', 'tools', 'outcome', 'url']);
	DB.publications = normalizeList(DB.publications, ['title', 'type', 'venue', 'date', 'authors', 'identifier', 'url']);
	DB.achievements = normalizeList(DB.achievements, ['title', 'issuer', 'date', 'level', 'description', 'evidenceUrl']);
	DB.volunteer = normalizeList(DB.volunteer, ['organization', 'role', 'cause', 'startDate', 'endDate', 'hours', 'description', 'referenceName', 'referenceEmail']);
	DB.extracurricular = normalizeList(DB.extracurricular, ['activity', 'role', 'organization', 'startDate', 'endDate', 'description']);
	DB.references = normalizeList(DB.references, ['name', 'title', 'organization', 'relationship', 'email', 'phone', 'yearsKnown', 'permission', 'notes']);
	DB.essays = normalizeList(DB.essays, ['title', 'type', 'target', 'status', 'content']);
	DB.languages = normalizeList(DB.languages, ['language', 'speaking', 'writing', 'reading', 'certification', 'notes']);
	DB.contact.links = normalizeList(DB.contact.links, ['label', 'url']);

	if (!DB.profile || typeof DB.profile !== 'object' || Array.isArray(DB.profile)) DB.profile = emptyDB().profile;
	if (!Array.isArray(DB.profile.focus)) DB.profile.focus = [];
	if (!Array.isArray(DB.profile.presetFocus)) DB.profile.presetFocus = [];
	if (DB.profile.showAllSections !== true) DB.profile.showAllSections = false;
	if (DB.profile.kind && !profileKindById(DB.profile.kind)) DB.profile.kind = 'general';
	if (DB.profile.kindChosen !== true) DB.profile.kindChosen = false;
	if (DB.profile.exportIncludeSensitive !== true) DB.profile.exportIncludeSensitive = false;
	if (!DB.profile.customFields || typeof DB.profile.customFields !== 'object' || Array.isArray(DB.profile.customFields)) DB.profile.customFields = {};
	Object.keys(DB.profile.customFields).forEach(function (owner) {
		DB.profile.customFields[owner] = normalizeCustomFields(DB.profile.customFields[owner]);
	});
	if (!Array.isArray(DB.profile.customSections)) DB.profile.customSections = [];
	var seenSectionIds = {};
	DB.profile.customSections = DB.profile.customSections.filter(function (section) {
		if (!section || typeof section !== 'object') return false;
		if (!section.id || seenSectionIds[section.id]) section.id = newId('cs');
		seenSectionIds[section.id] = true;
		section.title = String(section.title || 'Custom section').slice(0, 80);
		section.description = String(section.description || '').slice(0, 300);
		section.fields = normalizeCustomFields(section.fields);
		return true;
	});
}

function loadDB(value) {
	DB = value && typeof value === 'object' ? deepMerge(emptyDB(), value) : emptyDB();
	normalizeDB();
	ensureProfileDefaults();
}

/* Seeds the section set once: params first, then the saved choice. */
function ensureProfileDefaults() {
	if (DB.profile.initialized) return;
	DB.profile.initialized = true;
	var defaultKind = String(tool.param('defaultKind', '') || '').trim().toLowerCase();
	if (defaultKind && profileKindById(defaultKind)) {
		DB.profile.kind = defaultKind;
		DB.profile.kindChosen = true;
	}
	var kind = profileKindById(DB.profile.kind);
	var defaultFocus = String(tool.param('defaultFocus', '') || '').trim();
	if (defaultFocus) {
		var selected = [];
		defaultFocus.split(',').forEach(function (token) {
			var focusArea = focusAreaById(token.trim().toLowerCase());
			if (focusArea && selected.indexOf(focusArea.id) === -1) selected.push(focusArea.id);
		});
		if (selected.length) {
			DB.profile.focus = selected;
			DB.profile.presetFocus = selected.slice();
		}
	} else if (!DB.profile.focus.length && kind) {
		DB.profile.focus = kind.preset.slice();
		DB.profile.presetFocus = kind.preset.slice();
	}
}

/* ── Lookups ── */
function sectionById(sectionId) {
	for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === sectionId) return SECTIONS[i];
	return null;
}
function profileKindById(kindId) {
	for (var i = 0; i < PROFILE_KINDS.length; i++) if (PROFILE_KINDS[i].id === kindId) return PROFILE_KINDS[i];
	return null;
}
function profileKindLabel(kindId) {
	var kind = profileKindById(kindId);
	return kind ? kind.label : '';
}
function focusAreaById(areaId) {
	for (var i = 0; i < PROFILE_FOCUS_AREAS.length; i++) if (PROFILE_FOCUS_AREAS[i].id === areaId) return PROFILE_FOCUS_AREAS[i];
	return null;
}
function findCustomSection(sectionId) {
	var list = (DB.profile && DB.profile.customSections) || [];
	for (var i = 0; i < list.length; i++) if (list[i].id === sectionId) return list[i];
	return null;
}
function customFieldListFor(owner) {
	if (owner.indexOf('custom:') === 0) {
		var customSection = findCustomSection(owner.slice(7));
		if (!customSection) return [];
		if (!Array.isArray(customSection.fields)) customSection.fields = [];
		return customSection.fields;
	}
	if (!DB.profile.customFields) DB.profile.customFields = {};
	if (!DB.profile.customFields[owner]) DB.profile.customFields[owner] = [];
	return DB.profile.customFields[owner];
}
function customFieldTypeById(typeId) {
	var types = [{ id: 'text' }, { id: 'textarea' }, { id: 'number' }, { id: 'date' }, { id: 'url' }, { id: 'email' }];
	for (var i = 0; i < types.length; i++) if (types[i].id === typeId) return types[i];
	return types[0];
}

/* ── Visibility ── */
function parseVisibleSections() {
	var raw = String(tool.param('visibleSections', 'all') || 'all').trim();
	if (!raw || raw === 'all' || raw === '*') { visibleSections = null; return; }
	visibleSections = {};
	raw.split(',').forEach(function (token) { if (token.trim()) visibleSections[token.trim().toLowerCase()] = true; });
}
function profileFocusSet() {
	var set = {};
	(DB.profile.focus || []).forEach(function (areaId) { set[areaId] = true; });
	return set;
}
function focusToList(focusSet) {
	var out = [];
	PROFILE_FOCUS_AREAS.forEach(function (area) { if (focusSet[area.id]) out.push(area.id); });
	// Keep identifiers this build does not know (forward compatibility), but
	// never re-add a known area that the user has just switched off.
	Object.keys(focusSet).forEach(function (areaId) {
		if (out.indexOf(areaId) === -1 && !focusAreaById(areaId)) out.push(areaId);
	});
	return out;
}
function profileIsConfigured() {
	return DB.profile.kindChosen === true || DB.profile.focus.length > 0;
}
function sectionMatchesProfile(sectionId) {
	var section = sectionById(sectionId);
	if (!section || !section.needs || !section.needs.length) return true;
	// Before a profile use or focus area is chosen, only the basic sections
	// show. Everything else appears when a related profile needs it.
	if (!profileIsConfigured()) return false;
	var focus = profileFocusSet();
	for (var i = 0; i < section.needs.length; i++) if (focus[section.needs[i]]) return true;
	return false;
}
function isSectionVisible(sectionId) {
	if (sectionId.indexOf('custom-') === 0) return true;
	if (visibleSections && !visibleSections[sectionId]) return false;
	if (DB.profile.showAllSections) return true;
	return sectionMatchesProfile(sectionId);
}
function visibleSectionList() {
	var list = [];
	SECTIONS.forEach(function (section) { if (isSectionVisible(section.id)) list.push(section.id); });
	(DB.profile.customSections || []).forEach(function (section) { list.push('custom-' + section.id); });
	return list;
}
function sameStringList(left, right) {
	if (left.length !== right.length) return false;
	var lookup = {};
	left.forEach(function (value) { lookup[value] = true; });
	for (var i = 0; i < right.length; i++) if (!lookup[right[i]]) return false;
	return true;
}
function applyKindPreset(force) {
	var kind = profileKindById(DB.profile.kind);
	var preset = kind ? kind.preset.slice() : [];
	var current = (DB.profile.focus || []).slice();
	var untouched = sameStringList(current, (DB.profile.presetFocus || []).slice());
	DB.profile.presetFocus = preset.slice();
	if (force || untouched) {
		DB.profile.focus = preset.slice();
		return true;
	}
	return false;
}
function toggleFocusArea(areaId) {
	var focus = profileFocusSet();
	if (focus[areaId]) delete focus[areaId]; else focus[areaId] = true;
	DB.profile.focus = focusToList(focus);
	DB.profile.updatedAt = nowIso();
	saveNow();
	renderProfileSetup();
	buildNav();
	syncSectionVisibility();
	updateCompletion();
}
function toggleShowAllSections() {
	DB.profile.showAllSections = !DB.profile.showAllSections;
	saveNow();
	renderProfileSetup();
	buildNav();
	syncSectionVisibility();
	updateCompletion();
}

/* ── Persistence ── */
function scheduleSave() {
	clearTimeout(saveTimeout);
	var indicator = el('pp-save-indicator');
	if (indicator) indicator.className = 'pp-save-indicator saving';
	saveTimeout = setTimeout(function () {
		readAllFromDOM();
		persistValue();
		if (indicator) indicator.className = 'pp-save-indicator';
		updateCompletion();
		updateHeaderName();
		buildNav();
		if (currentSection === 'documents' || currentSection === 'certifications') renderDocumentsAlert();
		if (isDrawerOpen()) renderShare();
	}, 400);
}
function saveNow() {
	clearTimeout(saveTimeout);
	readAllFromDOM();
	persistValue();
	var indicator = el('pp-save-indicator');
	if (indicator) indicator.className = 'pp-save-indicator';
	updateCompletion();
	updateHeaderName();
	renderDocumentsAlert();
}
function persistValue() {
	selfSaving = true;
	lastStagedJson = JSON.stringify(DB);
	try { tool.setValue(DB); } catch (error) { /* the host reports write problems itself */ }
	selfSaving = false;
}

/* ── Scalar fields ──
   One table drives both reading and rendering, so a new field is one line. */
var SCALAR_FIELDS = [
	['f-legalName', 'basicInfo', 'legalName'],
	['f-preferredName', 'basicInfo', 'preferredName'],
	['f-photoUrl', 'basicInfo', 'photoUrl'],

	['f-birthYear', 'personal', 'birthYear'],
	['f-dateOfBirth', 'personal', 'dateOfBirth'],
	['f-placeOfBirth', 'personal', 'placeOfBirth'],
	['f-nationality', 'personal', 'nationality'],
	['f-citizenship', 'personal', 'citizenship'],
	['f-maritalStatus', 'personal', 'maritalStatus'],
	['f-gender', 'personal', 'gender'],
	['f-pronouns', 'personal', 'pronouns'],

	['f-email', 'contact', 'email'],
	['f-phone', 'contact', 'phone'],
	['f-altPhone', 'contact', 'altPhone'],
	['f-address', 'contact', 'address'],
	['f-city', 'contact', 'city'],
	['f-state', 'contact', 'state'],
	['f-postal', 'contact', 'postal'],
	['f-country', 'contact', 'country'],
	['f-timeZone', 'contact', 'timeZone'],
	['f-website', 'contact', 'website'],
	['f-linkedin', 'contact', 'linkedin'],
	['f-github', 'contact', 'github'],

	['f-idType', 'identity', 'idType'],
	['f-idNumber', 'identity', 'idNumber'],
	['f-idIssuedBy', 'identity', 'idIssuedBy'],
	['f-idIssueDate', 'identity', 'idIssueDate'],
	['f-idExpiry', 'identity', 'idExpiry'],
	['f-taxIdNumber', 'identity', 'taxIdNumber'],
	['f-passportNumber', 'identity', 'passportNumber'],
	['f-passportCountry', 'identity', 'passportCountry'],
	['f-passportIssueDate', 'identity', 'passportIssueDate'],
	['f-passportExpiry', 'identity', 'passportExpiry'],
	['f-statusType', 'identity', 'statusType'],
	['f-statusDetail', 'identity', 'statusDetail'],
	['f-statusExpiry', 'identity', 'statusExpiry'],
	['f-identityNotes', 'identity', 'notes'],

	['f-bloodType', 'health', 'bloodType'],
	['f-allergies', 'health', 'allergies'],
	['f-conditions', 'health', 'conditions'],
	['f-medications', 'health', 'medications'],
	['f-accessibilityNeeds', 'health', 'accessibilityNeeds'],
	['f-accommodations', 'health', 'accommodations'],
	['f-insuranceProvider', 'health', 'insuranceProvider'],
	['f-policyNumber', 'health', 'policyNumber'],
	['f-insuranceExpiry', 'health', 'insuranceExpiry'],
	['f-emergencyName', 'health', 'emergencyName'],
	['f-emergencyRelationship', 'health', 'emergencyRelationship'],
	['f-emergencyPhone', 'health', 'emergencyPhone'],
	['f-emergencyEmail', 'health', 'emergencyEmail'],
	['f-healthNotes', 'health', 'notes'],

	['f-jobTitles', 'preferences', 'jobTitles'],
	['f-jobIndustries', 'preferences', 'jobIndustries'],
	['f-jobLocations', 'preferences', 'jobLocations'],
	['f-workModes', 'preferences', 'workModes'],
	['f-salaryExpectation', 'preferences', 'salaryExpectation'],
	['f-currency', 'preferences', 'currency'],
	['f-availability', 'preferences', 'availability'],
	['f-noticePeriod', 'preferences', 'noticePeriod'],
	['f-studyFields', 'preferences', 'studyFields'],
	['f-studyPrograms', 'preferences', 'studyPrograms'],
	['f-studyCountries', 'preferences', 'studyCountries'],
	['f-studyIntake', 'preferences', 'studyIntake'],
	['f-relocationCountries', 'preferences', 'relocationCountries'],
	['f-relocationCities', 'preferences', 'relocationCities'],
	['f-relocationTimeFrame', 'preferences', 'relocationTimeFrame'],

	['f-sponsorship', 'funding', 'sponsorship'],
	['f-householdSize', 'funding', 'householdSize'],
	['f-scholarshipTargets', 'funding', 'scholarshipTargets'],
	['f-financialNotes', 'funding', 'financialNotes']
];

function readScalarFields() {
	SCALAR_FIELDS.forEach(function (definition) {
		var node = el(definition[0]);
		if (!node) return;
		if (!DB[definition[1]]) DB[definition[1]] = {};
		DB[definition[1]][definition[2]] = node.value;
	});
	if (DB.personal && DB.personal.birthYear) DB.personal.birthYear = String(DB.personal.birthYear).replace(/[^0-9]/g, '').slice(0, 4);
	var needsAid = el('f-funding-needsAid');
	if (needsAid) DB.funding.needsAid = !!needsAid.checked;
	var exportSensitive = el('f-export-sensitive');
	if (exportSensitive) DB.profile.exportIncludeSensitive = !!exportSensitive.checked;
}
function renderScalarFields() {
	SCALAR_FIELDS.forEach(function (definition) {
		setVal(definition[0], DB[definition[1]] ? DB[definition[1]][definition[2]] : '');
	});
	setChecked('f-funding-needsAid', DB.funding.needsAid);
	setChecked('f-export-sensitive', DB.profile.exportIncludeSensitive);
}

/* ── Declarative repeatable lists ── */
function newArrayItem(config) {
	var item = { id: newId('item') };
	config.rows.forEach(function (row) {
		row.forEach(function (field) {
			item[field.field] = field.type === 'checkbox' ? false : '';
		});
	});
	return item;
}

var ARRAY_LISTS = {
	links: {
		containerId: 'pp-links-container',
		get: function () { return DB.contact.links; },
		empty: 'No extra links yet.',
		title: function (item, index) { return item.label || 'Link ' + (index + 1); },
		subtitle: function (item) { return item.url || ''; },
		summary: function (item) { return [item.url]; },
		rows: [[
			{ field: 'label', label: 'Label', placeholder: 'e.g. Portfolio' },
			{ field: 'url', label: 'URL', type: 'url', placeholder: 'https://' }
		]]
	},
	languages: {
		containerId: 'pp-languages-container',
		badgeId: 'pp-languages-count',
		get: function () { return DB.languages; },
		empty: 'No languages added yet.',
		title: function (item, index) { return item.language || 'Language ' + (index + 1); },
		subtitle: function (item) { return item.speaking ? item.speaking + ' speaking' : ''; },
		summary: function (item) { return [item.speaking ? 'Speaking ' + item.speaking : '', item.writing ? 'Writing ' + item.writing : '', item.certification]; },
		rows: [
			[
				{ field: 'language', label: 'Language', placeholder: 'e.g. English' },
				{ field: 'speaking', label: 'Speaking', type: 'select', options: LANGUAGE_LEVELS },
				{ field: 'writing', label: 'Writing', type: 'select', options: LANGUAGE_LEVELS },
				{ field: 'reading', label: 'Reading', type: 'select', options: LANGUAGE_LEVELS }
			],
			[
				{ field: 'certification', label: 'Certificate / score', placeholder: 'e.g. IELTS 7.5' },
				{ field: 'notes', label: 'Notes', full: true }
			]
		]
	},
	documents: {
		containerId: 'pp-documents-container',
		badgeId: 'pp-documents-count',
		get: function () { return DB.documents; },
		empty: 'No documents added yet. Add the records you reuse most.',
		title: function (item, index) { return item.title || 'Document ' + (index + 1); },
		subtitle: function (item) { return item.type || ''; },
		summary: function (item) { return [item.type, item.number, arrayExpiryLabel(item.expiryDate)]; },
		rows: [
			[
				{ field: 'title', label: 'Document', placeholder: 'e.g. Passport' },
				{ field: 'type', label: 'Type', type: 'select', options: DOCUMENT_TYPES },
				{ field: 'number', label: 'Number', placeholder: 'Document number' }
			],
			[
				{ field: 'issuedBy', label: 'Issued by', placeholder: 'Authority' },
				{ field: 'issueDate', label: 'Issued', type: 'date' },
				{ field: 'expiryDate', label: 'Expires', type: 'date' }
			],
			[
				{ field: 'fileUrl', label: 'File', type: 'file', placeholder: 'Link to the file' }
			],
			[
				{ field: 'notes', label: 'Notes', full: true }
			]
		]
	},
	education: {
		containerId: 'pp-education-container',
		badgeId: 'pp-education-count',
		get: function () { return DB.education; },
		empty: 'No education added yet.',
		title: function (item, index) { return item.institution || 'Education ' + (index + 1); },
		subtitle: function (item) { return item.credential || ''; },
		summary: function (item) { return [item.credential, item.status, arrayPeriodLabel(item.startDate, item.endDate), item.gpa ? 'GPA ' + item.gpa + (item.gpaScale ? '/' + item.gpaScale : '') : '', item.honors]; },
		rows: [
			[
				{ field: 'institution', label: 'Institution', placeholder: 'School or university' },
				{ field: 'credential', label: 'Credential', type: 'select', options: EDUCATION_CREDENTIALS },
				{ field: 'status', label: 'Status', type: 'select', options: EDUCATION_STATUS }
			],
			[
				{ field: 'program', label: 'Program', placeholder: 'e.g. Mechanical Engineering' },
				{ field: 'fieldOfStudy', label: 'Field of study', placeholder: 'e.g. Thermodynamics' }
			],
			[
				{ field: 'startDate', label: 'Start', type: 'date' },
				{ field: 'endDate', label: 'End (or expected)', type: 'date' },
				{ field: 'gpa', label: 'GPA / grade', placeholder: 'e.g. 3.8' },
				{ field: 'gpaScale', label: 'Scale', placeholder: 'e.g. 4.0' }
			],
			[
				{ field: 'honors', label: 'Honours', placeholder: 'Dean list, scholarships, awards' },
				{ field: 'city', label: 'City' },
				{ field: 'country', label: 'Country' }
			],
			[
				{ field: 'coursework', label: 'Relevant coursework', type: 'textarea', full: true, placeholder: 'Courses worth naming on an application', help: 'Name 3-4 courses only, and only the ones that support the role or program.' }
			],
			[
				{ field: 'notes', label: 'Notes', type: 'textarea', full: true }
			]
		]
	},
	testScores: {
		containerId: 'pp-testscores-container',
		badgeId: 'pp-testscores-count',
		get: function () { return DB.testScores; },
		empty: 'No test scores added yet.',
		title: function (item, index) { return item.test || 'Test ' + (index + 1); },
		subtitle: function (item) { return item.score ? item.score + (item.maxScore ? ' / ' + item.maxScore : '') : ''; },
		summary: function (item) { return [item.score ? item.score + (item.maxScore ? ' / ' + item.maxScore : '') : '', item.date ? formatShortDate(item.date) : '', item.referenceNumber]; },
		rows: [
			[
				{ field: 'test', label: 'Test', type: 'select', options: TEST_OPTIONS },
				{ field: 'score', label: 'Score', placeholder: 'e.g. 1450' },
				{ field: 'maxScore', label: 'Out of', placeholder: 'e.g. 1600' },
				{ field: 'date', label: 'Test date', type: 'date' }
			],
			[
				{ field: 'expiryDate', label: 'Valid until', type: 'date' },
				{ field: 'referenceNumber', label: 'Reference number' },
				{ field: 'notes', label: 'Notes', full: true }
			]
		]
	},
	certifications: {
		containerId: 'pp-certifications-container',
		badgeId: 'pp-certifications-count',
		get: function () { return DB.certifications; },
		empty: 'No certifications added yet.',
		title: function (item, index) { return item.name || 'Certification ' + (index + 1); },
		subtitle: function (item) { return item.issuer || ''; },
		summary: function (item) { return [item.issuer, item.credentialId, arrayExpiryLabel(item.expiryDate)]; },
		rows: [
			[
				{ field: 'name', label: 'Certification', placeholder: 'e.g. First Aid Level C' },
				{ field: 'issuer', label: 'Issuer' },
				{ field: 'credentialId', label: 'Credential ID' }
			],
			[
				{ field: 'issueDate', label: 'Issued', type: 'date' },
				{ field: 'expiryDate', label: 'Expires', type: 'date' },
				{ field: 'url', label: 'Verification link', type: 'url' }
			],
			[
				{ field: 'notes', label: 'Notes', full: true }
			]
		]
	},
	workExperience: {
		containerId: 'pp-work-container',
		badgeId: 'pp-work-count',
		get: function () { return DB.workExperience; },
		empty: 'No work experience added yet.',
		title: function (item, index) { return item.title || 'Role ' + (index + 1); },
		subtitle: function (item) { return item.employer || ''; },
		summary: function (item) { return [item.employmentType, item.location, item.current && item.startDate ? 'Since ' + formatShortDate(item.startDate) : arrayPeriodLabel(item.startDate, item.endDate), item.workMode]; },
		rows: [
			[
				{ field: 'title', label: 'Job title', placeholder: 'e.g. Junior Analyst' },
				{ field: 'employer', label: 'Employer', placeholder: 'Company or client' },
				{ field: 'employmentType', label: 'Type', type: 'select', options: EMPLOYMENT_TYPES }
			],
			[
				{ field: 'location', label: 'Location' },
				{ field: 'workMode', label: 'Mode', type: 'select', options: WORK_MODES },
				{ field: 'startDate', label: 'Start', type: 'date' },
				{ field: 'endDate', label: 'End', type: 'date' }
			],
			[
				{ field: 'current', label: 'I still work here', type: 'checkbox' }
			],
			[
				{ field: 'summary', label: 'What you did', type: 'textarea', full: true, help: 'Example: Ran the morning stock count for a 12-person team and reported shortages to the manager.' }
			],
			[
				{ field: 'achievements', label: 'Achievements', type: 'textarea', full: true, placeholder: 'Results with numbers where possible', help: 'Example: Cut order errors by 30% by rewriting the intake checklist.' }
			],
			[
				{ field: 'skills', label: 'Skills used', placeholder: 'Comma-separated' }
			]
		]
	},
	skills: {
		containerId: 'pp-skills-container',
		badgeId: 'pp-skills-count',
		get: function () { return DB.skills; },
		empty: 'No skills added yet.',
		title: function (item, index) { return item.name || 'Skill ' + (index + 1); },
		subtitle: function (item) { return [item.category, item.level].filter(Boolean).join(' / '); },
		summary: function (item) { return [item.category, item.level, item.years ? item.years + ' yrs' : '', item.evidence]; },
		rows: [
			[
				{ field: 'name', label: 'Skill', placeholder: 'e.g. Data analysis' },
				{ field: 'category', label: 'Category', type: 'select', options: SKILL_CATEGORIES },
				{ field: 'level', label: 'Level', type: 'select', options: SKILL_LEVELS },
				{ field: 'years', label: 'Years', placeholder: 'e.g. 3' }
			],
			[
				{ field: 'evidence', label: 'Evidence', full: true, placeholder: 'Where you used it, or what proves it', help: 'Example: Built weekly sales reports in SQL for a 12-person team.' }
			]
		]
	},
	projects: {
		containerId: 'pp-projects-container',
		badgeId: 'pp-projects-count',
		get: function () { return DB.projects; },
		empty: 'No projects added yet.',
		title: function (item, index) { return item.name || 'Project ' + (index + 1); },
		subtitle: function (item) { return item.role || ''; },
		summary: function (item) { return [item.role, arrayPeriodLabel(item.startDate, item.endDate), item.tools, item.outcome]; },
		rows: [
			[
				{ field: 'name', label: 'Project', placeholder: 'Name of the project' },
				{ field: 'role', label: 'Your role' },
				{ field: 'startDate', label: 'Start', type: 'date' },
				{ field: 'endDate', label: 'End', type: 'date' }
			],
			[
				{ field: 'tools', label: 'Tools / methods', placeholder: 'Comma-separated' },
				{ field: 'outcome', label: 'Outcome', placeholder: 'What changed because of it' },
				{ field: 'url', label: 'Link', type: 'url' }
			],
			[
				{ field: 'description', label: 'Description', type: 'textarea', full: true, help: 'Example: Designed and tested a rain-garden model that reduced runoff at the test corner by 38%.' }
			]
		]
	},
	publications: {
		containerId: 'pp-publications-container',
		badgeId: 'pp-publications-count',
		get: function () { return DB.publications; },
		empty: 'No publications added yet.',
		title: function (item, index) { return item.title || 'Publication ' + (index + 1); },
		subtitle: function (item) { return item.venue || ''; },
		summary: function (item) { return [item.type, item.venue, item.date ? formatShortDate(item.date) : '']; },
		rows: [
			[
				{ field: 'title', label: 'Title', placeholder: 'Publication title' },
				{ field: 'type', label: 'Type', type: 'select', options: PUBLICATION_TYPES },
				{ field: 'venue', label: 'Venue / publisher' }
			],
			[
				{ field: 'date', label: 'Date', type: 'date' },
				{ field: 'authors', label: 'Authors', placeholder: 'In published order' },
				{ field: 'identifier', label: 'DOI / ISBN' },
				{ field: 'url', label: 'Link', type: 'url' }
			]
		]
	},
	achievements: {
		containerId: 'pp-achievements-container',
		badgeId: 'pp-achievements-count',
		get: function () { return DB.achievements; },
		empty: 'No awards added yet.',
		title: function (item, index) { return item.title || 'Achievement ' + (index + 1); },
		subtitle: function (item) { return [item.issuer, item.level].filter(Boolean).join(' / '); },
		summary: function (item) { return [item.issuer, item.level, item.date ? formatShortDate(item.date) : '']; },
		rows: [
			[
				{ field: 'title', label: 'Award or achievement', placeholder: 'What you received or achieved' },
				{ field: 'issuer', label: 'Awarded by' },
				{ field: 'date', label: 'Date', type: 'date' },
				{ field: 'level', label: 'Level', type: 'select', options: ACHIEVEMENT_LEVELS }
			],
			[
				{ field: 'evidenceUrl', label: 'Evidence link', type: 'url' },
				{ field: 'description', label: 'Description', full: true }
			]
		]
	},
	volunteer: {
		containerId: 'pp-volunteer-container',
		badgeId: 'pp-volunteer-count',
		get: function () { return DB.volunteer; },
		empty: 'No volunteer roles added yet.',
		title: function (item, index) { return item.role || 'Volunteer role ' + (index + 1); },
		subtitle: function (item) { return item.organization || ''; },
		summary: function (item) { return [item.organization, item.cause, item.hours ? item.hours + ' hours' : '', arrayPeriodLabel(item.startDate, item.endDate)]; },
		rows: [
			[
				{ field: 'role', label: 'Role' },
				{ field: 'organization', label: 'Organization' },
				{ field: 'cause', label: 'Cause', placeholder: 'e.g. education, environment' }
			],
			[
				{ field: 'startDate', label: 'Start', type: 'date' },
				{ field: 'endDate', label: 'End', type: 'date' },
				{ field: 'hours', label: 'Hours', placeholder: 'Total documented' }
			],
			[
				{ field: 'referenceName', label: 'Supervisor' },
				{ field: 'referenceEmail', label: 'Supervisor email', type: 'email' }
			],
			[
				{ field: 'description', label: 'What you did', type: 'textarea', full: true, help: 'Example: Staffed the water testing booth at three community events and trained two new volunteers.' }
			]
		]
	},
	extracurricular: {
		containerId: 'pp-extracurricular-container',
		badgeId: 'pp-extracurricular-count',
		get: function () { return DB.extracurricular; },
		empty: 'No activities added yet.',
		title: function (item, index) { return item.activity || 'Activity ' + (index + 1); },
		subtitle: function (item) { return [item.role, item.organization].filter(Boolean).join(' / '); },
		summary: function (item) { return [item.role, item.organization, arrayPeriodLabel(item.startDate, item.endDate)]; },
		rows: [
			[
				{ field: 'activity', label: 'Activity', placeholder: 'Club, team or society' },
				{ field: 'role', label: 'Role' },
				{ field: 'organization', label: 'Organization' }
			],
			[
				{ field: 'startDate', label: 'Start', type: 'date' },
				{ field: 'endDate', label: 'End', type: 'date' },
				{ field: 'description', label: 'Description', full: true }
			]
		]
	},
	references: {
		containerId: 'pp-references-container',
		badgeId: 'pp-references-count',
		get: function () { return DB.references; },
		empty: 'No references added yet.',
		title: function (item, index) { return item.name || 'Reference ' + (index + 1); },
		subtitle: function (item) { return [item.title, item.organization].filter(Boolean).join(' / '); },
		summary: function (item) { return [item.title, item.organization, item.email, item.permission]; },
		rows: [
			[
				{ field: 'name', label: 'Name' },
				{ field: 'title', label: 'Title' },
				{ field: 'organization', label: 'Organization' }
			],
			[
				{ field: 'relationship', label: 'Relationship', placeholder: 'e.g. former manager' },
				{ field: 'email', label: 'Email', type: 'email' },
				{ field: 'phone', label: 'Phone' }
			],
			[
				{ field: 'yearsKnown', label: 'Years known' },
				{ field: 'permission', label: 'Contact permission', type: 'select', options: REFERENCE_PERMISSION }
			],
			[
				{ field: 'notes', label: 'Notes', type: 'textarea', full: true }
			]
		]
	},
	essays: {
		containerId: 'pp-essays-container',
		badgeId: 'pp-essays-count',
		get: function () { return DB.essays; },
		empty: 'No essays or statements yet.',
		title: function (item, index) { return item.title || 'Essay ' + (index + 1); },
		subtitle: function (item) { return [item.type, item.status].filter(Boolean).join(' / '); },
		summary: function (item) { return [item.type, item.status, countWords(item.content) + ' words']; },
		rows: [
			[
				{ field: 'title', label: 'Title', placeholder: 'e.g. Personal statement - engineering' },
				{ field: 'type', label: 'Type', type: 'select', options: ESSAY_TYPES },
				{ field: 'status', label: 'Status', type: 'select', options: ESSAY_STATUS }
			],
			[
				{ field: 'target', label: 'Written for', placeholder: 'Program, school or award', full: true }
			],
			[
				{ field: 'content', label: 'Text', type: 'textarea', full: true, rows: 9, countsWords: true, help: 'Write or paste the statement here. Open with a specific moment, then explain what it taught you.' }
			]
		]
	}
};

function arrayFieldHtml(listId, index, field, value) {
	var attrs = ' data-list="' + listId + '" data-idx="' + index + '" data-field="' + esc(field.field) + '"';
	if (field.type === 'select') {
		var options = '<option value="">- Select -</option>';
		(field.options || []).forEach(function (option) {
			if (!option) return;
			options += '<option value="' + esc(option) + '"' + (option === value ? ' selected' : '') + '>' + esc(option) + '</option>';
		});
		return '<select class="pp-input pp-select"' + attrs + '>' + options + '</select>';
	}
	if (field.type === 'checkbox') {
		return '<label class="pp-checkbox-label pp-checkbox-label-inline"><input type="checkbox"' + attrs + (value ? ' checked' : '') + '> ' + esc(field.label) + '</label>';
	}
	if (field.type === 'textarea') {
		return '<textarea class="pp-input pp-textarea"' + attrs + ' rows="' + (field.rows || 3) + '" placeholder="' + esc(field.placeholder || '') + '">' + esc(value) + '</textarea>';
	}
	if (field.type === 'file') {
		return '<div class="pp-file-row">' +
			'<input type="text" class="pp-input"' + attrs + ' value="' + esc(value) + '" placeholder="' + esc(field.placeholder || '') + '">' +
			'<button type="button" class="pp-btn pp-btn-sm" data-action="upload-document" data-idx="' + index + '">' + iconSvg('upload') + ' Upload</button>' +
		'</div>';
	}
	var inputTypes = { date: 'date', url: 'url', email: 'email', number: 'number', text: 'text' };
	var inputType = inputTypes[field.type] || 'text';
	return '<input type="' + inputType + '" class="pp-input"' + attrs + ' value="' + esc(value) + '" placeholder="' + esc(field.placeholder || '') + '">';
}

function renderArrayItem(listId, config, item, index) {
	var isEditing = _editingArrayItem[listId] === item.id;
	var metaBits = config.summary ? config.summary(item) : [];
	var metaHtml = '';
	if (!isEditing && metaBits && metaBits.length) {
		var visibleBits = metaBits.filter(function (bit) { return !!bit; });
		if (visibleBits.length) {
			metaHtml = '<div class="pp-array-meta">' + visibleBits.map(function (bit) {
				return '<span class="pp-meta-chip">' + esc(bit) + '</span>';
			}).join('') + '</div>';
		}
	}
	var headerHtml = '<div class="pp-array-item-header">' +
		'<span class="pp-array-item-title">' + esc(config.title(item, index)) +
			(config.subtitle(item) ? ' <span class="pp-array-item-sub">' + esc(config.subtitle(item)) + '</span>' : '') +
		'</span>' +
		'<div class="pp-array-item-actions">' +
			'<button type="button" class="pp-btn pp-btn-sm pp-array-edit" data-action="toggle-item" data-list="' + listId + '" data-idx="' + index + '" aria-expanded="' + (isEditing ? 'true' : 'false') + '">' + (isEditing ? 'Done' : 'Edit') + '</button>' +
			'<button type="button" class="pp-btn pp-btn-sm pp-btn-danger" data-action="remove-item" data-list="' + listId + '" data-idx="' + index + '" title="Remove" aria-label="Remove">✕</button>' +
		'</div>' +
	'</div>';
	var bodyHtml = '';
	config.rows.forEach(function (row) {
		bodyHtml += '<div class="pp-array-item-row">';
		row.forEach(function (field) {
			var classes = 'pp-array-item-cell' + (field.full || field.type === 'checkbox' ? ' pp-array-item-cell-full' : '');
			var labelHtml = field.type === 'checkbox' ? '' : '<label class="pp-label">' + esc(field.label) +
				(field.countsWords ? ' <span class="pp-word-count" data-wordcount-index="' + index + '">' + countWords(item[field.field]) + ' words</span>' : '') +
			'</label>';
			bodyHtml += '<div class="' + classes + '">' + labelHtml + arrayFieldHtml(listId, index, field, item[field.field]) +
				(field.help ? '<span class="pp-field-help">' + esc(field.help) + '</span>' : '') + '</div>';
		});
		bodyHtml += '</div>';
	});
	return '<div class="pp-array-item ' + (isEditing ? 'is-editing' : 'is-collapsed') + '">' + headerHtml + metaHtml + '<div class="pp-array-item-body">' + bodyHtml + '</div></div>';
}

function toggleArrayItem(listId, index) {
	var config = ARRAY_LISTS[listId];
	if (!config) return;
	var items = config.get();
	var item = items[index];
	if (!item) return;
	_editingArrayItem[listId] = _editingArrayItem[listId] === item.id ? null : item.id;
	renderArrayList(listId);
}

function renderArrayList(listId) {
	var config = ARRAY_LISTS[listId];
	if (!config) return;
	var container = el(config.containerId);
	if (!container) return;
	var items = config.get();
	if (!items.length) {
		container.innerHTML = '<div class="pp-array-item-empty">' + esc(config.empty) + '</div>';
		return;
	}
	var html = '';
	for (var i = 0; i < items.length; i++) html += renderArrayItem(listId, config, items[i], i);
	container.innerHTML = html;
}

function renderAllArrayLists() {
	Object.keys(ARRAY_LISTS).forEach(function (listId) { renderArrayList(listId); });
}

function readArrayFields() {
	Object.keys(ARRAY_LISTS).forEach(function (listId) {
		var config = ARRAY_LISTS[listId];
		var items = config.get();
		var nodes = document.querySelectorAll('[data-list="' + listId + '"]');
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			var index = parseInt(node.getAttribute('data-idx'), 10);
			var fieldName = node.getAttribute('data-field');
			if (isNaN(index) || !fieldName || index < 0 || index >= items.length) continue;
			items[index][fieldName] = node.type === 'checkbox' ? !!node.checked : node.value;
		}
	});
}

function addArrayItem(listId) {
	var config = ARRAY_LISTS[listId];
	if (!config) return;
	readAllFromDOM();
	var newItem = newArrayItem(config);
	config.get().unshift(newItem);
	_editingArrayItem[listId] = newItem.id;
	DB.profile.updatedAt = nowIso();
	renderArrayList(listId);
	afterStructureChange(listId);
}
function removeArrayItem(listId, index) {
	var config = ARRAY_LISTS[listId];
	if (!config) return;
	readAllFromDOM();
	var items = config.get();
	if (index < 0 || index >= items.length) return;
	var removedItemId = items[index].id;
	items.splice(index, 1);
	if (_editingArrayItem[listId] === removedItemId) _editingArrayItem[listId] = null;
	DB.profile.updatedAt = nowIso();
	renderArrayList(listId);
	afterStructureChange(listId);
}
function arrayPeriodLabel(startDate, endDate) {
	if (!startDate && !endDate) return '';
	if (!startDate) return formatShortDate(endDate);
	if (!endDate) return 'From ' + formatShortDate(startDate);
	return formatShortDate(startDate) + ' - ' + formatShortDate(endDate);
}
function arrayExpiryLabel(isoDate) {
	if (!isoDate) return '';
	var days = daysUntilDate(isoDate);
	if (days === null) return '';
	if (days < 0) return 'Expired ' + formatShortDate(isoDate);
	if (days <= 90) return 'Expires ' + formatShortDate(isoDate);
	return 'Valid to ' + formatShortDate(isoDate);
}
function afterStructureChange(listId) {
	saveNow();
	updateBadges();
	if (listId === 'documents' || listId === 'certifications') renderDocumentsAlert();
	if (isDrawerOpen()) renderShare();
}

/* ── DOM read / render ── */
function readAllFromDOM() {
	readScalarFields();
	readArrayFields();
	DB.profile.updatedAt = nowIso();
}

function renderAll() {
	renderScalarFields();
	renderProfileSetup();
	renderSummaryCards();
	renderAllArrayLists();
	renderPhotoField();
	renderCustomFieldBlocks();
	renderCustomSections();
	renderDocumentsAlert();
	if (isDrawerOpen()) renderShare();

	for (var i = 0; i < SECTIONS.length; i++) {
		var sectionEl = el('sec-' + SECTIONS[i].id);
		if (sectionEl) sectionEl.style.display = isSectionVisible(SECTIONS[i].id) ? '' : 'none';
	}

	var list = visibleSectionList();
	if (!currentSection || list.indexOf(currentSection) === -1) {
		currentSection = list.length ? list[0] : 'basic';
	}
	switchToSection(currentSection);
	updateBadges();
}

function renderProfileSetup() {
	var kindSelect = el('f-profile-kind');
	if (kindSelect) kindSelect.value = DB.profile.kind || '';
	var kindHint = el('pp-kind-hint');
	if (kindHint) {
		var kind = profileKindById(DB.profile.kind);
		kindHint.textContent = kind ? kind.desc : '';
	}
	var grid = el('pp-focus-grid');
	if (grid) {
		var focus = profileFocusSet();
		var html = '';
		PROFILE_FOCUS_AREAS.forEach(function (area) {
			var pressed = !!focus[area.id];
			html += '<button type="button" class="pp-focus-chip" data-focus="' + area.id + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' +
				'<span class="pp-focus-box">' + iconSvg('check') + '</span>' +
				'<span class="pp-focus-text"><span class="pp-focus-label">' + esc(area.label) + '</span>' +
				'<span class="pp-focus-desc">' + esc(area.desc) + '</span></span></button>';
		});
		grid.innerHTML = html;
	}
	var hint = el('pp-focus-hint');
	if (hint) hint.textContent = DB.profile.focus.length + (DB.profile.focus.length === 1 ? ' area selected' : ' areas selected');
	var note = el('pp-profile-note');
	if (note) {
		var hiddenCount = 0;
		SECTIONS.forEach(function (section) {
			if (!sectionMatchesProfile(section.id)) hiddenCount++;
		});
		if (!profileIsConfigured()) note.textContent = 'Only the basic sections are shown until you choose a profile use or tick an area. Every answer stays in the record.';
		else if (hiddenCount === 0) note.textContent = 'Every section is visible for this profile.';
		else if (DB.profile.showAllSections) note.textContent = hiddenCount + (hiddenCount === 1 ? ' section is hidden' : ' sections are hidden') + ' by this profile - currently showing all.';
		else note.textContent = hiddenCount + (hiddenCount === 1 ? ' section is hidden' : ' sections are hidden') + ' by this profile. Your saved answers stay in the record.';
	}
}

function displayName() {
	return DB.basicInfo.legalName || DB.basicInfo.preferredName || '';
}
function initialsFor(name) {
	var words = String(name || '').trim().split(/\s+/).filter(Boolean);
	if (!words.length) return '?';
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
function applyAvatarImage(node, initialsNode, url, name) {
	if (!node) return;
	node.style.backgroundImage = url ? 'url("' + String(url).replace(/"/g, '%22') + '")' : '';
	node.classList.toggle('has-photo', !!url);
	if (initialsNode) initialsNode.textContent = initialsFor(name);
}
function renderAvatars() {
	var name = displayName();
	var url = DB.basicInfo.photoUrl || '';
	applyAvatarImage(el('pp-header-avatar'), el('pp-header-avatar-initials'), url, name);
	applyAvatarImage(el('pp-menu-avatar'), el('pp-menu-avatar-initials'), url, name);
	var kindLabel = profileKindLabel(DB.profile.kind) || 'No profile use chosen';
	[['pp-account-name', 'pp-account-sub'], ['pp-menu-name', 'pp-menu-sub']].forEach(function (ids) {
		var nameEl = el(ids[0]);
		var subEl = el(ids[1]);
		if (nameEl) nameEl.textContent = name || 'Your profile';
		if (subEl) subEl.textContent = kindLabel;
	});
}
function renderPhotoField() {
	var container = el('pp-photo-field');
	if (!container) return;
	var url = DB.basicInfo.photoUrl || '';
	var previewStyle = url ? ' style="background-image:url(\'' + esc(url).replace(/'/g, '%27') + '\')"' : '';
	container.innerHTML =
		'<div class="pp-photo-card">' +
			'<span class="pp-avatar pp-avatar-lg' + (url ? ' has-photo' : '') + '" id="pp-photo-avatar"' + previewStyle + '>' +
				'<span class="pp-avatar-initials">' + esc(initialsFor(displayName())) + '</span>' +
			'</span>' +
			'<div class="pp-photo-copy">' +
				'<div class="pp-photo-title">Profile photo</div>' +
				'<div class="pp-photo-hint">Optional. A clear head-and-shoulders photo is what applications expect.</div>' +
				'<div class="pp-photo-actions">' +
					'<button type="button" class="pp-btn pp-btn-sm" data-action="upload-photo">' + iconSvg('upload') + ' Upload photo</button>' +
					'<button type="button" class="pp-btn pp-btn-sm pp-btn-secondary" data-action="toggle-photo-url">Paste link</button>' +
					(url ? '<button type="button" class="pp-btn pp-btn-sm pp-btn-danger" data-action="remove-photo">Remove</button>' : '') +
				'</div>' +
				'<div class="pp-photo-url-wrap" id="pp-photo-url-wrap"' + (url ? '' : ' hidden') + '>' +
					'<input type="text" class="pp-input pp-photo-url" id="f-photoUrl" value="' + esc(url) + '" placeholder="https://example.com/photo.jpg">' +
				'</div>' +
			'</div>' +
		'</div>';
}

function renderDocumentsAlert() {
	var alertEl = el('pp-documents-alert');
	if (!alertEl) return;
	var expired = 0;
	var expiring = 0;
	DB.documents.concat(DB.certifications).forEach(function (record) {
		var days = daysUntilDate(record.expiryDate);
		if (days === null) return;
		if (days < 0) expired++;
		else if (days <= 90) expiring++;
	});
	var alerts = [];
	if (expired) alerts.push(expired + (expired === 1 ? ' record has expired' : ' records have expired'));
	if (expiring) alerts.push(expiring + (expiring === 1 ? ' expires within 90 days' : ' expire within 90 days'));
	alertEl.textContent = alerts.length ? alerts.join(' - ') + '.' : '';
}

/* ── Sections render ── */
function renderBasicInfo() {
	renderProfileSetup();
	renderScalarFields();
	renderPhotoField();
}
function renderContact() {
	renderScalarFields();
	renderArrayList('links');
}

/* ── Custom fields inside built-in sections ── */
function renderCustomFieldBlocks() {
	SECTIONS.forEach(function (section) {
		var sectionEl = el('sec-' + section.id);
		if (!sectionEl) return;
		var body = sectionEl.querySelector('.pp-section-body');
		var blockId = 'pp-custom-block-' + section.id;
		var existing = el(blockId);
		if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
		var fields = (DB.profile.customFields && DB.profile.customFields[section.id]) || [];
		if (!fields.length || !body) return;
		var block = document.createElement('div');
		block.className = 'pp-custom-block';
		block.id = blockId;
		block.innerHTML = '<div class="pp-custom-head">' +
			'<span class="pp-custom-title">Additional details</span>' +
			'<span class="pp-custom-note">Extra fields saved with this profile</span>' +
			'</div>' + customFieldRowsHtml(section.id, fields);
		body.appendChild(block);
	});
}

function customFieldRowsHtml(owner, fields) {
	var html = '<div class="pp-custom-row pp-custom-row-head" aria-hidden="true">' +
		'<span>Field name</span><span>Type</span><span>Value</span><span></span>' +
	'</div>';
	for (var i = 0; i < fields.length; i++) html += customFieldRowHtml(owner, fields[i]);
	return '<div class="pp-custom-rows">' + html + '</div>';
}

function customFieldRowHtml(owner, field) {
	var typeOptions = '';
	var typeIds = ['text', 'textarea', 'number', 'date', 'url', 'email'];
	var typeLabels = { text: 'Text', textarea: 'Long text', number: 'Number', date: 'Date', url: 'Link', email: 'Email' };
	typeIds.forEach(function (typeId) {
		typeOptions += '<option value="' + typeId + '"' + (typeId === field.type ? ' selected' : '') + '>' + typeLabels[typeId] + '</option>';
	});
	var attrs = ' data-custom-owner="' + esc(owner) + '" data-custom-id="' + esc(field.id) + '"';
	var valueControl;
	if (field.type === 'textarea') {
		valueControl = '<textarea class="pp-input pp-textarea pp-custom-value"' + attrs + ' data-custom-prop="value" rows="2">' + esc(field.value) + '</textarea>';
	} else {
		var inputType = field.type === 'date' ? 'date' : (field.type === 'url' ? 'url' : (field.type === 'email' ? 'email' : (field.type === 'number' ? 'number' : 'text')));
		valueControl = '<input type="' + inputType + '" class="pp-input pp-custom-value"' + attrs + ' data-custom-prop="value" value="' + esc(field.value) + '" placeholder="Value">';
	}
	return '<div class="pp-custom-row">' +
		'<input type="text" class="pp-input pp-custom-label"' + attrs + ' data-custom-prop="label" value="' + esc(field.label) + '" placeholder="Field name">' +
		'<select class="pp-input pp-select pp-custom-type"' + attrs + ' data-custom-prop="type">' + typeOptions + '</select>' +
		valueControl +
		'<button type="button" class="pp-btn pp-custom-remove"' + attrs + ' data-custom-remove="' + esc(field.id) + '" title="Remove field" aria-label="Remove field">✕</button>' +
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
	DB.profile.updatedAt = nowIso();
	renderCustomOwner(owner);
	buildNav();
	saveNow();
	var labelInput = document.querySelector('[data-custom-owner="' + owner + '"][data-custom-id="' + field.id + '"][data-custom-prop="label"]');
	if (labelInput) labelInput.focus();
}

function removeCustomField(owner, fieldId) {
	var fields = customFieldListFor(owner);
	for (var i = 0; i < fields.length; i++) {
		if (fields[i].id === fieldId) { fields.splice(i, 1); break; }
	}
	DB.profile.updatedAt = nowIso();
	renderCustomOwner(owner);
	buildNav();
	saveNow();
	updateCompletion();
}

function updateCustomFieldProp(control) {
	var owner = control.getAttribute('data-custom-owner');
	var fieldId = control.getAttribute('data-custom-id');
	var prop = control.getAttribute('data-custom-prop');
	var fields = customFieldListFor(owner);
	var field = null;
	for (var i = 0; i < fields.length; i++) if (fields[i].id === fieldId) field = fields[i];
	if (!field) return;
	field[prop] = control.value;
	DB.profile.updatedAt = nowIso();
	saveNow();
	updateCompletion();
	if (prop === 'type') {
		renderCustomOwner(owner);
		buildNav();
	}
}

/* ── Custom sections ── */
function ensureCustomSectionElements() {
	var main = el('pp-main');
	var pager = el('pp-pager');
	if (!main) return;
	var wanted = {};
	(DB.profile.customSections || []).forEach(function (section) {
		var elementId = 'sec-custom-' + section.id;
		wanted[elementId] = true;
		if (!el(elementId)) {
			var sectionEl = document.createElement('section');
			sectionEl.className = 'pp-section';
			sectionEl.id = elementId;
			sectionEl.setAttribute('data-section', 'custom-' + section.id);
			sectionEl.setAttribute('data-custom-section', section.id);
			if (pager && pager.parentNode === main) main.insertBefore(sectionEl, pager);
			else main.appendChild(sectionEl);
		}
	});
	var existing = document.querySelectorAll('[data-custom-section]');
	for (var i = 0; i < existing.length; i++) {
		if (!wanted[existing[i].id] && existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
	}
}

function renderCustomSections() {
	ensureCustomSectionElements();
	(DB.profile.customSections || []).forEach(renderOneCustomSection);
	updateCustomSectionStates();
}

function renderOneCustomSection(section) {
	var sectionEl = el('sec-custom-' + section.id);
	if (!sectionEl) return;
	var fields = section.fields || [];
	sectionEl.innerHTML =
		'<div class="pp-section-header">' +
			'<div class="pp-section-icon">' + iconSvg('spark') + '</div>' +
			'<div class="pp-section-title-group">' +
				'<h2 class="pp-section-title">' + esc(section.title) + '</h2>' +
				'<p class="pp-section-desc">' + esc(section.description || 'Custom section for this profile') + '</p>' +
			'</div>' +
			'<div class="pp-section-state" id="pp-state-custom-' + esc(section.id) + '"></div>' +
			'<button type="button" class="pp-btn pp-btn-icon" data-custom-edit="' + esc(section.id) + '" title="Edit this section" aria-label="Edit this section">' + iconSvg('pencil') + '</button>' +
		'</div>' +
		'<div class="pp-section-body">' +
			(fields.length
				? customFieldRowsHtml('custom:' + section.id, fields)
				: '<div class="pp-array-item-empty">No fields yet. Add the first field, then fill it in.</div>') +
			'<button type="button" class="pp-btn pp-btn-add" data-custom-add="custom:' + esc(section.id) + '" style="margin-top:10px">Add field</button>' +
		'</div>';
	updateCustomSectionStates();
}

function updateCustomSectionStates() {
	(DB.profile.customSections || []).forEach(function (section) {
		var fields = section.fields || [];
		var filled = 0;
		fields.forEach(function (field) { if (String(field.value || '').trim()) filled++; });
		var stateEl = el('pp-state-custom-' + section.id);
		if (!stateEl) return;
		stateEl.textContent = fields.length ? filled + ' of ' + fields.length : 'Empty';
		stateEl.className = 'pp-section-state' + (fields.length && filled === fields.length ? ' complete' : '');
	});
}

function openCustomSectionModal(sectionId) {
	var section = sectionId ? findCustomSection(sectionId) : null;
	el('pp-modal-title').textContent = section ? 'Edit custom section' : 'New custom section';
	el('pp-modal-body').innerHTML =
		'<div class="pp-field">' +
			'<label class="pp-label" for="pp-custom-title">Section title</label>' +
			'<input class="pp-input" id="pp-custom-title" maxlength="80" placeholder="e.g. Language test history" value="' + esc(section ? section.title : '') + '">' +
		'</div>' +
		'<div class="pp-field" style="margin-top:14px">' +
			'<label class="pp-label" for="pp-custom-desc">Short description <span class="pp-hint">(optional)</span></label>' +
			'<input class="pp-input" id="pp-custom-desc" maxlength="300" placeholder="What this section collects" value="' + esc(section ? section.description : '') + '">' +
		'</div>' +
		(section ? '<div class="pp-modal-danger"><button type="button" class="pp-btn pp-btn-sm pp-btn-danger" data-custom-section-delete="' + esc(section.id) + '">Delete this section</button></div>' : '');
	modalCallback = function () {
		var title = val('pp-custom-title').trim();
		if (!title) {
			notify('Give the section a title', 'warning');
			var titleField = el('pp-custom-title');
			if (titleField) titleField.focus();
			return false;
		}
		var createdId = null;
		if (section) {
			section.title = title.slice(0, 80);
			section.description = val('pp-custom-desc').trim().slice(0, 300);
		} else {
			var newSection = { id: newId('cs'), title: title.slice(0, 80), description: val('pp-custom-desc').trim().slice(0, 300), fields: [] };
			DB.profile.customSections.push(newSection);
			createdId = newSection.id;
		}
		DB.profile.updatedAt = nowIso();
		saveNow();
		renderCustomSections();
		buildNav();
		renderPager();
		updateCompletion();
		if (createdId) switchToSection('custom-' + createdId);
		return true;
	};
	el('pp-modal-overlay').classList.add('open');
	var focusField = el('pp-custom-title');
	if (focusField) focusField.focus();
}

function deleteCustomSection(sectionId) {
	var sections = DB.profile.customSections || [];
	for (var i = 0; i < sections.length; i++) {
		if (sections[i].id === sectionId) { sections.splice(i, 1); break; }
	}
	if (currentSection === 'custom-' + sectionId) currentSection = null;
	DB.profile.updatedAt = nowIso();
	saveNow();
	renderCustomSections();
	buildNav();
	renderPager();
	updateCompletion();
	if (!currentSection || !isSectionVisible(currentSection)) {
		var list = visibleSectionList();
		if (list.length) switchToSection(list[0]);
	}
}

/* ── Navigation ── */
function buildNav() {
	var nav = el('pp-nav');
	if (!nav) return;
	var html = '';
	var lastGroup = '';
	SECTIONS.forEach(function (section) {
		if (!isSectionVisible(section.id)) return;
		if (section.group !== lastGroup) {
			html += '<div class="pp-nav-group">' + esc(section.group) + '</div>';
			lastGroup = section.group;
		}
		var trailing = '';
		var itemCount = section.count ? section.count() : 0;
		if (itemCount > 0) trailing = '<span class="pp-nav-badge">' + itemCount + '</span>';
		else if (sectionProgress(section.id).complete) trailing = '<span class="pp-nav-done">' + iconSvg('check') + '</span>';
		html += '<button type="button" class="pp-nav-item' + (currentSection === section.id ? ' active' : '') + '" data-nav="' + section.id + '">' +
			'<span class="pp-nav-icon">' + iconSvg(section.icon) + '</span>' +
			'<span class="pp-nav-label">' + esc(section.navLabel || section.title) + '</span>' + trailing +
		'</button>';
	});
	var customSections = DB.profile.customSections || [];
	if (customSections.length) {
		html += '<div class="pp-nav-group">Custom sections</div>';
		customSections.forEach(function (section) {
			var customId = 'custom-' + section.id;
			var fieldCount = (section.fields || []).length;
			html += '<button type="button" class="pp-nav-item' + (currentSection === customId ? ' active' : '') + '" data-nav="' + customId + '">' +
				'<span class="pp-nav-icon">' + iconSvg('spark') + '</span>' +
				'<span class="pp-nav-label">' + esc(section.title) + '</span>' +
				(fieldCount ? '<span class="pp-nav-badge">' + fieldCount + '</span>' : '') +
			'</button>';
		});
	}
	nav.innerHTML = html;
	updateScopeControls();
}

function updateScopeControls() {
	var profileHidden = 0;
	var configHidden = 0;
	SECTIONS.forEach(function (section) {
		if (visibleSections && !visibleSections[section.id]) { configHidden++; return; }
		if (!sectionMatchesProfile(section.id)) profileHidden++;
	});
	var note = el('pp-hidden-note');
	if (note) {
		if (configHidden && !profileHidden) note.textContent = configHidden + ' sections hidden by configuration';
		else if (!profileIsConfigured()) note.textContent = 'Basic sections only - choose a profile use to show more';
		else if (!profileHidden) note.textContent = 'All sections are visible';
		else if (DB.profile.showAllSections) note.textContent = profileHidden + ' hidden by this profile - showing all';
		else note.textContent = profileHidden + (profileHidden === 1 ? ' section hidden' : ' sections hidden') + ' by this profile';
	}
	var toggle = el('pp-scope-toggle');
	if (toggle) toggle.textContent = DB.profile.showAllSections ? 'Hide sections not needed' : 'Show all sections';

	var chipValue = el('pp-profile-chip-value');
	var chipSub = el('pp-profile-chip-sub');
	if (chipValue) chipValue.textContent = profileKindLabel(DB.profile.kind) || 'Not set';
	if (chipSub) {
		var focusCount = DB.profile.focus.length;
		chipSub.textContent = focusCount
			? focusCount + (focusCount === 1 ? ' area covered' : ' areas covered')
			: 'Choose a profile use in Basic Information';
	}
	renderAvatars();
}

function sectionTitleById(sectionId) {
	if (sectionId.indexOf('custom-') === 0) {
		var customSection = findCustomSection(sectionId.slice(7));
		return customSection ? customSection.title : 'Section';
	}
	var section = sectionById(sectionId);
	return section ? section.title : 'Section';
}

function switchToSection(sectionId) {
	if (!isSectionVisible(sectionId)) return;
	if (editingSummaryKey && sectionId !== 'summary') {
		editingSummaryKey = null;
		renderSummaryCards();
	}
	currentSection = sectionId;
	var sections = document.querySelectorAll('.pp-section');
	for (var i = 0; i < sections.length; i++) sections[i].classList.remove('active');
	var sectionEl = el('sec-' + sectionId);
	if (sectionEl) sectionEl.classList.add('active');
	updateNavActive();
	renderPager();
	if (typeof tool.resize === 'function') tool.resize();
}

function updateNavActive() {
	var items = document.querySelectorAll('.pp-nav-item');
	for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
	if (!currentSection) return;
	var active = document.querySelector('[data-nav="' + currentSection + '"]');
	if (active) active.classList.add('active');
}

function renderPager() {
	var pager = el('pp-pager');
	if (!pager) return;
	var list = visibleSectionList();
	if (list.length < 2) { pager.innerHTML = ''; return; }
	var index = list.indexOf(currentSection);
	if (index === -1) index = 0;
	var previousTitle = sectionTitleById(list[(index - 1 + list.length) % list.length]);
	var nextTitle = sectionTitleById(list[(index + 1) % list.length]);
	pager.innerHTML =
		'<button type="button" class="pp-pager-btn" data-nav-step="-1">' + iconSvg('chevronLeft') +
			'<span class="pp-pager-text"><span class="pp-pager-eyebrow">Previous</span><strong>' + esc(previousTitle) + '</strong></span></button>' +
		'<span class="pp-pager-count">' + (index + 1) + ' / ' + list.length + '</span>' +
		'<button type="button" class="pp-pager-btn pp-pager-next" data-nav-step="1">' +
			'<span class="pp-pager-text"><span class="pp-pager-eyebrow">Next</span><strong>' + esc(nextTitle) + '</strong></span>' + iconSvg('chevronRight') + '</button>';
}

function navigateSection(direction) {
	var list = visibleSectionList();
	if (!list.length) return;
	var index = list.indexOf(currentSection);
	if (index === -1) index = 0;
	var nextIndex = index + direction;
	if (nextIndex < 0) nextIndex = list.length - 1;
	if (nextIndex >= list.length) nextIndex = 0;
	switchToSection(list[nextIndex]);
}

function syncSectionVisibility() {
	SECTIONS.forEach(function (section) {
		var sectionEl = el('sec-' + section.id);
		if (sectionEl) sectionEl.style.display = isSectionVisible(section.id) ? '' : 'none';
	});
	var list = visibleSectionList();
	if (!currentSection || list.indexOf(currentSection) === -1) {
		if (list.length) switchToSection(list[0]);
	}
	renderPager();
}

/* ── Progress and completion ── */
function sectionProgress(sectionId) {
	var done = 0;
	var total = 0;
	function need(value) { total++; if (value && String(value).trim()) done++; }
	function needList(list) { total++; if (list && list.length) done++; }

	switch (sectionId) {
		case 'basic':
			need(DB.basicInfo.legalName);
			need(DB.contact.email);
			need(DB.profile.kind);
			break;
		case 'summary':
			need(DB.summary.headline);
			need(DB.summary.summary);
			break;
		case 'contact':
			need(DB.contact.city || DB.contact.country);
			need(DB.contact.linkedin || DB.contact.website || DB.contact.github || DB.contact.altPhone);
			break;
		case 'languages':
			needList(DB.languages);
			break;
		case 'identity':
			need(DB.identity.idType);
			need(DB.identity.idNumber);
			need(DB.identity.statusType);
			break;
		case 'documents':
			needList(DB.documents);
			break;
		case 'health':
			need(DB.health.emergencyName);
			need(DB.health.emergencyPhone);
			break;
		case 'education':
			needList(DB.education);
			break;
		case 'testscores':
			needList(DB.testScores);
			break;
		case 'certifications':
			needList(DB.certifications);
			break;
		case 'work':
			needList(DB.workExperience);
			break;
		case 'skills':
			needList(DB.skills);
			break;
		case 'projects':
			needList(DB.projects);
			break;
		case 'publications':
			needList(DB.publications);
			break;
		case 'achievements':
			needList(DB.achievements);
			break;
		case 'volunteer':
			needList(DB.volunteer);
			break;
		case 'extracurricular':
			needList(DB.extracurricular);
			break;
		case 'references':
			needList(DB.references);
			break;
		case 'essays':
			needList(DB.essays);
			break;
		case 'preferences':
			need(DB.preferences.jobTitles || DB.preferences.studyFields);
			break;
		case 'funding':
			need(DB.funding.sponsorship || DB.funding.scholarshipTargets || DB.funding.financialNotes);
			break;
	}
	return { done: done, total: total, complete: total > 0 && done === total };
}

function updateCompletion() {
	var totalSections = 0;
	var completeSections = 0;
	SECTIONS.forEach(function (section) {
		var progress = sectionProgress(section.id);
		var stateEl = el('pp-state-' + section.id);
		if (stateEl) {
			if (progress.total === 0) {
				stateEl.textContent = 'Optional';
				stateEl.className = 'pp-section-state optional';
			} else {
				stateEl.textContent = progress.complete ? 'Complete' : progress.done + ' of ' + progress.total;
				stateEl.className = 'pp-section-state' + (progress.complete ? ' complete' : '');
			}
		}
		if (!isSectionVisible(section.id)) return;
		if (progress.total === 0) return;
		totalSections++;
		if (progress.complete) completeSections++;
	});
	(DB.profile.customSections || []).forEach(function (section) {
		var fields = section.fields || [];
		var filled = 0;
		fields.forEach(function (field) { if (String(field.value || '').trim()) filled++; });
		totalSections++;
		if (fields.length && filled === fields.length) completeSections++;
	});
	var percent = totalSections ? Math.round((completeSections / totalSections) * 100) : 0;
	var ring = el('pp-completion-ring');
	if (ring) ring.style.background = 'conic-gradient(var(--pp-accent) ' + percent + '%, var(--pp-line) ' + percent + '%)';
	var percentEl = el('pp-completion-pct');
	if (percentEl) percentEl.textContent = percent + '%';
	var countEl = el('pp-completion-count');
	if (countEl) countEl.textContent = completeSections + ' of ' + totalSections;
}

function updateHeaderName() {
	var name = displayName() || 'Untitled profile';
	var nameEl = el('pp-person-name-display');
	if (nameEl) nameEl.textContent = name;
	renderAvatars();
}

function updateBadges() {
	Object.keys(ARRAY_LISTS).forEach(function (listId) {
		var config = ARRAY_LISTS[listId];
		if (!config.badgeId) return;
		var countEl = el(config.badgeId);
		if (countEl) countEl.textContent = config.get().length ? String(config.get().length) : '';
	});
	buildNav();
	updateCompletion();
}

/* ── Profile Summary cards ──
   The statements read first and are edited one card at a time, the same way
   the Company Profile handles its mission and vision blocks. */
var SUMMARY_FIELDS = [
	{ key: 'headline', label: 'Headline', hint: 'One line that describes you at a glance.', icon: 'spark', input: 'text', maxlength: 160, placeholder: 'e.g. Mechanical engineering student focused on sustainable design', sample: 'Grade 12 student focused on environmental engineering and clean water' },
	{ key: 'summary', label: 'Profile summary', hint: 'A short introduction in the first person. This is the block most applications reuse.', icon: 'pen', input: 'textarea', rows: 7, wide: true, placeholder: 'Write a short introduction. Two or three sentences is enough.', sample: 'I am a third-year student in Vancouver who likes turning science into something a community can use. I built a rain-garden model for my school and ran the water testing booth at three community events. I am looking for a summer role where I can keep working on water systems that small cities can actually afford.' },
	{ key: 'objectives', label: 'Objectives & goals', hint: 'What you are working toward - study, career or personal.', icon: 'target', input: 'textarea', rows: 4, placeholder: 'Describe the next goal you are working toward.', sample: 'Finish my degree with a focus on energy systems, then work as a junior design engineer while completing a professional certification.' },
	{ key: 'values', label: 'Values & working style', hint: 'What matters to you and how you prefer to work.', icon: 'shield', input: 'textarea', rows: 4, placeholder: 'What should a reader know about how you work?', sample: 'I work best with clear priorities and honest feedback. I would rather ask a question early than fix a wrong assumption later.' },
	{ key: 'interests', label: 'Interests', hint: 'Subjects, causes and activities you care about.', icon: 'heart', input: 'textarea', rows: 4, placeholder: 'What do you choose to spend time on?', sample: 'Water treatment, urban ecology, rock climbing and community theatre.' }
];
var editingSummaryKey = null;

function summaryFieldByKey(key) {
	for (var i = 0; i < SUMMARY_FIELDS.length; i++) if (SUMMARY_FIELDS[i].key === key) return SUMMARY_FIELDS[i];
	return null;
}
function renderSummaryCards() {
	var container = el('pp-summary-cards');
	if (!container) return;
	var html = '';
	SUMMARY_FIELDS.forEach(function (field) {
		var text = String(DB.summary[field.key] || '').trim();
		var isEditing = editingSummaryKey === field.key;
		var cardClass = 'pp-stmt-card' + (field.wide ? ' pp-stmt-wide' : '') + (isEditing ? ' pp-stmt-editing' : '') + (text ? '' : ' pp-stmt-blank');
		html += '<article class="' + cardClass + '">' +
			'<div class="pp-stmt-head">' +
				'<span class="pp-stmt-icon">' + iconSvg(field.icon) + '</span>' +
				'<span class="pp-stmt-label">' + esc(field.label) + '</span>' +
				(isEditing
					? '<span class="pp-stmt-mode">Editing</span>'
					: '<button type="button" class="pp-linkbtn pp-stmt-edit" data-summary-edit="' + field.key + '">' + (text ? 'Edit' : 'Add') + '</button>') +
			'</div>';
		if (isEditing) {
			if (field.input === 'text') {
				html += '<input type="text" class="pp-input pp-stmt-input" id="pp-stmt-input" maxlength="' + (field.maxlength || 200) + '" value="' + esc(DB.summary[field.key] || '') + '" placeholder="' + esc(field.placeholder || '') + '">';
			} else {
				html += '<textarea class="pp-input pp-textarea pp-stmt-input" id="pp-stmt-input" rows="' + (field.rows || 5) + '" placeholder="' + esc(field.placeholder || '') + '">' + esc(DB.summary[field.key] || '') + '</textarea>';
			}
			if (field.sample) {
				html += '<div class="pp-stmt-sample">' +
					'<span class="pp-stmt-sample-label">Example</span>' +
					'<p class="pp-stmt-sample-text">' + esc(field.sample) + '</p>' +
					'<button type="button" class="pp-btn pp-btn-sm pp-btn-secondary" data-summary-sample="' + field.key + '">Use this example</button>' +
				'</div>';
			}
			html += '<div class="pp-stmt-foot">' +
				'<span class="pp-stmt-count" id="pp-stmt-count">' + (field.input === 'text' ? '' : countWords(DB.summary[field.key]) + ' words') + '</span>' +
				'<span class="pp-stmt-actions">' +
					'<button type="button" class="pp-btn pp-btn-sm" data-summary-cancel>Cancel</button>' +
					'<button type="button" class="pp-btn pp-btn-sm pp-btn-primary" data-summary-save="' + field.key + '">Save</button>' +
				'</span>' +
			'</div>';
		} else if (text) {
			html += '<p class="pp-stmt-text">' + esc(text).replace(/\n/g, '<br>') + '</p>';
		} else {
			html += '<p class="pp-stmt-empty">Nothing written yet.</p>';
		}
		html += '<p class="pp-stmt-hint">' + esc(field.hint) + '</p></article>';
	});
	container.innerHTML = html;
	if (editingSummaryKey) {
		var input = el('pp-stmt-input');
		if (input) {
			input.focus();
			if (input.setSelectionRange) {
				try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) { /* type=text in old browsers */ }
			}
		}
	}
}
function openSummaryEditor(key) {
	if (isReadOnly || !summaryFieldByKey(key)) return;
	editingSummaryKey = key;
	renderSummaryCards();
}
function cancelSummaryEditor() {
	editingSummaryKey = null;
	renderSummaryCards();
}
function useSummarySample(key) {
	var field = summaryFieldByKey(key);
	var input = el('pp-stmt-input');
	if (!field || !input || !field.sample) return;
	input.value = field.sample;
	var counter = el('pp-stmt-count');
	if (counter && field.input !== 'text') counter.textContent = countWords(input.value) + ' words';
	input.focus();
}
function saveSummaryEditor(key) {
	var field = summaryFieldByKey(key);
	var input = el('pp-stmt-input');
	if (!field || !input) return;
	var value = input.value;
	if (field.maxlength) value = value.slice(0, field.maxlength);
	DB.summary[key] = value;
	editingSummaryKey = null;
	DB.profile.updatedAt = nowIso();
	saveNow();
	renderSummaryCards();
	if (isDrawerOpen()) renderShare();
	notify(field.label + ' saved', 'success');
}

/* ── Word counts and previews ── */
function updateEssayWordCount(textarea) {
	var container = textarea.closest('.pp-array-item');
	if (!container) return;
	var counter = container.querySelector('[data-wordcount-index]');
	if (counter) counter.textContent = countWords(textarea.value) + ' words';
}

/* ── Readiness and export ── */
function buildReadiness() {
	var focus = profileFocusSet();
	var items = [];
	function add(label, ok, hint) { items.push({ label: label, ok: !!ok, hint: hint || '' }); }
	add('Name and email', DB.basicInfo.legalName && DB.contact.email, 'Add both in Basic Information');
	add('Headline and summary', DB.summary.headline && DB.summary.summary, 'Write these in Profile Summary');
	if (focus.employment) add('Work experience or projects', DB.workExperience.length || DB.projects.length, 'Add at least one role or project');
	if (focus.employment || focus.credentials) add('Skills', DB.skills.length, 'Add the skills the applications ask about');
	if (focus.university) add('Education history', DB.education.length, 'Add your current program');
	if (focus.university || focus.scholarship) add('Test scores', DB.testScores.length, 'Record the scores you will report');
	if (focus.university || focus.scholarship) add('A written statement', DB.essays.length, 'Save a personal statement you can reuse');
	if (focus.university || focus.scholarship || focus.community) add('Activities or service', DB.extracurricular.length || DB.volunteer.length, 'Show what you do beyond class or work');
	if (focus.identity || focus.immigration || focus.government) add('Identity document', DB.identity.idType && DB.identity.idNumber, 'Record the document an application will ask for');
	if (focus.immigration) add('Residency status', DB.identity.statusType, 'Add status and expiry in Identity & Status');
	if (focus.health) add('Emergency contact', DB.health.emergencyName && DB.health.emergencyPhone, 'Add both in Health, Access & Emergency');
	if (focus.portfolio) add('Portfolio projects', DB.projects.length, 'Add your strongest work');
	if (focus.scholarship) add('Funding details', DB.funding.sponsorship || DB.funding.scholarshipTargets, 'Add what you are applying for');
	add('A reference', DB.references.length, 'Add someone who can speak about your work');
	// Only surface the first six, missing items first, so the list stays useful.
	items.sort(function (left, right) { return (left.ok === right.ok) ? 0 : (left.ok ? 1 : -1); });
	return items.slice(0, 6);
}

function renderReadiness() {
	var list = el('pp-readiness-list');
	if (!list) return;
	var items = buildReadiness();
	var html = '';
	items.forEach(function (item) {
		html += '<li class="pp-readiness-item ' + (item.ok ? 'is-done' : 'is-missing') + '">' +
			iconSvg(item.ok ? 'check' : 'warning') +
			'<span><strong>' + esc(item.label) + '</strong>' + (item.ok ? '' : ' - ' + esc(item.hint)) + '</span>' +
		'</li>';
	});
	list.innerHTML = html;
}

function buildProfileSummaryText() {
	var lines = [];
	var name = DB.basicInfo.legalName || DB.basicInfo.preferredName || 'Personal profile';
	lines.push(name.toUpperCase());
	if (DB.summary.headline) lines.push(DB.summary.headline);
	var contactBits = [];
	if (DB.contact.email) contactBits.push(DB.contact.email);
	if (DB.contact.phone) contactBits.push(DB.contact.phone);
	var place = [DB.contact.city, DB.contact.state, DB.contact.country].filter(Boolean).join(', ');
	if (place) contactBits.push(place);
	if (contactBits.length) lines.push(contactBits.join('  |  '));
	var links = [];
	if (DB.contact.linkedin) links.push('LinkedIn: ' + DB.contact.linkedin);
	if (DB.contact.github) links.push('Code: ' + DB.contact.github);
	if (DB.contact.website) links.push('Web: ' + DB.contact.website);
	DB.contact.links.forEach(function (link) { if (link.url) links.push((link.label || 'Link') + ': ' + link.url); });
	if (links.length) lines.push(links.join('  |  '));

	function pushBlock(title, text) {
		if (!String(text || '').trim()) return;
		lines.push('');
		lines.push(title);
		lines.push(String(text).trim());
	}
	pushBlock('PROFILE', DB.summary.summary);
	pushBlock('OBJECTIVES', DB.summary.objectives);

	if (DB.workExperience.length) {
		lines.push('');
		lines.push('EXPERIENCE');
		DB.workExperience.forEach(function (role) {
			var period = [role.startDate, role.current ? 'Present' : role.endDate].filter(Boolean).join(' - ');
			var heading = [role.title, role.employer].filter(Boolean).join(', ');
			lines.push('- ' + (heading || 'Role') + (period ? ' (' + period + ')' : ''));
			if (role.summary) lines.push('  ' + String(role.summary).replace(/\s+/g, ' ').trim());
			if (role.achievements) lines.push('  ' + String(role.achievements).replace(/\s+/g, ' ').trim());
		});
	}
	if (DB.education.length) {
		lines.push('');
		lines.push('EDUCATION');
		DB.education.forEach(function (entry) {
			var period = [entry.startDate, entry.endDate].filter(Boolean).join(' - ');
			var heading = [entry.credential, entry.institution].filter(Boolean).join(', ');
			lines.push('- ' + (heading || 'Program') + (period ? ' (' + period + ')' : '') + (entry.gpa ? ', ' + entry.gpa + (entry.gpaScale ? '/' + entry.gpaScale : '') : ''));
		});
	}
	if (DB.skills.length) {
		lines.push('');
		lines.push('SKILLS');
		lines.push(DB.skills.map(function (skill) { return skill.name + (skill.level ? ' (' + skill.level + ')' : ''); }).filter(Boolean).join(', '));
	}
	if (DB.certifications.length) {
		lines.push('');
		lines.push('CERTIFICATIONS');
		DB.certifications.forEach(function (certification) {
			lines.push('- ' + [certification.name, certification.issuer, certification.expiryDate ? 'expires ' + certification.expiryDate : ''].filter(Boolean).join(', '));
		});
	}
	if (DB.languages.length) {
		lines.push('');
		lines.push('LANGUAGES');
		lines.push(DB.languages.map(function (language) { return language.language + (language.speaking ? ' (' + language.speaking + ')' : ''); }).filter(Boolean).join(', '));
	}
	if (DB.projects.length) {
		lines.push('');
		lines.push('PROJECTS');
		DB.projects.forEach(function (project) {
			lines.push('- ' + [project.name, project.role, project.outcome].filter(Boolean).join(' - '));
		});
	}
	if (DB.volunteer.length) {
		lines.push('');
		lines.push('VOLUNTEER');
		DB.volunteer.forEach(function (role) {
			lines.push('- ' + [role.role, role.organization, role.hours ? role.hours + ' hours' : ''].filter(Boolean).join(', '));
		});
	}
	if (DB.achievements.length) {
		lines.push('');
		lines.push('ACHIEVEMENTS');
		DB.achievements.forEach(function (achievement) {
			lines.push('- ' + [achievement.title, achievement.issuer, achievement.date].filter(Boolean).join(', '));
		});
	}
	if (DB.references.length) {
		lines.push('');
		lines.push('REFERENCES');
		DB.references.forEach(function (reference) {
			lines.push('- ' + [reference.name, reference.title, reference.organization].filter(Boolean).join(', ') + (reference.email ? ' <' + reference.email + '>' : ''));
		});
	}
	lines.push('');
	lines.push('Prepared from a personal profile record on ' + new Date().toISOString().slice(0, 10) + '.');
	return lines.join('\n');
}

function buildExportData(includeSensitive) {
	var copy = JSON.parse(JSON.stringify(DB));
	copy.exportedAt = nowIso();
	copy.exportedFrom = 'PersonalProfile';
	copy.exportedSensitive = !!includeSensitive;
	if (!includeSensitive) {
		copy.personal = {};
		copy.identity = {};
		copy.health = {};
		copy.funding = {};
		copy.documents = [];
	}
	return copy;
}

function renderShare() {
	renderReadiness();
	var preview = el('pp-output-preview');
	if (preview) preview.textContent = buildProfileSummaryText();
	var sensitiveToggle = el('f-export-sensitive');
	if (sensitiveToggle) sensitiveToggle.checked = !!DB.profile.exportIncludeSensitive;
}

/* ── Share drawer and header menu ──
   Share and export is a tool-level action, not a profile section: the avatar
   menu opens a drawer, so the section list stays about the person's data. */
function isDrawerOpen() {
	var drawer = el('pp-drawer');
	return !!drawer && drawer.classList.contains('open');
}
function openDrawer() {
	var drawer = el('pp-drawer');
	if (!drawer) return;
	renderShare();
	drawer.classList.add('open');
	drawer.setAttribute('aria-hidden', 'false');
	var overlay = el('pp-drawer-overlay');
	if (overlay) overlay.classList.add('open');
	if (typeof tool.resize === 'function') tool.resize();
}
function closeDrawer() {
	var drawer = el('pp-drawer');
	if (!drawer) return;
	drawer.classList.remove('open');
	drawer.setAttribute('aria-hidden', 'true');
	var overlay = el('pp-drawer-overlay');
	if (overlay) overlay.classList.remove('open');
	var toggle = el('pp-menu-toggle');
	if (toggle) toggle.focus();
}
function setMenuOpen(open) {
	var menu = el('pp-menu');
	var toggle = el('pp-menu-toggle');
	if (!menu || !toggle) return;
	menu.hidden = !open;
	toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
	if (open) renderAvatars();
}
function toggleMenu() {
	var menu = el('pp-menu');
	if (!menu) return;
	setMenuOpen(menu.hidden);
}

function copyTextToClipboard(text, successMessage) {
	function fallbackCopy() {
		var area = document.createElement('textarea');
		area.value = text;
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		var copied = false;
		try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
		area.parentNode.removeChild(area);
		notify(copied ? successMessage : 'Copy blocked by the browser. Select the preview text and copy it manually.', copied ? 'success' : 'warning');
	}
	if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text).then(function () { notify(successMessage, 'success'); }, fallbackCopy);
		return;
	}
	fallbackCopy();
}

function slugForFileName() {
	var base = DB.basicInfo.legalName || DB.basicInfo.preferredName || 'personal-profile';
	return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'personal-profile';
}

function downloadProfileJson() {
	var includeSensitive = !!DB.profile.exportIncludeSensitive;
	var text = JSON.stringify(buildExportData(includeSensitive), null, 2);
	if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
		copyTextToClipboard(text, 'JSON copied to the clipboard');
		return;
	}
	var blob = new Blob([text], { type: 'application/json' });
	var url = URL.createObjectURL(blob);
	var anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = slugForFileName() + '-profile.json';
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
	notify('Profile JSON downloaded', 'success');
}

/* ── Uploads ── */
function uploadProfilePhoto() {
	if (typeof tool.requestUpload !== 'function') {
		notify('File upload is not available here. Paste an image link instead.', 'warning');
		return;
	}
	tool.requestUpload('image/*', function (error, file) {
		if (error || !file || !file.url) {
			notify('No photo selected', 'warning');
			return;
		}
		// Write the value into the visible field first: the save path reads the
		// DOM back, so an in-memory-only write would be overwritten.
		setVal('f-photoUrl', file.url);
		DB.basicInfo.photoUrl = file.url;
		DB.basicInfo.photoName = String(file.name || '').slice(0, 160);
		DB.profile.updatedAt = nowIso();
		saveNow();
		renderPhotoField();
		renderAvatars();
		if (isDrawerOpen()) renderShare();
		notify('Photo added', 'success');
	});
}

function uploadDocumentFile(index) {
	var record = DB.documents[index];
	if (!record) return;
	if (typeof tool.requestUpload !== 'function') {
		notify('File upload is not available here. Paste a link instead.', 'warning');
		return;
	}
	tool.requestUpload('*/*', function (error, file) {
		if (error || !file || !file.url) {
			notify('No file selected', 'warning');
			return;
		}
		readAllFromDOM();
		record.fileUrl = file.url;
		record.fileName = String(file.name || '').slice(0, 160);
		DB.profile.updatedAt = nowIso();
		// Mirror the value into the rendered field before the save path reads
		// the DOM, otherwise the old link is written back over the upload.
		var fileInput = document.querySelector('[data-list="documents"][data-idx="' + index + '"][data-field="fileUrl"]');
		if (fileInput) fileInput.value = file.url;
		saveNow();
		renderArrayList('documents');
		notify('Document attached', 'success');
	});
}

/* ── Start ── */
tool.onReady(function (value) {
	loadDB(value);
	parseVisibleSections();
	injectStaticIcons();
	populateSelectOptions();
	renderAll();
	updateHeaderName();
	updateThemeToggleIcon();

	isReadOnly = !!tool.isReadOnly();
	if (isReadOnly) el('app').classList.add('pp-readonly');

	prefillFromAccount();
	if (!DB.profile.prefilledFromAccount) {
		[400, 1200, 2600, 5000].forEach(function (delay) {
			setTimeout(function () { prefillFromAccount(); }, delay);
		});
	}

	if (typeof tool.onValueChange === 'function') {
		tool.onValueChange(function (nextValue) {
			if (selfSaving) return;
			if (nextValue && JSON.stringify(nextValue) === lastStagedJson) return;
			loadDB(nextValue);
			renderAll();
			updateHeaderName();
		});
	}
	if (typeof tool.onReadonlyChange === 'function') {
		tool.onReadonlyChange(function (readOnlyValue) {
			isReadOnly = !!readOnlyValue;
			el('app').classList.toggle('pp-readonly', isReadOnly);
		});
	}
	if (typeof tool.resize === 'function') tool.resize();
});

function injectStaticIcons() {
	var nodes = document.querySelectorAll('#app [data-icon]');
	for (var i = 0; i < nodes.length; i++) {
		var iconName = nodes[i].getAttribute('data-icon');
		if (iconName && ICON_PATHS[iconName]) nodes[i].innerHTML = iconSvg(iconName);
	}
}

function populateSelectOptions() {
	function fill(selectId, options) {
		var select = el(selectId);
		if (!select) return;
		var html = '';
		options.forEach(function (option) {
			html += '<option value="' + esc(option) + '">' + esc(option || '- Select -') + '</option>';
		});
		select.innerHTML = html;
	}
	fill('f-pronouns', PRONOUN_OPTIONS);
	fill('f-gender', GENDER_OPTIONS);
	fill('f-maritalStatus', MARITAL_OPTIONS);
	fill('f-idType', ID_TYPE_OPTIONS);
	fill('f-statusType', STATUS_TYPE_OPTIONS);
	fill('f-bloodType', BLOOD_TYPE_OPTIONS);
	var kindSelect = el('f-profile-kind');
	if (kindSelect) {
		var html = '<option value="">Select a profile use</option>';
		PROFILE_KINDS.forEach(function (kind) {
			html += '<option value="' + kind.id + '">' + esc(kind.label) + '</option>';
		});
		kindSelect.innerHTML = html;
	}
}

function prefillFromAccount() {
	if (DB.profile.prefilledFromAccount) return;
	var user = getUserSafe();
	if (!user) return;
	var fullName = user.name || ((user.firstName || '') + ' ' + (user.lastName || '')).trim();
	var changed = false;
	if (!DB.basicInfo.legalName && fullName) { DB.basicInfo.legalName = fullName; changed = true; }
	if (!DB.basicInfo.preferredName && user.firstName) { DB.basicInfo.preferredName = String(user.firstName); changed = true; }
	if (!DB.contact.email && user.email) { DB.contact.email = String(user.email); changed = true; }
	DB.profile.prefilledFromAccount = true;
	if (changed) {
		renderBasicInfo();
		renderContact();
		updateHeaderName();
		saveNow();
	}
}

function updateThemeToggleIcon() {
	var button = el('pp-theme-toggle');
	if (!button) return;
	var isDark = el('app').classList.contains('pp-dark');
	button.innerHTML = iconSvg(isDark ? 'sun' : 'moon');
	button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
}

/* ── Events ── */
var appRoot = document.getElementById('app');

appRoot.addEventListener('click', function (event) {
	var target = event.target;

	if (target.closest('#pp-theme-toggle')) {
		appRoot.classList.toggle('pp-dark');
		updateThemeToggleIcon();
		return;
	}

	if (target.closest('#pp-menu-toggle')) { toggleMenu(); return; }
	if (!target.closest('.pp-account')) setMenuOpen(false);
	if (target.closest('#pp-drawer-close') || target.closest('#pp-drawer-overlay')) { closeDrawer(); return; }
	var menuAction = target.closest('[data-menu-action]');
	if (menuAction) {
		var menuActionName = menuAction.getAttribute('data-menu-action');
		setMenuOpen(false);
		if (menuActionName === 'share') openDrawer();
		else if (menuActionName === 'basic') { switchToSection('basic'); window.scrollTo(0, 0); }
		return;
	}

	var summaryEdit = target.closest('[data-summary-edit]');
	if (summaryEdit) { openSummaryEditor(summaryEdit.getAttribute('data-summary-edit')); return; }
	var summarySave = target.closest('[data-summary-save]');
	if (summarySave) { saveSummaryEditor(summarySave.getAttribute('data-summary-save')); return; }
	var summarySample = target.closest('[data-summary-sample]');
	if (summarySample) { useSummarySample(summarySample.getAttribute('data-summary-sample')); return; }
	if (target.closest('[data-summary-cancel]')) { cancelSummaryEditor(); return; }

	var focusChip = target.closest('[data-focus]');
	if (focusChip) {
		if (!isReadOnly) toggleFocusArea(focusChip.getAttribute('data-focus'));
		return;
	}
	if (target.closest('#pp-scope-toggle')) {
		if (!isReadOnly) toggleShowAllSections();
		return;
	}
	if (target.closest('[data-apply-preset]')) {
		if (isReadOnly) return;
		var applied = applyKindPreset(true);
		DB.profile.updatedAt = nowIso();
		saveNow();
		renderProfileSetup();
		buildNav();
		syncSectionVisibility();
		updateCompletion();
		if (applied) notify('Suggested areas applied', 'info');
		return;
	}
	var customAdd = target.closest('[data-custom-add]');
	if (customAdd) {
		if (!isReadOnly) addCustomField(customAdd.getAttribute('data-custom-add'));
		return;
	}
	var customRemove = target.closest('[data-custom-remove]');
	if (customRemove) {
		if (!isReadOnly) removeCustomField(customRemove.getAttribute('data-custom-owner'), customRemove.getAttribute('data-custom-remove'));
		return;
	}
	var customEdit = target.closest('[data-custom-edit]');
	if (customEdit) {
		if (!isReadOnly) openCustomSectionModal(customEdit.getAttribute('data-custom-edit'));
		return;
	}
	if (target.closest('#pp-add-custom-section')) {
		if (!isReadOnly) openCustomSectionModal(null);
		return;
	}
	var navStep = target.closest('[data-nav-step]');
	if (navStep) { navigateSection(parseInt(navStep.getAttribute('data-nav-step'), 10) || 1); return; }
	var navItem = target.closest('[data-nav]');
	if (navItem) { switchToSection(navItem.getAttribute('data-nav')); return; }

	var actionButton = target.closest('[data-action]');
	if (!actionButton) return;
	if (actionButton.closest('#pp-menu')) setMenuOpen(false);
	var action = actionButton.getAttribute('data-action');
	var index = parseInt(actionButton.getAttribute('data-idx'), 10);

	if (action === 'add-item') { if (!isReadOnly) addArrayItem(actionButton.getAttribute('data-list')); return; }
	if (action === 'toggle-item') { if (!isReadOnly) toggleArrayItem(actionButton.getAttribute('data-list'), index); return; }
	if (action === 'remove-item') { if (!isReadOnly) removeArrayItem(actionButton.getAttribute('data-list'), index); return; }
	if (action === 'upload-photo') { if (!isReadOnly) uploadProfilePhoto(); return; }
	if (action === 'toggle-photo-url') {
		var urlWrap = el('pp-photo-url-wrap');
		if (!urlWrap) return;
		urlWrap.hidden = !urlWrap.hidden;
		if (!urlWrap.hidden) { var urlInput = el('f-photoUrl'); if (urlInput) urlInput.focus(); }
		return;
	}
	if (action === 'remove-photo') {
		if (isReadOnly) return;
		setVal('f-photoUrl', '');
		DB.basicInfo.photoUrl = '';
		DB.basicInfo.photoName = '';
		saveNow();
		renderPhotoField();
		renderAvatars();
		return;
	}
	if (action === 'upload-document') { if (!isReadOnly) uploadDocumentFile(index); return; }
	if (action === 'copy-summary') { copyTextToClipboard(buildProfileSummaryText(), 'Summary copied to the clipboard'); return; }
	if (action === 'copy-json') { copyTextToClipboard(JSON.stringify(buildExportData(!!DB.profile.exportIncludeSensitive), null, 2), 'Profile JSON copied to the clipboard'); return; }
	if (action === 'download-json') { downloadProfileJson(); return; }
});

appRoot.addEventListener('input', function (event) {
	if (isReadOnly) return;
	var target = event.target;
	var customControl = target.closest('[data-custom-prop]');
	if (customControl && customControl.getAttribute('data-custom-prop') !== 'type') {
		updateCustomFieldProp(customControl);
		return;
	}
	if (!target.classList || !target.classList.contains('pp-input')) return;
	if (target.id === 'pp-stmt-input') {
		var summaryField = summaryFieldByKey(editingSummaryKey);
		var summaryCounter = el('pp-stmt-count');
		if (summaryCounter && summaryField && summaryField.input !== 'text') summaryCounter.textContent = countWords(target.value) + ' words';
		return;
	}
	if (target.id === 'f-birthYear') {
		var birthYearDigits = target.value.replace(/[^0-9]/g, '').slice(0, 4);
		if (target.value !== birthYearDigits) target.value = birthYearDigits;
	}
	scheduleSave();
	if (target.getAttribute('data-list') === 'essays' && target.getAttribute('data-field') === 'content') updateEssayWordCount(target);
	if (target.id === 'f-photoUrl') {
		DB.basicInfo.photoUrl = target.value;
		var photoAvatar = el('pp-photo-avatar');
		if (photoAvatar) {
			photoAvatar.style.backgroundImage = target.value ? 'url("' + target.value.replace(/"/g, '%22') + '")' : '';
			photoAvatar.classList.toggle('has-photo', !!target.value);
		}
		renderAvatars();
	}
	if (isDrawerOpen()) renderShare();
});

appRoot.addEventListener('change', function (event) {
	if (isReadOnly) return;
	var target = event.target;

	if (target.closest('[data-custom-prop]')) { updateCustomFieldProp(target); return; }

	if (target.id === 'f-profile-kind') {
		var previousKind = DB.profile.kind;
		DB.profile.kind = target.value || '';
		DB.profile.kindChosen = !!DB.profile.kind;
		if (previousKind !== DB.profile.kind) {
			applyKindPreset(true);
			DB.profile.updatedAt = nowIso();
			saveNow();
			renderProfileSetup();
			buildNav();
			syncSectionVisibility();
			updateCompletion();
			if (DB.profile.kind) notify('Sections suggested for ' + profileKindLabel(DB.profile.kind), 'info');
		}
		return;
	}
	if (target.id === 'f-funding-needsAid' || target.id === 'f-export-sensitive') {
		saveNow();
		if (target.id === 'f-export-sensitive') renderShare();
		return;
	}
	if (target.classList && (target.classList.contains('pp-input') || target.getAttribute('data-list'))) {
		saveNow();
		if (target.getAttribute('data-list') === 'workExperience' && target.getAttribute('data-field') === 'current') renderArrayList('workExperience');
		if (isDrawerOpen()) renderShare();
	}
});

/* ── Modal ── */
function closeModal() {
	var overlay = el('pp-modal-overlay');
	if (overlay) overlay.classList.remove('open');
	modalCallback = null;
}
el('pp-modal-close').addEventListener('click', closeModal);
el('pp-modal-cancel').addEventListener('click', closeModal);
el('pp-modal-overlay').addEventListener('click', function (event) {
	if (event.target === el('pp-modal-overlay')) closeModal();
});
el('pp-modal-save').addEventListener('click', function () {
	if (!modalCallback) return;
	var result = modalCallback();
	if (result === false) return;
	closeModal();
});
var modalBody = el('pp-modal-body');
if (modalBody) {
	modalBody.addEventListener('click', function (event) {
		var deleteButton = event.target.closest('[data-custom-section-delete]');
		if (!deleteButton) return;
		if (deleteButton.getAttribute('data-armed') !== '1') {
			deleteButton.setAttribute('data-armed', '1');
			deleteButton.textContent = 'Click again to delete this section';
			return;
		}
		var sectionId = deleteButton.getAttribute('data-custom-section-delete');
		modalCallback = null;
		closeModal();
		deleteCustomSection(sectionId);
	});
}
document.addEventListener('keydown', function (event) {
	if (event.key !== 'Escape') return;
	var overlay = el('pp-modal-overlay');
	if (overlay && overlay.classList.contains('open')) { closeModal(); return; }
	if (isDrawerOpen()) { closeDrawer(); return; }
	setMenuOpen(false);
	if (editingSummaryKey) cancelSummaryEditor();
});

/* ── Declarations ── */
tool.declareOutput({
	type: 'object',
	description: 'One personal profile used across applications',
	properties: {
		schemaVersion: { type: 'number' },
		basicInfo: { type: 'object' },
		personal: { type: 'object' },
		summary: { type: 'object' },
		contact: { type: 'object' },
		identity: { type: 'object' },
		documents: { type: 'array' },
		health: { type: 'object' },
		education: { type: 'array' },
		testScores: { type: 'array' },
		certifications: { type: 'array' },
		workExperience: { type: 'array' },
		skills: { type: 'array' },
		projects: { type: 'array' },
		publications: { type: 'array' },
		achievements: { type: 'array' },
		volunteer: { type: 'array' },
		extracurricular: { type: 'array' },
		references: { type: 'array' },
		essays: { type: 'array' },
		languages: { type: 'array' },
		preferences: { type: 'object' },
		funding: { type: 'object' },
		profile: { type: 'object' }
	}
});

tool.declareParams([
	{ name: 'visibleSections', label: 'Visible Sections', type: 'text', default: 'all', hint: 'Comma-separated section IDs, or "all". Options: basic,summary,contact,languages,personal,identity,documents,health,education,testscores,certifications,work,skills,projects,publications,achievements,volunteer,extracurricular,references,essays,preferences,funding' },
	{ name: 'defaultKind', label: 'Default profile use', type: 'text', default: '', hint: 'Seeds the profile use on a new record. Options: general,resume,job,university,scholarship,research,volunteer,portfolio,immigration,government,health' },
	{ name: 'defaultFocus', label: 'Default focus areas', type: 'text', default: '', hint: 'Comma-separated focus area IDs seeded on a new record, e.g. university,tests,community' },
	{ name: 'allowUpload', label: 'Allow file upload', type: 'goodToHave', default: '', hint: 'Set to yes so the profile photo and document files can be uploaded' }
]);

if (typeof tool.resize === 'function') tool.resize();

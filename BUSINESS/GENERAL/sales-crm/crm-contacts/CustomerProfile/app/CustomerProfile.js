/* js build 2026-11-06-1 */
/* ── Customer Profile ──────────────────────────────────────────────
   One customer per CMS record. Basic information always shows; the
	   selected question sets plus focus areas decide which extra sections
   appear. Same design system and layout strategy as the Personal
   Profile and Company Profile tools.
   Built for the UniconHub CMS html-tool system.
────────────────────────────────────────────────────────────────── */
(function () {
	'use strict';

	var TOOL_BUILD = '2026-11-06-1';

	/* ── SDK handle + fallback shim ── */
	var tool = (typeof window !== 'undefined' && window.tool) ? window.tool : null;
	if (!tool) {
		var fallbackValue = null;
		tool = {
			onReady: function (callback) { callback(fallbackValue, {}); },
			getValue: function () { return fallbackValue; },
			setValue: function (value) { fallbackValue = value; },
			onValueChange: function () { },
			getFields: function () { return {}; },
			setField: function () { },
			setFields: function () { },
			watchField: function () { },
			onFieldsChange: function () { },
			param: function (name, fallback) { return fallback; },
			isReadOnly: function () { return false; },
			onReadonlyChange: function () { },
			getUser: function () { return null; },
			onUserChange: function () { },
			getPermittedUsers: function () { return []; },
			onPermittedUsersChange: function () { },
			reportValid: function () { },
			notify: function (message) { try { console.log('notify: ' + message); } catch (error) { } },
			resize: function () { },
			openUrl: function () { },
			declareOutput: function () { },
			declareParams: function () { },
			reportMissingParams: function () { }
		};
	}

	/* ── Helpers ── */
	function $(selector, root) { return (root || document).querySelector(selector); }
	function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
	function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
	function trimString(value) { return typeof value === 'string' ? value.trim() : ''; }
	function shortText(value, maxLength) {
		var text = trimString(value);
		if (!text || text.length <= maxLength) return text;
		return text.slice(0, Math.max(1, maxLength - 3)).replace(/\s+$/, '') + '...';
	}
	function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
	function esc(value) {
		return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (character) {
			if (character === '&') return '&amp;';
			if (character === '<') return '&lt;';
			if (character === '>') return '&gt;';
			if (character === '"') return '&quot;';
			return '&#39;';
		});
	}
	function nowISO() { return new Date().toISOString(); }
	function todayISO() {
		var date = new Date();
		return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
	}
	function formatShortDate(isoDate) {
		if (!isoDate) return '';
		var parsed = new Date(isoDate + 'T00:00:00');
		if (isNaN(parsed.getTime())) return String(isoDate);
		return parsed.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
	}
	function notify(message, severity) {
		try { tool.notify(message, severity || 'info'); } catch (error) { }
	}
	function resize() {
		try { tool.resize(); } catch (error) { }
	}
	function slugify(text) {
		return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	}
	function fieldIdFrom(text) {
		var cleaned = String(text || '').trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
		return cleaned || slugify(text).replace(/-/g, '_');
	}

	/* ── Icons ── */
	var ICON_PATHS = {
		user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0"/>',
		building: '<path d="M4 20.5V5.2A1.7 1.7 0 0 1 5.7 3.5h8.6A1.7 1.7 0 0 1 16 5.2v15.3"/><path d="M16 9h2.7a1.7 1.7 0 0 1 1.7 1.7v9.8M3 20.5h18M7.5 7.5h1M11.5 7.5h1M7.5 11h1M11.5 11h1M7.5 14.5h1M11.5 14.5h1M7.5 18h1"/>',
		mail: '<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="m3.6 7 8.4 6 8.4-6"/>',
		phone: '<path d="M6.2 3.6h3l1.2 3-1.7 1.4a12.8 12.8 0 0 0 5.3 5.3l1.4-1.7 3 1.2v3a1.8 1.8 0 0 1-2 1.8A15.2 15.2 0 0 1 4.4 5.6a1.8 1.8 0 0 1 1.8-2Z"/>',
		pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
		users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0"/><path d="M15.5 5.2a3.4 3.4 0 0 1 0 5.6M17.2 14.6a6.2 6.2 0 0 1 4 5.6"/>',
		note: '<path d="M6 3.5h8l4 4v13H6v-17Z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>',
		activity: '<path d="M3 12h4l2.4-6 4.2 12 2.4-6h5"/>',
		briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18"/>',
		star: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5Z"/>',
		shield: '<path d="M12 3.2 19 6v6.1c0 4.4-2.9 7.6-7 8.9-4.1-1.3-7-4.5-7-8.9V6l7-2.8Z"/><path d="m9 12 2.1 2.1L15.4 10"/>',
		tag: '<path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="8" cy="8" r="1.2"/>',
		layers: '<path d="m12 3.5 8.5 4.4-8.5 4.4-8.5-4.4L12 3.5Z"/><path d="m4 12.4 8 4.2 8-4.2M4 16.6l8 4.2 8-4.2"/>',
		card: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 10h18M16.5 14.5h1.5"/>',
		globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z"/>',
		calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		trash: '<path d="M4 7h16M9.5 7V5h5v2M6.5 7l.9 12.5h9.2L17.5 7"/>',
		check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
		x: '<path d="M18 6 6 18M6 6l12 12"/>',
		chevron: '<path d="m6 9 6 6 6-6"/>',
		chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
		chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
		download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15"/>',
		copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5"/>',
		share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="m8.2 10.9 7.6-3.7M8.2 13.1l7.6 3.7"/>',
		warning: '<path d="M12 4.5 21 20H3L12 4.5Z"/><path d="M12 9.5v4.5M12 16.8h.01"/>',
		pencil: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m15 6.5 3 3"/>',
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
		moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.6 8.6 0 1 0 10.5 10.5Z"/>',
		more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
		server: '<rect x="3" y="4" width="18" height="6" rx="1.8"/><rect x="3" y="14" width="18" height="6" rx="1.8"/><path d="M7 7h.01M7 17h.01M11 7h4M11 17h4"/>',
		code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
		cart: '<path d="M3 4h2l2.2 10.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="17.5" cy="20" r="1.2"/>',
		factory: '<path d="M3 20V9l5 3V9l5 3V9l5 3v8H3Z"/><path d="M7 20v-3M11 20v-3M15 20v-3M18 20v-3"/>',
		hardHat: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M9 9V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 17h18v2H3z"/>',
		truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
		heart: '<path d="M20.2 5.8a5 5 0 0 0-7.1 0L12 6.9l-1.1-1.1a5 5 0 1 0-7.1 7.1L12 21l8.2-8.1a5 5 0 0 0 0-7.1Z"/>'
	};

	function iconSvg(name) {
		var body = ICON_PATHS[name];
		if (!body) body = ICON_PATHS.layers;
		return '<svg class="cp-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
	}

	function injectStaticIcons() {
		$$('#app [data-icon]').forEach(function (node) {
			var iconName = node.getAttribute('data-icon');
			if (iconName && ICON_PATHS[iconName]) node.innerHTML = iconSvg(iconName);
		});
	}

	/* ── Options ── */
	var DEFAULT_STATUS_OPTIONS = ['Lead', 'Prospect', 'Active', 'Dormant', 'Inactive', 'Blocked'];
	var DEFAULT_SOURCE_OPTIONS = ['Referral', 'Website', 'Walk-in', 'Phone enquiry', 'Social media', 'Campaign', 'Partner', 'Event', 'Other'];
	var PRIORITY_OPTIONS = ['Standard', 'High', 'VIP'];
	var CHANNEL_OPTIONS = ['Email', 'Phone', 'SMS', 'WhatsApp', 'In person', 'Video call', 'Other'];
	var INTERACTION_CHANNEL_OPTIONS = ['Call', 'Email', 'Meeting', 'Message', 'Note', 'Other'];
	var INDUSTRY_OPTIONS = ['Technology', 'Retail & e-commerce', 'Manufacturing', 'Construction', 'Healthcare', 'Education', 'Finance & insurance', 'Professional services', 'Hospitality', 'Transport & logistics', 'Non-profit', 'Government', 'Real estate', 'Other'];
	var COMPANY_SIZE_OPTIONS = ['1-9', '10-49', '50-249', '250-999', '1,000+'];
	var PAYMENT_TERM_OPTIONS = ['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Prepaid', 'Other'];
	var CURRENCY_OPTIONS = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'TRY', 'Other'];
	var CLOUD_PROVIDER_OPTIONS = ['AWS', 'Microsoft Azure', 'Google Cloud', 'Oracle Cloud', 'IBM Cloud', 'On-premises', 'Hybrid', 'Other'];
	var HOSTING_MODEL_OPTIONS = ['Public cloud', 'Private cloud', 'Hybrid', 'On-premises', 'Colocation', 'Other'];
	var ENVIRONMENT_OPTIONS = ['Development', 'Staging', 'Production', 'Disaster recovery'];
	var COMPLIANCE_OPTIONS = ['SOC 2', 'ISO 27001', 'HIPAA', 'GDPR', 'PCI DSS', 'FedRAMP', 'None', 'Other'];
	var SSO_OPTIONS = ['Microsoft Entra ID', 'Okta', 'Google Workspace', 'Auth0', 'OneLogin', 'None', 'Other'];
	var BACKUP_FREQUENCY_OPTIONS = ['Continuous', 'Hourly', 'Daily', 'Weekly', 'Other'];
	var ENGAGEMENT_MODEL_OPTIONS = ['Fixed fee', 'Time & materials', 'Retainer', 'Milestone-based', 'Subscription', 'Other'];
	var BILLING_MODEL_OPTIONS = ['Hourly', 'Daily', 'Fixed fee', 'Retainer', 'Subscription', 'Usage-based', 'Other'];
	var DELIVERY_CADENCE_OPTIONS = ['Weekly', 'Bi-weekly', 'Monthly', 'Milestone-based', 'Other'];
	var BILLING_CYCLE_OPTIONS = ['Monthly', 'Quarterly', 'Annual', 'Usage-based', 'Other'];
	var ONBOARDING_STATUS_OPTIONS = ['Not started', 'In progress', 'Live', 'Paused', 'Other'];
	var CHURN_RISK_OPTIONS = ['Low', 'Medium', 'High', 'Unknown'];
	var RETAIL_CHANNEL_OPTIONS = ['Physical store', 'Own website', 'Marketplace', 'Social commerce', 'Wholesale', 'Other'];
	var FULFILLMENT_OPTIONS = ['In-house', '3PL', 'Dropship', 'Click & collect', 'Mixed', 'Other'];
	var INCOTERM_OPTIONS = ['EXW', 'FOB', 'CIF', 'DDP', 'DAP', 'Other'];
	var MANUFACTURING_CERTIFICATION_OPTIONS = ['ISO 9001', 'ISO 14001', 'IATF 16949', 'FDA', 'CE', 'UL', 'Other'];
	var CONSTRUCTION_PROJECT_OPTIONS = ['Residential', 'Commercial', 'Industrial', 'Infrastructure', 'Renovation', 'Other'];
	var HEALTHCARE_PRACTICE_OPTIONS = ['Clinic', 'Hospital', 'Dental', 'Physiotherapy', 'Mental health', 'Home care', 'Other'];
	var TRANSPORT_MODE_OPTIONS = ['Road', 'Rail', 'Air', 'Sea', 'Courier', 'Multimodal'];
	var WAREHOUSE_OPTIONS = ['Owned', '3PL', 'Bonded', 'Cross-dock', 'None', 'Other'];
	var TECHNICAL_ROLE_OPTIONS = ['CTO', 'Engineering manager', 'DevOps lead', 'IT manager', 'Security lead', 'Developer', 'Other'];
	var RESPONSIBILITY_AREA_OPTIONS = ['Infrastructure', 'Security', 'Development', 'Data', 'DevOps', 'Procurement', 'Other'];
	var TECH_CHANNEL_OPTIONS = ['Email', 'Slack', 'Microsoft Teams', 'Phone', 'Ticket', 'Other'];
	var PROCUREMENT_ROLE_OPTIONS = ['Procurement manager', 'Buyer', 'Finance', 'Operations', 'Other'];
	var BUDGET_CYCLE_OPTIONS = ['Monthly', 'Quarterly', 'Annual', 'Project-based', 'Other'];
	var EXECUTIVE_ROLE_OPTIONS = ['CEO', 'CFO', 'COO', 'Founder', 'Partner', 'Other'];
	var RELATIONSHIP_HEALTH_OPTIONS = ['Strong', 'Neutral', 'At risk', 'Unknown'];
	var LICENSE_MANAGEMENT_OPTIONS = ['Centralized', 'Per team', 'Per user', 'Mixed', 'Other'];
	var SUPPORT_TIER_OPTIONS = ['Standard', 'Business', 'Enterprise', '24/7', 'Other'];
	var VENDOR_FORM_OPTIONS = ['Not started', 'In progress', 'Submitted', 'Approved', 'Rejected'];
	var SECURITY_REVIEW_OPTIONS = ['Not started', 'In progress', 'Passed', 'Conditional', 'Failed'];
	var DECISION_INFLUENCE_OPTIONS = ['High', 'Medium', 'Low', 'Unknown'];
	var COMMUNICATION_CADENCE_OPTIONS = ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'As needed'];
	var FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'email', 'phone', 'url', 'select', 'multiselect', 'checkbox', 'tags'];

	/* ── Focus areas ──
	   Every extra section declares `needs`. Selecting a question set sets a
	   preset of focus areas; the customer can tick more. */
	var FOCUS_AREAS = [
		{ id: 'personal', label: 'Personal details', desc: 'Birth date, occupation, employer and language' },
		{ id: 'preferences', label: 'Contact preferences', desc: 'Preferred channel, best time and consent' },
		{ id: 'relationship', label: 'Role and relationship', desc: 'Position, department and buying influence' },
		{ id: 'business', label: 'Business details', desc: 'Industry, size, market and description' },
		{ id: 'commercial', label: 'Account and billing', desc: 'Terms, currency, credit limit and PO rules' },
		{ id: 'buying', label: 'Buying process', desc: 'Decision steps, timeline and competitors' },
		{ id: 'contract', label: 'Contract', desc: 'Start, end, renewal date and notice period' },
		{ id: 'addresses', label: 'Addresses', desc: 'Billing, shipping and site addresses' },
		{ id: 'contacts', label: 'People and roles', desc: 'People you deal with at this customer' },
		{ id: 'activity', label: 'Interactions', desc: 'Calls, emails and meetings you log' }
	];
	var SECTION_FOCUS_MAP = {
		personal: 'personal',
		preferences: 'preferences',
		role: 'relationship',
		'company-details': 'business',
		commercial: 'commercial',
		'buying-process': 'buying',
		contract: 'contract'
	};

	function focusAreaById(areaId) {
		for (var index = 0; index < FOCUS_AREAS.length; index++) {
			if (FOCUS_AREAS[index].id === areaId) return FOCUS_AREAS[index];
		}
		return null;
	}

	/* ── Built-in profile questions ── */
	function personPersonalSection() {
		return {
			id: 'personal', title: 'Personal details', icon: 'user',
			description: 'Background details that help you serve this person well.',
			fields: [
				{ id: 'dateOfBirth', label: 'Date of birth', type: 'date', width: 'half' },
				{ id: 'occupation', label: 'Occupation', type: 'text', width: 'half' },
				{ id: 'employer', label: 'Employer', type: 'text', width: 'half' },
				{ id: 'language', label: 'Preferred language', type: 'text', width: 'half', placeholder: 'English' }
			]
		};
	}

	function personPreferencesSection() {
		return {
			id: 'preferences', title: 'Contact preferences', icon: 'mail',
			description: 'How and when this customer wants to be contacted.',
			fields: [
				{ id: 'preferredChannel', label: 'Preferred channel', type: 'select', options: CHANNEL_OPTIONS, width: 'half' },
				{ id: 'contactWindow', label: 'Best time to reach', type: 'text', width: 'half', placeholder: 'Weekdays after 5 pm' },
				{ id: 'emailOptIn', label: 'Accepts email updates', type: 'checkbox', width: 'third' },
				{ id: 'smsOptIn', label: 'Accepts SMS updates', type: 'checkbox', width: 'third' },
				{ id: 'doNotContact', label: 'Do not contact', type: 'checkbox', width: 'third' }
			]
		};
	}

	function businessRoleSection() {
		return {
			id: 'role', title: 'Role and relationship', icon: 'briefcase',
			description: 'Where this person sits and how they influence the purchase.',
			fields: [
				{ id: 'linkedCompany', label: 'Company', type: 'text', width: 'half', placeholder: 'Legal or trade name' },
				{ id: 'department', label: 'Department', type: 'text', width: 'half' },
				{ id: 'roleInPurchase', label: 'Role in buying decision', type: 'select', options: ['Decision maker', 'Influencer', 'Budget holder', 'User', 'Gatekeeper', 'Other'], width: 'half' },
				{ id: 'budgetAuthority', label: 'Budget authority', type: 'select', options: ['Approves budget', 'Influences budget', 'No budget authority', 'Unknown'], width: 'half' },
				{ id: 'preferredChannel', label: 'Preferred channel', type: 'select', options: CHANNEL_OPTIONS, width: 'half' },
				{ id: 'contactWindow', label: 'Best time to reach', type: 'text', width: 'half' }
			]
		};
	}

	function companyDetailsSection() {
		return {
			id: 'company-details', title: 'Company details', icon: 'building',
			description: 'What the company does and how big it is.',
			fields: [
				{ id: 'industry', label: 'Industry', type: 'select', options: INDUSTRY_OPTIONS, width: 'half' },
				{ id: 'companySize', label: 'Employees', type: 'select', options: COMPANY_SIZE_OPTIONS, width: 'half' },
				{ id: 'foundedYear', label: 'Founded year', type: 'number', width: 'third', placeholder: '2010' },
				{ id: 'website', label: 'Website', type: 'url', width: 'two-thirds', placeholder: 'https://example.com' },
				{ id: 'parentCompany', label: 'Parent company', type: 'text', width: 'half' },
				{ id: 'primaryMarket', label: 'Primary market', type: 'text', width: 'half', placeholder: 'Where they sell' },
				{ id: 'companyDescription', label: 'What the company does', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function companyCommercialSection() {
		return {
			id: 'commercial', title: 'Account and billing', icon: 'card',
			description: 'Commercial terms used on quotes and invoices.',
			fields: [
				{ id: 'accountNumber', label: 'Account number', type: 'text', width: 'half' },
				{ id: 'paymentTerms', label: 'Payment terms', type: 'select', options: PAYMENT_TERM_OPTIONS, width: 'half' },
				{ id: 'currency', label: 'Currency', type: 'select', options: CURRENCY_OPTIONS, width: 'third' },
				{ id: 'creditLimit', label: 'Credit limit', type: 'number', width: 'third' },
				{ id: 'purchaseOrderRequired', label: 'Purchase order required', type: 'checkbox', width: 'third' },
				{ id: 'taxExempt', label: 'Tax exempt', type: 'checkbox', width: 'third' }
			]
		};
	}

	function companyBuyingSection() {
		return {
			id: 'buying-process', title: 'Buying process', icon: 'layers',
			description: 'How this account makes a purchase decision.',
			fields: [
				{ id: 'decisionProcess', label: 'Decision process', type: 'textarea', width: 'full', rows: 3, placeholder: 'Who signs, who evaluates, approvals...' },
				{ id: 'procurementType', label: 'Procurement style', type: 'select', options: ['Direct purchase', 'Tender', 'Framework agreement', 'Marketplace', 'Other'], width: 'half' },
				{ id: 'decisionTimeline', label: 'Decision timeline', type: 'select', options: ['Within a month', '1-3 months', '3-6 months', '6-12 months', 'Longer than a year'], width: 'half' },
				{ id: 'competitors', label: 'Other suppliers considered', type: 'text', width: 'full' }
			]
		};
	}

	function companyContractSection() {
		return {
			id: 'contract', title: 'Contract', icon: 'calendar',
			description: 'Contract dates and renewal timing.',
			fields: [
				{ id: 'contractStart', label: 'Contract start', type: 'date', width: 'third' },
				{ id: 'contractEnd', label: 'Contract end', type: 'date', width: 'third' },
				{ id: 'renewalDate', label: 'Renewal date', type: 'date', width: 'third' },
				{ id: 'noticePeriod', label: 'Notice period', type: 'text', width: 'half', placeholder: '60 days' }
			]
		};
	}

	/* Optional section building blocks for question sets. The built-in packs
	   below are based on what the user wants to collect, not on the customer's
	   type or industry. Tenant-specific packs belong in `profileDefinitions`
	   or the record-level custom question sets JSON. */

	function implementationOnboardingSection() {
		return {
			id: 'implementation', title: 'Implementation & onboarding', icon: 'layers',
			description: 'Project plan, data migration, integrations and go-live.',
			fields: [
				{ id: 'implementationOwner', label: 'Implementation owner', type: 'text', width: 'half', peopleList: true },
				{ id: 'implementationStatus', label: 'Implementation status', type: 'select', options: ['Not started', 'Discovery', 'Configuration', 'Testing', 'Live', 'Paused'], width: 'half' },
				{ id: 'implementationStart', label: 'Project start', type: 'date', width: 'half' },
				{ id: 'goLiveDate', label: 'Target go-live', type: 'date', width: 'half' },
				{ id: 'implementationScope', label: 'Implementation scope', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'dataMigration', label: 'Data migration', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'integrationRequirements', label: 'Integration requirements', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'trainingRequired', label: 'Training required', type: 'checkbox', width: 'third' },
				{ id: 'trainingAudience', label: 'Training audience', type: 'text', width: 'third' },
				{ id: 'successCriteria', label: 'Success criteria', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'implementationNotes', label: 'Implementation notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function supportSlaSection() {
		return {
			id: 'support-sla', title: 'Support & SLA', icon: 'shield',
			description: 'Support coverage, response targets, escalation and service levels.',
			fields: [
				{ id: 'supportTier', label: 'Support tier', type: 'select', options: SUPPORT_TIER_OPTIONS, width: 'half' },
				{ id: 'supportHours', label: 'Support hours', type: 'text', width: 'half', placeholder: '24/7, business hours...' },
				{ id: 'responseTarget', label: 'Response target', type: 'text', width: 'half', placeholder: 'P1: 1 hour, P2: 4 hours...' },
				{ id: 'uptimeSla', label: 'Uptime SLA', type: 'text', width: 'half', placeholder: '99.9%' },
				{ id: 'escalationPath', label: 'Escalation path', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'maintenanceWindow', label: 'Maintenance window', type: 'text', width: 'half' },
				{ id: 'supportPortal', label: 'Support portal / phone', type: 'text', width: 'half' },
				{ id: 'onCallSupport', label: 'On-call support', type: 'checkbox', width: 'half' },
				{ id: 'supportNotes', label: 'Support notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function vendorComplianceSection() {
		return {
			id: 'vendor-compliance', title: 'Compliance & vendor review', icon: 'shield',
			description: 'Security review, vendor forms, certifications and data handling.',
			fields: [
				{ id: 'vendorFormStatus', label: 'Vendor form status', type: 'select', options: VENDOR_FORM_OPTIONS, width: 'half' },
				{ id: 'securityReviewStatus', label: 'Security review', type: 'select', options: SECURITY_REVIEW_OPTIONS, width: 'half' },
				{ id: 'insuranceCertificate', label: 'Insurance certificate', type: 'text', width: 'half' },
				{ id: 'dataProcessingAgreement', label: 'Data processing agreement', type: 'checkbox', width: 'half' },
				{ id: 'vendorComplianceCertifications', label: 'Certifications', type: 'multiselect', options: COMPLIANCE_OPTIONS, width: 'full' },
				{ id: 'dataHandling', label: 'Data handling notes', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'complianceContact', label: 'Compliance contact', type: 'text', width: 'half', peopleList: true },
				{ id: 'vendorNotes', label: 'Vendor review notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function relationshipMapSection() {
		return {
			id: 'relationship-map', title: 'Relationship map', icon: 'users',
			description: 'Executive sponsor, influence, stakeholders and review cadence.',
			fields: [
				{ id: 'executiveSponsor', label: 'Executive sponsor', type: 'text', width: 'half', peopleList: true },
				{ id: 'relationshipHealth', label: 'Relationship health', type: 'select', options: RELATIONSHIP_HEALTH_OPTIONS, width: 'half' },
				{ id: 'decisionInfluence', label: 'Decision influence', type: 'select', options: DECISION_INFLUENCE_OPTIONS, width: 'half' },
				{ id: 'communicationCadence', label: 'Communication cadence', type: 'select', options: COMMUNICATION_CADENCE_OPTIONS, width: 'half' },
				{ id: 'keyStakeholders', label: 'Key stakeholders', type: 'tags', width: 'full' },
				{ id: 'lastRelationshipReview', label: 'Last relationship review', type: 'date', width: 'half' },
				{ id: 'relationshipNotes', label: 'Relationship notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function technicalInfrastructureSection() {
		return {
			id: 'technical-infrastructure', title: 'Technical infrastructure', icon: 'server',
			description: 'How the company hosts, connects, backs up and secures its systems.',
			fields: [
				{ id: 'cloudProvider', label: 'Primary cloud provider', type: 'select', options: CLOUD_PROVIDER_OPTIONS, width: 'half' },
				{ id: 'hostingModel', label: 'Hosting model', type: 'select', options: HOSTING_MODEL_OPTIONS, width: 'half' },
				{ id: 'environments', label: 'Environments', type: 'multiselect', options: ENVIRONMENT_OPTIONS, width: 'full' },
				{ id: 'primaryDatabase', label: 'Primary database', type: 'text', width: 'half', placeholder: 'PostgreSQL, SQL Server...' },
				{ id: 'dataResidency', label: 'Data residency', type: 'text', width: 'half', placeholder: 'Canada, EU...' },
				{ id: 'serverCount', label: 'Servers / instances', type: 'number', width: 'third' },
				{ id: 'uptimeTarget', label: 'Uptime target', type: 'text', width: 'third', placeholder: '99.9%' },
				{ id: 'backupFrequency', label: 'Backup frequency', type: 'select', options: BACKUP_FREQUENCY_OPTIONS, width: 'third' },
				{ id: 'backupStrategy', label: 'Backup and disaster recovery', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'ssoProvider', label: 'Identity provider (SSO)', type: 'select', options: SSO_OPTIONS, width: 'half' },
				{ id: 'mfaRequired', label: 'MFA enforced for staff', type: 'checkbox', width: 'half' },
				{ id: 'compliance', label: 'Compliance and certifications', type: 'multiselect', options: COMPLIANCE_OPTIONS, width: 'full' },
				{ id: 'securityContact', label: 'Security contact', type: 'text', width: 'half', placeholder: 'Name or team' },
				{ id: 'securityReviewDate', label: 'Last security review', type: 'date', width: 'half' },
				{ id: 'infrastructureNotes', label: 'Infrastructure notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function softwareStackSection() {
		return {
			id: 'software-tools', title: 'Software & tools', icon: 'code',
			description: 'Applications, platforms and development tools the company uses.',
			fields: [
				{ id: 'usedSoftware', label: 'Software used', type: 'tags', width: 'full', hint: 'Main business and productivity applications, one tag each.' },
				{ id: 'languagesFrameworks', label: 'Languages and frameworks', type: 'tags', width: 'full' },
				{ id: 'cloudServices', label: 'Cloud services', type: 'tags', width: 'full' },
				{ id: 'databases', label: 'Databases and data tools', type: 'tags', width: 'full' },
				{ id: 'devopsTools', label: 'DevOps and deployment tools', type: 'tags', width: 'full' },
				{ id: 'businessApps', label: 'Business systems', type: 'tags', width: 'full', hint: 'CRM, ERP, accounting, support desk...' },
				{ id: 'integrationNotes', label: 'Integration notes', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'licenseManagement', label: 'License management', type: 'select', options: LICENSE_MANAGEMENT_OPTIONS, width: 'half' },
				{ id: 'technicalOwner', label: 'Technical owner', type: 'text', width: 'half', placeholder: 'Who owns the stack', peopleList: true }
			]
		};
	}

	function saasSubscriptionSection() {
		return {
			id: 'saas-subscription', title: 'Subscription & adoption', icon: 'layers',
			description: 'Plan, seats, renewal timing and product adoption.',
			fields: [
				{ id: 'planTier', label: 'Plan / tier', type: 'text', width: 'half', placeholder: 'Business, Enterprise...' },
				{ id: 'seats', label: 'Licensed seats', type: 'number', width: 'half' },
				{ id: 'mrr', label: 'Monthly recurring revenue', type: 'number', width: 'half' },
				{ id: 'subscriptionStart', label: 'Subscription start', type: 'date', width: 'half' },
				{ id: 'saasRenewalDate', label: 'Renewal date', type: 'date', width: 'half' },
				{ id: 'billingCycle', label: 'Billing cycle', type: 'select', options: BILLING_CYCLE_OPTIONS, width: 'half' },
				{ id: 'onboardingStatus', label: 'Onboarding status', type: 'select', options: ONBOARDING_STATUS_OPTIONS, width: 'half' },
				{ id: 'churnRisk', label: 'Churn risk', type: 'select', options: CHURN_RISK_OPTIONS, width: 'half' },
				{ id: 'successManager', label: 'Success manager', type: 'text', width: 'half', peopleList: true },
				{ id: 'integrations', label: 'Integrations in use', type: 'tags', width: 'full' },
				{ id: 'usageNotes', label: 'Usage and adoption notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function professionalServicesSection() {
		return {
			id: 'engagement', title: 'Engagement & billing', icon: 'briefcase',
			description: 'How the work is scoped, delivered and billed.',
			fields: [
				{ id: 'engagementModel', label: 'Engagement model', type: 'select', options: ENGAGEMENT_MODEL_OPTIONS, width: 'half' },
				{ id: 'billingModel', label: 'Billing model', type: 'select', options: BILLING_MODEL_OPTIONS, width: 'half' },
				{ id: 'rateCard', label: 'Rate card / day rate', type: 'text', width: 'half' },
				{ id: 'estimatedHours', label: 'Estimated hours', type: 'number', width: 'half' },
				{ id: 'sowReference', label: 'SOW / contract reference', type: 'text', width: 'half' },
				{ id: 'projectStart', label: 'Project start', type: 'date', width: 'half' },
				{ id: 'utilizationTarget', label: 'Utilization target', type: 'text', width: 'third', placeholder: '70%' },
				{ id: 'subcontractors', label: 'Subcontractors used', type: 'checkbox', width: 'third' },
				{ id: 'travelRequired', label: 'Travel required', type: 'checkbox', width: 'third' },
				{ id: 'deliveryCadence', label: 'Delivery cadence', type: 'select', options: DELIVERY_CADENCE_OPTIONS, width: 'half' },
				{ id: 'scopeNotes', label: 'Scope and deliverables', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function retailSection() {
		return {
			id: 'retail', title: 'Retail & e-commerce', icon: 'cart',
			description: 'Sales channels, merchandise, fulfilment and returns.',
			fields: [
				{ id: 'salesChannels', label: 'Sales channels', type: 'multiselect', options: RETAIL_CHANNEL_OPTIONS, width: 'full' },
				{ id: 'ecommercePlatform', label: 'E-commerce platform', type: 'text', width: 'half', placeholder: 'Shopify, WooCommerce...' },
				{ id: 'averageOrderValue', label: 'Average order value', type: 'number', width: 'half' },
				{ id: 'productCategories', label: 'Product categories', type: 'tags', width: 'full' },
				{ id: 'fulfillmentModel', label: 'Fulfilment model', type: 'select', options: FULFILLMENT_OPTIONS, width: 'half' },
				{ id: 'loyaltyProgram', label: 'Loyalty programme', type: 'checkbox', width: 'half' },
				{ id: 'seasonality', label: 'Seasonality', type: 'text', width: 'half', placeholder: 'Peak months, holidays...' },
				{ id: 'marketplaceAccounts', label: 'Marketplace accounts', type: 'tags', width: 'full' },
				{ id: 'returnsProcess', label: 'Returns process', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'retailNotes', label: 'Retail notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function manufacturingSection() {
		return {
			id: 'manufacturing', title: 'Manufacturing & supply', icon: 'factory',
			description: 'Capacity, lead times, certifications and quality controls.',
			fields: [
				{ id: 'manufacturingCategories', label: 'Product categories', type: 'tags', width: 'full' },
				{ id: 'productionCapacity', label: 'Production capacity', type: 'text', width: 'half', placeholder: 'Units per month' },
				{ id: 'leadTimeDays', label: 'Standard lead time (days)', type: 'number', width: 'half' },
				{ id: 'moq', label: 'Minimum order quantity', type: 'number', width: 'half' },
				{ id: 'incoterms', label: 'Incoterms', type: 'select', options: INCOTERM_OPTIONS, width: 'half' },
				{ id: 'manufacturingCertifications', label: 'Certifications', type: 'multiselect', options: MANUFACTURING_CERTIFICATION_OPTIONS, width: 'full' },
				{ id: 'qualityProcess', label: 'Quality process', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'supplyChainNotes', label: 'Supply chain notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function constructionSection() {
		return {
			id: 'projects', title: 'Projects & compliance', icon: 'hardHat',
			description: 'Project types, licensing, safety and site requirements.',
			fields: [
				{ id: 'projectTypes', label: 'Project types', type: 'multiselect', options: CONSTRUCTION_PROJECT_OPTIONS, width: 'full' },
				{ id: 'serviceArea', label: 'Service area', type: 'text', width: 'half' },
				{ id: 'licenseNumber', label: 'License number', type: 'text', width: 'half' },
				{ id: 'safetyCertifications', label: 'Safety certifications', type: 'tags', width: 'full' },
				{ id: 'subcontractorsUsed', label: 'Subcontractors used', type: 'checkbox', width: 'third' },
				{ id: 'bonded', label: 'Bonded', type: 'checkbox', width: 'third' },
				{ id: 'typicalProjectValue', label: 'Typical project value', type: 'number', width: 'third' },
				{ id: 'permitRequirements', label: 'Permit requirements', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'projectPipeline', label: 'Project pipeline', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'siteAccessNotes', label: 'Site access notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function healthcareSection() {
		return {
			id: 'practice', title: 'Practice & compliance', icon: 'heart',
			description: 'Business practices, systems, insurance and privacy requirements.',
			fields: [
				{ id: 'practiceType', label: 'Practice type', type: 'select', options: HEALTHCARE_PRACTICE_OPTIONS, width: 'half' },
				{ id: 'patientVolume', label: 'Patients per month', type: 'number', width: 'half' },
				{ id: 'ehrSystem', label: 'EHR / practice system', type: 'text', width: 'half' },
				{ id: 'appointmentSystem', label: 'Appointment system', type: 'text', width: 'half' },
				{ id: 'healthcareCompliance', label: 'Compliance requirements', type: 'multiselect', options: COMPLIANCE_OPTIONS, width: 'full' },
				{ id: 'insuranceProviders', label: 'Insurance providers', type: 'tags', width: 'full' },
				{ id: 'referralSources', label: 'Referral sources', type: 'tags', width: 'full' },
				{ id: 'privacyContact', label: 'Privacy / compliance contact', type: 'text', width: 'half' },
				{ id: 'accessibilityNeeds', label: 'Accessibility needs', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function logisticsSection() {
		return {
			id: 'logistics', title: 'Logistics & coverage', icon: 'truck',
			description: 'Transport modes, coverage, warehousing and delivery constraints.',
			fields: [
				{ id: 'transportModes', label: 'Transport modes', type: 'multiselect', options: TRANSPORT_MODE_OPTIONS, width: 'full' },
				{ id: 'fleetSize', label: 'Fleet size', type: 'number', width: 'half' },
				{ id: 'coverageArea', label: 'Coverage area', type: 'text', width: 'half' },
				{ id: 'warehouseType', label: 'Warehouse type', type: 'select', options: WAREHOUSE_OPTIONS, width: 'half' },
				{ id: 'trackingSystem', label: 'Tracking system', type: 'text', width: 'half' },
				{ id: 'deliveryWindows', label: 'Delivery windows', type: 'text', width: 'half' },
				{ id: 'customsBroker', label: 'Customs broker', type: 'text', width: 'half' },
				{ id: 'coldChain', label: 'Cold chain', type: 'checkbox', width: 'third' },
				{ id: 'hazardousMaterials', label: 'Hazardous materials', type: 'checkbox', width: 'third' },
				{ id: 'logisticsNotes', label: 'Logistics notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function personTechnicalSection() {
		return {
			id: 'technical-responsibilities', title: 'Technical responsibilities', icon: 'server',
			description: 'What this technical contact owns and how to escalate.',
			fields: [
				{ id: 'technicalRole', label: 'Technical role', type: 'select', options: TECHNICAL_ROLE_OPTIONS, width: 'half' },
				{ id: 'technicalTeamSize', label: 'Team size', type: 'number', width: 'half' },
				{ id: 'responsibilityAreas', label: 'Areas of responsibility', type: 'multiselect', options: RESPONSIBILITY_AREA_OPTIONS, width: 'full' },
				{ id: 'onCall', label: 'On-call responsibility', type: 'checkbox', width: 'half' },
				{ id: 'preferredTechChannel', label: 'Preferred technical channel', type: 'select', options: TECH_CHANNEL_OPTIONS, width: 'half' },
				{ id: 'escalationNotes', label: 'Escalation notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function personProcurementSection() {
		return {
			id: 'procurement', title: 'Procurement details', icon: 'briefcase',
			description: 'Categories, approval limits and evaluation criteria.',
			fields: [
				{ id: 'procurementRole', label: 'Procurement role', type: 'select', options: PROCUREMENT_ROLE_OPTIONS, width: 'half' },
				{ id: 'approvalLimit', label: 'Approval limit', type: 'number', width: 'half' },
				{ id: 'categoriesManaged', label: 'Categories managed', type: 'tags', width: 'full' },
				{ id: 'budgetCycle', label: 'Budget cycle', type: 'select', options: BUDGET_CYCLE_OPTIONS, width: 'half' },
				{ id: 'evaluationCriteria', label: 'Evaluation criteria', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'procurementNotes', label: 'Procurement notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	function personExecutiveSection() {
		return {
			id: 'executive-relationship', title: 'Executive relationship', icon: 'star',
			description: 'Decision scope, priorities and relationship health.',
			fields: [
				{ id: 'executiveRole', label: 'Executive role', type: 'select', options: EXECUTIVE_ROLE_OPTIONS, width: 'half' },
				{ id: 'relationshipHealth', label: 'Relationship health', type: 'select', options: RELATIONSHIP_HEALTH_OPTIONS, width: 'half' },
				{ id: 'lastExecutiveReview', label: 'Last executive review', type: 'date', width: 'half' },
				{ id: 'strategicPriorities', label: 'Strategic priorities', type: 'tags', width: 'full' },
				{ id: 'decisionScope', label: 'Decision scope', type: 'textarea', width: 'full', rows: 3 },
				{ id: 'executiveNotes', label: 'Executive notes', type: 'textarea', width: 'full', rows: 3 }
			]
		};
	}

	var RAW_BUILT_IN_PROFILES = [
		{
			key: 'customer-basics', name: 'Customer basics',
			description: 'Identity, contacts and shared records only. Choose this when no extra question sections are needed.',
			sections: []
		},
		{
			key: 'person-basic', name: 'Personal customer details',
			description: 'Personal details and contact preferences for an individual customer.',
			sections: [personPersonalSection(), personPreferencesSection()]
		},
		{
			key: 'person-business', name: 'Business contact details',
			description: 'Role, buying influence and personal context for a business contact.',
			sections: [businessRoleSection(), personPersonalSection()]
		},
		{
			key: 'company-basic', name: 'Account & billing basics',
			description: 'Company context, commercial terms and billing basics.',
			sections: [companyDetailsSection(), companyCommercialSection()]
		},
		{
			key: 'company-account', name: 'B2B sales account',
			description: 'Company context, commercial terms, buying process and contract.',
			sections: [companyDetailsSection(), companyCommercialSection(), companyBuyingSection(), companyContractSection()]
		},
		{
			key: 'software-discovery', name: 'Software sales discovery',
			description: 'Technical infrastructure, software stack and buying process for any industry.',
			sections: [companyDetailsSection(), technicalInfrastructureSection(), softwareStackSection(), companyBuyingSection()]
		},
		{
			key: 'software-implementation', name: 'Software implementation',
			description: 'Onboarding plan, integrations, data migration and go-live for a software rollout.',
			sections: [technicalInfrastructureSection(), softwareStackSection(), implementationOnboardingSection(), companyContractSection()]
		},
		{
			key: 'saas-subscription', name: 'SaaS subscription',
			description: 'Plan, seats, adoption, hosting and renewal details for a subscription account.',
			sections: [saasSubscriptionSection(), technicalInfrastructureSection(), companyCommercialSection(), companyContractSection()]
		},
		{
			key: 'support-sla', name: 'Support & SLA',
			description: 'Support hours, response targets, escalation and service levels.',
			sections: [supportSlaSection(), technicalInfrastructureSection(), companyContractSection()]
		},
		{
			key: 'procurement-onboarding', name: 'Procurement & vendor onboarding',
			description: 'Commercial terms, buying process, security/compliance review and vendor forms.',
			sections: [companyCommercialSection(), companyBuyingSection(), vendorComplianceSection(), companyContractSection()]
		},
		{
			key: 'renewal-expansion', name: 'Renewal & expansion',
			description: 'Subscription usage, commercial terms and renewal timing.',
			sections: [saasSubscriptionSection(), companyCommercialSection(), companyContractSection()]
		},
		{
			key: 'stakeholders-relationship', name: 'Stakeholders & relationship',
			description: 'Buying roles, executive sponsor, influence and relationship health.',
			sections: [businessRoleSection(), relationshipMapSection()]
		}
	];

	var PRODUCT_EXAMPLE_PROFILE = [
		{
			key: 'loyalty-member',
			name: 'Loyalty programme member',
			description: 'Questions the loyalty programme needs',
			sections: [
				{
					id: 'loyalty',
					title: 'Loyalty programme',
					icon: 'star',
					description: 'Membership and tier details',
					fields: [
						{ id: 'membershipNumber', label: 'Membership number', type: 'text', required: true, width: 'half' },
						{ id: 'tier', label: 'Tier', type: 'select', options: ['Bronze', 'Silver', 'Gold'], width: 'half' },
						{ id: 'interests', label: 'Product interests', type: 'multiselect', options: ['Coffee', 'Tea', 'Equipment'], width: 'full' },
						{ id: 'joinedAt', label: 'Member since', type: 'date', width: 'half' },
						{ id: 'wantsNewsletter', label: 'Wants the newsletter', type: 'checkbox', width: 'half' }
					]
				}
			]
		}
	];
	var PROFILE_EXAMPLE_JSON = JSON.stringify(PRODUCT_EXAMPLE_PROFILE, null, 2);

	/* ── Repeating list definitions ── */
	var LIST_DEFINITIONS = {
		emails: {
			title: 'Email addresses', icon: 'mail', addLabel: 'Add email', rowLabel: 'Email',
			empty: 'No email addresses yet. Add the first one.',
			fields: [
				{ id: 'label', label: 'Label', type: 'text', placeholder: 'Work' },
				{ id: 'value', label: 'Email address', type: 'email', placeholder: 'name@example.com' }
			],
			blank: function () { return { label: '', value: '' }; },
			hasContent: function (row) { return trimString(row.value) !== ''; },
			titleFor: function (row, index) { return trimString(row.label) || ('Email ' + (index + 1)); },
			subtitleFor: function (row) { return trimString(row.value); },
			metaFor: function (row) { return [row.label, row.value]; },
			summaryFor: function (row) { return [row.label, row.value].filter(Boolean).join(': '); }
		},
		phones: {
			title: 'Phone numbers', icon: 'phone', addLabel: 'Add phone', rowLabel: 'Phone',
			empty: 'No phone numbers yet. Add the first one.',
			fields: [
				{ id: 'label', label: 'Label', type: 'text', placeholder: 'Mobile' },
				{ id: 'value', label: 'Number', type: 'phone', placeholder: '+1 555 010 2030' }
			],
			blank: function () { return { label: '', value: '' }; },
			hasContent: function (row) { return trimString(row.value) !== ''; },
			titleFor: function (row, index) { return trimString(row.label) || ('Phone ' + (index + 1)); },
			subtitleFor: function (row) { return trimString(row.value); },
			metaFor: function (row) { return [row.label, row.value]; },
			summaryFor: function (row) { return [row.label, row.value].filter(Boolean).join(': '); }
		},
		addresses: {
			title: 'Addresses', icon: 'pin', addLabel: 'Add address', rowLabel: 'Address',
			empty: 'No addresses yet. Add a billing or shipping address.',
			fields: [
				{ id: 'label', label: 'Label', type: 'text', placeholder: 'Billing' },
				{ id: 'line1', label: 'Street', type: 'text', placeholder: 'Street and number' },
				{ id: 'line2', label: 'Line 2', type: 'text' },
				{ id: 'city', label: 'City', type: 'text' },
				{ id: 'region', label: 'State / Province', type: 'text' },
				{ id: 'postal', label: 'Postal code', type: 'text' },
				{ id: 'country', label: 'Country', type: 'text' }
			],
			blank: function () { return { label: '', line1: '', line2: '', city: '', region: '', postal: '', country: '' }; },
			hasContent: function (row) {
				return ['line1', 'line2', 'city', 'region', 'postal', 'country'].some(function (key) { return trimString(row[key]) !== ''; });
			},
			titleFor: function (row, index) { return trimString(row.label) || ('Address ' + (index + 1)); },
			subtitleFor: function (row) { return [row.city, row.country].filter(Boolean).join(', '); },
			metaFor: function (row) { return [row.line1, row.line2, row.city, row.region, row.postal, row.country]; },
			summaryFor: function (row) {
				return [row.label, row.line1, row.line2, row.city, row.region, row.postal, row.country].filter(Boolean).join(', ');
			}
		},
		contacts: {
			title: 'People', icon: 'users', addLabel: 'Add person', rowLabel: 'Person',
			empty: 'No people linked yet. Add the person you deal with.',
			formIntro: 'The person you deal with, their role and how to reach them.',
			fields: [
				{ id: 'name', label: 'Full name', type: 'text', width: 'half', placeholder: 'e.g. Dana Whitfield' },
				{ id: 'jobTitle', label: 'Job title', type: 'text', width: 'half', placeholder: 'e.g. Design Lead' },
				{ id: 'email', label: 'Email', type: 'email', width: 'half', placeholder: 'name@example.com' },
				{ id: 'phone', label: 'Phone', type: 'phone', width: 'half', placeholder: '+1 555 010 2030' }
			],
			blank: function () { return { name: '', jobTitle: '', email: '', phone: '' }; },
			hasContent: function (row) { return trimString(row.name) !== '' || trimString(row.email) !== '' || trimString(row.phone) !== ''; },
			titleFor: function (row, index) { return trimString(row.name) || ('Person ' + (index + 1)); },
			subtitleFor: function (row) { return trimString(row.jobTitle); },
			metaFor: function (row) { return [row.email, row.phone]; },
			summaryFor: function (row) { return [row.name, row.jobTitle, row.email, row.phone].filter(Boolean).join(' - '); }
		},
		interactions: {
			title: 'Interactions', icon: 'activity', addLabel: 'Log interaction', rowLabel: 'Interaction',
			empty: 'No interactions logged yet. Add the last conversation.',
			formIntro: 'A longer summary gives the next person the full context.',
			fields: [
				{ id: 'date', label: 'Date', type: 'date', width: 'half' },
				{ id: 'channel', label: 'Channel', type: 'select', options: INTERACTION_CHANNEL_OPTIONS, width: 'half' },
				{ id: 'summary', label: 'Summary', type: 'textarea', width: 'full', rows: 4, placeholder: 'What was discussed, decisions, next steps...' }
			],
			blank: function () { return { date: todayISO(), channel: 'Call', summary: '' }; },
			hasContent: function (row) { return trimString(row.summary) !== ''; },
			titleFor: function (row, index) { return shortText(row.summary, 80) || ('Interaction ' + (index + 1)); },
			subtitleFor: function (row) { return [formatShortDate(row.date), row.channel].filter(Boolean).join(' - '); },
			metaFor: function () { return []; },
			summaryFor: function (row) {
				var heading = [formatShortDate(row.date), row.channel].filter(Boolean).join(' - ');
				return heading + (trimString(row.summary) ? ': ' + trimString(row.summary) : '');
			}
		}
	};

	/* ── State ── */
	var customerRecord = {
		version: 2,
		customerType: 'person',
		profileKey: '',
		profileKeys: [],
		focus: [],
		presetFocus: [],
		showAllSections: false,
		values: {},
		lists: { emails: [], phones: [], addresses: [], contacts: [], interactions: [] },
		customProfiles: [],
		ui: { theme: 'light' },
		meta: { createdAt: '', updatedAt: '', updatedByName: '' }
	};

	var builtInProfiles = [];
	var settingsProfiles = [];
	var currentSections = [];
	var currentSection = 'basic';
	var editingArrayItem = {};
	var focusAfterRender = null;
	var currentUser = null;
	var isReadOnly = false;
	var noIdentityMode = false;
	var hydrated = false;
	var lastStagedJson = '';
	var lastCoreSignature = '';
	var saveTimer = null;

	/* ── Profile normalisation ── */
	function normalizeOptionList(rawOptions) {
		var options = [];
		(Array.isArray(rawOptions) ? rawOptions : []).forEach(function (rawOption) {
			if (rawOption === null || rawOption === undefined) return;
			var value = '';
			var label = '';
			if (typeof rawOption === 'string' || typeof rawOption === 'number') {
				value = String(rawOption).trim();
				label = value;
			} else if (isObject(rawOption)) {
				value = trimString(rawOption.value) || trimString(rawOption.label);
				label = trimString(rawOption.label) || value;
			}
			if (!value) return;
			var exists = options.some(function (option) { return option.value === value; });
			if (!exists) options.push({ value: value, label: label });
		});
		return options;
	}

	function normalizeFieldDefinition(rawField, fieldIndex, profileLabel, seenFieldIds) {
		if (!isObject(rawField)) return { error: 'field ' + (fieldIndex + 1) + ' must be an object.' };
		var label = trimString(rawField.label) || trimString(rawField.title);
		if (!label) return { error: 'field ' + (fieldIndex + 1) + ' needs a label.' };
		var id = fieldIdFrom(rawField.id || label);
		if (!id) return { error: 'field "' + label + '" needs a valid id.' };
		if (seenFieldIds[id]) return { error: 'field id "' + id + '" is used twice in ' + profileLabel + '.' };
		seenFieldIds[id] = true;
		var type = trimString(rawField.type).toLowerCase();
		if (FIELD_TYPES.indexOf(type) === -1) type = 'text';
		var width = trimString(rawField.width).toLowerCase();
		if (width !== 'full' && width !== 'half' && width !== 'third' && width !== 'two-thirds') width = 'half';
		if (width === 'two-thirds') width = 'half';
		var field = {
			id: id,
			label: label.slice(0, 120),
			type: type,
			required: rawField.required === true || rawField.required === 'yes',
			placeholder: trimString(rawField.placeholder).slice(0, 160),
			hint: trimString(rawField.hint).slice(0, 240),
			width: width,
			options: []
		};
		if (type === 'select' || type === 'multiselect') {
			field.options = normalizeOptionList(rawField.options);
			if (!field.options.length) return { error: 'field "' + label + '" is a ' + type + ' and needs an options array.' };
		}
		if (type === 'textarea') {
			var rows = parseInt(rawField.rows, 10);
			field.rows = rows ? Math.max(2, Math.min(12, rows)) : 3;
		}
		return { field: field };
	}

	function normalizeProfileDefinition(rawProfile, isCustom) {
		if (!isObject(rawProfile)) return { error: 'must be an object.' };
		var name = trimString(rawProfile.name) || trimString(rawProfile.label);
		var key = slugify(rawProfile.key || name);
		if (!name) return { error: 'needs a name.' };
		if (!key) return { error: 'needs a key that contains letters or numbers.' };
		var rawSections = Array.isArray(rawProfile.sections) ? rawProfile.sections : [];
		if (rawSections.length > 20) return { error: 'has more than 20 sections.' };
		var sectionIds = {};
		var sections = [];
		for (var sectionIndex = 0; sectionIndex < rawSections.length; sectionIndex++) {
			var rawSection = rawSections[sectionIndex];
			if (!isObject(rawSection)) return { error: 'section ' + (sectionIndex + 1) + ' must be an object.' };
			var sectionTitle = trimString(rawSection.title) || trimString(rawSection.name);
			if (!sectionTitle) return { error: 'section ' + (sectionIndex + 1) + ' needs a title.' };
			var sectionId = slugify(rawSection.id || sectionTitle);
			if (!sectionId) return { error: 'section "' + sectionTitle + '" needs a valid id.' };
			if (sectionIds[sectionId]) return { error: 'section id "' + sectionId + '" is used twice.' };
			sectionIds[sectionId] = true;
			var rawFields = Array.isArray(rawSection.fields) ? rawSection.fields : [];
			if (!rawFields.length) return { error: 'section "' + sectionTitle + '" needs at least one field.' };
			if (rawFields.length > 60) return { error: 'section "' + sectionTitle + '" has more than 60 fields.' };
			var seenFieldIds = {};
			var fields = [];
			for (var fieldIndex = 0; fieldIndex < rawFields.length; fieldIndex++) {
				var fieldResult = normalizeFieldDefinition(rawFields[fieldIndex], fieldIndex, 'section "' + sectionTitle + '"', seenFieldIds);
				if (fieldResult.error) return { error: fieldResult.error };
				fields.push(fieldResult.field);
			}
			var iconName = trimString(rawSection.icon);
			sections.push({
				id: sectionId,
				title: sectionTitle.slice(0, 90),
				description: trimString(rawSection.description).slice(0, 240),
				icon: ICON_PATHS[iconName] ? iconName : 'layers',
				fields: fields
			});
		}
		return {
			profile: {
				key: key,
				name: name.slice(0, 90),
				description: trimString(rawProfile.description).slice(0, 240),
				builtIn: !isCustom,
				custom: !!isCustom,
				sections: sections
			}
		};
	}

	function parseProfileDefinitionsInput(input) {
		var data = input;
		if (typeof input === 'string') {
			var source = input.trim();
			if (!source) return { profiles: [] };
			try { data = JSON.parse(source); } catch (error) { return { error: 'Invalid JSON: ' + error.message }; }
		}
		if (isObject(data) && Array.isArray(data.profiles)) data = data.profiles;
		if (!Array.isArray(data)) return { error: 'Expected an array of question set definitions.' };
		var profiles = [];
		var seenKeys = {};
		for (var index = 0; index < data.length; index++) {
			var result = normalizeProfileDefinition(data[index], true);
			if (result.error) return { error: 'Question set ' + (index + 1) + ' ' + result.error };
			if (seenKeys[result.profile.key]) return { error: 'Question set key "' + result.profile.key + '" appears twice.' };
			seenKeys[result.profile.key] = true;
			profiles.push(result.profile);
		}
		return { profiles: profiles };
	}

	function buildBuiltInProfiles() {
		builtInProfiles = [];
		RAW_BUILT_IN_PROFILES.forEach(function (rawProfile) {
			var result = normalizeProfileDefinition(rawProfile, false);
			if (result.error) {
				console.warn('[CustomerProfile] built-in question set skipped: ' + result.error);
				return;
			}
			builtInProfiles.push(result.profile);
		});
	}

	function loadSettingsProfiles() {
		settingsProfiles = [];
		var rawSetting = '';
		try { rawSetting = tool.param('profileDefinitions', ''); } catch (error) { rawSetting = ''; }
		if (!rawSetting) return;
		var result = parseProfileDefinitionsInput(rawSetting);
		if (result.error) {
			console.warn('[CustomerProfile] profileDefinitions setting ignored: ' + result.error);
			return;
		}
		settingsProfiles = result.profiles;
	}

	function normalizeStoredCustomProfiles(rawProfiles) {
		var profiles = [];
		if (!Array.isArray(rawProfiles)) return profiles;
		rawProfiles.forEach(function (rawProfile) {
			var result = normalizeProfileDefinition(rawProfile, true);
			if (!result.error) {
				result.profile.custom = true;
				result.profile.builtIn = false;
				profiles.push(result.profile);
			}
		});
		return profiles;
	}

	function allProfiles() {
		var profileByKey = {};
		var profileOrder = [];
		function addProfile(profile, source) {
			if (!profile) return;
			if (!profileByKey[profile.key]) profileOrder.push(profile.key);
			var copy = {};
			for (var key in profile) {
				if (Object.prototype.hasOwnProperty.call(profile, key)) copy[key] = profile[key];
			}
			copy.source = source;
			profileByKey[profile.key] = copy;
		}
		builtInProfiles.forEach(function (profile) { addProfile(profile, 'built-in'); });
		settingsProfiles.forEach(function (profile) { addProfile(profile, 'settings'); });
		customerRecord.customProfiles.forEach(function (profile) { addProfile(profile, 'record'); });
		return profileOrder.map(function (key) { return profileByKey[key]; });
	}

	function findProfile(profileKey) {
		var profiles = allProfiles();
		for (var index = 0; index < profiles.length; index++) {
			if (profiles[index].key === profileKey) return profiles[index];
		}
		return null;
	}

	function normalizeProfileKeys(rawKeys, fallbackKey) {
		var keys = [];
		(Array.isArray(rawKeys) ? rawKeys : []).forEach(function (rawKey) {
			var key = trimString(rawKey);
			if (key && keys.indexOf(key) === -1 && findProfile(key)) keys.push(key);
		});
		if (!keys.length) {
			var fallback = trimString(fallbackKey);
			if (fallback && findProfile(fallback)) keys.push(fallback);
		}
		return keys;
	}

	function currentProfileKeys() {
		var valid = [];
		var keys = Array.isArray(customerRecord.profileKeys) ? customerRecord.profileKeys : [];
		keys.forEach(function (rawKey) {
			var key = trimString(rawKey);
			if (key && valid.indexOf(key) === -1 && findProfile(key)) valid.push(key);
		});
		if (!valid.length && customerRecord.profileKey && findProfile(customerRecord.profileKey)) valid.push(customerRecord.profileKey);
		return valid;
	}

	function currentProfiles() {
		return currentProfileKeys().map(function (key) { return findProfile(key); }).filter(Boolean);
	}

	function combinedProfile(profiles) {
		if (!profiles.length) return null;
		if (profiles.length === 1) return profiles[0];
		var seen = {};
		var sections = [];
		profiles.forEach(function (profile) {
			(profile.sections || []).forEach(function (section) {
				if (seen[section.id]) return;
				seen[section.id] = true;
				sections.push(section);
			});
		});
		return {
			key: '__combination__',
			name: 'Custom combination (' + profiles.length + ' question sets)',
			description: 'A custom combination of ' + profiles.length + ' question sets.',
			builtIn: false,
			custom: false,
			combination: true,
			profileKeys: profiles.map(function (profile) { return profile.key; }),
			sections: sections
		};
	}

	function currentProfile() { return combinedProfile(currentProfiles()); }
	function hasProfileSelection() { return currentProfileKeys().length > 0; }
	function isProfileSelected(profileKey) { return currentProfileKeys().indexOf(profileKey) > -1; }

	function profileFocusPreset(profile) {
		var preset = [];
		if (!profile) return preset;
		profile.sections.forEach(function (section) {
			var focusId = SECTION_FOCUS_MAP[section.id];
			if (focusId && preset.indexOf(focusId) === -1) preset.push(focusId);
		});
		var coreFocusIds = ['addresses', 'contacts'];
		if (showInteractions()) coreFocusIds.push('activity');
		coreFocusIds.forEach(function (focusId) {
			if (preset.indexOf(focusId) === -1) preset.push(focusId);
		});
		return preset;
	}

	function focusSet() {
		var set = {};
		(customerRecord.focus || []).forEach(function (areaId) { set[areaId] = true; });
		return set;
	}

	function availableFocusAreas() {
		var ids = [];
		var profile = currentProfile();
		if (profile) {
			profile.sections.forEach(function (section) {
				var focusId = SECTION_FOCUS_MAP[section.id];
				if (focusId && ids.indexOf(focusId) === -1) ids.push(focusId);
			});
		}
		var coreFocusIds = ['addresses', 'contacts'];
		if (showInteractions()) coreFocusIds.push('activity');
		coreFocusIds.forEach(function (focusId) {
			if (ids.indexOf(focusId) === -1) ids.push(focusId);
		});
		return FOCUS_AREAS.filter(function (area) { return ids.indexOf(area.id) > -1; });
	}

	/* ── Value helpers ── */
	function createEmptyLists() {
		var lists = {};
		Object.keys(LIST_DEFINITIONS).forEach(function (listKey) { lists[listKey] = []; });
		return lists;
	}

	function sanitizeValues(rawValues) {
		var values = {};
		if (!isObject(rawValues)) return values;
		Object.keys(rawValues).forEach(function (key) {
			var value = rawValues[key];
			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
				values[key] = value;
			} else if (Array.isArray(value)) {
				values[key] = value.filter(function (item) {
					return typeof item === 'string' || typeof item === 'number';
				}).map(String);
			}
		});
		return values;
	}

	function sanitizeLists(rawLists) {
		var lists = createEmptyLists();
		if (!isObject(rawLists)) return lists;
		Object.keys(lists).forEach(function (listKey) {
			var definition = LIST_DEFINITIONS[listKey];
			var rows = rawLists[listKey];
			if (!Array.isArray(rows)) return;
			lists[listKey] = rows.filter(isObject).map(function (rawRow) {
				var row = { id: trimString(rawRow.id) || uid('row') };
				definition.fields.forEach(function (field) {
					var rawValue = rawRow[field.id];
					row[field.id] = (typeof rawValue === 'string' || typeof rawValue === 'number') ? String(rawValue) : '';
				});
				return row;
			});
		});
		return lists;
	}

	function hydrateValue(value) {
		hydrated = true;
		customerRecord.customerType = value && value.customerType === 'company' ? 'company' : 'person';
		customerRecord.values = sanitizeValues(value && value.values);
		customerRecord.lists = sanitizeLists(value && value.lists);
		customerRecord.customProfiles = normalizeStoredCustomProfiles(value && value.customProfiles);
		customerRecord.profileKeys = normalizeProfileKeys(value && value.profileKeys, value && value.profileKey);
		customerRecord.profileKey = customerRecord.profileKeys[0] || '';
		customerRecord.showAllSections = value && value.showAllSections === true;
		var theme = value && value.ui && value.ui.theme;
		customerRecord.ui.theme = theme === 'dark' ? 'dark' : 'light';

		var rawMeta = value && isObject(value.meta) ? value.meta : {};
		customerRecord.meta = {
			createdAt: trimString(rawMeta.createdAt) || nowISO(),
			updatedAt: trimString(rawMeta.updatedAt),
			updatedByName: trimString(rawMeta.updatedByName)
		};

		var profile = currentProfile();
		var preset = profileFocusPreset(profile);
		var savedFocus = value && Array.isArray(value.focus) ? value.focus.filter(function (areaId) { return typeof areaId === 'string'; }) : null;
		customerRecord.focus = savedFocus ? savedFocus.slice() : preset.slice();
		var savedPreset = value && Array.isArray(value.presetFocus) ? value.presetFocus.filter(function (areaId) { return typeof areaId === 'string'; }) : null;
		customerRecord.presetFocus = savedPreset ? savedPreset.slice() : preset.slice();

		var signatureSnapshot = snapshotForValue();
		lastStagedJson = JSON.stringify(signatureSnapshot);
		lastCoreSignature = signatureOfValue(signatureSnapshot);
	}

	function initializeNewRecord() {
		customerRecord.customerType = defaultCustomerTypeFromParam();
		customerRecord.profileKey = '';
		customerRecord.profileKeys = [];
		customerRecord.focus = [];
		customerRecord.presetFocus = [];
		customerRecord.showAllSections = false;
		customerRecord.values = {};
		customerRecord.lists = createEmptyLists();
		customerRecord.customProfiles = [];
		customerRecord.ui.theme = 'light';
		customerRecord.meta = { createdAt: nowISO(), updatedAt: '', updatedByName: '' };

		var defaultKeys = [];
		try { defaultKeys = readParamList('defaultProfileKey', []); } catch (error) { defaultKeys = []; }
		var validDefaultKeys = normalizeProfileKeys(defaultKeys, '');
		if (validDefaultKeys.length) {
			customerRecord.profileKeys = validDefaultKeys;
			customerRecord.profileKey = validDefaultKeys[0];
			var defaultProfile = currentProfile();
			customerRecord.focus = profileFocusPreset(defaultProfile);
			customerRecord.presetFocus = customerRecord.focus.slice();
		}

		var signatureSnapshot = snapshotForValue();
		lastStagedJson = JSON.stringify(signatureSnapshot);
		lastCoreSignature = signatureOfValue(signatureSnapshot);
	}

	function snapshotForValue() {
		return {
			version: 2,
			customerType: customerRecord.customerType,
			profileKey: customerRecord.profileKey,
			profileKeys: customerRecord.profileKeys.slice(),
			focus: customerRecord.focus.slice(),
			presetFocus: customerRecord.presetFocus.slice(),
			showAllSections: customerRecord.showAllSections,
			values: JSON.parse(JSON.stringify(customerRecord.values)),
			lists: JSON.parse(JSON.stringify(customerRecord.lists)),
			customProfiles: JSON.parse(JSON.stringify(customerRecord.customProfiles)),
			ui: { theme: customerRecord.ui.theme },
			meta: {
				createdAt: customerRecord.meta.createdAt,
				updatedAt: customerRecord.meta.updatedAt,
				updatedByName: customerRecord.meta.updatedByName
			}
		};
	}

	function signatureOfValue(value) {
		if (!isObject(value)) return '';
		return JSON.stringify({
			customerType: value.customerType,
			profileKey: value.profileKey,
			profileKeys: value.profileKeys || [],
			focus: value.focus || [],
			presetFocus: value.presetFocus || [],
			showAllSections: value.showAllSections === true,
			values: value.values || {},
			lists: value.lists || {},
			customProfiles: value.customProfiles || []
		});
	}

	function defaultCustomerTypeFromParam() {
		var configured = 'person';
		try { configured = String(tool.param('defaultCustomerType', 'person')); } catch (error) { configured = 'person'; }
		return configured.toLowerCase() === 'company' ? 'company' : 'person';
	}

	function readParamList(paramName, fallbackList) {
		var rawValue = '';
		try { rawValue = tool.param(paramName, ''); } catch (error) { rawValue = ''; }
		if (!rawValue) return fallbackList.slice();
		if (Array.isArray(rawValue)) return rawValue.map(String).filter(Boolean);
		var text = String(rawValue).trim();
		if (text.charAt(0) === '[') {
			try {
				var parsed = JSON.parse(text);
				if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
			} catch (error) { /* comma fallback */ }
		}
		return text.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
	}

	function statusOptions() {
		var configured = readParamList('statusOptions', DEFAULT_STATUS_OPTIONS);
		return configured.length ? configured : DEFAULT_STATUS_OPTIONS;
	}

	function sourceOptions() {
		var configured = readParamList('sourceOptions', DEFAULT_SOURCE_OPTIONS);
		return configured.length ? configured : DEFAULT_SOURCE_OPTIONS;
	}

	function showInteractions() {
		var setting = 'yes';
		try { setting = String(tool.param('showInteractions', 'yes')); } catch (error) { setting = 'yes'; }
		return setting.toLowerCase() !== 'no';
	}

	function customerDisplayName() {
		var value = customerRecord.values;
		if (customerRecord.customerType === 'company') {
			return trimString(value.core_legalName) || trimString(value.core_tradeName) || 'New customer';
		}
		var fullName = [trimString(value.core_firstName), trimString(value.core_lastName)].filter(Boolean).join(' ');
		return fullName || trimString(value.core_preferredName) || 'New customer';
	}

	function typeAndProfileLabel() {
		var typeLabel = customerRecord.customerType === 'company' ? 'Company' : 'Person';
		var profile = currentProfile();
		if (!profile) return typeLabel;
		if (profile.name.toLowerCase().indexOf(typeLabel.toLowerCase() + ' - ') === 0) return profile.name;
		return typeLabel + ' - ' + profile.name;
	}

	/* ── Sections ── */
	function buildSections() {
		var sections = [];
		var isCompany = customerRecord.customerType === 'company';

		sections.push({
			id: 'basic',
			group: 'Foundation',
			title: 'Basic Information',
			icon: isCompany ? 'building' : 'user',
			description: isCompany ? 'The company, how you classify it and how you work with it' : 'Who this customer is and how you work with them',
			kind: 'basic'
		});
		sections.push({
			id: 'contact',
			group: 'Foundation',
			title: 'Contact & Links',
			icon: 'mail',
			description: 'Email addresses and phone numbers used to reach this customer',
			kind: 'contact'
		});

		var profile = currentProfile();
		if (profile) {
			profile.sections.forEach(function (profileSection) {
				var focusId = SECTION_FOCUS_MAP[profileSection.id];
				sections.push({
					id: 'profile-' + profile.key + '-' + profileSection.id,
				group: 'Question sections',
					title: profileSection.title,
					icon: profileSection.icon,
					description: profileSection.description || ('Questions for ' + profile.name),
					kind: 'fields',
					fields: profileSection.fields,
					needs: focusId ? [focusId] : []
				});
			});
		}

		sections.push({
			id: 'addresses', group: 'Records', title: 'Addresses', icon: 'pin',
			description: 'Billing, shipping and site addresses', kind: 'lists',
			lists: ['addresses'], needs: ['addresses']
		});
		sections.push({
			id: 'people', group: 'Records', title: 'People', icon: 'users',
			description: 'People you deal with at this customer', kind: 'lists',
			lists: ['contacts'], needs: ['contacts']
		});
		if (showInteractions()) {
			sections.push({
				id: 'interactions', group: 'Records', title: 'Interactions', icon: 'activity',
				description: 'Calls, emails and meetings you log', kind: 'lists',
				lists: ['interactions'], needs: ['activity']
			});
		}
		sections.push({
			id: 'notes', group: 'Records', title: 'Notes', icon: 'note',
			description: 'Anything the next person needs to know', kind: 'fields',
			fields: [{ id: 'core_notes', label: 'Internal notes', type: 'textarea', width: 'full', rows: 5, placeholder: 'Context, preferences, reminders...' }]
		});
		return sections;
	}

	function isSectionVisible(section) {
		if (customerRecord.showAllSections) return true;
		if (!section.needs || !section.needs.length) return true;
		var activeFocus = focusSet();
		for (var index = 0; index < section.needs.length; index++) {
			if (activeFocus[section.needs[index]]) return true;
		}
		return false;
	}

	function visibleSections() {
		return currentSections.filter(isSectionVisible);
	}

	function hiddenSectionCount() {
		var activeFocus = focusSet();
		return currentSections.filter(function (section) {
			if (!section.needs || !section.needs.length) return false;
			for (var index = 0; index < section.needs.length; index++) {
				if (activeFocus[section.needs[index]]) return false;
			}
			return true;
		}).length;
	}

	function ensureActiveSection() {
		var list = visibleSections();
		if (!list.length) {
			currentSection = 'basic';
			return;
		}
		var exists = list.some(function (section) { return section.id === currentSection; });
		if (!exists) currentSection = list[0].id;
	}

	/* ── Progress ── */
	function listHasContent(listKey) {
		var definition = LIST_DEFINITIONS[listKey];
		var rows = customerRecord.lists[listKey] || [];
		for (var index = 0; index < rows.length; index++) {
			if (definition.hasContent(rows[index])) return true;
		}
		return false;
	}

	function isFieldFilled(field) {
		if (!field) return false;
		if (field.type === 'checkbox') return true;
		var value = customerRecord.values[field.id];
		if (field.type === 'multiselect' || field.type === 'tags') return Array.isArray(value) && value.length > 0;
		return value !== null && value !== undefined && String(value).trim() !== '';
	}

	function sectionProgress(section) {
		if (section.kind === 'basic') {
			var nameFilled = customerDisplayName() !== 'New customer';
			var statusFilled = trimString(customerRecord.values.core_status) !== '';
			var profileFilled = hasProfileSelection();
			var basicDone = (nameFilled ? 1 : 0) + (statusFilled ? 1 : 0) + (profileFilled ? 1 : 0);
			return { done: basicDone, total: 3, complete: basicDone === 3 };
		}
		if (section.kind === 'contact') {
			var emailFilled = listHasContent('emails');
			var phoneFilled = listHasContent('phones');
			var contactDone = (emailFilled ? 1 : 0) + (phoneFilled ? 1 : 0);
			return { done: contactDone, total: 2, complete: contactDone === 2 };
		}
		if (section.kind === 'lists') {
			var hasAny = (section.lists || []).some(listHasContent);
			return { done: hasAny ? 1 : 0, total: 1, complete: hasAny };
		}
		var fields = section.fields || [];
		var filled = 0;
		fields.forEach(function (field) { if (isFieldFilled(field)) filled++; });
		return { done: filled, total: fields.length, complete: fields.length > 0 && filled === fields.length };
	}

	function sectionStateHtml(section, progress) {
		var label = progress.total === 0 ? 'Optional' : (progress.complete ? 'Complete' : progress.done + ' of ' + progress.total);
		return '<div class="cp-section-state' + (progress.complete ? ' complete' : '') + '" data-section-state="' + esc(section.id) + '">' + esc(label) + '</div>';
	}

	/* ── Field controls ── */
	function optionsOfField(field, value) {
		var options = normalizeOptionList(field.options);
		var current = value === null || value === undefined ? '' : String(value);
		if (current) {
			var exists = options.some(function (option) { return option.value === current; });
			if (!exists) options.push({ value: current, label: current + ' (saved)' });
		}
		return options;
	}

	function fieldDataAttributes(field, config) {
		var attrs = '';
		if (config && config.listKey) {
			attrs += ' data-list="' + esc(config.listKey) + '" data-row-id="' + esc(config.rowId) + '" data-list-field="' + esc(field.id) + '"';
		} else {
			attrs += ' data-field="' + esc(field.id) + '"';
		}
		if (locked()) attrs += ' disabled';
		return attrs;
	}

	function controlHtml(field, value, config) {
		var configObject = config || {};
		var domId = configObject.domId || ('cp-f-' + (configObject.listKey ? configObject.listKey + '-' + configObject.rowId + '-' + field.id : field.id));
		var attrs = fieldDataAttributes(field, configObject);
		var placeholder = field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '';
		var listAttribute = field.peopleList ? ' list="cp-owner-options"' : '';

		if (field.type === 'textarea') {
			return '<textarea class="cp-input cp-textarea" id="' + esc(domId) + '"' + attrs + placeholder + ' rows="' + (field.rows || 3) + '">' + esc(value === null || value === undefined ? '' : value) + '</textarea>';
		}
		if (field.type === 'select') {
			var html = '<select class="cp-input cp-select" id="' + esc(domId) + '"' + attrs + '>';
			html += '<option value="">Not set</option>';
			optionsOfField(field, value).forEach(function (option) {
				html += '<option value="' + esc(option.value) + '"' + (String(value) === String(option.value) ? ' selected' : '') + '>' + esc(option.label) + '</option>';
			});
			return html + '</select>';
		}
		if (field.type === 'multiselect') {
			var selected = Array.isArray(value) ? value.map(String) : [];
			var chips = normalizeOptionList(field.options).map(function (option) {
				var isOn = selected.indexOf(option.value) > -1;
				return '<label class="cp-choice' + (isOn ? ' is-on' : '') + (locked() ? ' is-disabled' : '') + '">' +
					'<input type="checkbox" data-field="' + esc(field.id) + '" data-option="' + esc(option.value) + '" value="' + esc(option.value) + '"' + (isOn ? ' checked' : '') + (locked() ? ' disabled' : '') + '>' +
					'<span>' + esc(option.label) + '</span></label>';
			}).join('');
			return '<div class="cp-choice-grid" data-multiselect="' + esc(field.id) + '">' + chips + '</div>';
		}
		if (field.type === 'tags') {
			return tagsEditorHtml(field.id, value);
		}
		if (field.type === 'checkbox') {
			return '<input type="checkbox" id="' + esc(domId) + '"' + attrs + (value === true || value === 'yes' || value === 'true' ? ' checked' : '') + '>';
		}
		var inputType = field.type === 'phone' ? 'tel' : field.type;
		if (['text', 'email', 'tel', 'url', 'number', 'date'].indexOf(inputType) === -1) inputType = 'text';
		return '<input class="cp-input" type="' + inputType + '" id="' + esc(domId) + '"' + attrs + placeholder + listAttribute + ' value="' + esc(value === null || value === undefined ? '' : value) + '">';
	}

	function tagsEditorHtml(fieldId, value) {
		var tags = Array.isArray(value) ? value : [];
		var readOnly = locked();
		var html = tags.map(function (tag) {
			return '<span class="cp-tag-chip">' + esc(tag) +
				(readOnly ? '' : '<button type="button" data-tag-remove="' + esc(tag) + '" data-tag-field="' + esc(fieldId) + '" aria-label="Remove tag ' + esc(tag) + '">x</button>') +
				'</span>';
		}).join('');
		if (!readOnly) {
			html += '<input class="cp-tag-input" type="text" data-tag-input="' + esc(fieldId) + '" placeholder="' + (tags.length ? 'Add another tag' : 'Add a tag and press Enter') + '">';
		}
		return '<div class="cp-tag-editor" data-tags-for="' + esc(fieldId) + '">' + html + '</div>';
	}

	function fieldCellHtml(field, config) {
		var configObject = config || {};
		var domId = configObject.domId || ('cp-f-' + (configObject.listKey ? configObject.listKey + '-' + configObject.rowId + '-' + field.id : field.id));
		var value = configObject.listKey ? configObject.rowValue : customerRecord.values[field.id];
		var required = field.required ? '<span class="cp-required">*</span>' : '';
		var hint = field.hint ? '<span class="cp-field-help">' + esc(field.hint) + '</span>' : '';

		if (field.type === 'checkbox') {
			return '<label class="cp-checkbox-label">' + controlHtml(field, value, configObject) + ' ' + esc(field.label) +
				(field.hint ? ' <span class="cp-hint">' + esc(field.hint) + '</span>' : '') + '</label>';
		}
		var usesLabelTag = field.type !== 'multiselect' && field.type !== 'tags';
		var label = usesLabelTag
			? '<label class="cp-label" for="' + esc(domId) + '">' + esc(field.label) + required + '</label>'
			: '<span class="cp-label">' + esc(field.label) + required + '</span>';
		return label + controlHtml(field, value, configObject) + hint;
	}

	function fieldRowsHtml(fields) {
		var rows = [];
		var thirdBuffer = [];
		var halfBuffer = [];
		function flushThirds() {
			if (thirdBuffer.length) {
				rows.push({ columns: 3, fields: thirdBuffer });
				thirdBuffer = [];
			}
		}
		function flushHalves() {
			if (halfBuffer.length) {
				rows.push({ columns: 2, fields: halfBuffer });
				halfBuffer = [];
			}
		}
		(fields || []).forEach(function (field) {
			var width = field.width || 'half';
			if (width === 'full') {
				flushThirds();
				flushHalves();
				rows.push({ columns: 1, fields: [field] });
			} else if (width === 'third') {
				flushHalves();
				thirdBuffer.push(field);
				if (thirdBuffer.length === 3) flushThirds();
			} else {
				flushThirds();
				halfBuffer.push(field);
				if (halfBuffer.length === 2) flushHalves();
			}
		});
		flushThirds();
		flushHalves();

		return rows.map(function (row) {
			var rowClass = row.columns === 3 ? 'cp-field-row cp-field-row-3' : 'cp-field-row';
			var cells = row.fields.map(function (field) {
				var wrapperClass = row.columns === 1 ? 'cp-field cp-field-full' : 'cp-field';
				return '<div class="' + wrapperClass + '">' + fieldCellHtml(field) + '</div>';
			}).join('');
			return '<div class="' + rowClass + '">' + cells + '</div>';
		}).join('');
	}

	/* ── Basic Information ── */
	function coreIdentityFields() {
		var isCompany = customerRecord.customerType === 'company';
		var nameFields = isCompany
			? [
				{ id: 'core_legalName', label: 'Legal company name', type: 'text', width: 'half', required: true, placeholder: 'Registered legal name' },
				{ id: 'core_tradeName', label: 'Trade name', type: 'text', width: 'half', placeholder: 'Name used with customers' },
				{ id: 'core_registrationNumber', label: 'Registration number', type: 'text', width: 'half' },
				{ id: 'core_taxNumber', label: 'Tax / VAT number', type: 'text', width: 'half' }
			]
			: [
				{ id: 'core_firstName', label: 'First name', type: 'text', width: 'half', required: true },
				{ id: 'core_lastName', label: 'Last name', type: 'text', width: 'half' },
				{ id: 'core_preferredName', label: 'Preferred name', type: 'text', width: 'half' },
				{ id: 'core_jobTitle', label: 'Job title', type: 'text', width: 'half' }
			];
		var adminFields = [
			{ id: 'core_status', label: 'Status', type: 'select', options: statusOptions(), width: 'third' },
			{ id: 'core_priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS, width: 'third' },
			{ id: 'core_source', label: 'Source', type: 'select', options: sourceOptions(), width: 'third' },
			{ id: 'core_owner', label: 'Account owner', type: 'text', width: 'third', placeholder: 'Who looks after this customer', peopleList: true },
			{ id: 'core_since', label: 'Customer since', type: 'date', width: 'third' },
			{ id: 'core_nextFollowUp', label: 'Next follow-up', type: 'date', width: 'third' }
		];
		return { names: nameFields, admin: adminFields };
	}

	function typeSwitchHtml() {
		var isCompany = customerRecord.customerType === 'company';
		return '<div class="cp-type-switch" role="group" aria-label="Customer type">' +
			'<button type="button" class="cp-type-option" data-type="person" aria-pressed="' + (!isCompany ? 'true' : 'false') + '"' + (locked() ? ' disabled' : '') + '>' +
				iconSvg('user') + '<span>Person</span></button>' +
			'<button type="button" class="cp-type-option" data-type="company" aria-pressed="' + (isCompany ? 'true' : 'false') + '"' + (locked() ? ' disabled' : '') + '>' +
				iconSvg('building') + '<span>Company</span></button>' +
			'</div>';
	}

	function profileSourceLabel(profile) {
		return profile.source === 'settings' ? 'Tool settings' : profile.source === 'record' ? 'This record' : 'Built-in';
	}

	function profileSourceClass(profile) {
		return profile.source === 'settings' ? ' is-settings' : profile.source === 'record' ? ' is-record' : '';
	}

	function selectionHelpText() {
		var profiles = currentProfiles();
		if (!profiles.length) return 'Tick one or more question sets to add their questions.';
		if (profiles.length === 1) return profiles[0].description || 'One question set selected.';
		return profiles.length + ' question sets combined. Shared sections are only shown once.';
	}

	function dataPackOptionHtml(profile) {
		var selected = isProfileSelected(profile.key);
		var sectionCount = profile.sections ? profile.sections.length : 0;
		return '<label class="cp-pack-option' + (selected ? ' is-selected' : '') + '">' +
			'<input type="checkbox" class="cp-pack-check" data-profile-toggle="' + esc(profile.key) + '"' + (selected ? ' checked' : '') + (locked() ? ' disabled' : '') + '>' +
			'<span class="cp-pack-main">' +
				'<span class="cp-pack-name">' + esc(profile.name) +
					'<span class="cp-profile-tag' + profileSourceClass(profile) + '">' + esc(profileSourceLabel(profile)) + '</span>' +
				'</span>' +
				'<span class="cp-pack-desc">' + esc(profile.description || 'No description.') + '</span>' +
			'</span>' +
			'<span class="cp-pack-sections">' + sectionCount + (sectionCount === 1 ? ' section' : ' sections') + '</span>' +
		'</label>';
	}

	function dataPackPickerHtml() {
		var profiles = allProfiles();
		var selectedCount = currentProfileKeys().length;
		return '<div class="cp-pack-picker">' +
			'<div class="cp-pack-head">' +
				'<span class="cp-label">Question sets</span>' +
				'<span class="cp-pack-count" id="cp-pack-count">' + selectedCount + ' of ' + profiles.length + ' selected</span>' +
			'</div>' +
			'<div class="cp-pack-list" role="group" aria-label="Choose question sets">' + profiles.map(dataPackOptionHtml).join('') + '</div>' +
			'<div class="cp-pack-tools">' +
				'<button type="button" class="cp-btn cp-btn-sm" data-pack-all' + (locked() ? ' disabled' : '') + '>Select all</button>' +
				'<button type="button" class="cp-btn cp-btn-sm" data-pack-clear' + (locked() ? ' disabled' : '') + '>Clear</button>' +
				'<button type="button" class="cp-linkbtn cp-pack-library" id="cp-pack-library">Manage question sets</button>' +
			'</div>' +
		'</div>';
	}

	function focusChipsHtml() {
		var activeFocus = focusSet();
		return availableFocusAreas().map(function (area) {
			var pressed = !!activeFocus[area.id];
			return '<button type="button" class="cp-focus-chip" data-focus="' + esc(area.id) + '" aria-pressed="' + (pressed ? 'true' : 'false') + '"' + (locked() ? ' disabled' : '') + '>' +
				'<span class="cp-focus-box">' + iconSvg('check') + '</span>' +
				'<span class="cp-focus-text"><span class="cp-focus-label">' + esc(area.label) + '</span>' +
				'<span class="cp-focus-desc">' + esc(area.desc) + '</span></span></button>';
		}).join('');
	}

	function profileSetupNoteText() {
		var profiles = currentProfiles();
		var hidden = hiddenSectionCount();
		if (!profiles.length) {
			if (customerRecord.showAllSections) return 'No question sets selected. All basic and extra sections are shown. Choose question sets to add their questions. Every answer stays in the record.';
			if (!customerRecord.focus.length) return 'Only the basic sections are shown until you choose a question set. Choose one or more above to add their questions. Every answer stays in the record.';
			return 'No question sets selected. The basic sections and the extra areas you ticked are shown. Choose question sets to add their questions.';
		}
		if (customerRecord.showAllSections) return hidden + (hidden === 1 ? ' section is' : ' sections are') + ' hidden by this selection - currently showing all. Your saved answers stay in the record.';
		if (!hidden) return 'Every section in this selection is visible.';
		return hidden + (hidden === 1 ? ' section is' : ' sections are') + ' hidden by this selection. Tick an area above or use Show all sections. Your saved answers stay in the record.';
	}

	function basicSectionBodyHtml() {
		var fields = coreIdentityFields();
		var tagsField = { id: 'core_tags', label: 'Tags', type: 'tags', width: 'full', hint: 'Short labels used for filtering and campaigns.' };
		var nameRows = '<div class="cp-field-row cp-field-row-2">' +
			fields.names.slice(0, 2).map(function (field) { return '<div class="cp-field">' + fieldCellHtml(field) + '</div>'; }).join('') +
			'</div>' +
			'<div class="cp-field-row cp-field-row-2">' +
			fields.names.slice(2, 4).map(function (field) { return '<div class="cp-field">' + fieldCellHtml(field) + '</div>'; }).join('') +
			'</div>';
		var adminRows = '<div class="cp-field-row cp-field-row-3">' +
			fields.admin.slice(0, 3).map(function (field) { return '<div class="cp-field">' + fieldCellHtml(field) + '</div>'; }).join('') +
			'</div>' +
			'<div class="cp-field-row cp-field-row-3">' +
			fields.admin.slice(3, 6).map(function (field) { return '<div class="cp-field">' + fieldCellHtml(field) + '</div>'; }).join('') +
			'</div>';

		return '<div class="cp-setup">' +
			'<div class="cp-setup-head"><span class="cp-step">1</span><div class="cp-setup-head-text">' +
				'<h3 class="cp-block-title">Customer identity</h3>' +
				'<p class="cp-block-sub">Start with the basics: the name and the details your team uses to recognise and manage this customer.</p>' +
			'</div></div>' +
			typeSwitchHtml() +
			nameRows +
			adminRows +
			'<div class="cp-field-row"><div class="cp-field cp-field-full">' + fieldCellHtml(tagsField) + '</div></div>' +
		'</div>' +
		'<div class="cp-setup">' +
			'<div class="cp-setup-head"><span class="cp-step">2</span><div class="cp-setup-head-text">' +
				'<h3 class="cp-block-title">Question sets</h3>' +
				'<p class="cp-block-sub">A question set is a group of sections. Tick one for a preset, or tick several to build your own combination. Question sets are independent of the customer type and industry, and switching never removes saved data.</p>' +
			'</div></div>' +
			'<div class="cp-field-row"><div class="cp-field cp-field-full">' +
				dataPackPickerHtml() +
				'<span class="cp-field-help" id="cp-kind-hint">' + esc(selectionHelpText()) + '</span>' +
			'</div></div>' +
			'<div class="cp-focus-head"><span class="cp-label">Focus areas</span>' +
				'<span class="cp-focus-hint" id="cp-focus-hint">' + customerRecord.focus.length + (customerRecord.focus.length === 1 ? ' area selected' : ' areas selected') + '</span>' +
			'</div>' +
			'<div class="cp-focus-grid" id="cp-focus-grid">' + focusChipsHtml() + '</div>' +
			'<div class="cp-setup-actions">' +
				'<button type="button" class="cp-btn cp-btn-sm" data-apply-preset' + (locked() ? ' disabled' : '') + '>Use suggested areas</button>' +
				'<span class="cp-setup-hint">One set is a preset; several make a custom combination. Every answer stays saved.</span>' +
			'</div>' +
			'<p class="cp-note" id="cp-profile-note">' + esc(profileSetupNoteText()) + '</p>' +
		'</div>';
	}

	/* ── Array lists ── */
	function arrayRowFieldsHtml(listKey, row) {
		var definition = LIST_DEFINITIONS[listKey];
		function cellHtml(field) {
			var isWide = field.type === 'textarea' || field.width === 'full';
			var config = { listKey: listKey, rowId: row.id, rowValue: row[field.id], domId: 'cp-l-' + listKey + '-' + row.id + '-' + field.id };
			return '<div class="cp-array-item-cell' + (isWide ? ' cp-array-item-cell-full' : '') + '">' + fieldCellHtml(field, config) + '</div>';
		}
		var usesWidths = definition.fields.some(function (field) { return field.width === 'full' || field.width === 'half' || field.width === 'third'; });
		if (!usesWidths) {
			return '<div class="cp-array-item-row">' + definition.fields.map(cellHtml).join('') + '</div>';
		}
		var rows = [];
		var halfBuffer = [];
		function flushHalves() {
			if (halfBuffer.length) {
				rows.push({ columns: 2, fields: halfBuffer });
				halfBuffer = [];
			}
		}
		definition.fields.forEach(function (field) {
			if (field.width === 'full' || field.width === 'third') {
				flushHalves();
				rows.push({ columns: 1, fields: [field] });
			} else {
				halfBuffer.push(field);
				if (halfBuffer.length === 2) flushHalves();
			}
		});
		flushHalves();
		return rows.map(function (rowDefinition) {
			var rowClass = rowDefinition.columns === 2 ? 'cp-array-item-row cp-array-item-row-2' : 'cp-array-item-row';
			return '<div class="' + rowClass + '">' + rowDefinition.fields.map(cellHtml).join('') + '</div>';
		}).join('');
	}

	function arrayRowHtml(listKey, row, index) {
		var definition = LIST_DEFINITIONS[listKey];
		var isEditing = editingArrayItem[listKey] === row.id;
		var meta = !isEditing && definition.metaFor ? definition.metaFor(row).filter(Boolean) : [];
		var metaHtml = meta.length
			? '<div class="cp-array-meta">' + meta.map(function (bit) { return '<span class="cp-meta-chip">' + esc(bit) + '</span>'; }).join('') + '</div>'
			: '';
		var formIntro = isEditing && definition.formIntro ? '<p class="cp-array-form-intro">' + esc(definition.formIntro) + '</p>' : '';
		var removeButton = locked() ? '' : '<button type="button" class="cp-btn cp-btn-sm cp-btn-danger" data-remove-row="' + esc(listKey) + '" data-row-id="' + esc(row.id) + '" title="Remove" aria-label="Remove">x</button>';
		return '<div class="cp-array-item ' + (isEditing ? 'is-editing' : 'is-collapsed') + '" data-row-id="' + esc(row.id) + '">' +
			'<div class="cp-array-item-header">' +
				'<span class="cp-array-item-title">' + esc(definition.titleFor(row, index)) +
					(definition.subtitleFor(row) ? ' <span class="cp-array-item-sub">' + esc(definition.subtitleFor(row)) + '</span>' : '') +
				'</span>' +
				'<div class="cp-array-item-actions">' +
					'<button type="button" class="cp-btn cp-btn-sm cp-array-edit" data-toggle-row="' + esc(listKey) + '" data-row-id="' + esc(row.id) + '" aria-expanded="' + (isEditing ? 'true' : 'false') + '">' + (isEditing ? 'Done' : 'Edit') + '</button>' +
					removeButton +
				'</div>' +
			'</div>' + metaHtml +
			'<div class="cp-array-item-body">' + formIntro + arrayRowFieldsHtml(listKey, row) + '</div>' +
		'</div>';
	}

	function arrayContainerHtml(listKey) {
		var definition = LIST_DEFINITIONS[listKey];
		var rows = customerRecord.lists[listKey] || [];
		if (!rows.length) return '<div class="cp-array-item-empty">' + esc(definition.empty) + '</div>';
		return '<div class="cp-array-container">' + rows.map(function (row, index) { return arrayRowHtml(listKey, row, index); }).join('') + '</div>';
	}

	function addRowButtonHtml(listKey) {
		if (locked()) return '';
		var definition = LIST_DEFINITIONS[listKey];
		return '<button type="button" class="cp-btn cp-btn-add" data-add-row="' + esc(listKey) + '">' + iconSvg('plus') + ' ' + esc(definition.addLabel) + '</button>';
	}

	function listSubsectionHtml(listKey, showHead) {
		var definition = LIST_DEFINITIONS[listKey];
		var rows = customerRecord.lists[listKey] || [];
		var headHtml = showHead === false ? '' : '<div class="cp-subsection-head">' +
			'<h3 class="cp-subsection-title">' + esc(definition.title) + '</h3>' +
			'<span class="cp-subsection-count">' + rows.length + '</span>' +
		'</div>';
		return '<div class="cp-subsection">' +
			headHtml +
			arrayContainerHtml(listKey) +
			addRowButtonHtml(listKey) +
		'</div>';
	}

	/* ── Share & export ── */
	function buildReadiness() {
		var items = [];
		function add(label, ok, hint) { items.push({ label: label, ok: !!ok, hint: hint || '' }); }
		var name = customerDisplayName() !== 'New customer';
		add('Customer name', name, 'Add the name in Basic Information');
		add('A contact point', listHasContent('emails') || listHasContent('phones'), 'Add an email or phone in Contact & Links');
		add('Status and owner', trimString(customerRecord.values.core_status) && trimString(customerRecord.values.core_owner), 'Set both in Basic Information');
		add('At least one question set', hasProfileSelection(), 'Choose question sets in Basic Information');
		if (focusSet().addresses || customerRecord.showAllSections) add('An address', listHasContent('addresses'), 'Add a billing or shipping address');
		if (focusSet().contacts || customerRecord.showAllSections) add('A person', listHasContent('contacts'), 'Add the person you deal with');
		if (focusSet().activity || customerRecord.showAllSections) add('An interaction', listHasContent('interactions'), 'Log the last conversation');
		add('A note', trimString(customerRecord.values.core_notes) !== '', 'Add context for the next person');
		items.sort(function (left, right) { return left.ok === right.ok ? 0 : (left.ok ? 1 : -1); });
		return items;
	}

	function readinessHtml() {
		return buildReadiness().map(function (item) {
			return '<li class="cp-readiness-item ' + (item.ok ? 'is-done' : 'is-missing') + '">' +
				iconSvg(item.ok ? 'check' : 'warning') +
				'<span><strong>' + esc(item.label) + '</strong>' + (item.ok ? '' : ' - ' + esc(item.hint)) + '</span></li>';
		}).join('');
	}

	function buildProfileSummaryText() {
		var lines = [];
		lines.push((customerDisplayName() || 'Customer').toUpperCase());
		lines.push(typeAndProfileLabel());
		var contactBits = [];
		if (listHasContent('emails')) contactBits.push(customerRecord.lists.emails.filter(function (row) { return row.value; }).map(function (row) { return row.value; }).join(', '));
		if (listHasContent('phones')) contactBits.push(customerRecord.lists.phones.filter(function (row) { return row.value; }).map(function (row) { return row.value; }).join(', '));
		var firstAddress = (customerRecord.lists.addresses || []).filter(LIST_DEFINITIONS.addresses.hasContent)[0];
		if (firstAddress) contactBits.push([firstAddress.city, firstAddress.region, firstAddress.country].filter(Boolean).join(', '));
		if (contactBits.length) lines.push(contactBits.join('  |  '));

		var customerFacts = [];
		if (trimString(customerRecord.values.core_status)) customerFacts.push('Status: ' + customerRecord.values.core_status);
		if (trimString(customerRecord.values.core_priority)) customerFacts.push('Priority: ' + customerRecord.values.core_priority);
		if (trimString(customerRecord.values.core_owner)) customerFacts.push('Owner: ' + customerRecord.values.core_owner);
		if (trimString(customerRecord.values.core_source)) customerFacts.push('Source: ' + customerRecord.values.core_source);
		if (trimString(customerRecord.values.core_since)) customerFacts.push('Customer since: ' + customerRecord.values.core_since);
		if (trimString(customerRecord.values.core_nextFollowUp)) customerFacts.push('Next follow-up: ' + customerRecord.values.core_nextFollowUp);
		if (Array.isArray(customerRecord.values.core_tags) && customerRecord.values.core_tags.length) customerFacts.push('Tags: ' + customerRecord.values.core_tags.join(', '));
		if (customerFacts.length) lines.push(customerFacts.join('  |  '));

		currentSections.forEach(function (section) {
			if (section.id === 'basic' || section.id === 'contact' || !isSectionVisible(section)) return;
			var block = '';
			if (section.kind === 'lists') {
				(section.lists || []).forEach(function (listKey) {
					var definition = LIST_DEFINITIONS[listKey];
					var rows = customerRecord.lists[listKey] || [];
					var filled = rows.filter(definition.hasContent);
					if (!filled.length) return;
					block += definition.title.toUpperCase() + '\n';
					filled.forEach(function (row) {
						var line = definition.summaryFor ? definition.summaryFor(row) : [definition.titleFor(row, 0), definition.subtitleFor(row)].filter(Boolean).join(' - ');
						block += '- ' + line + '\n';
					});
					block += '\n';
				});
			} else {
				var rows = [];
				(section.fields || []).forEach(function (field) {
					var value = customerRecord.values[field.id];
					if (field.type === 'checkbox') {
						if (value === true) rows.push('- ' + field.label + ': Yes');
						return;
					}
					if (Array.isArray(value)) value = value.join(', ');
					if (value === null || value === undefined || String(value).trim() === '') return;
					rows.push('- ' + field.label + ': ' + String(value).trim());
				});
				if (rows.length) block = section.title.toUpperCase() + '\n' + rows.join('\n') + '\n\n';
			}
			if (block) lines.push(block.replace(/\n+$/, ''));
		});

		lines.push('');
		lines.push('Prepared from a customer profile record on ' + nowISO().slice(0, 10) + '.');
		return lines.join('\n');
	}

	/* ── Share drawer and header action menu ── */
	function shareDrawerBodyHtml() {
		var managementLabel = canWrite() ? 'Manage question sets' : 'View question sets';
		return '<div class="cp-share-card">' +
				'<h3 class="cp-subsection-title">Record readiness</h3>' +
				'<ul class="cp-readiness-list">' + readinessHtml() + '</ul>' +
			'</div>' +
			'<div class="cp-share-card">' +
				'<h3 class="cp-subsection-title">Export</h3>' +
				'<p class="cp-field-help">The readable summary follows the sections in the sidebar. The JSON keeps the whole record, including answers from other question sets.</p>' +
				'<div class="cp-share-actions">' +
					'<button type="button" class="cp-btn cp-btn-primary" data-action="download-json">' + iconSvg('download') + ' Download JSON</button>' +
					'<button type="button" class="cp-btn" data-action="copy-json">' + iconSvg('copy') + ' Copy JSON</button>' +
					'<button type="button" class="cp-btn" data-action="copy-summary">' + iconSvg('copy') + ' Copy summary</button>' +
					'<button type="button" class="cp-btn" data-action="export-pdf">' + iconSvg('share') + ' Printable summary</button>' +
					'<button type="button" class="cp-btn" data-action="manage-profiles">' + iconSvg('layers') + ' ' + managementLabel + '</button>' +
				'</div>' +
			'</div>' +
			'<div class="cp-field">' +
				'<label class="cp-label" for="cp-output-preview">Summary preview</label>' +
				'<pre class="cp-output-preview" id="cp-output-preview">' + esc(buildProfileSummaryText()) + '</pre>' +
			'</div>';
	}

	function renderShareDrawer() {
		var body = document.getElementById('cp-drawer-body');
		if (body) body.innerHTML = shareDrawerBodyHtml();
	}

	function isShareDrawerOpen() {
		var drawer = document.getElementById('cp-drawer');
		return !!drawer && drawer.classList.contains('open');
	}

	function openShareDrawer() {
		closeActionsMenu();
		renderShareDrawer();
		var overlay = document.getElementById('cp-drawer-overlay');
		var drawer = document.getElementById('cp-drawer');
		if (overlay) overlay.classList.add('open');
		if (drawer) {
			drawer.classList.add('open');
			drawer.setAttribute('aria-hidden', 'false');
		}
		var closeButton = document.getElementById('cp-drawer-close');
		if (closeButton) {
			try { closeButton.focus({ preventScroll: true }); } catch (error) { closeButton.focus(); }
		}
		resize();
	}

	function closeShareDrawer() {
		var overlay = document.getElementById('cp-drawer-overlay');
		var drawer = document.getElementById('cp-drawer');
		if (overlay) overlay.classList.remove('open');
		if (drawer) {
			drawer.classList.remove('open');
			drawer.setAttribute('aria-hidden', 'true');
		}
		var toggle = document.getElementById('cp-actions-toggle');
		if (toggle) {
			try { toggle.focus({ preventScroll: true }); } catch (error) { toggle.focus(); }
		}
		resize();
	}

	function setActionsMenuOpen(open) {
		var menu = document.getElementById('cp-actions-menu');
		var toggle = document.getElementById('cp-actions-toggle');
		if (!menu || !toggle) return;
		menu.hidden = !open;
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
	}

	function toggleActionsMenu() {
		var menu = document.getElementById('cp-actions-menu');
		if (!menu) return;
		setActionsMenuOpen(menu.hidden);
	}

	function closeActionsMenu() {
		setActionsMenuOpen(false);
	}

	/* ── Section rendering ── */
	function sectionHeaderHtml(section, progress) {
		return '<div class="cp-section-header">' +
			'<div class="cp-section-icon">' + iconSvg(section.icon) + '</div>' +
			'<div class="cp-section-title-group">' +
				'<h2 class="cp-section-title">' + esc(section.title) + '</h2>' +
				'<p class="cp-section-desc">' + esc(section.description || '') + '</p>' +
			'</div>' +
			sectionStateHtml(section, progress) +
		'</div>';
	}

	function sectionHtml(section) {
		var progress = sectionProgress(section);
		var body = '';
		if (section.kind === 'basic') body = basicSectionBodyHtml();
		else if (section.kind === 'contact') body = listSubsectionHtml('emails') + listSubsectionHtml('phones');
		else if (section.kind === 'lists') body = (section.lists || []).map(function (listKey) { return listSubsectionHtml(listKey, false); }).join('');
		else body = fieldRowsHtml(section.fields);
		return '<section class="cp-section' + (section.id === currentSection ? ' active' : '') + '" id="sec-' + esc(section.id) + '" data-section-id="' + esc(section.id) + '">' +
			sectionHeaderHtml(section, progress) +
			'<div class="cp-section-body">' + body + '</div>' +
		'</section>';
	}

	function ownerDatalistHtml() {
		var users = permittedUsers();
		if (!users.length) return '';
		return '<datalist id="cp-owner-options">' + users.map(function (user) {
			return '<option value="' + esc(user.name || user.email) + '"></option>';
		}).join('') + '</datalist>';
	}

	function renderMain() {
		var main = document.getElementById('cp-main');
		if (!main) return;
		var list = visibleSections();
		main.innerHTML = list.map(sectionHtml).join('') + ownerDatalistHtml() + '<div class="cp-pager" id="cp-pager"></div>';
		renderPager();
		if (focusAfterRender) {
			focusArrayRow(focusAfterRender.listKey, focusAfterRender.rowId);
			focusAfterRender = null;
		}
	}

	function renderPager() {
		var pager = document.getElementById('cp-pager');
		if (!pager) return;
		var list = visibleSections();
		if (list.length < 2) {
			pager.innerHTML = '';
			return;
		}
		var index = list.findIndex(function (section) { return section.id === currentSection; });
		if (index === -1) index = 0;
		var previous = list[(index - 1 + list.length) % list.length];
		var next = list[(index + 1) % list.length];
		pager.innerHTML =
			'<button type="button" class="cp-pager-btn" data-nav-step="-1">' + iconSvg('chevronLeft') +
				'<span class="cp-pager-text"><span class="cp-pager-eyebrow">Previous</span><strong>' + esc(previous.title) + '</strong></span></button>' +
			'<span class="cp-pager-count">' + (index + 1) + ' / ' + list.length + '</span>' +
			'<button type="button" class="cp-pager-btn cp-pager-next" data-nav-step="1">' +
				'<span class="cp-pager-text"><span class="cp-pager-eyebrow">Next</span><strong>' + esc(next.title) + '</strong></span>' + iconSvg('chevronRight') + '</button>';
	}

	function sectionItemCount(section) {
		if (section.kind === 'contact') {
			return (customerRecord.lists.emails || []).length + (customerRecord.lists.phones || []).length;
		}
		if (section.kind === 'lists') {
			return (section.lists || []).reduce(function (total, listKey) { return total + (customerRecord.lists[listKey] || []).length; }, 0);
		}
		return 0;
	}

	function buildNav() {
		var nav = document.getElementById('cp-nav');
		if (nav) {
			var html = '';
			var lastGroup = '';
			visibleSections().forEach(function (section) {
				if (section.group !== lastGroup) {
					html += '<div class="cp-nav-group">' + esc(section.group) + '</div>';
					lastGroup = section.group;
				}
				var count = sectionItemCount(section);
				var progress = sectionProgress(section);
				var trailing = '';
				if (count > 0) trailing = '<span class="cp-nav-badge">' + count + '</span>';
				else if (progress.complete) trailing = '<span class="cp-nav-done">' + iconSvg('check') + '</span>';
				html += '<button type="button" class="cp-nav-item' + (section.id === currentSection ? ' active' : '') + '" data-nav="' + esc(section.id) + '">' +
					'<span class="cp-nav-icon">' + iconSvg(section.icon) + '</span>' +
					'<span class="cp-nav-label">' + esc(section.title) + '</span>' + trailing + '</button>';
			});
			nav.innerHTML = html;
		}
		updateSidebarMeta();
	}

	function updateSidebarMeta() {
		var profiles = currentProfiles();
		var profile = currentProfile();
		var chipValue = document.getElementById('cp-profile-chip-value');
		var chipSub = document.getElementById('cp-profile-chip-sub');
		if (chipValue) {
			if (!profiles.length) chipValue.textContent = 'Not set';
			else if (profiles.length === 1) chipValue.textContent = profiles[0].name;
			else chipValue.textContent = profiles.length + ' question sets';
		}
		if (chipSub) {
			if (!profiles.length) chipSub.textContent = 'Choose question sets in Basic Information';
			else if (profiles.length === 1) chipSub.textContent = customerRecord.focus.length + (customerRecord.focus.length === 1 ? ' area covered' : ' areas covered');
			else chipSub.textContent = currentSections.length + ' sections in total';
		}
		var menuManageText = document.getElementById('cp-menu-manage-text');
		if (menuManageText) menuManageText.textContent = canWrite() ? 'Manage question sets' : 'View question sets';
		var hidden = hiddenSectionCount();
		var note = document.getElementById('cp-hidden-note');
		if (note) {
			if (!profiles.length) {
				if (customerRecord.showAllSections) note.textContent = 'Showing all basic and extra sections';
				else if (customerRecord.focus.length) note.textContent = 'Extra areas selected';
				else note.textContent = 'Basic sections only - choose question sets to show more';
			}
			else if (!hidden) note.textContent = 'All sections are visible';
			else if (customerRecord.showAllSections) note.textContent = hidden + ' hidden by this selection - showing all';
			else note.textContent = hidden + (hidden === 1 ? ' section hidden' : ' sections hidden') + ' by this selection';
		}
		var toggle = document.getElementById('cp-scope-toggle');
		if (toggle) {
			toggle.textContent = customerRecord.showAllSections ? 'Hide sections not needed' : 'Show all sections';
			toggle.disabled = !canWrite();
		}
		var manage = document.getElementById('cp-manage-profiles');
		if (manage) {
			manage.disabled = false;
			manage.textContent = canWrite() ? '+ Manage question sets' : 'View question sets';
		}
	}

	function updateCompletion() {
		var list = visibleSections();
		var total = 0;
		var complete = 0;
		list.forEach(function (section) {
			var progress = sectionProgress(section);
			if (progress.total === 0) return;
			total++;
			if (progress.complete) complete++;
		});
		var percent = total ? Math.round((complete / total) * 100) : 0;
		var ring = document.getElementById('cp-completion-ring');
		if (ring) ring.style.background = 'conic-gradient(var(--cp-accent) ' + percent + '%, var(--cp-line) ' + percent + '%)';
		var pct = document.getElementById('cp-completion-pct');
		if (pct) pct.textContent = percent + '%';
		var count = document.getElementById('cp-completion-count');
		if (count) count.textContent = complete + ' of ' + total;
	}

	function updateSectionStates() {
		visibleSections().forEach(function (section) {
			var state = document.querySelector('[data-section-state="' + section.id + '"]');
			if (!state) return;
			var progress = sectionProgress(section);
			state.textContent = progress.total === 0 ? 'Optional' : (progress.complete ? 'Complete' : progress.done + ' of ' + progress.total);
			state.className = 'cp-section-state' + (progress.complete ? ' complete' : '');
		});
	}

	function renderHeader() {
		var name = customerDisplayName();
		var nameNode = document.getElementById('cp-person-name-display');
		if (nameNode) nameNode.textContent = name;
		var buildBadge = document.getElementById('cp-build-badge');
		if (buildBadge) buildBadge.innerHTML = '<span class="cp-build-prefix">tool </span>build ' + TOOL_BUILD;
		var logo = document.getElementById('cp-logo');
		if (logo) logo.innerHTML = iconSvg(customerRecord.customerType === 'company' ? 'building' : 'user');
		var menuName = document.getElementById('cp-menu-name');
		if (menuName) menuName.textContent = name;
		var menuSub = document.getElementById('cp-menu-sub');
		if (menuSub) menuSub.textContent = hasProfileSelection() ? typeAndProfileLabel() : 'Choose question sets';
		var menuHeadIcon = document.getElementById('cp-menu-head-ico');
		if (menuHeadIcon) menuHeadIcon.innerHTML = iconSvg(customerRecord.customerType === 'company' ? 'building' : 'user');
		var themeButton = document.getElementById('cp-theme-toggle');
		if (themeButton) {
			var isDark = customerRecord.ui.theme === 'dark';
			themeButton.innerHTML = iconSvg(isDark ? 'sun' : 'moon');
			themeButton.setAttribute('aria-pressed', isDark ? 'true' : 'false');
		}
	}

	function setSaveState(state) {
		var indicator = document.getElementById('cp-save-indicator');
		var text = document.getElementById('cp-save-text');
		var stateClass = state === 'saving' ? ' saving' : (state === 'error' ? ' error' : '');
		if (indicator) indicator.className = 'cp-save-indicator' + stateClass;
		if (text) text.textContent = state === 'saving' ? 'Saving...' : (state === 'error' ? 'Could not save' : 'All changes saved');
	}

	function applyReadonlyState() {
		var root = document.getElementById('app');
		var lockedNow = locked();
		if (root) root.classList.toggle('cp-readonly', lockedNow);
		var note = document.getElementById('cp-readonly-note');
		if (note) note.hidden = !lockedNow;
		var manage = document.getElementById('cp-manage-profiles');
		if (manage) manage.disabled = false;
		var toggle = document.getElementById('cp-scope-toggle');
		if (toggle) toggle.disabled = !canWrite();
	}

	function applyTheme() {
		var root = document.getElementById('app');
		if (root) root.classList.toggle('cp-dark', customerRecord.ui.theme === 'dark');
		renderHeader();
	}

	/* ── Render all ── */
	function renderAll() {
		currentSections = buildSections();
		ensureActiveSection();
		renderHeader();
		renderMain();
		buildNav();
		updateCompletion();
		applyReadonlyState();
		if (isShareDrawerOpen()) renderShareDrawer();
		resize();
	}

	function switchToSection(sectionId) {
		var list = visibleSections();
		var exists = list.some(function (section) { return section.id === sectionId; });
		if (!exists) return;
		currentSection = sectionId;
		$$('.cp-section').forEach(function (element) {
			element.classList.toggle('active', element.getAttribute('data-section-id') === sectionId);
		});
		$$('.cp-nav-item').forEach(function (element) {
			element.classList.toggle('active', element.getAttribute('data-nav') === sectionId);
		});
		renderPager();
		resize();
	}

	/* ── Save ── */
	function scheduleSave() {
		setSaveState('saving');
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(function () {
			persistNow();
		}, 400);
	}

	function saveNow() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		persistNow();
	}

	function persistNow() {
		if (locked()) {
			setSaveState('saved');
			return;
		}
		customerRecord.meta.updatedAt = nowISO();
		customerRecord.meta.updatedByName = currentUser ? (currentUser.name || currentUser.email || '') : '';
		var snapshot = snapshotForValue();
		lastStagedJson = JSON.stringify(snapshot);
		lastCoreSignature = signatureOfValue(snapshot);
		try {
			tool.setValue(snapshot);
			setSaveState('saved');
		} catch (error) {
			console.warn('[CustomerProfile] setValue failed', error);
			setSaveState('error');
		}
		updateSectionStates();
		updateCompletion();
		buildNav();
		if (isShareDrawerOpen()) renderShareDrawer();
		resize();
	}

	/* ── Profile / focus actions ── */
	function applyProfileSelection(keys, options) {
		if (!canWrite()) return;
		var nextKeys = normalizeProfileKeys(keys, '');
		var previousFocus = customerRecord.focus.slice();
		customerRecord.profileKeys = nextKeys;
		customerRecord.profileKey = nextKeys[0] || '';
		var profile = currentProfile();
		var preset = profileFocusPreset(profile);
		customerRecord.presetFocus = preset.slice();
		if (options && options.resetFocus) {
			customerRecord.focus = preset.slice();
		} else if (!nextKeys.length) {
			customerRecord.focus = [];
		} else {
			preset.forEach(function (areaId) {
				if (previousFocus.indexOf(areaId) === -1) previousFocus.push(areaId);
			});
			customerRecord.focus = previousFocus;
		}
		customerRecord.showAllSections = false;
		saveNow();
		renderAll();
	}

	function selectProfile(profileKey) {
		if (!canWrite()) return;
		if (!profileKey) {
			applyProfileSelection([], { resetFocus: true });
			notify('Question sets cleared. The basic sections stay visible and every answer is kept.', 'info');
			return;
		}
		var profile = findProfile(profileKey);
		if (!profile) return;
		applyProfileSelection([profile.key], { resetFocus: true });
		switchToSection('basic');
		notify('Using only ' + profile.name + '. Existing answers are kept.', 'info');
	}

	function toggleProfileSelection(profileKey) {
		if (!canWrite()) return;
		var profile = findProfile(profileKey);
		if (!profile) return;
		var keys = currentProfileKeys();
		var index = keys.indexOf(profile.key);
		if (index > -1) keys.splice(index, 1);
		else keys.push(profile.key);
		applyProfileSelection(keys);
		if (keys.length) {
			notify(keys.length === 1 ? 'Using ' + profile.name + '. Existing answers are kept.' : keys.length + ' question sets combined. Existing answers are kept.', 'info');
		} else {
			notify('Question sets cleared. The basic sections stay visible and every answer is kept.', 'info');
		}
	}

	function selectAllProfiles() {
		if (!canWrite()) return;
		applyProfileSelection(allProfiles().map(function (profile) { return profile.key; }));
		notify('All question sets combined. Shared sections are only shown once.', 'info');
	}

	function clearProfileSelection() {
		if (!canWrite()) return;
		applyProfileSelection([], { resetFocus: true });
		notify('Question sets cleared. The basic sections stay visible and every answer is kept.', 'info');
	}


	function setCustomerType(customerType) {
		if (!canWrite()) return;
		if (customerType !== 'person' && customerType !== 'company') return;
		if (customerType === customerRecord.customerType) return;
		customerRecord.customerType = customerType;
		saveNow();
		renderAll();
		switchToSection('basic');
		notify(customerType === 'company' ? 'Company selected. The question sets and answers stay in place; only the identity fields change.' : 'Person selected. The question sets and answers stay in place; only the identity fields change.', 'info');
	}

	function toggleFocusArea(areaId) {
		if (!canWrite() || !focusAreaById(areaId)) return;
		var focus = customerRecord.focus.slice();
		var index = focus.indexOf(areaId);
		if (index > -1) focus.splice(index, 1);
		else focus.push(areaId);
		customerRecord.focus = focus;
		saveNow();
		renderAll();
	}

	function toggleShowAllSections() {
		if (!canWrite()) return;
		customerRecord.showAllSections = !customerRecord.showAllSections;
		saveNow();
		renderAll();
	}

	function applySuggestedFocus() {
		if (!canWrite()) return;
		customerRecord.focus = customerRecord.presetFocus.slice();
		saveNow();
		renderAll();
		notify('Suggested areas applied.', 'info');
	}

	/* ── Field changes ── */
	function refreshAfterFieldChange(fieldId) {
		renderHeader();
		updateSectionStates();
		updateCompletion();
		buildNav();
		if (fieldId === 'core_notes') {
			// The share preview includes the notes.
		}
	}

	function updateFieldValue(fieldId, value) {
		customerRecord.values[fieldId] = value;
	}

	function onRootInput(event) {
		if (locked()) return;
		var target = event.target;
		if (!target || typeof target.getAttribute !== 'function') return;
		if (target.type === 'checkbox' || target.tagName === 'SELECT') return;
		var fieldId = target.getAttribute('data-field');
		if (fieldId) {
			updateFieldValue(fieldId, target.value);
			scheduleSave();
			refreshAfterFieldChange(fieldId);
			return;
		}
		var listKey = target.getAttribute('data-list');
		var rowId = target.getAttribute('data-row-id');
		var listField = target.getAttribute('data-list-field');
		if (listKey && rowId && listField) {
			var row = listRowById(listKey, rowId);
			if (row) row[listField] = target.value;
			scheduleSave();
			updateSectionStates();
			updateCompletion();
			return;
		}
		if (target.getAttribute('data-tag-input')) return;
	}

	function onRootChange(event) {
		if (locked()) return;
		var target = event.target;
		if (!target || typeof target.getAttribute !== 'function') return;

		if (target.hasAttribute('data-profile-toggle')) {
			toggleProfileSelection(target.getAttribute('data-profile-toggle'));
			return;
		}

		var fieldId = target.getAttribute('data-field');
		if (fieldId) {
			if (target.type === 'checkbox' && target.hasAttribute('data-option')) {
				var container = target.closest('[data-multiselect]');
				if (container) {
					var values = [];
					$$('input[data-option]', container).forEach(function (box) {
						if (box.checked) values.push(box.value);
					});
					customerRecord.values[fieldId] = values;
					var chip = target.closest('.cp-choice');
					if (chip) chip.classList.toggle('is-on', target.checked);
				}
			} else if (target.type === 'checkbox') {
				customerRecord.values[fieldId] = !!target.checked;
			} else if (target.tagName === 'SELECT') {
				customerRecord.values[fieldId] = target.value;
			}
			scheduleSave();
			refreshAfterFieldChange(fieldId);
			return;
		}

		var listKey = target.getAttribute('data-list');
		var rowId = target.getAttribute('data-row-id');
		var listField = target.getAttribute('data-list-field');
		if (listKey && rowId && listField) {
			var row = listRowById(listKey, rowId);
			if (row) row[listField] = target.value;
			scheduleSave();
			updateSectionStates();
			updateCompletion();
		}
	}

	function onRootKeydown(event) {
		var target = event.target;
		if (!target || typeof target.closest !== 'function') return;
		var tagInput = target.closest('[data-tag-input]');
		if (!tagInput) return;
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTag(tagInput);
			return;
		}
		if (event.key === 'Backspace' && !tagInput.value) {
			var fieldId = tagInput.getAttribute('data-tag-input');
			var tags = Array.isArray(customerRecord.values[fieldId]) ? customerRecord.values[fieldId].slice() : [];
			if (!tags.length) return;
			tags.pop();
			customerRecord.values[fieldId] = tags;
			renderTagsEditor(fieldId);
			scheduleSave();
			refreshAfterFieldChange(fieldId);
		}
	}

	function listRowById(listKey, rowId) {
		var rows = customerRecord.lists[listKey] || [];
		for (var index = 0; index < rows.length; index++) {
			if (rows[index].id === rowId) return rows[index];
		}
		return null;
	}

	function addTag(input) {
		var fieldId = input.getAttribute('data-tag-input');
		var text = trimString(input.value).replace(/,+$/, '').trim();
		if (!fieldId || !text) return;
		var tags = Array.isArray(customerRecord.values[fieldId]) ? customerRecord.values[fieldId].slice() : [];
		var exists = tags.some(function (tag) { return String(tag).toLowerCase() === text.toLowerCase(); });
		if (!exists) tags.push(text.slice(0, 40));
		customerRecord.values[fieldId] = tags;
		input.value = '';
		renderTagsEditor(fieldId);
		scheduleSave();
		refreshAfterFieldChange(fieldId);
	}

	function removeTag(fieldId, tagValue) {
		var tags = Array.isArray(customerRecord.values[fieldId]) ? customerRecord.values[fieldId].slice() : [];
		customerRecord.values[fieldId] = tags.filter(function (tag) { return String(tag) !== String(tagValue); });
		renderTagsEditor(fieldId);
		scheduleSave();
		refreshAfterFieldChange(fieldId);
	}

	function renderTagsEditor(fieldId) {
		var editor = document.querySelector('[data-tags-for="' + fieldId + '"]');
		if (!editor) return;
		editor.outerHTML = tagsEditorHtml(fieldId, customerRecord.values[fieldId]);
		var nextInput = document.querySelector('[data-tag-input="' + fieldId + '"]');
		if (nextInput) nextInput.focus();
	}

	/* ── Array row actions ── */
	function addArrayRow(listKey) {
		if (locked()) return;
		var definition = LIST_DEFINITIONS[listKey];
		if (!definition) return;
		var row = definition.blank();
		row.id = uid('row');
		customerRecord.lists[listKey].push(row);
		editingArrayItem[listKey] = row.id;
		focusAfterRender = { listKey: listKey, rowId: row.id };
		saveNow();
		renderAll();
		notify('Entry added. Fill it in and it saves with the customer.', 'info');
	}

	function toggleArrayRow(listKey, rowId) {
		if (locked()) return;
		editingArrayItem[listKey] = editingArrayItem[listKey] === rowId ? null : rowId;
		renderAll();
	}

	function removeArrayRow(listKey, rowId) {
		if (locked()) return;
		customerRecord.lists[listKey] = (customerRecord.lists[listKey] || []).filter(function (row) { return row.id !== rowId; });
		if (editingArrayItem[listKey] === rowId) editingArrayItem[listKey] = null;
		saveNow();
		renderAll();
		notify('Entry removed.', 'success');
	}

	function focusArrayRow(listKey, rowId) {
		var rowElement = document.querySelector('[data-row-id="' + rowId + '"]');
		if (!rowElement) return;
		var input = rowElement.querySelector('input, textarea, select');
		if (input) {
			try { input.focus({ preventScroll: true }); } catch (error) { input.focus(); }
		}
		try { rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (error) { }
	}

	/* ── Click routing ── */
	function onRootClick(event) {
		var target = event.target;
		if (!target || typeof target.closest !== 'function') return;

		if (!target.closest('.cp-actions')) closeActionsMenu();
		if (target.closest('#cp-actions-toggle')) {
			toggleActionsMenu();
			return;
		}
		var menuAction = target.closest('[data-menu-action]');
		if (menuAction) {
			var menuActionName = menuAction.getAttribute('data-menu-action');
			closeActionsMenu();
			if (menuActionName === 'share') openShareDrawer();
			else if (menuActionName === 'manage-profiles') openProfilesModal();
			else if (menuActionName === 'basic') switchToSection('basic');
			return;
		}

		if (target.closest('#cp-theme-toggle')) {
			customerRecord.ui.theme = customerRecord.ui.theme === 'dark' ? 'light' : 'dark';
			applyTheme();
			saveNow();
			return;
		}

		var navItem = target.closest('[data-nav]');
		if (navItem) {
			switchToSection(navItem.getAttribute('data-nav'));
			return;
		}
		var navStep = target.closest('[data-nav-step]');
		if (navStep) {
			var list = visibleSections();
			if (!list.length) return;
			var index = list.findIndex(function (section) { return section.id === currentSection; });
			if (index === -1) index = 0;
			var direction = parseInt(navStep.getAttribute('data-nav-step'), 10) || 1;
			var nextIndex = index + direction;
			if (nextIndex < 0) nextIndex = list.length - 1;
			if (nextIndex >= list.length) nextIndex = 0;
			switchToSection(list[nextIndex].id);
			return;
		}
		var typeOption = target.closest('[data-type]');
		if (typeOption) {
			setCustomerType(typeOption.getAttribute('data-type'));
			return;
		}
		var focusChip = target.closest('[data-focus]');
		if (focusChip) {
			toggleFocusArea(focusChip.getAttribute('data-focus'));
			return;
		}
		if (target.closest('[data-apply-preset]')) {
			applySuggestedFocus();
			return;
		}
		if (target.closest('[data-pack-all]')) { selectAllProfiles(); return; }
		if (target.closest('[data-pack-clear]')) { clearProfileSelection(); return; }
		if (target.closest('#cp-pack-library')) { openProfilesModal(); return; }
		if (target.closest('#cp-scope-toggle')) {
			toggleShowAllSections();
			return;
		}
		if (target.closest('#cp-manage-profiles')) {
			openProfilesModal();
			return;
		}
		var addButton = target.closest('[data-add-row]');
		if (addButton) {
			addArrayRow(addButton.getAttribute('data-add-row'));
			return;
		}
		var toggleButton = target.closest('[data-toggle-row]');
		if (toggleButton) {
			toggleArrayRow(toggleButton.getAttribute('data-toggle-row'), toggleButton.getAttribute('data-row-id'));
			return;
		}
		var removeButton = target.closest('[data-remove-row]');
		if (removeButton) {
			removeArrayRow(removeButton.getAttribute('data-remove-row'), removeButton.getAttribute('data-row-id'));
			return;
		}
		var tagButton = target.closest('[data-tag-remove]');
		if (tagButton) {
			removeTag(tagButton.getAttribute('data-tag-field'), tagButton.getAttribute('data-tag-remove'));
			return;
		}
		var actionButton = target.closest('[data-action]');
		if (actionButton) {
			if (actionButton.closest('#cp-actions-menu')) closeActionsMenu();
			var action = actionButton.getAttribute('data-action');
			if (action === 'copy-summary') copyTextAsync(buildProfileSummaryText(), 'Summary copied to the clipboard.');
			else if (action === 'copy-json') copyTextAsync(JSON.stringify(buildExportData(), null, 2), 'Profile JSON copied to the clipboard.');
			else if (action === 'download-json') downloadJson();
			else if (action === 'export-pdf') exportPrintable();
			else if (action === 'manage-profiles') {
				closeShareDrawer();
				openProfilesModal();
			}
		}
	}

	/* ── Permissions ── */
	function hasUserApi() { return typeof tool.getUser === 'function'; }
	function getUserSafe() {
		try { return hasUserApi() ? tool.getUser() : null; } catch (error) { return null; }
	}
	function roles() {
		if (currentUser && currentUser.roles && currentUser.roles.length) return currentUser.roles;
		var effectiveAccess = (currentUser && currentUser.effectiveAccess) || {};
		var derived = [];
		if (effectiveAccess.isManager) derived.push('admin');
		if (effectiveAccess.isEditor) derived.push('editor');
		if (effectiveAccess.isViewer) derived.push('viewer');
		if (derived.length) return derived;
		return (currentUser && currentUser.roles) ? currentUser.roles : [];
	}
	function isAdmin() {
		if (noIdentityMode) return !isReadOnly;
		var roleList = roles();
		return roleList.indexOf('admin') > -1 || roleList.indexOf('owner') > -1 || roleList.indexOf('developer') > -1 || roleList.indexOf('user-manager') > -1;
	}
	function canWrite() { return !isReadOnly && (noIdentityMode || isAdmin() || roles().indexOf('editor') > -1); }
	function locked() { return isReadOnly || !canWrite(); }

	function startUserPolling() {
		if (!hasUserApi()) {
			noIdentityMode = true;
			renderAll();
			return;
		}
		var immediateUser = getUserSafe();
		if (immediateUser) {
			currentUser = immediateUser;
			noIdentityMode = false;
			renderAll();
			return;
		}
		var delays = [400, 1200, 2600, 5000];
		var attempt = 0;
		function step() {
			var user = getUserSafe();
			if (user) {
				currentUser = user;
				noIdentityMode = false;
				renderAll();
				return;
			}
			attempt++;
			if (attempt < delays.length) setTimeout(step, delays[attempt]);
			else {
				noIdentityMode = true;
				renderAll();
			}
		}
		setTimeout(step, delays[0]);
	}

	function startHydrationPolling() {
		if (hydrated) return;
		var delays = [200, 400, 800, 1600];
		var attempt = 0;
		function step() {
			if (hydrated) return;
			var nextValue = null;
			try { nextValue = tool.getValue(); } catch (error) { nextValue = null; }
			if (isObject(nextValue)) {
				hydrateValue(nextValue);
				applyTheme();
				renderAll();
				return;
			}
			attempt++;
			if (attempt < delays.length) setTimeout(step, delays[attempt]);
		}
		setTimeout(step, delays[0]);
	}

	function handleExternalValue(nextValue) {
		if (!isObject(nextValue)) return;
		var serialized = '';
		try { serialized = JSON.stringify(nextValue); } catch (error) { serialized = ''; }
		if (serialized && serialized === lastStagedJson) return;
		if (signatureOfValue(nextValue) === lastCoreSignature) return;
		hydrateValue(nextValue);
		applyTheme();
		renderAll();
		notify('The customer profile was updated by another user.', 'info');
	}

	function permittedUsers() {
		var users = [];
		try {
			if (typeof tool.getPermittedUsers === 'function') {
				var result = tool.getPermittedUsers();
				if (Array.isArray(result)) users = result;
			}
		} catch (error) { users = []; }
		if (!users.length && currentUser) users = [currentUser];
		return users.filter(function (user) { return user && (user.name || user.email); });
	}

	/* ── Profiles modal ── */
	function openModal(title, bodyHtml, footerHtml) {
		var overlay = document.getElementById('cp-modal-overlay');
		if (!overlay) return;
		document.getElementById('cp-modal-title').textContent = title;
		var body = document.getElementById('cp-modal-body');
		var footer = document.getElementById('cp-modal-footer');
		body.innerHTML = bodyHtml;
		footer.innerHTML = footerHtml;
		overlay.classList.add('open');
	}

	function closeModal() {
		var overlay = document.getElementById('cp-modal-overlay');
		if (overlay) overlay.classList.remove('open');
	}

	function openProfilesModal() {
		var selectedCount = currentProfileKeys().length;
		var profiles = allProfiles().slice().sort(function (first, second) {
			var firstSelected = isProfileSelected(first.key);
			var secondSelected = isProfileSelected(second.key);
			if (firstSelected && !secondSelected) return -1;
			if (secondSelected && !firstSelected) return 1;
			return first.name.localeCompare(second.name);
		});
		var canManage = canWrite();
		var html = '<p class="cp-modal-note">A question set is a group of sections. Tick several in Basic Information to build your own combination. Question sets are independent of the customer type and industry; switching never deletes answers. Duplicate one to change its questions for this record.</p>';
		html += profiles.map(function (profile) {
			var sourceLabel = profileSourceLabel(profile);
			var sourceClass = profileSourceClass(profile);
			var selected = isProfileSelected(profile.key);
			var actions = '';
			if (selected) actions += '<span class="cp-tag cp-tag-accent">' + (selectedCount > 1 ? 'Selected' : 'In use') + '</span>';
			if (canManage && (!selected || selectedCount > 1)) actions += '<button type="button" class="cp-btn" data-profile-use="' + esc(profile.key) + '">Use only</button>';
			if (canManage) actions += '<button type="button" class="cp-btn" data-profile-duplicate="' + esc(profile.key) + '">Duplicate</button>';
			if (canManage && profile.source === 'record') {
				actions += '<button type="button" class="cp-btn" data-profile-edit="' + esc(profile.key) + '">Edit</button>';
				actions += '<button type="button" class="cp-btn cp-btn-danger" data-profile-delete="' + esc(profile.key) + '">Delete</button>';
			}
			var profileIcon = profile.sections && profile.sections.length ? profile.sections[0].icon : 'layers';
			var sectionCount = profile.sections ? profile.sections.length : 0;
			return '<div class="cp-profile-row' + (selected ? ' is-active' : '') + '">' +
				'<span class="cp-profile-ico">' + iconSvg(profileIcon) + '</span>' +
				'<div class="cp-profile-main">' +
					'<div class="cp-profile-name">' + esc(profile.name) +
						'<span class="cp-profile-tag' + sourceClass + '">' + sourceLabel + '</span>' +
						'<span class="cp-profile-tag">' + sectionCount + (sectionCount === 1 ? ' section' : ' sections') + '</span>' +
					'</div>' +
					'<div class="cp-profile-desc">' + esc(profile.description || 'No description.') + '</div>' +
				'</div>' +
				'<div class="cp-profile-actions">' + actions + '</div>' +
			'</div>';
		}).join('');
		if (!canManage) html += '<p class="cp-modal-note" style="margin-top:12px">Only editors can change the question set library.</p>';
		var footer = '<button type="button" class="cp-btn" id="cp-profiles-close">Close</button>' +
			(canManage ? '<button type="button" class="cp-btn" id="cp-profiles-json">Custom question sets (JSON)</button>' : '');
		openModal('Question set library', html, footer);
		var closeButton = document.getElementById('cp-profiles-close');
		if (closeButton) closeButton.onclick = closeModal;
		var jsonButton = document.getElementById('cp-profiles-json');
		if (jsonButton) jsonButton.onclick = openProfilesJsonModal;
	}


	function openProfilesJsonModal() {
		var jsonText = '[]';
		try {
			jsonText = JSON.stringify(customerRecord.customProfiles.map(function (profile) {
				return {
					key: profile.key,
					name: profile.name,
					description: profile.description,
					sections: profile.sections
				};
			}), null, 2);
		} catch (error) { jsonText = '[]'; }
		var html = '<p class="cp-modal-note">Define your own question sets as JSON. These definitions are stored with this customer record. For question sets that every customer can use, set the <code>profileDefinitions</code> tool parameter instead. A question set can be used for any customer; it is not tied to a customer type or industry.</p>' +
			'<textarea class="cp-json-area" id="cp-json-textarea" spellcheck="false" aria-label="Custom question set definitions JSON">' + esc(jsonText) + '</textarea>' +
			'<div class="cp-form-error" id="cp-json-error" hidden></div>' +
			'<p class="cp-modal-note" style="margin-top:10px">Field types: text, textarea, number, date, email, phone, url, select, multiselect, checkbox, tags. Select and multiselect fields need an options array.</p>';
		var footer = '<button type="button" class="cp-btn" id="cp-json-example">Load example</button>' +
			'<button type="button" class="cp-btn" id="cp-json-cancel">Cancel</button>' +
			'<button type="button" class="cp-btn cp-btn-primary" id="cp-json-apply">Apply question sets</button>';
		openModal('Custom question sets (JSON)', html, footer);
		var cancelButton = document.getElementById('cp-json-cancel');
		if (cancelButton) cancelButton.onclick = closeModal;
		var exampleButton = document.getElementById('cp-json-example');
		if (exampleButton) exampleButton.onclick = function () {
			var area = document.getElementById('cp-json-textarea');
			if (area) area.value = PROFILE_EXAMPLE_JSON;
			var errorBox = document.getElementById('cp-json-error');
			if (errorBox) errorBox.hidden = true;
		};
		var applyButton = document.getElementById('cp-json-apply');
		if (applyButton) applyButton.onclick = applyProfilesJson;
	}


	function applyProfilesJson() {
		var area = document.getElementById('cp-json-textarea');
		var errorBox = document.getElementById('cp-json-error');
		var result = parseProfileDefinitionsInput(area ? area.value : '[]');
		if (result.error) {
			if (errorBox) {
				errorBox.hidden = false;
				errorBox.textContent = result.error;
			}
			return;
		}
		customerRecord.customProfiles = result.profiles.map(function (profile) {
			profile.custom = true;
			profile.builtIn = false;
			return profile;
		});
		var validKeys = normalizeProfileKeys(customerRecord.profileKeys, customerRecord.profileKey);
		customerRecord.profileKeys = validKeys;
		customerRecord.profileKey = validKeys[0] || '';
		if (!validKeys.length) {
			customerRecord.focus = [];
			customerRecord.presetFocus = [];
		} else {
			var preset = profileFocusPreset(currentProfile());
			customerRecord.presetFocus = preset.slice();
			var focus = customerRecord.focus.slice();
			preset.forEach(function (areaId) {
				if (focus.indexOf(areaId) === -1) focus.push(areaId);
			});
			customerRecord.focus = focus;
		}
		saveNow();
		renderAll();
		openProfilesModal();
		notify('Custom question sets updated.', 'success');
	}


	function uniqueProfileKey(baseKey) {
		var existingKeys = allProfiles().map(function (profile) { return profile.key; });
		var candidate = baseKey + '-copy';
		var counter = 2;
		while (existingKeys.indexOf(candidate) > -1) {
			candidate = baseKey + '-copy-' + counter;
			counter++;
		}
		return candidate;
	}

	function duplicateProfile(profileKey) {
		var sourceProfile = findProfile(profileKey);
		if (!sourceProfile) return;
		var copy = JSON.parse(JSON.stringify(sourceProfile));
		copy.key = uniqueProfileKey(sourceProfile.key);
		copy.name = sourceProfile.name + ' (copy)';
		copy.builtIn = false;
		copy.custom = true;
		delete copy.source;
		customerRecord.customProfiles.push(copy);
		saveNow();
		renderAll();
		openProfilesModal();
		notify('Question set duplicated. Use Edit to adjust its questions.', 'success');
	}


	function openConfirm(title, message, confirmLabel, danger, onConfirm) {
		var footer = '<button type="button" class="cp-btn" id="cp-confirm-cancel">Cancel</button>' +
			'<button type="button" class="cp-btn ' + (danger ? 'cp-btn-danger' : 'cp-btn-primary') + '" id="cp-confirm-ok">' + esc(confirmLabel) + '</button>';
		openModal(title, '<p class="cp-modal-note">' + esc(message) + '</p>', footer);
		var cancelButton = document.getElementById('cp-confirm-cancel');
		if (cancelButton) cancelButton.onclick = closeModal;
		var okButton = document.getElementById('cp-confirm-ok');
		if (okButton) okButton.onclick = function () {
			closeModal();
			setTimeout(onConfirm, 0);
		};
	}

	function requestDeleteProfile(profileKey) {
		var profile = findProfile(profileKey);
		if (!profile) return;
		openConfirm('Delete question set?', 'Delete "' + profile.name + '"? Answers already saved stay in the record, but this question set definition is removed from the record.', 'Delete question set', true, function () {
			customerRecord.customProfiles = customerRecord.customProfiles.filter(function (item) { return item.key !== profileKey; });
			var validKeys = currentProfileKeys().filter(function (key) { return key !== profileKey; });
			customerRecord.profileKeys = validKeys;
			customerRecord.profileKey = validKeys[0] || '';
			if (!validKeys.length) {
				customerRecord.focus = [];
				customerRecord.presetFocus = [];
			} else {
				customerRecord.presetFocus = profileFocusPreset(currentProfile());
			}
			saveNow();
			renderAll();
			openProfilesModal();
			notify('Question set deleted.', 'success');
		});
	}


	function onModalBodyClick(event) {
		var target = event.target;
		if (!target || typeof target.closest !== 'function') return;
		var useButton = target.closest('[data-profile-use]');
		if (useButton) {
			selectProfile(useButton.getAttribute('data-profile-use'));
			closeModal();
			return;
		}
		var duplicateButton = target.closest('[data-profile-duplicate]');
		if (duplicateButton) {
			duplicateProfile(duplicateButton.getAttribute('data-profile-duplicate'));
			return;
		}
		var editButton = target.closest('[data-profile-edit]');
		if (editButton) {
			openProfilesJsonModal();
			return;
		}
		var deleteButton = target.closest('[data-profile-delete]');
		if (deleteButton) requestDeleteProfile(deleteButton.getAttribute('data-profile-delete'));
	}

	function onDocumentKeydown(event) {
		if (event.key !== 'Escape') return;
		var modalOverlay = document.getElementById('cp-modal-overlay');
		if (modalOverlay && modalOverlay.classList.contains('open')) {
			closeModal();
			return;
		}
		if (isShareDrawerOpen()) {
			closeShareDrawer();
			return;
		}
		closeActionsMenu();
	}

	/* ── Export ── */
	function buildExportData() {
		var copy = JSON.parse(JSON.stringify(snapshotForValue()));
		copy.exportedAt = nowISO();
		copy.exportedFrom = 'CustomerProfile';
		copy.displayName = customerDisplayName();
		copy.profileName = currentProfile() ? currentProfile().name : '';
		copy.questionSetNames = currentProfiles().map(function (profile) { return profile.name; });
		return copy;
	}

	function fileNameForCustomer() {
		var nameSlug = slugify(customerDisplayName());
		return 'customer-' + (nameSlug || 'profile');
	}

	function copyTextAsync(text, successMessage) {
		var copied = copyTextWithSelection(text);
		if (copied) {
			notify(successMessage, 'success');
			return;
		}
		if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function () { notify(successMessage, 'success'); }, function () {
				notify('Copying is blocked here. Select the preview text and copy it manually.', 'warning');
			});
			return;
		}
		notify('Copying is blocked here. Select the preview text and copy it manually.', 'warning');
	}

	function copyTextWithSelection(text) {
		var area = null;
		try {
			area = document.createElement('textarea');
			area.value = text;
			area.setAttribute('readonly', 'readonly');
			area.style.position = 'fixed';
			area.style.top = '-1000px';
			area.style.left = '-1000px';
			document.body.appendChild(area);
			area.select();
			if (area.setSelectionRange) area.setSelectionRange(0, text.length);
			var copied = document.execCommand('copy');
			document.body.removeChild(area);
			return !!copied;
		} catch (error) {
			if (area && area.parentNode) area.parentNode.removeChild(area);
			return false;
		}
	}

	function downloadJson() {
		try {
			var text = JSON.stringify(buildExportData(), null, 2);
			var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
			var url = URL.createObjectURL(blob);
			var link = document.createElement('a');
			link.href = url;
			link.download = fileNameForCustomer() + '.json';
			document.body.appendChild(link);
			link.click();
			setTimeout(function () {
				try {
					document.body.removeChild(link);
					URL.revokeObjectURL(url);
				} catch (error) { }
			}, 300);
			notify('JSON download started.', 'success');
		} catch (error) {
			notify('Download failed in this browser.', 'error');
		}
	}

	function buildPrintableHtml() {
		var sections = buildSections();
		var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5;padding:8px 4px">' +
			'<h1 style="font-size:22px;margin:0 0 4px">' + esc(customerDisplayName()) + '</h1>' +
			'<p style="font-size:12px;color:#5b6a83;margin:0 0 22px">' +
				esc(typeAndProfileLabel()) +
				' - Generated ' + esc(nowISO().slice(0, 10)) +
			'</p>';

		sections.forEach(function (section) {
			var content = '';
			if (section.kind === 'lists') {
				(section.lists || []).forEach(function (listKey) {
					var definition = LIST_DEFINITIONS[listKey];
					var rows = (customerRecord.lists[listKey] || []).filter(definition.hasContent);
					if (!rows.length) return;
					content += '<h3 style="font-size:12px;margin:12px 0 6px;color:#475569">' + esc(definition.title) + '</h3>';
					content += '<table style="width:100%;border-collapse:collapse;margin:0 0 12px;font-size:11px"><tbody>';
					rows.forEach(function (row) {
						content += '<tr>' + definition.fields.map(function (field) {
							return '<td style="padding:5px 7px;border:1px solid #dfe5ef;vertical-align:top">' + esc(row[field.id] || '-') + '</td>';
						}).join('') + '</tr>';
					});
					content += '</tbody></table>';
				});
			} else {
				var rowsHtml = '';
				if (section.kind === 'basic') {
					var fields = [];
					if (customerRecord.customerType === 'company') {
						fields = [
							['Legal company name', customerRecord.values.core_legalName],
							['Trade name', customerRecord.values.core_tradeName],
							['Registration number', customerRecord.values.core_registrationNumber],
							['Tax / VAT number', customerRecord.values.core_taxNumber]
						];
					} else {
						fields = [
							['First name', customerRecord.values.core_firstName],
							['Last name', customerRecord.values.core_lastName],
							['Preferred name', customerRecord.values.core_preferredName],
							['Job title', customerRecord.values.core_jobTitle]
						];
					}
					fields = fields.concat([
						['Status', customerRecord.values.core_status],
						['Priority', customerRecord.values.core_priority],
						['Source', customerRecord.values.core_source],
						['Account owner', customerRecord.values.core_owner],
						['Customer since', customerRecord.values.core_since],
						['Next follow-up', customerRecord.values.core_nextFollowUp],
						['Tags', customerRecord.values.core_tags]
					]);
					fields.forEach(function (pair) {
						var value = Array.isArray(pair[1]) ? pair[1].join(', ') : pair[1];
						if (value === null || value === undefined || String(value).trim() === '') return;
						rowsHtml += '<tr><th style="text-align:left;padding:5px 7px;border:1px solid #dfe5ef;background:#f5f7fb;width:34%">' + esc(pair[0]) + '</th><td style="padding:5px 7px;border:1px solid #dfe5ef">' + esc(value) + '</td></tr>';
					});
				} else if (section.kind === 'contact') {
					['emails', 'phones'].forEach(function (listKey) {
						var definition = LIST_DEFINITIONS[listKey];
						var values = (customerRecord.lists[listKey] || []).filter(definition.hasContent);
						if (!values.length) return;
						rowsHtml += '<tr><th style="text-align:left;padding:5px 7px;border:1px solid #dfe5ef;background:#f5f7fb;width:34%">' + esc(definition.title) + '</th><td style="padding:5px 7px;border:1px solid #dfe5ef">' +
							values.map(function (row) { return esc([row.label, row.value].filter(Boolean).join(': ')); }).join('<br>') + '</td></tr>';
					});
				} else {
					(section.fields || []).forEach(function (field) {
						var value = customerRecord.values[field.id];
						if (field.type === 'checkbox') {
							if (value === true) rowsHtml += '<tr><th style="text-align:left;padding:5px 7px;border:1px solid #dfe5ef;background:#f5f7fb;width:34%">' + esc(field.label) + '</th><td style="padding:5px 7px;border:1px solid #dfe5ef">Yes</td></tr>';
							return;
						}
						if (Array.isArray(value)) value = value.join(', ');
						if (value === null || value === undefined || String(value).trim() === '') return;
						rowsHtml += '<tr><th style="text-align:left;padding:5px 7px;border:1px solid #dfe5ef;background:#f5f7fb;width:34%">' + esc(field.label) + '</th><td style="padding:5px 7px;border:1px solid #dfe5ef">' + esc(value) + '</td></tr>';
					});
				}
				if (rowsHtml) content = '<table style="width:100%;border-collapse:collapse;margin:0 0 12px;font-size:11px"><tbody>' + rowsHtml + '</tbody></table>';
			}
			if (!content) return;
			html += '<section style="margin:0 0 18px;page-break-inside:avoid"><h2 style="font-size:14px;margin:0 0 6px;color:#0f172a">' + esc(section.title) + '</h2>' + content + '</section>';
		});

		html += '<p style="font-size:10px;color:#98a4b8;margin-top:24px;border-top:1px solid #e3e9f3;padding-top:8px">Customer Profile - tool build ' + esc(TOOL_BUILD) + '</p></div>';
		return html;
	}

	function exportPrintable() {
		if (typeof tool.requestExportPdf !== 'function') {
			notify('Printable export is not available in this host.', 'warning');
			return;
		}
		try {
			tool.requestExportPdf({ html: buildPrintableHtml(), filename: fileNameForCustomer() }, function (error, file) {
				if (error || !file) {
					notify('Export failed: ' + (error || 'no file was returned'), 'error');
					return;
				}
				notify('Printable summary created.', 'success');
				if (file.url && typeof tool.openUrl === 'function') tool.openUrl(file.url);
			});
		} catch (error) {
			notify('Export failed in this browser.', 'error');
		}
	}

	/* ── Wire up ── */
	function wireStatic() {
		injectStaticIcons();
		var root = document.getElementById('app');
		if (root) {
			root.addEventListener('click', onRootClick);
			root.addEventListener('input', onRootInput);
			root.addEventListener('change', onRootChange);
			root.addEventListener('keydown', onRootKeydown);
		}
		var modalClose = document.getElementById('cp-modal-close');
		if (modalClose) modalClose.addEventListener('click', closeModal);
		var overlay = document.getElementById('cp-modal-overlay');
		if (overlay) {
			overlay.addEventListener('click', function (event) {
				if (event.target === overlay) closeModal();
			});
		}
		var modalBody = document.getElementById('cp-modal-body');
		if (modalBody) modalBody.addEventListener('click', onModalBodyClick);
		var drawerClose = document.getElementById('cp-drawer-close');
		if (drawerClose) drawerClose.addEventListener('click', closeShareDrawer);
		var drawerOverlay = document.getElementById('cp-drawer-overlay');
		if (drawerOverlay) drawerOverlay.addEventListener('click', closeShareDrawer);
		document.addEventListener('click', function (event) {
			if (!event.target || typeof event.target.closest !== 'function') return;
			if (!event.target.closest('.cp-actions')) closeActionsMenu();
		});
		document.addEventListener('keydown', onDocumentKeydown);
	}

	/* ── Declarations ── */
	function declareParamsSafely() {
		try {
			tool.declareParams([
				{ name: 'defaultCustomerType', label: 'Default customer type', type: 'select', default: 'person', severity: 'optional', hint: 'Used when a new customer record is opened. Values: person or company.' },
				{ name: 'defaultProfileKey', label: 'Default question set keys', type: 'text', default: '', severity: 'optional', hint: 'Pre-selects one or more question sets for a new record, for example company-account or company-account, support-sla. Use commas for a combination.' },
				{ name: 'profileDefinitions', label: 'Question set definitions (JSON)', type: 'text', default: '', severity: 'goodToHave', hint: 'Array of additional question sets shared by every customer of this app. Open the question set library and use Load example to see the exact shape.' },
				{ name: 'statusOptions', label: 'Status options', type: 'text', default: '', severity: 'optional', hint: 'Comma-separated status list. Default: Lead, Prospect, Active, Dormant, Inactive, Blocked.' },
				{ name: 'sourceOptions', label: 'Source options', type: 'text', default: '', severity: 'optional', hint: 'Comma-separated list of how customers reach you. A default list is used when empty.' },
				{ name: 'showInteractions', label: 'Show interactions log', type: 'toggle', default: 'yes', severity: 'optional', hint: 'Adds a simple interaction log to every customer profile. Set to no to hide it.' },
				{ name: 'allowExportPdf', label: 'Allow printable export', type: 'toggle', default: 'no', severity: 'goodToHave', hint: 'Requires allowExportPdf: yes on this html-tool field. The JSON export works without it.' }
			]);
		} catch (error) { }
	}

	function declareOutputSafely() {
		try {
			tool.declareOutput({
				type: 'object',
				description: 'One customer profile with selected question sets and focus areas',
				properties: {
					version: { type: 'number' },
					customerType: { type: 'string', description: 'person or company' },
					profileKey: { type: 'string' },
					profileKeys: { type: 'array', description: 'Selected question set keys (one or more)' },
					focus: { type: 'array', description: 'Focus area ids that decide which extra sections are visible' },
					presetFocus: { type: 'array' },
					showAllSections: { type: 'boolean' },
					values: { type: 'object', description: 'Field id to value map' },
					lists: { type: 'object', description: 'emails, phones, addresses, contacts, interactions' },
					customProfiles: { type: 'array', description: 'Question set definitions stored with this record' },
					ui: { type: 'object', description: 'theme' },
					meta: { type: 'object' }
				}
			});
		} catch (error) { }
	}

	/* ── Boot ── */
	tool.onReady(function (value) {
		console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' CustomerProfile starting...');

		var appNode = document.getElementById('app');
		if (appNode) appNode.setAttribute('data-tool-build', TOOL_BUILD);

		buildBuiltInProfiles();
		loadSettingsProfiles();
		declareParamsSafely();
		declareOutputSafely();

		try { isReadOnly = !!tool.isReadOnly(); } catch (error) { isReadOnly = false; }
		currentUser = getUserSafe();

		if (isObject(value)) hydrateValue(value);
		else initializeNewRecord();

		applyTheme();
		wireStatic();
		renderAll();
		setSaveState('saved');

		tool.onReadonlyChange(function (readOnlyValue) {
			isReadOnly = !!readOnlyValue;
			renderAll();
		});
		tool.onUserChange(function (user) {
			currentUser = user || getUserSafe();
			if (currentUser) noIdentityMode = false;
			renderAll();
		});
		tool.onValueChange(function (nextValue) {
			handleExternalValue(nextValue);
		});
		if (typeof tool.onPermittedUsersChange === 'function') {
			try {
				tool.onPermittedUsersChange(function () {
					if (locked()) return;
					renderAll();
				});
			} catch (error) { }
		}

		startUserPolling();
		startHydrationPolling();
		resize();
	});
})();

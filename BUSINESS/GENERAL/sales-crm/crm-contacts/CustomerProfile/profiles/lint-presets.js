/* Lint preset configs against the CustomerProfile runtime expectations. */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const builtIn = new Set(['customer-basics', 'person-basic', 'person-business', 'company-basic', 'company-account', 'software-discovery', 'software-implementation', 'saas-subscription', 'support-sla', 'procurement-onboarding', 'renewal-expansion', 'stakeholders-relationship', 'loyalty-member']);
const icons = new Set(['user', 'building', 'mail', 'phone', 'pin', 'users', 'note', 'activity', 'briefcase', 'star', 'shield', 'tag', 'layers', 'card', 'globe', 'calendar', 'plus', 'trash', 'check', 'x', 'chevron', 'chevronLeft', 'chevronRight', 'download', 'copy', 'share', 'warning', 'pencil', 'sun', 'moon', 'more', 'server', 'code', 'cart', 'factory', 'hardHat', 'truck', 'heart']);
const fieldTypes = new Set(['text', 'textarea', 'number', 'date', 'email', 'phone', 'url', 'select', 'multiselect', 'checkbox', 'tags']);
const personFields = new Set(['core_firstName', 'core_lastName', 'core_preferredName', 'core_jobTitle']);
const companyFields = new Set(['core_legalName', 'core_tradeName', 'core_registrationNumber', 'core_taxNumber']);
const adminFields = new Set(['core_status', 'core_priority', 'core_source', 'core_owner', 'core_since', 'core_nextFollowUp']);
let problems = 0;
function problem(file, message) { problems++; console.error('BAD ' + file + ': ' + message); }
for (const file of fs.readdirSync(dir).filter(function (name) { return name.endsWith('.json') && name !== 'profile-config.schema.json' && name !== 'index.json'; })) {
	const config = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
	const definitions = new Set();
	(config.definitions || []).forEach(function (set) {
		if (definitions.has(set.key)) problem(file, 'duplicate definition key ' + set.key);
		definitions.add(set.key);
		const sectionIds = new Set();
		(set.sections || []).forEach(function (section) {
			if (sectionIds.has(section.id)) problem(file, 'duplicate section id ' + section.id + ' in ' + set.key);
			sectionIds.add(section.id);
			const fieldIds = new Set();
			(section.fields || []).forEach(function (field) {
				if (fieldIds.has(field.id)) problem(file, 'duplicate field id ' + field.id + ' in ' + set.key + '/' + section.id);
				fieldIds.add(field.id);
				if (!fieldTypes.has(field.type)) problem(file, 'bad field type ' + field.type + ' for ' + field.id);
				if ((field.type === 'select' || field.type === 'multiselect') && (!Array.isArray(field.options) || !field.options.length)) problem(file, 'missing options for ' + field.id);
			});
		});
	});
	const keys = new Set();
	(config.segments || []).forEach(function (segment) {
		if (keys.has(segment.key)) problem(file, 'duplicate segment key ' + segment.key);
		keys.add(segment.key);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment.key)) problem(file, 'bad segment key ' + segment.key);
		if (segment.icon && !icons.has(segment.icon)) problem(file, 'unknown icon ' + segment.icon + ' in ' + segment.key);
		const fieldIds = segment.baseType === 'company' ? companyFields : personFields;
		(segment.nameFieldIds || []).forEach(function (id) { if (!fieldIds.has(id)) problem(file, 'nameFieldIds mismatch for ' + segment.key + ': ' + id); });
		(segment.adminFieldIds || []).forEach(function (id) { if (!adminFields.has(id)) problem(file, 'adminFieldIds mismatch for ' + segment.key + ': ' + id); });
		const refs = [].concat(segment.profileKeys || [], segment.allowedProfileKeys || []);
		refs.forEach(function (key) {
			if (!builtIn.has(key) && !definitions.has(key)) problem(file, 'unknown question-set key ' + key + ' in segment ' + segment.key);
		});
		if (!segment.allowProfileSelection && !(segment.profileKeys || []).length && !(segment.allowedProfileKeys || []).length) problem(file, 'fixed segment has no form: ' + segment.key);
	});
	if (!keys.has(config.defaultSegmentKey)) problem(file, 'defaultSegmentKey not found: ' + config.defaultSegmentKey);
}
console.log(problems ? ('Preset lint failed: ' + problems + ' problem(s)') : 'Preset lint passed');
process.exitCode = problems ? 1 : 0;

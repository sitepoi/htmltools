// Quick load test
document.getElementById('agreementPage').innerHTML = '<div style=\"padding:20px;text-align:center;color:#1a2a4a;font-family:sans-serif;\"><p>Loading agreement template...</p></div>';

/* ═══════════════════════════════════════════════
   COMPANY TEMPLATE — Copy-paste this block to configure
   a different organization. All fields are editable
   in the document as well.
   ═══════════════════════════════════════════════ */
var COMPANY = {
	name: (typeof tool !== 'undefined' ? tool.param('companyName', 'CentreCanada Newcomer Services Society') : 'CentreCanada Newcomer Services Society'),
	address: (typeof tool !== 'undefined' ? tool.param('companyAddress', '93 6th Street, New Westminster, BC') : '93 6th Street, New Westminster, BC'),
	regLabel: (typeof tool !== 'undefined' ? tool.param('regLabel', 'CRA #') : 'CRA #'),
	regNumber: (typeof tool !== 'undefined' ? tool.param('regNumber', '76991 3880 RR0001') : '76991 3880 RR0001'),
	website: (typeof tool !== 'undefined' ? tool.param('website', 'centrecanada.org') : 'centrecanada.org'),
	logoPath: (typeof tool !== 'undefined' ? tool.param('logoPath', './logo.png') : './logo.png'),
	province: (typeof tool !== 'undefined' ? tool.param('province', 'British Columbia') : 'British Columbia'),
	provinceCode: (typeof tool !== 'undefined' ? tool.param('provinceCode', 'BC') : 'BC'),
	typeLabel: (typeof tool !== 'undefined' ? tool.param('typeLabel', 'Registered Canadian Charity') : 'Registered Canadian Charity')
};

/* Default values that pre-fill editable company fields in the document */
var COMPANY_DEFAULTS = {
	companyName: COMPANY.name,
	companyAddress: COMPANY.address,
	companyRegNumber: COMPANY.regNumber,
	companyRegLabel: COMPANY.regLabel,
	companyWebsite: COMPANY.website,
	companyTypeLabel: COMPANY.typeLabel,
	companyProvince: COMPANY.province
};

/* ── Declare tool parameters for CMS admin configuration ── */
try {
	tool.declareParams([
		{ name: 'companyName', label: 'Company Name', type: 'text', default: 'CentreCanada Newcomer Services Society', severity: 'mandatory', hint: 'Legal name of the organization as it should appear on agreements' },
		{ name: 'companyAddress', label: 'Company Address', type: 'text', default: '93 6th Street, New Westminster, BC', severity: 'mandatory', hint: 'Main business address' },
		{ name: 'regLabel', label: 'Registration Label', type: 'text', default: 'CRA #', severity: 'optional', hint: 'Label for the registration number field (e.g. CRA #, BN #, Registration #)' },
		{ name: 'regNumber', label: 'Registration Number', type: 'text', default: '76991 3880 RR0001', severity: 'optional', hint: 'Charity or business registration number' },
		{ name: 'website', label: 'Website', type: 'text', default: 'centrecanada.org', severity: 'optional', hint: 'Company website URL (without https://)' },
		{ name: 'logoPath', label: 'Logo Image URL', type: 'text', default: '', severity: 'goodToHave', hint: 'URL to the company logo image. Upload a logo using the \'Upload Logo\' button in the toolbar, then copy the URL here. Also used as the watermark/filigree background.' },
		{ name: 'province', label: 'Province / Territory', type: 'text', default: 'British Columbia', severity: 'mandatory', hint: 'Province or territory whose employment standards govern this agreement' },
		{ name: 'provinceCode', label: 'Province Code', type: 'text', default: 'BC', severity: 'optional', hint: 'Two-letter province/territory code (e.g. BC, ON, AB, QC)' },
		{ name: 'typeLabel', label: 'Organization Type', type: 'text', default: 'Registered Canadian Charity', severity: 'optional', hint: 'e.g. Registered Canadian Charity, Incorporated Business, Non-Profit Society' }
	]);
} catch (e) { console.log('declareParams not available'); }

/* ── Declare output schema ── */
try {
	tool.declareOutput({
		type: 'object',
		description: 'Employment agreement data including all fillable fields, rich text content, signatures (base64 PNG), and compensation period',
		properties: {
			agreementDate: { type: 'string', description: 'ISO date of agreement execution' },
			docRef: { type: 'string', description: 'Internal document reference number' },
			companyName: { type: 'string' }, companyAddress: { type: 'string' },
			companyRegLabel: { type: 'string' }, companyRegNumber: { type: 'string' },
			companyWebsite: { type: 'string' }, companyTypeLabel: { type: 'string' },
			companyProvince: { type: 'string' },
			employeeName: { type: 'string' }, employeeAddress: { type: 'string' }, employeeCity: { type: 'string' },
			positionTitle: { type: 'string' }, employmentType: { type: 'string' }, reportsTo: { type: 'string' },
			startDate: { type: 'string' }, probationMonths: { type: 'string' },
			workLocation: { type: 'string' }, travelReqs: { type: 'string' },
			salaryAmount: { type: 'string' }, compDetails: { type: 'string' }, payFrequency: { type: 'string' },
			salaryReview: { type: 'string' }, expensePolicy: { type: 'string' },
			empSignName: { type: 'string' }, empSignTitle: { type: 'string' }, empSignDate: { type: 'string' },
			eeSignName: { type: 'string' }, eeSignDate: { type: 'string' },
			_compPeriod: { type: 'string', enum: ['hourly','weekly','biweekly','monthly','annually'] },
			_signatures: { type: 'object', description: 'Base64-encoded PNG signatures keyed by canvas element ID (sigEmployer, sigEmployee, initialsEmployer, initialsEmployee)' },
			rt_roleOverview: { type: 'string', description: 'Rich text HTML for role overview' },
			rt_probationNote: { type: 'string' }, rt_dutiesBlock: { type: 'string' },
			rt_locationHoursBlock: { type: 'string' }, rt_benefitsBlock: { type: 'string' },
			rt_vacationBlock: { type: 'string' }, rt_confidentialityBlock: { type: 'string' },
			rt_policiesBlock: { type: 'string' }, rt_terminationBlock: { type: 'string' },
			rt_generalBlock: { type: 'string' }
		}
	});
} catch (e) { console.log('declareOutput not available'); }

/* ═══════════════════════════════════════════════
   AGREEMENT DATA — All content lives here
   ═══════════════════════════════════════════════ */
var AGREEMENT = {
	meta: {
		title: 'Employment Agreement',
		refPrefix: 'CC-EMP-2026',
		year: '2026'
	},
	sections: [
		{
			id: 'sec-parties', title: '1. Parties to This Agreement', type: 'parties',
			preamble: 'This Employment Agreement (the "<strong>Agreement</strong>") is made and entered into as of the date set out below, by and between:',
			dateField: { key: 'agreementDate', type: 'date', label: 'Agreement Date' },
			employee: {
				label: 'Employee', fields: [
					{ key: 'employeeName', type: 'text', placeholder: 'Full Legal Name', cls: 'party-name', hint: 'Enter full legal name as it appears on government ID' },
					{ key: 'employeeAddress', type: 'text', placeholder: 'Street Address', cls: 'party-detail', hint: 'Street number, name, and apartment/unit' },
					{ key: 'employeeCity', type: 'text', placeholder: 'City, Province, Postal Code', cls: 'party-detail', hint: 'e.g. New Westminster, BC  V3M 1A1' }
				]
			}
		},
		{
			id: 'sec-position', title: '2. Position, Term, and Reporting Structure', type: 'detail-table',
			rows: [
				{ label: 'Position Title', key: 'positionTitle', type: 'text', placeholder: 'e.g. Director of Women\'s Programs', hint: 'Official position title as approved by the Board' },
				{ label: 'Employment Type', key: 'employmentType', type: 'text', placeholder: 'e.g. Full-Time, Permanent', hint: 'Full-Time / Part-Time + Permanent / Contract / Fixed-Term' },
				{ label: 'Reports To', key: 'reportsTo', type: 'text', placeholder: 'e.g. Executive Leadership / Board of Directors', hint: 'Position or body this role reports to' },
				{ label: 'Start Date', key: 'startDate', type: 'date' },
				{ label: 'Probationary Period', key: 'probationMonths', type: 'number', suffix: 'months from the Start Date', placeholder: '3', hint: 'Number of months' },
				{ label: 'Primary Work Location', key: 'workLocation', type: 'text', placeholder: '93 6th Street, New Westminster, BC', hint: 'Main office or work address' },
				{ label: 'Field / Community Travel', key: 'travelReqs', type: 'text', placeholder: 'e.g. Various locations in Metro Vancouver', hint: 'Describe any travel requirements' }
			],
			overview: { key: 'roleOverview', type: 'richtext', content: '<p>Describe the position and its significance to the organization.</p>' },
			probationNote: { key: 'probationNote', type: 'richtext', content: '<p>The first <strong>3 months</strong> of employment shall constitute a probationary period. During this period, either Party may terminate this Agreement by providing <strong>1 week</strong> of written notice. Upon successful completion, employment shall be confirmed in writing.</p>' }
		},
		{
			id: 'sec-duties', title: '3. Duties and Responsibilities', type: 'richtext-block',
			intro: 'The Employee shall perform the following duties, and any other duties reasonably assigned by the Employer:',
			block: { key: 'dutiesBlock', content: '<h3>3.1 Duty Area 1</h3><ul><li>Responsibility detail</li><li>Responsibility detail</li></ul><h3>3.2 Duty Area 2</h3><ul><li>Responsibility detail</li><li>Responsibility detail</li></ul>' }
		},
		{
			id: 'sec-compensation', title: '4. Compensation', type: 'compensation',
			intro: 'The Employer agrees to compensate the Employee as follows:',
			salaryField: { key: 'salaryAmount', type: 'number', placeholder: 'XX,XXX', hint: 'Gross amount before deductions' },
			compDetailField: { key: 'compDetails', type: 'richtext-inline', value: 'Annual gross salary, commensurate with experience' },
			payFrequencyField: { key: 'payFrequency', type: 'text', placeholder: 'bi-weekly', hint: 'e.g. bi-weekly, semi-monthly, monthly' },
			extraRows: [
				{ label: 'Salary Review', key: 'salaryReview', type: 'text', placeholder: 'e.g. Annually by the Board of Directors', hint: 'Describe review process and frequency' },
				{ label: 'Expense Reimbursement', key: 'expensePolicy', type: 'text', placeholder: 'Reasonable expenses reimbursed per policy', hint: 'Describe expense reimbursement terms' }
			]
		},
		{
			id: 'sec-location', title: '5. Work Location, Travel, and Hours of Work', type: 'richtext-block',
			block: { key: 'locationHoursBlock', content: '<h3>5.1 Work Location</h3><p>The Employee\'s primary workplace shall be at the Employer\'s office. The Employee acknowledges that this position may require regular field and community travel.</p><h3>5.2 Hours of Work</h3><p>The standard work week shall consist of <strong>37.5 hours</strong> per week, Monday through Friday. Flexibility may be required for events and community engagement.</p>' }
		},
		{
			id: 'sec-benefits', title: '6. Benefits', type: 'richtext-block',
			block: { key: 'benefitsBlock', content: '<p>The Employee shall be eligible to participate in the Employer\'s benefits package following successful completion of the Probationary Period. The benefits package may include:</p><ul><li>Extended health and dental coverage;</li><li>Life insurance and AD&amp;D coverage;</li><li>RRSP contributions or matching, if offered;</li><li>Professional development and training allowance.</li></ul><p>The Employer reserves the right to modify, amend, or terminate any benefit plan at its discretion.</p>' }
		},
		{
			id: 'sec-vacation', title: '7. Vacation, Holidays, and Leave', type: 'richtext-block',
			block: { key: 'vacationBlock', content: '<h3>7.1 Vacation</h3><p>The Employee shall be entitled to <strong>15 paid vacation days</strong> per calendar year, pro-rated for partial years. Vacation accrues monthly and must be taken at mutually agreed times. Unused vacation may be carried forward up to <strong>5 days</strong> per year.</p><h3>7.2 Statutory Holidays</h3><p>The Employee shall be entitled to all statutory holidays observed in the Province of British Columbia, in accordance with the <em>Employment Standards Act</em> (British Columbia).</p><h3>7.3 Sick Leave and Other Leaves</h3><p>The Employee shall be entitled to sick leave and other leaves of absence in accordance with the <em>Employment Standards Act</em> (British Columbia) and the Employer\'s policies.</p>' }
		},
		{
			id: 'sec-confidentiality', title: '8. Confidentiality, Privacy, and Intellectual Property', type: 'richtext-block',
			block: { key: 'confidentialityBlock', content: '<h3>8.1 Confidential Information</h3><p>The Employee acknowledges access to confidential information including participant records, financial data, strategic plans, and internal policies. The Employee agrees to hold all such information in strict confidence.</p><h3>8.2 Privacy Compliance</h3><p>The Employee shall comply with all applicable privacy legislation, including the <em>Personal Information Protection Act</em> (British Columbia).</p><h3>8.3 Intellectual Property</h3><p>All work product created by the Employee shall be the exclusive property of the Employer.</p><h3>8.4 Survival</h3><p>These obligations shall survive termination of this Agreement.</p>' }
		},
		{
			id: 'sec-policies', title: '9. Organizational Policies and Code of Conduct', type: 'richtext-block',
			block: { key: 'policiesBlock', content: '<p>The Employee agrees to comply with all policies, procedures, and codes of conduct adopted by the Employer, including:</p><ul><li>Safeguarding and vulnerable persons policies;</li><li>Anti-harassment and anti-discrimination policies;</li><li>Workplace health and safety policies;</li><li>Privacy and data protection policies;</li><li>Conflict of interest policies;</li><li>Social media and communications policies.</li></ul><p>Compliance is a condition of continued employment.</p>' }
		},
		{
			id: 'sec-termination', title: '10. Termination of Employment', type: 'richtext-block',
			block: { key: 'terminationBlock', content: '<h3>10.1 Termination Without Cause</h3><p>The Employer may terminate employment without cause by providing written notice in accordance with the <em>Employment Standards Act</em> (British Columbia), plus additional notice or severance as determined.</p><h3>10.2 Termination With Cause</h3><p>The Employer may terminate for cause without notice in the event of gross misconduct, dishonesty, fraud, willful breach, or serious neglect of duties.</p><h3>10.3 Resignation</h3><p>The Employee may resign by providing <strong>4 weeks</strong> of written notice.</p><h3>10.4 Return of Property</h3><p>Upon termination, the Employee shall promptly return all Employer property.</p>' }
		},
		{
			id: 'sec-general', title: '11. General Provisions', type: 'richtext-block',
			block: { key: 'generalBlock', content: '<ul><li><strong>Governing Law:</strong> This Agreement shall be governed by the laws of the Province of British Columbia and applicable federal laws of Canada.</li><li><strong>Entire Agreement:</strong> This Agreement constitutes the entire agreement between the Parties.</li><li><strong>Severability:</strong> If any provision is held invalid, remaining provisions continue in force.</li><li><strong>Amendment:</strong> No modification unless in writing and signed by both Parties.</li><li><strong>Waiver:</strong> Failure to enforce any provision shall not constitute a waiver.</li><li><strong>Independent Legal Advice:</strong> The Employee acknowledges the opportunity to seek independent legal advice.</li><li><strong>Survival:</strong> Sections 8, 9, and 11 shall survive termination.</li></ul>' }
		},
		{
			id: 'sec-signatures', title: '12. Execution', type: 'signatures',
			preamble: 'IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.',
			employer: { label: 'For the Employer', canvasId: 'sigEmployer', nameKey: 'empSignName', titleKey: 'empSignTitle', dateKey: 'empSignDate' },
			employee: { label: 'For the Employee', canvasId: 'sigEmployee', nameKey: 'eeSignName', dateKey: 'eeSignDate' }
		}
	],
	summaryFields: [
		{ label: 'Employee Name', source: 'employeeName' },
		{ label: 'Position', source: 'positionTitle' },
		{ label: 'Start Date', source: 'startDate' },
		{ label: 'Employment Type', source: 'employmentType' },
		{ label: 'Salary', source: 'salaryAmount', prefix: '$', suffix: ' CAD' },
		{ label: 'Probation', source: 'probationMonths', suffix: ' months' },
		{ label: 'Reports To', source: 'reportsTo' },
		{ label: 'Work Location', source: 'workLocation' }
	]
};

/* ═══════════════════════════════════════════════
   RENDER ENGINE + INTERACTIONS
   ═══════════════════════════════════════════════ */
var quill = null, activeRichTextEl = null, highlightsOn = true, readOnly = false, compPeriod = 'annually', fieldValues = {}, eventsBound = false, _rendering = false, _resizeTimer = 0, _suppressResize = false, _suppressReload = false;

/* ── Build an input field ──────────────────── */
function inputHTML(key, type, opts) {
	opts = opts || {};
	var val = fieldValues[key] || '';
	var ph = opts.placeholder || '';
	var cls = 'doc-input';
	if (opts.wide) cls += ' wide';
	if (type === 'number') cls += ' short';
	var h = '<span class="input-wrap">';
	if (type === 'text') {
		h += '<span class="' + cls + '" contenteditable="true" data-key="' + key + '" data-placeholder="' + ph + '">' + val + '</span>';
	} else {
		h += '<input type="' + type + '" class="' + cls + '" data-key="' + key + '" placeholder="' + ph + '" value="' + val + '">';
	}
	if (opts.hint) h += '<span class=\"field-help\" data-hint=\"' + opts.hint.replace(/\"/g, '&quot;') + '\" onclick=\"showHelp(this)\" title=\"Click for help\">?</span>';
	h += '</span>';
	if (opts.hint) h += '<div class="field-hint" data-for="' + key + '"' + (val ? ' style="display:none"' : '') + '>' + opts.hint + '</div>';
	return h;
}

/* ── Render Document ───────────────────────── */
function renderDocument() {
	if (_rendering) return;
	_rendering = true;
	var page = document.getElementById('agreementPage');
	var C = COMPANY, m = AGREEMENT.meta;
	// Logo: per-document upload > JSON paste > tool param
	var logoUrl = fieldValues._logoUrl || fieldValues.logoPath || C.logoPath;
	var html = '<div class="watermark-layer"></div>';
	html += '<div class="doc-header">';
	html += '<img class="logo-img" src="' + logoUrl + '" alt="Logo" onerror="this.style.display=\'none\'" onload="this.style.display=\'block\'">';
	html += '<div class="org-name">' + inputHTML('companyName', 'text', { placeholder: 'Company Name', hint: 'Legal name of the organization', wide: true }) + '</div>';
	html += '<div class="org-sub">' + inputHTML('companyTypeLabel', 'text', { placeholder: 'Registered Canadian Charity', hint: 'e.g. Registered Canadian Charity, Incorporated Business' }) + ' &bull; ' + inputHTML('companyRegLabel', 'text', { placeholder: 'CRA #' }) + inputHTML('companyRegNumber', 'text', { placeholder: 'Registration Number', hint: 'CRA charity number or business registration number' }) + '</div>';
	html += '<div class="org-sub">' + inputHTML('companyAddress', 'text', { placeholder: 'Address', hint: 'Main business address', wide: true }) + ' &bull; ' + inputHTML('companyWebsite', 'text', { placeholder: 'website.com', hint: 'Company website URL' }) + '</div>';
	html += '<h1>' + m.title + '</h1>';
	html += '<div class="doc-meta"><span class="input-wrap"><span class="tpl-inline" contenteditable="true" data-key="positionTitle" data-placeholder="Position Title">' + (fieldValues.positionTitle || 'Position Title') + '</span><span class="field-help" data-hint="Official position title as approved by the Board" onclick="showHelp(this)">?</span></span> &bull; <span class="input-wrap"><input class="doc-input" data-key="employmentType" placeholder="Full-Time, Permanent" value="' + (fieldValues.employmentType || '') + '" list="employmentOptions"><datalist id="employmentOptions"><option value="Full-Time, Permanent"><option value="Full-Time, Contract"><option value="Part-Time, Permanent"><option value="Part-Time, Contract"><option value="Contractor / Freelance"><option value="Volunteer"><option value="Internship"><option value="Fixed-Term"><option value="Casual / On-Call"></datalist><span class="field-help" data-hint="Choose from list or type your own. Options: Full-Time, Part-Time, Contractor, Volunteer, etc." onclick="showHelp(this)">?</span></span> &bull; ' + m.year + '</div>';
	html += '<div class="doc-ref">Ref: <span class="input-wrap"><span class="tpl-inline" contenteditable="true" data-key="docRef" data-placeholder="CC-EMP-2026-XXX-001">' + (fieldValues.docRef || 'CC-EMP-2026-XXX-001') + '</span><span class="field-help" data-hint="Internal document reference number for tracking" onclick="showHelp(this)">?</span></span></div></div>';

	AGREEMENT.sections.forEach(function (sec) {
		html += '<section id="' + sec.id + '" class="page-section"><h2>' + sec.title + '</h2>';
		if (sec.type === 'parties') {
			html += '<p>' + sec.preamble + '</p><p><input type="date" class="doc-input" data-key="' + sec.dateField.key + '" value="' + (fieldValues[sec.dateField.key] || '') + '"></p>';
			html += '<div class="parties-grid">';
			html += '<div class="party-card"><h3>Employer</h3><div class="party-name">' + inputHTML('companyName', 'text', { placeholder: 'Company Name', hint: 'Legal name of the organization' }) + '</div><div class="party-detail">' + inputHTML('companyAddress', 'text', { placeholder: 'Address', hint: 'Main business address' }) + '</div><div class="party-detail">' + inputHTML('companyRegLabel', 'text', { placeholder: 'CRA #' }) + inputHTML('companyRegNumber', 'text', { placeholder: 'Registration Number', hint: 'CRA charity or business registration number' }) + '</div><div class="party-detail">(Hereinafter the "<strong>Employer</strong>")</div></div>';
			html += '<div class="party-card"><h3>' + sec.employee.label + '</h3>';
			sec.employee.fields.forEach(function (f) { html += '<div class="' + (f.cls || '') + '">' + inputHTML(f.key, f.type, f) + '</div>'; });
			html += '<div class="party-detail">(Hereinafter the "<strong>Employee</strong>")</div></div></div>';
			html += '<p style="margin-top:16px;">The Employer and the Employee are collectively referred to as the "<strong>Parties</strong>."</p>';
		}
		else if (sec.type === 'detail-table') {
			html += '<table class="detail-table">';
			sec.rows.forEach(function (row) {
				html += '<tr><td>' + row.label + '</td><td>';
				if (row.type === 'date') html += inputHTML(row.key, 'date', row);
				else if (row.type === 'number') html += inputHTML(row.key, 'number', row) + ' ' + (row.suffix || '');
				else if (row.type === 'text') html += inputHTML(row.key, 'text', { placeholder: row.placeholder || row.value || '', hint: row.hint, wide: true });
				else html += inputHTML(row.key, 'text', { placeholder: row.value || '', hint: row.hint, wide: true });
				html += '</td></tr>';
			});
			html += '</table>';
			if (sec.overview) html += '<div class="tpl-richtext" data-key="' + sec.overview.key + '" onclick="openDrawer(this)">' + (fieldValues['rt_' + sec.overview.key] || sec.overview.content) + '</div>';
			if (sec.probationNote) html += '<div class="tpl-richtext" data-key="' + sec.probationNote.key + '" onclick="openDrawer(this)">' + (fieldValues['rt_' + sec.probationNote.key] || sec.probationNote.content) + '</div>';
		}
		else if (sec.type === 'richtext-block') {
			if (sec.intro) html += '<p>' + sec.intro + '</p>';
			html += '<div class="tpl-richtext" data-key="' + sec.block.key + '" onclick="openDrawer(this)">' + (fieldValues['rt_' + sec.block.key] || sec.block.content) + '</div>';
		}
		else if (sec.type === 'compensation') {
			html += '<p>' + sec.intro + '</p><div class="comp-box"><div class="comp-amount"><span>$</span>' + inputHTML(sec.salaryField.key, 'number', { placeholder: sec.salaryField.placeholder, hint: sec.salaryField.hint }) + '<span>CAD <span class="comp-period-label">/ year</span></span></div>';
			html += '<div class="comp-selector"><button onclick="setCompPeriod(\'hourly\')">/ hr</button><button onclick="setCompPeriod(\'weekly\')">/ wk</button><button onclick="setCompPeriod(\'biweekly\')">/ bi-wk</button><button onclick="setCompPeriod(\'monthly\')">/ mo</button><button onclick="setCompPeriod(\'annually\')" class="active">/ yr</button></div>';
			html += '<p class="comp-detail"><span class="tpl-inline" contenteditable="true" data-key="' + sec.compDetailField.key + '">' + (fieldValues[sec.compDetailField.key] || sec.compDetailField.value) + '</span>. Payable in ' + inputHTML(sec.payFrequencyField.key, 'text', { placeholder: sec.payFrequencyField.placeholder, hint: sec.payFrequencyField.hint }) + ' installments, less statutory deductions.</p></div>';
			if (sec.extraRows) { html += '<table class="detail-table">'; sec.extraRows.forEach(function (row) { html += '<tr><td>' + row.label + '</td><td>' + inputHTML(row.key, 'text', { placeholder: row.placeholder || row.value || '', hint: row.hint, wide: true }) + '</td></tr>'; }); html += '</table>'; }
		}
		else if (sec.type === 'subsections') {
			sec.subsections.forEach(function (sub) {
				html += '<h3>' + sub.heading + '</h3>';
				if (sub.type === 'static') html += sub.body;
				else if (sub.type === 'richtext') html += '<div class="tpl-richtext" data-key="' + sub.key + '" onclick="openDrawer(this)">' + (fieldValues['rt_' + sub.key] || sub.content) + '</div>';
			});
		}
		else if (sec.type === 'signatures') {
			html += '<p><strong>' + sec.preamble + '</strong></p><div class="signatures">';
			[sec.employer, sec.employee].forEach(function (sig) {
				html += '<div class="sig-block"><div class="sig-label">' + sig.label + '</div>';
				if (sig.label.indexOf('Employer') !== -1) html += '<p class="sig-org-name">' + C.name + '</p>';
				html += '<div class="sig-pad-wrap"><canvas id="' + sig.canvasId + '" width="500" height="120"></canvas><div class="sig-actions"><button onclick="clearSignature(\'' + sig.canvasId + '\')">Clear</button></div></div>';
				html += '<div class="sig-hint">Signature</div><div class="sig-name-line"></div>';
				html += '<div class="sig-hint">Print Name: ' + inputHTML(sig.nameKey, 'text', { placeholder: 'Print Full Name' }) + '</div>';
				if (sig.titleKey) { html += '<div class="sig-name-line" style="width:70%;"></div><div class="sig-hint">Title: ' + inputHTML(sig.titleKey, 'text', { placeholder: 'Job Title' }) + '</div>'; }
				html += '<div class="sig-date-line"></div><div class="sig-hint">Date: ' + inputHTML(sig.dateKey, 'date', {}) + '</div></div>';
			}); html += '</div>';
		}
		html += '</section>';
	});

	// Summary
	html += '<div class="page-break-before" style="page-break-before:always"></div><section id="sec-summary"><h2>Agreement Summary</h2><table class="detail-table summary-table">';
	AGREEMENT.summaryFields.forEach(function (f) { var val = fieldValues[f.source] || ''; if (f.prefix) val = f.prefix + val; if (f.suffix) val = val + f.suffix; if (f.source === 'salaryAmount' && val) { if (shouldAnnualize()) { var numSalary = parseFloat(fieldValues.salaryAmount || '0'); var annual = Math.round(numSalary * (PERIOD_TO_ANNUAL[compPeriod] || 1)); val = '$' + annual.toLocaleString('en-US') + ' CAD / year'; } else { val = val + ' ' + (PERIOD_LABELS[compPeriod] || '/ year'); } } html += '<tr><td>' + f.label + '</td><td class="sum-val" data-source="' + f.source + '" data-prefix="' + (f.prefix || '') + '" data-suffix="' + (f.suffix || '') + '">' + val + '</td></tr>'; });
	html += '</table></section>';

	html += '<div class="doc-footer"><p>' + C.name + ' &bull; ' + C.regLabel + ' ' + C.regNumber + '</p><p>' + C.address + ' &bull; ' + C.website + '</p></div>';
	html += '<div class="initials-line"><span class="initials-box">Employer Initials: <div class="initials-pad-wrap"><canvas id="initialsEmployer" width="200" height="60"></canvas><button class="initials-clear no-print" onclick="clearSignature(\'initialsEmployer\')">Clear</button></div></span><span class="initials-box">Employee Initials: <div class="initials-pad-wrap"><canvas id="initialsEmployee" width="200" height="60"></canvas><button class="initials-clear no-print" onclick="clearSignature(\'initialsEmployee\')">Clear</button></div></span></div>';
	page.innerHTML = html;
	// Dynamically update watermark background to use the configured logo
	var wm = page.querySelector('.watermark-layer');
	if (wm && logoUrl && logoUrl !== './logo.png') {
		wm.style.backgroundImage = 'url(' + logoUrl + ')';
	}
	updateSummary();
	updateFieldHints();
	if (!_suppressResize) safeResize();
	_rendering = false;
}

/* ── Debounced resize to prevent layout loops ── */
function safeResize() {
	clearTimeout(_resizeTimer);
	_resizeTimer = setTimeout(function () { tool.resize(); }, 100);
}

/* ── Update Summary live ───────────────────── */
function updateSummary() {
	document.querySelectorAll('.sum-val').forEach(function (td) {
		var src = td.dataset.source, val = fieldValues[src] || '';
		if (td.dataset.prefix) val = td.dataset.prefix + val;
		if (td.dataset.suffix) val = val + td.dataset.suffix;
		if (src === 'salaryAmount' && val) {
			if (shouldAnnualize()) {
				var numSalary = parseFloat(fieldValues.salaryAmount || '0');
				var annual = Math.round(numSalary * (PERIOD_TO_ANNUAL[compPeriod] || 1));
				val = '$' + annual.toLocaleString('en-US') + ' CAD / year';
			} else {
				val = val + ' ' + (PERIOD_LABELS[compPeriod] || '/ year');
			}
		}
		td.textContent = val;
	});
}

/* ── Show/hide field hints ─────────────────── */
function updateFieldHints() {
	document.querySelectorAll('.doc-input[data-key]').forEach(function (inp) {
		var hint = document.querySelector('.field-hint[data-for="' + inp.dataset.key + '"]');
		if (hint) { var v = inp.value !== undefined ? inp.value : inp.innerText.trim(); hint.style.display = v ? 'none' : 'block'; }
	});
}

/* ── Confirm Dialog ─────────────────────────── */
function showConfirm(title, msg, onConfirm) {
	var existing = document.getElementById('confirmOverlay');
	if (existing) existing.remove();
	var overlay = document.createElement('div');
	overlay.id = 'confirmOverlay';
	overlay.className = 'confirm-overlay';
	overlay.innerHTML = '<div class="confirm-card"><div class="confirm-icon">&#9888;</div><h3>' + title + '</h3><p>' + msg + '</p><div class="confirm-btns"><button class="btn-cancel" id="confirmCancel">Cancel</button><button class="btn-danger" id="confirmOk">Confirm</button></div></div>';
	document.body.appendChild(overlay);
	setTimeout(function () { overlay.classList.add('open'); }, 10);
	document.getElementById('confirmCancel').onclick = function () { overlay.classList.remove('open'); setTimeout(function () { overlay.remove(); }, 300); };
	document.getElementById('confirmOk').onclick = function () { overlay.classList.remove('open'); setTimeout(function () { overlay.remove(); onConfirm(); }, 300); };
	overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.classList.remove('open'); setTimeout(function () { overlay.remove(); }, 300); } });
	document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.classList.remove('open'); setTimeout(function () { overlay.remove(); }, 300); document.removeEventListener('keydown', esc); } });
}

/* ── Quill ──────────────────────────────────── */
function initQuill() { if (quill) return; quill = new Quill('#drawerEditor', { theme: 'snow', modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }], ['blockquote'], [{ align: [] }], ['clean']] }, placeholder: 'Start writing here\u2026' }); }
function openDrawer(el) {
	if (readOnly) return;
	activeRichTextEl = el; el.classList.add('editing'); initQuill();
	document.getElementById('drawerTitle').textContent = 'Edit: ' + ((el.dataset.key || 'content').replace(/([A-Z])/g, ' ').trim());
	try { if (quill.clipboard && quill.clipboard.dangerouslyPasteHTML) quill.clipboard.dangerouslyPasteHTML(el.innerHTML); else quill.root.innerHTML = el.innerHTML; } catch (e) { quill.root.innerHTML = el.innerHTML; }
	document.getElementById('drawerBackdrop').classList.add('open');
	document.getElementById('drawer').classList.add('open');
	setTimeout(function () { quill.focus(); }, 400);
}
function closeDrawer() { document.getElementById('drawerBackdrop').classList.remove('open'); document.getElementById('drawer').classList.remove('open'); if (activeRichTextEl) { activeRichTextEl.classList.remove('editing'); activeRichTextEl = null; } }

/* ── Helper: should we annualize salary in summary? ── */
function shouldAnnualize() {
	var et = (fieldValues.employmentType || '').toLowerCase();
	// Only full-time permanent roles get annualized — part-time hours vary too much
	if (et.indexOf('full-time') === -1 && et.indexOf('full time') === -1) return false;
	if (et.indexOf('permanent') === -1) return false;
	// Exclude any type that contradicts permanent or full-time
	var exclusions = ['contract', 'temporary', 'fixed-term', 'casual', 'intern', 'volunteer', 'freelance', 'part-time', 'part time'];
	for (var i = 0; i < exclusions.length; i++) {
		if (et.indexOf(exclusions[i]) !== -1) return false;
	}
	return true;
}

/* ── Compensation ──────────────────────────── */
// Conversion multipliers TO annual from each period
var PERIOD_TO_ANNUAL = { hourly: 2080, weekly: 52, biweekly: 26, monthly: 12, annually: 1 };
var PERIOD_LABELS = { hourly: '/ hour', weekly: '/ week', biweekly: '/ bi-week', monthly: '/ month', annually: '/ year' };

function setCompPeriod(period) {
	// Convert current salary to the new period before switching
	var curSalary = parseFloat(fieldValues.salaryAmount || '0');
	if (curSalary > 0 && compPeriod !== period) {
		// Step 1: convert current amount → annual equivalent
		var annual = curSalary * (PERIOD_TO_ANNUAL[compPeriod] || 1);
		// Step 2: convert annual → new period amount
		var toMultiplier = PERIOD_TO_ANNUAL[period] || 1;
		var newSalary = toMultiplier === 0 ? annual : Math.round(annual / toMultiplier);
		fieldValues.salaryAmount = String(newSalary);
		// Update the displayed input value
		var inp = document.querySelector('.doc-input[data-key="salaryAmount"]');
		if (inp) inp.value = newSalary;
	}
	compPeriod = period;
	var el = document.querySelector('.comp-period-label');
	if (el) el.textContent = PERIOD_LABELS[period] || '/ year';
	document.querySelectorAll('.comp-selector button').forEach(function (b) { b.classList.remove('active'); });
	var t = document.querySelector('.comp-selector button[onclick*="' + period + '"]');
	if (t) t.classList.add('active');
	saveAll();
}

/* ── Signatures ────────────────────────────── */
function clearSignature(canvasId) { var c = document.getElementById(canvasId); if (!c) return; c.getContext('2d').clearRect(0, 0, c.width, c.height); saveAll(); notify('Signature cleared.', 'info'); }
function isCanvasEmpty(canvas) { if (!canvas || canvas.width === 0 || canvas.height === 0) return true; var ctx = canvas.getContext('2d', { willReadFrequently: true }); var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data; for (var i = 3; i < d.length; i += 4)if (d[i] !== 0) return false; return true; }

/* ── Save / Load ───────────────────────────── */
function loadAll(data) {
	// Suppress re-render if this is an echo from our own saveAll() call
	// Prevents the contenteditable blur/flicker loop during fast typing
	if (_suppressReload) return;

	// Skip if data is identical (prevents resize → onValueChange → render loop)
	var newData = data || {};
	var curCopy = JSON.parse(JSON.stringify(fieldValues || {}));
	delete curCopy._signatures;
	var newCopy = JSON.parse(JSON.stringify(newData));
	delete newCopy._signatures;
	if (Object.keys(fieldValues).length > 0 && JSON.stringify(curCopy) === JSON.stringify(newCopy) && compPeriod === (newData._compPeriod || '')) return;

	fieldValues = newData;
	if (!data || Object.keys(data).length === 0) { Object.keys(COMPANY_DEFAULTS).forEach(function (k) { if (!fieldValues[k]) fieldValues[k] = COMPANY_DEFAULTS[k]; }); }
	// Only use explicit _compPeriod from data; never infer from payFrequency
	// (payFrequency is how often paid, not what period the salary number represents)
	if (data && data._compPeriod) { compPeriod = data._compPeriod; }
	_suppressResize = true;
	renderDocument();
	_suppressResize = false;
	setTimeout(function () { initSignaturePad('sigEmployer'); initSignaturePad('sigEmployee'); initSignaturePad('initialsEmployer'); initSignaturePad('initialsEmployee'); if (data && data._signatures) { Object.keys(data._signatures).forEach(function (id) { var c = document.getElementById(id); if (c) { var img = new Image(); img.onload = function () { var ctx = c.getContext('2d'); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(img, 0, 0, c.width, c.height); ctx.restore(); }; img.src = data._signatures[id]; } }); } if (compPeriod) setCompPeriod(compPeriod); updateStatusBadge(); bindEvents(); }, 150);
}

// Also need to restore contenteditable doc-input values after render
// This is handled by inputHTML reading from fieldValues during renderDocument

/* ── Status ────────────────────────────────── */
function updateStatusBadge() { var badge = document.getElementById('statusBadge'); if (!badge) return; var inputs = document.querySelectorAll('.doc-input[data-key]'); var inlines = document.querySelectorAll('.tpl-inline[data-key]'); var rts = document.querySelectorAll('.tpl-richtext[data-key]'); var filled = 0, total = 0; inputs.forEach(function (el) { total++; var v = el.value !== undefined ? el.value : el.innerText.trim(); if (v) filled++; }); inlines.forEach(function (el) { total++; if (el.innerText.trim()) filled++; }); rts.forEach(function (el) { total++; if (el.innerHTML.trim() && el.innerHTML.indexOf('Click this block') === -1) filled++; }); if (filled === 0) { badge.textContent = 'DRAFT'; badge.className = 'status-badge draft'; } else if (filled < total) { badge.textContent = filled + '/' + total; badge.className = 'status-badge progress'; } else { badge.textContent = 'READY'; badge.className = 'status-badge ready'; } }

/* ── Save ──────────────────────────────────── */
function saveAll() { fieldValues = {}; document.querySelectorAll('.doc-input').forEach(function (el) { if (el.dataset.key) { fieldValues[el.dataset.key] = el.value !== undefined ? el.value : el.innerText.trim(); } }); document.querySelectorAll('.tpl-inline[data-key]').forEach(function (el) { fieldValues[el.dataset.key] = el.innerText.trim(); }); document.querySelectorAll('.tpl-richtext[data-key]').forEach(function (el) { fieldValues['rt_' + el.dataset.key] = el.innerHTML; }); fieldValues._compPeriod = compPeriod; var sigs = {}; var empC = document.getElementById('sigEmployer'); var eeC = document.getElementById('sigEmployee'); var iEC = document.getElementById('initialsEmployer'); var iEEC = document.getElementById('initialsEmployee'); if (empC && !isCanvasEmpty(empC)) sigs.sigEmployer = empC.toDataURL('image/png'); if (eeC && !isCanvasEmpty(eeC)) sigs.sigEmployee = eeC.toDataURL('image/png'); if (iEC && !isCanvasEmpty(iEC)) sigs.initialsEmployer = iEC.toDataURL('image/png'); if (iEEC && !isCanvasEmpty(iEEC)) sigs.initialsEmployee = iEEC.toDataURL('image/png'); fieldValues._signatures = sigs; _suppressReload = true; tool.setValue(fieldValues); updateStatusBadge(); updateSummary(); updateFieldHints(); setTimeout(function () { _suppressReload = false; }, 600); }

/* ── Signature Pad Init ────────────────────── */
function initSignaturePad(canvasId) { var canvas = document.getElementById(canvasId); if (!canvas) return; var ctx = canvas.getContext('2d'), drawing = false; var rect = canvas.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return; canvas.width = rect.width * 2; canvas.height = rect.height * 2; ctx.scale(2, 2); ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; function gp(e) { var r = canvas.getBoundingClientRect(); return { x: (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - r.top }; } function start(e) { if (readOnly) return; e.preventDefault(); drawing = true; var p = gp(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); } function move(e) { if (!drawing) return; e.preventDefault(); var p = gp(e); ctx.lineTo(p.x, p.y); ctx.stroke(); } function stop() { drawing = false; saveAll(); } canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', stop); canvas.addEventListener('mouseleave', stop); canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', stop); }

/* ── Apply Drawer ──────────────────────────── */
function applyDrawerContent() { if (!activeRichTextEl || !quill) return; activeRichTextEl.innerHTML = quill.root.innerHTML; saveAll(); closeDrawer(); notify('Content applied.', 'success'); }

/* ── Toggle Highlights ─────────────────────── */
function toggleHighlights() { highlightsOn = !highlightsOn; document.querySelectorAll('.doc-input,.tpl-inline,.tpl-richtext,.field-hint').forEach(function (el) { if (highlightsOn) { el.style.background = ''; el.style.border = ''; el.style.display = ''; } else { el.style.background = 'transparent'; el.style.border = '1px solid transparent'; if (el.classList.contains('field-hint')) el.style.display = 'none'; } }); document.querySelectorAll('.field-help').forEach(function (el) { el.classList.toggle('show', highlightsOn); }); document.querySelectorAll('.help-popover').forEach(function (el) { el.classList.remove('show'); }); document.querySelectorAll('.toc-sidebar').forEach(function (el) { el.style.display = highlightsOn ? 'flex' : 'none'; }); updateFieldHints(); notify(highlightsOn ? 'Highlights ON' : 'Highlights OFF', 'info'); }

/* ── Help popover ──────────────────────────── */
function showHelp(el) { var hint = el.dataset.hint; if (!hint) return; var pop = el.querySelector('.help-popover'); if (!pop) { pop = document.createElement('div'); pop.className = 'help-popover'; pop.textContent = hint; el.appendChild(pop); } pop.classList.toggle('show'); document.addEventListener('click', function hc(e) { if (!el.contains(e.target)) { pop.classList.remove('show'); document.removeEventListener('click', hc); } }); }

/* ── Demo / Clear / Highlights ──────────────── */
function fillDemo() { showConfirm('Fill Demo Data', 'This will overwrite all currently entered data with sample values. This cannot be undone. Continue?', function () { var demo = { agreementDate: '2026-07-01', employeeName: 'Jane Doe', employeeAddress: '123 Main Street, Suite 200', employeeCity: 'New Westminster, BC  V3M 1A1', startDate: '2026-07-01', positionTitle: 'Director of Community Programs', employmentType: 'Full-Time, Permanent', reportsTo: 'Executive Leadership', probationMonths: '3', workLocation: '93 6th Street, New Westminster, BC', travelReqs: 'Various locations in Metro Vancouver', salaryAmount: '72000', compDetails: 'Annual gross salary', payFrequency: 'bi-weekly', salaryReview: 'Annually by the Board; first review after 12 months', expensePolicy: 'Reasonable expenses reimbursed per policy', empSignName: 'Sarah Mitchell', empSignTitle: 'Executive Director', empSignDate: '2026-06-15', eeSignName: 'Jane Doe', eeSignDate: '2026-07-01', docRef: 'CC-EMP-2026-DCP-001' }; fieldValues = demo; renderDocument(); setTimeout(function () { initSignaturePad('sigEmployer'); initSignaturePad('sigEmployee'); initSignaturePad('initialsEmployer'); initSignaturePad('initialsEmployee'); updateStatusBadge(); bindEvents(); }, 150); notify('Demo data populated.', 'success'); }); }
function clearAll() { showConfirm('Clear All Data', 'This will permanently delete all entered data, signatures, and content. This cannot be undone. Are you sure?', function () { fieldValues = {}; renderDocument(); clearSignature('sigEmployer'); clearSignature('sigEmployee'); clearSignature('initialsEmployer'); clearSignature('initialsEmployee'); tool.setValue(null); setTimeout(function () { initSignaturePad('sigEmployer'); initSignaturePad('sigEmployee'); initSignaturePad('initialsEmployer'); initSignaturePad('initialsEmployee'); updateStatusBadge(); bindEvents(); }, 150); notify('All data cleared.', 'warning'); }); }

/* ── PDF Export ────────────────────────────── */
function exportToPDF() {
	var wasHigh = highlightsOn;
	if (wasHigh) toggleHighlights();
	var overlay = document.getElementById('exportOverlay');

	// CMS sandbox blocks window.print() — must use CMS export channel
	if (typeof tool !== 'undefined' && tool.requestExportPdf) {
		overlay.classList.add('active');
		var fname = 'employment-agreement-' + (fieldValues.employeeName || 'draft').replace(/\s+/g, '-').toLowerCase();

		// Clone the page and convert signature canvases to images
		// (outerHTML captures <canvas> tags but not the pixel data drawn on them)
		var pageEl = document.getElementById('agreementPage');
		var clone = pageEl ? pageEl.cloneNode(true) : null;
		if (clone) {
			var canvases = clone.querySelectorAll('canvas');
			for (var ci = 0; ci < canvases.length; ci++) {
				var origCanvas = document.getElementById(canvases[ci].id);
				if (origCanvas && !isCanvasEmpty(origCanvas)) {
					var img = document.createElement('img');
					img.src = origCanvas.toDataURL('image/png');
					img.style.cssText = 'display:block;width:100%;height:96px;border:1.5px solid #999;border-radius:4px;';
					if (canvases[ci].id.indexOf('initials') !== -1) {
						img.style.cssText = 'display:block;width:200px;height:60px;border:1px solid #e5e2d9;border-radius:4px;';
					}
					canvases[ci].parentNode.replaceChild(img, canvases[ci]);
				}
			}
		}
		var pageHTML = clone ? clone.outerHTML : '<p>No agreement content</p>';

		// Collect all accessible stylesheet CSS
		var cssText = '';
		try {
			var sheets = document.styleSheets;
			for (var i = 0; i < sheets.length; i++) {
				try {
					var rules = sheets[i].cssRules || sheets[i].rules;
					if (rules) { for (var j = 0; j < rules.length; j++) { cssText += rules[j].cssText + '\n'; } }
				} catch (e) { /* cross-origin sheet, skip */ }
			}
		} catch (e) {}

		var fullHTML = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n';
		fullHTML += '<title>Employment Agreement</title>\n';
		fullHTML += '<style>\n' + cssText + '\n</style>\n';
		fullHTML += '<style>\nbody{background:#fff;padding:40px;font-family:Georgia,serif;color:#1f2937;line-height:1.7;}\n';
		fullHTML += '@media print{body{padding:0;}}\n</style>\n';
		fullHTML += '</head>\n<body>\n' + pageHTML + '\n</body>\n</html>';

		tool.requestExportPdf({ html: fullHTML, filename: fname }, function (err, file) {
			overlay.classList.remove('active');
			if (wasHigh) toggleHighlights();
			if (err) {
				notify('Export failed: ' + err + '. Ensure allowExportPdf is set to "yes" in the tool field settings.', 'error');
			} else {
				notify('Agreement exported! Opening in a new tab — use Ctrl+P there to print.', 'success');
				if (tool.openUrl) tool.openUrl(file.url);
				else window.open(file.url, '_blank');
			}
		});
	} else {
		notify('Print/export is not available. The CMS admin must enable allowExportPdf in the tool field settings.', 'error');
		if (wasHigh) toggleHighlights();
	}
}

function notify(msg, sev) { if (typeof tool !== 'undefined' && tool.notify) tool.notify(msg, sev); else console.log('[' + (sev || 'info') + '] ' + msg); }

function lockUI(ro) { readOnly = ro; document.querySelectorAll('.doc-input,.tpl-inline,.tpl-richtext').forEach(function (el) { el.style.pointerEvents = ro ? 'none' : 'auto'; el.readOnly = ro; el.disabled = ro; el.style.opacity = ro ? '0.85' : ''; }); document.querySelectorAll('.comp-selector button,.sig-actions button').forEach(function (el) { el.style.display = ro ? 'none' : ''; }); var tb = document.getElementById('toolbar'); if (tb) tb.style.display = ro ? 'none' : 'flex'; safeResize(); }

function bindEvents() { if (eventsBound) return; eventsBound = true; document.addEventListener('input', function (e) { if (e.target.closest('.doc-input,.tpl-inline')) { saveAll(); updateFieldHints(); } }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('drawer').classList.contains('open')) closeDrawer(); if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAll(); notify('Saved.', 'success'); } if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); exportToPDF(); } }); var tocLinks = document.querySelectorAll('.toc-sidebar a'), sections = document.querySelectorAll('section[id]'); window.addEventListener('scroll', function () { var c = ''; sections.forEach(function (s) { if (s.getBoundingClientRect().top < 180) c = s.id; }); tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + c); }); }, { passive: true }); tocLinks.forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); var t = document.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' }); }); }); }

try {
	tool.onReady(function (val, fields) {
		try {
			// Report missing mandatory parameters to CMS admin
			var missing = [];
			var mandatoryParams = [
				{ name: 'companyName', label: 'Company Name', hint: 'Legal name of the organization' },
				{ name: 'companyAddress', label: 'Company Address', hint: 'Main business address' },
				{ name: 'province', label: 'Province / Territory', hint: 'Province whose employment laws govern this agreement' }
			];
			mandatoryParams.forEach(function (p) {
				var v = tool.param(p.name, '');
				if (!v) {
					missing.push({
						name: p.name, label: p.label, type: 'text',
						hint: p.hint,
						reason: 'Required for generating valid employment agreements with correct organization details and governing law.',
						severity: 'mandatory'
					});
				}
			});
			if (missing.length > 0) {
				try { tool.reportMissingParams(missing, 'This tool needs company parameters configured before agreements can be generated. Click "Configure" below to set them.'); } catch (e) {}
			}

			var data = val;
			if (!data || Object.keys(data).length === 0) {
				if (window._pendingJSON) { data = window._pendingJSON; delete window._pendingJSON; }
			}
			loadAll(data);
			if (tool.isReadOnly()) lockUI(true);
			tool.onValueChange(function (v) { loadAll(v); });
			tool.onReadonlyChange(function (ro) { lockUI(ro); });
			updateStatusBadge();
		} catch (e) {
			document.getElementById('agreementPage').innerHTML = '<div style=\"padding:40px;color:red;font-family:sans-serif;\"><h2>Runtime Error</h2><pre>' + e.message + '\\n' + (e.stack || '') + '</pre></div>';
		}
	});
} catch (e) {
	document.getElementById('agreementPage').innerHTML = '<div style=\"padding:40px;color:red;font-family:sans-serif;\"><h2>Init Error</h2><pre>' + e.message + '</pre></div>';
}

window.fillDemo = fillDemo; window.clearAll = clearAll; window.toggleHighlights = toggleHighlights; window.exportToPDF = exportToPDF; window.clearSignature = clearSignature; window.closeDrawer = closeDrawer; window.applyDrawerContent = applyDrawerContent; window.setCompPeriod = setCompPeriod; window.openDrawer = openDrawer; window.showHelp = showHelp; window.pasteJSON = pasteJSON; window.applyPastedJSON = applyPastedJSON; window.uploadLogo = uploadLogo;

/* ── Paste JSON ────────────────────────────── */
function pasteJSON() {
	document.getElementById('pasteOverlay').classList.add('open');
	setTimeout(function () { document.getElementById('pasteTextarea').focus(); }, 100);
}
function applyPastedJSON() {
	var raw = document.getElementById('pasteTextarea').value.trim();
	if (!raw) return;
	try {
		var data = JSON.parse(raw);
		fieldValues = data;

		// Override COMPANY (tool params) with values from pasted JSON
		// JSON values take priority over admin-configured tool parameters
		if (data.logoPath) COMPANY.logoPath = data.logoPath;
		if (data.companyName) COMPANY.name = data.companyName;
		if (data.companyAddress) COMPANY.address = data.companyAddress;
		if (data.companyRegLabel) COMPANY.regLabel = data.companyRegLabel;
		if (data.companyRegNumber) COMPANY.regNumber = data.companyRegNumber;
		if (data.companyWebsite) COMPANY.website = data.companyWebsite;
		if (data.companyProvince) COMPANY.province = data.companyProvince;
		if (data.companyProvinceCode) COMPANY.provinceCode = data.companyProvinceCode;
		if (data.companyTypeLabel) COMPANY.typeLabel = data.companyTypeLabel;

		// Only use explicit _compPeriod from data; never infer from payFrequency
		if (data._compPeriod) compPeriod = data._compPeriod;
		renderDocument();
		setTimeout(function () {
			initSignaturePad('sigEmployer'); initSignaturePad('sigEmployee');
			if (data._signatures) {
				Object.keys(data._signatures).forEach(function (id) {
					var c = document.getElementById(id);
					if (c) { var img = new Image(); img.onload = function () { var ctx = c.getContext('2d'); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(img, 0, 0, c.width, c.height); ctx.restore(); }; img.src = data._signatures[id]; }
				});
			}
			if (compPeriod) setCompPeriod(compPeriod);
			updateStatusBadge(); bindEvents();
			tool.setValue(fieldValues);
		}, 150);
		document.getElementById('pasteOverlay').classList.remove('open');
		document.getElementById('pasteTextarea').value = '';
		notify('JSON applied successfully. Company fields and logo overridden from JSON.', 'success');
	} catch (e) {
		notify('Invalid JSON: ' + e.message, 'error');
	}
}

/* ── Logo Upload ───────────────────────────── */
function uploadLogo() {
	if (typeof tool === 'undefined' || !tool.requestUpload) {
		notify('Logo upload is only available inside the CMS. Use the logoPath parameter to set a logo URL.', 'warning');
		return;
	}
	tool.requestUpload('image/*', function (err, file) {
		if (err) { notify('Upload failed: ' + err, 'error'); return; }
		// Show logo immediately on the page
		var logoImg = document.querySelector('.logo-img');
		if (logoImg) { logoImg.src = file.url; logoImg.style.display = 'block'; }
		// Copy URL to clipboard for easy param configuration
		var copied = false;
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(file.url).then(function () { copied = true; })
				.catch(function () {});
		}
		var msg = 'Logo uploaded! URL: ' + file.url;
		if (copied) msg += ' (copied to clipboard)';
		msg += ' — Paste this into the logoPath parameter in the CMS Tool Settings panel.';
		notify(msg, 'success');
		// Also save in field values so it persists with the document
		fieldValues._logoUrl = file.url;
		saveAll();
	});
}

// Check for auto-loaded JSON from file
if (window._pendingJSON) {
	setTimeout(function () {
		fieldValues = window._pendingJSON;
		if (window._pendingJSON._compPeriod) compPeriod = window._pendingJSON._compPeriod;
		delete window._pendingJSON;
	}, 0);
}

// Verify JS loaded
console.log('Template JS loaded — ' + (typeof AGREEMENT !== 'undefined' ? 'AGREEMENT OK' : 'AGREEMENT MISSING') + ' — ' + (typeof renderDocument !== 'undefined' ? 'renderDocument OK' : 'renderDocument MISSING'));

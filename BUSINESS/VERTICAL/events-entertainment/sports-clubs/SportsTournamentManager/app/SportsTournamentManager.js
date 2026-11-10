/* js build 2026-11-08-1 */
(function () {
	'use strict';

	/* ------------------------------------------------------------------ */
	/*  Constants and small helpers                                        */
	/* ------------------------------------------------------------------ */

	var TOOL_BUILD = '2026-11-08-1';

	var SPORT_DEFINITIONS = {
		soccer: {
			label: 'Soccer',
			positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
			usesOvertimeDecider: false
		},
		hockey: {
			label: 'Hockey',
			positions: ['Goaltender', 'Defense', 'Forward'],
			usesOvertimeDecider: true
		}
	};

	var VALID_TABS = ['overview', 'teams', 'players', 'matches', 'standings', 'bracket', 'settings'];
	var MATCH_STATUSES = ['scheduled', 'finished'];
	var HOCKEY_DECIDERS = [
		{ value: 'reg', label: 'Regulation' },
		{ value: 'ot', label: 'Overtime' },
		{ value: 'so', label: 'Shootout' }
	];

	var MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function uniqueId(prefix) {
		return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
	}

	function esc(value) {
		if (value === null || value === undefined) { return ''; }
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function el(id) {
		return document.getElementById(id);
	}

	function clampInteger(value, minimum, maximum) {
		var number = parseInt(value, 10);
		if (isNaN(number)) { return minimum; }
		if (number < minimum) { return minimum; }
		if (number > maximum) { return maximum; }
		return number;
	}

	function isNumericScore(value) {
		return value !== null && value !== undefined && value !== '' && !isNaN(parseInt(value, 10));
	}

	function scoreOf(value) {
		return isNumericScore(value) ? clampInteger(value, 0, 999) : null;
	}

	function todayLocalIso() {
		var now = new Date();
		var month = String(now.getMonth() + 1).padStart(2, '0');
		var day = String(now.getDate()).padStart(2, '0');
		return now.getFullYear() + '-' + month + '-' + day;
	}

	function formatDateBadge(isoDate) {
		if (!isoDate) { return { day: '--', month: 'no date' }; }
		var parts = isoDate.split('-');
		if (parts.length !== 3) { return { day: '--', month: 'no date' }; }
		var monthIndex = clampInteger(parts[1], 1, 12) - 1;
		return { day: String(clampInteger(parts[2], 1, 31)), month: MONTH_NAMES_SHORT[monthIndex] };
	}

	function formatSavedTime() {
		var now = new Date();
		return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
	}

	function compareMatchChronology(matchA, matchB) {
		var dateA = matchA.date || '';
		var dateB = matchB.date || '';
		if (dateA !== dateB) {
			if (!dateA) { return 1; }
			if (!dateB) { return -1; }
			return dateA < dateB ? -1 : 1;
		}
		var timeA = matchA.time || '';
		var timeB = matchB.time || '';
		if (timeA !== timeB) {
			if (!timeA) { return 1; }
			if (!timeB) { return -1; }
			return timeA < timeB ? -1 : 1;
		}
		return 0;
	}

	/* ------------------------------------------------------------------ */
	/*  State                                                              */
	/* ------------------------------------------------------------------ */

	var DB = null;
	var currentUser = null;
	var isReadOnly = false;
	var identityUnavailable = false;
	var saveDebounceTimer = null;
	var lastStagedJson = '';
	var warnedAutosave = false;
	var pollTimers = [];
	var modalContext = null;
	var confirmCallback = null;
	var confirmArmed = false;
	var confirmArmTimer = null;
	var settingsSportBeforeChange = 'soccer';

	console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' SportsTournamentManager');

	/* ------------------------------------------------------------------ */
	/*  Database shape                                                     */
	/* ------------------------------------------------------------------ */

	function defaultDatabase() {
		return {
			version: 2,
			tournament: {
				name: '',
				season: '',
				sport: 'soccer',
				format: 'league',
				venues: [],
				points: { win: 3, draw: 1, loss: 0 },
				hockeyPoints: { win: 3, otWin: 2, otLoss: 1, loss: 0 }
			},
			teams: [],
			players: [],
			matches: [],
			bracket: null,
			ui: { tab: 'overview' }
		};
	}

	function normalizePointValue(pointsBag, key, fallbackValue) {
		var incomingValue = pointsBag ? pointsBag[key] : undefined;
		if (incomingValue === undefined || incomingValue === null || incomingValue === '') { return fallbackValue; }
		return clampInteger(incomingValue, 0, 99);
	}

	function normalizeDatabase(value) {
		var base = defaultDatabase();
		var incoming = (value && typeof value === 'object') ? value : {};
		var tournament = (incoming.tournament && typeof incoming.tournament === 'object') ? incoming.tournament : {};
		var incomingPoints = tournament.points || {};
		var incomingHockeyPoints = tournament.hockeyPoints || {};

		var normalized = {
			version: 2,
			tournament: {
				name: String(tournament.name || '').slice(0, 120),
				season: String(tournament.season || '').slice(0, 40),
				sport: SPORT_DEFINITIONS[tournament.sport] ? tournament.sport : 'soccer',
				format: tournament.format === 'knockout' ? 'knockout' : 'league',
				venues: normalizeStringList(tournament.venues),
				points: {
					win: normalizePointValue(incomingPoints, 'win', base.tournament.points.win),
					draw: normalizePointValue(incomingPoints, 'draw', base.tournament.points.draw),
					loss: normalizePointValue(incomingPoints, 'loss', base.tournament.points.loss)
				},
				hockeyPoints: {
					win: normalizePointValue(incomingHockeyPoints, 'win', base.tournament.hockeyPoints.win),
					otWin: normalizePointValue(incomingHockeyPoints, 'otWin', base.tournament.hockeyPoints.otWin),
					otLoss: normalizePointValue(incomingHockeyPoints, 'otLoss', base.tournament.hockeyPoints.otLoss),
					loss: normalizePointValue(incomingHockeyPoints, 'loss', base.tournament.hockeyPoints.loss)
				}
			},
			teams: Array.isArray(incoming.teams) ? incoming.teams.map(normalizeTeam).filter(Boolean) : [],
			players: Array.isArray(incoming.players) ? incoming.players.map(normalizePlayer).filter(Boolean) : [],
			matches: Array.isArray(incoming.matches) ? incoming.matches.map(normalizeMatch).filter(Boolean) : [],
			bracket: normalizeBracket(incoming.bracket),
			ui: {
				tab: VALID_TABS.indexOf(incoming.ui && incoming.ui.tab) >= 0 ? incoming.ui.tab : 'overview'
			}
		};
		normalized.players = normalized.players.filter(function (player) {
			return teamExistsIn(normalized.teams, player.teamId);
		});
		normalized.matches = normalized.matches.filter(function (match) {
			return teamExistsIn(normalized.teams, match.homeTeamId) && teamExistsIn(normalized.teams, match.awayTeamId);
		});
		return normalized;
	}

	function normalizeStringList(list) {
		if (!Array.isArray(list)) { return []; }
		var result = [];
		list.forEach(function (item) {
			var text = String(item || '').trim();
			if (text && result.indexOf(text) < 0) { result.push(text.slice(0, 120)); }
		});
		return result.slice(0, 30);
	}

	function normalizeTeam(team) {
		if (!team || typeof team !== 'object') { return null; }
		return {
			id: String(team.id || uniqueId('t')),
			name: String(team.name || '').slice(0, 80),
			shortName: String(team.shortName || '').slice(0, 10).toUpperCase(),
			color: /^#[0-9a-fA-F]{6}$/.test(team.color || '') ? team.color : '#64748b',
			coach: String(team.coach || '').slice(0, 80),
			contact: String(team.contact || '').slice(0, 120)
		};
	}

	function normalizePlayer(player) {
		if (!player || typeof player !== 'object') { return null; }
		return {
			id: String(player.id || uniqueId('p')),
			teamId: String(player.teamId || ''),
			name: String(player.name || '').slice(0, 80),
			number: isNumericScore(player.number) ? clampInteger(player.number, 0, 999) : null,
			position: String(player.position || '').slice(0, 40),
			notes: String(player.notes || '').slice(0, 300)
		};
	}

	function normalizeMatch(match) {
		if (!match || typeof match !== 'object') { return null; }
		return {
			id: String(match.id || uniqueId('g')),
			homeTeamId: String(match.homeTeamId || ''),
			awayTeamId: String(match.awayTeamId || ''),
			date: String(match.date || ''),
			time: String(match.time || ''),
			venue: String(match.venue || '').slice(0, 120),
			round: String(match.round || '').slice(0, 60),
			status: MATCH_STATUSES.indexOf(match.status) >= 0 ? match.status : 'scheduled',
			homeScore: scoreOf(match.homeScore),
			awayScore: scoreOf(match.awayScore),
			decided: ['reg', 'ot', 'so'].indexOf(match.decided) >= 0 ? match.decided : 'reg'
		};
	}

	function normalizeBracket(bracket) {
		if (!bracket || !Array.isArray(bracket.rounds) || bracket.rounds.length === 0) { return null; }
		var valid = true;
		var cleanedRounds = bracket.rounds.map(function (round) {
			if (!Array.isArray(round)) { valid = false; return []; }
			return round.map(function (match) {
				if (!match || typeof match !== 'object') { valid = false; return null; }
				return {
					id: String(match.id || uniqueId('m')),
					homeTeamId: match.homeTeamId ? String(match.homeTeamId) : null,
					awayTeamId: match.awayTeamId ? String(match.awayTeamId) : null,
					winnerTeamId: match.winnerTeamId ? String(match.winnerTeamId) : null
				};
			});
		});
		if (!valid) { return null; }
		return { rounds: cleanedRounds };
	}

	function teamExistsIn(teams, teamId) {
		if (!teamId) { return false; }
		return teams.some(function (team) { return team.id === teamId; });
	}

	/* ------------------------------------------------------------------ */
	/*  Lookups                                                            */
	/* ------------------------------------------------------------------ */

	function teamById(teamId) {
		for (var i = 0; i < DB.teams.length; i++) {
			if (DB.teams[i].id === teamId) { return DB.teams[i]; }
		}
		return null;
	}

	function teamNameOf(teamId) {
		var team = teamById(teamId);
		return team ? team.name : 'Unknown team';
	}

	function teamColorOf(teamId) {
		var team = teamById(teamId);
		return team ? team.color : '#64748b';
	}

	function playersOfTeam(teamId) {
		return DB.players.filter(function (player) { return player.teamId === teamId; });
	}

	function sportDefinition() {
		return SPORT_DEFINITIONS[DB.tournament.sport] || SPORT_DEFINITIONS.soccer;
	}

	function pointsConfigForCurrentSport() {
		if (DB.tournament.sport === 'hockey') { return DB.tournament.hockeyPoints; }
		return DB.tournament.points;
	}

	function positionOptionsFor(playerPosition) {
		var options = sportDefinition().positions.slice();
		if (playerPosition && options.indexOf(playerPosition) < 0) { options.push(playerPosition); }
		return options;
	}

	/* ------------------------------------------------------------------ */
	/*  Identity and permissions                                           */
	/* ------------------------------------------------------------------ */

	function hasUserApi() {
		return typeof tool.getUser === 'function';
	}

	function getUserSafe() {
		try {
			return hasUserApi() ? tool.getUser() : null;
		} catch (error) {
			return null;
		}
	}

	function rolesOf(user) {
		var fallback = [];
		if (!user) { return fallback; }
		if (Array.isArray(user.roles) && user.roles.length) { return user.roles.slice(); }
		var access = user.effectiveAccess;
		if (!access) { return fallback; }
		if (access.isManager) { fallback.push('admin'); }
		if (access.isEditor) { fallback.push('editor'); }
		if (access.isViewer) { fallback.push('viewer'); }
		return fallback;
	}

	function isManagerRole(user) {
		var roles = rolesOf(user);
		return roles.indexOf('admin') >= 0 || roles.indexOf('owner') >= 0 ||
			roles.indexOf('developer') >= 0 || roles.indexOf('user-manager') >= 0;
	}

	function isEditorOrManagerRole(user) {
		return isManagerRole(user) || rolesOf(user).indexOf('editor') >= 0;
	}

	function canEdit() {
		if (isReadOnly) { return false; }
		if (identityUnavailable) { return true; }
		if (!currentUser) { return false; }
		return isEditorOrManagerRole(currentUser);
	}

	function canAdmin() {
		if (isReadOnly) { return false; }
		if (identityUnavailable) { return true; }
		return isManagerRole(currentUser);
	}

	function refreshUser() {
		currentUser = getUserSafe();
		renderReadonlyBanner();
	}

	function startUserPolling() {
		var delays = [400, 1200, 2600, 5000];
		delays.forEach(function (delay) {
			pollTimers.push(window.setTimeout(function () {
				if (currentUser && rolesOf(currentUser).length) { return; }
				refreshUser();
				if (!currentUser && !hasUserApi()) { identityUnavailable = true; }
				renderReadonlyBanner();
			}, delay));
		});
		window.setTimeout(function () {
			if (!currentUser && hasUserApi()) {
				identityUnavailable = true;
				renderReadonlyBanner();
			}
		}, 5200);
	}

	function renderReadonlyBanner() {
		var banner = el('stm-readonly-banner');
		if (!banner) { return; }
		if (identityUnavailable && !isReadOnly) {
			banner.hidden = true;
			return;
		}
		banner.hidden = !isReadOnly;
	}

	/* ------------------------------------------------------------------ */
	/*  Persistence                                                        */
	/* ------------------------------------------------------------------ */

	function snapshotJson() {
		return JSON.stringify(DB);
	}

	function updateSaveChip(state, label) {
		var chip = el('stm-save-chip');
		if (!chip) { return; }
		chip.classList.remove('stm-save-dirty', 'stm-save-saved');
		chip.textContent = label;
		if (state === 'dirty') { chip.classList.add('stm-save-dirty'); }
		if (state === 'saved') { chip.classList.add('stm-save-saved'); }
	}

	function schedulePersist() {
		updateSaveChip('dirty', 'Saving changes...');
		if (saveDebounceTimer) { window.clearTimeout(saveDebounceTimer); }
		saveDebounceTimer = window.setTimeout(flushPersist, 400);
	}

	function flushPersist() {
		saveDebounceTimer = null;
		lastStagedJson = snapshotJson();
		if (typeof tool.setValue === 'function') {
			try { tool.setValue(JSON.parse(lastStagedJson)); } catch (error) { }
		}
		updateSaveChip('saved', 'Saved ' + formatSavedTime());
		requestParentSave();
	}

	function requestParentSave() {
		if (typeof tool.requestSave !== 'function') { return; }
		try {
			tool.requestSave();
		} catch (error) {
			if (!warnedAutosave) {
				warnedAutosave = true;
				showToast('Changes are staged in the tool but the CMS did not accept the save request. Save the record manually.', 'warn');
			}
		}
	}

	function persistAndRender() {
		schedulePersist();
		renderAll();
	}

	/* ------------------------------------------------------------------ */
	/*  Toast + modal                                                      */
	/* ------------------------------------------------------------------ */

	var toastTimer = null;

	function showToast(message, kind) {
		var toast = el('stm-toast');
		if (!toast) { return; }
		toast.textContent = message;
		toast.classList.remove('stm-toast-warn', 'stm-toast-error');
		if (kind === 'warn') { toast.classList.add('stm-toast-warn'); }
		if (kind === 'error') { toast.classList.add('stm-toast-error'); }
		toast.hidden = false;
		if (toastTimer) { window.clearTimeout(toastTimer); }
		toastTimer = window.setTimeout(function () { toast.hidden = true; }, 2600);
	}

	function openModal(title, bodyHtml, footHtml, context) {
		modalContext = context || null;
		el('stm-modal-title').textContent = title;
		el('stm-modal-body').innerHTML = bodyHtml;
		el('stm-modal-foot').innerHTML = footHtml || '';
		el('stm-modal-overlay').hidden = false;
	}

	function closeModal() {
		el('stm-modal-overlay').hidden = true;
		el('stm-modal-body').innerHTML = '';
		el('stm-modal-foot').innerHTML = '';
		modalContext = null;
	}

	function openConfirm(title, messageHtml, confirmLabel, callback) {
		confirmCallback = callback || null;
		confirmArmed = false;
		var foot = '<button type="button" class="stm-btn" data-act="confirm-cancel">Cancel</button>' +
			'<button type="button" class="stm-btn stm-btn-solid-danger" data-act="confirm-ok">' + esc(confirmLabel) + '</button>';
		openModal(title, messageHtml, foot, { modalKind: 'confirm' });
	}

	function armConfirmButton() {
		if (confirmArmed) { return; }
		confirmArmed = true;
		var button = document.querySelector('[data-act="confirm-ok"]');
		if (button) { button.textContent = 'Click again to confirm'; }
		confirmArmTimer = window.setTimeout(function () {
			confirmArmed = false;
			var resetButton = document.querySelector('[data-act="confirm-ok"]');
			if (resetButton && modalContext && modalContext.modalKind === 'confirm') {
				resetButton.textContent = modalContext.confirmLabel || 'Confirm';
			}
		}, 3000);
	}

	/* ------------------------------------------------------------------ */
	/*  Rendering shell                                                    */
	/* ------------------------------------------------------------------ */

	function renderAll() {
		renderHeader();
		renderTabs();
		renderActivePane();
		renderReadonlyBanner();
	}

	function renderHeader() {
		var tournamentName = DB.tournament.name || 'Sports Tournament Manager';
		el('stm-title').textContent = tournamentName;
		var sportBadge = el('stm-sport-badge');
		sportBadge.textContent = sportDefinition().label;
		el('stm-app').classList.toggle('stm-sport-hockey', DB.tournament.sport === 'hockey');
		var formatLabel = DB.tournament.format === 'knockout' ? 'Knockout bracket' : 'League standings';
		var seasonLabel = DB.tournament.season || 'Season not set';
		el('stm-subtitle').textContent = formatLabel + ' - ' + seasonLabel;
		el('stm-build-badge').textContent = 'tool build ' + TOOL_BUILD;
	}

	function renderTabs() {
		var tabs = el('stm-tabs');
		var buttons = tabs.querySelectorAll('.stm-tab');
		for (var i = 0; i < buttons.length; i++) {
			buttons[i].classList.toggle('stm-tab-active', buttons[i].getAttribute('data-tab') === DB.ui.tab);
		}
	}

	function renderActivePane() {
		var panes = ['overview', 'teams', 'players', 'matches', 'standings', 'bracket', 'settings'];
		panes.forEach(function (paneName) {
			var pane = el('pane-' + paneName);
			if (!pane) { return; }
			pane.classList.toggle('stm-pane-active', paneName === DB.ui.tab);
		});
		switch (DB.ui.tab) {
			case 'teams': renderTeamsPane(); break;
			case 'players': renderPlayersPane(); break;
			case 'matches': renderMatchesPane(); break;
			case 'standings': renderStandingsPane(); break;
			case 'bracket': renderBracketPane(); break;
			case 'settings': renderSettingsPane(); break;
			default: renderOverviewPane(); break;
		}
	}

	function switchTab(tabName) {
		if (VALID_TABS.indexOf(tabName) < 0) { return; }
		DB.ui.tab = tabName;
		schedulePersist();
		renderAll();
	}

	/* ------------------------------------------------------------------ */
	/*  Overview pane                                                      */
	/* ------------------------------------------------------------------ */

	function renderOverviewPane() {
		var pane = el('pane-overview');
		if (DB.teams.length === 0) {
			pane.innerHTML = buildEmptyStateHtml();
			return;
		}
		var finishedMatches = DB.matches.filter(function (match) { return match.status === 'finished'; });
		var scheduledMatches = DB.matches.filter(function (match) { return match.status === 'scheduled'; })
			.slice().sort(compareMatchChronology);
		var nextMatch = scheduledMatches.length ? scheduledMatches[0] : null;

		var statsHtml = [
			buildStatHtml(DB.teams.length, 'Teams'),
			buildStatHtml(DB.players.length, 'Players'),
			buildStatHtml(finishedMatches.length + ' / ' + DB.matches.length, 'Matches finished'),
			buildStatHtml(nextMatch ? formatDateBadge(nextMatch.date).day + ' ' + formatDateBadge(nextMatch.date).month : 'None', 'Next match')
		].join('');

		var leftHtml = '';
		var bracketHtml = '';
		if (DB.tournament.format === 'knockout') {
			bracketHtml = buildBracketSummaryHtml();
			if (bracketHtml) {
				leftHtml += '<div class="stm-list-section">' + bracketHtml + '</div>';
			}
		} else {
			var standingsPreview = computeStandings();
			var previewRows = standingsPreview.slice(0, 5);
			var previewBody = previewRows.map(function (row, index) {
				return '<tr>' +
					'<td class="stm-num"><span class="stm-pos-num">' + (index + 1) + '</span></td>' +
					'<td>' + teamNameCellHtml(row) + '</td>' +
					'<td class="stm-num">' + row.played + '</td>' +
					'<td class="stm-num">' + row.wins + '</td>' +
					'<td class="stm-num">' + row.draws + '</td>' +
					'<td class="stm-num">' + row.losses + '</td>' +
					'<td class="stm-num"><strong>' + row.points + '</strong></td>' +
					'</tr>';
			}).join('');
			leftHtml += '<div class="stm-card"><h3 class="stm-list-head" style="margin-top:0">Standings preview</h3>' +
				'<div class="stm-table-wrap"><table class="stm-table stm-mini-table"><thead><tr>' +
				'<th class="stm-num">#</th><th>Team</th><th class="stm-num">P</th><th class="stm-num">W</th>' +
				'<th class="stm-num">D</th><th class="stm-num">L</th><th class="stm-num">Pts</th>' +
				'</tr></thead><tbody>' + (previewBody || '<tr><td colspan="7">No finished matches yet.</td></tr>') +
				'</tbody></table></div>' +
				'<div style="margin-top:10px"><button type="button" class="stm-btn stm-btn-sm" data-tab-nav="standings">Full standings</button></div>' +
				'</div>';
		}

		var upcomingMatches = scheduledMatches.slice(0, 5);
		var upcomingHtml = upcomingMatches.map(buildMatchRowHtml).join('') ||
			'<p class="stm-confirm-text">No scheduled matches.</p>';
		leftHtml += '<div class="stm-list-section"><h3 class="stm-list-head">Upcoming matches</h3>' +
			'<div class="stm-match-list">' + upcomingHtml + '</div>' +
			'<div style="margin-top:10px"><button type="button" class="stm-btn stm-btn-sm" data-tab-nav="matches">Open schedule</button></div>' +
			'</div>';

		pane.innerHTML = '<div class="stm-stats">' + statsHtml + '</div>' +
			'<div class="stm-overview-cols"><div>' + leftHtml + '</div></div>';
	}

	function buildStatHtml(value, label) {
		return '<div class="stm-stat"><div class="stm-stat-value">' + esc(value) + '</div>' +
			'<div class="stm-stat-label">' + esc(label) + '</div></div>';
	}

	function buildBracketSummaryHtml() {
		var bracket = DB.bracket;
		if (!bracket) { return ''; }
		var finalRound = bracket.rounds[bracket.rounds.length - 1];
		var finalMatch = finalRound[0];
		if (!finalMatch) { return ''; }
		var championId = finalMatch.winnerTeamId;
		var championName = championId ? teamNameOf(championId) : null;
		if (championName) {
			return '<div class="stm-next-card" style="border-color:var(--stm-accent)">' +
				'<span class="stm-team-swatch" style="background:' + esc(teamColorOf(championId)) + '"></span>' +
				'<div class="stm-next-card-main"><div class="stm-next-card-title">Champion: ' + esc(championName) + '</div>' +
				'<div class="stm-next-card-sub">The knockout bracket has a winner.</div></div></div>';
		}
		return '<div class="stm-next-card"><div class="stm-next-card-main">' +
			'<div class="stm-next-card-title">Knockout bracket running</div>' +
			'<div class="stm-next-card-sub">Pick winners in the Bracket tab to advance teams to the final.</div></div></div>';
	}

	function buildEmptyStateHtml() {
		var steps = [
			'Create the teams that take part in the tournament.',
			'Add players to each team, with jersey numbers and positions.',
			'Schedule matches, enter scores, and the standings build themselves.'
		];
		var stepItems = steps.map(function (step, index) {
			return '<li><span class="stm-step-num">' + (index + 1) + '</span><span>' + esc(step) + '</span></li>';
		}).join('');
		var addButton = canEdit()
			? '<button type="button" class="stm-btn stm-btn-primary" data-tab-nav="teams">Add your first team</button>'
			: '';
		return '<div class="stm-empty">' +
			'<h2 class="stm-empty-title">Set up your tournament</h2>' +
			'<p class="stm-empty-text">A tournament runs on three building blocks: teams, players and matches. ' +
			'Once a match is finished, the standings table updates automatically.</p>' +
			'<ol class="stm-step-guide">' + stepItems + '</ol>' + addButton + '</div>';
	}

	/* ------------------------------------------------------------------ */
	/*  Teams pane                                                         */
	/* ------------------------------------------------------------------ */

	function renderTeamsPane() {
		var pane = el('pane-teams');
		var addButton = canEdit()
			? '<button type="button" class="stm-btn stm-btn-primary" data-act="open-team-modal">Add team</button>'
			: '';
		var head = '<div class="stm-pane-head"><div><h2 class="stm-pane-title">Teams</h2>' +
			'<p class="stm-pane-sub">' + DB.teams.length + ' team' + (DB.teams.length === 1 ? '' : 's') + ' registered.</p></div>' +
			'<div class="stm-pane-tools">' + addButton + '</div></div>';

		if (DB.teams.length === 0) {
			pane.innerHTML = head + '<div class="stm-empty"><h3 class="stm-empty-title">No teams yet</h3>' +
				'<p class="stm-empty-text">Create the first team to start the tournament.</p></div>';
			return;
		}

		var cards = DB.teams.map(function (team) {
			var playerCount = playersOfTeam(team.id).length;
			var actions = canEdit()
				? '<div class="stm-team-card-actions">' +
					'<button type="button" class="stm-btn stm-btn-sm" data-act="open-team-modal" data-team-id="' + esc(team.id) + '">Edit</button>' +
					'<button type="button" class="stm-btn stm-btn-sm stm-btn-danger" data-act="delete-team" data-team-id="' + esc(team.id) + '">Remove</button>' +
					'</div>'
				: '';
			return '<div class="stm-team-card">' +
				'<div class="stm-team-card-head">' +
				'<span class="stm-team-swatch" style="background:' + esc(team.color) + '"></span>' +
				'<div><div class="stm-team-name">' + esc(team.name) + '</div>' +
				(team.shortName ? '<span class="stm-team-code">' + esc(team.shortName) + '</span>' : '') +
				'</div></div>' +
				'<p class="stm-team-meta">' +
				(team.coach ? '<span><strong>Coach:</strong> ' + esc(team.coach) + '</span>' : '') +
				(team.contact ? '<span><strong>Contact:</strong> ' + esc(team.contact) + '</span>' : '') +
				'<span><strong>Players:</strong> ' + playerCount + '</span></p>' +
				actions + '</div>';
		}).join('');

		pane.innerHTML = head + '<div class="stm-grid-teams">' + cards + '</div>';
	}

	function teamFormHtml(team) {
		team = team || { name: '', shortName: '', color: '#15803d', coach: '', contact: '' };
		return '<div class="stm-form">' +
			'<div class="stm-form-field"><label for="team-form-name">Team name</label>' +
			'<input type="text" id="team-form-name" value="' + esc(team.name) + '" maxlength="80" placeholder="e.g. Riverside FC"></div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="team-form-short">Short code</label>' +
			'<input type="text" id="team-form-short" value="' + esc(team.shortName) + '" maxlength="10" placeholder="e.g. RIV"></div>' +
			'<div class="stm-form-field"><label for="team-form-color">Team color</label>' +
			'<input type="color" id="team-form-color" value="' + esc(team.color) + '"></div>' +
			'</div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="team-form-coach">Coach / manager</label>' +
			'<input type="text" id="team-form-coach" value="' + esc(team.coach) + '" maxlength="80"></div>' +
			'<div class="stm-form-field"><label for="team-form-contact">Contact</label>' +
			'<input type="text" id="team-form-contact" value="' + esc(team.contact) + '" maxlength="120" placeholder="phone or email"></div>' +
			'</div></div>';
	}

	function openTeamModal(teamId) {
		if (!canEdit()) { return; }
		var team = teamId ? teamById(teamId) : null;
		var foot = '<button type="button" class="stm-btn" data-act="modal-cancel">Cancel</button>' +
			'<button type="button" class="stm-btn stm-btn-primary" data-act="save-team">' + (team ? 'Save team' : 'Add team') + '</button>';
		openModal(team ? 'Edit team' : 'Add team', teamFormHtml(team), foot, { modalKind: 'team', teamId: team ? team.id : null });
	}

	function saveTeamFromModal() {
		var nameInput = el('team-form-name');
		var name = nameInput ? nameInput.value.trim() : '';
		if (!name) {
			showToast('A team needs a name.', 'error');
			return;
		}
		var shortName = (el('team-form-short').value || '').trim().toUpperCase().slice(0, 10);
		var color = el('team-form-color').value || '#15803d';
		var coach = (el('team-form-coach').value || '').trim();
		var contact = (el('team-form-contact').value || '').trim();
		var teamId = modalContext && modalContext.teamId;
		if (teamId) {
			var existingTeam = teamById(teamId);
			if (!existingTeam) { closeModal(); return; }
			existingTeam.name = name;
			existingTeam.shortName = shortName;
			existingTeam.color = color;
			existingTeam.coach = coach;
			existingTeam.contact = contact;
		} else {
			DB.teams.push({ id: uniqueId('t'), name: name, shortName: shortName, color: color, coach: coach, contact: contact });
			rebuildBracketIfPresent();
		}
		closeModal();
		persistAndRender();
		showToast(teamId ? 'Team updated.' : 'Team added.');
	}

	function deleteTeam(teamId) {
		var team = teamById(teamId);
		if (!team) { return; }
		openConfirm('Remove team',
			'<p class="stm-confirm-text">Remove <strong>' + esc(team.name) + '</strong>? Its players and matches are removed with it. This cannot be undone.</p>',
			'Remove team',
			function () {
				DB.teams = DB.teams.filter(function (item) { return item.id !== teamId; });
				DB.players = DB.players.filter(function (player) { return player.teamId !== teamId; });
				DB.matches = DB.matches.filter(function (match) {
					return match.homeTeamId !== teamId && match.awayTeamId !== teamId;
				});
				rebuildBracketIfPresent();
				closeModal();
				persistAndRender();
				showToast('Team removed.');
			});
	}

	/* ------------------------------------------------------------------ */
	/*  Players pane                                                       */
	/* ------------------------------------------------------------------ */

	var playerFilter = { teamId: '', search: '' };

	function renderPlayersPane() {
		var pane = el('pane-players');
		var addButton = canEdit()
			? '<button type="button" class="stm-btn stm-btn-primary" data-act="open-player-modal">Add player</button>'
			: '';
		var head = '<div class="stm-pane-head"><div><h2 class="stm-pane-title">Players</h2>' +
			'<p class="stm-pane-sub">Rosters for every team.</p></div>' +
			'<div class="stm-pane-tools">' + addButton + '</div></div>';

		if (DB.teams.length === 0) {
			pane.innerHTML = head + '<div class="stm-empty"><h3 class="stm-empty-title">No teams to hold players</h3>' +
				'<p class="stm-empty-text">Create at least one team before adding players.</p>' +
				(canEdit() ? '<button type="button" class="stm-btn stm-btn-primary" data-tab-nav="teams">Go to teams</button>' : '') +
				'</div>';
			return;
		}

		var teamOptions = '<option value="">All teams</option>' + DB.teams.map(function (team) {
			return '<option value="' + esc(team.id) + '"' + (playerFilter.teamId === team.id ? ' selected' : '') + '>' + esc(team.name) + '</option>';
		}).join('');

		var filters = '<div class="stm-filter-row">' +
			'<select data-filter="player-team">' + teamOptions + '</select>' +
			'<input type="search" placeholder="Search name or number..." value="' + esc(playerFilter.search) + '" data-filter="player-search">' +
			'</div>';

		var visiblePlayers = DB.players.filter(function (player) {
			if (playerFilter.teamId && player.teamId !== playerFilter.teamId) { return false; }
			if (playerFilter.search) {
				var needle = playerFilter.search.toLowerCase();
				var numberText = player.number === null ? '' : String(player.number);
				if (player.name.toLowerCase().indexOf(needle) < 0 && numberText.indexOf(needle) < 0 &&
					player.position.toLowerCase().indexOf(needle) < 0) { return false; }
			}
			return true;
		}).slice().sort(function (playerA, playerB) {
			var teamCompare = teamNameOf(playerA.teamId).localeCompare(teamNameOf(playerB.teamId));
			if (teamCompare !== 0) { return teamCompare; }
			var numberA = playerA.number === null ? 9999 : playerA.number;
			var numberB = playerB.number === null ? 9999 : playerB.number;
			if (numberA !== numberB) { return numberA - numberB; }
			return playerA.name.localeCompare(playerB.name);
		});

		var rows = visiblePlayers.map(function (player) {
			var actions = canEdit()
				? '<div class="stm-match-side">' +
					'<button type="button" class="stm-btn stm-btn-sm" data-act="open-player-modal" data-player-id="' + esc(player.id) + '">Edit</button>' +
					'<button type="button" class="stm-btn stm-btn-sm stm-btn-danger" data-act="delete-player" data-player-id="' + esc(player.id) + '">Remove</button>' +
					'</div>'
				: '';
			return '<tr>' +
				'<td class="stm-num"><span class="stm-pos-num">' + (player.number === null ? '-' : player.number) + '</span></td>' +
				'<td>' + esc(player.name) + (player.notes ? '<div class="stm-match-sub">' + esc(player.notes) + '</div>' : '') + '</td>' +
				'<td>' + esc(teamNameOf(player.teamId)) + '</td>' +
				'<td>' + (player.position ? esc(player.position) : '-') + '</td>' +
				'<td>' + actions + '</td></tr>';
		}).join('');

		var tableHtml = '<div class="stm-table-wrap"><table class="stm-table"><thead><tr>' +
			'<th class="stm-num">No.</th><th>Player</th><th>Team</th><th>Position</th><th></th>' +
			'</tr></thead><tbody>' +
			(rows || '<tr><td colspan="5">No players match this filter.</td></tr>') +
			'</tbody></table></div>';

		pane.innerHTML = head + filters + tableHtml;
	}

	function playerFormHtml(player) {
		player = player || { teamId: playerFilter.teamId || (DB.teams[0] ? DB.teams[0].id : ''), name: '', number: '', position: '', notes: '' };
		var teamOptions = DB.teams.map(function (team) {
			return '<option value="' + esc(team.id) + '"' + (player.teamId === team.id ? ' selected' : '') + '>' + esc(team.name) + '</option>';
		}).join('');
		var positionOptions = positionOptionsFor(player.position).map(function (position) {
			return '<option value="' + esc(position) + '"' + (player.position === position ? ' selected' : '') + '>' + esc(position) + '</option>';
		}).join('');
		return '<div class="stm-form">' +
			'<div class="stm-form-field"><label for="player-form-name">Player name</label>' +
			'<input type="text" id="player-form-name" value="' + esc(player.name) + '" maxlength="80" placeholder="e.g. Alex Reid"></div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="player-form-team">Team</label>' +
			'<select id="player-form-team">' + teamOptions + '</select></div>' +
			'<div class="stm-form-field"><label for="player-form-number">Jersey number</label>' +
			'<input type="number" id="player-form-number" min="0" max="999" value="' + (player.number === null ? '' : player.number) + '"></div>' +
			'</div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="player-form-position">Position</label>' +
			'<select id="player-form-position">' + positionOptions + '</select></div>' +
			'<div class="stm-form-field"><label for="player-form-notes">Notes</label>' +
			'<input type="text" id="player-form-notes" value="' + esc(player.notes) + '" maxlength="300" placeholder="captain, injury status..."></div>' +
			'</div></div>';
	}

	function openPlayerModal(playerId) {
		if (!canEdit()) { return; }
		var player = playerId ? DB.players.filter(function (item) { return item.id === playerId; })[0] : null;
		var foot = '<button type="button" class="stm-btn" data-act="modal-cancel">Cancel</button>' +
			'<button type="button" class="stm-btn stm-btn-primary" data-act="save-player">' + (player ? 'Save player' : 'Add player') + '</button>';
		openModal(player ? 'Edit player' : 'Add player', playerFormHtml(player), foot, { modalKind: 'player', playerId: player ? player.id : null });
	}

	function savePlayerFromModal() {
		var name = (el('player-form-name').value || '').trim();
		if (!name) {
			showToast('A player needs a name.', 'error');
			return;
		}
		var teamId = el('player-form-team').value;
		if (!teamById(teamId)) {
			showToast('Choose a team for this player.', 'error');
			return;
		}
		var numberValue = el('player-form-number').value;
		var number = isNumericScore(numberValue) ? clampInteger(numberValue, 0, 999) : null;
		var position = el('player-form-position').value || '';
		var notes = (el('player-form-notes').value || '').trim();
		var playerId = modalContext && modalContext.playerId;
		if (playerId) {
			var existingPlayer = DB.players.filter(function (item) { return item.id === playerId; })[0];
			if (!existingPlayer) { closeModal(); return; }
			existingPlayer.teamId = teamId;
			existingPlayer.name = name;
			existingPlayer.number = number;
			existingPlayer.position = position;
			existingPlayer.notes = notes;
		} else {
			DB.players.push({ id: uniqueId('p'), teamId: teamId, name: name, number: number, position: position, notes: notes });
		}
		closeModal();
		persistAndRender();
		showToast(playerId ? 'Player updated.' : 'Player added.');
	}

	function deletePlayer(playerId) {
		var player = DB.players.filter(function (item) { return item.id === playerId; })[0];
		if (!player) { return; }
		openConfirm('Remove player',
			'<p class="stm-confirm-text">Remove <strong>' + esc(player.name) + '</strong> from the roster?</p>',
			'Remove player',
			function () {
				DB.players = DB.players.filter(function (item) { return item.id !== playerId; });
				closeModal();
				persistAndRender();
				showToast('Player removed.');
			});
	}

	/* ------------------------------------------------------------------ */
	/*  Matches pane                                                       */
	/* ------------------------------------------------------------------ */

	var matchFilter = { teamId: '', status: 'all' };

	function renderMatchesPane() {
		var pane = el('pane-matches');
		var addButton = canEdit() && DB.teams.length >= 2
			? '<button type="button" class="stm-btn stm-btn-primary" data-act="open-match-modal">Schedule match</button>'
			: '';
		var head = '<div class="stm-pane-head"><div><h2 class="stm-pane-title">Matches</h2>' +
			'<p class="stm-pane-sub">Schedule games and enter final scores.</p></div>' +
			'<div class="stm-pane-tools">' + addButton + '</div></div>';

		if (DB.teams.length < 2) {
			pane.innerHTML = head + '<div class="stm-empty"><h3 class="stm-empty-title">Matches need two teams</h3>' +
				'<p class="stm-empty-text">Create at least two teams before scheduling the first match.</p>' +
				(canEdit() ? '<button type="button" class="stm-btn stm-btn-primary" data-tab-nav="teams">Go to teams</button>' : '') +
				'</div>';
			return;
		}

		var teamOptions = '<option value="">All teams</option>' + DB.teams.map(function (team) {
			return '<option value="' + esc(team.id) + '"' + (matchFilter.teamId === team.id ? ' selected' : '') + '>' + esc(team.name) + '</option>';
		}).join('');
		var statusChips = [
			{ value: 'all', label: 'All' },
			{ value: 'scheduled', label: 'Scheduled' },
			{ value: 'finished', label: 'Finished' }
		].map(function (chip) {
			return '<button type="button" class="stm-chip' + (matchFilter.status === chip.value ? ' stm-chip-on' : '') + '" data-filter="match-status" data-status="' + chip.value + '">' + chip.label + '</button>';
		}).join('');

		var filters = '<div class="stm-filter-row">' +
			'<select data-filter="match-team">' + teamOptions + '</select>' +
			'<span class="stm-chip-row">' + statusChips + '</span></div>';

		var visibleMatches = DB.matches.filter(function (match) {
			if (matchFilter.teamId && match.homeTeamId !== matchFilter.teamId && match.awayTeamId !== matchFilter.teamId) { return false; }
			if (matchFilter.status !== 'all' && match.status !== matchFilter.status) { return false; }
			return true;
		}).slice().sort(compareMatchChronology);

		var scheduledMatches = visibleMatches.filter(function (match) { return match.status === 'scheduled'; });
		var finishedMatches = visibleMatches.filter(function (match) { return match.status === 'finished'; })
			.slice().reverse();

		var scheduledHtml = scheduledMatches.map(buildMatchRowHtml).join('') ||
			'<p class="stm-confirm-text">No scheduled matches' + (matchFilter.status === 'all' ? '' : ' in this filter') + '.</p>';
		var finishedHtml = finishedMatches.map(buildMatchRowHtml).join('') ||
			'<p class="stm-confirm-text">No finished matches' + (matchFilter.status === 'all' ? '' : ' in this filter') + '.</p>';

		var scheduledSection = (matchFilter.status === 'finished') ? '' :
			'<div class="stm-list-section"><h3 class="stm-list-head">Upcoming</h3>' +
			'<div class="stm-match-list">' + scheduledHtml + '</div></div>';
		var finishedSection = (matchFilter.status === 'scheduled') ? '' :
			'<div class="stm-list-section"><h3 class="stm-list-head">Finished</h3>' +
			'<div class="stm-match-list">' + finishedHtml + '</div></div>';

		pane.innerHTML = head + filters + scheduledSection + finishedSection;
	}

	function buildMatchRowHtml(match) {
		var dateBadge = formatDateBadge(match.date);
		var dateHtml = match.date
			? '<div class="stm-match-date"><span class="stm-match-date-day">' + dateBadge.day + '</span>' +
				'<span class="stm-match-date-month">' + dateBadge.month + '</span></div>'
			: '<div class="stm-match-date stm-match-date-empty">date not set</div>';

		var scoreText = '-';
		var homeIsWinner = false;
		var awayIsWinner = false;
		if (match.status === 'finished' && match.homeScore !== null && match.awayScore !== null) {
			scoreText = match.homeScore + ' - ' + match.awayScore;
			homeIsWinner = match.homeScore > match.awayScore;
			awayIsWinner = match.awayScore > match.homeScore;
		}

		var subParts = [];
		if (match.time) { subParts.push(esc(match.time)); }
		if (match.venue) { subParts.push(esc(match.venue)); }
		if (match.round) { subParts.push(esc(match.round)); }
		if (match.status === 'finished' && match.decided === 'ot') { subParts.push('Overtime'); }
		if (match.status === 'finished' && match.decided === 'so') { subParts.push('Shootout'); }

		var statusPill = match.status === 'finished'
			? '<span class="stm-pill stm-pill-finished">Finished</span>'
			: '<span class="stm-pill stm-pill-scheduled">Scheduled</span>';

		var actions = canEdit()
			? '<div class="stm-match-side">' + statusPill +
				'<button type="button" class="stm-btn stm-btn-sm" data-act="open-match-modal" data-match-id="' + esc(match.id) + '">Edit</button>' +
				'<button type="button" class="stm-btn stm-btn-sm stm-btn-danger" data-act="delete-match" data-match-id="' + esc(match.id) + '">Remove</button>' +
				'</div>'
			: '<div class="stm-match-side">' + statusPill + '</div>';

		return '<div class="stm-match-row">' + dateHtml +
			'<div class="stm-match-main">' +
			'<div class="stm-match-line">' +
			'<span class="stm-match-team' + (homeIsWinner ? ' stm-match-winner' : '') + '">' + esc(teamNameOf(match.homeTeamId)) + '</span>' +
			'<span class="stm-match-score">' + scoreText + '</span>' +
			'<span class="stm-match-team' + (awayIsWinner ? ' stm-match-winner' : '') + '">' + esc(teamNameOf(match.awayTeamId)) + '</span>' +
			'</div>' +
			(subParts.length ? '<div class="stm-match-sub">' + subParts.join(' - ') + '</div>' : '') +
			'</div>' + actions + '</div>';
	}

	function matchFormHtml(match) {
		match = match || {
			homeTeamId: DB.teams[0].id,
			awayTeamId: DB.teams[1].id,
			date: '', time: '', venue: '', round: '',
			status: 'scheduled', homeScore: null, awayScore: null, decided: 'reg'
		};
		var teamOptions = DB.teams.map(function (team) {
			return '<option value="' + esc(team.id) + '"' + (match.homeTeamId === team.id ? ' selected' : '') + '>' + esc(team.name) + '</option>';
		}).join('');
		var awayTeamOptions = DB.teams.map(function (team) {
			return '<option value="' + esc(team.id) + '"' + (match.awayTeamId === team.id ? ' selected' : '') + '>' + esc(team.name) + '</option>';
		}).join('');
		var venueOptions = DB.tournament.venues.map(function (venue) {
			return '<option value="' + esc(venue) + '"></option>';
		}).join('');

		var statusOptions = MATCH_STATUSES.map(function (status) {
			return '<option value="' + status + '"' + (match.status === status ? ' selected' : '') + '>' +
				(status === 'finished' ? 'Finished' : 'Scheduled') + '</option>';
		}).join('');

		var deciderHtml = '';
		if (DB.tournament.sport === 'hockey') {
			var deciderOptions = HOCKEY_DECIDERS.map(function (decider) {
				return '<option value="' + decider.value + '"' + (match.decided === decider.value ? ' selected' : '') + '>' + decider.label + '</option>';
			}).join('');
			deciderHtml = '<div class="stm-form-field"><label for="match-form-decided">Decided in</label>' +
				'<select id="match-form-decided">' + deciderOptions + '</select>' +
				'<p class="stm-form-hint">How the winner was decided, for overtime and shootout points.</p></div>';
		}

		return '<div class="stm-form">' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="match-form-home">Home team</label>' +
			'<select id="match-form-home">' + teamOptions + '</select></div>' +
			'<div class="stm-form-field"><label for="match-form-away">Away team</label>' +
			'<select id="match-form-away">' + awayTeamOptions + '</select></div>' +
			'</div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="match-form-date">Date</label>' +
			'<input type="date" id="match-form-date" value="' + esc(match.date) + '"></div>' +
			'<div class="stm-form-field"><label for="match-form-time">Time</label>' +
			'<input type="time" id="match-form-time" value="' + esc(match.time) + '"></div>' +
			'</div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="match-form-venue">Venue</label>' +
			'<input type="text" id="match-form-venue" list="stm-venue-options" value="' + esc(match.venue) + '" maxlength="120">' +
			'<datalist id="stm-venue-options">' + venueOptions + '</datalist></div>' +
			'<div class="stm-form-field"><label for="match-form-round">Round / group</label>' +
			'<input type="text" id="match-form-round" value="' + esc(match.round) + '" maxlength="60" placeholder="e.g. Round 1, Group A"></div>' +
			'</div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="match-form-status">Status</label>' +
			'<select id="match-form-status">' + statusOptions + '</select>' +
			'<p class="stm-form-hint">Entering both scores marks the match Finished automatically.</p></div>' +
			'<div class="stm-form-field"><label for="match-form-scores">Score</label>' +
			'<div style="display:flex;gap:8px;align-items:center">' +
			'<input type="number" id="match-form-home-score" min="0" max="999" placeholder="Home" value="' + (match.homeScore === null ? '' : match.homeScore) + '">' +
			'<span style="color:var(--stm-muted)">-</span>' +
			'<input type="number" id="match-form-away-score" min="0" max="999" placeholder="Away" value="' + (match.awayScore === null ? '' : match.awayScore) + '">' +
			'</div></div>' +
			'</div>' +
			deciderHtml +
			'</div>';
	}

	function openMatchModal(matchId) {
		if (!canEdit()) { return; }
		var match = matchId ? DB.matches.filter(function (item) { return item.id === matchId; })[0] : null;
		var foot = '<button type="button" class="stm-btn" data-act="modal-cancel">Cancel</button>' +
			'<button type="button" class="stm-btn stm-btn-primary" data-act="save-match">' + (match ? 'Save match' : 'Schedule match') + '</button>';
		openModal(match ? 'Edit match' : 'Schedule match', matchFormHtml(match), foot, { modalKind: 'match', matchId: match ? match.id : null });
	}

	function saveMatchFromModal() {
		var homeTeamId = el('match-form-home').value;
		var awayTeamId = el('match-form-away').value;
		if (!teamById(homeTeamId) || !teamById(awayTeamId)) {
			showToast('Both teams are required.', 'error');
			return;
		}
		if (homeTeamId === awayTeamId) {
			showToast('A team cannot play itself. Choose two different teams.', 'error');
			return;
		}
		var homeScore = scoreOf(el('match-form-home-score').value);
		var awayScore = scoreOf(el('match-form-away-score').value);
		var status = el('match-form-status').value;
		var decided = DB.tournament.sport === 'hockey' ? el('match-form-decided').value : 'reg';
		var date = el('match-form-date').value || '';
		var time = el('match-form-time').value || '';
		var venue = (el('match-form-venue').value || '').trim();
		var round = (el('match-form-round').value || '').trim();

		if ((homeScore === null) !== (awayScore === null)) {
			showToast('Enter both scores or leave both empty.', 'error');
			return;
		}
		if (homeScore !== null && awayScore !== null) { status = 'finished'; }
		if (status === 'finished' && (homeScore === null || awayScore === null)) {
			showToast('A finished match needs a final score.', 'error');
			return;
		}
		if (status === 'finished' && DB.tournament.sport === 'hockey' && homeScore === awayScore) {
			showToast('Hockey games cannot end tied. Enter the final score after overtime or the shootout.', 'error');
			return;
		}

		var matchId = modalContext && modalContext.matchId;
		if (matchId) {
			var existingMatch = DB.matches.filter(function (item) { return item.id === matchId; })[0];
			if (!existingMatch) { closeModal(); return; }
			existingMatch.homeTeamId = homeTeamId;
			existingMatch.awayTeamId = awayTeamId;
			existingMatch.date = date;
			existingMatch.time = time;
			existingMatch.venue = venue;
			existingMatch.round = round;
			existingMatch.status = status;
			existingMatch.homeScore = homeScore;
			existingMatch.awayScore = awayScore;
			existingMatch.decided = decided;
		} else {
			DB.matches.push({
				id: uniqueId('g'), homeTeamId: homeTeamId, awayTeamId: awayTeamId,
				date: date, time: time, venue: venue, round: round,
				status: status, homeScore: homeScore, awayScore: awayScore, decided: decided
			});
		}
		if (venue && DB.tournament.venues.indexOf(venue) < 0) { DB.tournament.venues.push(venue); }
		closeModal();
		persistAndRender();
		showToast(status === 'finished' ? 'Match saved and counted in the standings.' : 'Match scheduled.');
	}

	function deleteMatch(matchId) {
		var match = DB.matches.filter(function (item) { return item.id === matchId; })[0];
		if (!match) { return; }
		var label = teamNameOf(match.homeTeamId) + ' vs ' + teamNameOf(match.awayTeamId);
		openConfirm('Remove match',
			'<p class="stm-confirm-text">Remove <strong>' + esc(label) + '</strong> from the schedule? This cannot be undone.</p>',
			'Remove match',
			function () {
				DB.matches = DB.matches.filter(function (item) { return item.id !== matchId; });
				closeModal();
				persistAndRender();
				showToast('Match removed.');
			});
	}

	/* ------------------------------------------------------------------ */
	/*  Standings                                                          */
	/* ------------------------------------------------------------------ */

	function computeStandings() {
		var rows = {};
		DB.teams.forEach(function (team) {
			rows[team.id] = {
				teamId: team.id,
				name: team.name,
				shortName: team.shortName || team.name.slice(0, 3).toUpperCase(),
				color: team.color,
				played: 0,
				wins: 0,
				draws: 0,
				otWins: 0,
				otLosses: 0,
				losses: 0,
				goalsFor: 0,
				goalsAgainst: 0,
				points: 0
			};
		});

		var pointsConfig = pointsConfigForCurrentSport();
		var isHockey = DB.tournament.sport === 'hockey';

		DB.matches.forEach(function (match) {
			if (match.status !== 'finished') { return; }
			var homeRow = rows[match.homeTeamId];
			var awayRow = rows[match.awayTeamId];
			if (!homeRow || !awayRow) { return; }
			if (match.homeScore === null || match.awayScore === null) { return; }
			homeRow.played += 1;
			awayRow.played += 1;
			homeRow.goalsFor += match.homeScore;
			homeRow.goalsAgainst += match.awayScore;
			awayRow.goalsFor += match.awayScore;
			awayRow.goalsAgainst += match.homeScore;

			if (match.homeScore > match.awayScore) {
				if (isHockey && (match.decided === 'ot' || match.decided === 'so')) {
					homeRow.otWins += 1;
					awayRow.otLosses += 1;
					homeRow.points += pointsConfig.otWin;
					awayRow.points += pointsConfig.otLoss;
				} else {
					homeRow.wins += 1;
					awayRow.losses += 1;
					homeRow.points += pointsConfig.win;
					awayRow.points += pointsConfig.loss;
				}
			} else if (match.awayScore > match.homeScore) {
				if (isHockey && (match.decided === 'ot' || match.decided === 'so')) {
					awayRow.otWins += 1;
					homeRow.otLosses += 1;
					awayRow.points += pointsConfig.otWin;
					homeRow.points += pointsConfig.otLoss;
				} else {
					awayRow.wins += 1;
					homeRow.losses += 1;
					awayRow.points += pointsConfig.win;
					homeRow.points += pointsConfig.loss;
				}
			} else {
				homeRow.draws += 1;
				awayRow.draws += 1;
				homeRow.points += pointsConfig.draw;
				awayRow.points += pointsConfig.draw;
			}
		});

		var sortedRows = Object.keys(rows).map(function (teamId) { return rows[teamId]; });
		sortedRows.sort(function (rowA, rowB) {
			if (rowB.points !== rowA.points) { return rowB.points - rowA.points; }
			var differenceA = rowA.goalsFor - rowA.goalsAgainst;
			var differenceB = rowB.goalsFor - rowB.goalsAgainst;
			if (differenceB !== differenceA) { return differenceB - differenceA; }
			if (rowB.goalsFor !== rowA.goalsFor) { return rowB.goalsFor - rowA.goalsFor; }
			return rowA.name.localeCompare(rowB.name);
		});
		return sortedRows;
	}

	function teamNameCellHtml(row) {
		return '<span class="stm-team-swatch" style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;background:' +
			esc(row.color) + '"></span>' + esc(row.name);
	}

	function renderStandingsPane() {
		var pane = el('pane-standings');
		var isHockey = DB.tournament.sport === 'hockey';
		var head = '<div class="stm-pane-head"><div><h2 class="stm-pane-title">Standings</h2>' +
			'<p class="stm-pane-sub">' + (isHockey
				? 'Points: win ' + DB.tournament.hockeyPoints.win + ', overtime / shootout win ' + DB.tournament.hockeyPoints.otWin + ', overtime / shootout loss ' + DB.tournament.hockeyPoints.otLoss + ', loss ' + DB.tournament.hockeyPoints.loss + '.'
				: 'Points: win ' + DB.tournament.points.win + ', draw ' + DB.tournament.points.draw + ', loss ' + DB.tournament.points.loss + '.') +
			'</p></div></div>';

		if (DB.teams.length === 0) {
			pane.innerHTML = head + '<div class="stm-empty"><h3 class="stm-empty-title">No teams to rank</h3>' +
				'<p class="stm-empty-text">The standings table appears once teams are registered.</p></div>';
			return;
		}

		var standings = computeStandings();
		var headerCells = '<th class="stm-num">#</th><th>Team</th><th class="stm-num">P</th>' +
			(isHockey ? '<th class="stm-num">W</th><th class="stm-num">OTW</th><th class="stm-num">OTL</th><th class="stm-num">L</th>'
				: '<th class="stm-num">W</th><th class="stm-num">D</th><th class="stm-num">L</th>') +
			'<th class="stm-num">GF</th><th class="stm-num">GA</th><th class="stm-num">GD</th><th class="stm-num">Pts</th>';

		var bodyRows = standings.map(function (row, index) {
			var goalDifference = row.goalsFor - row.goalsAgainst;
			var middleCells = isHockey
				? '<td class="stm-num">' + row.wins + '</td><td class="stm-num">' + row.otWins + '</td><td class="stm-num">' + row.otLosses + '</td><td class="stm-num">' + row.losses + '</td>'
				: '<td class="stm-num">' + row.wins + '</td><td class="stm-num">' + row.draws + '</td><td class="stm-num">' + row.losses + '</td>';
			return '<tr class="' + (index < 3 && row.played > 0 ? 'stm-row-top' : '') + '">' +
				'<td class="stm-num"><span class="stm-pos-num">' + (index + 1) + '</span></td>' +
				'<td>' + teamNameCellHtml(row) + '</td>' +
				'<td class="stm-num">' + row.played + '</td>' + middleCells +
				'<td class="stm-num">' + row.goalsFor + '</td>' +
				'<td class="stm-num">' + row.goalsAgainst + '</td>' +
				'<td class="stm-num">' + (goalDifference > 0 ? '+' : '') + goalDifference + '</td>' +
				'<td class="stm-num"><strong>' + row.points + '</strong></td></tr>';
		}).join('');

		var note = '';
		if (DB.matches.filter(function (match) { return match.status === 'finished'; }).length === 0) {
			note = '<p class="stm-form-hint" style="margin-top:12px">The table is empty until the first match is finished. Scores are entered in the Matches tab.</p>';
		}

		pane.innerHTML = head + '<div class="stm-table-wrap"><table class="stm-table"><thead><tr>' + headerCells +
			'</tr></thead><tbody>' + bodyRows + '</tbody></table></div>' + note;
	}

	/* ------------------------------------------------------------------ */
	/*  Bracket (knockout)                                                 */
	/* ------------------------------------------------------------------ */

	function rebuildBracketIfPresent() {
		if (!DB.bracket) { return; }
		buildBracket();
	}

	function buildBracket() {
		if (DB.teams.length < 2) {
			DB.bracket = null;
			return;
		}
		var teamIds = DB.teams.map(function (team) { return team.id; });
		var bracketSize = 1;
		while (bracketSize < teamIds.length) { bracketSize = bracketSize * 2; }

		var rounds = [];
		var firstRound = [];
		var firstRoundMatchCount = bracketSize / 2;
		for (var matchIndex = 0; matchIndex < firstRoundMatchCount; matchIndex++) {
			var homeId = teamIds[matchIndex * 2] || null;
			var awayId = teamIds[matchIndex * 2 + 1] || null;
			firstRound.push({
				id: uniqueId('m'),
				homeTeamId: homeId,
				awayTeamId: awayId,
				winnerTeamId: (homeId && !awayId) ? homeId : (!homeId && awayId) ? awayId : null
			});
		}
		rounds.push(firstRound);

		var previousRound = firstRound;
		while (previousRound.length > 1) {
			var nextRound = [];
			for (var slotIndex = 0; slotIndex < previousRound.length / 2; slotIndex++) {
				nextRound.push({ id: uniqueId('m'), homeTeamId: null, awayTeamId: null, winnerTeamId: null });
			}
			rounds.push(nextRound);
			previousRound = nextRound;
		}

		DB.bracket = { rounds: rounds };
		resolveBracketWinners();
	}

	function resolveBracketWinners() {
		if (!DB.bracket) { return; }
		for (var roundIndex = 0; roundIndex < DB.bracket.rounds.length; roundIndex++) {
			var round = DB.bracket.rounds[roundIndex];
			for (var matchIndex = 0; matchIndex < round.length; matchIndex++) {
				var match = round[matchIndex];
				if (match.winnerTeamId) {
					propagateBracketWinner(roundIndex, matchIndex);
					continue;
				}
				/* Byes exist only in the first round: a team without an
				   opponent there advances automatically. In later rounds a
				   missing opponent means the matchup is still undecided. */
				if (roundIndex !== 0) { continue; }
				if (match.homeTeamId && !match.awayTeamId) {
					match.winnerTeamId = match.homeTeamId;
					propagateBracketWinner(roundIndex, matchIndex);
				} else if (!match.homeTeamId && match.awayTeamId) {
					match.winnerTeamId = match.awayTeamId;
					propagateBracketWinner(roundIndex, matchIndex);
				}
			}
		}
	}

	function propagateBracketWinner(changedRoundIndex, changedMatchIndex) {
		if (!DB.bracket) { return; }
		var roundIndex = changedRoundIndex;
		var matchIndex = changedMatchIndex;
		while (roundIndex + 1 < DB.bracket.rounds.length) {
			var slotIndex = Math.floor(matchIndex / 2);
			var nextMatch = DB.bracket.rounds[roundIndex + 1][slotIndex];
			var sourceMatch = DB.bracket.rounds[roundIndex][matchIndex];
			if (!nextMatch || !sourceMatch) { return; }
			if (matchIndex % 2 === 0) {
				nextMatch.homeTeamId = sourceMatch.winnerTeamId;
			} else {
				nextMatch.awayTeamId = sourceMatch.winnerTeamId;
			}
			nextMatch.winnerTeamId = null;
			roundIndex += 1;
			matchIndex = slotIndex;
		}
	}

	function pickBracketWinner(roundIndex, matchIndex, teamId) {
		if (!canEdit()) { return; }
		if (!DB.bracket) { return; }
		var round = DB.bracket.rounds[roundIndex];
		var match = round ? round[matchIndex] : null;
		if (!match) { return; }
		if (!match.homeTeamId || !match.awayTeamId) { return; }
		if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) { return; }
		match.winnerTeamId = match.winnerTeamId === teamId ? null : teamId;
		propagateBracketWinner(roundIndex, matchIndex);
		persistAndRender();
	}

	function clearBracket() {
		DB.bracket = null;
		persistAndRender();
		showToast('Bracket cleared.');
	}

	function bracketRoundLabel(roundIndex, totalRounds) {
		var roundsFromFinal = totalRounds - 1 - roundIndex;
		if (roundsFromFinal === 0) { return 'Final'; }
		if (roundsFromFinal === 1) { return 'Semifinals'; }
		if (roundsFromFinal === 2) { return 'Quarterfinals'; }
		return 'Round ' + (roundIndex + 1);
	}

	function renderBracketPane() {
		var pane = el('pane-bracket');
		var tools = canEdit()
			? '<button type="button" class="stm-btn" data-act="rebuild-bracket">' + (DB.bracket ? 'Rebuild from teams' : 'Generate bracket') + '</button>' +
				(DB.bracket ? '<button type="button" class="stm-btn stm-btn-danger" data-act="clear-bracket">Clear bracket</button>' : '')
			: '';
		var head = '<div class="stm-pane-head"><div><h2 class="stm-pane-title">Knockout bracket</h2>' +
			'<p class="stm-pane-sub">Single-elimination tree built from your teams. Click a team to pick the winner of a matchup.</p></div>' +
			'<div class="stm-pane-tools">' + tools + '</div></div>';

		if (DB.teams.length < 2) {
			pane.innerHTML = head + '<div class="stm-empty"><h3 class="stm-empty-title">A bracket needs at least two teams</h3>' +
				'<p class="stm-empty-text">Add teams, then generate the knockout tree here.</p></div>';
			return;
		}
		if (!DB.bracket) {
			pane.innerHTML = head + '<div class="stm-empty"><h3 class="stm-empty-title">No bracket yet</h3>' +
				'<p class="stm-empty-text">Generate the single-elimination tree from the ' + DB.teams.length + ' registered teams. ' +
				'Teams beyond the next power of two receive a bye in the first round.</p>' +
				(canEdit() ? '<button type="button" class="stm-btn stm-btn-primary" data-act="rebuild-bracket">Generate bracket</button>' : '') +
				'</div>';
			return;
		}

		var totalRounds = DB.bracket.rounds.length;
		var columnsHtml = DB.bracket.rounds.map(function (round, roundIndex) {
			var matchesHtml = round.map(function (match, matchIndex) {
				var homeHtml = bracketTeamButtonHtml(match, match.homeTeamId, roundIndex, matchIndex);
				var awayHtml = bracketTeamButtonHtml(match, match.awayTeamId, roundIndex, matchIndex);
				return '<div class="stm-bracket-match">' + homeHtml + awayHtml + '</div>';
			}).join('');
			return '<div class="stm-round-col"><p class="stm-round-title">' + bracketRoundLabel(roundIndex, totalRounds) + '</p>' + matchesHtml + '</div>';
		}).join('');

		var notes = '<p class="stm-form-hint" style="margin-top:14px">Bracket picks are recorded here and never change the Matches tab. ' +
			'Enter official scores in the Matches tab when the games are played.</p>';

		pane.innerHTML = head + '<div class="stm-bracket-scroll"><div class="stm-bracket">' + columnsHtml + '</div></div>' + notes;
	}

	function bracketTeamButtonHtml(match, teamId, roundIndex, matchIndex) {
		if (!teamId) {
			return '<span class="stm-bracket-team stm-bracket-tbd">To be decided</span>';
		}
		var bothTeamsPresent = Boolean(match.homeTeamId && match.awayTeamId);
		var isFirstRoundBye = roundIndex === 0 && !bothTeamsPresent;
		var isWinner = bothTeamsPresent && match.winnerTeamId === teamId;
		var isChampion = isWinner && roundIndex === DB.bracket.rounds.length - 1;

		var classes = 'stm-bracket-team';
		if (isWinner) { classes += ' stm-bracket-winner'; }
		if (isFirstRoundBye) { classes += ' stm-bracket-bye'; }

		var tag = '';
		if (isFirstRoundBye) {
			tag = '<span class="stm-bracket-tag">bye</span>';
		} else if (isChampion) {
			tag = '<span class="stm-bracket-tag">champion</span>';
		}

		if (!bothTeamsPresent) {
			/* waiting for the other matchup - not clickable yet */
			classes += ' stm-bracket-wait';
			return '<span class="' + classes + '">' + esc(teamNameOf(teamId)) + tag + '</span>';
		}
		return '<button type="button" class="' + classes + '" data-act="pick-bracket-winner" data-round="' + roundIndex +
			'" data-match="' + matchIndex + '" data-team="' + esc(teamId) + '">' + esc(teamNameOf(teamId)) + tag + '</button>';
	}

	/* ------------------------------------------------------------------ */
	/*  Settings pane                                                      */
	/* ------------------------------------------------------------------ */

	function renderSettingsPane() {
		var pane = el('pane-settings');
		var disabled = canEdit() ? '' : ' disabled';
		var isHockey = DB.tournament.sport === 'hockey';

		var pointInputs = isHockey
			? pointsInputHtml('hockey-point', DB.tournament.hockeyPoints, [
				{ key: 'win', label: 'Win (regulation)' },
				{ key: 'otWin', label: 'Win in overtime / shootout' },
				{ key: 'otLoss', label: 'Loss in overtime / shootout' },
				{ key: 'loss', label: 'Loss (regulation)' }
			])
			: pointsInputHtml('soccer-point', DB.tournament.points, [
				{ key: 'win', label: 'Win' },
				{ key: 'draw', label: 'Draw' },
				{ key: 'loss', label: 'Loss' }
			]);

		var venueRows = DB.tournament.venues.map(function (venue, index) {
			return '<div class="stm-venue-row"><input type="text" value="' + esc(venue) + '" data-settings-venue="' + index + '"' + disabled + '>' +
				(canEdit() ? '<button type="button" class="stm-btn stm-btn-sm stm-btn-danger" data-act="remove-venue" data-venue-index="' + index + '">Remove</button>' : '') +
				'</div>';
		}).join('');
		var venueEmpty = canEdit() && DB.tournament.venues.length === 0
			? '<p class="stm-form-hint">No venues yet. Venues typed on matches are collected here too.</p>'
			: '';

		var dataTools = canEdit()
			? '<button type="button" class="stm-btn" data-act="export-json">Export JSON</button>' +
				'<button type="button" class="stm-btn" data-act="import-json">Import JSON</button>' +
				'<button type="button" class="stm-btn stm-btn-danger" data-act="reset-data">Reset tournament</button>'
			: '';

		pane.innerHTML =
			'<div class="stm-pane-head"><div><h2 class="stm-pane-title">Settings</h2>' +
			'<p class="stm-pane-sub">Changes here are saved to the CMS record automatically.</p></div></div>' +

			'<div class="stm-card stm-settings-section">' +
			'<h3 class="stm-settings-title">Tournament</h3>' +
			'<div class="stm-form">' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="settings-tournament-name">Tournament name</label>' +
			'<input type="text" id="settings-tournament-name" value="' + esc(DB.tournament.name) + '" maxlength="120" data-settings="name"' + disabled + '></div>' +
			'<div class="stm-form-field"><label for="settings-season">Season</label>' +
			'<input type="text" id="settings-season" value="' + esc(DB.tournament.season) + '" maxlength="40" data-settings="season"' + disabled + ' placeholder="e.g. 2026 Summer"></div>' +
			'</div>' +
			'<div class="stm-form-row">' +
			'<div class="stm-form-field"><label for="settings-sport">Sport</label>' +
			'<select id="settings-sport" data-settings="sport"' + disabled + '>' +
			'<option value="soccer"' + (DB.tournament.sport === 'soccer' ? ' selected' : '') + '>Soccer</option>' +
			'<option value="hockey"' + (DB.tournament.sport === 'hockey' ? ' selected' : '') + '>Hockey</option>' +
			'</select></div>' +
			'<div class="stm-form-field"><label for="settings-format">Format</label>' +
			'<select id="settings-format" data-settings="format"' + disabled + '>' +
			'<option value="league"' + (DB.tournament.format === 'league' ? ' selected' : '') + '>League standings</option>' +
			'<option value="knockout"' + (DB.tournament.format === 'knockout' ? ' selected' : '') + '>Knockout bracket</option>' +
			'</select></div>' +
			'</div></div></div>' +

			'<div class="stm-card stm-settings-section">' +
			'<h3 class="stm-settings-title">Scoring - ' + sportDefinition().label + '</h3>' +
			'<div class="stm-form"><div class="stm-form-row">' + pointInputs + '</div>' +
			'<p class="stm-form-hint">Standings are recalculated from these values immediately.</p>' +
			'</div></div>' +

			'<div class="stm-card stm-settings-section">' +
			'<h3 class="stm-settings-title">Venues</h3>' +
			'<div class="stm-form">' + venueRows + venueEmpty +
			(canEdit() ? '<div><button type="button" class="stm-btn stm-btn-sm" data-act="add-venue">Add venue</button></div>' : '') +
			'</div></div>' +

			'<div class="stm-card stm-settings-section">' +
			'<h3 class="stm-settings-title">Data</h3>' +
			'<p class="stm-confirm-text" style="margin-bottom:10px">Move this tournament between records, back it up, or start over.</p>' +
			'<div class="stm-pane-tools">' + dataTools + '</div></div>';
	}

	function pointsInputHtml(dataAttribute, pointValues, fieldDefinitions) {
		return fieldDefinitions.map(function (definition) {
			return '<div class="stm-form-field"><label for="settings-point-' + definition.key + '">' + definition.label + '</label>' +
				'<input type="number" id="settings-point-' + definition.key + '" min="0" max="99" value="' + pointValues[definition.key] +
				'" data-points="' + definition.key + '"' + (canEdit() ? '' : ' disabled') + '></div>';
		}).join('');
	}

	function readSettingsValue(control) {
		var field = control.getAttribute('data-settings');
		var pointsKey = control.getAttribute('data-points');
		if (pointsKey) {
			if (DB.tournament.sport === 'hockey') {
				DB.tournament.hockeyPoints[pointsKey] = clampInteger(control.value, 0, 99);
			} else {
				DB.tournament.points[pointsKey] = clampInteger(control.value, 0, 99);
			}
			return;
		}
		if (field === 'name') { DB.tournament.name = (control.value || '').slice(0, 120); return; }
		if (field === 'season') { DB.tournament.season = (control.value || '').slice(0, 40); return; }
		if (field === 'sport') {
			settingsSportBeforeChange = DB.tournament.sport;
			if (SPORT_DEFINITIONS[control.value]) { DB.tournament.sport = control.value; }
			return;
		}
		if (field === 'format') { DB.tournament.format = control.value === 'knockout' ? 'knockout' : 'league'; return; }
	}

	function exportJsonModal() {
		var jsonText = JSON.stringify(DB, null, 2);
		openModal('Export tournament data',
			'<p class="stm-confirm-text" style="margin-bottom:10px">Copy this JSON to move or back up the tournament. ' +
			'Import it in another instance of this tool to restore everything.</p>' +
			'<textarea class="stm-export-area" id="export-json-area" readonly>' + esc(jsonText) + '</textarea>',
			'<button type="button" class="stm-btn" data-act="modal-cancel">Close</button>' +
			'<button type="button" class="stm-btn" data-act="copy-export-json">Copy</button>' +
			'<button type="button" class="stm-btn stm-btn-primary" data-act="download-export-json">Download .json</button>',
			{ modalKind: 'export' });
	}

	function copyExportJson() {
		var textarea = el('export-json-area');
		if (!textarea) { return; }
		textarea.focus();
		textarea.select();
		var copied = false;
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(textarea.value);
				copied = true;
			}
		} catch (clipboardError) { copied = false; }
		if (!copied) {
			try { copied = document.execCommand('copy'); } catch (execError) { copied = false; }
		}
		showToast(copied ? 'Copied to the clipboard.' : 'Select the text and press Ctrl+C to copy.');
	}

	function downloadExportJson() {
		var textarea = el('export-json-area');
		if (!textarea) { return; }
		var blob = new Blob([textarea.value], { type: 'application/json' });
		var downloadUrl = URL.createObjectURL(blob);
		var anchor = document.createElement('a');
		anchor.href = downloadUrl;
		anchor.download = 'tournament-' + (DB.tournament.name || 'data').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		window.setTimeout(function () { URL.revokeObjectURL(downloadUrl); }, 1000);
	}

	function importJsonModal() {
		var hasData = DB.teams.length > 0 || DB.matches.length > 0 || DB.players.length > 0;
		openModal('Import tournament data',
			'<p class="stm-confirm-text" style="margin-bottom:10px">Paste tournament JSON (from Export JSON) here. ' +
			'Importing replaces the current teams, players, matches and bracket.</p>' +
			'<textarea class="stm-export-area" id="import-json-area" placeholder=\'{ "tournament": ... }\'></textarea>' +
			'<div style="margin-top:10px"><button type="button" class="stm-btn stm-btn-sm" data-act="import-from-file">Load from file</button>' +
			'<input type="file" id="import-file-input" accept=".json,application/json" style="display:none"></div>' +
			(hasData ? '<p class="stm-form-error" style="margin-top:10px">This record already has data. Importing replaces it.</p>' : ''),
			'<button type="button" class="stm-btn" data-act="modal-cancel">Cancel</button>' +
			'<button type="button" class="stm-btn stm-btn-primary" data-act="do-import">Import data</button>',
			{ modalKind: 'import' });
	}

	function parseImportJson(text) {
		var raw = String(text || '').trim();
		raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
		try {
			var parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object' || !parsed.tournament || !Array.isArray(parsed.teams)) {
				return null;
			}
			return parsed;
		} catch (parseError) {
			return null;
		}
	}

	function applyImportJson() {
		var textarea = el('import-json-area');
		var parsed = parseImportJson(textarea ? textarea.value : '');
		if (!parsed) {
			showToast('That is not valid tournament JSON. Export it from another instance of this tool.', 'error');
			return;
		}
		DB = normalizeDatabase(parsed);
		lastStagedJson = '';
		closeModal();
		schedulePersist();
		renderAll();
		showToast('Tournament data imported.');
	}

	function resetAllData() {
		openConfirm('Reset tournament',
			'<p class="stm-confirm-text">This deletes <strong>all teams, players, matches and the bracket</strong> in this record. ' +
			'Only the tournament settings stay. This cannot be undone.</p>',
			'Delete everything',
			function () {
				var keptSettings = {
					name: DB.tournament.name,
					season: DB.tournament.season,
					sport: DB.tournament.sport,
					format: DB.tournament.format,
					venues: DB.tournament.venues,
					points: DB.tournament.points,
					hockeyPoints: DB.tournament.hockeyPoints
				};
				DB = normalizeDatabase({ tournament: keptSettings, ui: { tab: 'overview' } });
				lastStagedJson = '';
				closeModal();
				schedulePersist();
				renderAll();
				showToast('Tournament reset. Settings were kept.');
			});
	}

	/* ------------------------------------------------------------------ */
	/*  Event delegation                                                   */
	/* ------------------------------------------------------------------ */

	function handleDocumentClick(event) {
		var target = event.target;
		if (!target || !target.closest) { return; }

		var overlay = el('stm-modal-overlay');
		if (overlay && !overlay.hidden && target === overlay) { closeModal(); return; }

		var tabButton = target.closest('.stm-tab');
		if (tabButton) { switchTab(tabButton.getAttribute('data-tab')); return; }

		var tabNavButton = target.closest('[data-tab-nav]');
		if (tabNavButton) { switchTab(tabNavButton.getAttribute('data-tab-nav')); return; }

		var statusChip = target.closest('[data-filter="match-status"]');
		if (statusChip) {
			matchFilter.status = statusChip.getAttribute('data-status');
			renderActivePane();
			return;
		}

		var actionElement = target.closest('[data-act]');
		if (!actionElement) { return; }
		var action = actionElement.getAttribute('data-act');
		var data = actionElement.dataset || {};

		switch (action) {
			case 'modal-close':
			case 'modal-cancel':
				closeModal();
				break;
			case 'confirm-cancel':
				confirmCallback = null;
				confirmArmed = false;
				closeModal();
				break;
			case 'confirm-ok':
				if (!confirmArmed) {
					armConfirmButton();
					break;
				}
				confirmArmed = false;
				if (confirmArmTimer) { window.clearTimeout(confirmArmTimer); }
				var runConfirm = confirmCallback;
				confirmCallback = null;
				if (runConfirm) { runConfirm(); }
				break;

			case 'open-team-modal': openTeamModal(data.teamId); break;
			case 'save-team': saveTeamFromModal(); break;
			case 'delete-team': deleteTeam(data.teamId); break;

			case 'open-player-modal': openPlayerModal(data.playerId); break;
			case 'save-player': savePlayerFromModal(); break;
			case 'delete-player': deletePlayer(data.playerId); break;

			case 'open-match-modal': openMatchModal(data.matchId); break;
			case 'save-match': saveMatchFromModal(); break;
			case 'delete-match': deleteMatch(data.matchId); break;

			case 'rebuild-bracket': buildBracket(); persistAndRender(); showToast('Bracket generated from teams.'); break;
			case 'clear-bracket': clearBracket(); break;
			case 'pick-bracket-winner':
				pickBracketWinner(parseInt(data.round, 10), parseInt(data.match, 10), data.team);
				break;

			case 'add-venue':
				DB.tournament.venues.push('');
				schedulePersist();
				renderActivePane();
				break;
			case 'remove-venue':
				DB.tournament.venues.splice(parseInt(data.venueIndex, 10), 1);
				schedulePersist();
				renderActivePane();
				break;

			case 'export-json': exportJsonModal(); break;
			case 'copy-export-json': copyExportJson(); break;
			case 'download-export-json': downloadExportJson(); break;
			case 'import-json': importJsonModal(); break;
			case 'import-from-file':
				var fileInput = el('import-file-input');
				if (fileInput) { fileInput.click(); }
				break;
			case 'do-import': applyImportJson(); break;
			case 'reset-data': resetAllData(); break;

			default:
				break;
		}
	}

	function handleDocumentChange(event) {
		var target = event.target;
		if (!target || !target.closest) { return; }

		var filterElement = target.closest('[data-filter]');
		if (filterElement) {
			var filterName = filterElement.getAttribute('data-filter');
			if (filterName === 'match-team') { matchFilter.teamId = filterElement.value; renderActivePane(); return; }
			if (filterName === 'player-team') { playerFilter.teamId = filterElement.value; renderActivePane(); return; }
			return;
		}

		var settingsControl = target.closest('[data-settings], [data-points]');
		if (settingsControl) {
			readSettingsValue(settingsControl);
			if (settingsControl.getAttribute('data-settings') === 'sport') {
				if (settingsSportBeforeChange !== DB.tournament.sport) {
					showToast('Sport changed to ' + sportDefinition().label + '. Standings now use ' + sportDefinition().label + ' rules.');
				}
			}
			schedulePersist();
			renderAll();
			return;
		}

		var venueInput = target.closest('[data-settings-venue]');
		if (venueInput) {
			var venueIndex = parseInt(venueInput.getAttribute('data-settings-venue'), 10);
			if (DB.tournament.venues[venueIndex] !== undefined) {
				DB.tournament.venues[venueIndex] = venueInput.value.trim().slice(0, 120);
				schedulePersist();
			}
		}
	}

	function handleDocumentInput(event) {
		var target = event.target;
		if (!target || !target.closest) { return; }
		var searchInput = target.closest('[data-filter="player-search"]');
		if (searchInput) {
			playerFilter.search = searchInput.value;
			renderActivePane();
		}
	}

	function handleDocumentKeydown(event) {
		if (event.key === 'Escape') {
			var overlay = el('stm-modal-overlay');
			if (overlay && !overlay.hidden) {
				if (confirmArmed) {
					confirmArmed = false;
					if (confirmArmTimer) { window.clearTimeout(confirmArmTimer); }
					var button = document.querySelector('[data-act="confirm-ok"]');
					if (button) { button.textContent = 'Confirm'; }
					return;
				}
				closeModal();
			}
		}
	}

	function handleFileImport(event) {
		var fileInput = event.target;
		var file = fileInput && fileInput.files && fileInput.files[0];
		if (!file) { return; }
		if (typeof FileReader === 'function') {
			var reader = new FileReader();
			reader.onload = function () {
				var textarea = el('import-json-area');
				if (textarea) { textarea.value = String(reader.result || ''); }
			};
			reader.readAsText(file);
		}
		fileInput.value = '';
	}

	/* ------------------------------------------------------------------ */
	/*  Boot                                                               */
	/* ------------------------------------------------------------------ */

	function readParams() {
		var seedSport = 'soccer';
		var sportParam = typeof tool.param === 'function' ? tool.param('defaultSport', '') : '';
		if (SPORT_DEFINITIONS[sportParam]) { seedSport = sportParam; }
		var seedName = typeof tool.param === 'function' ? tool.param('tournamentName', '') : '';
		return { sport: seedSport, name: String(seedName || '') };
	}

	function declareParamsAndOutputs() {
		if (typeof tool.declareParams !== 'function') { return; }
		try {
			tool.declareParams([
				{ key: 'allowRequestSave', label: 'Allow the tool to request a record save after edits', type: 'yesNo', severity: 'goodToHave', defaultValue: 'no' },
				{ key: 'defaultSport', label: 'Default sport for new instances', type: 'text', severity: 'optional', defaultValue: 'soccer' },
				{ key: 'tournamentName', label: 'Default tournament name', type: 'text', severity: 'optional', defaultValue: '' }
			]);
		} catch (declareError) { /* declaration is best-effort */ }
	}

	tool.onReady(function (initialValue) {
		declareParamsAndOutputs();

		var seed = readParams();
		var rawDatabase = (initialValue && typeof initialValue === 'object' && initialValue.teams !== undefined) ? initialValue : null;
		DB = normalizeDatabase(rawDatabase);
		if (!rawDatabase) {
			if (seed.name) { DB.tournament.name = seed.name; }
			if (seed.sport !== 'soccer') { DB.tournament.sport = seed.sport; }
		}
		lastStagedJson = snapshotJson();

		isReadOnly = typeof tool.isReadOnly === 'function' ? Boolean(tool.isReadOnly()) : false;
		refreshUser();
		startUserPolling();

		if (typeof tool.onReadonlyChange === 'function') {
			tool.onReadonlyChange(function (readOnlyValue) {
				isReadOnly = Boolean(readOnlyValue);
				renderAll();
			});
		}
		if (typeof tool.onUserChange === 'function') {
			tool.onUserChange(function (userValue) {
				currentUser = userValue || getUserSafe();
				renderReadonlyBanner();
				renderActivePane();
			});
		}
		if (typeof tool.onValueChange === 'function') {
			tool.onValueChange(function (incomingValue) {
				var incomingJson = JSON.stringify(incomingValue || null);
				if (incomingJson === lastStagedJson) { return; }
				if (incomingJson === snapshotJson()) { return; }
				DB = normalizeDatabase(incomingValue);
				lastStagedJson = snapshotJson();
				renderAll();
				showToast('Tournament data was updated elsewhere and reloaded.');
			});
		}

		document.addEventListener('click', handleDocumentClick);
		document.addEventListener('change', handleDocumentChange);
		document.addEventListener('input', handleDocumentInput);
		document.addEventListener('keydown', handleDocumentKeydown);
		document.addEventListener('change', function (event) {
			if (event.target && event.target.id === 'import-file-input') { handleFileImport(event); }
		});

		renderAll();
		if (typeof tool.resize === 'function') {
			try { tool.resize(); } catch (resizeError) { }
		}
		if (typeof tool.reportValid === 'function') {
			try { tool.reportValid(true); } catch (validError) { }
		}
	});
})();

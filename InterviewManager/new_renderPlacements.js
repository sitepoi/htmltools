function renderPlacements() {
	const el = document.getElementById('placements-content'); if (!el) return; if (!DB.positions.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✦</div><p>No positions defined yet.</p></div>'; return } if (!DB.placements) DB.placements = [];
	el.innerHTML = DB.positions.map(function(pos) {
		var pl = DB.placements.find(function(p) { return p.positionId === pos.id; }) || { positionId: pos.id, selectedCandidateId: null, offerLetterSent: false };
		var scoredIds = [...new Set(DB.scores.filter(function(s) { return s.positionId === pos.id; }).map(function(s) { return s.candidateId; }))];
		var applied = DB.candidates.filter(function(c) { return (c.positionIds || []).includes(pos.id) && !c.eliminated; });
		var suggested = DB.candidates.filter(function(c) { return !(c.positionIds || []).includes(pos.id) && !c.eliminated && scoredIds.includes(c.id); });
		var all = [...applied, ...suggested];
		var sb = { open: 'badge-green', closed: 'badge-gray', 'on-hold': 'badge-amber' }[pos.status] || 'badge-gray';
		// Find selected candidate for this position
		var selCand = pl.selectedCandidateId ? DB.candidates.find(function(c) { return c.id === pl.selectedCandidateId; }) : null;
		// Build candidate rows HTML
		var candRows = '';
		if (!all.length) {
			candRows = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No candidates for this position.</div>';
		} else {
			all.forEach(function(c) {
				var sc = DB.scores.filter(function(s) { return s.candidateId === c.id && s.positionId === pos.id; });
				var avg = sc.length ? sc.reduce(function(a, s) { return a + allCriteriaAvg(s); }, 0) / sc.length : null;
				var isApplied = (c.positionIds || []).includes(pos.id);
				var isSelected = pl.selectedCandidateId === c.id;
				var bc = avg != null ? (avg >= 7 ? 'var(--green)' : avg >= 5 ? 'var(--amber)' : 'var(--red)') : 'var(--text3)';
				candRows += '<div class="placement-candidate-row' + (isSelected ? ' is-selected' : '') + '">' +
					avatar(c.name, 34) +
					'<div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">' + esc(c.name) + '</div><div style="font-size:11px;color:var(--text3)">' + (c.email || '') + (c.phone ? ' · ' + esc(c.phone) : '') + '</div><div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">' +
					(isApplied ? '<span class="badge badge-blue">Applied</span>' : '<span class="badge badge-teal">Suggested</span>') +
					(avg != null ? '<span style="font-family:var(--mono);font-size:12px;font-weight:600;color:' + bc + '">' + avg.toFixed(1) + '/10</span>' : '<span style="font-size:11px;color:var(--text3)">Not scored</span>') +
					'</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
					(!isSelected ? '<button class="btn btn-ghost btn-sm" data-action="selectForPos" data-posid="' + pos.id + '" data-candid="' + c.id + '">☆ Select</button>' :
						'<span class="badge badge-green">✓ Selected</span><button class="btn btn-danger btn-sm" data-action="deselectForPos" data-posid="' + pos.id + '">Deselect</button>') +
					(isSelected ? '<button class="btn btn-primary btn-sm" data-action="openOfferLetter" data-posid="' + pos.id + '" data-candid="' + c.id + '">✉ Offer</button><label class="email-sent-check"><input type="checkbox"' + (pl.offerLetterSent ? ' checked' : '') + ' data-action="toggleOfferSent" data-posid="' + pos.id + '"> Sent</label>' : '') +
					'</div></div>';
			});
		}
		// Summary line for collapsed state
		var selName = selCand ? esc(selCand.name) : 'None';
		var summaryHTML = '<div class="placement-summary">' +
			'<span class="psum-count">' + all.length + ' candidate' + (all.length !== 1 ? 's' : '') + '</span>' +
			(selCand ? '<span class="psum-selected">' + avatar(selCand.name, 22) + esc(selCand.name) + '</span>' : '<span class="psum-none">No selection</span>') +
			'</div>';
		return '<div class="placement-card">' +
			// HEADER — click to toggle expand/collapse
			'<div class="placement-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;cursor:pointer" onclick="this.closest(\'.placement-card\').classList.toggle(\'collapsed\')">' +
				'<div style="display:flex;align-items:center;gap:10px">' +
					'<span class="placement-toggle-arrow">▶</span>' +
					'<div>' +
						'<div style="font-size:16px;font-weight:600">' + esc(pos.title) + '</div>' +
						'<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">' +
							'<span class="badge ' + sb + '">' + pos.status + '</span>' +
							(pos.dept ? '<span class="badge badge-gray">' + esc(pos.dept) + '</span>' : '') +
							(pos.closedForInterviews ? '<span class="badge badge-red">Closed</span>' : '') +
							(selCand ? '<span class="badge badge-green">✓ ' + esc(selCand.name) + '</span>' : '') +
						'</div>' +
					'</div>' +
				'</div>' +
				summaryHTML +
			'</div>' +
			// BODY — hidden when collapsed
			'<div class="placement-body">' +
				'<div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:10px">' +
					'<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);cursor:pointer">Close for interviews' +
						'<label class="toggle-switch danger"><input type="checkbox"' + (pos.closedForInterviews ? ' checked' : '') + ' data-action="togglePosClosedInt" data-id="' + pos.id + '"><span class="toggle-slider"></span></label>' +
					'</label>' +
				'</div>' +
				candRows +
			'</div>' +
		'</div>';
	}).join('');
}

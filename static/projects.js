// Projects page: collapsible details toggles
(function(){
	const list = document.querySelector('.projects-list');
	if (!list) return;

	const closeAll = (exceptId) => {
		document.querySelectorAll('.project-details.open').forEach(d => {
			if (exceptId && d.id === exceptId) return;
			d.classList.remove('open');
			d.setAttribute('aria-hidden', 'true');
			const btn = document.querySelector(`button.summary-toggle[aria-controls="${d.id}"]`);
			if (btn) btn.setAttribute('aria-expanded', 'false');
		});
	};

	list.addEventListener('click', (e) => {
		const btn = e.target.closest('button.summary-toggle');
		if (!btn) return;
		const id = btn.getAttribute('aria-controls');
		if (!id) return;
		const panel = document.getElementById(id);
		if (!panel) return;

		const isOpen = panel.classList.contains('open');
		if (isOpen) {
			panel.classList.remove('open');
			panel.setAttribute('aria-hidden', 'true');
			btn.setAttribute('aria-expanded', 'false');
		} else {
			closeAll(id);
			panel.classList.add('open');
			panel.setAttribute('aria-hidden', 'false');
			btn.setAttribute('aria-expanded', 'true');
			// Optional: scroll the opened item into view if collapsed area is below fold
			panel.scrollIntoView({ block: 'nearest' });
		}
	});
})();

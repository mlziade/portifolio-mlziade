// Projects page: collapsible details toggles (multiple open allowed)
(function(){
	const list = document.querySelector('.projects-list');
	if (!list) return;

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
			panel.classList.add('open');
			panel.setAttribute('aria-hidden', 'false');
			btn.setAttribute('aria-expanded', 'true');
			// Avoid auto-scrolling to reduce layout shifts while images load
		}
	});
})();

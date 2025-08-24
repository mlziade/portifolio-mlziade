// Projects page: collapsible details toggles (multiple open allowed)
// Collapsible toggles
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

// Lightbox for preview images
(function(){
	const list = document.querySelector('.projects-list');
	if (!list) return;

	// Create overlay elements once
	const overlay = document.createElement('div');
	overlay.className = 'lightbox-overlay';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-hidden', 'true');

	const content = document.createElement('div');
	content.className = 'lightbox-content';

	const closeBtn = document.createElement('button');
	closeBtn.className = 'lightbox-close';
	closeBtn.setAttribute('aria-label', 'Close image');
	closeBtn.innerHTML = '&times;';

	const img = document.createElement('img');
	img.className = 'lightbox-image';
	img.alt = '';

	const caption = document.createElement('div');
	caption.className = 'lightbox-caption';

	content.appendChild(closeBtn);
	content.appendChild(img);
	content.appendChild(caption);
	overlay.appendChild(content);
	document.body.appendChild(overlay);

	let lastFocused = null;

	function openLightbox(src, altText, captionText){
		lastFocused = document.activeElement;
		img.src = src;
		img.alt = altText || '';
		caption.textContent = captionText || altText || '';
		overlay.removeAttribute('aria-hidden');
		overlay.classList.add('open');
		document.documentElement.classList.add('lightbox-open');
		document.body.classList.add('lightbox-open');
		// Focus close for accessibility
		closeBtn.focus({ preventScroll: true });
	}

	function closeLightbox(){
		overlay.classList.remove('open');
		overlay.setAttribute('aria-hidden', 'true');
		document.documentElement.classList.remove('lightbox-open');
		document.body.classList.remove('lightbox-open');
		// Clear src to stop any decoding work
		img.removeAttribute('src');
		// Restore focus
		if (lastFocused && typeof lastFocused.focus === 'function') {
			lastFocused.focus({ preventScroll: true });
		}
	}

	// Delegated click on any preview image
	list.addEventListener('click', (e) => {
		const targetImg = e.target.closest('.details-previews img');
		if (!targetImg) return;
		// Prevent figure click bubbling to summary, just in case
		e.stopPropagation();

		const fig = targetImg.closest('figure');
		const figcap = fig ? fig.querySelector('figcaption') : null;
		const captionText = figcap ? figcap.innerText.trim() : '';
		// Use high-res PNG for lightbox if available, otherwise fall back to current image
		const lightboxSrc = targetImg.getAttribute('data-lightbox-src') || targetImg.currentSrc || targetImg.src;
		openLightbox(lightboxSrc, targetImg.alt || '', captionText);
	});

	// Close interactions
	closeBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		closeLightbox();
	});

	overlay.addEventListener('click', (e) => {
		// Click on backdrop closes; clicks inside content do not
		if (e.target === overlay) {
			closeLightbox();
		}
	});

	// Keyboard: ESC closes, trap Tab to stay on close button (simple trap)
	document.addEventListener('keydown', (e) => {
		if (!overlay.classList.contains('open')) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			closeLightbox();
		} else if (e.key === 'Tab') {
			// Keep focus on close when lightbox open (lightweight trap)
			e.preventDefault();
			closeBtn.focus({ preventScroll: true });
		}
	});
})();

// Progressive preloading of project preview images
(function(){
	const list = document.querySelector('.projects-list');
	if (!list) return;

	// Hint the browser to decode asynchronously for all preview images
	document.querySelectorAll('.details-previews img').forEach(img => {
		try { img.decoding = 'async'; } catch(_) {}
	});

	const preloaded = new Set();

	function preload(src) {
		if (!src || preloaded.has(src)) return Promise.resolve();
		return new Promise(resolve => {
			const im = new Image();
			try { im.decoding = 'async'; } catch(_) {}
			im.onload = () => { preloaded.add(src); resolve(); };
			im.onerror = () => { /* ignore errors, continue */ resolve(); };
			im.src = src;
		});
	}

	function getProjectImages(projectEl) {
		return Array.from(projectEl.querySelectorAll('.details-previews img'));
	}

	function preloadFirst(projectEl) {
		const imgs = getProjectImages(projectEl);
		if (!imgs.length) return Promise.resolve();
		const el = imgs[0];
		const src = el.currentSrc || el.src;
		return preload(src);
	}

	function preloadAll(projectEl) {
		const imgs = getProjectImages(projectEl);
		if (!imgs.length) return Promise.resolve();
		return Promise.all(imgs.map(el => preload(el.currentSrc || el.src)));
	}

	const items = Array.from(list.querySelectorAll('.project-item'));

	// Idle: warm the first preview of each project
	const idle = window.requestIdleCallback || function(fn){ return setTimeout(fn, 200); };
	idle(() => { items.forEach(preloadFirst); });

	// Near viewport: ensure first image ready before opening
	if ('IntersectionObserver' in window) {
		const io = new IntersectionObserver((entries, observer) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					preloadFirst(entry.target);
					observer.unobserve(entry.target);
				}
			});
		}, { rootMargin: '200px 0px' });
		items.forEach(item => io.observe(item));
	}

	// User intent: hover/focus/touch on a project preloads all its images
	const intentHandler = (e) => {
		const item = e.target && e.target.closest('.project-item');
		if (item) preloadAll(item);
	};
	list.addEventListener('pointerenter', intentHandler, true);
	list.addEventListener('focusin', intentHandler);
	list.addEventListener('touchstart', intentHandler, { passive: true });

	// When user toggles open a panel, also preload all its images
	list.addEventListener('click', (e) => {
		const btn = e.target.closest('button.summary-toggle');
		if (!btn) return;
		const id = btn.getAttribute('aria-controls');
		if (!id) return;
		const panel = document.getElementById(id);
		if (!panel) return;
		const item = panel.closest('.project-item');
		if (item) preloadAll(item);
	});
})();

document.addEventListener('DOMContentLoaded', function() {
    // Project data - will be populated by Django template
    let projectsData = [];
    let projectsById = new Map();

    // Initialize projects data from JSON script tag (if added by template)
    const projectsScript = document.getElementById('projects-data');
    if (projectsScript) {
        try {
            projectsData = JSON.parse(projectsScript.textContent);
        } catch (e) {
            console.error('Failed to parse projects data:', e);
        }
    }
    // Fallback to global if available
    if ((!Array.isArray(projectsData) || projectsData.length === 0) && Array.isArray(window.PROJECTS_DATA)) {
        projectsData = window.PROJECTS_DATA;
    }

    // Build id -> project map for robust lookup
    if (Array.isArray(projectsData)) {
        projectsData.forEach(p => { if (p && p.id != null) projectsById.set(String(p.id), p); });
    }

    // Get modal elements
    const modal = document.getElementById('project-modal');
    const modalBody = modal?.querySelector('.modal-body');
    const modalClose = modal?.querySelector('.modal-close');

    // Project card click handlers
    const projectCards = document.querySelectorAll('.project-card');

    projectCards.forEach(card => {
        card.addEventListener('click', function() {
            const projectId = this.getAttribute('data-project-id');
            const project = findProjectById(projectId);
            if (project) {
                showProjectModal(project);
            }
        });
    });

    // Modal close handlers
    if (modalClose) {
        modalClose.addEventListener('click', function() {
            closeModal();
        });
    }

    // Click outside modal to close
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // ESC key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal?.classList.contains('open')) {
            closeModal();
        }
    });

    function findProjectById(projectId) {
        // Try to find in projects data first
        if (projectsById.size) {
            const exact = projectsById.get(String(projectId));
            if (exact) return exact;
            // Try loose matching if data attributes differ
            for (const [k, v] of projectsById.entries()) {
                if (String(k) === String(projectId)) return v;
            }
        }

        // Fallback: extract from DOM
    const cardElement = document.querySelector(`[data-project-id="${projectId}"]`);
        if (!cardElement) return null;

        const column = cardElement.closest('.kanban-column');
        const status = column?.getAttribute('data-status') || '';
        const title = cardElement.querySelector('.card-title')?.textContent || '';
        const logoImg = cardElement.querySelector('.card-logo img');

        // Attempt to build a minimal logo structure
        let logo = null;
        if (logoImg) {
            // Prefer relative path if under /static/
            try {
                const url = new URL(logoImg.src, window.location.origin);
                const rel = url.pathname.startsWith('/static/') ? url.pathname.replace(/^\/static\//, '') : url.pathname;
                logo = { webp: rel, alt: logoImg.alt, width: logoImg.width, height: logoImg.height };
            } catch (_) {
                logo = { src: logoImg.src, alt: logoImg.alt, width: logoImg.width, height: logoImg.height };
            }
        }

        const fallback = {
            id: projectId,
            name: title,
            status: status,
            logo,
            description: { en: '', pt_br: '' },
            tags: [],
            actions: [],
            previews: []
        };

        console.warn('Project data not found in JSON. Using fallback from DOM. Some fields may be empty.', fallback);
        return fallback;
    }


    function showProjectModal(project) {
        if (!modal || !modalBody) {
            return;
        }

        // Get current language for descriptions
        const isEnglish = (document.documentElement.lang || 'en').toLowerCase().startsWith('en');

        // Generate logo HTML
        let logoHTML = '';
        if (project.logo) {
            const src = project.logo.webp || project.logo.png || project.logo.gif || project.logo.src;
            if (src) {
                // If src already looks absolute or starts with /static, keep as-is; otherwise prefix with /static/
                const finalSrc = /^(https?:)?\//.test(src) ? src : (src.startsWith('static/') || src.startsWith('/static/') ? (src.startsWith('/') ? src : '/' + src) : '/static/' + src);
                const alt = project.logo.alt || '';
                const width = project.logo.width || '';
                const height = project.logo.height || '';
                logoHTML = `<img src="${finalSrc}" alt="${alt}" ${width ? `width="${width}"` : ''} ${height ? `height="${height}"` : ''}>`;
            }
        }

        // Get description
        const description = project.description ?
            (isEnglish ? (project.description.en || '') : (project.description.pt_br || '')) :
            (isEnglish ? 'No description available.' : 'Descrição não disponível.');

        // Build modal content
        modalBody.innerHTML = `
            <div class="modal-project-header">
                <div class="modal-project-logo">
                    ${logoHTML}
                </div>
                <div class="modal-project-title">
                    <h2>${project.name || ''}</h2>
                </div>
            </div>

            <div class="modal-project-description">
                ${description}
            </div>

            <div class="modal-project-tags">
                <div class="tags">
                    ${project.tags ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                </div>
            </div>

            ${project.previews && project.previews.length > 0 ? `
                <div class="modal-project-previews">
                    ${project.previews.map(preview => `
                        <figure class="preview">
                            <img src="${/^(https?:)?\//.test(preview.image) ? preview.image : '/static/' + preview.image}" data-lightbox-src="${/^(https?:)?\//.test(preview.lightbox) ? preview.lightbox : '/static/' + preview.lightbox}" alt="${preview.alt || ''}" loading="lazy">
                            <figcaption><em>${isEnglish ? (preview.caption?.en || '') : (preview.caption?.pt_br || '')}</em></figcaption>
                        </figure>
                    `).join('')}
                </div>
            ` : ''}

            <div class="modal-project-actions">
                ${project.actions ? project.actions.map(action => {
                    if (action.type === 'github' || action.type === 'external') {
                        return `<a href="${action.url}" class="button" target="_blank" rel="noopener">
                            <i class="${action.icon} button-icon"></i>${isEnglish ? action.label.en : action.label.pt_br}
                        </a>`;
                    } else if (action.type === 'internal') {
                        return `<a href="#" class="button">
                            <i class="${action.icon} button-icon"></i>${isEnglish ? action.label.en : action.label.pt_br}
                        </a>`;
                    } else if (action.type === 'disabled') {
                        return `<span class="button disabled">
                            <i class="${action.icon} button-icon"></i>${isEnglish ? action.label.en : action.label.pt_br}
                        </span>`;
                    }
                    return '';
                }).join('') : ''}
            </div>
        `;

        // Set up image click handlers for lightbox
        setupImageLightbox();

        // Show modal
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function setupImageLightbox() {
        const previewImages = modalBody?.querySelectorAll('.modal-project-previews img[data-lightbox-src]');
        previewImages?.forEach(img => {
            img.addEventListener('click', function() {
                const lightboxSrc = this.getAttribute('data-lightbox-src');
                const caption = this.closest('figure')?.querySelector('figcaption')?.textContent || '';
                showLightbox(lightboxSrc, caption);
            });
        });
    }

    function showLightbox(imageSrc, caption) {
        // Create lightbox overlay
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox-overlay';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <div class="lightbox-loading">
                    <div class="lightbox-spinner"></div>
                    Loading...
                </div>
                <img class="lightbox-image" src="${imageSrc}" alt="${caption}">
                <div class="lightbox-caption">${caption}</div>
                <button class="lightbox-close" aria-label="Close">&times;</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(lightbox);
        document.body.classList.add('lightbox-open');

        // Show lightbox
        setTimeout(() => lightbox.classList.add('open'), 10);

        // Handle image load
        const img = lightbox.querySelector('.lightbox-image');
        const loading = lightbox.querySelector('.lightbox-loading');

        img.addEventListener('load', function() {
            loading.style.display = 'none';
            img.classList.add('loaded');
        });

        // Close handlers
        const closeBtn = lightbox.querySelector('.lightbox-close');
        const closeLightbox = () => {
            lightbox.classList.remove('open');
            setTimeout(() => {
                document.body.removeChild(lightbox);
                document.body.classList.remove('lightbox-open');
            }, 150);
        };

        closeBtn.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) closeLightbox();
        });

        // ESC key
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // Add smooth scrolling behavior for column content
    const columnContents = document.querySelectorAll('.column-content');
    columnContents.forEach(content => {
        content.style.scrollBehavior = 'smooth';
    });
});

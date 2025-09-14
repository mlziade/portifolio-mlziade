/**
 * ProjectModal - Handles project modal functionality
 */
class ProjectModal {
    constructor() {
        this.projectsData = [];
        this.projectsById = new Map();
        this.modal = null;
        this.modalBody = null;
        this.currentLanguage = 'en';

        this.init();
    }

    init() {
        this.loadProjectData();
        this.initModal();
        this.bindEvents();
        this.detectLanguage();
    }

    loadProjectData() {
        // Try JSON script tag first (preferred method)
        const projectsScript = document.getElementById('projects-data');
        if (projectsScript) {
            try {
                this.projectsData = JSON.parse(projectsScript.textContent);
            } catch (e) {
                console.error('Failed to parse projects data:', e);
            }
        }

        // Fallback to global variable if needed
        if ((!Array.isArray(this.projectsData) || this.projectsData.length === 0) && Array.isArray(window.PROJECTS_DATA)) {
            this.projectsData = window.PROJECTS_DATA;
        }

        // Build lookup map for performance
        if (Array.isArray(this.projectsData)) {
            this.projectsData.forEach(project => {
                if (project && project.id != null) {
                    this.projectsById.set(String(project.id), project);
                }
            });
        }
    }

    initModal() {
        this.modal = document.getElementById('project-modal');
        this.modalBody = this.modal?.querySelector('.modal-body');

        if (!this.modal || !this.modalBody) {
            console.error('Modal elements not found');
            return;
        }
    }

    detectLanguage() {
        this.currentLanguage = (document.documentElement.lang || 'en').toLowerCase().startsWith('en') ? 'en' : 'pt_br';
    }

    bindEvents() {
        // Project card click handlers
        this.bindCardClickEvents();

        // Modal close handlers
        this.bindModalCloseEvents();

        // Keyboard handlers
        this.bindKeyboardEvents();
    }

    bindCardClickEvents() {
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const projectId = card.getAttribute('data-project-id');
                const project = this.findProjectById(projectId);
                if (project) {
                    // Add loading state to card
                    card.classList.add('loading');

                    this.preloadProjectImages(project)
                        .then(() => {
                            card.classList.remove('loading');
                            this.show(project);
                        })
                        .catch(() => {
                            card.classList.remove('loading');
                            this.show(project); // Show modal even if preloading fails
                        });
                }
            });
        });
    }

    bindModalCloseEvents() {
        if (!this.modal) return;

        // Close button
        const modalClose = this.modal.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.close());
            // Keyboard support (Enter/Space)
            modalClose.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.close();
                }
            });
        }

        // Click outside modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal?.classList.contains('open')) {
                this.close();
            }
        });
    }

    findProjectById(projectId) {
        // Try direct lookup first
        const project = this.projectsById.get(String(projectId));
        if (project) return project;

        // Try loose matching for edge cases
        for (const [key, value] of this.projectsById.entries()) {
            if (String(key) === String(projectId)) {
                return value;
            }
        }

        // Fallback: create minimal project from DOM
        return this.createFallbackProject(projectId);
    }

    createFallbackProject(projectId) {
        const cardElement = document.querySelector(`[data-project-id="${projectId}"]`);
        if (!cardElement) {
            console.error(`Project card not found for ID: ${projectId}`);
            return null;
        }

        const column = cardElement.closest('.kanban-column');
        const status = column?.getAttribute('data-status') || 'Unknown';
        const title = cardElement.querySelector('.card-title')?.textContent?.trim() || 'Untitled Project';
        const logo = this.extractLogoFromCard(cardElement);

        const fallbackProject = {
            id: projectId,
            name: title,
            status,
            logo,
            description: {
                en: 'No description available.',
                pt_br: 'Descrição não disponível.'
            },
            tags: [],
            actions: [],
            previews: []
        };

        console.warn('Using fallback project data from DOM:', fallbackProject);
        return fallbackProject;
    }

    preloadProjectImages(project) {
        return new Promise((resolve) => {
            if (!project.previews || !Array.isArray(project.previews) || project.previews.length === 0) {
                resolve(); // No images to preload
                return;
            }

            const imagePromises = [];

            project.previews.forEach(preview => {
                // Preload both thumbnail and lightbox images
                if (preview.image) {
                    imagePromises.push(this.preloadImage(this.normalizeImageSrc(preview.image)));
                }
                if (preview.lightbox) {
                    imagePromises.push(this.preloadImage(this.normalizeImageSrc(preview.lightbox)));
                }
            });

            // Wait for all images to load (or timeout after 3 seconds)
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
            Promise.race([Promise.all(imagePromises), timeoutPromise]).then(resolve);
        });
    }

    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }

    extractLogoFromCard(cardElement) {
        const logoImg = cardElement.querySelector('.card-logo img');
        if (!logoImg) return null;

        try {
            const url = new URL(logoImg.src, window.location.origin);
            const relativePath = url.pathname.startsWith('/static/')
                ? url.pathname.replace(/^\/static\//, '')
                : url.pathname;

            return {
                webp: relativePath,
                alt: logoImg.alt || '',
                width: logoImg.width || '',
                height: logoImg.height || ''
            };
        } catch (error) {
            console.warn('Error parsing logo URL:', error);
            return {
                src: logoImg.src,
                alt: logoImg.alt || '',
                width: logoImg.width || '',
                height: logoImg.height || ''
            };
        }
    }


    show(project) {
        if (!this.modal || !this.modalBody) {
            console.error('Modal not initialized');
            return;
        }

        try {
            this.renderModalContent(project);
            this.setupImageLightbox();
            this.openModal();
        } catch (error) {
            console.error('Error showing modal:', error);
        }
    }

    renderModalContent(project) {
        const logoHTML = this.generateLogoHTML(project.logo);
        const description = this.getLocalizedDescription(project.description);
    const tagsHTML = this.generateTagsHTML(project.tags);
        const previewsHTML = this.generatePreviewsHTML(project.previews);
        const actionsHTML = this.generateActionsHTML(project.actions);

        this.modalBody.innerHTML = `
            <div class="modal-project-hero">
                <div class="modal-project-header">
                    <div class="modal-project-logo">
                        ${logoHTML}
                    </div>
                    <div class="modal-project-title">
                        <h2>${this.escapeHtml(project.name || 'Untitled Project')}</h2>
                        <div class="modal-project-tags">
                            <div class="tags">${tagsHTML}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-project-content">
                <div class="modal-project-description">
                    <h3>About</h3>
                    <p>${description}</p>
                </div>

                ${previewsHTML}
            </div>

            <div class="modal-project-footer">
                <div class="modal-project-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    generateLogoHTML(logo) {
        if (!logo) return '';

        const src = logo.webp || logo.png || logo.gif || logo.src;
        if (!src) return '';

        const finalSrc = this.normalizeImageSrc(src);
        const alt = this.escapeHtml(logo.alt || '');
        const width = logo.width ? `width="${logo.width}"` : '';
        const height = logo.height ? `height="${logo.height}"` : '';

        return `<img src="${finalSrc}" alt="${alt}" ${width} ${height}>`;
    }

    getLocalizedDescription(description) {
        if (!description) {
            return this.currentLanguage === 'en'
                ? 'No description available.'
                : 'Descrição não disponível.';
        }

        const text = this.currentLanguage === 'en'
            ? (description.en || description.pt_br || '')
            : (description.pt_br || description.en || '');

        return this.escapeHtml(text);
    }

    generateTagsHTML(tags) {
        if (!Array.isArray(tags) || tags.length === 0) return '';

        return tags
            .map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`)
            .join('');
    }

    generatePreviewsHTML(previews) {
        if (!Array.isArray(previews) || previews.length === 0) return '';

        const previewItems = previews.map(preview => {
            const imageSrc = this.normalizeImageSrc(preview.image);
            const lightboxSrc = this.normalizeImageSrc(preview.lightbox);
            const alt = this.escapeHtml(preview.alt || '');
            const caption = this.getLocalizedText(preview.caption);

            return `
                <figure class="preview">
                    <img src="${imageSrc}" data-lightbox-src="${lightboxSrc}" alt="${alt}" loading="lazy">
                    <figcaption><em>${this.escapeHtml(caption)}</em></figcaption>
                </figure>
            `;
        }).join('');

        return `
            <div class="modal-project-previews">
                <div class="preview-grid">
                    ${previewItems}
                </div>
            </div>
        `;
    }

    generateActionsHTML(actions) {
        if (!Array.isArray(actions) || actions.length === 0) return '';

        return actions.map(action => {
            const label = this.getLocalizedText(action.label);
            const icon = action.icon ? `<i class="${action.icon} button-icon"></i>` : '';

            switch (action.type) {
                case 'github':
                case 'external':
                    return `<a href="${this.escapeHtml(action.url)}" class="button" target="_blank" rel="noopener">
                        ${icon}${this.escapeHtml(label)}
                    </a>`;
                case 'internal':
                    return `<a href="${this.escapeHtml(action.url)}" class="button">
                        ${icon}${this.escapeHtml(label)}
                    </a>`;
                case 'disabled':
                    return `<span class="button disabled">
                        ${icon}${this.escapeHtml(label)}
                    </span>`;
                default:
                    return '';
            }
        }).join('');
    }

    getLocalizedText(textObj) {
        if (!textObj) return '';
        if (typeof textObj === 'string') return textObj;

        return this.currentLanguage === 'en'
            ? (textObj.en || textObj.pt_br || '')
            : (textObj.pt_br || textObj.en || '');
    }

    normalizeImageSrc(src) {
        if (!src) return '';
        if (/^(https?:)?\//.test(src)) return src;
        if (src.startsWith('/static/')) return src;
        if (src.startsWith('static/')) return '/' + src;
        return '/static/' + src;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openModal() {
        this.modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    setupImageLightbox() {
        if (!this.modalBody) return;

        const previewImages = this.modalBody.querySelectorAll('.modal-project-previews img[data-lightbox-src]');
        previewImages.forEach(img => {
            img.addEventListener('click', () => {
                const lightboxSrc = img.getAttribute('data-lightbox-src');
                const caption = img.closest('figure')?.querySelector('figcaption')?.textContent || '';
                if (lightboxSrc) {
                    this.showLightbox(lightboxSrc, caption);
                }
            });
        });
    }

    showLightbox(imageSrc, caption = '') {
        const lightbox = this.createLightboxElement(imageSrc, caption);
        this.displayLightbox(lightbox);
    }

    createLightboxElement(imageSrc, caption) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox-overlay';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <div class="lightbox-loading">
                    <div class="lightbox-spinner"></div>
                    Loading...
                </div>
                <img class="lightbox-image" src="${this.escapeHtml(imageSrc)}" alt="${this.escapeHtml(caption)}">
                <div class="lightbox-caption">${this.escapeHtml(caption)}</div>
                <button class="lightbox-close" aria-label="Close">&times;</button>
            </div>
        `;

        this.bindLightboxEvents(lightbox);
        return lightbox;
    }

    displayLightbox(lightbox) {
        document.body.appendChild(lightbox);
        document.body.classList.add('lightbox-open');

        // Trigger animation
        requestAnimationFrame(() => {
            lightbox.classList.add('open');
        });

        // Handle image loading
        const img = lightbox.querySelector('.lightbox-image');
        const loading = lightbox.querySelector('.lightbox-loading');

        img.addEventListener('load', () => {
            loading.style.display = 'none';
            img.classList.add('loaded');
        });

        img.addEventListener('error', () => {
            loading.textContent = 'Failed to load image';
        });
    }

    bindLightboxEvents(lightbox) {
        const closeBtn = lightbox.querySelector('.lightbox-close');

        const closeLightbox = () => {
            lightbox.classList.remove('open');
            setTimeout(() => {
                if (lightbox.parentNode) {
                    document.body.removeChild(lightbox);
                }
                document.body.classList.remove('lightbox-open');
            }, 150);
        };

        // Close button click
        closeBtn.addEventListener('click', closeLightbox);

        // Click outside to close
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Escape key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    addSmoothScrolling() {
        const columnContents = document.querySelectorAll('.column-content');
        columnContents.forEach(content => {
            content.style.scrollBehavior = 'smooth';
        });
    }
}

// Initialize the modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const projectModal = new ProjectModal();
    projectModal.addSmoothScrolling();
});

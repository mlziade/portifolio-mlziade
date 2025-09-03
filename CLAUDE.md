# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Django-based personal portfolio website deployed at [mlziade.com.br](https://mlziade.com.br). The project showcases skills, projects, and experience while demonstrating cloud infrastructure management abilities.

## Technology Stack

### Backend
- **Django 5.1.7**: Python web framework
- **Python 3.13+**: Programming language
- **SQLite**: Database
- **Django REST Framework**: API endpoints
- **uv**: Modern Python package manager

### Frontend
- **HTML5/CSS3/JavaScript**: Core web technologies
- **Bootstrap 5**: CSS framework (via django-bootstrap5)
- **Django Compressor**: Static file optimization
- **WebP images**: Optimized image formats

### Infrastructure
- **Ubuntu Server**: Hosting platform
- **Nginx**: Reverse proxy
- **Gunicorn**: WSGI server
- **Systemd**: Process management
- **Cloudflare CDN**: Content delivery and caching
- **GitHub Actions**: CI/CD pipeline

## Development Commands

**Essential Commands:**
- `uv run manage.py runserver` - Start development server
- `uv run manage.py makemigrations` - Create database migrations after model changes
- `uv run manage.py migrate` - Apply database migrations locally
- `uv run manage.py collectstatic` - Collect static files for deployment

**Package Management:**
- Always use `uv` commands instead of `pip` or `python` directly
- All dependencies are managed through `pyproject.toml`

## Coding Guidelines

### Python Guidelines

* If there are uv files (like `uv.lock`) in the project, use uv commands.
* NEVER import or use the `typing` library in def functions signature — always use python type hints like the example below.
* Always use the logging library to create logs.
* Use Docstrings format for commenting on the code.

## Project Structure

```
portifolio-mlziade/
├── portifolio/                # Main portfolio app
│   ├── views.py               # Portfolio views with language switching
│   ├── language_utils.py      # Language/i18n utilities
│   ├── middleware.py          # Custom middleware
│   ├── static/                # Portfolio-specific static files
│   └── templates/             # HTML templates (multilingual)
├── playground/                # Experimental features app
│   ├── game_of_life/          # Conway's Game of Life implementation
│   ├── zllm/                  # ZLLM AI integration
│   ├── static/                # Playground static files
│   └── templates/             # Playground templates
├── portifolio_mlziade/        # Django project settings
├── static/                    # Global static files
├── templates/                 # Base templates
└── staticfiles/               # Collected static files (production)
```

## Code Architecture

### Two-App Structure
- **`portifolio`** - Main portfolio site (home, about, resume, projects, contact)
- **`playground`** - Experimental features (Conway's Game of Life, ZLLM AI integration)

### Key Features

#### 1. Portfolio Sections
- Home page with introduction
- About page with background
- Projects showcase
- Resume/CV section
- Contact information

#### 2. Playground Features
- **Conway's Game of Life**: Interactive cellular automaton
- **ZLLM Integration**: AI chat functionality with streaming responses
- Rate limiting via Django REST Framework

#### 3. Performance Optimizations
- Static file compression and hashing
- Cloudflare CDN integration
- WebP image format support
- Manifest-based static files storage

### Multilingual System
The codebase uses a **custom language system** instead of Django's built-in i18n:

**Language Detection Chain (priority order):**
1. Query parameter (`?lang=en` or `?lang=pt-br`)
2. Session storage 
3. Cookie (`language_preference`)
4. Browser headers (`Accept-Language`)
5. Default to English

**Implementation:**
- **`LanguageMiddleware`** handles detection and storage
- **`language_utils.py`** provides helper functions
- **Template naming**: `[page]_[language].html` (e.g., `home_en.html`, `about_pt-br.html`)
- **Language switching**: AJAX-enabled via `LanguageSwitchView`

### Static Files & Templates
- **Global static files**: `/static/` directory
- **App-specific static files**: `{app}/static/` directories
- **Base template**: `templates/base.html` with language-specific extensions
- **Static file optimization**: Django Compressor with content hashing for CDN caching

### Custom Middleware
1. **`StaticFilesCookieMiddleware`** - Removes cookies from static files, adds cache headers
2. **`LanguageMiddleware`** - Handles language detection and session/cookie management

### API Endpoints
- **Conway's Game of Life**: `/playground/api/game-of-life/`
- **ZLLM Integration**: Personal LLM API with streaming responses (rate-limited to 5 requests/minute)
  - Implementation details available in `playground/zllm/service.py`

### ZLLM Integration
- **Service layer pattern**: Business logic in `playground/zllm/service.py`
- **Personal LLM API** with token-based authentication
- **Streaming responses** via Server-Sent Events
- **Rate limiting**: 5 requests/minute via Django REST Framework
- **Error handling**: Comprehensive user-friendly error messages

#### ZLLM API Integration Details

When asked to integrate with the ZLLM API or create a connector file, use the following examples for the basic endpoints:

**Environment Variables:**
* `ZLLM_API_KEY`: The API key
* `ZLLM_BASE_URL`: `https://zllm.mlziade.com.br`
* `ZLLM_MODEL`: `gemma3:1b`

**Example cURL Requests:**

Auth:
```bash
curl --location '{{ZLLM_BASE_URL}}/auth' \
  --header 'Content-Type: application/json' \
  --data '{"api_key": "{{ZLLM_API_KEY}}"}'
```

Example Response:
```json
{
  "expires_at": "2025-05-11T22:17:49.1992874-03:00",
  "role": "admin",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Generate:
```bash
curl --location '{{ZLLM_BASE_URL}}/llm/generate' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <your_token>' \
  --data '{"prompt": "What is an LLM in 200 words?", "model": "{{ZLLM_MODEL}}"}'
```

Generate (Streaming):
```bash
curl --location '{{ZLLM_BASE_URL}}/llm/generate/streaming' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <your_token>' \
  --data '{"prompt": "O que são LLM em 200 palavras", "model": "{{ZLLM_MODEL}}"}'
```

### API Design Patterns
- **Thin controllers**: Views delegate to service layer
- **Class-based views**: Consistent HTTP method handling
- **Rate limiting**: Applied to public API endpoints
- **JSON responses**: Standardized error and success formats

### Static Files & Assets
- Global static files in `/static/`
- App-specific static files in `{app}/static/`
- Optimized images with WebP format
- Favicon set included
- Service worker for PWA features

## Important File Locations

**Core Configuration:**
- `portifolio_mlziade/settings.py` - Django settings with static file optimization
- `portifolio_mlziade/urls.py` - URL routing with sitemap and robots.txt

**Language System:**
- `portifolio/middleware.py` - Language detection and static file optimization
- `portifolio/language_utils.py` - Template name generation and context helpers

**Main Applications:**
- `portifolio/views.py` - Portfolio views with language switching
- `playground/views.py` - Conway's Game of Life and ZLLM integration

**External Integrations:**
- `playground/zllm/service.py` - ZLLM API service layer
- `playground/game_of_life/engine.py` - Game of Life implementation

## Development Notes

**Language System Conventions:**
- Templates must exist in both languages: `{page}_en.html` and `{page}_pt-br.html`
- Use `get_template_name()` and `get_language_context()` from `language_utils.py`
- Language switching preserves current page context

**Static File Handling:**
- Use Django Compressor for CSS/JS optimization
- Images optimized with WebP format
- Static files served with proper cache headers for CDN

**ZLLM Integration:**
- All business logic in service layer, not views
- Handle authentication, rate limiting, and streaming in service
- Provide user-friendly error messages for API failures

**Deployment:**
- **Production deployment**: Hetzner Ubuntu server
- **Reverse proxy**: Nginx configuration
- **WSGI server**: Gunicorn
- **Process management**: Systemd
- **CI/CD**: GitHub Actions (automated on push)
- **Process**: Simply commit and push code - GitHub Actions handles the rest
- Production migrations handled by deployment pipeline

## Environment Configuration

- Uses `python-dotenv` for environment variables
- Basic environment variables needed:
  - `DJANGO_SECRET_KEY`
  - `DEBUG`
  - `ALLOWED_HOSTS`
- No additional environment variables required for development

## Database Management

- **SQLite**: Development database (included)
- **Migrations**: 
  - Create when changing models: `uv run manage.py makemigrations`
  - Apply locally: `uv run manage.py migrate`
  - Production migrations handled automatically by CI/CD pipeline

## Testing & Quality

- No test suite currently implemented
- No linting/formatting tools in current workflow
- All dependencies managed through `pyproject.toml`
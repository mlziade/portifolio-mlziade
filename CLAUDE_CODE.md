# Claude Code Context - Portfolio Website

## Project Overview

This is a Django-based personal portfolio website deployed at [mlziade.com.br](https://mlziade.com.br). The project showcases skills, projects, and experience while demonstrating cloud infrastructure management abilities.

## Technology Stack

### Backend
- **Django 5.1.7**: Python web framework
- **Python 3.13+**: Programming language
- **SQLite**: Database
- **Django REST Framework**: API endpoints
- **uv**: Modern Python package manager
- **ruff**: Fast Python linter

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

## Key Features

### 1. Multilingual Support
- English and Portuguese (pt-br) versions
- Custom language middleware: `portifolio/middleware.py:56`
- Language switching via AJAX: `portifolio/views.py:8-51`
- Template naming convention: `{page}_{language}.html`

### 2. Portfolio Sections
- Home page with introduction
- About page with background
- Projects showcase
- Resume/CV section
- Contact information

### 3. Playground Features
- **Conway's Game of Life**: Interactive cellular automaton
- **ZLLM Integration**: AI chat functionality with streaming responses
- Rate limiting via Django REST Framework

### 4. Performance Optimizations
- Static file compression and hashing
- Cloudflare CDN integration
- WebP image format support
- Manifest-based static files storage

## Development Commands

- **Run development server**: `uv run manage.py runserver`
- **Database migrations**: 
  - Create migrations: `uv run manage.py makemigrations`
  - Apply migrations: `uv run manage.py migrate`
- **Static files collection**: `uv run manage.py collectstatic`
- **Testing**: No tests implemented currently
- **Linting/Formatting**: Not currently used in development workflow

## Deployment

- **Production deployment**: Hetzner Ubuntu server
- **Reverse proxy**: Nginx configuration
- **WSGI server**: Gunicorn
- **Process management**: Systemd
- **CI/CD**: GitHub Actions (automated on push)
- **Process**: Simply commit and push code - GitHub Actions handles the rest

## Environment Configuration

- Uses `python-dotenv` for environment variables
- Basic environment variables needed:
  - `DJANGO_SECRET_KEY`
  - `DEBUG`
  - `ALLOWED_HOSTS`
- No additional environment variables required for development

## API Endpoints

- **Conway's Game of Life**: `/playground/api/game-of-life/`
- **ZLLM Integration**: Personal LLM API with streaming responses (rate-limited to 5 requests/minute)
  - Implementation details available in `playground/zllm/service.py`

## Static Files & Assets

- Global static files in `/static/`
- App-specific static files in `{app}/static/`
- Optimized images with WebP format
- Favicon set included
- Service worker for PWA features

## Recent Development

Based on recent commits:
- Status cube for response loading indication
- Enhanced error handling for ZLLM integration
- Improved clipboard functionality
- Tag styling adjustments
- Token authentication improvements

## Database Management

- **SQLite**: Development database (included)
- **Migrations**: 
  - Create when changing models: `uv run manage.py makemigrations`
  - Apply locally: `uv run manage.py migrate`
  - Production migrations handled automatically by CI/CD pipeline

## Development Notes

- **Package Management**: Always use `uv` commands (e.g., `uv run manage.py runserver`)
- **Testing**: No test suite implemented currently
- **Linting/Formatting**: Not part of current development workflow
- **Dependencies**: All dependencies listed in `pyproject.toml`
- **ZLLM**: Personal LLM API - implementation details in codebase only
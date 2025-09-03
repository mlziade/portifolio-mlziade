from django.shortcuts import render, redirect
from django.views import View
from django.http import Http404, JsonResponse
from django.urls import reverse
from django.conf import settings
from .language_utils import get_current_language, get_template_name, get_language_context, set_language_preference
import json
import os
import logging

logger = logging.getLogger('portifolio.views')

class LanguageSwitchView(View):
    """View to handle language switching via AJAX or regular requests."""
    
    def post(self, request):
        """Handle language switching via AJAX POST request."""
        language = request.POST.get('language')
        
        if set_language_preference(request, language):
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                # AJAX request - return JSON response
                return JsonResponse({
                    'success': True,
                    'language': language,
                    'message': 'Language updated successfully'
                })
            else:
                # Regular form submission - redirect to current page
                return redirect(request.META.get('HTTP_REFERER', 'portifolio:home'))
        
        # Invalid language
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': False,
                'error': 'Invalid language code'
            }, status=400)
        else:
            return redirect(request.META.get('HTTP_REFERER', 'portifolio:home'))
    
    def get(self, request):
        """Handle language switching via GET request (for backward compatibility)."""
        language = request.GET.get('lang')
        
        if set_language_preference(request, language):
            # Remove lang parameter from URL and redirect
            redirect_url = request.META.get('HTTP_REFERER', reverse('portifolio:home'))
            
            # Clean the URL by removing lang parameter
            if '?lang=' in redirect_url:
                redirect_url = redirect_url.split('?lang=')[0]
            elif '&lang=' in redirect_url:
                redirect_url = redirect_url.split('&lang=')[0]
            
            return redirect(redirect_url)
        
        return redirect('portifolio:home')


class HomeView(View):
    def get(self, request):
        # Get language from middleware (session/cookie based)
        template_name = get_template_name('home', request)
        context = get_language_context(request)
        return render(request, template_name, context)
    
class AboutView(View):
    def get(self, request):
        # Get language from middleware (session/cookie based)
        template_name = get_template_name('about', request)
        context = get_language_context(request)
        return render(request, template_name, context)
    
class ResumeView(View):
    def get(self, request):
        # Get language from middleware (session/cookie based)
        template_name = get_template_name('resume', request)
        context = get_language_context(request)
        return render(request, template_name, context)

class ProjectsView(View):
    def get(self, request):
        """Render projects page with dynamic data from JSON fixtures."""
        template_name = get_template_name('projects', request)
        context = get_language_context(request)
        
        # Load projects data from fixtures
        projects_data = self._load_projects_data()
        context['projects'] = projects_data['projects']
        
        return render(request, template_name, context)
    
    def _load_projects_data(self):
        """Load projects data from JSON fixture file."""
        try:
            fixtures_path = os.path.join(settings.BASE_DIR, 'portifolio', 'fixtures', 'projects.json')
            with open(fixtures_path, 'r', encoding='utf-8') as file:
                return json.load(file)
        except FileNotFoundError:
            logger.error(f"Projects fixture file not found at {fixtures_path}")
            return {'projects': []}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing projects fixture JSON: {e}")
            return {'projects': []}
        except Exception as e:
            logger.error(f"Unexpected error loading projects fixture: {e}")
            return {'projects': []}

class ContactView(View):
    def get(self, request):
        # Get language from middleware (session/cookie based)
        template_name = get_template_name('contact', request)
        context = get_language_context(request)
        return render(request, template_name, context)

def custom_404_view(request, exception):
    """Custom 404 error handler that respects language preferences"""
    # Use the language from middleware
    current_lang = get_current_language(request)
    template_name = f'404_{current_lang}.html'
    context = get_language_context(request)
    return render(request, template_name, context, status=404)
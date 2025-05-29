from django.shortcuts import render
from django.views import View
from django.http import Http404


class HomeView(View):
    def get(self, request):
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')

        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'

        return render(request, f'home_{lang}.html', {'current_lang': lang})
    
class AboutView(View):
    def get(self, request):
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')

        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'

        return render(request, f'about_{lang}.html', {'current_lang': lang})
    
class ResumeView(View):
    def get(self, request):
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')

        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'
        return render(request, f'resume_{lang}.html', {'current_lang': lang})

class ProjectsView(View):
    def get(self, request):
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')

        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'
        return render(request, f'projects_{lang}.html', {'current_lang': lang})

class ContactView(View):
    def get(self, request):
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'
        return render(request, f'contact_{lang}.html', {'current_lang': lang})

def custom_404_view(request, exception):
    """Custom 404 error handler that respects language preferences"""
    # Check for language preference in various sources
    lang = None
    
    # First, check the query parameter
    if 'lang' in request.GET:
        lang = request.GET.get('lang')
    
    # Then check if there's a language preference in the session
    elif hasattr(request, 'session') and 'lang' in request.session:
        lang = request.session.get('lang')
    
    # Check the Accept-Language header as fallback
    elif hasattr(request, 'META') and 'HTTP_ACCEPT_LANGUAGE' in request.META:
        accept_lang = request.META['HTTP_ACCEPT_LANGUAGE'].lower()
        if 'pt' in accept_lang or 'br' in accept_lang:
            lang = 'pt-br'
        else:
            lang = 'en'
    
    # Default to pt-br if no language detected
    if lang not in ['pt-br', 'en']:
        lang = 'pt-br'
    
    template_name = f'404_{lang}.html'
    return render(request, template_name, {'current_lang': lang}, status=404)
"""
Language utility functions for the portfolio application.
"""

def get_current_language(request):
    """
    Get the current language from the request.
    Returns 'en' by default if no language is set.
    """
    return getattr(request, 'current_lang', 'en')


def set_language_preference(request, language):
    """
    Set the language preference in the session.
    
    Args:
        request: Django request object
        language: Language code ('en' or 'pt-br')
    """
    supported_languages = ['en', 'pt-br']
    
    if language in supported_languages:
        request.session['language'] = language
        request.current_lang = language
        return True
    return False


def get_template_name(base_name, request):
    """
    Get the appropriate template name based on current language.
    
    Args:
        base_name: Base template name (e.g., 'home', 'about')
        request: Django request object
    
    Returns:
        Template name with language suffix (e.g., 'home_en.html')
    """
    current_lang = get_current_language(request)
    return f"{base_name}_{current_lang}.html"


def get_language_context(request):
    """
    Get language-related context variables for templates.
    
    Args:
        request: Django request object
    
    Returns:
        Dictionary with language context
    """
    current_lang = get_current_language(request)
    
    return {
        'current_lang': current_lang,
        'is_english': current_lang == 'en',
        'is_portuguese': current_lang == 'pt-br',
        'other_lang': 'pt-br' if current_lang == 'en' else 'en',
        'other_lang_name': 'Português' if current_lang == 'en' else 'English'
    }

from django.utils.deprecation import MiddlewareMixin
from django.shortcuts import redirect
from django.urls import reverse
from django.http import HttpResponse


class LanguageMiddleware(MiddlewareMixin):
    """
    Middleware to handle language detection and storage using sessions and cookies.
    Defaults to English ('en') and supports Portuguese ('pt-br').
    """
    
    SUPPORTED_LANGUAGES = ['en', 'pt-br']
    DEFAULT_LANGUAGE = 'en'
    
    def process_request(self, request):
        """Process the request to determine and set the language preference."""
        
        # Get current language from various sources
        current_lang = self.get_language_from_request(request)
        
        # Store in session for persistence
        request.session['language'] = current_lang
        
        # Set a cookie that expires in 1 year
        request.LANGUAGE_CODE = current_lang
        
        # Add language to request for template use
        request.current_lang = current_lang
        
        return None
    
    def process_response(self, request, response):
        """Set language cookie in the response."""
        if hasattr(request, 'current_lang'):
            # Set cookie for 1 year
            response.set_cookie(
                'language_preference', 
                request.current_lang,
                max_age=365 * 24 * 60 * 60,  # 1 year
                httponly=False,  # Allow JavaScript access if needed
                samesite='Lax'
            )
        return response
    
    def get_language_from_request(self, request):
        """
        Determine language preference from request in order of priority:
        1. Query parameter (?lang=en)
        2. Session storage
        3. Cookie
        4. Accept-Language header
        5. Default language (English)
        """
        
        # 1. Check query parameter (for manual language switching)
        if 'lang' in request.GET:
            lang = request.GET.get('lang')
            if lang in self.SUPPORTED_LANGUAGES:
                return lang
        
        # 2. Check session
        if 'language' in request.session:
            lang = request.session.get('language')
            if lang in self.SUPPORTED_LANGUAGES:
                return lang
        
        # 3. Check cookie
        if 'language_preference' in request.COOKIES:
            lang = request.COOKIES.get('language_preference')
            if lang in self.SUPPORTED_LANGUAGES:
                return lang
        
        # 4. Check Accept-Language header (browser preference)
        if 'HTTP_ACCEPT_LANGUAGE' in request.META:
            accept_language = request.META['HTTP_ACCEPT_LANGUAGE'].lower()
            
            # Check for Portuguese
            if any(pt_code in accept_language for pt_code in ['pt-br', 'pt_br', 'pt']):
                return 'pt-br'
            
            # Check for English (but default anyway)
            if 'en' in accept_language:
                return 'en'
        
        # 5. Default to English
        return self.DEFAULT_LANGUAGE


class StaticFilesCookieMiddleware(MiddlewareMixin):
    """
    Middleware to prevent cookies from being sent with static file requests.
    This improves performance by reducing request size for static resources.
    Also adds caching headers for better performance.
    """
    
    # Static file extensions that should be served without cookies
    STATIC_EXTENSIONS = {
        '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', 
        '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.pdf'
    }
    
    def process_response(self, request, response):
        """Remove cookies from static file responses and add caching headers."""
        
        # Check if this is a request for static files (by path or extension)
        is_static = (
            request.path.startswith('/static/') or 
            request.path.startswith('/staticfiles/') or
            request.path.startswith('/media/') or
            any(request.path.lower().endswith(ext) for ext in self.STATIC_EXTENSIONS)
        )
        
        if is_static:
            # Clear all cookies for static file responses
            response.cookies.clear()
            
            # Remove Set-Cookie headers completely
            if 'Set-Cookie' in response:
                del response['Set-Cookie']
            
            # Add cache headers for better performance (1 year for static assets)
            if not response.get('Cache-Control'):
                response['Cache-Control'] = 'public, max-age=31536000, immutable'
            
            # Add ETag for better caching if not present
            if not response.get('ETag') and hasattr(response, 'content'):
                import hashlib
                etag = hashlib.md5(response.content).hexdigest()[:16]
                response['ETag'] = f'"{etag}"'
                
        return response

from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class StaticViewSitemap(Sitemap):
    """Sitemap for static portfolio pages with clean URLs"""
    priority = 0.8
    changefreq = 'weekly'
    protocol = 'https'

    def items(self):
        """Return list of URL names for the portfolio pages"""
        return [
            'portifolio:home',
            'portifolio:about', 
            'portifolio:resume',
            'portifolio:projects',
            'portifolio:contact',
        ]

    def location(self, item):
        """Return the clean URL for each item (language determined by session/cookie)"""
        return reverse(item)

    def lastmod(self, obj):
        """Return the last modification date"""
        from datetime import datetime
        return datetime(2025, 6, 8)  # Updated for new language system


class LanguageSpecificSitemap(Sitemap):
    """
    Sitemap for language-specific URLs (for backward compatibility and SEO)
    These URLs use query parameters to explicitly set language preferences
    """
    priority = 0.7
    changefreq = 'weekly'
    protocol = 'https'

    def items(self):
        """Return list of (url_name, language) tuples"""
        pages = [
            'portifolio:home',
            'portifolio:about', 
            'portifolio:resume',
            'portifolio:projects',
            'portifolio:contact',
        ]
        
        # Create entries for both languages
        items = []
        for page in pages:
            items.append((page, 'en'))     # English version
            items.append((page, 'pt-br'))  # Portuguese version
        
        return items

    def location(self, item):
        """Return the URL with language parameter for explicit language setting"""
        url_name, language = item
        return reverse(url_name) + f'?lang={language}'

    def lastmod(self, obj):
        """Return the last modification date"""
        from datetime import datetime
        return datetime(2025, 6, 8)

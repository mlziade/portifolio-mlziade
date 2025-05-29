from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class StaticViewSitemap(Sitemap):
    """Sitemap for static portfolio pages"""
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
        """Return the URL for each item with default language (English)"""
        return reverse(item) + '?lang=en'

    def lastmod(self, obj):
        """Return the last modification date"""
        from datetime import datetime
        return datetime(2025, 5, 29)  # Current date when SEO was implemented


class MultiLanguageStaticViewSitemap(Sitemap):
    """Sitemap for Portuguese language versions"""
    priority = 0.7
    changefreq = 'weekly'
    protocol = 'https'

    def items(self):
        """Return list of URL names for the portfolio pages in Portuguese"""
        return [
            'portifolio:home',
            'portifolio:about', 
            'portifolio:resume',
            'portifolio:projects',
            'portifolio:contact',
        ]

    def location(self, item):
        """Return the URL for each item with Portuguese language"""
        return reverse(item) + '?lang=pt-br'

    def lastmod(self, obj):
        """Return the last modification date"""
        from datetime import datetime
        return datetime(2025, 5, 29)

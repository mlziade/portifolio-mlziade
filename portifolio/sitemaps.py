from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class StaticViewSitemap(Sitemap):
    """
    Sitemap for portfolio pages with clean URLs.
    Language is automatically detected via middleware, so single URLs serve both languages.
    """
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
            'playground:tryout_conways',
            'playground:tryout_zllm',
            'playground:tryout_zllm_chat',
        ]

    def location(self, item):
        """Return the clean URL for each item (language automatically detected by middleware)"""
        return reverse(item)

    def lastmod(self, obj):
        """Return the last modification date"""
        from datetime import datetime
        return datetime(2025, 7, 24)  # Updated for playground features



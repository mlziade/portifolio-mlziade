"""
URL configuration for portifolio_mlziade project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.views.generic import RedirectView
from django.conf.urls.static import static
from django.contrib.sitemaps.views import sitemap
from portifolio.sitemaps import StaticViewSitemap, MultiLanguageStaticViewSitemap

# Sitemap configuration
sitemaps = {
    'static': StaticViewSitemap,
    'static_pt': MultiLanguageStaticViewSitemap,
}

urlpatterns = [
    path('admin/', admin.site.urls),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('', include('portifolio.urls')),
    path('playground/', include('playground.urls')),
    path('portifolio/', RedirectView.as_view(url='/', permanent=True)),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Custom error handlers
handler404 = 'portifolio.views.custom_404_view'
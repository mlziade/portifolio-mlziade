from django.urls import path
from .views import (
    HomeView,
    AboutView,
    ContactView,
    ResumeView,
    ProjectsView,
)

app_name = 'portifolio'

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('about/', AboutView.as_view(), name='about'),
    path('resume/', ResumeView.as_view(), name='resume'),
    path('projects/', ProjectsView.as_view(), name='projects'),
    path('contact/', ContactView.as_view(), name='contact'),
]

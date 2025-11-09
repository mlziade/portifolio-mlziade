from django.urls import path
from .views import BlogHomeView, BlogPostDetailView

app_name = 'blog'

urlpatterns = [
    path('', BlogHomeView.as_view(), name='blog_home'),
    path('<int:id>/', BlogPostDetailView.as_view(), name='blog_post_detail_by_id'),
    path('<slug:slug>/', BlogPostDetailView.as_view(), name='blog_post_detail'),
]

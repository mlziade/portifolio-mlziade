from django.shortcuts import render
from django.views import View
from django.core.paginator import Paginator
from .models import BlogPost

class BlogHomeView(View):
    template_name = 'blog_home.html'

    def get(self, request):
        posts_list = BlogPost.objects.filter(status='published').select_related('template').prefetch_related('tags')

        paginator = Paginator(posts_list, 10)
        page_number = request.GET.get('page', 1)
        posts = paginator.get_page(page_number)

        context = {
            'posts': posts,
        }

        return render(request, self.template_name, context)

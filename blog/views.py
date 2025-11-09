from django.shortcuts import render, get_object_or_404
from django.views import View
from django.core.paginator import Paginator
from .models import BlogPost
import logging
import markdown

logger = logging.getLogger(__name__)

class BlogHomeView(View):
    """Display paginated list of published blog posts."""
    template_name = 'blog_home.html'

    def get(self, request):
        posts_list = BlogPost.objects.filter(status='published').prefetch_related('tags')

        paginator = Paginator(posts_list, 10)
        page_number = request.GET.get('page', 1)
        posts = paginator.get_page(page_number)

        context = {
            'posts': posts,
        }

        return render(request, self.template_name, context)


class BlogPostDetailView(View):
    """Display individual blog post with full content. Accessible by slug or id."""
    template_name = 'blog_post.html'

    def get(self, request, slug: str = None, id: int = None):
        # Fetch by id or slug
        if id is not None:
            post = get_object_or_404(
                BlogPost.objects.prefetch_related('tags'),
                id=id,
                status='published'
            )
        else:
            post = get_object_or_404(
                BlogPost.objects.prefetch_related('tags'),
                slug=slug,
                status='published'
            )

        # Read and convert markdown content from file if content_file_path exists
        content = ""
        if post.content_file_path:
            try:
                with open(post.content_file_path, 'r', encoding='utf-8') as f:
                    markdown_content = f.read()
                    # Convert markdown to HTML with extensions for better formatting
                    md = markdown.Markdown(extensions=['extra', 'codehilite', 'fenced_code'])
                    content = md.convert(markdown_content)
            except FileNotFoundError:
                logger.error(f"Content file not found: {post.content_file_path}")
                content = "<p>Content file not found.</p>"
            except Exception as e:
                logger.error(f"Error reading content file: {e}")
                content = "<p>Error loading content.</p>"

        context = {
            'post': post,
            'content': content,
        }

        return render(request, self.template_name, context)

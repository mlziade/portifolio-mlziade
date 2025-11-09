from django.db import models
import os
from django.conf import settings

class BlogPost(models.Model):
    id = models.AutoField(primary_key=True)
    slug = models.SlugField(unique=True, max_length=50)
    title = models.CharField(max_length=200)
    excerpt = models.TextField(max_length=500)
    content_file_path = models.FilePathField(
        path=os.path.join(settings.BASE_DIR, 'blog', 'files', 'posts'),
        match=r".*\.md$",
        recursive=False,
        allow_files=True,
        allow_folders=False,
        blank=True
    )
    thumbnail = models.ImageField(upload_to='thumbnails/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    published_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft')
    # view_count = models.IntegerField(default=0)
    tags = models.ManyToManyField('Tag', related_name='blog_posts')

    def __str__(self):
        return f"Post#{self.id:03d} - {self.title}"

    class Meta:
        ordering = ['-published_date']

class Tag(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True, max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name'] 

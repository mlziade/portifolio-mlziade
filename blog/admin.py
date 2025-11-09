from django.contrib import admin
from .models import BlogPost, Tag
import os


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'status', 'published_date', 'created_at', 'has_thumbnail')
    list_filter = ('status', 'published_date', 'tags')
    search_fields = ('title', 'excerpt', 'slug')
    prepopulated_fields = {'slug': ('title',)}
    filter_horizontal = ('tags',)
    date_hierarchy = 'published_date'
    ordering = ('-published_date',)
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'slug', 'excerpt', 'status')
        }),
        ('Content', {
            'fields': ('content_file_path', 'thumbnail'),
            'description': 'Content should be a .md file from blog/files/posts/. Thumbnail should be a filename from blog/files/thumbnails/'
        }),
        ('Metadata', {
            'fields': ('tags', 'published_date', 'created_at')
        }),
    )

    @admin.display(boolean=True, description='Thumbnail')
    def has_thumbnail(self, obj):
        """Check if post has a thumbnail."""
        return bool(obj.thumbnail)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'slug', 'created_at')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

from django.contrib import admin
from .models import BlogPost, Tag, Template


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'status', 'published_date', 'created_at')
    list_filter = ('status', 'published_date', 'tags')
    search_fields = ('title', 'excerpt', 'slug')
    prepopulated_fields = {'slug': ('title',)}
    filter_horizontal = ('tags',)
    date_hierarchy = 'published_date'
    ordering = ('-published_date',)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'slug', 'created_at')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'file_path', 'is_default', 'created_at')
    list_filter = ('is_default',)
    search_fields = ('name', 'file_path', 'description')

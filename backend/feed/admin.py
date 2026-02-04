"""
Django Admin configuration for Feed models.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Post, Comment, Like, KarmaTransaction


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'total_karma', 'is_staff', 'created_at']
    list_filter = ['is_staff', 'is_superuser', 'is_active']
    search_fields = ['username', 'email']
    ordering = ['-created_at']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile', {'fields': ('avatar', 'total_karma')}),
    )


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'content_preview', 'likes_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['content', 'author__username']
    raw_id_fields = ['author']
    ordering = ['-created_at']

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'post', 'parent', 'content_preview', 'likes_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['content', 'author__username']
    raw_id_fields = ['author', 'post', 'parent']
    ordering = ['-created_at']

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'target_type', 'target_id', 'created_at']
    list_filter = ['target_type', 'created_at']
    search_fields = ['user__username']
    raw_id_fields = ['user']
    ordering = ['-created_at']


@admin.register(KarmaTransaction)
class KarmaTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'amount', 'reason', 'liker', 'created_at']
    list_filter = ['reason', 'created_at']
    search_fields = ['user__username', 'liker__username']
    raw_id_fields = ['user', 'liker']
    ordering = ['-created_at']

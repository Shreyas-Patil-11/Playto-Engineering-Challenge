"""
Models for the Community Feed application.

This module defines the database models for:
- User: Custom user model with karma tracking
- Post: Text posts with like counts
- Comment: Threaded comments with parent references
- Like: Tracks likes on posts and comments (prevents duplicates)
- KarmaTransaction: Records all karma-earning events for leaderboard calculation
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class User(AbstractUser):
    """
    Custom User model with karma tracking.
    
    Note: total_karma is a cached value for display purposes.
    The 24-hour leaderboard is calculated dynamically from KarmaTransaction.
    """
    avatar = models.URLField(
        max_length=500,
        default='https://api.dicebear.com/7.x/avataaars/svg?seed=default'
    )
    total_karma = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        
    def __str__(self):
        return self.username


class Post(models.Model):
    """
    A text post in the community feed.
    """
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    content = models.TextField(max_length=2000)
    likes_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'posts'
        ordering = ['-created_at']

    def __str__(self):
        return f"Post by {self.author.username}: {self.content[:50]}..."


class Comment(models.Model):
    """
    A comment on a post, supporting nested threading.
    
    The parent_id field allows for nested replies (like Reddit).
    Comments are stored in a flat table and assembled into a tree structure
    in the application layer to avoid N+1 queries.
    """
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    content = models.TextField(max_length=1000)
    likes_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'comments'
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.username}: {self.content[:50]}..."


class Like(models.Model):
    """
    Tracks likes on posts and comments.
    
    Uses a unique constraint on (user, target_type, target_id) to prevent
    duplicate likes at the database level.
    """
    TARGET_POST = 'post'
    TARGET_COMMENT = 'comment'
    TARGET_CHOICES = [
        (TARGET_POST, 'Post'),
        (TARGET_COMMENT, 'Comment'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    target_type = models.CharField(max_length=10, choices=TARGET_CHOICES)
    target_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'likes'
        # This unique constraint is the primary defense against double-likes
        unique_together = ['user', 'target_type', 'target_id']
        indexes = [
            models.Index(fields=['target_type', 'target_id']),
            models.Index(fields=['user', 'target_type']),
        ]

    def __str__(self):
        return f"{self.user.username} liked {self.target_type} {self.target_id}"


class KarmaTransaction(models.Model):
    """
    Records all karma-earning events.
    
    This table is the source of truth for the 24-hour leaderboard.
    Instead of storing daily karma on the User model, we calculate it
    dynamically by aggregating transactions from the last 24 hours.
    
    Karma values:
    - Post like: +5 karma
    - Comment like: +1 karma
    """
    REASON_POST_LIKE = 'post_like'
    REASON_COMMENT_LIKE = 'comment_like'
    REASON_CHOICES = [
        (REASON_POST_LIKE, 'Post Like'),
        (REASON_COMMENT_LIKE, 'Comment Like'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='karma_transactions'
    )
    amount = models.IntegerField()  # Can be negative for unlikes
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    source_id = models.PositiveIntegerField()  # ID of the post/comment that was liked
    liker = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='karma_given',
        null=True
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'karma_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.user.username}: {'+' if self.amount > 0 else ''}{self.amount} karma ({self.reason})"

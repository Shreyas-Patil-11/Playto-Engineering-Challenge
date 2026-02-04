"""
Serializers for the Community Feed API.

These serializers handle the conversion between Django models and JSON,
including the efficient serialization of nested comment trees.
"""

from rest_framework import serializers
from .models import User, Post, Comment, Like


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'total_karma', 'created_at']
        read_only_fields = ['id', 'total_karma', 'created_at']


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user serializer for embedding in other objects."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'total_karma']


class CommentSerializer(serializers.ModelSerializer):
    """
    Serializer for Comment model.
    
    Note: The 'replies' field is populated by the view after building
    the comment tree in memory, not through database queries.
    """
    author = UserMinimalSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    liked_by_current_user = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'post', 'parent', 'author', 'content',
            'likes_count', 'liked_by_current_user', 'created_at', 'replies'
        ]
        read_only_fields = ['id', 'author', 'likes_count', 'created_at']

    def get_replies(self, obj):
        """
        Return nested replies.
        
        The replies are pre-attached to the comment object by the view
        to avoid N+1 queries. This method just serializes them.
        """
        # Check if replies were pre-attached
        if hasattr(obj, '_prefetched_replies'):
            return CommentSerializer(
                obj._prefetched_replies,
                many=True,
                context=self.context
            ).data
        return []

    def get_liked_by_current_user(self, obj):
        """Check if the current user has liked this comment."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            # Check if this info was pre-attached
            if hasattr(obj, '_liked_by_user'):
                return obj._liked_by_user
            # Fallback to database query (should be avoided)
            return Like.objects.filter(
                user=request.user,
                target_type=Like.TARGET_COMMENT,
                target_id=obj.id
            ).exists()
        return False


class CommentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new comments."""
    
    class Meta:
        model = Comment
        fields = ['id', 'post', 'parent', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_parent(self, value):
        """Ensure parent comment belongs to the same post."""
        if value:
            post_id = self.initial_data.get('post')
            if value.post_id != int(post_id):
                raise serializers.ValidationError(
                    "Parent comment must belong to the same post."
                )
        return value


class PostSerializer(serializers.ModelSerializer):
    """
    Serializer for Post model with embedded author and comments.
    """
    author = UserMinimalSerializer(read_only=True)
    comments = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    liked_by_current_user = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'likes_count',
            'liked_by_current_user', 'comment_count', 'created_at', 'comments'
        ]
        read_only_fields = ['id', 'author', 'likes_count', 'created_at']

    def get_comments(self, obj):
        """
        Return the comment tree for this post.
        
        Comments are pre-fetched and assembled into a tree by the view.
        """
        if hasattr(obj, '_comment_tree'):
            return CommentSerializer(
                obj._comment_tree,
                many=True,
                context=self.context
            ).data
        return []

    def get_comment_count(self, obj):
        """Return total comment count."""
        if hasattr(obj, '_comment_count'):
            return obj._comment_count
        return obj.comments.count()

    def get_liked_by_current_user(self, obj):
        """Check if the current user has liked this post."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if hasattr(obj, '_liked_by_user'):
                return obj._liked_by_user
            return Like.objects.filter(
                user=request.user,
                target_type=Like.TARGET_POST,
                target_id=obj.id
            ).exists()
        return False


class PostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new posts."""
    
    class Meta:
        model = Post
        fields = ['id', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_content(self, value):
        """Validate post content."""
        if len(value.strip()) < 1:
            raise serializers.ValidationError("Content cannot be empty.")
        if len(value) > 2000:
            raise serializers.ValidationError("Content cannot exceed 2000 characters.")
        return value.strip()


class LeaderboardEntrySerializer(serializers.Serializer):
    """Serializer for leaderboard entries."""
    user = UserMinimalSerializer()
    karma_24h = serializers.IntegerField()
    rank = serializers.IntegerField()

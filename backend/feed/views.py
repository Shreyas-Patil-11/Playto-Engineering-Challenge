"""
Views for the Community Feed API.

This module implements the API endpoints with careful attention to:
1. N+1 query prevention using prefetch_related and in-memory tree building
2. Race condition handling using database locks (select_for_update)
3. Dynamic leaderboard calculation from karma transactions
"""

from datetime import timedelta
from django.db import transaction, IntegrityError
from django.db.models import Sum, F
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny

from .models import User, Post, Comment, Like, KarmaTransaction
from .serializers import (
    UserSerializer,
    PostSerializer,
    PostCreateSerializer,
    CommentSerializer,
    CommentCreateSerializer,
    LeaderboardEntrySerializer,
)


def build_comment_tree(comments, user=None, user_liked_ids=None):
    """
    Build a nested comment tree from a flat list of comments.
    
    This is the key to avoiding N+1 queries for nested comments.
    Instead of having the database join recursively, we:
    1. Fetch ALL comments for a post in ONE query
    2. Build the tree structure in Python (O(n) time complexity)
    
    Args:
        comments: QuerySet or list of Comment objects
        user: Current user (for checking likes)
        user_liked_ids: Set of comment IDs the user has liked
    
    Returns:
        List of root comments with nested replies attached
    """
    if user_liked_ids is None:
        user_liked_ids = set()
    
    comment_map = {}
    root_comments = []
    
    # First pass: Create a map and initialize replies list
    for comment in comments:
        comment._prefetched_replies = []
        comment._liked_by_user = comment.id in user_liked_ids
        comment_map[comment.id] = comment
    
    # Second pass: Build tree structure
    for comment in comments:
        if comment.parent_id is None:
            root_comments.append(comment)
        else:
            parent = comment_map.get(comment.parent_id)
            if parent:
                parent._prefetched_replies.append(comment)
    
    return root_comments


def get_user_liked_ids(user, target_type, target_ids):
    """
    Get set of IDs that the user has liked.
    
    This is used to batch-check likes instead of querying per item.
    """
    if not user or not user.is_authenticated:
        return set()
    
    return set(
        Like.objects.filter(
            user=user,
            target_type=target_type,
            target_id__in=target_ids
        ).values_list('target_id', flat=True)
    )


class PostViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Post CRUD operations.
    
    Handles:
    - Listing posts with optimized comment loading
    - Creating new posts
    - Liking/unliking posts with race condition protection
    """
    queryset = Post.objects.select_related('author').all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PostCreateSerializer
        return PostSerializer

    def get_queryset(self):
        """
        Get posts with optimized loading.
        
        This query fetches:
        1. All posts with their authors (select_related)
        2. For each post, we'll load comments separately to build tree
        """
        return Post.objects.select_related('author').order_by('-created_at')

    def list(self, request):
        """
        List all posts with comments loaded efficiently.
        
        The key optimization here is:
        1. Fetch all posts in one query
        2. Fetch all comments for those posts in one query
        3. Build comment trees in memory
        4. Batch-check user likes
        """
        posts = self.get_queryset()[:20]  # Limit for performance
        post_ids = [p.id for p in posts]
        
        # Get current user (for demo, we'll use a mock or session user)
        user = self._get_current_user(request)
        
        # Batch fetch all comments for all posts (ONE query)
        all_comments = Comment.objects.filter(
            post_id__in=post_ids
        ).select_related('author').order_by('created_at')
        
        # Group comments by post
        comments_by_post = {}
        for comment in all_comments:
            if comment.post_id not in comments_by_post:
                comments_by_post[comment.post_id] = []
            comments_by_post[comment.post_id].append(comment)
        
        # Get user's likes for posts
        post_liked_ids = get_user_liked_ids(user, Like.TARGET_POST, post_ids)
        
        # Get user's likes for comments
        comment_ids = [c.id for c in all_comments]
        comment_liked_ids = get_user_liked_ids(user, Like.TARGET_COMMENT, comment_ids)
        
        # Attach data to posts
        for post in posts:
            post._liked_by_user = post.id in post_liked_ids
            post_comments = comments_by_post.get(post.id, [])
            post._comment_tree = build_comment_tree(
                post_comments, 
                user, 
                comment_liked_ids
            )
            post._comment_count = len(post_comments)
        
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request):
        """Create a new post."""
        user = self._get_current_user(request)
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        serializer = PostCreateSerializer(data=request.data)
        if serializer.is_valid():
            post = serializer.save(author=user)
            return Response(
                PostSerializer(post, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """
        Like a post with race condition protection.
        
        This implementation uses:
        1. Database transaction with select_for_update to lock the row
        2. Unique constraint on Like model as backup
        3. Atomic F() expression for counter update
        """
        user = self._get_current_user(request)
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            with transaction.atomic():
                # Lock the post row to prevent race conditions
                post = Post.objects.select_for_update().get(pk=pk)
                
                # Check if already liked (inside transaction)
                if Like.objects.filter(
                    user=user,
                    target_type=Like.TARGET_POST,
                    target_id=post.id
                ).exists():
                    return Response(
                        {'error': 'Already liked this post'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create the like (unique constraint as backup)
                Like.objects.create(
                    user=user,
                    target_type=Like.TARGET_POST,
                    target_id=post.id
                )
                
                # Update like count atomically
                Post.objects.filter(pk=pk).update(likes_count=F('likes_count') + 1)
                
                # Create karma transaction (+5 for post like)
                KarmaTransaction.objects.create(
                    user=post.author,
                    amount=5,
                    reason=KarmaTransaction.REASON_POST_LIKE,
                    source_id=post.id,
                    liker=user
                )
                
                # Update author's total karma
                User.objects.filter(pk=post.author_id).update(
                    total_karma=F('total_karma') + 5
                )
                
                post.refresh_from_db()
                return Response({
                    'success': True,
                    'likes': post.likes_count,
                    'karma_awarded': 5
                })
                
        except Post.DoesNotExist:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except IntegrityError:
            # Unique constraint violation - user already liked
            return Response(
                {'error': 'Already liked this post'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def unlike(self, request, pk=None):
        """Unlike a post."""
        user = self._get_current_user(request)
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            with transaction.atomic():
                post = Post.objects.select_for_update().get(pk=pk)
                
                like = Like.objects.filter(
                    user=user,
                    target_type=Like.TARGET_POST,
                    target_id=post.id
                ).first()
                
                if not like:
                    return Response(
                        {'error': 'Like not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                like.delete()
                
                # Update like count atomically
                Post.objects.filter(pk=pk).update(
                    likes_count=F('likes_count') - 1
                )
                
                # Note: We don't remove karma for unlikes in this implementation
                # In a real app, you might want to handle this differently
                
                post.refresh_from_db()
                return Response({
                    'success': True,
                    'likes': post.likes_count
                })
                
        except Post.DoesNotExist:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        """Get or create comments for a specific post."""
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = self._get_current_user(request)
        
        if request.method == 'POST':
            # Create a new comment on this post
            if not user:
                return Response(
                    {'error': 'Authentication required'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            content = request.data.get('content', '').strip()
            parent_id = request.data.get('parent')
            
            if not content:
                return Response(
                    {'error': 'Content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            parent = None
            if parent_id:
                try:
                    parent = Comment.objects.get(pk=parent_id, post=post)
                except Comment.DoesNotExist:
                    return Response(
                        {'error': 'Parent comment not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            comment = Comment.objects.create(
                post=post,
                author=user,
                content=content,
                parent=parent
            )
            
            # Update post comment count
            Post.objects.filter(pk=pk).update(comments_count=F('comments_count') + 1)
            
            return Response(
                CommentSerializer(comment, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        
        # GET: Fetch all comments in ONE query
        comments = Comment.objects.filter(
            post=post
        ).select_related('author').order_by('created_at')
        
        # Get user's likes for these comments
        comment_ids = [c.id for c in comments]
        comment_liked_ids = get_user_liked_ids(user, Like.TARGET_COMMENT, comment_ids)
        
        # Build tree
        comment_tree = build_comment_tree(comments, user, comment_liked_ids)
        
        serializer = CommentSerializer(
            comment_tree,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)

    def _get_current_user(self, request):
        """
        Get the current user from the request.
        
        For demo purposes, we use session-based user or create/get a demo user.
        In production, this would use proper authentication.
        """
        if request.user and request.user.is_authenticated:
            return request.user
        
        # For demo: get or create a demo user
        demo_user, _ = User.objects.get_or_create(
            username='demo_user',
            defaults={
                'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
                'total_karma': 100
            }
        )
        return demo_user


class CommentViewSet(viewsets.ModelViewSet):
    """ViewSet for Comment CRUD operations."""
    queryset = Comment.objects.select_related('author', 'post').all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CommentCreateSerializer
        return CommentSerializer

    def create(self, request):
        """Create a new comment."""
        user = self._get_current_user(request)
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        serializer = CommentCreateSerializer(data=request.data)
        if serializer.is_valid():
            comment = serializer.save(author=user)
            return Response(
                CommentSerializer(comment, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like a comment with race condition protection."""
        user = self._get_current_user(request)
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            with transaction.atomic():
                comment = Comment.objects.select_for_update().get(pk=pk)
                
                if Like.objects.filter(
                    user=user,
                    target_type=Like.TARGET_COMMENT,
                    target_id=comment.id
                ).exists():
                    return Response(
                        {'error': 'Already liked this comment'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                Like.objects.create(
                    user=user,
                    target_type=Like.TARGET_COMMENT,
                    target_id=comment.id
                )
                
                Comment.objects.filter(pk=pk).update(
                    likes_count=F('likes_count') + 1
                )
                
                # +1 karma for comment like
                KarmaTransaction.objects.create(
                    user=comment.author,
                    amount=1,
                    reason=KarmaTransaction.REASON_COMMENT_LIKE,
                    source_id=comment.id,
                    liker=user
                )
                
                User.objects.filter(pk=comment.author_id).update(
                    total_karma=F('total_karma') + 1
                )
                
                comment.refresh_from_db()
                return Response({
                    'success': True,
                    'likes': comment.likes_count,
                    'karma_awarded': 1
                })
                
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except IntegrityError:
            return Response(
                {'error': 'Already liked this comment'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def unlike(self, request, pk=None):
        """Unlike a comment."""
        user = self._get_current_user(request)
        if not user:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            with transaction.atomic():
                comment = Comment.objects.select_for_update().get(pk=pk)
                
                like = Like.objects.filter(
                    user=user,
                    target_type=Like.TARGET_COMMENT,
                    target_id=comment.id
                ).first()
                
                if not like:
                    return Response(
                        {'error': 'Like not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                like.delete()
                
                Comment.objects.filter(pk=pk).update(
                    likes_count=F('likes_count') - 1
                )
                
                comment.refresh_from_db()
                return Response({
                    'success': True,
                    'likes': comment.likes_count
                })
                
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def _get_current_user(self, request):
        """Get current user (same as PostViewSet)."""
        if request.user and request.user.is_authenticated:
            return request.user
        demo_user, _ = User.objects.get_or_create(
            username='demo_user',
            defaults={
                'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
                'total_karma': 100
            }
        )
        return demo_user


class LeaderboardView(APIView):
    """
    API view for the 24-hour karma leaderboard.
    
    This is the key implementation for the "Complex Aggregation" requirement.
    The leaderboard is calculated DYNAMICALLY from KarmaTransaction records,
    not from a stored "daily_karma" field.
    """
    
    def get(self, request):
        """
        Get the top 5 users by karma earned in the last 24 hours.
        
        The SQL generated by this QuerySet:
        
        SELECT user_id, COALESCE(SUM(amount), 0) as karma_24h
        FROM karma_transactions
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY user_id
        ORDER BY karma_24h DESC
        LIMIT 5
        """
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        
        # This is the core leaderboard query
        # It aggregates karma from transactions, not from stored values
        leaderboard_data = KarmaTransaction.objects.filter(
            created_at__gte=twenty_four_hours_ago
        ).values(
            'user_id'
        ).annotate(
            karma_24h=Coalesce(Sum('amount'), 0)
        ).filter(
            karma_24h__gt=0  # Only include users with positive karma
        ).order_by(
            '-karma_24h'
        )[:5]
        
        # Fetch user objects for the leaderboard
        user_ids = [entry['user_id'] for entry in leaderboard_data]
        users = {u.id: u for u in User.objects.filter(id__in=user_ids)}
        
        # Build response
        result = []
        for rank, entry in enumerate(leaderboard_data, 1):
            user = users.get(entry['user_id'])
            if user:
                result.append({
                    'user': user,
                    'karma_24h': entry['karma_24h'],
                    'rank': rank
                })
        
        serializer = LeaderboardEntrySerializer(result, many=True)
        return Response(serializer.data)


@api_view(['GET'])
def current_user(request):
    """Get the current user's info."""
    if request.user and request.user.is_authenticated:
        return Response(UserSerializer(request.user).data)
    
    # For demo
    demo_user, _ = User.objects.get_or_create(
        username='demo_user',
        defaults={
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
            'total_karma': 100
        }
    )
    return Response(UserSerializer(demo_user).data)


class LoginView(APIView):
    """Handle user login and return auth token."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response(
                {'error': 'Username and password required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(username=username, password=password)
        
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data
            })
        
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )


class RegisterView(APIView):
    """Handle user registration."""
    permission_classes = [AllowAny]
    
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not username or not password:
            return Response(
                {'error': 'Username and password required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = User.objects.create_user(
            username=username,
            email=email or '',
            password=password,
            avatar=f'https://api.dicebear.com/7.x/avataaars/svg?seed={username}',
            total_karma=0
        )
        
        token, _ = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """Handle user logout."""
    
    def post(self, request):
        if request.user and request.user.is_authenticated:
            try:
                request.user.auth_token.delete()
            except Exception:
                pass
        
        return Response({'success': True})

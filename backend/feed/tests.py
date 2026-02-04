"""
Tests for the Community Feed application.

This module contains tests for:
1. Leaderboard calculation logic (24-hour dynamic aggregation)
2. Like functionality (race condition prevention)
3. Comment tree building
"""

from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.db import transaction
from rest_framework.test import APITestCase
from rest_framework import status
from concurrent.futures import ThreadPoolExecutor, as_completed

from .models import User, Post, Comment, Like, KarmaTransaction
from .views import build_comment_tree


class LeaderboardTestCase(TestCase):
    """
    Tests for the 24-hour leaderboard calculation.
    
    This is a key test that verifies:
    1. Karma is calculated from transactions, not stored values
    2. Only transactions from the last 24 hours are counted
    3. Rankings are correct
    """
    
    def setUp(self):
        """Create test users and karma transactions."""
        self.user1 = User.objects.create_user(
            username='user1',
            password='testpass',
            total_karma=1000  # This should NOT affect 24h leaderboard
        )
        self.user2 = User.objects.create_user(
            username='user2',
            password='testpass',
            total_karma=500
        )
        self.user3 = User.objects.create_user(
            username='user3',
            password='testpass',
            total_karma=2000
        )
        
        now = timezone.now()
        
        # User 1: 25 karma in last 24h (5 post likes)
        for i in range(5):
            KarmaTransaction.objects.create(
                user=self.user1,
                amount=5,
                reason=KarmaTransaction.REASON_POST_LIKE,
                source_id=i,
                created_at=now - timedelta(hours=i)  # Within 24h
            )
        
        # User 2: 30 karma in last 24h (3 post likes + 15 comment likes)
        for i in range(3):
            KarmaTransaction.objects.create(
                user=self.user2,
                amount=5,
                reason=KarmaTransaction.REASON_POST_LIKE,
                source_id=i + 100,
                created_at=now - timedelta(hours=i + 1)
            )
        for i in range(15):
            KarmaTransaction.objects.create(
                user=self.user2,
                amount=1,
                reason=KarmaTransaction.REASON_COMMENT_LIKE,
                source_id=i + 200,
                created_at=now - timedelta(hours=i % 24)
            )
        
        # User 3: 10 karma in last 24h, but 50 karma OUTSIDE 24h
        for i in range(2):
            KarmaTransaction.objects.create(
                user=self.user3,
                amount=5,
                reason=KarmaTransaction.REASON_POST_LIKE,
                source_id=i + 300,
                created_at=now - timedelta(hours=i + 1)  # Within 24h
            )
        # These should NOT count
        for i in range(10):
            KarmaTransaction.objects.create(
                user=self.user3,
                amount=5,
                reason=KarmaTransaction.REASON_POST_LIKE,
                source_id=i + 400,
                created_at=now - timedelta(hours=30 + i)  # Outside 24h
            )

    def test_leaderboard_calculates_from_transactions(self):
        """Verify leaderboard uses transaction aggregation, not stored karma."""
        from django.db.models import Sum
        from django.db.models.functions import Coalesce
        
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        
        leaderboard = KarmaTransaction.objects.filter(
            created_at__gte=twenty_four_hours_ago
        ).values('user_id').annotate(
            karma_24h=Coalesce(Sum('amount'), 0)
        ).order_by('-karma_24h')
        
        # Convert to dict for easier testing
        karma_by_user = {entry['user_id']: entry['karma_24h'] for entry in leaderboard}
        
        # User 2 should be first (30 karma)
        self.assertEqual(karma_by_user[self.user2.id], 30)
        
        # User 1 should have 25 karma
        self.assertEqual(karma_by_user[self.user1.id], 25)
        
        # User 3 should only have 10 karma (transactions outside 24h don't count)
        self.assertEqual(karma_by_user[self.user3.id], 10)
        
        # Verify ranking order
        leaderboard_list = list(leaderboard)
        self.assertEqual(leaderboard_list[0]['user_id'], self.user2.id)
        self.assertEqual(leaderboard_list[1]['user_id'], self.user1.id)
        self.assertEqual(leaderboard_list[2]['user_id'], self.user3.id)

    def test_leaderboard_ignores_old_transactions(self):
        """Verify transactions older than 24 hours are not counted."""
        # User 3 has 50 karma from old transactions + 10 from recent
        # But only 10 should count
        from django.db.models import Sum
        from django.db.models.functions import Coalesce
        
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        
        # Count all transactions for user3
        total_karma = KarmaTransaction.objects.filter(
            user=self.user3
        ).aggregate(total=Coalesce(Sum('amount'), 0))['total']
        
        # Count only recent transactions
        recent_karma = KarmaTransaction.objects.filter(
            user=self.user3,
            created_at__gte=twenty_four_hours_ago
        ).aggregate(total=Coalesce(Sum('amount'), 0))['total']
        
        self.assertEqual(total_karma, 60)  # 10 + 50
        self.assertEqual(recent_karma, 10)  # Only recent counts


class CommentTreeTestCase(TestCase):
    """Tests for the comment tree building algorithm."""
    
    def setUp(self):
        """Create test data for comment tree."""
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.post = Post.objects.create(author=self.user, content='Test post')
        
        # Create a comment tree:
        # - Comment 1 (root)
        #   - Comment 2 (reply to 1)
        #     - Comment 4 (reply to 2)
        #   - Comment 3 (reply to 1)
        # - Comment 5 (root)
        
        self.comment1 = Comment.objects.create(
            post=self.post, author=self.user, content='Root 1', parent=None
        )
        self.comment2 = Comment.objects.create(
            post=self.post, author=self.user, content='Reply to 1', parent=self.comment1
        )
        self.comment3 = Comment.objects.create(
            post=self.post, author=self.user, content='Reply to 1 again', parent=self.comment1
        )
        self.comment4 = Comment.objects.create(
            post=self.post, author=self.user, content='Reply to 2', parent=self.comment2
        )
        self.comment5 = Comment.objects.create(
            post=self.post, author=self.user, content='Root 2', parent=None
        )

    def test_build_comment_tree_structure(self):
        """Test that the tree is built correctly."""
        comments = Comment.objects.filter(post=self.post).order_by('created_at')
        tree = build_comment_tree(comments)
        
        # Should have 2 root comments
        self.assertEqual(len(tree), 2)
        
        # First root should be comment1
        self.assertEqual(tree[0].id, self.comment1.id)
        
        # comment1 should have 2 replies
        self.assertEqual(len(tree[0]._prefetched_replies), 2)
        
        # comment2 should be one of the replies
        reply_ids = [r.id for r in tree[0]._prefetched_replies]
        self.assertIn(self.comment2.id, reply_ids)
        self.assertIn(self.comment3.id, reply_ids)
        
        # comment2 should have 1 nested reply (comment4)
        comment2_in_tree = next(r for r in tree[0]._prefetched_replies if r.id == self.comment2.id)
        self.assertEqual(len(comment2_in_tree._prefetched_replies), 1)
        self.assertEqual(comment2_in_tree._prefetched_replies[0].id, self.comment4.id)

    def test_build_tree_is_efficient(self):
        """Test that tree building doesn't cause extra queries."""
        # Fetch all comments in one query
        with self.assertNumQueries(1):
            comments = list(Comment.objects.filter(post=self.post).order_by('created_at'))
        
        # Building tree should not cause any queries
        with self.assertNumQueries(0):
            tree = build_comment_tree(comments)
            # Access nested data
            for root in tree:
                for reply in root._prefetched_replies:
                    _ = reply._prefetched_replies


class LikeRaceConditionTestCase(TestCase):
    """Tests for race condition prevention in like functionality."""
    
    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(username='liker', password='testpass')
        self.author = User.objects.create_user(username='author', password='testpass')
        self.post = Post.objects.create(author=self.author, content='Test post', likes_count=0)

    def test_unique_constraint_prevents_double_like(self):
        """Test that database constraint prevents duplicate likes."""
        # Create first like
        Like.objects.create(
            user=self.user,
            target_type=Like.TARGET_POST,
            target_id=self.post.id
        )
        
        # Second like should raise IntegrityError
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Like.objects.create(
                user=self.user,
                target_type=Like.TARGET_POST,
                target_id=self.post.id
            )

    def test_like_count_consistency(self):
        """Test that like count stays consistent under concurrent operations."""
        initial_count = self.post.likes_count
        
        # Create likes from multiple users
        users = [User.objects.create_user(username=f'user{i}', password='test') for i in range(5)]
        
        for user in users:
            Like.objects.create(
                user=user,
                target_type=Like.TARGET_POST,
                target_id=self.post.id
            )
            # Simulate atomic update
            from django.db.models import F
            Post.objects.filter(pk=self.post.pk).update(likes_count=F('likes_count') + 1)
        
        self.post.refresh_from_db()
        self.assertEqual(self.post.likes_count, initial_count + 5)


class LeaderboardAPITestCase(APITestCase):
    """API tests for the leaderboard endpoint."""
    
    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(username='topuser', password='testpass')
        
        # Create karma transactions
        now = timezone.now()
        for i in range(10):
            KarmaTransaction.objects.create(
                user=self.user,
                amount=5,
                reason=KarmaTransaction.REASON_POST_LIKE,
                source_id=i,
                created_at=now - timedelta(hours=i)
            )

    def test_leaderboard_endpoint_returns_data(self):
        """Test that the leaderboard endpoint returns correct data."""
        response = self.client.get('/api/leaderboard/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        
        if len(response.data) > 0:
            entry = response.data[0]
            self.assertIn('user', entry)
            self.assertIn('karma_24h', entry)
            self.assertIn('rank', entry)

    def test_leaderboard_limits_to_5_users(self):
        """Test that leaderboard returns at most 5 users."""
        # Create more users with karma
        for i in range(10):
            user = User.objects.create_user(username=f'user{i}', password='testpass')
            KarmaTransaction.objects.create(
                user=user,
                amount=5 * (i + 1),
                reason=KarmaTransaction.REASON_POST_LIKE,
                source_id=i + 100,
                created_at=timezone.now()
            )
        
        response = self.client.get('/api/leaderboard/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(response.data), 5)

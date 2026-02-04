"""
Management command to seed the database with sample data.

Usage: python manage.py seed_data
"""

import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from feed.models import User, Post, Comment, Like, KarmaTransaction


class Command(BaseCommand):
    help = 'Seed the database with sample data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')
        
        # Create users
        users = self._create_users()
        self.stdout.write(f'Created {len(users)} users')
        
        # Create posts
        posts = self._create_posts(users)
        self.stdout.write(f'Created {len(posts)} posts')
        
        # Create comments
        comments = self._create_comments(users, posts)
        self.stdout.write(f'Created {len(comments)} comments')
        
        # Create likes and karma transactions
        self._create_likes_and_karma(users, posts, comments)
        self.stdout.write('Created likes and karma transactions')
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded database!'))

    def _create_users(self):
        """Create sample users."""
        user_data = [
            ('sarah_dev', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah'),
            ('mike_codes', 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike'),
            ('alex_tech', 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex'),
            ('emma_js', 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma'),
            ('david_py', 'https://api.dicebear.com/7.x/avataaars/svg?seed=david'),
            ('lisa_rust', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisa'),
            ('john_go', 'https://api.dicebear.com/7.x/avataaars/svg?seed=john'),
            ('demo_user', 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo'),
        ]
        
        users = []
        for username, avatar in user_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'avatar': avatar,
                    'total_karma': random.randint(100, 2000),
                    'email': f'{username}@example.com'
                }
            )
            users.append(user)
        
        return users

    def _create_posts(self, users):
        """Create sample posts."""
        post_contents = [
            "🚀 Just shipped a major feature that handles 10K concurrent requests without breaking a sweat! The key was implementing proper connection pooling and optimizing our database queries.\n\nThe N+1 query problem is real. Always use select_related for foreign keys and prefetch_related for reverse relations!",
            "💡 Hot take: Most \"performance optimizations\" are premature. Measure first, optimize second. I spent 3 days optimizing a function that was called once per day. Don't be like me.\n\nAlways profile your code before diving into optimization rabbit holes.",
            "🔧 Building a real-time leaderboard? Here's a pattern that scales:\n\n1. Store karma transactions with timestamps\n2. Use database aggregation with date filters\n3. Cache results with short TTL\n4. Handle ties gracefully\n\nNo \"daily_karma\" field needed!",
            "🎯 Today I learned about database locking strategies for handling race conditions. SELECT FOR UPDATE is your friend when dealing with concurrent writes.\n\nRemember: Without proper locking, users can exploit your like buttons!",
            "🌳 Nested comments are tricky to implement efficiently. The key insight: fetch ALL comments in ONE query, then build the tree in your application layer. O(n) complexity, no N+1 queries!",
        ]
        
        posts = []
        for i, content in enumerate(post_contents):
            author = users[i % len(users)]
            created_at = timezone.now() - timedelta(hours=random.randint(1, 48))
            
            post, created = Post.objects.get_or_create(
                content=content,
                defaults={
                    'author': author,
                    'likes_count': random.randint(10, 100),
                    'created_at': created_at
                }
            )
            posts.append(post)
        
        return posts

    def _create_comments(self, users, posts):
        """Create sample nested comments."""
        all_comments = []
        
        for post in posts:
            # Create root comments
            root_comment_texts = [
                "This is a fantastic insight! I've been thinking about this problem for weeks.",
                "Agreed! The approach mentioned here could really solve the N+1 problem we discussed.",
                "Great discussion here. I'd also recommend looking into materialized path.",
            ]
            
            root_comments = []
            for text in root_comment_texts:
                author = random.choice(users)
                comment, _ = Comment.objects.get_or_create(
                    post=post,
                    content=text,
                    parent=None,
                    defaults={
                        'author': author,
                        'likes_count': random.randint(1, 20),
                    }
                )
                root_comments.append(comment)
                all_comments.append(comment)
            
            # Create nested replies
            reply_texts = [
                "Have you tried using select_related and prefetch_related?",
                "Yes! Combined with custom Prefetch objects, you can handle recursive structures.",
                "MPTT is good but can be slow on writes. Closure tables might be better.",
                "Interesting point! I'll have to try that approach.",
            ]
            
            for root_comment in root_comments[:2]:
                for i, text in enumerate(reply_texts[:2]):
                    author = random.choice(users)
                    reply, _ = Comment.objects.get_or_create(
                        post=post,
                        content=text,
                        parent=root_comment,
                        defaults={
                            'author': author,
                            'likes_count': random.randint(1, 10),
                        }
                    )
                    all_comments.append(reply)
                    
                    # Add a nested reply
                    if i == 0:
                        nested_reply, _ = Comment.objects.get_or_create(
                            post=post,
                            content="That's exactly what I was looking for!",
                            parent=reply,
                            defaults={
                                'author': random.choice(users),
                                'likes_count': random.randint(1, 5),
                            }
                        )
                        all_comments.append(nested_reply)
        
        return all_comments

    def _create_likes_and_karma(self, users, posts, comments):
        """Create likes and karma transactions."""
        now = timezone.now()
        
        # Like some posts
        for post in posts:
            likers = random.sample(users, k=min(len(users), random.randint(2, 6)))
            for liker in likers:
                if liker != post.author:
                    like, created = Like.objects.get_or_create(
                        user=liker,
                        target_type=Like.TARGET_POST,
                        target_id=post.id
                    )
                    
                    if created:
                        # Create karma transaction (some within 24h, some outside)
                        hours_ago = random.randint(0, 48)
                        KarmaTransaction.objects.get_or_create(
                            user=post.author,
                            reason=KarmaTransaction.REASON_POST_LIKE,
                            source_id=post.id,
                            liker=liker,
                            defaults={
                                'amount': 5,
                                'created_at': now - timedelta(hours=hours_ago)
                            }
                        )
        
        # Like some comments
        for comment in comments:
            likers = random.sample(users, k=min(len(users), random.randint(1, 4)))
            for liker in likers:
                if liker != comment.author:
                    like, created = Like.objects.get_or_create(
                        user=liker,
                        target_type=Like.TARGET_COMMENT,
                        target_id=comment.id
                    )
                    
                    if created:
                        hours_ago = random.randint(0, 48)
                        KarmaTransaction.objects.get_or_create(
                            user=comment.author,
                            reason=KarmaTransaction.REASON_COMMENT_LIKE,
                            source_id=comment.id,
                            liker=liker,
                            defaults={
                                'amount': 1,
                                'created_at': now - timedelta(hours=hours_ago)
                            }
                        )

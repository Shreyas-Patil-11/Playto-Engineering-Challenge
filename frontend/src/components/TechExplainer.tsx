import { useState } from 'react';
import { cn } from '../utils/cn';

export function TechExplainer() {
  const [activeTab, setActiveTab] = useState<'tree' | 'leaderboard' | 'concurrency'>('tree');

  const tabs = [
    { id: 'tree' as const, label: 'Comment Tree', icon: '🌳' },
    { id: 'leaderboard' as const, label: 'Leaderboard Query', icon: '📊' },
    { id: 'concurrency' as const, label: 'Race Conditions', icon: '🔒' },
  ];

  const content = {
    tree: {
      title: 'Nested Comments - Avoiding N+1',
      description: 'Fetch all comments in ONE query, build tree in memory',
      code: `# Django QuerySet - Single query with prefetch
comments = Comment.objects.filter(post_id=post_id)\\
    .select_related('author')\\
    .order_by('created_at')

# Build tree in Python (O(n) complexity)
def build_tree(comments):
    comment_map = {c.id: c for c in comments}
    root_comments = []
    
    for comment in comments:
        if comment.parent_id is None:
            root_comments.append(comment)
        else:
            parent = comment_map.get(comment.parent_id)
            if parent:
                parent.replies.append(comment)
    
    return root_comments`,
    },
    leaderboard: {
      title: '24h Leaderboard - Dynamic Aggregation',
      description: 'Calculate karma from transactions, not stored values',
      code: `# Django QuerySet with annotation
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

twenty_four_hours_ago = timezone.now() - timedelta(hours=24)

leaderboard = KarmaTransaction.objects\\
    .filter(created_at__gte=twenty_four_hours_ago)\\
    .values('user_id')\\
    .annotate(karma_24h=Coalesce(Sum('amount'), 0))\\
    .order_by('-karma_24h')[:5]

# SQL Generated:
# SELECT user_id, COALESCE(SUM(amount), 0) as karma_24h
# FROM karma_transactions
# WHERE created_at >= NOW() - INTERVAL '24 hours'
# GROUP BY user_id
# ORDER BY karma_24h DESC
# LIMIT 5`,
    },
    concurrency: {
      title: 'Preventing Double-Likes',
      description: 'Database-level locking with SELECT FOR UPDATE',
      code: `from django.db import transaction

@transaction.atomic
def like_post(user_id, post_id):
    # Lock the row to prevent race conditions
    post = Post.objects.select_for_update().get(id=post_id)
    
    # Check if already liked (inside transaction)
    if Like.objects.filter(
        user_id=user_id, 
        target_id=post_id,
        target_type='post'
    ).exists():
        raise ValidationError("Already liked")
    
    # Create like with unique constraint as backup
    Like.objects.create(
        user_id=user_id,
        target_id=post_id,
        target_type='post'
    )
    
    # Update count atomically
    Post.objects.filter(id=post_id).update(
        likes=F('likes') + 1
    )
    
    # Create karma transaction
    KarmaTransaction.objects.create(
        user_id=post.author_id,
        amount=5,
        reason='post_like'
    )`,
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔧</span>
          <h2 className="text-lg font-bold text-white">Technical Implementation</h2>
        </div>
        <p className="text-slate-400 text-sm mt-1">How the backend handles complex queries</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <span className="mr-1">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900">{content[activeTab].title}</h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">{content[activeTab].description}</p>
        
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto">
          <code>{content[activeTab].code}</code>
        </pre>
      </div>
    </div>
  );
}

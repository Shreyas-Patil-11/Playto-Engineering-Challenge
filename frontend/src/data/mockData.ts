import type { User, Post, Comment, Like, KarmaTransaction } from '../types/index';



// Generate random date within last 48 hours
const randomRecentDate = (maxHoursAgo: number = 48): Date => {
  const now = new Date();
  const hoursAgo = Math.random() * maxHoursAgo;
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
};

// Mock Users
export const users: User[] = [
  { id: 'user-1', username: 'sarah_dev', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', totalKarma: 1250 },
  { id: 'user-2', username: 'mike_codes', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike', totalKarma: 890 },
  { id: 'user-3', username: 'alex_tech', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex', totalKarma: 2100 },
  { id: 'user-4', username: 'emma_js', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma', totalKarma: 1567 },
  { id: 'user-5', username: 'david_py', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david', totalKarma: 743 },
  { id: 'user-6', username: 'lisa_rust', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisa', totalKarma: 1890 },
  { id: 'user-7', username: 'john_go', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john', totalKarma: 456 },
  { id: 'user-8', username: 'current_user', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=current', totalKarma: 320 },
];

export const currentUser = users[7];

// Generate nested comments
const generateComments = (postId: string): Comment[] => {
  const comments: Comment[] = [
    {
      id: `comment-${postId}-1`,
      postId,
      parentId: null,
      author: users[1],
      content: 'This is a fantastic insight! I\'ve been thinking about this problem for weeks.',
      likes: 12,
      likedByCurrentUser: false,
      createdAt: randomRecentDate(20),
      replies: []
    },
    {
      id: `comment-${postId}-2`,
      postId,
      parentId: `comment-${postId}-1`,
      author: users[2],
      content: 'Agreed! The approach mentioned here could really solve the N+1 problem we discussed.',
      likes: 8,
      likedByCurrentUser: true,
      createdAt: randomRecentDate(18),
      replies: []
    },
    {
      id: `comment-${postId}-3`,
      postId,
      parentId: `comment-${postId}-2`,
      author: users[3],
      content: 'Have you tried using select_related and prefetch_related? Works wonders for Django.',
      likes: 15,
      likedByCurrentUser: false,
      createdAt: randomRecentDate(15),
      replies: []
    },
    {
      id: `comment-${postId}-4`,
      postId,
      parentId: `comment-${postId}-3`,
      author: users[4],
      content: 'Yes! Combined with custom Prefetch objects, you can even handle recursive structures efficiently.',
      likes: 6,
      likedByCurrentUser: false,
      createdAt: randomRecentDate(12),
      replies: []
    },
    {
      id: `comment-${postId}-5`,
      postId,
      parentId: null,
      author: users[5],
      content: 'Great discussion here. I\'d also recommend looking into materialized path or MPTT for tree structures.',
      likes: 20,
      likedByCurrentUser: false,
      createdAt: randomRecentDate(10),
      replies: []
    },
    {
      id: `comment-${postId}-6`,
      postId,
      parentId: `comment-${postId}-5`,
      author: users[6],
      content: 'MPTT is good but can be slow on writes. Closure tables might be better for high-write scenarios.',
      likes: 9,
      likedByCurrentUser: true,
      createdAt: randomRecentDate(8),
      replies: []
    },
  ];

  return comments;
};

// Build nested comment tree
export const buildCommentTree = (comments: Comment[]): Comment[] => {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  // First pass: create map and initialize replies
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree structure
  comments.forEach(comment => {
    const node = commentMap.get(comment.id)!;
    if (comment.parentId === null) {
      rootComments.push(node);
    } else {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies!.push(node);
      }
    }
  });

  return rootComments;
};

// Mock Posts
export const posts: Post[] = [
  {
    id: 'post-1',
    author: users[0],
    content: '🚀 Just shipped a major feature that handles 10K concurrent requests without breaking a sweat! The key was implementing proper connection pooling and optimizing our database queries. Here\'s what I learned...\n\nThe N+1 query problem is real. Always use select_related for foreign keys and prefetch_related for reverse relations. Your database will thank you!',
    likes: 45,
    likedByCurrentUser: false,
    commentCount: 6,
    createdAt: randomRecentDate(24),
  },
  {
    id: 'post-2',
    author: users[2],
    content: '💡 Hot take: Most "performance optimizations" are premature. Measure first, optimize second. I spent 3 days optimizing a function that was called once per day. Don\'t be like me.\n\nAlways profile your code before diving into optimization rabbit holes.',
    likes: 78,
    likedByCurrentUser: true,
    commentCount: 4,
    createdAt: randomRecentDate(12),
  },
  {
    id: 'post-3',
    author: users[3],
    content: '🔧 Building a real-time leaderboard? Here\'s a pattern that scales:\n\n1. Store karma transactions with timestamps\n2. Use database aggregation with date filters\n3. Cache results with short TTL\n4. Handle ties gracefully\n\nNo "daily_karma" field needed - calculate dynamically from transactions!',
    likes: 92,
    likedByCurrentUser: false,
    commentCount: 8,
    createdAt: randomRecentDate(6),
  },
  {
    id: 'post-4',
    author: users[5],
    content: '🎯 Today I learned about database locking strategies for handling race conditions. SELECT FOR UPDATE is your friend when dealing with concurrent writes.\n\nRemember: Without proper locking, users can exploit your like buttons!',
    likes: 34,
    likedByCurrentUser: false,
    commentCount: 3,
    createdAt: randomRecentDate(3),
  },
];

// Add comments to posts
posts.forEach(post => {
  const flatComments = generateComments(post.id);
  post.comments = buildCommentTree(flatComments);
});

// Generate Karma Transactions for leaderboard
export const karmaTransactions: KarmaTransaction[] = [];

// Generate transactions for each user
users.forEach(user => {
  const numTransactions = Math.floor(Math.random() * 20) + 5;
  for (let i = 0; i < numTransactions; i++) {
    const isPostLike = Math.random() > 0.6;
    karmaTransactions.push({
      id: `karma-${user.id}-${i}`,
      userId: user.id,
      amount: isPostLike ? 5 : 1,
      reason: isPostLike ? 'post_like' : 'comment_like',
      sourceId: `source-${i}`,
      createdAt: randomRecentDate(48), // Some within 24h, some outside
    });
  }
});

// Calculate 24h karma from transactions
export const calculateKarma24h = (userId: string): number => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return karmaTransactions
    .filter(t => t.userId === userId && t.createdAt >= twentyFourHoursAgo)
    .reduce((sum, t) => sum + t.amount, 0);
};

// Store for likes (for preventing double-likes)
export const likes: Like[] = [];

// Check if user has already liked
export const hasUserLiked = (userId: string, targetId: string): boolean => {
  return likes.some(like => like.userId === userId && like.targetId === targetId);
};

import type { Post, Comment, LeaderboardEntry, Like } from '../types';
import {
  posts,
  users,
  currentUser,
  karmaTransactions,
  likes,
  hasUserLiked,
} from '../data/mockData';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory state (simulating database)
let postsState = [...posts];
let likesState = [...likes];
let transactionsState = [...karmaTransactions];

// Mutex for handling concurrent operations (simulating database locks)
const likeMutex = new Map<string, boolean>();

const acquireLock = async (key: string): Promise<boolean> => {
  if (likeMutex.get(key)) {
    return false; // Lock already held
  }
  likeMutex.set(key, true);
  return true;
};

const releaseLock = (key: string): void => {
  likeMutex.delete(key);
};

// GET /api/posts - Fetch all posts with comments (optimized query simulation)
export const fetchPosts = async (): Promise<Post[]> => {
  await delay(300);

  // Simulating efficient query with prefetch_related
  // In Django: Post.objects.prefetch_related(
  //   Prefetch('comments', queryset=Comment.objects.select_related('author'))
  // ).select_related('author').all()

  return postsState.map(post => ({
    ...post,
    likedByCurrentUser: hasUserLiked(currentUser.id, post.id),
  }));
};

// GET /api/posts/:id/comments - Fetch comments tree efficiently
export const fetchComments = async (postId: string): Promise<Comment[]> => {
  await delay(200);

  // Simulating single query that fetches all comments for a post
  // Then building tree in application layer
  // In Django: Comment.objects.filter(post_id=postId)
  //   .select_related('author')
  //   .order_by('created_at')

  const post = postsState.find(p => p.id === postId);
  return post?.comments || [];
};

// POST /api/posts/:id/like - Like a post with race condition handling
export const likePost = async (postId: string): Promise<{ success: boolean; likes: number; karma: number }> => {
  const lockKey = `post-like-${currentUser.id}-${postId}`;

  // Try to acquire lock (simulating SELECT FOR UPDATE)
  const acquired = await acquireLock(lockKey);
  if (!acquired) {
    throw new Error('Operation in progress. Please wait.');
  }

  try {
    await delay(150);

    // Check if already liked (inside transaction)
    const existingLike = likesState.find(
      l => l.userId === currentUser.id && l.targetId === postId && l.targetType === 'post'
    );

    if (existingLike) {
      throw new Error('Already liked this post');
    }

    // Create like
    const newLike: Like = {
      id: `like-${Date.now()}`,
      userId: currentUser.id,
      targetId: postId,
      targetType: 'post',
      createdAt: new Date(),
    };
    likesState.push(newLike);

    // Update post likes count
    const post = postsState.find(p => p.id === postId);
    if (post) {
      post.likes += 1;
      post.likedByCurrentUser = true;

      // Create karma transaction for post author (5 karma)
      transactionsState.push({
        id: `karma-${Date.now()}`,
        userId: post.author.id,
        amount: 5,
        reason: 'post_like',
        sourceId: postId,
        createdAt: new Date(),
      });

      return { success: true, likes: post.likes, karma: 5 };
    }

    throw new Error('Post not found');
  } finally {
    releaseLock(lockKey);
  }
};

// POST /api/posts/:id/unlike - Unlike a post
export const unlikePost = async (postId: string): Promise<{ success: boolean; likes: number }> => {
  const lockKey = `post-like-${currentUser.id}-${postId}`;

  const acquired = await acquireLock(lockKey);
  if (!acquired) {
    throw new Error('Operation in progress. Please wait.');
  }

  try {
    await delay(150);

    const likeIndex = likesState.findIndex(
      l => l.userId === currentUser.id && l.targetId === postId && l.targetType === 'post'
    );

    if (likeIndex === -1) {
      throw new Error('Like not found');
    }

    likesState.splice(likeIndex, 1);

    const post = postsState.find(p => p.id === postId);
    if (post) {
      post.likes = Math.max(0, post.likes - 1);
      post.likedByCurrentUser = false;
      return { success: true, likes: post.likes };
    }

    throw new Error('Post not found');
  } finally {
    releaseLock(lockKey);
  }
};

// POST /api/comments/:id/like - Like a comment
export const likeComment = async (commentId: string, postId: string): Promise<{ success: boolean; likes: number }> => {
  const lockKey = `comment-like-${currentUser.id}-${commentId}`;

  const acquired = await acquireLock(lockKey);
  if (!acquired) {
    throw new Error('Operation in progress. Please wait.');
  }

  try {
    await delay(150);

    const existingLike = likesState.find(
      l => l.userId === currentUser.id && l.targetId === commentId && l.targetType === 'comment'
    );

    if (existingLike) {
      throw new Error('Already liked this comment');
    }

    const newLike: Like = {
      id: `like-${Date.now()}`,
      userId: currentUser.id,
      targetId: commentId,
      targetType: 'comment',
      createdAt: new Date(),
    };
    likesState.push(newLike);

    // Find and update comment
    const updateComment = (comments: Comment[]): Comment | null => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.likes += 1;
          comment.likedByCurrentUser = true;

          // Create karma transaction (1 karma)
          transactionsState.push({
            id: `karma-${Date.now()}`,
            userId: comment.author.id,
            amount: 1,
            reason: 'comment_like',
            sourceId: commentId,
            createdAt: new Date(),
          });

          return comment;
        }
        if (comment.replies) {
          const found = updateComment(comment.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const post = postsState.find(p => p.id === postId);
    if (post?.comments) {
      const comment = updateComment(post.comments);
      if (comment) {
        return { success: true, likes: comment.likes };
      }
    }

    throw new Error('Comment not found');
  } finally {
    releaseLock(lockKey);
  }
};

// POST /api/comments/:id/unlike - Unlike a comment
export const unlikeComment = async (commentId: string, postId: string): Promise<{ success: boolean; likes: number }> => {
  const lockKey = `comment-like-${currentUser.id}-${commentId}`;

  const acquired = await acquireLock(lockKey);
  if (!acquired) {
    throw new Error('Operation in progress. Please wait.');
  }

  try {
    await delay(150);

    const likeIndex = likesState.findIndex(
      l => l.userId === currentUser.id && l.targetId === commentId && l.targetType === 'comment'
    );

    if (likeIndex === -1) {
      throw new Error('Like not found');
    }

    likesState.splice(likeIndex, 1);

    const updateComment = (comments: Comment[]): Comment | null => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.likes = Math.max(0, comment.likes - 1);
          comment.likedByCurrentUser = false;
          return comment;
        }
        if (comment.replies) {
          const found = updateComment(comment.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const post = postsState.find(p => p.id === postId);
    if (post?.comments) {
      const comment = updateComment(post.comments);
      if (comment) {
        return { success: true, likes: comment.likes };
      }
    }

    throw new Error('Comment not found');
  } finally {
    releaseLock(lockKey);
  }
};

// POST /api/comments - Add a new comment
export const addComment = async (
  postId: string,
  content: string,
  parentId: string | null = null
): Promise<Comment> => {
  await delay(200);

  const newComment: Comment = {
    id: `comment-${Date.now()}`,
    postId,
    parentId,
    author: currentUser,
    content,
    likes: 0,
    likedByCurrentUser: false,
    createdAt: new Date(),
    replies: [],
  };

  const post = postsState.find(p => p.id === postId);
  if (!post) throw new Error('Post not found');

  if (!post.comments) post.comments = [];

  if (parentId === null) {
    post.comments.push(newComment);
  } else {
    const addReply = (comments: Comment[]): boolean => {
      for (const comment of comments) {
        if (comment.id === parentId) {
          if (!comment.replies) comment.replies = [];
          comment.replies.push(newComment);
          return true;
        }
        if (comment.replies && addReply(comment.replies)) {
          return true;
        }
      }
      return false;
    };

    if (!addReply(post.comments)) {
      throw new Error('Parent comment not found');
    }
  }

  post.commentCount += 1;

  return newComment;
};

// GET /api/leaderboard - Get top 5 users by 24h karma
export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  await delay(250);

  // Simulating the SQL aggregation query:
  // SELECT user_id, SUM(amount) as karma_24h
  // FROM karma_transactions
  // WHERE created_at >= NOW() - INTERVAL '24 hours'
  // GROUP BY user_id
  // ORDER BY karma_24h DESC
  // LIMIT 5

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Group transactions by user and sum karma
  const karmaByUser = new Map<string, number>();

  transactionsState
    .filter(t => t.createdAt >= twentyFourHoursAgo)
    .forEach(t => {
      const current = karmaByUser.get(t.userId) || 0;
      karmaByUser.set(t.userId, current + t.amount);
    });

  // Convert to array and sort
  const entries: LeaderboardEntry[] = Array.from(karmaByUser.entries())
    .map(([userId, karma]) => ({
      user: users.find(u => u.id === userId)!,
      karma24h: karma,
      rank: 0,
    }))
    .filter(e => e.user && e.karma24h > 0)
    .sort((a, b) => b.karma24h - a.karma24h)
    .slice(0, 5)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return entries;
};

// POST /api/posts - Create a new post
export const createPost = async (content: string): Promise<Post> => {
  await delay(200);

  const newPost: Post = {
    id: `post-${Date.now()}`,
    author: currentUser,
    content,
    likes: 0,
    likedByCurrentUser: false,
    commentCount: 0,
    createdAt: new Date(),
    comments: [],
  };

  postsState.unshift(newPost);

  return newPost;
};

import { useState } from 'react';
import type { Post } from '../types';
import { likePost, unlikePost, addComment, fetchComments } from '../api';
import { CommentThread } from './CommentThread';
import { cn } from '../utils/cn';

interface PostCardProps {
  post: Post;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function PostCard({ post }: PostCardProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [liked, setLiked] = useState(post.likedByCurrentUser);
  const [likes, setLikes] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    try {
      if (liked) {
        const result = await unlikePost(post.id);
        setLikes(result.likes);
        setLiked(false);
      } else {
        const result = await likePost(post.id);
        setLikes(result.likes);
        setLiked(true);
      }
    } catch (error) {
      console.error('Like failed:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const fetchedComments = await fetchComments(post.id);
        setComments(fetchedComments);
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const comment = await addComment(post.id, newComment.trim());
      setComments([...comments, comment]);
      setCommentCount(c => c + 1);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const refreshComments = async () => {
    try {
      const fetchedComments = await fetchComments(post.id);
      setComments(fetchedComments);
    } catch (error) {
      console.error('Failed to refresh comments:', error);
    }
  };

  return (
    <article className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Post Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start gap-4">
          <img
            src={post.author.avatar}
            alt={post.author.username}
            className="w-12 h-12 rounded-full border-2 border-white shadow-md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">
                {post.author.username}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-sm text-gray-500">
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {post.author.totalKarma.toLocaleString()} karma
            </p>
          </div>
        </div>

        {/* Post Content */}
        <div className="mt-4">
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
        </div>
      </div>

      {/* Post Actions */}
      <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50">
        <div className="flex items-center gap-6">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              liked
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-red-500',
              isLiking && 'opacity-50 cursor-not-allowed'
            )}
          >
            <svg
              className={cn(
                'w-5 h-5 transition-transform',
                liked && 'scale-110',
                isLiking && 'animate-pulse'
              )}
              fill={liked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span>{likes}</span>
            <span className="text-xs text-gray-400">(+5 karma)</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={toggleComments}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              showComments
                ? 'bg-indigo-50 text-indigo-600'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-indigo-500'
            )}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>{commentCount}</span>
          </button>

          {/* Share Button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-white text-gray-600 hover:bg-gray-100 hover:text-indigo-500 transition-all duration-200">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-100">
          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="p-4 bg-gray-50">
            <div className="flex gap-3">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=current"
                alt="You"
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
                <button
                  type="submit"
                  disabled={isSubmittingComment || !newComment.trim()}
                  className={cn(
                    'px-6 py-2 font-medium text-white rounded-xl transition-all',
                    isSubmittingComment || !newComment.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  )}
                >
                  {isSubmittingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </form>

          {/* Comments List */}
          <div className="px-4 pb-4">
            {loadingComments ? (
              <div className="py-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 mt-2">Loading comments...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p className="text-3xl mb-2">💬</p>
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              <CommentThread
                comments={comments}
                postId={post.id}
                onUpdate={refreshComments}
              />
            )}
          </div>
        </div>
      )}
    </article>
  );
}

import { useState } from 'react';
import type { Comment } from '../types';
import { likeComment, unlikeComment, addComment } from '../api';
import { cn } from '../utils/cn';

interface CommentThreadProps {
  comments: Comment[];
  postId: string;
  depth?: number;
  onUpdate: () => void;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface SingleCommentProps {
  comment: Comment;
  postId: string;
  depth: number;
  onUpdate: () => void;
}

function SingleComment({ comment, postId, depth, onUpdate }: SingleCommentProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [liked, setLiked] = useState(comment.likedByCurrentUser);
  const [likes, setLikes] = useState(comment.likes);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    try {
      if (liked) {
        const result = await unlikeComment(comment.id, postId);
        setLikes(result.likes);
        setLiked(false);
      } else {
        const result = await likeComment(comment.id, postId);
        setLikes(result.likes);
        setLiked(true);
      }
    } catch (error) {
      console.error('Like failed:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment(postId, replyContent.trim(), comment.id);
      setReplyContent('');
      setShowReplyForm(false);
      onUpdate();
    } catch (error) {
      console.error('Reply failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxDepth = 4;
  const showNested = depth < maxDepth;

  return (
    <div className={cn('group', depth > 0 && 'ml-4 pl-4 border-l-2 border-gray-100 hover:border-indigo-200 transition-colors')}>
      <div className="flex gap-3 py-3">
        <img
          src={comment.author.avatar}
          alt={comment.author.username}
          className="w-8 h-8 rounded-full flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">
              {comment.author.username}
            </span>
            <span className="text-xs text-gray-400">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">
            {comment.content}
          </p>

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleLike}
              disabled={isLiking}
              className={cn(
                'flex items-center gap-1 text-xs font-medium transition-all',
                liked
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-gray-400 hover:text-red-500',
                isLiking && 'opacity-50 cursor-not-allowed'
              )}
            >
              <svg
                className={cn('w-4 h-4 transition-transform', liked && 'scale-110')}
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
              <span className="text-gray-400 text-xs ml-1">(+1 karma)</span>
            </button>

            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-gray-400 hover:text-indigo-500 font-medium transition-colors"
            >
              Reply
            </button>

            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                {collapsed ? `Show ${comment.replies.length} replies` : 'Hide replies'}
              </button>
            )}
          </div>

          {showReplyForm && (
            <form onSubmit={handleReply} className="mt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-white rounded-lg transition-all',
                    isSubmitting || !replyContent.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  )}
                >
                  {isSubmitting ? '...' : 'Reply'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplyForm(false)}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && comment.replies && comment.replies.length > 0 && (
        <div className={cn(!showNested && 'ml-4 pl-4 border-l-2 border-gray-100')}>
          {showNested ? (
            <CommentThread
              comments={comment.replies}
              postId={postId}
              depth={depth + 1}
              onUpdate={onUpdate}
            />
          ) : (
            <div className="py-2">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // In a real app, this would expand or navigate
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Continue thread ({comment.replies.length} more replies) →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CommentThread({ comments, postId, depth = 0, onUpdate }: CommentThreadProps) {
  return (
    <div className="divide-y divide-gray-50">
      {comments.map((comment) => (
        <SingleComment
          key={comment.id}
          comment={comment}
          postId={postId}
          depth={depth}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

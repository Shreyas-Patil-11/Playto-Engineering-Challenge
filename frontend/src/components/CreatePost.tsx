import { useState } from 'react';
import { createPost } from '../api';
import { cn } from '../utils/cn';

interface CreatePostProps {
  onPostCreated: () => void;
}

export function CreatePost({ onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createPost(content.trim());
      setContent('');
      setIsFocused(false);
      onPostCreated();
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-lg border transition-all duration-300',
      isFocused ? 'border-indigo-300 ring-4 ring-indigo-50' : 'border-gray-100'
    )}>
      <form onSubmit={handleSubmit}>
        <div className="p-4">
          <div className="flex gap-4">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=current"
              alt="You"
              className="w-12 h-12 rounded-full border-2 border-white shadow-md"
            />
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => !content && setIsFocused(false)}
                placeholder="What's on your mind? Share your insights..."
                className="w-full min-h-[100px] p-3 text-gray-800 placeholder-gray-400 border-0 resize-none focus:outline-none focus:ring-0"
                rows={isFocused ? 4 : 2}
              />
            </div>
          </div>
        </div>

        {(isFocused || content) && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <button
                type="button"
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Add emoji"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                type="button"
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Add image"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className={cn(
                'text-sm',
                content.length > 500 ? 'text-red-500' : 'text-gray-400'
              )}>
                {content.length}/500
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !content.trim() || content.length > 500}
                className={cn(
                  'px-6 py-2 font-semibold text-white rounded-xl transition-all duration-200',
                  isSubmitting || !content.trim() || content.length > 500
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg'
                )}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Posting...
                  </span>
                ) : (
                  'Post'
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

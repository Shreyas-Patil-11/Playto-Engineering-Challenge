import { useState, useEffect } from 'react';
import type { Post } from './types';
import { fetchPosts } from './api';
import { Header } from './components/Header';
import { CreatePost } from './components/CreatePost';
import { PostCard } from './components/PostCard';
import { Leaderboard } from './components/Leaderboard';
import { TechExplainer } from './components/TechExplainer';

export function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Post */}
            <CreatePost onPostCreated={handleRefresh} />

            {/* Posts */}
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-pulse"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="h-4 bg-gray-200 rounded w-full" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
                <p className="text-5xl mb-4">📝</p>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No posts yet</h3>
                <p className="text-gray-500">Be the first to share something!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {!loading && posts.length > 0 && (
              <div className="text-center">
                <button className="px-8 py-3 bg-white border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
                  Load More Posts
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Leaderboard */}
            <Leaderboard />

            {/* Technical Explainer */}
            <TechExplainer />

            {/* Info Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-xl p-6 text-white">
              <h3 className="font-bold text-lg mb-2">⚡ Karma System</h3>
              <ul className="space-y-2 text-sm text-indigo-100">
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">❤️</span>
                  <span>Post Like = <strong className="text-white">+5 karma</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">💬</span>
                  <span>Comment Like = <strong className="text-white">+1 karma</strong></span>
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs text-indigo-200">
                  Leaderboard shows karma earned in the last 24 hours only, calculated dynamically from transaction history.
                </p>
              </div>
            </div>

            {/* Features Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">✅ Challenge Features</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">
                    <strong className="text-gray-900">Threaded Comments:</strong> Reddit-style nested replies
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">
                    <strong className="text-gray-900">N+1 Prevention:</strong> Single query + in-memory tree building
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">
                    <strong className="text-gray-900">Race Condition Handling:</strong> Mutex locks prevent double-likes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">
                    <strong className="text-gray-900">Dynamic Leaderboard:</strong> Aggregated from karma transactions
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-12 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>Community Feed Prototype • Playto Engineering Challenge</p>
          <p className="mt-1 text-gray-400">
            Built with React, TypeScript, and Tailwind CSS
          </p>
        </div>
      </footer>
    </div>
  );
}

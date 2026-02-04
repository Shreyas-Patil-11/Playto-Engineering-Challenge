import { useState, useEffect } from 'react';
import type { LeaderboardEntry } from '../types';
import { fetchLeaderboard } from '../api';
import { cn } from '../utils/cn';

const getRankStyles = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-200';
    case 2:
      return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
    case 3:
      return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return `#${rank}`;
  }
};

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadLeaderboard = async () => {
    try {
      const data = await fetchLeaderboard();
      setEntries(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();

    // Refresh every 30 seconds
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h2 className="text-lg font-bold text-white">Top Contributors</h2>
          </div>
          <span className="text-xs text-indigo-200 bg-indigo-500/30 px-2 py-1 rounded-full">
            Last 24h
          </span>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">📊</p>
            <p>No karma earned yet today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div
                key={entry.user.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl transition-all duration-300',
                  'hover:scale-[1.02] hover:shadow-md',
                  index === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : 'hover:bg-gray-50'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                    getRankStyles(entry.rank)
                  )}
                >
                  {getRankIcon(entry.rank)}
                </div>

                <img
                  src={entry.user.avatar}
                  alt={entry.user.username}
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {entry.user.username}
                  </p>
                  <p className="text-xs text-gray-500">
                    Total: {entry.user.totalKarma.toLocaleString()} karma
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-indigo-600">
                    +{entry.karma24h}
                  </p>
                  <p className="text-xs text-gray-400">today</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

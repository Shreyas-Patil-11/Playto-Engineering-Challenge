import { currentUser } from '../data/mockData';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Community Feed
              </h1>
              <p className="text-xs text-gray-400">Playto Engineering Challenge</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
              Feed
            </a>
            <a href="#" className="text-gray-400 hover:text-indigo-600 font-medium transition-colors">
              Explore
            </a>
            <a href="#" className="text-gray-400 hover:text-indigo-600 font-medium transition-colors">
              Notifications
            </a>
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-full border border-amber-200">
              <span className="text-lg">⚡</span>
              <span className="font-semibold text-amber-700">{currentUser.totalKarma}</span>
              <span className="text-xs text-amber-600">karma</span>
            </div>
            
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

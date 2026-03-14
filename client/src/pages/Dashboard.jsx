import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import SessionCard from '../components/SessionCard';
import { getToken } from '../utils/auth';
import useSessions from '../hooks/useSessions';

const Dashboard = () => {
  const navigate = useNavigate();
  const { sessions, sortedSessions, loading, error, query, setQuery, sortOption, setSortOption, removeSession } = useSessions();

  useEffect(() => {
    if (!getToken()) {
      navigate('/login');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Your Sessions</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your songwriting drafts</p>
          </div>
          <Link 
            to="/session/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Create New Session
          </Link>
        </div>

        {/* Search + Sort */}
        {!loading && !error && (
          <div className="flex items-center mb-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full max-w-md border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
            />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 ml-4 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
            </select>
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-10">Loading sessions...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-10">{error}</p>
        ) : sessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm mt-8 transition-colors">
            <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">No sessions yet.</h3>
            <p className="text-gray-500 dark:text-gray-400">Start writing your first track by creating a new session.</p>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm mt-8 transition-colors">
            <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">No sessions match your search.</h3>
            <p className="text-gray-500 dark:text-gray-400">Try a different keyword.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedSessions.map((session) => (
              <SessionCard key={session._id} session={session} onDelete={removeSession} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;


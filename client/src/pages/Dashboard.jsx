import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import SessionCard from '../components/SessionCard';
import { getToken } from '../utils/auth';
import useSessions from '../hooks/useSessions';
import Dropdown from '../components/ui/Dropdown';
import { Search, Mic } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { sessions, sortedSessions, loading, error, query, setQuery, sortOption, setSortOption, removeSession } = useSessions();

  useEffect(() => {
    if (!getToken()) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-[calc(100vh-73px)] p-6 md:p-10" style={{ background: 'var(--bg-main)' }}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>Your Sessions</h1>
            <p className="mt-2 text-lg" style={{ color: 'var(--text-muted)' }}>Manage your songwriting drafts and studio takes.</p>
          </div>
          <Link 
            to="/session/new"
            className="text-white px-6 py-3 rounded-lg font-medium transition-all w-full md:w-auto text-center"
            style={{ background: 'var(--accent-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Create New Session
          </Link>
        </div>

        {/* Search + Sort */}
        {!loading && !error && (
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
            <div className="relative w-full sm:w-96">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions..."
                className="w-full rounded-lg pl-10 pr-4 py-3 outline-none transition-all"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-main)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--bg-border)'}
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                <Search size={16} strokeWidth={1.5} />
              </span>
            </div>
            <div className="w-full sm:w-48">
              <Dropdown
                value={sortOption}
                onChange={(val) => setSortOption(val)}
                options={[
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'az', label: 'A–Z' },
                  { value: 'za', label: 'Z–A' }
                ]}
              />
            </div>
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent-primary)' }}></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center rounded-xl mt-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
            <p className="font-medium" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-16 text-center rounded-xl mt-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
            <div className="mb-6 flex justify-center" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
              <Mic size={48} strokeWidth={1} />
            </div>
            <h3 className="font-display text-2xl font-bold mb-3" style={{ color: 'var(--text-main)' }}>No sessions yet</h3>
            <p className="max-w-md mx-auto mb-8 text-lg" style={{ color: 'var(--text-muted)' }}>Start your next track by creating a new session. Upload a beat, set the BPM, and write your draft.</p>
            <Link 
              to="/session/new"
              className="inline-block text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              style={{ background: 'var(--accent-primary)' }}
            >
              Start Writing
            </Link>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="p-16 text-center rounded-xl mt-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
            <h3 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>No matching sessions</h3>
            <p style={{ color: 'var(--text-muted)' }}>Try adjusting your search query.</p>
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


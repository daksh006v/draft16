import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSessions } from '../services/sessionService';
import SessionCard from '../components/SessionCard';
import { getToken } from '../utils/auth';

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) {
      navigate('/login');
      return;
    }

    const fetchSessions = async () => {
      try {
        const data = await getSessions();
        setSessions(data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching sessions');
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Your Sessions</h1>
            <p className="text-gray-600 mt-1">Manage your songwriting drafts</p>
          </div>
          <Link 
            to="/session/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Create New Session
          </Link>
        </div>

        {/* Content Section */}
        {loading ? (
          <p className="text-gray-500 text-center py-10">Loading sessions...</p>
        ) : error ? (
          <p className="text-red-500 text-center py-10">{error}</p>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm mt-8">
            <h3 className="text-xl font-medium text-gray-800 mb-2">No sessions yet.</h3>
            <p className="text-gray-500">Start writing your first track by creating a new session.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <SessionCard key={session._id} session={session} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;

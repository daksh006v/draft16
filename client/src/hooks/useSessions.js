import { useState, useEffect } from 'react';
import { getSessions, deleteSession } from '../services/sessionService';

const useSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await getSessions();
        setSessions(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const removeSession = async (id) => {
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(session => session._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting session');
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(query.toLowerCase())
  );

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortOption === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOption === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOption === 'az') return a.title.localeCompare(b.title);
    if (sortOption === 'za') return b.title.localeCompare(a.title);
    return 0;
  });

  return { sessions, filteredSessions, sortedSessions, loading, error, query, setQuery, sortOption, setSortOption, removeSession };
};

export default useSessions;

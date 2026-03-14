import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createSession } from '../services/sessionService';

const NewSession = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [beatSource, setBeatSource] = useState('youtube');
  const [beatUrl, setBeatUrl] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a session title');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const sessionData = {
        title,
        lyrics: '', // Start empty
        beatSource,
        beatUrl
      };

      const newSession = await createSession(sessionData);
      
      // Redirect straight to the editor for this new session
      navigate(`/sessions/${newSession._id}`);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating session');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-sm border border-gray-100 p-8">
        
        <div className="mb-8">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-800 text-sm font-medium mb-4 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Start New Session</h1>
          <p className="text-gray-500 mt-1">Set up your workspace for a new track.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Song Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midnight Thoughts"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beat Source</label>
            <select 
              value={beatSource}
              onChange={(e) => setBeatSource(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="youtube">YouTube</option>
              <option value="upload">Upload (Coming Soon)</option>
              <option value="external">External Link</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beat URL (Optional)</label>
            <input
              type="url"
              value={beatUrl}
              onChange={(e) => setBeatUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 mt-4 rounded-lg font-medium text-white transition-colors
              ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Creating workspace...' : 'Create Session'}
          </button>
          
        </form>

      </div>
    </div>
  );
};

export default NewSession;

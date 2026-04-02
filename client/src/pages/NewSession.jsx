import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createSession } from '../services/sessionService';
import Dropdown from '../components/ui/Dropdown';

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
        lyrics: '',
        beatSource,
        beatUrl
      };

      const newSession = await createSession(sessionData);
      navigate(`/sessions/${newSession._id}`);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating session');
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-73px)] p-6 md:p-10" style={{ background: 'var(--bg-main)' }}>
      <div className="w-full max-w-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '12px', padding: '40px' }}>
        
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold mb-6 hover:underline transition-colors" style={{ color: 'var(--accent-primary)' }}>
            <span>&larr;</span> Back to Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-4" style={{ color: 'var(--text-main)' }}>Start New Session</h1>
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>Set up your workspace for a new track.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Song Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midnight Thoughts"
              className="w-full p-3 rounded-lg outline-none transition-all"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--bg-border)', color: 'var(--text-main)' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--bg-border)'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Beat Source</label>
            <Dropdown
              value={beatSource}
              onChange={(val) => setBeatSource(val)}
              options={[
                { value: 'youtube', label: 'YouTube' },
                { value: 'upload', label: 'Upload (Coming Soon)' },
                { value: 'external', label: 'External Link' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Beat URL (Optional)</label>
            <input
              type="url"
              value={beatUrl}
              onChange={(e) => setBeatUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="w-full p-3 rounded-lg outline-none transition-all"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--bg-border)', color: 'var(--text-main)' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--bg-border)'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-lg font-medium text-white transition-all text-base"
            style={{ background: loading ? '#818cf8' : 'var(--accent-primary)', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating workspace...' : 'Create Session'}
          </button>
          
        </form>

      </div>
    </div>
  );
};

export default NewSession;


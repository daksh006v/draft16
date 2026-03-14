import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionById, updateSession } from '../services/sessionService';
import BeatPlayer from '../components/BeatPlayer';

const SessionEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [beatSource, setBeatSource] = useState('youtube');
  const [beatUrl, setBeatUrl] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await getSessionById(id);
        setTitle(data.title || '');
        setLyrics(data.lyrics || '');
        setBeatSource(data.beatSource || 'youtube');
        setBeatUrl(data.beatUrl || '');
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Error loading session');
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSession(id, {
        title,
        lyrics,
        beatSource,
        beatUrl
      });
      setSaving(false);
      // Optional: Add a success toast message here
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving session');
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading session...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            &larr; Back to Dashboard
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-medium text-white transition-colors
              ${saving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {saving ? 'Saving...' : 'Save Session'}
          </button>
        </div>

        {/* Editor Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Top Controls (Title & Beat) */}
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name your track..."
                className="w-full text-2xl font-bold p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Beat URL</label>
                <input
                  type="url"
                  value={beatUrl}
                  onChange={(e) => setBeatUrl(e.target.value)}
                  placeholder="Paste YouTube beat link here..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <BeatPlayer beatSource={beatSource} beatUrl={beatUrl} />

          </div>

          {/* Lyrics Editor (Workspace) */}
          <div className="p-6 h-[60vh]">
            <label className="block text-sm font-medium text-gray-700 mb-2 invisible">Lyrics</label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Start writing some bars..."
              className="w-full h-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-lg font-mono leading-relaxed"
            />
          </div>

        </div>
      </div>
    </div>
  );
};

export default SessionEditor;

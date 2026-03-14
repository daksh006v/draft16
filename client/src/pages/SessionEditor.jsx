import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionById, updateSession } from '../services/sessionService';
import { uploadBeat } from '../services/uploadService';
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
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState(false);
  const [error, setError] = useState(null);
  const isFirstLoad = useRef(true);
  const autoSaveTimer = useRef(null);

  const characterCount = lyrics.length;
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

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

  // Auto-save: debounce 3s after user stops typing
  useEffect(() => {
    if (isFirstLoad.current) return;

    setLastSaved(false);
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveSession();
    }, 3000);

    return () => clearTimeout(autoSaveTimer.current);
  }, [lyrics, title, beatSource, beatUrl]);

  const autoSaveSession = async () => {
    try {
      setIsSaving(true);
      await updateSession(id, { title, lyrics, beatSource, beatUrl });
      setIsSaving(false);
      setLastSaved(true);
    } catch {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      clearTimeout(autoSaveTimer.current);
      await updateSession(id, { title, lyrics, beatSource, beatUrl });
      setSaving(false);
      setLastSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving session');
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      const data = await uploadBeat(file);
      setBeatUrl(data.url);
      setBeatSource('upload');
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading session...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  // Mark first load complete after initial data is populated
  if (!loading && isFirstLoad.current) isFirstLoad.current = false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          
          {/* Top Controls (Title & Beat) */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-4 transition-colors">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name your track..."
                className="w-full text-2xl font-bold p-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-all"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beat Source</label>
                <select 
                  value={beatSource}
                  onChange={(e) => setBeatSource(e.target.value)}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="youtube">YouTube</option>
                  <option value="upload">Upload (Coming Soon)</option>
                  <option value="external">External Link</option>
                </select>
              </div>
              <div className="md:col-span-2">
                {beatSource === 'upload' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {isUploading ? 'Uploading...' : 'Upload Beat (MP3/WAV)'}
                    </label>
                    <input
                      type="file"
                      accept=".mp3,.wav"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-800 dark:file:text-blue-400"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beat URL</label>
                    <input
                      type="url"
                      value={beatUrl}
                      onChange={(e) => setBeatUrl(e.target.value)}
                      placeholder="Paste link here..."
                      className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors"
                    />
                  </>
                )}
              </div>
            </div>

            {beatSource === 'youtube' && <BeatPlayer beatSource={beatSource} beatUrl={beatUrl} />}
            {beatSource === 'upload' && beatUrl && (
              <audio controls src={beatUrl} className="w-full h-12 rounded-lg outline-none mt-2" />
            )}

          </div>

          {/* Lyrics Editor (Workspace) */}
          <div className="p-6 h-[60vh] flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lyrics</label>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {isSaving ? '● Saving...' : lastSaved ? '✓ All changes saved' : ''}
              </span>
            </div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Start writing some bars..."
              className="w-full flex-1 p-4 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-lg font-mono leading-relaxed bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors"
            />
            <div className="text-sm text-gray-500 mt-2 flex justify-between">
              <span>Words: {wordCount} | Characters: {characterCount}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SessionEditor;

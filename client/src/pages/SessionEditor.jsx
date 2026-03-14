import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionById, updateSession } from '../services/sessionService';
import { uploadBeat } from '../services/uploadService';
import { getRhymes } from '../services/rhymeService';
import BeatPlayer from '../components/BeatPlayer';
import TextareaAutosize from 'react-textarea-autosize';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableTab = ({ draft, idx, id, activeDraftIndex, setActiveDraftIndex, onRename, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(draft.name);

  const isActive = activeDraftIndex === idx;

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (idx !== 0) {
      setIsEditing(true);
      setEditName(draft.name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      if (editName.trim() && editName.trim() !== draft.name) {
        onRename(idx, editName.trim());
      } else {
        setEditName(draft.name);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(draft.name);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editName.trim() && editName.trim() !== draft.name) {
      onRename(idx, editName.trim());
    } else {
      setEditName(draft.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-grab active:cursor-grabbing border select-none relative shrink-0
        ${isActive 
          ? 'bg-white dark:bg-gray-900 border-t-gray-200 border-l-gray-200 border-r-gray-200 border-b-white dark:border-t-gray-700 dark:border-l-gray-700 dark:border-r-gray-700 dark:border-b-gray-900 rounded-t-lg text-blue-600 dark:text-blue-400 -mb-px z-10' 
          : 'bg-gray-100 dark:bg-gray-800 border-transparent border-b-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-t-lg z-0 mb-0'
        }`}
      onClick={() => setActiveDraftIndex(idx)}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="bg-transparent border-b border-blue-500 outline-none min-w-[60px] max-w-[120px] px-1"
          onPointerDown={(e) => e.stopPropagation()} 
        />
      ) : (
        <span onDoubleClick={handleDoubleClick} title={idx !== 0 ? "Double click to rename" : ""}>
          {draft.name}
        </span>
      )}
      
      {idx !== 0 && (
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(idx);
          }}
          className="text-gray-400 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
        >
          &times;
        </button>
      )}
    </div>
  );
};


const SessionEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState([{ name: 'Main Track', content: '' }]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
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
  const textareaRef = useRef(null);
  const currentDraft = drafts[activeDraftIndex] || { content: '' };
  const lyrics = currentDraft.content;

  const characterCount = lyrics.length;
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

  const [rhymes, setRhymes] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [isFetchingRhymes, setIsFetchingRhymes] = useState(false);
  const [rhymeError, setRhymeError] = useState('');

  // Parse sections dynamically from the lyrics text
  const parsedSections = useMemo(() => {
    const regex = /^\[(.*?)\]/gm;
    const sections = [];
    let match;
    while ((match = regex.exec(lyrics)) !== null) {
      sections.push({
        id: Math.random().toString(36).substring(2, 9),
        type: match[1],
        startIndex: match.index
      });
    }
    return sections;
  }, [lyrics]);

  const [activeSectionId, setActiveSectionId] = useState(null);

  const scrollToSection = (sectionId, startIndex) => {
    setActiveSectionId(sectionId);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(startIndex, startIndex);
      // Rough estimate to scroll the textarea to make the line visible
      const linesBefore = lyrics.substring(0, startIndex).split('\n').length;
      textareaRef.current.scrollTop = (linesBefore - 1) * 28; // approx 28px line height
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await getSessionById(id);
        setTitle(data.title || '');
        
        // Handle migration gracefully if old session uses lyrics string only
        if (data.drafts && data.drafts.length > 0) {
          setDrafts(data.drafts.map(d => ({ ...d, id: d._id || d.id || Math.random().toString(36).substring(2, 9) })));
        } else if (data.lyrics !== undefined) {
          setDrafts([{ id: 'draft-main', name: 'Main Track', content: data.lyrics }]);
        } else {
          setDrafts([{ id: 'draft-main', name: 'Main Track', content: '' }]);
        }

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
  }, [drafts, title, beatSource, beatUrl]);

  const autoSaveSession = async () => {
    try {
      setIsSaving(true);
      await updateSession(id, { title, drafts, beatSource, beatUrl });
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
      await updateSession(id, { title, drafts, beatSource, beatUrl });
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

  const exportLyrics = () => {
    const content = `Title: ${title}\n\nLyrics:\n\n${lyrics}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.trim() ? `${title.trim()}.txt` : 'lyrics.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDrafts((items) => {
      const oldIndex = active.id;
      const newIndex = over.id;
      
      // Keep active tab in sync during reorder
      if (activeDraftIndex === oldIndex) {
        setActiveDraftIndex(newIndex);
      } else if (activeDraftIndex > oldIndex && activeDraftIndex <= newIndex) {
        setActiveDraftIndex(activeDraftIndex - 1);
      } else if (activeDraftIndex < oldIndex && activeDraftIndex >= newIndex) {
        setActiveDraftIndex(activeDraftIndex + 1);
      }
      
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const updateActiveDraftContent = (newContent) => {
    const newDrafts = [...drafts];
    if (newDrafts[activeDraftIndex]) {
        newDrafts[activeDraftIndex].content = newContent;
        setDrafts(newDrafts);
    }
  };

  const insertSection = (type) => {
    let header = `\n\n[${type}]\n`;
    if (!lyrics) {
        header = `[${type}]\n`;
    }
    
    if (textareaRef.current) {
        const startPos = textareaRef.current.selectionStart;
        const endPos = textareaRef.current.selectionEnd;
        const newLyrics = lyrics.substring(0, startPos) + header + lyrics.substring(endPos);
        updateActiveDraftContent(newLyrics);
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = startPos + header.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    } else {
        updateActiveDraftContent(lyrics ? lyrics + header : header);
    }
  };

  const handleFindRhymes = async () => {
    if (!textareaRef.current) return;
    setRhymeError('');
    
    const startPos = textareaRef.current.selectionStart;
    const endPos = textareaRef.current.selectionEnd;
    
    if (startPos === endPos) {
      setRhymeError('Select a word to find rhymes.');
      setRhymes([]);
      setCurrentWord('');
      return;
    }

    const selectedWord = lyrics.substring(startPos, endPos).trim();
    
    if (!selectedWord || selectedWord.includes(' ')) {
        setRhymeError('Please select a single word.');
        setRhymes([]);
        setCurrentWord('');
        return;
    }

    setIsFetchingRhymes(true);
    setCurrentWord(selectedWord);
    
    try {
      const fetchedRhymes = await getRhymes(selectedWord.toLowerCase());
      setRhymes(fetchedRhymes);
      if (fetchedRhymes.length === 0) {
          setRhymeError(`No rhymes found for "${selectedWord}".`);
      }
    } catch (e) {
      setRhymeError('Error fetching rhymes.');
      setRhymes([]);
    } finally {
      setIsFetchingRhymes(false);
    }
  };

  const handleRhymeClick = (rhymeWord) => {
    if (!textareaRef.current) return;
    
    const startPos = textareaRef.current.selectionStart;
    const endPos = textareaRef.current.selectionEnd;
    
    // Only proceed if there is an active text selection matching the searched word
    if (startPos !== endPos) {
      const textBeforeSelection = lyrics.substring(0, startPos);
      const textAfterSelection = lyrics.substring(endPos);
      
      const newLyrics = textBeforeSelection + rhymeWord + textAfterSelection;
      updateActiveDraftContent(newLyrics);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = startPos + rhymeWord.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading session...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  // Mark first load complete after initial data is populated
  if (!loading && isFirstLoad.current) isFirstLoad.current = false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium"
          >
            &larr; Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={exportLyrics}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors"
            >
              Export Lyrics
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
          <div className="p-6 flex flex-col md:grid md:grid-cols-[220px_1fr] gap-6">
            
            {/* Section Navigator (Left Column on Desktop, Top on Mobile) */}
            <div className="md:border-r border-gray-100 dark:border-gray-700 md:pr-4 flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Navigator</label>
              <div className="overflow-y-auto space-y-1 mb-4">
                {parsedSections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id, section.startIndex)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSectionId === section.id 
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {section.type}
                  </button>
                ))}
                {parsedSections.length === 0 && (
                  <div className="text-gray-400 text-sm italic px-2">No sections added yet.</div>
                )}
              </div>
              <div className="text-sm text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="mb-4">
                  <button 
                    onClick={handleFindRhymes}
                    className="w-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium py-2 rounded border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    Find Rhymes
                  </button>
                  
                  {rhymeError && (
                    <div className="text-xs text-red-500 mt-2">{rhymeError}</div>
                  )}
                </div>
                
                {currentWord && !rhymeError && (
                  <div className="mt-3 mb-4 space-y-2">
                    <div className="text-xs text-gray-400">Rhymes for: <span className="font-semibold text-gray-600 dark:text-gray-300">{currentWord}</span></div>
                    {isFetchingRhymes ? (
                      <div className="text-xs text-gray-400">Loading...</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {rhymes.map(r => (
                          <button
                            key={r}
                            onMouseDown={(e) => {
                              // Prevent input blur so selectionStart/selectionEnd don't reset
                              e.preventDefault(); 
                            }}
                            onClick={() => handleRhymeClick(r)}
                            className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs text-gray-800 dark:text-gray-200"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4">Words: {wordCount}</div>
                <div>Characters: {characterCount}</div>
              </div>
            </div>

            {/* Existing Sections Workspace (Right Column) */}
            <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              
              {/* Tabs UI */}
              <div className="flex items-end overflow-x-auto whitespace-nowrap pt-2 px-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 min-h-[46px]">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={drafts.map((draft, index) => index)} strategy={horizontalListSortingStrategy}>
                    {drafts.map((draft, idx) => (
                      <SortableTab 
                        key={idx}
                        id={idx}
                        draft={draft}
                        idx={idx}
                        activeDraftIndex={activeDraftIndex}
                        setActiveDraftIndex={setActiveDraftIndex}
                        onRename={(index, newName) => {
                          const newDrafts = [...drafts];
                          newDrafts[index].name = newName;
                          setDrafts(newDrafts);
                        }}
                        onDelete={(index) => {
                          if(confirm(`Are you sure you want to delete '${drafts[index].name}'?`)) {
                             const newDrafts = drafts.filter((_, idxToRemove) => index !== idxToRemove);
                             setDrafts(newDrafts);
                             if (activeDraftIndex === index) {
                               setActiveDraftIndex(Math.max(0, index - 1));
                             } else if (activeDraftIndex > index) {
                               setActiveDraftIndex(activeDraftIndex - 1);
                             }
                          }
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <button 
                  onClick={() => {
                    const newDraftName = `Draft ${drafts.length + 1}`;
                    setDrafts([...drafts, { id: Math.random().toString(36).substring(2, 9), name: newDraftName, content: '' }]);
                    setActiveDraftIndex(drafts.length);
                  }}
                  className="shrink-0 px-3 py-2 mb-px ml-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  + Draft
                </button>
              </div>

              <div className="p-4 flex flex-col flex-1 h-full">
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Editor</label>
                  <div className="flex items-center gap-4">
                    <select 
                      className="bg-gray-100 dark:bg-gray-800 text-sm p-2 rounded outline-none text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
                      onChange={(e) => {
                        if (e.target.value) {
                          insertSection(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>+ Add Section</option>
                      <option value="Hook">Hook</option>
                      <option value="Verse">Verse</option>
                      <option value="Bridge">Bridge</option>
                      <option value="Intro">Intro</option>
                      <option value="Outro">Outro</option>
                    </select>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {isSaving ? '● Saving...' : lastSaved ? '✓ All changes saved' : ''}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1">
                  <TextareaAutosize
                    ref={textareaRef}
                    value={lyrics}
                    onChange={(e) => updateActiveDraftContent(e.target.value)}
                    placeholder="Start writing some bars... Use [Hook] or [Verse] to create sections."
                    minRows={15}
                    className="w-full h-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-base font-mono leading-relaxed bg-gray-50 dark:bg-gray-900/40 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
              </div>
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
};

export default SessionEditor;

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSessionById, updateSession } from '../services/sessionService';
import { uploadAudio } from '../services/uploadService';
import { getRhymes } from '../services/rhymeService';
import BeatPlayer from '../components/BeatPlayer';
import YouTubePlayer from '../components/YouTubePlayer';
import Dropdown from '../components/ui/Dropdown';
import BpmInput from '../components/ui/BpmInput';
import { startMetronome } from '../utils/metronome';
import { getUserFromToken } from '../utils/auth';
import CodeMirror from '@uiw/react-codemirror';
import { ViewPlugin, Decoration, EditorView, WidgetType, placeholder } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syllable } from 'syllable';
import { rhymeSchemePlugin } from '../editor/plugins/rhymeSchemePlugin';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mic2 } from 'lucide-react';

// CodeMirror Extension for highlighting [Section Headers]
export const getSectionHeaderPlugin = (activeType) => ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder();
      for (let { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        // simple regex to match lines perfectly containing [SOMETHING]
        const regex = /^\[(.*?)\]$/gm;
        let match;
        while ((match = regex.exec(text))) {
          const start = from + match.index;
          const end = start + match[0].length;
          const type = match[1];
          const isActive = activeType && type.toLowerCase() === activeType.toLowerCase();
          
          builder.add(
            start,
            end,
            Decoration.mark({ class: isActive ? 'cm-section-header cm-active-section' : 'cm-section-header' })
          );
        }
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

class SyllableCountWidget extends WidgetType {
  constructor(count) {
    super();
    this.count = count;
  }
  eq(other) {
    return other.count === this.count;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-syllable-count text-xs text-gray-400 select-none opacity-80 ml-3";
    wrap.textContent = "•" + this.count;
    return wrap;
  }
}

const syllableColors = ['cm-syl-0', 'cm-syl-1', 'cm-syl-2', 'cm-syl-3', 'cm-syl-4'];

export const syllablePlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder();
      let colorIndex = 0;
      
      for (let { from, to } of view.visibleRanges) {
        const doc = view.state.doc;
        const startLine = doc.lineAt(from);
        const endLine = doc.lineAt(to);
        
        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = doc.line(i);
          const lineText = line.text;
          
          if (!lineText.trim()) continue;
          
          if (lineText.match(/^\s*\[.*?\]\s*$/)) {
             continue; // ignore section headers
          }
          
          const wordRegex = /\b[a-zA-Z']+\b/g;
          let match;
          
          while ((match = wordRegex.exec(lineText)) !== null) {
            const word = match[0];
            const wordAbsStart = line.from + match.index;
            const wordAbsEnd = wordAbsStart + word.length;
            
            if (wordAbsStart >= from && wordAbsEnd <= to) {
               const count = syllable(word) || 1;
               if (count <= 1) {
                 const c = syllableColors[colorIndex % syllableColors.length];
                 colorIndex++;
                 builder.add(wordAbsStart, wordAbsEnd, Decoration.mark({ class: c }));
               } else {
                 const charsPerSyllable = Math.max(1, Math.floor(word.length / count));
                 let sStart = 0;
                 for (let j = 0; j < count; j++) {
                   const isLast = j === count - 1;
                   const sEnd = isLast ? word.length : sStart + charsPerSyllable;
                   if (sStart < sEnd) {
                     const chunkStart = wordAbsStart + sStart;
                     const chunkEnd = wordAbsStart + sEnd;
                     const c = syllableColors[colorIndex % syllableColors.length];
                     colorIndex++;
                     builder.add(chunkStart, chunkEnd, Decoration.mark({ class: c }));
                   }
                   sStart = sEnd;
                 }
               }
            }
          }
          
          if (line.to <= to) {
            const lineCount = syllable(lineText) || 0;
            if (lineCount > 0) {
              builder.add(line.to, line.to, Decoration.widget({
                widget: new SyllableCountWidget(lineCount),
                side: 1
              }));
            }
          }
        }
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// CodeMirror Extension for highlighting Rhymes
const rhymeClasses = ['cm-rhyme-0', 'cm-rhyme-1', 'cm-rhyme-2', 'cm-rhyme-3'];

export const rhymePlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder();
      
      for (let { from, to } of view.visibleRanges) {
        const doc = view.state.doc;
        const text = doc.sliceString(from, to);
        const lines = text.split('\n');
        
        let words = [];
        let currentOffset = from;
        
        // Pass 1: Collect words and their frequencies in the visible range
        const rhymeCounts = {};
        
        for (let lineText of lines) {
          if (!lineText.trim() || lineText.match(/^\s*\[.*?\]\s*$/)) {
            currentOffset += lineText.length + 1; // +1 for the newline
            continue;
          }
          
          const wordRegex = /\b[a-zA-Z][a-zA-Z']*\b/g;
          let match;
          
          while ((match = wordRegex.exec(lineText)) !== null) {
            const word = match[0];
            const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
            
            if (cleanWord.length === 0) continue;
            
            let rhymeKey = cleanWord;
            if (cleanWord.length >= 4) {
              rhymeKey = cleanWord.slice(-3);
            } else if (cleanWord.length >= 2) {
              rhymeKey = cleanWord.slice(-2);
            }
            
            if (rhymeCounts[rhymeKey]) {
              rhymeCounts[rhymeKey]++;
            } else {
              rhymeCounts[rhymeKey] = 1;
            }
            
            words.push({
              key: rhymeKey,
              start: currentOffset + match.index,
              end: currentOffset + match.index + word.length
            });
          }
          currentOffset += lineText.length + 1;
        }
        
        // Assign colors only to groups with count >= 2
        const rhymeGroups = {};
        let groupCounter = 0;
        
        for (const [key, count] of Object.entries(rhymeCounts)) {
          if (count >= 2) {
            rhymeGroups[key] = groupCounter;
            groupCounter++;
          }
        }
        
        // Pass 2: Add decorations
        // Sort words by start index to build RangeSet in order
        words.sort((a, b) => a.start - b.start);
        
        for (const word of words) {
          if (rhymeGroups[word.key] !== undefined) {
             const classIndex = rhymeGroups[word.key] % rhymeClasses.length;
             const cssClass = rhymeClasses[classIndex];
             builder.add(word.start, word.end, Decoration.mark({ class: cssClass }));
          }
        }
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const TakeCard = ({ take, index, editingTakeId, editingTakeName, setEditingTakeName, handleRenameTakeSubmit, setEditingTakeId, handlePlayTakeSync, onDelete }) => {
  const takeIdentifier = take._id || take.id;
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };

    const updateDuration = () => {
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Initial check if already loaded
    if (audio.readyState > 0) {
      updateDuration();
    }

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current.paused) {
      handlePlayTakeSync(takeIdentifier);
    } else {
      audioRef.current.pause();
    }
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === Infinity || time == null) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="group" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px', 
      padding: '20px 24px', 
      borderRadius: '12px', 
      background: isPlaying ? 'var(--take-bg-playing)' : 'var(--take-bg)', 
      border: '1px solid var(--take-border)', 
      borderLeft: isPlaying ? '4px solid var(--accent-primary)' : '1px solid var(--take-border)',
      marginBottom: '10px',
      position: 'relative',
      transition: 'all 0.2s ease',
      transform: 'translateY(0)',
      boxShadow: 'none'
    }}
    onMouseEnter={(e) => {
      if (!isPlaying) e.currentTarget.style.background = 'var(--take-bg-hover)';
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
    }}
    onMouseLeave={(e) => {
      if (!isPlaying) e.currentTarget.style.background = 'var(--take-bg)';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      
      {/* Hidden Audio for playback engine */}
      <audio ref={audioRef} data-take-id={takeIdentifier} src={take.url} className="hidden" preload="metadata" />

      {/* Play Button */}
      <button
        onClick={togglePlay}
        className="shrink-0 flex items-center justify-center transition-all"
        style={{ 
          width: '38px', height: '38px', borderRadius: '50%', 
          background: isPlaying ? 'var(--accent-primary)' : 'var(--take-btn-bg)', 
          color: isPlaying ? '#ffffff' : 'var(--take-text)',
          transform: 'scale(1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          if (!isPlaying) e.currentTarget.style.background = 'var(--take-btn-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          if (!isPlaying) e.currentTarget.style.background = 'var(--take-btn-bg)';
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px' }}><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        )}
      </button>
      
      {/* Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden" style={{ gap: '8px' }}>
        
        {/* ROW 1: Title & Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editingTakeId === takeIdentifier ? (
              <input
                autoFocus
                type="text"
                value={editingTakeName}
                onChange={(e) => setEditingTakeName(e.target.value)}
                onBlur={() => handleRenameTakeSubmit(takeIdentifier)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameTakeSubmit(takeIdentifier);
                  if (e.key === 'Escape') setEditingTakeId(null);
                }}
                className="font-medium bg-transparent outline-none w-full max-w-[200px]"
                style={{ fontSize: '14px', color: 'var(--take-text)', borderBottom: '1px solid var(--take-time)' }}
              />
            ) : (
              <span 
                className="truncate cursor-text transition-colors duration-200"
                style={{ fontWeight: 500, fontSize: '14px', color: 'var(--take-text)' }}
                onClick={() => {
                  setEditingTakeId(takeIdentifier);
                  setEditingTakeName(take.name || `Take ${index + 1}`);
                }}
                title="Click to rename"
              >
                {take.name || `Take ${index + 1}`}
              </span>
            )}

            {take.isUploading && (
               <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest animate-pulse ml-2">Uploading...</span>
            )}
            {take.error && (
               <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-2">Failed</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Time Display */}
            <span style={{ fontSize: '12px', color: 'var(--take-time)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Controls (Delete) */}
            <button
              onClick={() => onDelete(takeIdentifier)}
              className="w-7 h-7 flex justify-center items-center transition-all"
              style={{ color: '#ef4444', opacity: 0.7, background: 'transparent', borderRadius: '6px' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = 1;
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = 0.7;
                e.currentTarget.style.background = 'transparent';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              }}
              title="Delete take"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        {/* ROW 2: Timeline */}
        <div 
          className="w-full rounded-full cursor-pointer relative" 
          style={{ height: '5px', background: 'var(--take-progress-bg)' }} 
          onClick={(e) => {
            if (!audioRef.current || !audioRef.current.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = percent * audioRef.current.duration;
          }}
          onMouseEnter={(e) => {
             const track = e.currentTarget.querySelector('.track-fill');
             if(track) track.style.filter = 'brightness(1.1)';
             const thumb = e.currentTarget.querySelector('.thumb');
             if(thumb) thumb.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
             const track = e.currentTarget.querySelector('.track-fill');
             if(track) track.style.filter = 'brightness(1)';
             const thumb = e.currentTarget.querySelector('.thumb');
             if(thumb) thumb.style.opacity = '0';
          }}
        >
          <div className="h-full rounded-full transition-all duration-100 ease-linear track-fill flex justify-end items-center" style={{ width: `${progress}%`, background: 'var(--accent-primary)' }}>
            <div className="thumb transition-opacity duration-200" style={{ width: '9px', height: '9px', background: 'var(--accent-primary)', borderRadius: '50%', transform: 'translateX(4px)', opacity: 0 }}></div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

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
      style={{
        ...style,
        // Active tab: visually connected to editor
        background: isActive ? 'var(--editor-bg-solid)' : 'transparent',
        border: isActive ? '1px solid var(--editor-border)' : '1px solid transparent',
        borderBottom: isActive ? 'none' : '1px solid transparent',
        borderRadius: isActive ? '10px 10px 0 0' : '6px',
        boxShadow: isActive ? 'var(--tab-active-shadow)' : 'none',
        color: isActive ? 'var(--tab-active)' : 'var(--tab-inactive)',
        opacity: 1,
        fontWeight: isActive ? 600 : 400,
        position: 'relative',
        zIndex: isActive ? 2 : 1,
        marginBottom: '0',
        transition: 'all 0.2s ease',
      }}
      {...attributes}
      {...listeners}
      onClick={() => setActiveDraftIndex(idx)}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--tab-hover)';
          e.currentTarget.style.background = 'var(--tab-hover-bg)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--tab-inactive)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
      className="group flex items-center gap-2 px-4 py-2.5 text-sm select-none shrink-0 cursor-grab active:cursor-grabbing"
    >
      {isEditing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="bg-transparent outline-none min-w-[60px] max-w-[120px] px-1"
          style={{ borderBottom: '1px solid var(--accent-primary)', color: 'var(--text-main)' }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span title={idx !== 0 ? 'Double click to rename' : ''}>
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
          className="h-4 w-4 flex items-center justify-center rounded-full ml-0.5 opacity-0 group-hover:opacity-100 transition-all focus:outline-none"
          style={{ color: '#9ca3af' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
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

  const userPayload = useMemo(() => getUserFromToken(), []);
  const isGuest = userPayload?.isGuest || false;

  // dnd-kit sensor with distance constraint:
  // pointer must move >=8px before drag activates, so plain taps/clicks bubble normally.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );
  
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState([{ name: 'Main Track', content: '' }]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [beatSource, setBeatSource] = useState('youtube');
  const [beatUrl, setBeatUrl] = useState('');
  const [bpm, setBpm] = useState(120);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isRecordedTakesOpen, setIsRecordedTakesOpen] = useState(true);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [takes, setTakes] = useState([]);
  const [editingTakeId, setEditingTakeId] = useState(null);
  const [editingTakeName, setEditingTakeName] = useState('');
  
  const [markers, setMarkers] = useState([]);
  const [newMarkerTime, setNewMarkerTime] = useState('');
  const [newMarkerLabel, setNewMarkerLabel] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [textAlign, setTextAlign] = useState('left');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState(false);
  const [error, setError] = useState(null);
  
  const isFirstLoad = useRef(true);
  const autoSaveTimer = useRef(null);
  const textareaRef = useRef(null);
  const beatPlayerRef = useRef(null);
  const editorRef = useRef(null);
  const metronomeRef = useRef(null);
  const clickAudioRef = useRef(typeof Audio !== 'undefined' ? new Audio('/metronome-click.wav') : null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const beatAudioSourceRef = useRef(null); // cached MediaElementSource for uploaded beat
  const [recordingMode, setRecordingMode] = useState(null); // null | 'mic+beat' | 'mic-only'
  
  const currentDraft = drafts[activeDraftIndex] || { content: '' };
  const lyrics = currentDraft.content;

  const characterCount = lyrics.length;
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

  const [rhymes, setRhymes] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [isFetchingRhymes, setIsFetchingRhymes] = useState(false);
  const [rhymeError, setRhymeError] = useState('');
  const [showSyllables, setShowSyllables] = useState(false);
  const [showRhymes, setShowRhymes] = useState(false);
  const [showRhymeScheme, setShowRhymeScheme] = useState(false);

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
  const [activeSectionType, setActiveSectionType] = useState(null);

  const normalize = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Extract section positions directly from CodeMirror's document — guarantees
  // startIndex values are real CM6 positions and not regex indices on raw text.
  const extractSections = (view) => {
    const sections = [];
    if (!view) return sections;
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const match = line.text.match(/^\[(.*?)\]/);
      if (match) {
        sections.push({ type: match[1], startIndex: line.from });
      }
    }
    return sections;
  };

  const navigateToSection = (label, time) => {
    // 1. Seek beat if time is provided
    if (time !== undefined && time !== null) {
      handleSeekPlayer(time);
    }

    if (!label) return;

    // 2. Compute real CM6 positions from the live document
    const sections = extractSections(editorRef.current);
    console.log("sections from CM doc:", sections);

    const section = sections.find(s => normalize(s.type) === normalize(label));
    console.log("matched section:", section);

    if (!section) return;

    if (!editorRef.current) {
      console.warn("editorRef not set");
      return;
    }

    // 3. Move selection to that position — CM6 will then scroll it into view
    editorRef.current.dispatch({
      selection: { anchor: section.startIndex },
      effects: EditorView.scrollIntoView(section.startIndex, { y: "center", yMargin: 40 })
    });

    setActiveSectionType(section.type);
    setTimeout(() => setActiveSectionType(null), 1500);
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
        setBpm(data.bpm || 120);
        setTakes(data.takes || []);
        setMarkers(data.markers || []);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Error loading session');
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  const playClick = () => {
    if (clickAudioRef.current) {
      clickAudioRef.current.currentTime = 0;
      clickAudioRef.current.play().catch(e => console.warn("Audio play failed", e));
    }
  };

  useEffect(() => {
    if (metronomeOn) {
      if (metronomeRef.current) clearInterval(metronomeRef.current);
      metronomeRef.current = startMetronome(bpm, playClick);
    } else {
      if (metronomeRef.current) {
        clearInterval(metronomeRef.current);
        metronomeRef.current = null;
      }
    }
    return () => {
      if (metronomeRef.current) {
        clearInterval(metronomeRef.current);
      }
    };
  }, [metronomeOn, bpm]);

  // Auto-save: debounce 3s after user stops typing
  useEffect(() => {
    if (isFirstLoad.current) return;

    setLastSaved(false);
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveSession();
    }, 3000);

    return () => clearTimeout(autoSaveTimer.current);
  }, [drafts, title, beatSource, beatUrl, markers, bpm]);

  const autoSaveSession = async () => {
    try {
      setIsSaving(true);
      await updateSession(id, { title, drafts, beatSource, beatUrl, markers, bpm });
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
      await updateSession(id, { title, drafts, beatSource, beatUrl, markers, bpm, takes });
      setSaving(false);
      setLastSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving session');
      setSaving(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Revoke previous object URL to free memory
    if (beatUrl && beatSource === 'upload' && beatUrl.startsWith('blob:')) {
      URL.revokeObjectURL(beatUrl);
    }

    const localUrl = URL.createObjectURL(file);
    setBeatUrl(localUrl);
    setBeatSource('upload');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Build Web Audio pipeline
      const audioContext = new window.AudioContext();
      const micSource = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 2.5; // boost mic volume
      const destination = audioContext.createMediaStreamDestination();
      
      // Mic pipeline: mic → gain → destination
      micSource.connect(gainNode);
      gainNode.connect(destination);

      // --- Beat mixing (uploaded audio only, not YouTube) ---
      let mixed = false;
      if (
        beatSource === 'upload' &&
        beatPlayerRef.current instanceof HTMLAudioElement
      ) {
        try {
          // createMediaElementSource can only be called ONCE per element — cache it
          if (!beatAudioSourceRef.current) {
            beatAudioSourceRef.current = audioContext.createMediaElementSource(beatPlayerRef.current);
            // Also reconnect beat audio to speakers so user still hears it
            beatAudioSourceRef.current.connect(audioContext.destination);
          }
          beatAudioSourceRef.current.connect(destination);
          mixed = true;
          console.log("🎛️ Beat mixed into recording");
        } catch (err) {
          console.warn("Beat capture not supported, fallback to mic only:", err);
        }
      }

      setRecordingMode(mixed ? 'mic+beat' : 'mic-only');
      console.log("Using processed stream:", destination.stream);

      const mediaRecorder = new MediaRecorder(destination.stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        console.log("Recorded Blob Size:", fullBlob.size);
        console.log("Recorded Blob Type:", fullBlob.type);

        // Temporarily put local URL while uploading
        const localUrl = URL.createObjectURL(fullBlob);
        const tempId = Date.now().toString();
        const defaultName = `Take ${takes.length + 1}`;
        
        // Add a temporary take to the UI with an uploading state
        setTakes((prev) => [...(Array.isArray(prev) ? prev : []), { _id: tempId, url: localUrl, name: defaultName, isUploading: true }]);
        setIsRecordedTakesOpen(true);
        
        // Stop mic tracks so the browser recording indicator disappears
        stream.getTracks().forEach((track) => track.stop());
        destination.stream.getTracks().forEach((track) => track.stop());
        if (audioContext.state !== 'closed') {
          audioContext.close();
          // Clear the cached source so next recording creates a fresh one
          beatAudioSourceRef.current = null;
        }

        // Upload to Cloudinary
        try {
          const file = new File([fullBlob], `${defaultName.replace(/\s+/g, '_')}.webm`, { type: 'audio/webm' });
          
          console.log("FILE:", file);
          console.log("TYPE:", file.type);
          console.log("SIZE:", file.size);
          
          const uploadedData = await uploadAudio(file);
          console.log("UPLOAD SUCCESS:", uploadedData);
          
          // The final take to save — no _id so MongoDB generates a valid ObjectId
          const finalTake = { url: uploadedData.url, name: defaultName };

          // Ensure we update takes properly without trusting the closure's stale 'takes'
          setTakes((currentTakes) => {
            const safeTakes = Array.isArray(currentTakes) ? currentTakes : [];
            const previousTakes = safeTakes.filter(t => t._id !== tempId);
            const newTakes = [...previousTakes, finalTake];
            
            // 2. Persist to backend
            updateSession(id, { takes: newTakes })
              .then(res => {
                if (res?.takes && Array.isArray(res.takes)) {
                  setTakes(res.takes); // Sync with DB-generated ObjectIDs
                } else {
                  console.warn("Invalid takes response from DB, keeping local takes");
                }
              })
              .catch(err => {
                console.error("SAVE ERROR:", err);
              });
              
            return newTakes;
          });
        } catch (err) {
          console.error("UPLOAD ERROR:", err.response?.data || err);
          setTakes((prev) => prev.map(t => 
             t._id === tempId ? { ...t, isUploading: false, error: true } : t
          ));
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-play beat when recording starts
      if (beatPlayerRef.current) {
        if (typeof beatPlayerRef.current.play === 'function') {
          beatPlayerRef.current.play();
        } else if (typeof beatPlayerRef.current.seekTo === 'function') {
          const currentTime = typeof beatPlayerRef.current.getCurrentTime === 'function' ? beatPlayerRef.current.getCurrentTime() : 0;
          beatPlayerRef.current.seekTo(currentTime);
        }
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError('Microphone access was denied. Please allow mic access in your browser settings and try again.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (!navigator.mediaDevices || !window.isSecureContext) {
        setError('Recording requires a secure connection (HTTPS). Please access the app over HTTPS.');
      } else {
        setError('Could not start recording. Please check your microphone and try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingMode(null);
  };

  const handleRenameTakeSubmit = (id) => {
    if (editingTakeName.trim()) {
      setTakes(prev => prev.map(t => t._id === id || t.id === id ? { ...t, name: editingTakeName.trim() } : t));
    }
    setEditingTakeId(null);
  };
  
  const handlePlayTakeSync = (takeId) => {
    // 1. Play the beat player
    if (beatPlayerRef.current) {
      if (typeof beatPlayerRef.current.seekTo === 'function') {
        beatPlayerRef.current.seekTo(0);
      } else if (beatPlayerRef.current.currentTime !== undefined) {
        beatPlayerRef.current.currentTime = 0;
        beatPlayerRef.current.play();
      }
    }
    // 2. Play the specific audio element
    const audios = document.querySelectorAll(`audio[data-take-id="${takeId}"]`);
    if (audios.length > 0) {
      audios[0].currentTime = 0;
      audios[0].play();
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
    updateActiveDraftContent(lyrics ? lyrics + header : header);
  };

  const handleFindRhymes = async () => {
    // Standard Text Selection API fallback, since CM6 abstracts DOM selection if unconfigured correctly.
    const selection = window.getSelection();
    let selectedWord = selection.toString().trim();
    
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
    // Currently disabled rhyme insertion logic during CM6 architecture transition
    // Need to port CM6 view dispatch replacing here
  };

  const parseTime = (timeStr) => {
    if (!timeStr.includes(':')) return parseInt(timeStr) || 0;
    const [m, s] = timeStr.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddMarker = (e) => {
    e.preventDefault();
    if (!newMarkerTime || !newMarkerLabel) return;
    const timeInSeconds = parseTime(newMarkerTime);
    const newMarkers = [...markers, { time: timeInSeconds, label: newMarkerLabel }].sort((a, b) => a.time - b.time);
    setMarkers(newMarkers);
    setNewMarkerTime('');
    setNewMarkerLabel('');
  };

  const handleDeleteMarker = (e, index) => {
    e.stopPropagation();
    const newMarkers = markers.filter((_, i) => i !== index);
    setMarkers(newMarkers);
  };

  const handleSeekPlayer = (time) => {
    if (beatPlayerRef.current) {
      if (typeof beatPlayerRef.current.seekTo === 'function') {
        beatPlayerRef.current.seekTo(time);
      } else if (beatPlayerRef.current.currentTime !== undefined) {
        beatPlayerRef.current.currentTime = time;
      }
    }
  };

  if (loading) return (
    <div className="min-h-[calc(100vh-73px)] flex justify-center items-center">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
    </div>
  );
  if (error) return (
    <div className="min-h-[calc(100vh-73px)] flex justify-center items-center text-red-500 font-medium">{error}</div>
  );

  // Mark first load complete after initial data is populated
  if (!loading && isFirstLoad.current) isFirstLoad.current = false;

  return (
    <div className="min-h-[calc(100vh-73px)] px-2 py-4 md:p-8 w-full max-w-full transition-all duration-200 ease-in-out" style={{ background: 'var(--bg-main)' }}>
      {isFocusMode && <style>{`nav { display: none !important; }`}</style>}
      <div className={`max-w-[1500px] w-full max-w-full mx-auto relative z-10 transition-all duration-200 ease-in-out ${isFocusMode ? 'space-y-0' : 'space-y-4 md:space-y-6'}`}>
        
        {/* Minimal Focus Header has been removed per instructions to keep standard UI */}


        <div className="flex justify-between items-center p-4 rounded-lg mb-2 transition-colors" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center gap-2 sm:gap-4">
            {!isFocusMode && (
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                title="Open Navigator"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              </button>
            )}
            <button 
              onClick={() => navigate('/dashboard')}
              className="font-semibold transition-colors flex items-center gap-2 text-sm"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <span>&larr;</span> Dashboard
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportLyrics}
              className="px-4 py-2 rounded-lg transition-all text-sm font-medium hidden sm:block"
              style={{ background: 'transparent', border: '1px solid var(--bg-border)', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Export TXT
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg font-bold text-white transition-all text-sm"
              style={{ background: saving ? 'var(--accent-hover)' : 'var(--accent-primary)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </div>

        {/* Editor Main Content */}
        <div className={`rounded-xl overflow-hidden transition-all duration-200 ease-in-out`} style={{ background: isFocusMode ? 'var(--bg-main)' : 'var(--bg-surface)', border: isFocusMode ? 'none' : '1px solid var(--bg-border)', boxShadow: isFocusMode ? 'none' : 'var(--shadow-soft)' }}>
          
          {/* Top Controls (Title & Beat) */}
          <div className="px-6 md:px-8 py-4 space-y-4 transition-colors" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Session Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name your track..."
                className="w-full text-2xl sm:text-3xl md:text-4xl font-display font-extrabold p-0 bg-transparent outline-none placeholder-slate-500 transition-all border-none focus:ring-0 truncate"
                style={{ color: 'var(--brand-dark)' }}
              />
            </div>

            <div className="flex flex-col md:grid md:grid-cols-3 gap-2 md:gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beat Source</label>
                <Dropdown
                  value={beatSource}
                  onChange={(val) => setBeatSource(val)}
                  options={[
                    { value: 'youtube', label: 'YouTube' },
                    { value: 'upload', label: 'Upload Audio' },
                    { value: 'external', label: 'External Link' }
                  ]}
                  className="w-full"
                />
              </div>
              <div className="md:col-span-2">
                {beatSource === 'upload' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Upload Beat
                    </label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="w-full p-2 rounded-lg outline-none transition-colors custom-input file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700"
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
                      className="w-full p-3 rounded-lg outline-none transition-colors custom-input"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Audio file sources → HTMLAudioElement via BeatPlayer */}
            {(beatSource === 'upload' || beatSource === 'external') && beatUrl && (
              <BeatPlayer ref={beatPlayerRef} beatUrl={beatUrl} beatSource={beatSource} />
            )}

            {/* YouTube sources → iframe embed, never HTMLAudioElement */}
            {beatSource === 'youtube' && beatUrl && (
              <YouTubePlayer url={beatUrl} />
            )}

            <div className="flex items-center justify-start gap-4 mt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', boxShadow: 'var(--shadow-soft)' }}>
                <label className="text-sm font-medium transition-colors" style={{ color: 'var(--accent-primary)' }}>BPM</label>
                <BpmInput bpm={bpm} setBpm={setBpm} />
              </div>
              <button
                onClick={() => setMetronomeOn(!metronomeOn)}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors border"
                style={{
                  background: metronomeOn ? 'var(--accent-primary)' : 'transparent',
                  color: metronomeOn ? '#fff' : 'var(--text-muted)',
                  borderColor: metronomeOn ? 'var(--accent-primary)' : 'var(--bg-border)',
                }}
              >
                {metronomeOn ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Metronome ON
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full" style={{ background: 'var(--text-muted)' }}></span>
                    Metronome OFF
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Lyrics Editor (Workspace) */}
          <div className={`px-2 py-4 sm:p-4 md:p-8 flex flex-col gap-4 md:gap-8 relative transition-all duration-200 ease-in-out ${!isFocusMode ? 'lg:grid lg:grid-cols-[260px_1fr]' : ''}`} style={{ padding: isFocusMode ? '0' : '' }}>
            
            {/* Section Navigator */}
            {!isFocusMode && (
              <>
                {/* Mobile Drawer Backdrop */}
                {isMobileNavOpen && (
                  <div 
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileNavOpen(false)}
                  />
                )}
                
                {/* Navigator Container */}
                <div 
                  className={`
                    fixed lg:static inset-y-0 left-0 z-50 w-[280px] lg:w-full h-full lg:h-auto
                    bg-[var(--bg-main)] lg:bg-transparent border-r border-[var(--bg-border)] lg:border-none
                    p-6 lg:p-0 flex flex-col gap-1 transition-transform duration-300 ease-in-out
                    ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    lg:pr-4 shadow-xl lg:shadow-none
                  `}
                >
                  <div className="flex justify-between items-center mb-4 lg:mb-2" style={{ color: 'var(--nav-heading)' }}>
                    <label className="block text-xs font-bold uppercase tracking-wider">Navigator</label>
                    <button className="lg:hidden p-1.5 -mr-1.5 rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)]" onClick={() => setIsMobileNavOpen(false)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                  </div>
              
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1 mt-2" style={{ color: 'var(--nav-heading)' }}>Sections</div>
              <div className="overflow-y-auto space-y-1.5 mb-6 max-h-[30vh]">
                {parsedSections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => navigateToSection(section.type)}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border border-transparent"
                    style={{
                      color: activeSectionId === section.id ? 'var(--nav-active)' : 'var(--nav-item)',
                      fontWeight: activeSectionId === section.id ? '600' : 'normal',
                      background: activeSectionId === section.id ? 'var(--bg-hover)' : 'transparent',
                      boxShadow: activeSectionId === section.id ? 'var(--accent-glow)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (activeSectionId !== section.id) {
                         e.currentTarget.style.background = 'var(--bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeSectionId !== section.id) {
                         e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {section.type}
                  </button>
                ))}
                {parsedSections.length === 0 && (
                  <div className="text-sm italic px-2" style={{ color: 'var(--text-muted)' }}>No sections added yet.</div>
                )}
              </div>

              <div className="text-[10px] font-bold uppercase tracking-widest mb-1 mt-2" style={{ color: 'var(--nav-heading)' }}>Beat Markers</div>
              <div className="overflow-y-auto space-y-1.5 mb-3 max-h-[30vh]">
                {markers.map((marker, index) => (
                  <div
                    key={index}
                    className="group flex justify-between items-center w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border border-transparent"
                    style={{ color: 'var(--text-main)', background: 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="cursor-pointer transition-colors" onClick={() => navigateToSection(marker.label, marker.time)}>
                      <span className="mr-2" style={{ color: 'var(--accent-primary)' }}>[{formatTime(marker.time)}]</span>
                      {marker.label}
                    </span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {index < markers.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (beatPlayerRef.current) {
                              beatPlayerRef.current.setLoop(marker.time, markers[index + 1].time);
                            }
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded"
                        >
                          Loop
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMarker(e, index);
                        }}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
                {markers.length === 0 && (
                  <div className="text-gray-400 text-sm italic px-2">No markers yet.</div>
                )}
              </div>
              
              <form onSubmit={handleAddMarker} className="flex gap-2 items-center text-sm mb-6">
                <div className="flex bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/10 rounded-xl p-1 shadow-inner w-full flex-1 transition-all focus-within:ring-2 focus-within:ring-green-500/30 focus-within:border-green-500/50">
                  <input 
                    type="text" 
                    value={newMarkerTime}
                    onChange={(e) => setNewMarkerTime(e.target.value)}
                    placeholder="0:00" 
                    className="w-16 p-1.5 text-center bg-transparent text-slate-900 dark:text-white outline-none focus:ring-0 font-mono text-xs placeholder-slate-400 border-none"
                  />
                  <div className="w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                  <input 
                    type="text" 
                    value={newMarkerLabel}
                    onChange={(e) => setNewMarkerLabel(e.target.value)}
                    placeholder="Label" 
                    className="flex-1 p-1.5 bg-transparent text-slate-900 dark:text-white outline-none focus:ring-0 min-w-0 text-xs placeholder-slate-400 border-none"
                  />
                  <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition-colors ml-1 shadow-sm font-bold">
                    +
                  </button>
                </div>
              </form>

              <div className="text-sm pt-6 border-t border-slate-200/50 dark:border-white/5 space-y-4">
                <div className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs tracking-wide">Show Syllables</span>
                    <button 
                      onClick={() => setShowSyllables(!showSyllables)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-offset-slate-900 focus:ring-offset-1 ${showSyllables ? 'bg-indigo-500 hover:shadow-[0_0_8px_rgba(99,102,241,0.3)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                      role="switch"
                      aria-checked={showSyllables}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showSyllables ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs tracking-wide">Show Rhymes</span>
                    <button 
                      onClick={() => setShowRhymes(!showRhymes)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:focus:ring-offset-slate-900 focus:ring-offset-1 ${showRhymes ? 'bg-purple-500 hover:shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                      role="switch"
                      aria-checked={showRhymes}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showRhymes ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs tracking-wide">Rhyme Scheme</span>
                    <button 
                      onClick={() => setShowRhymeScheme(!showRhymeScheme)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] dark:focus:ring-offset-slate-900 focus:ring-offset-1 ${showRhymeScheme ? 'bg-[var(--accent-primary)] hover:brightness-110' : 'bg-slate-300 dark:bg-slate-600'}`}
                      role="switch"
                      aria-checked={showRhymeScheme}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showRhymeScheme ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                  
                <button 
                  onClick={handleFindRhymes}
                  className="w-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-cyan-300 font-bold py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm tracking-wide text-xs uppercase"
                >
                  Find Rhymes
                </button>
                
                {rhymeError && (
                  <div className="text-xs text-red-500 font-medium px-2 mt-2">{rhymeError}</div>
                )}
                
                {currentWord && !rhymeError && (
                  <div className="mt-4 mb-4 space-y-2">
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
            </>
            )}

            {/* Existing Sections Workspace (Right Column) */}
            <div className={`flex flex-col relative min-w-0 transition-all duration-200 ease-in-out`}>

              {/* Shared Parent Container */}
              <div className="flex flex-col h-full relative z-0">

              {/* Mobile Draft Switcher Trigger */}
              {!isFocusMode && (
                <div className="sm:hidden px-2 pb-2 mt-4 flex items-center">
                  <button 
                    onClick={() => setIsBottomSheetOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-all"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--bg-border)' }}
                  >
                    <span className="truncate max-w-[150px]">{drafts[activeDraftIndex]?.name || 'Drafts'}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
              )}

              {/* Tab Bar */}
              {!isFocusMode && (
              <div
                className="hidden sm:flex items-end flex-wrap relative z-10"
                style={{
                  // Tab tray sits directly on top of the editor container
                  padding: '0 16px',
                  gap: '4px',
                  marginBottom: '0', // No gap, let editor pull up
                  overflow: 'visible',
                  height: 'auto',
                  borderBottom: '1px solid var(--tab-container-border)',
                }}
              >
                <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
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

                {/* + Draft action — completely inline with tabs */}
                <button
                  onClick={() => {
                    const newDraftName = `Draft ${drafts.length + 1}`;
                    setDrafts([...drafts, { id: Math.random().toString(36).substring(2, 9), name: newDraftName, content: '' }]);
                    setActiveDraftIndex(drafts.length);
                  }}
                  className="draft-add shrink-0 flex items-center px-3 py-2.5 outline-none"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Draft
                </button>
              </div>
              )}

              {/* Editor Container */}
              <div
                className={`flex flex-col flex-1 h-full relative transition-all duration-200`}
                style={isFocusMode ? {} : {
                  marginTop: '-1px', // Merge border with tab
                  zIndex: 1,
                  background: 'var(--editor-bg)',
                  borderRadius: '12px',
                  boxShadow: 'var(--editor-shadow)',
                  border: '1px solid var(--editor-border)',
                  overflow: 'hidden',
                }}
              >
                {/* ── Editor Toolbar ── */}
                <div
                  className="px-3 md:px-8 py-3 border-b border-slate-200/50 dark:border-white/5 transition-opacity duration-200"
                  style={{ background: 'transparent' }}
                >

                  {/* ── MOBILE: single clean row ── */}
                  <div className="flex sm:hidden items-center justify-between gap-2" style={{ minWidth: 0 }}>

                    {/* Left: Auto-save indicator */}
                    <span className="text-xs font-semibold text-indigo-500 dark:text-cyan-400 shrink-0 min-w-0 truncate" style={{ maxWidth: '70px' }}>
                      {isSaving ? '● Saving' : lastSaved ? '✓ Saved' : ''}
                    </span>

                    {/* Centre-right controls: Align | Record/Stop | + Section */}
                    <div className="flex items-center gap-2 shrink-0">

                      {/* Align Dropdown — compact */}
                      <div style={{ width: '100px' }}>
                        <Dropdown
                          compact
                          value={textAlign}
                          onChange={(val) => setTextAlign(val)}
                          options={[
                            { value: 'left', label: 'Align Left' },
                            { value: 'center', label: 'Align Center' },
                            { value: 'right', label: 'Align Right' }
                          ]}
                        />
                      </div>

                      {/* Record / Stop toggle */}
                      {!isGuest ? (
                        <button
                          id="mobile-record-toggle"
                          onClick={isRecording ? stopRecording : startRecording}
                          className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg text-sm font-bold transition-all"
                          style={{
                            height: '36px',
                            border: isRecording
                              ? '1px solid rgba(239,68,68,0.35)'
                              : '1px solid rgba(239,68,68,0.25)',
                            background: isRecording
                              ? 'rgba(239,68,68,0.12)'
                              : 'rgba(239,68,68,0.08)',
                            color: isRecording ? '#ef4444' : '#dc2626',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isRecording ? (
                            <>
                              {/* Stop icon square */}
                              <span style={{ display: 'inline-block', width: '9px', height: '9px', background: 'currentColor', borderRadius: '2px', flexShrink: 0 }} />
                              Stop
                            </>
                          ) : (
                            <>
                              {/* Record dot */}
                              <span style={{ display: 'inline-block', width: '9px', height: '9px', background: '#ef4444', borderRadius: '50%', flexShrink: 0, animation: 'none' }} />
                              Record
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/signup')}
                          className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg text-sm font-bold transition-all"
                          style={{
                            height: '36px',
                            border: '1px solid rgba(217,119,6,0.25)',
                            background: 'rgba(217,119,6,0.08)',
                            color: '#d97706',
                            whiteSpace: 'nowrap',
                          }}
                          title="Create a free account to unlock recording"
                        >
                          <Mic2 size={13} />
                          Record
                        </button>
                      )}

                      {/* + Section Dropdown */}
                      <div className="shrink-0" style={{ width: '106px' }}>
                        <Dropdown
                          compact
                          value=""
                          onChange={(val) => { if (val) insertSection(val); }}
                          placeholder="+ Section"
                          options={[
                            { value: 'Hook', label: 'Hook' },
                            { value: 'Verse', label: 'Verse' },
                            { value: 'Bridge', label: 'Bridge' },
                            { value: 'Intro', label: 'Intro' },
                            { value: 'Outro', label: 'Outro' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recording mode pill — mobile only, shown below the row when active */}
                  {isRecording && recordingMode && (
                    <div className="sm:hidden mt-2 flex items-center gap-1.5">
                      <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                        recordingMode === 'mic+beat'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
                      }`}>
                        <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-current"></span>
                        {recordingMode === 'mic+beat' ? 'Mic + Beat' : 'Mic Only'}
                      </span>
                    </div>
                  )}

                  {/* ── DESKTOP: full toolbar ── */}
                  <div className="hidden sm:flex sm:flex-row sm:justify-between items-center gap-3">
                    <div className="flex items-center justify-between w-full sm:w-auto">
                      <span className="text-xs font-semibold text-indigo-500 dark:text-cyan-400">
                        {isSaving ? '● Auto-saving...' : lastSaved ? '✓ Saved' : ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                      {/* Focus Mode — desktop */}
                      <button
                        onClick={() => setIsFocusMode(!isFocusMode)}
                        className="flex px-3 py-1.5 items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        style={{ border: '1px solid var(--bg-border)', color: isFocusMode ? 'var(--accent-primary)' : 'var(--text-muted)', background: 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        {isFocusMode ? 'Exit Focus' : 'Focus Mode'}
                      </button>

                      {/* Focus Mode — mobile (inside desktop column to keep DOM order clean) */}
                      <button
                        onClick={() => setIsFocusMode(!isFocusMode)}
                        className="sm:hidden px-2 py-1.5 flex items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        style={{ border: '1px solid var(--bg-border)', color: isFocusMode ? 'var(--accent-primary)' : 'var(--text-muted)', background: 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        {isFocusMode && 'Exit'}
                      </button>

                      <div className="w-[125px]">
                        <Dropdown
                          value={textAlign}
                          onChange={(val) => setTextAlign(val)}
                          options={[
                            { value: 'left', label: 'Align Left' },
                            { value: 'center', label: 'Align Center' },
                            { value: 'right', label: 'Align Right' }
                          ]}
                        />
                      </div>

                      <div className="h-6 w-px" style={{ background: 'var(--bg-border)' }}></div>

                      <div className="flex items-center gap-2">
                        {!isGuest ? (
                          <>
                            <button
                              id="desktop-record-toggle"
                              onClick={isRecording ? stopRecording : startRecording}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)] border ${
                                isRecording
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'
                                  : 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
                              }`}
                            >
                              {isRecording ? (
                                <>
                                  <span className="h-2.5 w-2.5 rounded-sm bg-current"></span>
                                  Stop
                                </>
                              ) : (
                                <>
                                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                                  Rec
                                </>
                              )}
                            </button>
                            {isRecording && recordingMode && (
                              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                                recordingMode === 'mic+beat'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
                              }`}>
                                <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-current"></span>
                                {recordingMode === 'mic+beat' ? 'Mic + Beat' : 'Mic Only'}
                              </span>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => navigate('/signup')}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm hover:bg-amber-500/20 transition-colors cursor-pointer"
                            title="Create a free account to unlock recording"
                          >
                            <Mic2 size={14} className="opacity-70" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">Sign up to Record</span>
                          </button>
                        )}
                      </div>

                      <div className="w-[140px]">
                        <Dropdown
                          value=""
                          onChange={(val) => { if (val) insertSection(val); }}
                          placeholder="+ Section"
                          options={[
                            { value: 'Hook', label: 'Hook' },
                            { value: 'Verse', label: 'Verse' },
                            { value: 'Bridge', label: 'Bridge' },
                            { value: 'Intro', label: 'Intro' },
                            { value: 'Outro', label: 'Outro' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                </div>
                <style>{`
                  .cm-section-header {
                    color: var(--accent-primary);
                    font-weight: 500;
                    font-family: 'Outfit', sans-serif;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    padding: 4px 8px;
                    margin-left: -8px;
                    transition: all 0.2s ease;
                    display: inline-block;
                    margin-top: 20px;
                    margin-bottom: 6px;
                    opacity: 0.9;
                  }
                  .dark .cm-section-header {
                    color: var(--accent-primary);
                  }
                  
                  .cm-active-section {
                    background: rgba(64, 138, 113, 0.08);
                    border-radius: 6px;
                    border-left: 3px solid var(--accent-primary);
                  }
                  .dark .cm-active-section {
                    background: rgba(64, 138, 113, 0.12);
                    border-left: 3px solid var(--accent-primary);
                  }

                  .cm-activeLine {
                    background: transparent !important;
                  }
                  .cm-cursor {
                    border-left-color: var(--accent-primary) !important;
                    border-left-width: 2px !important;
                  }
                  
                  .cm-syl-0 { color: #f87171 !important; }
                  .cm-syl-1 { color: #818cf8 !important; }
                  .cm-syl-2 { color: #34d399 !important; }
                  .cm-syl-3 { color: #fbbf24 !important; }
                  .cm-syl-4 { color: #c084fc !important; }
                  
                  .cm-rhyme-0 { text-decoration: underline 2px #ef4444 !important; }
                  .cm-rhyme-1 { text-decoration: underline 2px #6366f1 !important; }
                  .cm-rhyme-2 { text-decoration: underline 2px #10b981 !important; }
                  .cm-rhyme-3 { text-decoration: underline 2px #f59e0b !important; }
                  
                  .cm-rhyme-scheme {
                    font-size: 12px;
                    color: var(--accent-primary);
                    margin-left: 8px;
                    font-weight: 700;
                    background: rgba(64, 138, 113, 0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                  }
                  .dark .cm-rhyme-scheme {
                    color: var(--accent-primary);
                    background: rgba(64, 138, 113, 0.15);
                  }
                  
                  .editor-wrapper {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    padding: 0;
                  }
                  
                  @media (min-width: 768px) {
                    .editor-wrapper {
                      padding: 0 48px;
                    }
                  }

                  .focus-mode.editor-wrapper {
                    padding: 0 16px;
                    justify-content: center !important;
                  }
                  .focus-mode .cm-editor {
                    max-width: 1100px !important;
                  }
                  
                  .cm-editor {
                    width: 100%;
                    max-width: 1000px;
                    height: 100%;
                    background: transparent !important;
                    border-radius: 0;
                    font-family: inherit;
                    font-size: 15.5px;
                    line-height: 1.8;
                    letter-spacing: 0.015em;
                  }
                  .dark .cm-editor {
                    background: transparent !important;
                  }
                  .cm-scroller {
                    overflow: auto;
                    height: 100%;
                    background: transparent !important;
                    /* Hide scrollbar for a cleaner look */
                    scrollbar-width: none;
                  }
                  .cm-scroller::-webkit-scrollbar {
                    display: none;
                  }
                  .cm-content {
                    font-size: 17px;
                    line-height: 1.85;
                    letter-spacing: 0.01em;
                    caret-color: var(--accent-primary);
                    margin: 0 !important;
                    padding: 16px 8px !important;
                    min-height: 400px;
                    text-align: ${textAlign} !important;
                  }

                  @media (min-width: 768px) {
                    .cm-content {
                      padding: 24px 28px !important;
                      font-size: 18px;
                    }
                  }
                  .cm-line {
                    padding: 0;
                    opacity: 1 !important;
                    font-weight: 400 !important;
                  }
                  .cm-gutters {
                    display: none;
                  }
                  .cm-focused {
                    outline: none !important;
                  }
                  .cm-editor:focus,
                  .cm-editor:focus-visible,
                  .cm-scroller:focus {
                    outline: none !important;
                  }
                `}</style>
                <div className={`editor-wrapper ${isFocusMode ? 'focus-mode' : ''} flex-1 transition-all duration-200 ease-in-out bg-transparent border-none`} style={{ height: '600px', overflowY: 'auto' }}>
                  
                  <CodeMirror
                    onCreateEditor={(view) => {
                      editorRef.current = view;
                    }}
                    value={lyrics}
                    onChange={(val) => updateActiveDraftContent(val)}
                    extensions={[
                      getSectionHeaderPlugin(activeSectionType),
                      EditorView.lineWrapping,
                      placeholder('Start writing some bars... Use [Hook] or [Verse] to create sections.'),
                      ...(showSyllables ? [syllablePlugin] : []),
                      ...(showRhymes ? [rhymePlugin] : []),
                      ...(showRhymeScheme ? [rhymeSchemePlugin] : [])
                    ]}
                    basicSetup={{
                      lineNumbers: false,
                      foldGutter: false,
                      highlightActiveLine: false,
                      syntaxHighlighting: false,
                    }}
                    className={`relative z-10 w-full font-mono leading-relaxed text-gray-900 dark:text-white transition-colors`}
                  />
                </div>
              </div>
              </div>

              {/* Audio Takes Display */}
              {!isFocusMode && takes.length > 0 && (
                <div style={{ marginTop: '16px', padding: '16px 20px', borderRadius: '16px', background: 'var(--take-container-bg)', border: '1px solid var(--take-container-border)', boxShadow: 'var(--take-container-shadow)' }}>
                  <button 
                    onClick={() => setIsRecordedTakesOpen(!isRecordedTakesOpen)}
                    style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--take-header-color)', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                  >
                    <span>Recorded Takes ({takes.length})</span>
                    <svg 
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                      style={{ transform: isRecordedTakesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  
                  {isRecordedTakesOpen && (
                    <div className="space-y-[12px] mt-4">
                    {takes.map((take, index) => (
                      <TakeCard
                        key={take._id || take.id}
                        take={take}
                        index={index}
                        editingTakeId={editingTakeId}
                        editingTakeName={editingTakeName}
                        setEditingTakeName={setEditingTakeName}
                        handleRenameTakeSubmit={handleRenameTakeSubmit}
                        setEditingTakeId={setEditingTakeId}
                        handlePlayTakeSync={handlePlayTakeSync}
                        onDelete={(takeIdentifier) => setTakes(takes.filter(t => t._id !== takeIdentifier && t.id !== takeIdentifier))}
                        recordingMode={recordingMode}
                      />
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>
            
          </div>

        </div>
      </div>

      {/* Mobile Draft Bottom Sheet */}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsBottomSheetOpen(false)}
          ></div>
          
          {/* Sheet */}
          <div 
            className="relative w-full shadow-xl flex flex-col max-h-[85vh]"
            style={{ background: 'var(--bg-main)', borderRadius: '24px 24px 0 0', transform: 'translateY(0)', animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>

            {/* Grabber */}
            <div className="w-full flex justify-center py-4 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)}>
              <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--bg-border)' }}></div>
            </div>
            
            <div className="px-6 pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Drafts
            </div>
            
            <div className="overflow-y-auto px-4 pb-8 flex-col space-y-1">
              {drafts.map((draft, idx) => (
                <div key={draft.id || idx} className="w-full flex justify-between items-center group rounded-2xl p-1">
                  <button 
                    className="flex-1 flex items-center justify-between p-3.5 rounded-xl transition-colors text-left"
                    style={{ 
                      background: activeDraftIndex === idx ? 'var(--bg-elevated)' : 'transparent',
                      color: activeDraftIndex === idx ? 'var(--accent-primary)' : 'var(--text-main)',
                      fontWeight: activeDraftIndex === idx ? '800' : '600'
                    }}
                    onClick={() => {
                      setActiveDraftIndex(idx);
                      setIsBottomSheetOpen(false);
                    }}
                  >
                    <span className="truncate text-[15px]">{draft.name}</span>
                    {activeDraftIndex === idx && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </button>
                  
                  {/* Delete option for inactive drafts */}
                  {activeDraftIndex !== idx ? (
                    <button
                      className="p-3.5 rounded-xl ml-1 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => {
                        if(confirm(`Delete '${draft.name}'?`)) {
                           const newDrafts = drafts.filter((_, idxToRemove) => idx !== idxToRemove);
                           setDrafts(newDrafts);
                           if (activeDraftIndex > idx) {
                             setActiveDraftIndex(activeDraftIndex - 1);
                           }
                        }
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  ) : (
                    <div className="w-[46px]"></div> /* Placeholder to keep text aligned */
                  )}
                </div>
              ))}
              
              <div className="pt-3 pb-2 mt-2 border-t" style={{ borderColor: 'var(--bg-border)' }}>
                <button
                  className="w-full text-left p-3.5 rounded-xl text-[15px] font-bold transition-colors flex items-center gap-3"
                  style={{ color: 'var(--accent-primary)' }}
                  onClick={() => {
                    const newDraftName = `Draft ${drafts.length + 1}`;
                    setDrafts([...drafts, { id: Math.random().toString(36).substring(2, 9), name: newDraftName, content: '' }]);
                    setActiveDraftIndex(drafts.length);
                    setIsBottomSheetOpen(false);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  New Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SessionEditor;


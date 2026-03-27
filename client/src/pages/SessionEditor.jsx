import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSessionById, updateSession } from '../services/sessionService';
import { uploadAudio } from '../services/uploadService';
import { getRhymes } from '../services/rhymeService';
import BeatPlayer from '../components/BeatPlayer';
import YouTubePlayer from '../components/YouTubePlayer';
import Dropdown from '../components/ui/Dropdown';
import { startMetronome } from '../utils/metronome';
import CodeMirror from '@uiw/react-codemirror';
import { ViewPlugin, Decoration, EditorView, WidgetType, placeholder } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syllable } from 'syllable';
import { rhymeSchemePlugin } from '../editor/plugins/rhymeSchemePlugin';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
      onClick={() => setActiveDraftIndex(idx)}
      onDoubleClick={handleDoubleClick}
      className={`group flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all duration-300 cursor-grab active:cursor-grabbing border-b-2 select-none relative shrink-0 tracking-wide hover:shadow-[0_0_12px_rgba(99,102,241,0.05)]
        ${isActive 
          ? 'text-indigo-600 dark:text-cyan-400 border-indigo-500 dark:border-cyan-400 bg-white/50 dark:bg-slate-800/50 rounded-t-xl' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-500/5 dark:hover:bg-slate-400/5 border-transparent'
        }`}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="bg-transparent border-b-2 border-indigo-500 text-slate-900 dark:text-white outline-none min-w-[60px] max-w-[120px] px-1"
          onPointerDown={(e) => e.stopPropagation()} 
        />
      ) : (
        <span title={idx !== 0 ? "Double click to rename" : ""}>
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
          className="text-slate-400 hover:text-red-500 hover:bg-red-500/10 h-5 w-5 flex items-center justify-center rounded-full ml-1 opacity-0 group-hover:opacity-100 transition-all focus:outline-none"
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
  
  const [isRecording, setIsRecording] = useState(false);
  const [takes, setTakes] = useState([]);
  const [editingTakeId, setEditingTakeId] = useState(null);
  const [editingTakeName, setEditingTakeName] = useState('');
  
  const [markers, setMarkers] = useState([]);
  const [newMarkerTime, setNewMarkerTime] = useState('');
  const [newMarkerLabel, setNewMarkerLabel] = useState('');

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

          // Safely build new takes list, replacing temp placeholder
          const safeTakes = Array.isArray(takes) ? takes : [];
          const newTakes = [...safeTakes.filter(t => t._id !== tempId), finalTake];

          // 1. Update UI optimistically
          setTakes(newTakes);

          // 2. Persist to backend (uses the pre-configured api instance, not raw axios)
          try {
            const res = await updateSession(id, { takes: newTakes });

            if (res?.takes && Array.isArray(res.takes)) {
              setTakes(res.takes); // Sync with DB-generated ObjectIDs
            } else {
              console.warn("Invalid takes response from DB, keeping local takes");
            }
          } catch (err) {
            console.error("SAVE ERROR:", err);
          }
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
      console.error("Recording error:", error);
      alert("Microphone access denied or not available.");
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
    <div className="min-h-[calc(100vh-73px)] p-4 md:p-8" style={{ background: 'var(--bg-base)' }}>

      <div className="max-w-[1500px] w-full mx-auto space-y-6 relative z-10">
        
        <div className="flex justify-between items-center p-4 rounded-lg mb-2 transition-colors" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => navigate('/dashboard')}
            className="font-semibold transition-colors flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-focus)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <span>&larr;</span> Dashboard
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={exportLyrics}
              className="px-4 py-2 rounded-lg transition-all text-sm font-medium hidden sm:block"
              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Export TXT
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg font-bold text-white transition-all text-sm"
              style={{ background: saving ? 'var(--accent-soft)' : 'var(--accent-focus)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </div>

        {/* Editor Main Content */}
        <div className="rounded-xl overflow-hidden transition-colors" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
          
          {/* Top Controls (Title & Beat) */}
          <div className="px-6 md:px-8 py-4 space-y-4 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Session Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name your track..."
                className="w-full text-3xl md:text-4xl font-display font-extrabold p-0 bg-transparent outline-none placeholder-slate-500 transition-all border-none focus:ring-0"
                style={{ color: 'var(--text-main)' }}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
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

            {/* Audio file sources → HTMLAudioElement via BeatPlayer */}
            {(beatSource === 'upload' || beatSource === 'external') && beatUrl && (
              <BeatPlayer ref={beatPlayerRef} beatUrl={beatUrl} beatSource={beatSource} />
            )}

            {/* YouTube sources → iframe embed, never HTMLAudioElement */}
            {beatSource === 'youtube' && beatUrl && (
              <YouTubePlayer url={beatUrl} />
            )}

            <div className="flex items-center justify-start gap-4 mt-2">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-sm">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">BPM</label>
                <input 
                  type="number"
                  value={bpm}
                  min="40"
                  max="220"
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-16 p-1 text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <button
                onClick={() => setMetronomeOn(!metronomeOn)}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors border ${
                  metronomeOn 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {metronomeOn ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Metronome ON
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    Metronome OFF
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Lyrics Editor (Workspace) */}
          <div className="p-6 md:p-8 flex flex-col lg:grid lg:grid-cols-[260px_1fr] gap-8 relative">
            
            {/* Section Navigator (Left Column on Desktop, Top on Mobile) */}
            <div className="lg:border-r border-slate-200/50 dark:border-white/5 lg:pr-6 flex flex-col gap-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Navigator</label>
              
              <div className="text-[10px] font-bold text-indigo-500 dark:text-cyan-400 uppercase tracking-widest mb-1 mt-2">Sections</div>
              <div className="overflow-y-auto space-y-1.5 mb-6 max-h-48 custom-scrollbar">
                {parsedSections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => navigateToSection(section.type)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      activeSectionId === section.id 
                        ? 'bg-indigo-500/10 dark:bg-cyan-400/10 text-indigo-700 dark:text-cyan-300 border-indigo-500/20 dark:border-cyan-400/20 shadow-inner' 
                        : 'bg-white/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-transparent hover:bg-white/80 dark:hover:bg-white/10 hover:border-slate-200/50 dark:hover:border-white/5'
                    }`}
                  >
                    {section.type}
                  </button>
                ))}
                {parsedSections.length === 0 && (
                  <div className="text-gray-400 text-sm italic px-2">No sections added yet.</div>
                )}
              </div>

              <div className="text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-widest mb-1 mt-2">Beat Markers</div>
              <div className="overflow-y-auto space-y-1.5 mb-3 max-h-48 custom-scrollbar">
                {markers.map((marker, index) => (
                  <div
                    key={index}
                    className="group flex justify-between items-center w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-white/40 dark:bg-slate-900/40 border border-transparent hover:bg-white/80 dark:hover:bg-white/10 hover:border-slate-200/50 dark:hover:border-white/5"
                  >
                    <span className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-300 transition-colors" onClick={() => navigateToSection(marker.label, marker.time)}>
                      <span className="text-blue-500 mr-2">[{formatTime(marker.time)}]</span>
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
                <div className="flex bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/10 rounded-xl p-1 shadow-inner w-full flex-1 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50">
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
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:focus:ring-offset-slate-900 focus:ring-offset-1 ${showRhymeScheme ? 'bg-teal-500 hover:shadow-[0_0_8px_rgba(20,184,166,0.3)]' : 'bg-slate-300 dark:bg-slate-600'}`}
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

            {/* Existing Sections Workspace (Right Column) */}
            <div className="flex flex-col glass-panel rounded-3xl border border-transparent dark:border-white/10 shadow-2xl relative min-w-0">
              
              {/* Tabs UI */}
              <div className="flex items-end overflow-x-auto whitespace-nowrap pt-3 px-4 bg-white/20 dark:bg-slate-800/40 border-b border-slate-200/50 dark:border-white/5 min-h-[56px] relative z-20 rounded-t-3xl custom-scrollbar-horizontal">
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

              <div className="p-0 flex flex-col flex-1 h-full relative border-t border-transparent">
                <div className="flex justify-between items-center px-6 md:px-8 py-4 bg-white/10 dark:bg-slate-900/20 border-b border-slate-200/50 dark:border-white/5">
                  <div className="flex flex-col">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Workspace
                    </label>
                    <span className="text-[10px] font-semibold text-indigo-500 dark:text-cyan-400 h-4 mt-0.5">
                      {isSaving ? '● Auto-saving...' : lastSaved ? '✓ Saved' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={startRecording}
                        disabled={isRecording}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                          isRecording 
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse' 
                            : 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-slate-400 dark:bg-slate-600' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'}`}></span>
                        Rec
                      </button>
                      <button
                        onClick={stopRecording}
                        disabled={!isRecording}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
                          !isRecording 
                            ? 'bg-slate-100 text-slate-400 border-transparent dark:bg-slate-800/50 dark:text-slate-600 cursor-not-allowed' 
                            : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:border-white hover:scale-105'
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-sm bg-current"></span>
                        Stop
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
                    </div>
                    <div className="w-[160px]">
                      <Dropdown
                        value=""
                        onChange={(val) => {
                          if (val) {
                            insertSection(val);
                          }
                        }}
                        placeholder="+ Add Section"
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
                <style>{`
                  .cm-section-header {
                    color: var(--accent-focus);
                    font-weight: 700;
                    font-family: 'Outfit', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    padding: 4px 8px;
                    margin-left: -8px;
                    transition: all 0.2s ease;
                    display: inline-block;
                    margin-top: 1rem;
                    margin-bottom: 0.25rem;
                  }
                  .dark .cm-section-header {
                    color: var(--accent-focus);
                  }
                  
                  .cm-active-section {
                    background: rgba(64, 138, 113, 0.08);
                    border-radius: 6px;
                    border-left: 3px solid var(--accent-focus);
                  }
                  .dark .cm-active-section {
                    background: rgba(64, 138, 113, 0.12);
                    border-left: 3px solid var(--accent-focus);
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
                    color: var(--accent-focus);
                    margin-left: 8px;
                    font-weight: 700;
                    background: rgba(64, 138, 113, 0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                  }
                  .dark .cm-rhyme-scheme {
                    color: var(--accent-focus);
                    background: rgba(64, 138, 113, 0.15);
                  }
                  
                  .cm-editor {
                    height: 100%;
                    background-color: transparent;
                    font-family: inherit;
                    font-size: 1.125rem;
                    line-height: 1.7;
                    letter-spacing: 0.3px;
                  }
                  .cm-scroller {
                    overflow: auto;
                    height: 100%;
                    /* Hide scrollbar for a cleaner look */
                    scrollbar-width: none;
                  }
                  .cm-scroller::-webkit-scrollbar {
                    display: none;
                  }
                  .cm-content {
                    padding: 1rem 0;
                    min-height: 400px;
                  }
                  .cm-line {
                    padding: 0;
                  }
                  .cm-gutters {
                    display: none;
                  }
                  .cm-focused {
                    outline: none !important;
                  }
                `}</style>
                <div className="flex-1 w-full bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 transition-colors p-6 md:p-8 shadow-inner" style={{ height: '600px', overflowY: 'auto' }}>
                  
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
                
                {/* Audio Takes Display */}
                {takes.length > 0 && (
                  <div className="mt-6 border-t border-slate-200/50 dark:border-white/5 pt-6 px-6 pb-6">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="text-lg">🎙️</span> Recorded Takes ({takes.length})
                    </h3>
                    <div className="space-y-3">
                      {takes.map((take, index) => {
                        const takeIdentifier = take._id || take.id;
                        return (
                        <div key={takeIdentifier} className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm transition-all hover:shadow-md">
                          {editingTakeId === takeIdentifier ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingTakeName}
                              onChange={(e) => setEditingTakeName(e.target.value)}
                              onBlur={() => handleRenameTakeSubmit(takeIdentifier)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameTakeSubmit(takeIdentifier);
                                if (e.key === 'Escape') setEditingTakeId(null);
                              }}
                              className="text-sm font-semibold bg-white dark:bg-slate-900 border border-indigo-500 rounded-lg px-3 py-1.5 outline-none min-w-[120px] shadow-inner"
                            />
                          ) : (
                            <span 
                              className="text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[120px] cursor-text hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors truncate"
                              onDoubleClick={() => {
                                setEditingTakeId(takeIdentifier);
                                setEditingTakeName(take.name || `Take ${index + 1}`);
                              }}
                              title="Double click to rename"
                            >
                              {take.name || `Take ${index + 1}`}
                            </span>
                          )}
                          
                          <button
                            onClick={() => handlePlayTakeSync(takeIdentifier)}
                            className="bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-cyan-400 dark:hover:bg-indigo-500/30 rounded-xl w-10 h-10 flex items-center justify-center transition-all shadow-sm shrink-0"
                            title="Play synced with beat"
                          >
                            ▶
                          </button>
                          
                          <audio data-take-id={takeIdentifier} controls src={take.url} className="h-10 flex-1 outline-none opacity-90 grayscale-[0.2]" />
                          
                          {take.isUploading && (
                             <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest animate-pulse px-2">Uploading...</span>
                          )}
                          {take.error && (
                             <span className="text-xs font-bold text-red-500 uppercase tracking-widest px-2">Failed</span>
                          )}
                          
                          <button
                            onClick={() => setTakes(takes.filter(t => t._id !== takeIdentifier && t.id !== takeIdentifier))}
                            className="text-slate-400 hover:bg-red-500 hover:text-white transition-colors h-8 w-8 rounded-full flex justify-center items-center font-bold pb-0.5 ml-2 shrink-0"
                            title="Delete take"
                          >
                            &times;
                          </button>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
};

export default SessionEditor;

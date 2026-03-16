import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';

const BeatPlayer = forwardRef(({ beatSource, beatUrl }, ref) => {
  const iframeRef = useRef(null);
  
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  
  const [loopStartInput, setLoopStartInput] = useState('');
  const [loopEndInput, setLoopEndInput] = useState('');
  const [loopError, setLoopError] = useState('');
  
  // Track current time
  const currentTimeRef = useRef(0);

  // We need to receive messages back from the iframe to get current time
  useEffect(() => {
    const handleMessage = (event) => {
      // Basic check, might need to be more robust for production
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'infoDelivery' && data.info) {
           if (data.info.currentTime !== undefined) {
             currentTimeRef.current = data.info.currentTime;
           }
        }
      } catch (e) {
        // Ignore parsing errors for non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Request current time from YouTube iframe periodically
    const timeInterval = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        // Ask YouTube player for current time
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: 'listening'
        }), '*');
      }
      
      const currentTime = currentTimeRef.current;
      
      if (loopEnabled && loopStart !== null && loopEnd !== null) {
        if (currentTime >= loopEnd) {
          if (iframeRef.current && iframeRef.current.contentWindow) {
             iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [loopStart, true]
             }), '*');
          }
        }
      }
    }, 250);

    return () => clearInterval(timeInterval);
  }, [loopEnabled, loopStart, loopEnd]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [seconds, true]
        }), '*');
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'playVideo',
          args: []
        }), '*');
      }
    },
    getCurrentTime: () => {
      return currentTimeRef.current;
    },
    setLoop: (startSeconds, endSeconds) => {
      if (endSeconds <= startSeconds) {
         return { error: 'End time must be greater than start time.' };
      }
      setLoopStart(startSeconds);
      setLoopEnd(endSeconds);
      setLoopEnabled(true);
      return { success: true };
    },
    clearLoop: () => {
      setLoopStart(null);
      setLoopEnd(null);
      setLoopEnabled(false);
    },
    toggleLoop: () => {
      setLoopEnabled(prev => !prev);
    }
  }));

  if (beatSource !== 'youtube' || !beatUrl) {
    return null;
  }

  const extractVideoId = (url) => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) {
      return null;
    }
  };

  const videoId = extractVideoId(beatUrl);

  if (!videoId) return null;

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimeInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
      if (digits.length === 0) return '';
      return digits.padStart(1, '0');
    }
    const m = digits.slice(0, digits.length - 2);
    const s = digits.slice(-2);
    return `${parseInt(m)}:${s}`;
  };

  const parseTime = (str) => {
    if (!str || !str.includes(':')) return 0;
    const [m, s] = str.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  };

  const handleApplyLoop = () => {
    setLoopError('');
    const start = parseTime(loopStartInput);
    const end = parseTime(loopEndInput);
    
    if (loopStartInput === '' || loopEndInput === '') {
       setLoopError("Please enter both start and end times.");
       return;
    }
    if (start < 0) {
       setLoopError("Invalid start time.");
       return;
    }
    if (end <= start) {
       setLoopError("End must be after start.");
       return;
    }

    setLoopStart(start);
    setLoopEnd(end);
    setLoopEnabled(true);
  };

  const handleClearLoop = () => {
    setLoopStart(null);
    setLoopEnd(null);
    setLoopEnabled(false);
    setLoopStartInput('');
    setLoopEndInput('');
    setLoopError('');
  };

  return (
    <div className="pt-4 flex flex-col gap-2">
      <div className="relative">
         <iframe
           ref={iframeRef}
           className="w-full h-52 rounded-lg"
           src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
           allowFullScreen
           title="Beat Player"
         />
         {loopEnabled && loopStart !== null && loopEnd !== null && (
           <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
             Looping: {formatTime(loopStart)} → {formatTime(loopEnd)}
           </div>
         )}
      </div>

      {/* Loop UI Controls within the Beat Player area */}
      <div className="flex flex-col gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">Loop</span>
          
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-1">
             <span className="text-gray-500 pl-1">Start [</span>
             <input
               type="text"
               value={loopStartInput}
               onChange={(e) => setLoopStartInput(formatTimeInput(e.target.value))}
               placeholder="0:00"
               className="w-12 text-center bg-transparent outline-none text-gray-900 dark:text-gray-100"
             />
             <span className="text-gray-500 pr-1">]</span>
             <button
                title="Use current time"
                onClick={() => {
                  const t = currentTimeRef.current;
                  setLoopStartInput(formatTime(t));
                  setLoopStart(t);
                }}
                className="text-gray-400 hover:text-blue-500 px-1"
             >
                ⏱
             </button>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-1">
             <span className="text-gray-500 pl-1">End [</span>
             <input
               type="text"
               value={loopEndInput}
               onChange={(e) => setLoopEndInput(formatTimeInput(e.target.value))}
               placeholder="0:00"
               className="w-12 text-center bg-transparent outline-none text-gray-900 dark:text-gray-100"
             />
             <span className="text-gray-500 pr-1">]</span>
             <button
                title="Use current time"
                onClick={() => {
                  const t = currentTimeRef.current;
                  setLoopEndInput(formatTime(t));
                  setLoopEnd(t);
                }}
                className="text-gray-400 hover:text-blue-500 px-1"
             >
                ⏱
             </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={() => {
                 if (loopEnabled) {
                    setLoopEnabled(false);
                 } else {
                    handleApplyLoop();
                 }
              }}
              className={`px-3 py-1 rounded transition-colors font-medium border ${
                loopEnabled 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {loopEnabled ? 'Loop On' : 'Loop Off'}
            </button>
            
            <button 
              onClick={handleClearLoop}
              className="px-3 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        
        {loopError && (
          <div className="text-red-500 text-xs mt-1">{loopError}</div>
        )}
      </div>
    </div>
  );
});

export default BeatPlayer;

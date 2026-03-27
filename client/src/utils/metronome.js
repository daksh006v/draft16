let audioCtx = null;

export function startMetronome(bpm, callback) {
  // Initialize context on first user interaction
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }

  // Fallback for browsers that don't support AudioContext at all
  if (!audioCtx) {
    const interval = (60 / bpm) * 1000;
    if (callback) callback();
    return setInterval(() => {
      if (callback) callback();
    }, interval);
  }

  // Ensure AudioContext is running
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Web Audio API Lookahead Scheduler
  let nextNoteTime = audioCtx.currentTime + 0.05; // slight initial offset
  let beatCount = 0;
  const lookahead = 25.0; // Interval ms for setTimeout/setInterval
  const scheduleAheadTime = 0.1; // How far ahead to schedule audio (seconds)

  function playNote(time, isDownbeat) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // 1. WAVE TYPE
    osc.type = 'sine'; // Soft, musical wave

    // 2. FREQUENCY
    // Downbeat: ~1000 Hz, Normal beat: ~800 Hz
    osc.frequency.setValueAtTime(isDownbeat ? 1000 : 800, time);

    // 3. ENVELOPE (CRITICAL)
    const peakVolume = isDownbeat ? 0.6 : 0.4;
    gainNode.gain.setValueAtTime(0, time);
    // very short attack (~5ms)
    gainNode.gain.linearRampToValueAtTime(peakVolume, time + 0.005);
    // quick decay (~100ms)
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    // 4. ACCENT DOWNBEAT (Already handled by freq and peakVolume)

    osc.start(time);
    osc.stop(time + 0.15); // Clean buffer disposal
  }

  function scheduler() {
    // Schedule all notes up to the horizon
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
      playNote(nextNoteTime, beatCount === 0);
      
      // Advance beat
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTime += secondsPerBeat;
      beatCount = (beatCount + 1) % 4; // 4/4 time signature
    }
  }

  // Boot the scheduler engine
  const timerID = setInterval(scheduler, lookahead);
  scheduler(); // Initial queue

  return timerID;
}

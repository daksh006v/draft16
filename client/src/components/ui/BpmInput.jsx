import { useRef } from 'react';

export default function BpmInput({ bpm, setBpm }) {
  const holdRef = useRef(null);

  const startHold = (dir) => {
    // immediate first step
    setBpm(prev => Math.min(220, Math.max(40, prev + dir)));
    // after 380ms initial delay, fire every 60ms
    holdRef.current = setTimeout(() => {
      holdRef.current = setInterval(() => {
        setBpm(prev => Math.min(220, Math.max(40, prev + dir)));
      }, 60);
    }, 380);
  };

  const stopHold = () => {
    clearTimeout(holdRef.current);
    clearInterval(holdRef.current);
    holdRef.current = null;
  };

  return (
    <div
      className="flex items-center rounded transition-all bpm-wrapper"
      style={{ background: 'var(--bg-main)', border: '1px solid var(--bg-border)', position: 'relative' }}
    >
      <style>{`
        .bpm-wrapper .bpm-spinners {
          width: 0px;
          opacity: 0;
          overflow: hidden;
          transition: width 0.15s ease, opacity 0.15s ease;
        }
        .bpm-wrapper:hover {
          border-color: var(--accent-primary) !important;
          box-shadow: var(--accent-glow) !important;
        }
        .bpm-wrapper:hover .bpm-spinners {
          width: 20px;
          opacity: 1;
        }
        .bpm-spin-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 15px;
          font-size: 8px;
          cursor: pointer;
          user-select: none;
          background: transparent;
          border: none;
          color: var(--text-muted);
          transition: background 0.1s ease, color 0.1s ease;
        }
        .bpm-spin-btn:hover {
          background: var(--bg-hover);
          color: var(--accent-primary);
        }
      `}</style>

      <input
        type="number"
        value={bpm}
        min="40"
        max="220"
        onChange={(e) => {
          const val = Number(e.target.value);
          if (!isNaN(val)) setBpm(Math.min(220, Math.max(40, val)));
        }}
        style={{
          width: '48px',
          padding: '4px',
          textAlign: 'center',
          outline: 'none',
          fontFamily: 'monospace',
          fontSize: '14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-main)',
          appearance: 'textfield',
          MozAppearance: 'textfield',
        }}
      />

      <div
        className="bpm-spinners flex flex-col border-l"
        style={{ borderColor: 'var(--bg-border)' }}
      >
        <button
          className="bpm-spin-btn"
          onMouseDown={() => startHold(1)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          tabIndex={-1}
        >▲</button>
        <div style={{ width: '100%', height: '1px', background: 'var(--bg-border)' }} />
        <button
          className="bpm-spin-btn"
          onMouseDown={() => startHold(-1)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          tabIndex={-1}
        >▼</button>
      </div>
    </div>
  );
}

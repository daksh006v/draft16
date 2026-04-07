import { useEffect, useState } from 'react';

const MESSAGES = [
  { delay: 0,    text: 'Connecting to server...' },
  { delay: 4000, text: 'Server is waking up...' },
  { delay: 9000, text: 'Almost there, hang tight ☕' },
  { delay: 18000,text: 'This takes ~30s on a cold start — almost done!' },
  { delay: 30000,text: 'Still going… won\'t be long now.' },
];

/**
 * Full-screen overlay shown while waiting for the Render server
 * to wake up on a cold start. Keeps users informed so they don't leave.
 *
 * Props:
 *   visible  — boolean, whether to show the overlay
 *   onCancel — called when user clicks "Cancel"
 */
export default function ServerWarmingOverlay({ visible, onCancel }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setMsgIndex(0);
      setElapsed(0);
      return;
    }

    // Tick elapsed seconds
    const ticker = setInterval(() => setElapsed(s => s + 1), 1000);

    // Schedule message transitions
    const timers = MESSAGES.slice(1).map((m, i) =>
      setTimeout(() => setMsgIndex(i + 1), m.delay)
    );

    return () => {
      clearInterval(ticker);
      timers.forEach(clearTimeout);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeInOverlay 0.3s ease',
      }}
    >
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes fadeMsg {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Spinner */}
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 32 }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid var(--bg-border)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spinRing 1s linear infinite',
        }} />
        {/* Inner pulse dot */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          animation: 'pulseDot 1.4s ease-in-out infinite',
        }} />
      </div>

      {/* Message */}
      <p
        key={msgIndex}
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-main)',
          textAlign: 'center',
          maxWidth: 300,
          lineHeight: 1.5,
          animation: 'fadeMsg 0.4s ease',
          marginBottom: 8,
        }}
      >
        {MESSAGES[msgIndex].text}
      </p>

      {/* Elapsed time hint */}
      {elapsed >= 5 && (
        <p style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 28,
          animation: 'fadeMsg 0.4s ease',
        }}>
          {elapsed}s elapsed
        </p>
      )}
      {elapsed < 5 && <div style={{ marginBottom: 28 }} />}

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              animation: `pulseDot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: '4px 8px',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

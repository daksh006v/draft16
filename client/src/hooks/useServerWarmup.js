import { useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://draft16.onrender.com/api';

/**
 * Silently pings the backend health endpoint when the component mounts.
 * This pre-warms the Render free-tier server so the cold start
 * happens in the background rather than blocking the user.
 */
export function useServerWarmup() {
  const pinged = useRef(false);

  useEffect(() => {
    if (pinged.current) return;
    pinged.current = true;

    fetch(`${API_URL}/health`, {
      method: 'GET',
      // Don't wait long — just enough to trigger the wake-up
      signal: AbortSignal.timeout?.(30_000),
    }).catch(() => {
      // Silently ignore — this is a best-effort warmup
    });
  }, []);
}

import { useEffect, useRef } from 'react';

/** Calls `callback` every `intervalMs` while the tab is visible, for near-live group progress. */
export default function usePolling(callback, intervalMs, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') savedCallback.current();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

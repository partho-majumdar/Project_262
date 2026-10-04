import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080/api/v1'
    : '/api/v1'
);

const RealtimeContext = createContext(null);

/**
 * Keeps one server-sent-events connection open for the whole tab and lets any component ask to be
 * told when a topic changes.
 *
 * <p>Why one connection rather than one per page: a user with a dozen tabs open, or a single tab
 * that navigates between the marketplace, their orders and their groups, would otherwise open a
 * dozen long-lived sockets. The server keys deliveries by topic, so a single stream subscribed to
 * everything the tab might need serves them all.
 *
 * <p>The browser reconnects on its own, so a dropped network heals without the user noticing. The
 * only thing this component adds is the topic subscription, which has to be re-sent whenever the
 * set of mounted listeners changes.
 */
export function RealtimeProvider({ children }) {
  const [status, setStatus] = useState('connecting');
  const sourceRef = useRef(null);
  const listenersRef = useRef(new Map()); // topic -> Set of callbacks
  const tokenRef = useRef(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef(null);

  const token = useMemo(() => {
    try {
      return localStorage.getItem('nexus_token');
    } catch {
      return null;
    }
  }, []);

  const notify = useCallback((topic, payload) => {
    const forTopic = listenersRef.current.get(topic);
    if (forTopic) {
      forTopic.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          // A broken listener must not stop the others from being told.
          console.error(`Realtime listener for "${topic}" failed`, error);
        }
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    const topics = Array.from(listenersRef.current.keys());
    const params = new URLSearchParams();
    if (tokenRef.current) {
      params.set('token', tokenRef.current);
    }
    if (topics.length) {
      params.set('topics', topics.join(','));
    }

    const source = new EventSource(`${API_BASE_URL}/realtime/stream?${params.toString()}`);
    sourceRef.current = source;

    source.addEventListener('connected', () => {
      retryRef.current = 0;
      setStatus('live');
    });

    // The server names the event after the topic, so a named listener per topic. A single generic
    // handler would also work, but named listeners are what EventSource reconnects correctly on.
    const knownTopics = new Set([
      'catalogue', 'storefront', 'orders', 'cart', 'group-buy', 'wholesale', 'auction',
      'group-buying-auction', 'reverse-group-buying', 'group-reverse', 'seller-account',
      'notifications', 'support', 'admin',
    ]);
    knownTopics.forEach((topic) => {
      source.addEventListener(topic, (event) => {
        let payload = null;
        try {
          payload = JSON.parse(event.data);
        } catch {
          payload = { topic };
        }
        notify(topic, payload);
      });
    });

    source.onerror = () => {
      // EventSource reconnects on its own, but only if the stream ended cleanly. When the server
      // is gone entirely the readyState goes CLOSED and nothing retries, so we do it ourselves
      // with a growing delay rather than hammering the server in a tight loop.
      if (source.readyState === EventSource.CLOSED) {
        setStatus('offline');
        const delay = Math.min(30_000, 1000 * 2 ** retryRef.current);
        retryRef.current += 1;
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(connect, delay);
      } else {
        setStatus('reconnecting');
      }
    };
  }, [notify]);

  useEffect(() => {
    tokenRef.current = token;
    connect();
    return () => {
      clearTimeout(retryTimerRef.current);
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, [token, connect]);

  // A tab that was hidden has usually had its connection reaped by a proxy. Reopening it on return
  // is what stops "it stopped updating until I clicked something" after coming back to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [connect]);

  const subscribe = useCallback((topics, callback) => {
    const list = Array.isArray(topics) ? topics : [topics];
    const changed = [];

    list.forEach((topic) => {
      const isNewTopic = !listenersRef.current.has(topic);
      if (isNewTopic) {
        listenersRef.current.set(topic, new Set());
      }
      listenersRef.current.get(topic).add(callback);
      if (isNewTopic) {
        changed.push(topic);
      }
    });

    // The server filters what it sends by the topic list on the URL, so a newly wanted topic
    // needs the stream reopened to start arriving.
    if (changed.length) {
      connect();
    }

    return () => {
      list.forEach((topic) => {
        const forTopic = listenersRef.current.get(topic);
        if (!forTopic) return;
        forTopic.delete(callback);
        if (forTopic.size === 0) {
          listenersRef.current.delete(topic);
        }
      });
    };
  }, [connect]);

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}

/**
 * Runs `callback` whenever one of `topics` changes on the server.
 *
 * <p>The callback should refetch whatever the component is showing. A push is deliberately just a
 * nudge - it carries no authoritative data - so the component always renders from the same
 * endpoints, and the same authorisation rules apply as on a normal page load.
 */
export function useRealtime(topics, callback, enabled = true) {
  const { subscribe } = useRealtimeContext();
  const list = Array.isArray(topics) ? topics : [topics];
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !subscribe || list.length === 0) {
      return undefined;
    }
    const handler = (payload) => savedCallback.current(payload);
    return subscribe(list, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, enabled, list.join(',')]);
}

/** Connection health, for a small indicator or for diagnostics. */
export function useRealtimeStatus() {
  const { status } = useRealtimeContext();
  return status;
}

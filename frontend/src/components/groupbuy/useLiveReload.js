import { useCallback, useEffect, useRef } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import usePolling from './usePolling';

/**
 * Keeps a view current without the user ever pressing refresh.
 *
 * <p>Three mechanisms, cheapest first:
 * <ol>
 *   <li><b>Push.</b> The server announces that one of `topics` changed and this reloads at once.
 *       This is what makes a change by another user - or by a deadline sweep - appear immediately.
 *   <li><b>Focus.</b> Coming back to the tab reloads, because a stream that was reaped while the
 *       tab sat in the background may have missed events.
 *   <li><b>Backstop.</b> A slow poll bounds how stale a view can possibly be if the stream is
 *       broken in a way we cannot see. It is deliberately slower than the 5-60s polling this
 *       replaced, because the push has removed the reason for short intervals in the first place.
 * </ol>
 *
 * <p>Reloads are coalesced, so a change that fans out to several members and lands as a burst of
 * events triggers one fetch rather than five.
 */
export default function useLiveReload(topics, callback, options = {}) {
  const { backstopMs = 90_000, enabled = true, debounceMs = 250 } = options;
  const list = Array.isArray(topics) ? topics : [topics];
  const savedCallback = useRef(callback);
  const timerRef = useRef(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const fire = useCallback(() => {
    if (!enabled || pendingRef.current) {
      // A reload is already queued; this event is covered by it.
      return;
    }
    pendingRef.current = true;
    timerRef.current = setTimeout(() => {
      pendingRef.current = false;
      savedCallback.current();
    }, debounceMs);
  }, [enabled, debounceMs]);

  useRealtime(list, fire, enabled);
  usePolling(fire, backstopMs, enabled);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && enabled) {
        savedCallback.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearTimeout(timerRef.current);
    };
  }, [enabled]);
}

/**
 * The topic names a page should listen to, given the resource it is showing. Kept here so the
 * server and client vocabulary cannot drift apart silently.
 */
export const topics = {
  CATALOGUE: 'catalogue',
  STOREFRONT: 'storefront',
  ORDERS: 'orders',
  CART: 'cart',
  GROUP_BUY: 'group-buy',
  WHOLESALE: 'wholesale',
  AUCTION: 'auction',
  GROUP_BUYING_AUCTION: 'group-buying-auction',
  REVERSE_GROUP_BUYING: 'reverse-group-buying',
  GROUP_REVERSE: 'group-reverse',
  SELLER_ACCOUNT: 'seller-account',
  NOTIFICATIONS: 'notifications',
  SUPPORT: 'support',
  ADMIN: 'admin',
};

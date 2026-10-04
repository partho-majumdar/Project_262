import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CreditCard,
  Flame,
  Gavel,
  Megaphone,
  Package,
  Settings,
  ShieldAlert,
  Store,
  Trophy,
  Users,
} from 'lucide-react';
import { notificationApi } from '../../api/notificationApi';
import { timeAgo } from '../groupbuy/format';
import useLiveReload from '../groupbuy/useLiveReload';

// Display order and look for each server-side notification category
const CATEGORY_META = {
  ADMIN: { label: 'Admin alerts', Icon: Gavel, color: 'text-rose-400' },
  GROUP_RESULTS: { label: 'Group buy results', Icon: Trophy, color: 'text-emerald-400' },
  GROUP_ACTIVITY: { label: 'Group buy activity', Icon: Users, color: 'text-nexus-400' },
  DEAL_ALERTS: { label: 'Followed deals', Icon: Flame, color: 'text-amber-400' },
  PAYMENTS: { label: 'Payments & refunds', Icon: CreditCard, color: 'text-teal-400' },
  ORDERS: { label: 'Orders', Icon: Package, color: 'text-blue-400' },
  SELLER: { label: 'Seller campaigns', Icon: Store, color: 'text-indigo-400' },
  PROMOTIONS: { label: 'Promotions', Icon: Megaphone, color: 'text-rose-400' },
  ACCOUNT: { label: 'Account & security', Icon: ShieldAlert, color: 'text-amber-300' },
  OTHER: { label: 'Other', Icon: Bell, color: 'text-slate-400' },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_META);
const metaFor = (category) => CATEGORY_META[category] || CATEGORY_META.OTHER;

/** The bell loads the newest slice; the badge uses the server's own count so it stays right. */
const PAGE_SIZE = 50;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [serverUnread, setServerUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([notificationApi.list(PAGE_SIZE), notificationApi.unreadCount()]);
      setNotifications(Array.isArray(list) ? list : []);
      setServerUnread(Number(count) || 0);
    } catch (err) {
      // A signed-out or expired session is not worth shouting about; the next poll picks it back up
      if (err?.statusCode !== 401 && err?.status !== 401) {
        console.error('Failed to fetch notifications', err);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // A notification pushed by the server refreshes the badge immediately, so a seller is told their
  // application was approved without waiting for the next poll to come round.
  useLiveReload(['notifications'], refresh, { backstopMs: 120000, debounceMs: 150 });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unread in the loaded slice, topped up by anything older the server still counts
  const unreadLoaded = notifications.filter((n) => !n.read).length;
  const unreadCount = Math.max(unreadLoaded, serverUnread);

  // [{ category, items, unread }] in display order, only for categories that have notifications
  const sections = useMemo(() => {
    const byCategory = {};
    notifications.forEach((n) => {
      const key = CATEGORY_META[n.category] ? n.category : 'OTHER';
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(n);
    });
    return CATEGORY_ORDER.filter((key) => byCategory[key]).map((key) => ({
      category: key,
      items: byCategory[key],
      unread: byCategory[key].filter((n) => !n.read).length,
    }));
  }, [notifications]);

  const visibleSections =
    activeCategory === 'ALL' ? sections : sections.filter((s) => s.category === activeCategory);

  const markReadLocally = (predicate) =>
    setNotifications((prev) => {
      let cleared = 0;
      const next = prev.map((n) => {
        if (predicate(n) && !n.read) {
          cleared += 1;
          return { ...n, read: true };
        }
        return n;
      });
      setServerUnread((count) => Math.max(0, count - cleared));
      return next;
    });

  const handleOpen = async (notification) => {
    if (!notification.read) {
      markReadLocally((n) => n.id === notification.id);
      notificationApi.markRead(notification.id).catch((err) => console.error(err));
    }
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const handleMarkAll = async () => {
    try {
      if (activeCategory === 'ALL') {
        await notificationApi.markAllRead();
        markReadLocally(() => true);
        setServerUnread(0); // also clears anything older than the loaded slice
      } else {
        await notificationApi.markCategoryRead(activeCategory);
        markReadLocally((n) => n.category === activeCategory);
        refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) refresh(); // opening should show what arrived since the last poll
  };

  const activeUnread =
    activeCategory === 'ALL' ? unreadCount : sections.find((s) => s.category === activeCategory)?.unread || 0;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all relative"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-rose-600 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-lg shadow-rose-600/50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-4 z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeUnread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-[11px] text-nexus-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark read
                </button>
              )}
              <Link
                to="/settings#notifications"
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white"
                title="Notification settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {sections.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <CategoryChip label="All" count={unreadCount} active={activeCategory === 'ALL'} onClick={() => setActiveCategory('ALL')} />
              {sections.map((s) => (
                <CategoryChip
                  key={s.category}
                  label={metaFor(s.category).label}
                  count={s.unread}
                  active={activeCategory === s.category}
                  onClick={() => setActiveCategory(s.category)}
                />
              ))}
            </div>
          )}

          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {visibleSections.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">You're all caught up.</div>
            ) : (
              visibleSections.map((section) => {
                const { label, Icon, color } = metaFor(section.category);
                return (
                  <section key={section.category} className="space-y-2">
                    {activeCategory === 'ALL' && (
                      <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        <Icon className={`w-3 h-3 ${color}`} /> {label}
                        {section.unread > 0 && <span className="text-nexus-400">· {section.unread} new</span>}
                      </h4>
                    )}
                    {section.items.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => handleOpen(n)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                          !n.read
                            ? 'bg-nexus-950/60 border-nexus-800/80 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{n.title}</span>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-nexus-500 shrink-0" />}
                          </div>
                          <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-500 block" title={new Date(n.createdAt).toLocaleString()}>
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-bold transition ${
        active
          ? 'bg-nexus-600 border-nexus-500 text-white'
          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
      }`}
    >
      {label}
      {count > 0 && <span className={active ? 'text-nexus-100' : 'text-nexus-400'}> {count}</span>}
    </button>
  );
}

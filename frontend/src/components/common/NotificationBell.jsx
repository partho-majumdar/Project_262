import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  Package, 
  Tag, 
  ShieldAlert, 
  ExternalLink,
  X,
  Sparkles
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const fetchNotificationState = async () => {
    try {
      const [countRes, listRes] = await Promise.all([
        axiosClient.get('/notifications/unread-count'),
        axiosClient.get('/notifications'),
      ]);
      setUnreadCount(countRes.data);
      setNotifications(listRes.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotificationState();
    const interval = setInterval(fetchNotificationState, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, link) => {
    try {
      await axiosClient.put(`/notifications/${id}/read`);
      fetchNotificationState();
      if (link) {
        setIsOpen(false);
        navigate(link);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axiosClient.put('/notifications/read-all');
      fetchNotificationState();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all relative"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-lg shadow-rose-600/50">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Center Slide-over Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-panel border border-slate-800 rounded-3xl shadow-2xl p-4 z-50 space-y-3">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold rounded-full">
                  {unreadCount} New
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-nexus-400 hover:underline font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No notification alerts right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id, n.link)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    !n.read
                      ? 'bg-nexus-950/60 border-nexus-800/80 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-nexus-400 shrink-0 mt-0.5">
                    {n.type === 'ORDER_UPDATE' ? <Package className="w-3.5 h-3.5" /> :
                     n.type === 'PROMO' ? <Tag className="w-3.5 h-3.5 text-emerald-400" /> :
                     <Bell className="w-3.5 h-3.5" />}
                  </div>

                  <div className="flex-1 space-y-0.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-nexus-500 shrink-0" />}
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

    </div>
  );
}

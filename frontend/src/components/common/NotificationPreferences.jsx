import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Loader2, Lock } from 'lucide-react';
import { notificationApi } from '../../api/notificationApi';
import { apiErrorMessage } from '../../api/groupBuyApi';
import { useAuth } from '../../context/AuthContext';
import { isSellerApproved } from '../../constants/roles';

/** In-app notification switches per category. Money and security categories are always on. */
export default function NotificationPreferences() {
  const { user } = useAuth();
  const location = useLocation();
  const sectionRef = useRef(null);
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    notificationApi
      .getPreferences()
      .then((list) => setPreferences(Array.isArray(list) ? list : []))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load notification settings.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && location.hash === '#notifications') {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, location.hash]);

  const toggle = async (preference) => {
    const next = !preference.enabled;
    setSavingKey(preference.category);
    setError('');
    setPreferences((prev) => prev.map((p) => (p.category === preference.category ? { ...p, enabled: next } : p)));
    try {
      const updated = await notificationApi.updatePreferences({ [preference.category]: next });
      if (Array.isArray(updated)) setPreferences(updated);
    } catch (err) {
      setPreferences((prev) => prev.map((p) => (p.category === preference.category ? { ...p, enabled: !next } : p)));
      setError(apiErrorMessage(err, 'Could not save that change.'));
    } finally {
      setSavingKey(null);
    }
  };

  // Seller campaign updates only matter to approved sellers
  const visible = preferences.filter((p) => p.category !== 'SELLER' || isSellerApproved(user));

  return (
    <div
      id="notifications"
      ref={sectionRef}
      className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-5 scroll-mt-24"
    >
      <div className="border-b border-slate-800 pb-3 space-y-1">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-nexus-400" /> Notification preferences
        </h3>
        <p className="text-[11px] text-slate-400">
          Choose which alerts appear in your notification bell. Payments, refunds, group buy results and security alerts
          are always sent.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-nexus-500 animate-spin" />
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/80">
          {visible.map((preference) => (
            <li key={preference.category} className="py-3 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  {preference.label}
                  {preference.mandatory && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                      <Lock className="w-3 h-3" /> Always on
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400">{preference.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preference.enabled}
                aria-label={preference.label}
                disabled={preference.mandatory || savingKey === preference.category}
                onClick={() => toggle(preference)}
                className={`relative w-10 h-6 rounded-full shrink-0 transition disabled:cursor-not-allowed ${
                  preference.enabled ? 'bg-nexus-600' : 'bg-slate-700'
                } ${preference.mandatory ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    preference.enabled ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

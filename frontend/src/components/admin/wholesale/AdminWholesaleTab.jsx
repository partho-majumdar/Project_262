import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Gavel, RefreshCw } from 'lucide-react';
import { adminWholesaleApi } from '../../../api/wholesaleApi';
import { listOf } from '../groupbuy/adminUi';
import AdminWholesaleOffersPanel from './AdminWholesaleOffersPanel';
import AdminWholesaleDisputesPanel from './AdminWholesaleDisputesPanel';

const VIEWS = [
  { id: 'offers', label: 'Offers', icon: Layers },
  { id: 'disputes', label: 'Disputes', icon: Gavel, badge: 'openDisputes' },
];

export default function AdminWholesaleTab({ initialView, onViewChange }) {
  const [view, setView] = useState(() => (VIEWS.some((v) => v.id === initialView) ? initialView : 'offers'));
  const [badges, setBadges] = useState({ openDisputes: 0 });

  useEffect(() => {
    setView(VIEWS.some((v) => v.id === initialView) ? initialView : 'offers');
  }, [initialView]);

  const refreshBadges = useCallback(async () => {
    const disputesRes = await adminWholesaleApi.getDisputes('ACTIVE').catch(() => []);
    setBadges({ openDisputes: listOf(disputesRes).length });
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  const changeView = (id) => {
    setView(id);
    onViewChange?.(id);
  };

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Collaborative Wholesale Purchasing</h2>
            <p className="text-xs text-slate-400">
              Sellers create and activate their own offers. Oversee live pools and handle disputes here.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshBadges}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {VIEWS.map(({ id, label, icon: Icon, badge }) => {
            const count = (badge && badges[badge]) || 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeView(id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  view === id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
                {count > 0 && (
                  <span
                    className={`min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                      view === id ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {view === 'offers' && <AdminWholesaleOffersPanel onChanged={refreshBadges} />}
      {view === 'disputes' && <AdminWholesaleDisputesPanel onChanged={refreshBadges} />}
    </div>
  );
}

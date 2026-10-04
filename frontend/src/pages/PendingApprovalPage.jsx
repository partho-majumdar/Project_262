import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  ShieldCheck,
  RefreshCw,
  Mail,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { ROUTES } from '../constants/roles';

export default function PendingApprovalPage() {
  const { user, refreshUser, logout, isAdmin } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadApplication = async () => {
    try {
      const res = await axiosClient.get('/auth/seller/application');
      setApplication(res.data || res);
    } catch (err) {
      console.error('Failed to load seller application', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      await loadApplication();
    } finally {
      setRefreshing(false);
    }
  };

  const submittedAt = application?.submittedAt
    ? new Date(application.submittedAt).toLocaleString()
    : null;

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Merchant Onboarding
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <Clock className="w-7 h-7 text-amber-400" /> Application Under Review
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Thanks for applying to become a GroupMart merchant. An administrator is reviewing
            your store details. You will receive an email at <span className="text-nexus-400 font-semibold">{user?.email}</span>{' '}
            as soon as your application is approved.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading application status...
            </div>
          ) : application ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium">Store Name</span>
                  <p className="text-slate-100 font-semibold">{application.store?.storeName || '—'}</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium">Tax ID</span>
                  <p className="text-slate-100 font-semibold">{application.store?.taxId || '—'}</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium">Submitted</span>
                  <p className="text-slate-100 font-semibold">{submittedAt || 'Pending'}</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium">Status</span>
                  <p className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pending Review
                  </p>
                </div>
              </div>

              {application.store?.description && (
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1 text-xs">
                  <span className="text-slate-500 font-medium block">Store Description</span>
                  <p className="text-slate-200 leading-relaxed">{application.store.description}</p>
                </div>
              )}

              <div className="space-y-2 text-xs text-slate-300">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Identity verified
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Business documents uploaded
                </p>
                <p className="flex items-center gap-2 text-amber-300">
                  <Clock className="w-4 h-4" /> Administrator approval (usually within 24–48 business hours)
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center">No active application found.</p>
          )}

          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-nexus-500 text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh status
            </button>
            <div className="flex items-center gap-2">
              <Link
                to={ROUTES.HOME}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-nexus-500 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to storefront
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-950 border border-rose-800 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-semibold transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
          <ShieldCheck className="w-5 h-5 text-nexus-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white">What happens next?</p>
            <p className="text-slate-400 leading-relaxed">
              Once your application is approved you will be granted the seller role and can open
              your merchant store, list products, manage inventory and start receiving orders
              from customers.
            </p>
          </div>
        </div>

        {!isAdmin && (
          <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <Mail className="w-3 h-3" /> Need help? Reach our team at merchants@groupmart.com
          </p>
        )}
      </div>
    </div>
  );
}

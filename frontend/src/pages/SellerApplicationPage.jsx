import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  Building,
  FileText,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  LogIn,
  UserPlus,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { ROUTES, SellerStatus } from '../constants/roles';

const emptyForm = {
  storeName: '',
  description: '',
  logoUrl: '',
  bannerUrl: '',
  taxId: '',
  bankAccount: '',
  bankName: '',
};

export default function SellerApplicationPage() {
  const { user, refreshUser, isAuthenticated, isSellerApproved, sellerStatus } = useAuth();
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      // Try to restore a draft saved by the guest flow
      try {
        const raw = sessionStorage.getItem('nexus_pending_seller_application');
        if (raw) {
          const draft = JSON.parse(raw);
          setFormData((prev) => ({ ...prev, ...draft }));
          sessionStorage.removeItem('nexus_pending_seller_application');
          setError('Welcome back! Your saved application draft has been restored. Sign in to submit it.');
        }
      } catch {
        // ignore
      }
      setLoadingStatus(false);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const res = await axiosClient.get('/auth/seller/application');
        const app = res.data || res;
        if (!active) return;
        if (app?.sellerStatus === SellerStatus.PENDING) {
          navigate(ROUTES.SELLER_PENDING, { replace: true });
          return;
        }
        if (app?.store) {
          setFormData({
            storeName: app.store.storeName || '',
            description: app.store.description || '',
            logoUrl: app.store.logoUrl || '',
            bannerUrl: app.store.bannerUrl || '',
            taxId: app.store.taxId || '',
            bankAccount: app.store.bankAccount || '',
            bankName: app.store.bankName || '',
          });
        }
        if (app?.sellerStatus === SellerStatus.REJECTED) {
          setError(`Your previous application was rejected. Reason: ${app.sellerStatusReason || 'Not provided'}. Please review and resubmit below.`);
        }
      } catch (err) {
        if (!active) return;
        // 404 means no application — that's fine
      } finally {
        if (active) setLoadingStatus(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [navigate, isAuthenticated]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (!formData.storeName.trim() || !formData.description.trim() || !formData.taxId.trim()) {
      setError('Store name, description, and tax ID are required.');
      return;
    }

    if (!isAuthenticated) {
      // Guest flow: persist the form to sessionStorage so it's restored after sign-in.
      try {
        sessionStorage.setItem('nexus_pending_seller_application', JSON.stringify(formData));
      } catch {
        // sessionStorage may be unavailable — silently ignore
      }
      navigate(ROUTES.LOGIN, {
        state: {
          from: { pathname: ROUTES.SELLER_APPLY },
          message: 'Sign in or create an account to submit your seller application. Your draft has been saved.',
        },
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        storeName: formData.storeName.trim(),
        description: formData.description.trim(),
        taxId: formData.taxId.trim(),
        logoUrl: formData.logoUrl.trim() || null,
        bannerUrl: formData.bannerUrl.trim() || null,
        bankAccount: formData.bankAccount.trim() || null,
        bankName: formData.bankName.trim() || null,
      };
      const res = await axiosClient.post('/auth/seller/apply', payload);
      const created = res.data || res;
      setSuccess(created);
      await refreshUser();
      navigate(ROUTES.SELLER_PENDING, { replace: true });
    } catch (err) {
      setError(err?.message || 'Failed to submit seller application');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSellerApproved) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">You are already an approved merchant</h2>
          <p className="text-xs text-slate-400">Head to your seller dashboard to manage your store.</p>
        </div>
        <Link
          to={ROUTES.SELLER_DASHBOARD}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          <Store className="w-4 h-4" /> Open seller dashboard
        </Link>
      </div>
    );
  }

  if (loadingStatus) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Merchant Onboarding
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Apply to Sell on GroupMart</h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Submit a seller application. Once an administrator approves your store, your role will
          be upgraded to <span className="text-emerald-400 font-semibold">merchant seller</span> and you
          will be able to open your storefront and manage inventory.
        </p>
        {isAuthenticated ? (
          <p className="text-[11px] text-slate-500">
            Signed in as <span className="text-slate-300 font-semibold">{user?.email}</span>
            {sellerStatus === SellerStatus.REJECTED && (
              <span className="ml-2 text-rose-300">(previous application rejected — please resubmit)</span>
            )}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500">
            Not signed in?{' '}
            <Link to={ROUTES.LOGIN} state={{ from: { pathname: ROUTES.SELLER_APPLY } }} className="text-nexus-300 hover:text-white font-semibold">
              Sign in
            </Link>{' '}
            or{' '}
            <Link to={ROUTES.REGISTER} className="text-nexus-300 hover:text-white font-semibold">
              create an account
            </Link>{' '}
            first — your draft will be saved.
          </p>
        )}
      </div>

      {success && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Application submitted successfully! Redirecting to status page...</span>
        </div>
      )}

      <div className="glass-panel p-6 sm:p-10 rounded-3xl space-y-6 border border-slate-800">
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Store Name</label>
            <div className="relative">
              <input
                type="text"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                placeholder="Apex Technologies Store"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
                required
              />
              <Store className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Store Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe your brand, product lineup, and merchant mission..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tax ID / Business Registration Number</label>
            <div className="relative">
              <input
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                placeholder="TAX-994827-US"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
                required
              />
              <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Logo Image URL (Optional)</label>
              <div className="relative">
                <input
                  type="url"
                  name="logoUrl"
                  value={formData.logoUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
                />
                <ImageIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Banner Image URL (Optional)</label>
              <div className="relative">
                <input
                  type="url"
                  name="bannerUrl"
                  value={formData.bannerUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
                />
                <ImageIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Bank Account (Optional)</label>
              <input
                type="text"
                name="bankAccount"
                value={formData.bankAccount}
                onChange={handleChange}
                placeholder="Account number"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Bank Name (Optional)</label>
              <input
                type="text"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                placeholder="Bank name"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <Link
              to={ROUTES.HOME}
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" /> Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {submitting
                ? 'Submitting Application...'
                : isAuthenticated
                  ? 'Submit Seller Application'
                  : 'Continue & Sign In'}
              {isAuthenticated ? <FileText className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

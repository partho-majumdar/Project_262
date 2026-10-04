import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  User,
  Mail,
  Lock,
  Phone,
  FileText,
  Building,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { ROUTES, SellerStatus } from '../constants/roles';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  storeName: '',
  description: '',
  logoUrl: '',
  bannerUrl: '',
  taxId: '',
  bankAccount: '',
  bankName: '',
};

export default function SellerDirectRegistrationPage() {
  const { registerSeller, user } = useAuth();
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password || !formData.storeName.trim() || !formData.description.trim() || !formData.taxId.trim()) {
      setError('Please fill in all required fields including store details.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim() || null,
        application: {
          storeName: formData.storeName.trim(),
          description: formData.description.trim(),
          taxId: formData.taxId.trim(),
          logoUrl: formData.logoUrl.trim() || null,
          bannerUrl: formData.bannerUrl.trim() || null,
          bankAccount: formData.bankAccount.trim() || null,
          bankName: formData.bankName.trim() || null,
        },
      };
      const loggedUser = await registerSeller(payload);
      if (loggedUser?.sellerStatus === SellerStatus.PENDING) {
        navigate(ROUTES.SELLER_PENDING, { replace: true });
      } else {
        navigate(ROUTES.SELLER_DASHBOARD, { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Failed to register seller account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Direct Seller Registration
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Become a Seller</h1>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            Create your seller account and submit your store application in one step. An administrator will review and approve your store.
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-10 rounded-3xl space-y-6 border border-slate-800">
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Last Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  required
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Phone Number (Optional)</label>
                <div className="relative">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+88 (555) 000-0000"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" /> Store Details
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Store Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="storeName"
                      value={formData.storeName}
                      onChange={handleChange}
                      placeholder="Apex Technologies Store"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <Link
                to={ROUTES.LOGIN}
                className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <span>Creating Seller Account...</span>
                ) : (
                  <>
                    <Store className="w-4 h-4" /> Register as Seller
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

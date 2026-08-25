import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Building, FileText, Image, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function SellerRegistrationPage() {
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    taxId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.storeName || !formData.description || !formData.taxId) {
      setError('Please fill in all required merchant store fields');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/seller/store', formData);
      alert('Seller Store created successfully! Welcome to the merchant portal.');
      window.location.href = '/seller/dashboard';
    } catch (err) {
      setError(err.message || 'Failed to register seller store');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Merchant Onboarding
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Register Your Seller Store</h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Become a verified merchant on GroupMart AI. Manage products, analyze revenue reports, and automate inventory with AI.
        </p>
      </div>

      {/* Form Card */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl space-y-6">
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
                <Image className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                <Image className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-nexus-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating Merchant Account...' : 'Launch Merchant Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

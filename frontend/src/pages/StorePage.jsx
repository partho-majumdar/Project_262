import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, ShieldCheck, Star, Package, ShoppingBag, ArrowLeft } from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function StorePage() {
  const { slug } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStore = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get(`/stores/${slug}`);
        setStore(response.data);
      } catch (err) {
        setError(err.message || 'Storefront not found');
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading storefront...
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Storefront not found'}
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Store Banner & Info */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800">
        <div className="h-48 bg-slate-900 relative">
          <img
            src={store.bannerUrl || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&auto=format&fit=crop'}
            alt={store.storeName}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        </div>

        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative -mt-16 z-10">
          <div className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-white shadow-xl">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-12 h-12 text-nexus-400" />
            )}
          </div>

          <div className="space-y-2 text-center sm:text-left flex-grow">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{store.storeName}</h1>
              {store.verified && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 inline-flex items-center gap-1 w-fit mx-auto sm:mx-0">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified Merchant
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              {store.description || 'Welcome to our official GroupMart AI merchant storefront.'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Star className="w-4 h-4 fill-amber-400" /> {store.rating ? store.rating.toFixed(1) : '5.0'} Store Rating
              </span>
              <span>•</span>
              <span>{store.totalSales} Sales Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Store Products Showcase Placeholder */}
      <div className="glass-card p-12 rounded-3xl text-center space-y-4 border border-slate-800">
        <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-lg font-bold text-white">Merchant Products Showcase</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Listed items for <strong>{store.storeName}</strong> will be dynamically queried and displayed in Phase 8 (Product Module).
        </p>
      </div>

    </div>
  );
}

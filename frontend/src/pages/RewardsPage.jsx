import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Percent, 
  Copy, 
  Award,
  DollarSign
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function RewardsPage() {
  const [couponsData, setCouponsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promoInput, setPromoInput] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    const fetchRewards = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get('/coupons');
        setCouponsData(response.data?.data || response.data);
      } catch (err) {
        console.error('Failed to fetch coupons', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, []);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    try {
      await axiosClient.post(`/coupons/validate?code=${encodeURIComponent(promoInput.trim())}`);
      alert(`Promo code '${promoInput.toUpperCase()}' successfully redeemed & added to your account!`);
      setPromoInput('');
    } catch (err) {
      alert('Invalid or expired promotional code.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <Gift className="w-3.5 h-3.5 text-amber-400" /> Customer Loyalty & Rewards Hub
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Coupons, Rewards & <span className="text-nexus-400">Cashback Perks</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300">
          Redeem loyalty points, claim exclusive merchant coupons, and enjoy automatic discount perks at checkout.
        </p>
      </div>

      {/* Rewards Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold">
            <span>REWARD POINTS BALANCE</span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-white font-mono">{couponsData?.rewardPoints || 1450} <span className="text-xs text-amber-400">PTS</span></p>
          <span className="text-[11px] text-slate-400 block font-mono">Equivalent Value: $14.50 Off</span>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold">
            <span>MEMBERSHIP TIER</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400">{couponsData?.membershipTier || 'Platinum Member'}</p>
          <span className="text-[11px] text-slate-400 block">5% Extra Auto-Cashback Active</span>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold">
            <span>LIFETIME CASHBACK</span>
            <DollarSign className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-extrabold text-white font-mono">${couponsData?.cashbackEarned ? couponsData.cashbackEarned.toFixed(2) : '128.50'}</p>
          <span className="text-[11px] text-slate-400 block">Credited directly to wallet</span>
        </div>

      </div>

      {/* Redeem Promo Code Bar */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-3">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Redeem Gift Card or Promo Code</h3>
        <form onSubmit={handleRedeemCode} className="flex gap-3">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="Enter code (e.g. NEXUS15, WELCOME50)..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-nexus-500 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 uppercase font-mono"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-nexus-600/30"
          >
            Redeem Code
          </button>
        </form>
      </div>

      {/* Available Coupons Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1">Available Promo Coupons</h3>
        
        {loading ? (
          <div className="glass-card p-8 rounded-3xl text-center space-y-2 animate-pulse">
            <Gift className="w-6 h-6 text-nexus-500 mx-auto animate-spin" />
            <p className="text-xs text-slate-400">Loading coupons...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {couponsData?.availableCoupons?.map((coupon) => (
              <div key={coupon.id} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4 hover:border-slate-700 transition flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 bg-nexus-950 border border-nexus-800 text-nexus-300 font-mono font-extrabold text-xs rounded-xl">
                      {coupon.code}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Valid for 30 days
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white pt-1">{coupon.description}</h4>
                  <p className="text-[11px] text-slate-400">Min Spend: ${coupon.minSpend ? coupon.minSpend.toFixed(2) : '0.00'}</p>
                </div>

                <button
                  onClick={() => handleCopyCode(coupon.code)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  {copiedCode === coupon.code ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-nexus-400" />}
                  {copiedCode === coupon.code ? 'Code Copied!' : 'Copy Promo Code'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

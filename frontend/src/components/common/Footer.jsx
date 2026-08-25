import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ShoppingBag, 
  ShieldCheck, 
  Send, 
  CreditCard, 
  Truck, 
  RefreshCw, 
  Headphones,
  CheckCircle2,
  Store,
  Lock
} from 'lucide-react';

export default function Footer() {
  const { isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-xs">
      
      {/* Newsletter Bar */}
      <div className="border-b border-slate-900 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-base font-extrabold text-white">Subscribe to NexusVIP Offers</h3>
            <p className="text-slate-400">Get $20 discount code on your first order + early access to flash deals.</p>
          </div>

          <form onSubmit={handleSubscribe} className="flex items-center gap-2 w-full max-w-md">
            {subscribed ? (
              <div className="w-full py-2.5 px-4 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Subscribed! Use code: WELCOME10
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-nexus-500"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold rounded-xl shrink-0 flex items-center gap-1.5 shadow-md shadow-nexus-600/30"
                >
                  <Send className="w-3.5 h-3.5" /> Join VIP
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          
          {/* Brand Info */}
          <div className="space-y-4 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-nexus-600 flex items-center justify-center text-white font-black text-sm">
                N
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">GroupMart X</span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-sm">
              Powering the Future of Digital Commerce. Shop smarter with AI discovery, trusted sellers, and instant checkout.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-full w-fit font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Verified Merchant Quality
            </div>
          </div>

          {/* Quick Shopping Links */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm">Shop Catalog</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/products?category=laptops-computers" className="hover:text-nexus-400 transition">Laptops & PCs</Link></li>
              <li><Link to="/products?category=smartphones-tablets" className="hover:text-nexus-400 transition">Smartphones</Link></li>
              <li><Link to="/products?category=audio-headphones" className="hover:text-nexus-400 transition">Audio & Headphones</Link></li>
              <li><Link to="/products?category=smart-watches-wearables" className="hover:text-nexus-400 transition">Smart Watches</Link></li>
              <li><Link to="/products?category=ai-gaming-gear" className="hover:text-nexus-400 transition">AI & Gaming Gear</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm">Customer Care</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/orders" className="hover:text-nexus-400 transition">Order History & Tracking</Link></li>
              <li><Link to="/cart" className="hover:text-nexus-400 transition">Shopping Cart</Link></li>
              <li><Link to="/wishlist" className="hover:text-nexus-400 transition">Saved Wishlist</Link></li>
              <li><a href="#" className="hover:text-nexus-400 transition">Shipping & Delivery Policy</a></li>
              <li><a href="#" className="hover:text-nexus-400 transition">Returns & Warranty</a></li>
            </ul>
          </div>

          {/* Merchant & Enterprise Governance */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm">Enterprise Portals</h4>
            <ul className="space-y-2 text-slate-400">
              {isAuthenticated && (user?.role === 'ROLE_SELLER' || user?.role === 'ROLE_ADMIN') && (
                <li>
                  <Link to="/seller/dashboard" className="hover:text-emerald-400 font-semibold transition flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-400" /> Seller Central Hub
                  </Link>
                </li>
              )}
              {isAuthenticated && user?.role === 'ROLE_ADMIN' && (
                <li>
                  <Link to="/admin/dashboard" className="hover:text-rose-400 font-semibold transition flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-400" /> Executive Admin Portal
                  </Link>
                </li>
              )}
              <li><a href="#" className="hover:text-nexus-400 transition">Bulk CSV Inventory Upload</a></li>
              <li><a href="#" className="hover:text-nexus-400 transition">Merchant Verification Standard</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
          <p>© 2026 GroupMart AI. All rights reserved. Built for Global E-Commerce Excellence.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-400">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400">Terms of Service</a>
            <a href="#" className="hover:text-slate-400">Security Standards</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

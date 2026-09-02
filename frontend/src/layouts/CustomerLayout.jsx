import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import FloatingAiWidget from '../components/common/FloatingAiWidget';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Layers, 
  ShoppingBag, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Heart, 
  ShoppingCart, 
  Package, 
  Truck, 
  History, 
  Bookmark, 
  Scale, 
  Tag, 
  Gift, 
  Headphones, 
  Settings, 
  LogOut, 
  ShieldCheck 
} from 'lucide-react';

export default function CustomerLayout() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-nexus-500 selection:text-white">
      
      {/* Minimal Top Navigation Header */}
      <Header />

      {/* Main Container */}
      <div className="flex-grow flex max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        
        {/* Left Customer Navigation Sidebar (When Authenticated) */}
        {isAuthenticated && (
          <aside className="w-64 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shrink-0 hidden lg:flex flex-col justify-between self-start sticky top-20 max-h-[85vh] overflow-y-auto space-y-6">
            <div className="space-y-4">
              
              {/* User Avatar Mini Profile */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-nexus-600/30 border border-nexus-500/50 flex items-center justify-center text-nexus-300 font-extrabold text-sm shrink-0">
                  {user?.firstName ? user.firstName.charAt(0) : 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user?.firstName} {user?.lastName}</p>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Platinum Member
                  </span>
                </div>
              </div>

              {/* AUTHENTICATED SIDEBAR NAVIGATION (NO NOTIFICATIONS, NO HOME BUTTON) */}
              <nav className="space-y-1 text-xs font-semibold text-slate-400">
                
                {/* Core Navigation */}
                <span className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block pt-1">Core Dashboard</span>

                <NavLink to="/customer/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl transition ${isActive ? 'bg-nexus-600 text-white font-bold' : 'hover:text-white hover:bg-slate-800/60'}`}>
                  <LayoutDashboard className="w-4 h-4 text-nexus-400" /> Dashboard
                </NavLink>

                <NavLink to="/categories" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                  <Layers className="w-4 h-4 text-purple-400" /> Categories
                </NavLink>

                <NavLink to="/products" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" /> Products
                </NavLink>

                <NavLink to="/products?tag=deals" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                  <Flame className="w-4 h-4 text-amber-400" /> Today's Deals
                </NavLink>

                <NavLink to="/products?tag=new" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                  <Sparkles className="w-4 h-4 text-rose-400" /> New Arrivals
                </NavLink>

                <NavLink to="/products?tag=trending" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                  <TrendingUp className="w-4 h-4 text-teal-400" /> Trending Products
                </NavLink>

                <NavLink to="/ai-assistant" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                  <Sparkles className="w-4 h-4 text-amber-400" /> AI Recommendations
                </NavLink>

                {/* Shopping & Order Hub */}
                <div className="pt-3 border-t border-slate-800/80 space-y-1">
                  <span className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Shopping Hub</span>

                  <NavLink to="/wishlist" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Heart className="w-4 h-4 text-rose-400" /> Wishlist
                  </NavLink>

                  <NavLink to="/cart" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <ShoppingCart className="w-4 h-4 text-indigo-400" /> Shopping Cart
                  </NavLink>

                  <NavLink to="/orders" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Package className="w-4 h-4 text-blue-400" /> Orders
                  </NavLink>

                  <NavLink to="/orders/tracking" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Truck className="w-4 h-4 text-emerald-400" /> Order Tracking
                  </NavLink>

                  <NavLink to="/orders/history" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <History className="w-4 h-4 text-cyan-400" /> Purchase History
                  </NavLink>

                  <NavLink to="/products" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Scale className="w-4 h-4 text-purple-400" /> Compare Products
                  </NavLink>

                  <NavLink to="/coupons" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Tag className="w-4 h-4 text-rose-400" /> Coupons & Rewards
                  </NavLink>
                </div>

                {/* Account & Support */}
                <div className="pt-3 border-t border-slate-800/80 space-y-1">
                  <span className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Account & Support</span>

                  <NavLink to="/customer/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Headphones className="w-4 h-4 text-emerald-400" /> Customer Support
                  </NavLink>

                  <NavLink to="/ai-assistant" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Sparkles className="w-4 h-4 text-amber-400" /> AI Assistant
                  </NavLink>

                  <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Settings className="w-4 h-4 text-slate-400" /> Settings
                  </NavLink>
                </div>

              </nav>

            </div>

            {/* Logout CTA */}
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-950 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

      </div>

      {/* Floating Multimodal AI Assistant Widget */}
      <FloatingAiWidget />

      {/* Footer */}
      <Footer />
    </div>
  );
}

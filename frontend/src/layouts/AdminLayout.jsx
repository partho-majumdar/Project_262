import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Users, 
  Store, 
  BarChart3, 
  Activity, 
  Tag, 
  LogOut, 
  ArrowLeft, 
  Lock,
  Cpu
} from 'lucide-react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex selection:bg-rose-500 selection:text-white">
      
      {/* Left Admin Security Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="p-6 space-y-6">
          
          {/* Executive Security Header */}
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-rose-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight block">Executive Admin</span>
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Security Command</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition ${
                  isActive ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" /> Executive Dashboard
            </NavLink>

            <div className="pt-4 border-t border-slate-800 space-y-1">
              <span className="px-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Platform Operations</span>
              
              <Link
                to="/"
                className="flex items-center gap-3 px-3.5 py-2.5 text-slate-400 hover:text-nexus-400 hover:bg-slate-800/60 rounded-xl font-bold transition"
              >
                <ArrowLeft className="w-4 h-4" /> Customer Marketplace
              </Link>
            </div>
          </nav>

        </div>

        {/* Sidebar Admin Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-xs">
              {user?.firstName ? user.firstName.charAt(0) : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3" /> System Superadmin
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full py-2 bg-slate-900 hover:bg-rose-950 hover:text-rose-300 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Admin Portal Body */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Admin Header Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> System Command Center
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-nexus-400" /> Customer Storefront
            </Link>

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-400 rounded-xl"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

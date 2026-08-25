import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, LogIn, Sparkles, AlertCircle, ShieldCheck, Store, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectMessage = location.state?.message;
  const from = location.state?.from?.pathname || '/customer/dashboard';

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const userRole = user?.role;
      if (userRole === 'ROLE_ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else if (userRole === 'ROLE_SELLER') {
        navigate('/seller/dashboard', { replace: true });
      } else {
        navigate('/customer/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await login({ email, password });
      const userRole = loggedUser?.role || loggedUser?.user?.role;

      if (userRole === 'ROLE_ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else if (userRole === 'ROLE_SELLER') {
        navigate('/seller/dashboard', { replace: true });
      } else {
        const destination = (from && from !== '/' && from !== '/login') ? from : '/customer/dashboard';
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Secure Authentication
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
          <p className="text-xs text-slate-400">Sign in to access your GroupMart account & AI tools</p>
        </div>

        {/* Redirect Notice Message */}
        {redirectMessage && !error && (
          <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-semibold shadow-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{redirectMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-semibold shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Autofill Chips */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">Instant Demo Sign In</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('customer@groupmart.com', 'Customer@12345')}
              className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white transition flex flex-col items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-nexus-400" /> Customer
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('seller@groupmart.com', 'Seller@12345')}
              className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white transition flex flex-col items-center gap-1"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" /> Seller
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@groupmart.com', 'Admin@12345')}
              className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white transition flex flex-col items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Admin
            </button>
          </div>
        </div>

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@groupmart.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300">Password</label>
              <Link to="/forgot-password" className="text-[11px] font-semibold text-nexus-400 hover:text-nexus-300">Forgot?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-nexus-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In to GroupMart
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-nexus-400 hover:text-nexus-300">
            Create Account
          </Link>
        </p>

      </div>
    </div>
  );
}

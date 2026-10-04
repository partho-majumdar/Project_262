import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, LogIn, Sparkles, AlertCircle, User, Shield, Store } from 'lucide-react';
import { dashboardRouteForRole, isAdmin } from '../constants/roles';
import { Roles } from '../constants/roles';
import { useAuthBrand } from '../context/AuthBrandContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState(Roles.CUSTOMER);

  const { login, isAuthenticated, user, loading } = useAuth();
  const { setBrand } = useAuthBrand();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectMessage = location.state?.message;
  const from = location.state?.from?.pathname;

  // The public shell renders its navbar from this brand, so the seller and admin tabs get their
  // own portal header. It resets on exit so a later visit starts on the customer marketplace again.
  useEffect(() => {
    setBrand(selectedRole);
    return () => setBrand(Roles.CUSTOMER);
  }, [selectedRole, setBrand]);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(dashboardRouteForRole(user), { replace: true });
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
      const safeFrom = from && from !== '/' && from !== '/login' && !from.startsWith('/login');
      // An admin has their own portal, so a `from` pointing back into the customer storefront is
      // never where they want to resume - send them straight to the dashboard instead.
      const destination = isAdmin(loggedUser)
        ? dashboardRouteForRole(loggedUser)
        : safeFrom ? from : dashboardRouteForRole(loggedUser);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleConfig = {
    [Roles.CUSTOMER]: {
      label: 'Customer',
      icon: User,
      buttonText: 'Sign In as Customer',
      description: 'Sign in to shop the marketplace',
      gradient: 'from-nexus-600 to-indigo-600',
      hoverGradient: 'from-nexus-500 to-indigo-500',
    },
    [Roles.SELLER]: {
      label: 'Seller',
      icon: Store,
      buttonText: 'Sign In as Seller',
      description: 'Sign in to manage your store',
      gradient: 'from-emerald-600 to-teal-600',
      hoverGradient: 'from-emerald-500 to-teal-500',
    },
    [Roles.ADMIN]: {
      label: 'Admin',
      icon: Shield,
      buttonText: 'Sign In as Admin',
      description: 'Sign in to access admin panel',
      gradient: 'from-amber-600 to-orange-600',
      hoverGradient: 'from-amber-500 to-orange-500',
    },
  };

  const currentRole = roleConfig[selectedRole];
  const RoleIcon = currentRole.icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Secure Authentication
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
          <p className="text-xs text-slate-400">Select your account type and sign in</p>
        </div>

        <div className="flex rounded-2xl bg-slate-900/80 border border-slate-800 p-1 gap-1">
          {Object.values(Roles).map((role) => {
            const config = roleConfig[role];
            const Icon = config.icon;
            const isActive = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-lg border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {config.label}
              </button>
            );
          })}
        </div>

        {redirectMessage && !error && (
          <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-semibold shadow-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{redirectMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-semibold shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
            className={`w-full py-3 bg-gradient-to-r ${currentRole.gradient} hover:${currentRole.hoverGradient} text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50`}
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <RoleIcon className="w-4 h-4" /> {currentRole.buttonText}
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 space-y-1">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-nexus-400 hover:text-nexus-300">
              Create Account
            </Link>
          </p>
          <p>
            Want to sell on GroupMart?{' '}
            <Link to="/seller/register" className="font-bold text-emerald-400 hover:text-emerald-300">
              Register as Seller
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Phone, UserPlus, Sparkles, AlertCircle } from 'lucide-react';
import { Roles, ROUTES } from '../constants/roles';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await register({ ...formData, role: Roles.CUSTOMER });
      navigate(ROUTES.CUSTOMER_DASHBOARD);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Join GroupMart AI
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Your Account</h1>
          <p className="text-xs text-slate-400">
            Sign up as a customer to shop the marketplace. Want to sell?{' '}
            <Link to={ROUTES.SELLER_REGISTER} className="text-emerald-400 hover:text-emerald-300 font-semibold">
              Register as a seller directly
            </Link>
            .
          </p>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl">
          {error && (
            <div className="mb-6 p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500 transition-all"
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
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500 transition-all"
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
                  placeholder="john.doe@example.com"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500 transition-all"
                  required
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Phone Number (Optional)</label>
              <div className="relative">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+88 (555) 000-0000"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500 transition-all"
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
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500 transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-nexus-600/30 transition-all duration-200 disabled:opacity-50"
            >
              {submitting ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Create Customer Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4 space-y-1">
            <p>
              Already registered?{' '}
              <Link to={ROUTES.LOGIN} className="text-nexus-400 font-semibold hover:underline">
                Sign In to Your Account
              </Link>
            </p>
            <p>
              Want to sell on GroupMart?{' '}
              <Link to={ROUTES.SELLER_REGISTER} className="text-emerald-400 font-semibold hover:underline">
                Register as a seller
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

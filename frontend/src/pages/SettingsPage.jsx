import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  Lock, 
  ShieldCheck, 
  Bell, 
  Globe, 
  Moon, 
  Sun, 
  MapPin, 
  CreditCard, 
  Trash2, 
  LogOut, 
  CheckCircle2, 
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || 'John');
  const [lastName, setLastName] = useState(user?.lastName || 'Doe');
  const [email, setEmail] = useState(user?.email || 'customer@groupmart.com');
  const [phone, setPhone] = useState(user?.phone || '+88 (555) 234-5678');

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);

  // Preferences
  const [language, setLanguage] = useState('en-US');
  const [currency, setCurrency] = useState('USD');
  const [themeMode, setThemeMode] = useState('dark');
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [saved, setSaved] = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      alert('Please fill in password fields.');
      return;
    }
    alert('Security credentials updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleDeleteAccount = () => {
    if (window.confirm('WARNING: Are you sure you want to delete your GroupMart account? This action is permanent.')) {
      alert('Account deletion request submitted. Signing out...');
      logout();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <Settings className="w-3.5 h-3.5 text-nexus-400" /> Account Governance & Preferences
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Account <span className="text-nexus-400">Settings & Security</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300">
          Manage personal credentials, security keys, 2FA authentication, payment methods, and portal preferences.
        </p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-bold shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Account settings saved successfully.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Personal Information & Preferences */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Form */}
          <form onSubmit={handleSaveProfile} className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <User className="w-4 h-4 text-indigo-400" /> Personal Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-nexus-600/30"
            >
              Save Profile Changes
            </button>
          </form>

          {/* Preferences */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Globe className="w-4 h-4 text-blue-400" /> Language, Currency & Theme
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Theme Mode</label>
                <select
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="dark">Enterprise Dark Mode</option>
                  <option value="light">Light Mode</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">Email Order Notifications</p>
                <p className="text-[11px] text-slate-400">Receive tracking updates and invoice receipts via email</p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 accent-nexus-600 rounded"
              />
            </div>
          </div>

        </div>

        {/* Right Column: Security, 2FA, Danger Zone */}
        <div className="space-y-8">
          
          {/* Security & Password */}
          <form onSubmit={handleChangePassword} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-amber-400" /> Security Settings
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Update Password
            </button>
          </form>

          {/* 2FA Card */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Two-Factor Auth (2FA)</h4>
                  <p className="text-[10px] text-slate-400">Authenticator app verification</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={twoFactor}
                onChange={(e) => setTwoFactor(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="glass-card p-6 rounded-3xl border border-rose-950/80 bg-rose-950/10 space-y-4">
            <h4 className="text-xs font-extrabold text-rose-400 uppercase tracking-wider">Account Governance</h4>
            <div className="space-y-2">
              <button
                onClick={logout}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" /> Sign Out
              </button>

              <button
                onClick={handleDeleteAccount}
                className="w-full py-2.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete Account
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

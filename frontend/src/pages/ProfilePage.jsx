import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, ShieldCheck, LogOut, Edit3, Lock, MapPin, KeyRound, Sparkles } from 'lucide-react';
import EditProfileModal from '../components/user/EditProfileModal';
import ChangePasswordModal from '../components/user/ChangePasswordModal';
import AddressBook from '../components/user/AddressBook';

export default function ProfilePage() {
  const { user, logout, isCustomer, isSeller, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  if (!user) return null;

  const handleProfileUpdated = (updatedUser) => {
    window.location.reload(); // Refresh session data
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-nexus-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-nexus-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-nexus-600/30 overflow-hidden border border-nexus-400/40">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">
                {user.firstName} {user.lastName}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isAdmin 
                  ? 'bg-rose-950/80 border-rose-800 text-rose-300' 
                  : isSeller 
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' 
                  : 'bg-nexus-950/80 border-nexus-800 text-nexus-300'
              }`}>
                {user.role?.replace('ROLE_', '')}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" /> {user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 bg-nexus-600 hover:bg-nexus-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all"
          >
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-rose-500/80 text-slate-300 hover:text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'overview'
              ? 'bg-nexus-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <User className="w-4 h-4" /> Account Overview
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'addresses'
              ? 'bg-nexus-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" /> Address Book
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'security'
              ? 'bg-nexus-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Security & Password
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-card p-6 rounded-2xl space-y-6">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-nexus-400" /> Personal Profile Details
              </span>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs text-nexus-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-slate-500 font-medium">First Name</span>
                <p className="text-slate-200 font-semibold text-sm">{user.firstName}</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-slate-500 font-medium">Last Name</span>
                <p className="text-slate-200 font-semibold text-sm">{user.lastName}</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-slate-500 font-medium">Email Address</span>
                <p className="text-slate-200 font-semibold text-sm">{user.email}</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-xl space-y-1">
                <span className="text-slate-500 font-medium">Phone Number</span>
                <p className="text-slate-200 font-semibold text-sm">{user.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-nexus-400" /> Account Privilege
            </h2>
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-xs">
              <span className="text-slate-400">Assigned Platform Role</span>
              <p className="text-nexus-400 font-bold text-sm uppercase">{user.role}</p>
              <p className="text-slate-500 text-[11px]">
                Granted full access to user features, order tracking, review submissions, and AI assistant tools.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'addresses' && <AddressBook />}

      {activeTab === 'security' && (
        <div className="glass-card p-6 rounded-2xl max-w-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> Account Security Settings
              </h2>
              <p className="text-xs text-slate-400">Manage your account authentication credentials</p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white">Password Authentication</h3>
              <p className="text-xs text-slate-400">Last updated recently</p>
            </div>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:border-emerald-500 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
            >
              <KeyRound className="w-4 h-4" /> Change Password
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditProfileModal
        user={user}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProfileUpdated={handleProfileUpdated}
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}

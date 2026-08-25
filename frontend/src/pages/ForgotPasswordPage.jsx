import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      // Simulate API request delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch (err) {
      setError('Failed to dispatch recovery email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Password Recovery
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Forgot Password</h1>
          <p className="text-xs text-slate-400">Enter your email and we'll send you instructions to reset your password</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-semibold shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-semibold shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>If the email exists, a password reset link has been dispatched.</span>
          </div>
        )}

        {/* Request Form */}
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-nexus-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {submitting ? (
              <span>Sending Instructions...</span>
            ) : (
              <span>Send Recovery Link</span>
            )}
          </button>
        </form>

        {/* Back Link */}
        <p className="text-center text-xs">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-nexus-400 hover:text-nexus-300">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </p>

      </div>
    </div>
  );
}

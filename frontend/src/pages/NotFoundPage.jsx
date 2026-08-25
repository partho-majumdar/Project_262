import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass-panel p-8 sm:p-12 rounded-3xl max-w-lg text-center space-y-6">
        <div className="w-16 h-16 bg-rose-950/80 border border-rose-800/60 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-nexus-400 uppercase tracking-widest">Error 404</span>
          <h1 className="text-3xl font-extrabold text-white">Page Not Found</h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
            The page or resource you are looking for does not exist or has been moved across the GroupMart network.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link 
            to="/" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-nexus-600 hover:bg-nexus-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            <Home className="w-4 h-4" /> Back to Home
          </Link>
          <button 
            onClick={() => window.history.back()} 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

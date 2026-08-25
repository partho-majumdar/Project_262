import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function RootRedirector() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role;
  if (role === 'ROLE_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (role === 'ROLE_SELLER') {
    return <Navigate to="/seller/dashboard" replace />;
  } else {
    return <Navigate to="/customer/dashboard" replace />;
  }
}

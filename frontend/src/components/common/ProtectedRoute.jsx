import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';
import {
  Roles,
  SellerStatus,
  ROUTES,
  dashboardRouteForRole,
} from '../../constants/roles';

export default function ProtectedRoute({ children, allowedRoles, requireApprovedSeller = false }) {
  const { isAuthenticated, user, loading, sellerStatus, isSellerApproved } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location, message: 'Please sign in to continue.' }}
        replace
      />
    );
  }

  if (requireApprovedSeller && !isSellerApproved) {
    if (sellerStatus === SellerStatus.PENDING) {
      return <Navigate to={ROUTES.SELLER_PENDING} replace />;
    }
    if (sellerStatus === SellerStatus.REJECTED) {
      return <Navigate to={ROUTES.SELLER_APPLY} replace />;
    }
    return <Navigate to={ROUTES.SELLER_APPLY} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const roleOk = allowedRoles.includes(user?.role);
    const adminOverride = allowedRoles.includes(Roles.ADMIN) && user?.role === Roles.SELLER && isSellerApproved;
    if (!roleOk && !adminOverride) {
      return <Navigate to={dashboardRouteForRole(user)} replace />;
    }
  }

  return children;
}

/**
 * A page that belongs to a customer's own account area - their cart, orders, profile and the groups
 * they take part in. An admin or a seller opening one is sent to their own dashboard instead, so
 * signing in as an admin can never leave them looking at a customer storefront.
 */
export function CustomerOnlyRoute({ children }) {
  return <ProtectedRoute allowedRoles={[Roles.CUSTOMER]}>{children}</ProtectedRoute>;
}

export const Roles = Object.freeze({
  CUSTOMER: 'ROLE_CUSTOMER',
  SELLER: 'ROLE_SELLER',
  ADMIN: 'ROLE_ADMIN',
});

export const SellerStatus = Object.freeze({
  NONE: 'NONE',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const isCustomer = (user) => user?.role === Roles.CUSTOMER;
export const isSeller = (user) => user?.role === Roles.SELLER;
export const isAdmin = (user) => user?.role === Roles.ADMIN;
export const isSellerApproved = (user) =>
  isSeller(user) || isAdmin(user) || user?.sellerStatus === SellerStatus.APPROVED;
export const isSellerPending = (user) => user?.sellerStatus === SellerStatus.PENDING;
export const isSellerRejected = (user) => user?.sellerStatus === SellerStatus.REJECTED;
export const hasAnyRole = (user, roles) => Array.isArray(roles) && roles.includes(user?.role);

export const dashboardRouteForRole = (user) => {
  if (isAdmin(user)) return '/admin/dashboard';
  if (isSellerApproved(user)) return '/seller/dashboard';
  if (isSellerPending(user)) return '/seller/pending-approval';
  if (isSellerRejected(user)) return '/seller/apply';
  // A customer lands on the storefront, not on an account page: the first thing they want after
  // signing in is to browse and buy. /customer/dashboard stays reachable from the header.
  return '/home';
};

export const ROUTES = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  SELLER_APPLY: '/seller/apply',
  SELLER_REGISTER: '/seller/register',
  SELLER_PENDING: '/seller/pending-approval',
  CUSTOMER_DASHBOARD: '/customer/dashboard',
  SELLER_DASHBOARD: '/seller/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
});

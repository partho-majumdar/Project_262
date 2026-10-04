import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import FloatingAiWidget from '../components/common/FloatingAiWidget';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  ShoppingBag,
  Flame,
  Sparkles,
  TrendingUp,
  Heart,
  ShoppingCart,
  Package,
  Truck,
  History,
  Bookmark,
  Scale,
  Tag,
  Gift,
  Headphones,
  Settings,
  LogOut,
  ShieldCheck,
  Store,
  Clock,
  CheckCircle2,
  Users,
  Ticket,
  Boxes,
  Target,
  Gavel,
  Hammer,
  Menu,
  X,
} from 'lucide-react';
import { SellerStatus, ROUTES, dashboardRouteForRole, Roles } from '../constants/roles';

const NAV_SECTIONS = [
  {
    label: 'Core Dashboard',
    items: [
      { to: '/customer/dashboard', label: 'Dashboard', Icon: LayoutDashboard, accent: 'text-nexus-400' },
      { to: '/categories', label: 'Categories', Icon: Layers, accent: 'text-purple-400' },
      { to: '/products', label: 'Products', Icon: ShoppingBag, accent: 'text-emerald-400' },
      { to: '/group-deals', label: 'Group Deals', Icon: Users, accent: 'text-emerald-400' },
      { to: '/wholesale', label: 'Wholesale', Icon: Boxes, accent: 'text-indigo-400' },
      { to: '/reverse-group-buying', label: 'Reverse Group Buying', Icon: Target, accent: 'text-cyan-400' },
      { to: '/group-reverse', label: 'Customer Lead Group Buying', Icon: Users, accent: 'text-emerald-400' },
      { to: '/auctions', label: 'Auctions', Icon: Hammer, accent: 'text-amber-400' },
      { to: '/group-buying-auctions', label: 'Group Buying Auctions', Icon: Gavel, accent: 'text-amber-400' },
      { to: '/products?tag=deals', label: "Today's Deals", Icon: Flame, accent: 'text-amber-400' },
      { to: '/products?tag=new', label: 'New Arrivals', Icon: Sparkles, accent: 'text-rose-400' },
      { to: '/products?tag=trending', label: 'Trending Products', Icon: TrendingUp, accent: 'text-teal-400' },
      { to: '/ai-assistant', label: 'AI Recommendations', Icon: Sparkles, accent: 'text-amber-400' },
    ],
  },
  {
    label: 'Shopping Hub',
    items: [
      { to: '/wishlist', label: 'Wishlist', Icon: Heart, accent: 'text-rose-400' },
      { to: '/cart', label: 'Shopping Cart', Icon: ShoppingCart, accent: 'text-indigo-400' },
      { to: '/orders', label: 'Orders', Icon: Package, accent: 'text-blue-400' },
      { to: '/orders/tracking', label: 'Order Tracking', Icon: Truck, accent: 'text-emerald-400' },
      { to: '/orders/history', label: 'Purchase History', Icon: History, accent: 'text-cyan-400' },
      { to: '/coupons', label: 'Coupons & Rewards', Icon: Tag, accent: 'text-rose-400' },
      { to: '/group-buy/my-groups', label: 'My Group Buys', Icon: Ticket, accent: 'text-nexus-400' },
      { to: '/wholesale/my-reservations', label: 'My Wholesale Reservations', Icon: Boxes, accent: 'text-indigo-400' },
      { to: '/reverse-group-buying/my-demand', label: 'My Demand', Icon: Target, accent: 'text-cyan-400' },
      { to: '/group-reverse/my/demands', label: 'My Group Demands', Icon: Users, accent: 'text-emerald-400' },
      { to: '/auctions/my-bids', label: 'My Bids', Icon: Hammer, accent: 'text-amber-400' },
      { to: '/group-buying-auctions/my-bids', label: 'My Auction Bids', Icon: Gavel, accent: 'text-amber-400' },
    ],
  },
  {
    label: 'Account & Support',
    items: [
      { to: '/support', label: 'Customer Support', Icon: Headphones, accent: 'text-emerald-400' },
      { to: '/ai-assistant', label: 'AI Assistant', Icon: Sparkles, accent: 'text-amber-400' },
      { to: '/settings', label: 'Settings', Icon: Settings, accent: 'text-slate-400' },
    ],
  },
];

export default function CustomerLayout() {
  const { isAuthenticated, user, logout, sellerStatus } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeTo = useMemo(() => {
    const { pathname, search } = location;
    let best = null;
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        const [path, query] = item.to.split('?');
        if (query) {
          if (`${pathname}${search}` === item.to) return item.to;
          continue;
        }
        if (pathname === path || pathname.startsWith(`${path}/`)) {
          if (best === null || path.length > best.length) best = path;
        }
      }
    }
    return best;
  }, [location.pathname, location.search]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  if (isAuthenticated && user?.role === Roles.SELLER) {
    return <Navigate to={dashboardRouteForRole(user)} replace />;
  }

  const showSellerCta =
    isAuthenticated && user?.role === 'ROLE_CUSTOMER' && sellerStatus === SellerStatus.NONE;
  const showSellerPending =
    isAuthenticated && sellerStatus === SellerStatus.PENDING;
  const showSellerRejected =
    isAuthenticated && sellerStatus === SellerStatus.REJECTED;

  const isActiveTo = (to) => to === activeTo;

  const handleLogout = () => {
    logout();
    setMobileNavOpen(false);
  };

  const railLink = (active) =>
    `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
      active
        ? 'bg-slate-800 text-white'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-nexus-500 selection:text-white">

      {/* Minimal Top Navigation Header */}
      <Header />

      {/* Mobile drawer backdrop */}
      {isAuthenticated && mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Main Container - no max-width cap, so the content column takes the full remaining width */}
      <div className="flex w-full flex-grow gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Left Customer Navigation Rail - a real full-height column that owns its own scrolling */}
        {isAuthenticated && (
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:translate-x-0 ${
              mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {/* User Avatar Mini Profile */}
            <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-nexus-500/50 bg-nexus-600/30 text-sm font-extrabold text-nexus-300">
                {user?.firstName ? user.firstName.charAt(0) : 'C'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{user?.firstName} {user?.lastName}</p>
                <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                  <ShieldCheck className="h-3 w-3" /> Platinum Member
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation - scrolls independently so the rail never grows past the viewport */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label}>
                  <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map(({ to, label, Icon, accent }) => {
                      const active = isActiveTo(to);
                      return (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setMobileNavOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={railLink(active)}
                        >
                          {/* Active marker: a left rule rather than a heavy filled block */}
                          <span
                            className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-current transition-opacity ${
                              active ? 'opacity-100' : 'opacity-0'
                            } ${active ? accent : ''}`}
                          />
                          <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
                          <span className="truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* <NavLink to="/products" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:text-white hover:bg-slate-800/60 transition">
                    <Scale className="w-4 h-4 text-purple-400" /> Compare Products
                  </NavLink> */}
                </div>
              ))}

              {/* Merchant CTA — only for plain customers (NONE status) */}
              {showSellerCta && (
                <NavLink
                  to={ROUTES.SELLER_APPLY}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-emerald-700/60 bg-gradient-to-r from-emerald-700/40 to-indigo-700/40 px-3 py-2.5 text-sm font-bold text-emerald-200 transition hover:from-emerald-700/60 hover:to-indigo-700/60"
                >
                  <Store className="h-4 w-4 text-emerald-400" /> Become a Seller
                </NavLink>
              )}
              {showSellerPending && (
                <NavLink
                  to={ROUTES.SELLER_PENDING}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-amber-800/70 bg-amber-950/40 px-3 py-2.5 text-sm font-bold text-amber-200 transition hover:bg-amber-950/60"
                >
                  <Clock className="h-4 w-4 text-amber-400" /> Seller Application — Pending
                </NavLink>
              )}
              {showSellerRejected && (
                <NavLink
                  to={ROUTES.SELLER_APPLY}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-rose-800/70 bg-rose-950/40 px-3 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-950/60"
                >
                  <ShieldCheck className="h-4 w-4 text-rose-400" /> Resubmit Seller Application
                </NavLink>
              )}
            </nav>

            {/* Logout CTA - always visible, never scrolled away */}
            <div className="shrink-0 border-t border-slate-800 bg-slate-950/40 px-3 py-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-400 transition hover:border-rose-800 hover:bg-rose-950/80 hover:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile rail toggle - sits directly under the sticky header, desktop keeps the rail */}
          {isAuthenticated && (
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <span className="truncate text-[13px] font-bold text-slate-300">My Account</span>
            </div>
          )}

          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>

      </div>

      {/* Floating Multimodal AI Assistant Widget */}
      <FloatingAiWidget />

      {/* Footer */}
      <Footer />
    </div>
  );
}

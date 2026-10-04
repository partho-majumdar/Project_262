import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/common/NotificationBell';
import {
  Store,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Menu,
  X,
  ArrowLeft,
  Activity,
  Package,
  ShoppingCart,
  Layers,
  Users,
  UsersRound,
  Boxes,
  Target,
  Hammer,
  Gavel,
  Percent,
  Banknote,
  Sparkles,
  Settings,
  Warehouse,
  MessageSquare,
} from 'lucide-react';

/** The URL is the source of truth for the open tab, mirroring SellerDashboardPage. */
const SELLER_TABS = [
  'overview', 'products', 'inventory', 'orders', 'group-buys', 'wholesale', 'reverse-group-buying',
  'group-reverse', 'auctions', 'group-buying-auctions', 'customers', 'marketing', 'finance', 'ai-hub',
  'settings',
];

/**
 * Sectioned nav model. Tab rows drive the ?tab= query on /seller/dashboard, while
 * `to` rows are standalone pages that the seller layout also wraps, so both kinds
 * live in one column instead of splitting across two sidebars.
 */
const NAV_SECTIONS = [
  {
    label: 'Store command',
    items: [
      { tab: 'overview', label: 'Dashboard Overview', Icon: Activity },
      { tab: 'products', label: 'Product Catalog', Icon: Package },
      { tab: 'orders', label: 'Order Manager', Icon: ShoppingCart },
    ],
  },
  {
    label: 'Fulfillment',
    items: [
      { tab: 'inventory', label: 'Inventory & Warehouses', Icon: Layers },
      { tab: 'customers', label: 'Customer Relations', Icon: Users },
    ],
  },
  {
    label: 'Group commerce',
    items: [
      { tab: 'group-buys', label: 'Group Buys', Icon: UsersRound },
      { tab: 'wholesale', label: 'Wholesale (CWP)', Icon: Boxes },
      { tab: 'reverse-group-buying', label: 'Reverse Group Buying', Icon: Target },
      { tab: 'group-reverse', label: 'Group Buy (Customer-Led)', Icon: Users },
      { tab: 'auctions', label: 'Auctions (Proxy Bidding)', Icon: Hammer },
      { tab: 'group-buying-auctions', label: 'Group Buying Auctions', Icon: Gavel },
    ],
  },
  {
    label: 'Growth & finance',
    items: [
      { tab: 'marketing', label: 'Marketing & Coupons', Icon: Percent },
      { tab: 'finance', label: 'Finance & Wallets', Icon: Banknote },
      { tab: 'ai-hub', label: 'AI Marketing Hub', Icon: Sparkles, pulse: true },
    ],
  },
  {
    label: 'Store tools',
    items: [
      { to: '/seller/inventory', label: 'Inventory & Stock', Icon: Warehouse },
      { to: '/seller/support', label: 'Customer Support Chat', Icon: MessageSquare },
      { tab: 'settings', label: 'Store Settings', Icon: Settings },
    ],
  },
];

export default function SellerLayout() {
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const onDashboard = location.pathname.startsWith('/seller/dashboard');
  const requestedTab = searchParams.get('tab');
  // Only a dashboard visit can own the tab rail; the other seller pages own their own row.
  const activeTab = onDashboard && SELLER_TABS.includes(requestedTab) ? requestedTab : null;

  const goToTab = (tab) => {
    // The rail is shared by three routes, so a tab click must also return to the dashboard.
    navigate({ pathname: '/seller/dashboard', search: `?tab=${tab}` });
    setMobileNavOpen(false);
  };

  const goToPage = (to) => {
    navigate(to);
    setMobileNavOpen(false);
  };

  // Route changes should never leave the mobile drawer covering the content.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, searchParams]);

  // Lock body scroll while the drawer is open so the page behind cannot scroll away.
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const railLink = (active) =>
    `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
      active
        ? 'bg-slate-800 text-white'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">

      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
        />
      )}

      <div className="flex">
        {/* Left Seller Rail - a real full-height column that owns its own scrolling */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
            <Link
              to="/seller/dashboard"
              onClick={() => setMobileNavOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-emerald-500 text-white shadow-lg shadow-indigo-900/50">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight text-white">Seller Central</span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400">Merchant Portal</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation - scrolls independently so the rail never grows past the viewport */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="mb-5 last:mb-0">
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(({ tab, to, label, Icon, pulse }) => {
                    const active = tab ? activeTab === tab : location.pathname.startsWith(to);
                    return (
                      <button
                        key={tab || to}
                        type="button"
                        onClick={() => (tab ? goToTab(tab) : goToPage(to))}
                        aria-current={active ? 'page' : undefined}
                        className={railLink(active)}
                      >
                        {/* Active marker: a left rule rather than a heavy filled block */}
                        <span
                          className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full transition-opacity ${
                            active ? 'bg-indigo-400 opacity-100' : 'opacity-0'
                          }`}
                        />
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active
                              ? 'text-emerald-400'
                              : `text-slate-500 group-hover:text-slate-300 ${pulse ? 'animate-pulse text-amber-400/70' : ''}`
                          }`}
                        />
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-1 border-t border-slate-800 pt-3">
              <Link
                to="/"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-100"
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate">Customer Marketplace</span>
              </Link>
            </div>
          </nav>

          {/* Footer - always visible, never scrolled away */}
          <div className="shrink-0 space-y-3 border-t border-slate-800 bg-slate-950/40 px-3 py-3">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-900 bg-indigo-950 text-xs font-bold text-indigo-300">
                {user?.firstName ? user.firstName.charAt(0) : 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Verified Seller
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 py-2 text-xs font-bold text-slate-400 transition hover:border-rose-900 hover:bg-rose-950 hover:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main column - takes every pixel the rail does not */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="rounded-lg border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-emerald-900 bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Merchant Central Active</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Content gets the full remaining width - no max-width cap, no reserved sidebar gutter */}
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

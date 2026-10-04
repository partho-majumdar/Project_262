import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/common/NotificationBell';
import { FEATURE_CONFIGS } from '../components/admin/featureAdmin/featureConfigs';
import {
  ShieldCheck,
  Lock,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Activity,
  Store,
  Users,
  Package,
  Sliders,
  UsersRound,
  Boxes,
  Gavel,
  Radio,
  BarChart3,
  Brain,
  Banknote,
  Layers,
  MessageSquare,
  FileText,
  Settings,
} from 'lucide-react';

/** The URL is the source of truth for the open tab, mirroring AdminDashboardPage. */
const ADMIN_TABS = [
  'overview', 'sellers', 'customers', 'products', 'orders', 'group-buys', 'wholesale', 'group-reverse',
  'collective',
  'analytics', 'ai_panel', 'finance', 'cms', 'support', 'security', 'reports', 'settings',
  'mon-reverse-group-buying', 'mon-customer-lead-group-buying', 'mon-auctions', 'mon-group-buying-auctions',
];

/** One nav entry per feature that has no bespoke admin tab of its own. */
const MONITORING_TABS = {
  'mon-reverse-group-buying': 'reverse-group-buying',
  'mon-customer-lead-group-buying': 'customer-lead-group-buying',
  'mon-auctions': 'auctions',
  'mon-group-buying-auctions': 'group-buying-auctions',
};

/**
 * Sectioned nav model. The labels are owned here so the rail stays declarative
 * instead of 23 near-identical inline buttons, and the feature-monitoring rows
 * read their label from FEATURE_CONFIGS so there is still one source of truth.
 */
const NAV_SECTIONS = [
  {
    label: 'Platform Command',
    items: [
      { tab: 'overview', label: 'Dashboard Overview', Icon: Activity },
      { tab: 'sellers', label: 'Seller Hub', Icon: Store },
      { tab: 'customers', label: 'Customers Directory', Icon: Users },
      { tab: 'products', label: 'Product Management', Icon: Package },
      { tab: 'orders', label: 'Order Governance', Icon: Sliders },
      { tab: 'group-buys', label: 'Group Buying', Icon: UsersRound },
      { tab: 'wholesale', label: 'Wholesale (CWP)', Icon: Boxes },
      { tab: 'collective', label: 'Reverse Buys & Auctions', Icon: Gavel },
      { tab: 'group-reverse', label: 'Group Reverse Buying', Icon: UsersRound },
    ],
  },
  {
    label: 'Feature monitoring',
    items: Object.entries(MONITORING_TABS).map(([tab, configId]) => ({
      tab,
      label: FEATURE_CONFIGS[configId].label,
      Icon: Radio,
    })),
  },
  {
    label: 'Intelligence & control',
    items: [
      { tab: 'analytics', label: 'Analytics Engine', Icon: BarChart3 },
      { tab: 'ai_panel', label: 'AI Predict panel', Icon: Brain, pulse: true },
      { tab: 'finance', label: 'Finance & Wallets', Icon: Banknote },
      { tab: 'cms', label: 'Content Control (CMS)', Icon: Layers },
      { tab: 'support', label: 'Helpdesk Tickets', Icon: MessageSquare },
      { tab: 'security', label: 'Security Center', Icon: Lock },
      { tab: 'reports', label: 'Consolidated Reports', Icon: FileText },
      { tab: 'settings', label: 'Platform Settings', Icon: Settings },
    ],
  },
];

export default function AdminLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const requestedTab = searchParams.get('tab');
  const activeAdminSubTab = ADMIN_TABS.includes(requestedTab) ? requestedTab : 'overview';

  const goToTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    // The view section only means something on the two tabs that render their own sub-navigation.
    if (tab !== 'group-buys' && tab !== 'wholesale') {
      next.delete('view');
    }
    setSearchParams(next);
    setMobileNavOpen(false);
  };

  // Route changes should never leave the mobile drawer covering the content.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [searchParams]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-rose-500 selection:text-white">

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
        {/* Left Admin Rail - a real full-height column that owns its own scrolling */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
            <Link
              to="/admin/dashboard"
              onClick={() => setMobileNavOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-600 to-indigo-600 text-white shadow-lg shadow-rose-900/40">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight text-white">Executive Admin</span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-400">Security Command</span>
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
                  {section.items.map(({ tab, label, Icon, pulse }) => {
                    const active = activeAdminSubTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => goToTab(tab)}
                        aria-current={active ? 'page' : undefined}
                        className={railLink(active)}
                      >
                        {/* Active marker: a left rule rather than a heavy filled block */}
                        <span
                          className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-rose-500 transition-opacity ${
                            active ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active ? 'text-rose-400' : 'text-slate-500 group-hover:text-slate-300'
                          } ${pulse && !active ? 'animate-pulse text-rose-450' : ''}`}
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-900 bg-rose-950 text-xs font-bold text-rose-300">
                {user?.firstName ? user.firstName.charAt(0) : 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="flex items-center gap-1 font-mono text-[10px] text-rose-400">
                  <Lock className="h-3 w-3" /> System Superadmin
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
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-rose-900 bg-rose-950/60 px-3 py-1 text-xs font-bold text-rose-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">System Command Center</span>
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

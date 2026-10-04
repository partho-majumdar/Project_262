import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Store } from 'lucide-react';
import Header from './Header';
import { useAuthBrand } from '../../context/AuthBrandContext';
import { Roles, ROUTES } from '../../constants/roles';

/**
 * Portal branding for the sign-in page. The customer tab keeps the full marketplace header; the
 * seller and admin tabs get their own portal bar so the form does not look like it belongs to the
 * wrong area of the product.
 */
const PORTALS = {
  [Roles.SELLER]: {
    title: 'Seller Central',
    subtitle: 'Merchant Portal',
    icon: Store,
    badge: 'Merchant sign-in',
    accent: 'from-emerald-600 to-teal-600',
    ring: 'border-emerald-700/60 text-emerald-400',
    badgeClass: 'bg-emerald-950 border border-emerald-800 text-emerald-300',
  },
  [Roles.ADMIN]: {
    title: 'GroupMart Administration',
    subtitle: 'Executive Terminal',
    icon: ShieldCheck,
    badge: 'Administrator sign-in',
    accent: 'from-amber-600 to-orange-600',
    ring: 'border-amber-700/60 text-amber-400',
    badgeClass: 'bg-amber-950 border border-amber-800 text-amber-300',
  },
};

export default function AuthRoleHeader() {
  const { brand } = useAuthBrand();
  const portal = PORTALS[brand];

  if (!portal) return <Header />;

  const PortalIcon = portal.icon;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr ${portal.accent} text-white shadow-lg`}
          >
            <PortalIcon className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-sm font-extrabold tracking-tight text-white">{portal.title}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {portal.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider sm:block ${portal.badgeClass}`}>
            {portal.badge}
          </span>
          <Link
            to={ROUTES.HOME}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition ${portal.ring} hover:bg-slate-800/60`}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Customer Marketplace
          </Link>
        </div>
      </div>
    </header>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  Package,
  Heart,
  Sparkles,
  Truck,
  MapPin,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Star,
  Box,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

const STATUS_STEPS = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function getStepIndex(status) {
  if (!status) return 0;
  const s = status.toUpperCase();
  if (s === 'CANCELLED' || s === 'REFUNDED') return -1;
  const idx = STATUS_STEPS.indexOf(s);
  return idx >= 0 ? idx : 0;
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function CustomerDashboardPage() {
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, wishRes, recRes] = await Promise.all([
        axiosClient.get('/orders').catch(() => ({ data: [] })),
        axiosClient.get('/wishlist').catch(() => ({ data: { items: [] } })),
        axiosClient.get('/ai/recommendations/personalized').catch(() => ({ data: { recommendations: [] } })),
      ]);

      // ApiResponse wrapper → .data is the payload
      const orderList = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      const wishItems = wishRes?.data?.items || [];
      const recs = recRes?.data?.recommendations || [];

      setOrders(orderList);
      setWishlistItems(wishItems);
      setRecommendations(recs);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const activeOrders = orders.filter((o) =>
    ['PENDING', 'PROCESSING', 'SHIPPED'].includes((o.status || '').toUpperCase())
  );
  const deliveredCount = orders.filter((o) => (o.status || '').toUpperCase() === 'DELIVERED').length;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-nexus-400" />
        <p className="text-sm font-medium">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800 bg-gradient-to-r from-slate-900 via-nexus-950/40 to-slate-950">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-800 text-nexus-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {orders.length >= 5 ? 'Nexus Gold Member' : orders.length >= 1 ? 'Nexus Member' : 'New Member'}
          </div>
          <h1 className="text-3xl font-black text-white">
            Welcome back, {user?.firstName || 'Customer'}!
          </h1>
          <p className="text-xs text-slate-400">
            Track orders, manage wishlist, and discover products tailored for you.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadDashboard}
            className="px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Link
            to="/products"
            className="px-5 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
          >
            Explore Catalog <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards — all real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Lifetime Spend</span>
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{formatMoney(totalSpent)}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Total Orders</span>
            <Package className="w-4 h-4 text-nexus-400" />
          </div>
          <p className="text-2xl font-black text-white">{orders.length}</p>
          <p className="text-[11px] text-slate-500">{deliveredCount} delivered</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Active Shipments</span>
            <Truck className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400">{activeOrders.length}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Wishlist Items</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{wishlistItems.length}</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Orders — Dynamic */}
        <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-400" /> Active Shipments
            </h3>
            <Link to="/orders" className="text-xs font-bold text-nexus-400 hover:underline">
              View all →
            </Link>
          </div>

          {activeOrders.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Box className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No active shipments</p>
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-nexus-400 hover:underline"
              >
                Start shopping <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.slice(0, 3).map((order) => {
                const step = getStepIndex(order.status);
                const firstItem = order.items?.[0];
                const itemLabel =
                  order.items?.length > 1
                    ? `${firstItem?.productName || 'Items'} +${order.items.length - 1} more`
                    : firstItem?.productName || 'Order items';

                return (
                  <div
                    key={order.id || order.orderNumber}
                    className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3"
                  >
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-nexus-400">#{order.orderNumber}</span>
                      <span className="text-slate-400">{formatDate(order.createdAt)}</span>
                    </div>
                    <p className="text-xs text-white font-semibold line-clamp-1">{itemLabel}</p>
                    <p className="text-[11px] text-slate-400">
                      Total: {formatMoney(order.totalAmount)} · {order.status}
                    </p>

                    {/* Progress steps */}
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-1">
                      {STATUS_STEPS.map((s, i) => {
                        const active = step >= i;
                        const current = step === i;
                        return (
                          <div
                            key={s}
                            className={`p-1.5 rounded-lg font-bold border ${
                              current
                                ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                                : active
                                ? 'bg-nexus-950 border-nexus-600 text-nexus-300'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {s === 'PENDING' ? 'Placed' : s === 'PROCESSING' ? 'Packed' : s === 'SHIPPED' ? 'Transit' : 'Done'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Wishlist preview */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" /> Wishlist
              </h3>
              <Link to="/wishlist" className="text-xs font-bold text-nexus-400 hover:underline">
                View all
              </Link>
            </div>

            {wishlistItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No saved items yet. Heart products you like!
              </p>
            ) : (
              <div className="space-y-2">
                {wishlistItems.slice(0, 4).map((item) => (
                  <Link
                    key={item.id || item.productId}
                    to={`/products/${item.productSlug || item.productId}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                      <img
                        src={item.imageUrl || item.productImageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100'}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {item.productName || item.name}
                      </p>
                      <p className="text-[11px] text-nexus-400">
                        {formatMoney(item.price || item.unitPrice)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Address / Payment placeholders (honest empty states) */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" /> Shipping Address
              </h3>
              <Link to="/profile" className="text-xs font-bold text-nexus-400 hover:underline">
                Manage
              </Link>
            </div>
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs text-slate-400">
              Addresses are saved during checkout. Go to Profile to manage them later.
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Payment Methods
              </h3>
            </div>
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs text-slate-400">
              Payment is handled at checkout (Cash on Delivery / Card). No saved cards yet.
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendations (from backend) */}
      {recommendations.length > 0 && (
        <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Recommended for You
            </h3>
            <Link to="/products" className="text-xs font-bold text-nexus-400 hover:underline">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recommendations.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.slug || p.id}`}
                className="group space-y-2"
              >
                <div className="aspect-square rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden group-hover:border-nexus-600 transition">
                  <img
                    src={p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=300'}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs font-semibold text-white line-clamp-2 group-hover:text-nexus-300">
                  {p.name}
                </p>
                <p className="text-xs font-bold text-nexus-400">{formatMoney(p.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders table */}
      <div className="glass-card rounded-3xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Recent Orders
          </h3>
          <Link to="/orders" className="text-xs font-bold text-nexus-400 hover:underline">
            Full history →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            You haven’t placed any orders yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Order</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id || o.orderNumber} className="hover:bg-slate-900/50">
                    <td className="p-3 font-mono text-nexus-400">#{o.orderNumber}</td>
                    <td className="p-3 text-slate-400">{formatDate(o.createdAt)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          o.status === 'DELIVERED'
                            ? 'text-emerald-400'
                            : o.status === 'CANCELLED'
                            ? 'text-rose-400'
                            : 'text-indigo-400'
                        }`}
                      >
                        {o.status === 'DELIVERED' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : o.status === 'CANCELLED' ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : null}
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{o.paymentStatus || '—'}</td>
                    <td className="p-3 text-right font-bold text-white">
                      {formatMoney(o.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  Brain,
  Coins,
  Gavel,
  Layers,
  Package,
  RefreshCw,
  Store,
  TrendingUp,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import {
  ChartCard,
  Columns,
  Donut,
  GrowthArea,
  Lines,
  Radar,
  RankedBars,
  RatingHistogram,
  RevenueOrdersTrend,
  Scatter,
  SplitBar,
  StackedBars,
  SERIES,
  compactMoney,
  periodSafeLabel,
} from '../../groupbuy/analytics/charts';
import { formatMoney, formatPercent } from '../../groupbuy/format';

const num = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const periodLabel = (value) => periodSafeLabel(value);

/** Coerces any API payload into an array. Never throws: objects become their values. */
function rowsOf(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') return Object.values(source);
  return [];
}

/** Turns a plain {KEY: count} map into {name,value} pairs, sorted largest first. */
function tallyEntries(record, nameOf = (key) => key, valueOf = (value) => value) {
  const counts = new Map();
  if (!record || typeof record !== 'object') return [];
  for (const [key, value] of Object.entries(record)) {
    const name = nameOf(key);
    if (name === null || name === undefined || name === '') continue;
    counts.set(name, (counts.get(name) || 0) + valueOf(value));
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Groups rows into {name,value} pairs, sorted largest first, for donuts and split bars. */
function tally(rows, nameOf, valueOf) {
  const counts = new Map();
  for (const row of rowsOf(rows)) {
    const name = nameOf(row);
    if (name === null || name === undefined || name === '') continue;
    counts.set(name, (counts.get(name) || 0) + valueOf(row));
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const ORDER_STATUS_META = {
  PENDING: { label: 'Pending', color: SERIES[3] },
  PROCESSING: { label: 'Processing', color: SERIES[2] },
  SHIPPED: { label: 'Shipped', color: SERIES[4] },
  DELIVERED: { label: 'Delivered', color: SERIES[1] },
  CANCELLED: { label: 'Cancelled', color: '#64748b' },
  REFUNDED: { label: 'Refunded', color: '#94a3b8' },
};

const ORDER_TYPE_LABELS = {
  STANDARD: 'Regular orders',
  GROUP_BUY: 'Group buying',
  WHOLESALE: 'Wholesale (CWP)',
  REVERSE_GROUP_BUYING: 'Seller-led reverse buying',
  GROUP_BUYING_AUCTION: 'Group buying auction',
  AUCTION: 'Proxy auction',
  GROUP_REVERSE_BUYING: 'Customer-led group reverse',
};

const PAYMENT_LABELS = {
  CREDIT_CARD: 'Credit card',
  PAYPAL: 'PayPal',
  STRIPE: 'Stripe',
  CASH_ON_DELIVERY: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
};

const FEATURE_STATUS_LABELS = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Pending approval', APPROVED: 'Approved', ACTIVE: 'Active',
  LIVE: 'Live', OPEN: 'Open', SCHEDULED: 'Scheduled', RUNNING: 'Running', PAUSED: 'Paused',
  CLOSING: 'Closing', CLOSED: 'Closed', COMPLETED: 'Completed', FULFILLED: 'Fulfilled',
  SUCCESS: 'Success', SUCCESSFUL: 'Successful', FAILED: 'Failed', CANCELLED: 'Cancelled',
  EXPIRED: 'Expired', ENDED: 'Ended', TERMINATED: 'Terminated', REJECTED: 'Rejected',
  DRAFT_AUCTION: 'Draft', PENDING: 'Pending',
};

const labelFor = (status) => FEATURE_STATUS_LABELS[status] || status || 'Unknown';

function StatTile({ icon: Icon, label, value, hint, accent = 'text-rose-400' }) {
  return (
    <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
        <Icon className={`w-4 h-4 ${accent} shrink-0`} />
      </div>
      <p className="text-xl font-black text-white leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}

/** A section header, so the eight domains stay visually separate in a long page. */
function SectionTitle({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 grid place-items-center">
          <Icon className="w-4 h-4 text-rose-400" />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

const money = (value) => formatMoney(num(value));
const moneyAxis = (value) => compactMoney(value);
const countAxis = (value) => num(value).toLocaleString();

/** Percentage of a total, safe when the total is zero. */
const share = (value, total) => (total > 0 ? (num(value) / num(total)) * 100 : 0);

/**
 * The platform-wide analytics surface.
 *
 * <p>Every domain is fetched with `Promise.allSettled` on purpose. A single unavailable subsystem
 * would otherwise blank the whole engine, and an admin looking at commerce numbers should still
 * see them when the collective-buying tables happen to be empty or erroring. Each section states
 * its own unavailable reason instead of the page failing as a unit.
 */
export default function AdminAnalyticsEngine() {
  const [data, setData] = useState({
    analytics: null,
    overview: null,
    bi: null,
    users: [],
    sellers: [],
    orders: [],
    products: [],
    groupBuys: [],
    gbOverview: null,
    gbReports: null,
    wholesale: [],
    rgb: [],
    auctions: [],
    gbAuctions: [],
    groupReverse: [],
  });
  const [failed, setFailed] = useState({});
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      axiosClient.get('/admin/analytics'),
      axiosClient.get('/admin/dashboard'),
      axiosClient.get('/admin/bi-analytics/dashboard'),
      axiosClient.get('/admin/users?page=0&size=200'),
      axiosClient.get('/admin/sellers'),
      axiosClient.get('/admin/orders'),
      axiosClient.get('/products?size=200'),
      axiosClient.get('/admin/group-buys'),
      axiosClient.get('/admin/group-buys/overview'),
      axiosClient.get('/admin/group-buys/reports'),
      axiosClient.get('/admin/wholesale'),
      axiosClient.get('/admin/reverse-group-buying'),
      axiosClient.get('/admin/auctions'),
      axiosClient.get('/admin/group-buying-auctions'),
      axiosClient.get('/admin/group-reverse-demands'),
    ]);

    const val = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);
    const bad = (i) => results[i].status === 'rejected';

    const listOf = (res) => {
      const payload = res?.data ?? res ?? null;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.content)) return payload.content;
      return [];
    };

    setData({
      analytics: val(0)?.data ?? val(0) ?? null,
      overview: val(1)?.data ?? val(1) ?? null,
      bi: val(2)?.data ?? val(2) ?? null,
      users: listOf(val(3)),
      sellers: listOf(val(4)),
      orders: listOf(val(5)),
      products: listOf(val(6)),
      groupBuys: listOf(val(7)),
      gbOverview: val(8)?.data ?? val(8) ?? null,
      gbReports: val(9)?.data ?? val(9) ?? null,
      wholesale: listOf(val(10)),
      rgb: listOf(val(11)),
      auctions: listOf(val(12)),
      gbAuctions: listOf(val(13)),
      groupReverse: listOf(val(14)),
    });

    setFailed({
      analytics: bad(0), overview: bad(1), bi: bad(2), users: bad(3), sellers: bad(4),
      orders: bad(5), products: bad(6), groupBuys: bad(7), gbOverview: bad(8), gbReports: bad(9),
      wholesale: bad(10), rgb: bad(11), auctions: bad(12), gbAuctions: bad(13), groupReverse: bad(14),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const m = useMemo(() => {
    const { analytics, overview, bi, users, sellers, orders, products, groupBuys, gbOverview,
      gbReports, wholesale, rgb, auctions, gbAuctions, groupReverse } = data;

    // ---- Commerce core -------------------------------------------------
    const revenue = num(analytics?.totalRevenue ?? overview?.totalPlatformRevenue);
    const orderCount = num(analytics?.totalOrders ?? orders.length);
    const aov = num(analytics?.averageOrderValue) || (orderCount > 0 ? revenue / orderCount : 0);
    const categorySales = (analytics?.categorySales ?? []).map((row) => ({
      name: row.categoryName || 'Uncategorised',
      revenue: num(row.totalRevenue),
      units: num(row.salesCount),
    })).sort((a, b) => b.revenue - a.revenue);
    const topProducts = (analytics?.topProducts ?? []).map((row) => ({
      name: row.productName || row.sku || 'Unnamed',
      units: num(row.unitsSold),
      revenue: num(row.totalRevenue),
    })).sort((a, b) => b.revenue - a.revenue);
    const revenueTrends = (analytics?.revenueTrends ?? []).map((row) => ({
      date: row.date,
      revenue: num(row.revenue),
      orders: num(row.orderCount),
    }));

    const orderStatusMix = tally(
      orders,
      (o) => ORDER_STATUS_META[o.status]?.label ?? labelFor(o.status),
      () => 1,
    );
    const orderTypeMix = tally(
      orders,
      (o) => ORDER_TYPE_LABELS[o.orderType] ?? labelFor(o.orderType),
      () => 1,
    );
    const paymentMix = tally(
      orders,
      (o) => PAYMENT_LABELS[o.paymentMethod] ?? labelFor(o.paymentMethod),
      () => 1,
    );

    // Order value bands show whether the marketplace runs on many small baskets or few large ones.
    const bands = [
      { label: 'Under ৳500', test: (v) => v < 500 },
      { label: '৳500–1,999', test: (v) => v >= 500 && v < 2000 },
      { label: '৳2,000–4,999', test: (v) => v >= 2000 && v < 5000 },
      { label: '৳5,000–9,999', test: (v) => v >= 5000 && v < 10000 },
      { label: '৳10,000+', test: (v) => v >= 10000 },
    ];
    const orderBands = bands.map((band) => ({
      label: band.label,
      count: orders.filter((o) => band.test(num(o.totalAmount))).length,
    }));

    const citySpend = tally(orders, (o) => (o.shippingCity || '').trim(), (o) => num(o.totalAmount))
      .filter((row) => row.name)
      .slice(0, 8);

    const totalDiscount = orders.reduce((sum, o) => sum + num(o.discountAmount), 0);

    // ---- Seller hub ---------------------------------------------------
    const verifiedSellers = sellers.filter((s) => s.verified).length;
    const sellerVerification = [
      { name: 'Verified', value: verifiedSellers },
      { name: 'Unverified', value: sellers.length - verifiedSellers },
    ];
    const ratingBuckets = [5, 4, 3, 2, 1].map((star) => ({
      star: `${star}★`,
      count: sellers.filter((s) => Math.round(num(s.rating)) === star).length,
    }));
    const topSellers = sellers
      .filter((s) => num(s.totalSales) > 0)
      .map((s) => ({ name: s.storeName || s.ownerEmail || 'Unnamed store', value: num(s.totalSales) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const sellerRatingSpread = sellers
      .filter((s) => num(s.rating) > 0)
      .map((s) => ({
        name: s.storeName || s.ownerEmail || 'Unnamed store',
        rating: num(s.rating),
        sales: num(s.totalSales),
      }))
      .slice(0, 40);
    const policyAdoption = [
      { dimension: 'Shipping policy', value: share(sellers.filter((s) => s.shippingPolicy).length, sellers.length) },
      { dimension: 'Return policy', value: share(sellers.filter((s) => s.returnPolicy).length, sellers.length) },
      { dimension: 'Bank details', value: share(sellers.filter((s) => s.bankAccount).length, sellers.length) },
      { dimension: 'Verified', value: share(verifiedSellers, sellers.length) },
      { dimension: 'Logo set', value: share(sellers.filter((s) => s.logoUrl).length, sellers.length) },
    ];

    // ---- Customers ----------------------------------------------------
    const roleMix = tally(users, (u) => u.role || 'UNKNOWN', () => 1);
    const activeMix = [
      { name: 'Active', value: users.filter((u) => u.enabled).length },
      { name: 'Suspended', value: users.filter((u) => !u.enabled).length },
    ];
    const monthBuckets = new Map();
    for (const user of users) {
      const date = new Date(user.createdAt || 0);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1);
    }
    const signups = [...monthBuckets.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
    const buyingCustomers = new Set(orders.map((o) => o.userEmail).filter(Boolean));
    const customerEngagement = [
      { name: 'Has ordered', value: buyingCustomers.size },
      { name: 'Registered only', value: Math.max(0, users.length - buyingCustomers.size) },
    ];

    // ---- Products -----------------------------------------------------
    const productByCategory = tally(products, (p) => p.categoryName || 'Uncategorised', () => 1);
    const stockBuckets = [
      { name: 'Out of stock', value: products.filter((p) => num(p.stockQuantity) <= 0).length },
      { name: 'Low (<10)', value: products.filter((p) => { const s = num(p.stockQuantity); return s > 0 && s < 10; }).length },
      { name: 'Healthy', value: products.filter((p) => num(p.stockQuantity) >= 10).length },
    ];
    const priceBands = [
      { label: 'Under ৳500', test: (v) => v < 500 },
      { label: '৳500–1,999', test: (v) => v >= 500 && v < 2000 },
      { label: '৳2,000–4,999', test: (v) => v >= 2000 && v < 5000 },
      { label: '৳5,000+', test: (v) => v >= 5000 },
    ].map((band) => ({
      label: band.label,
      count: products.filter((p) => band.test(num(p.price))).length,
    }));
    const inventoryValue = products.reduce((sum, p) => sum + num(p.stockQuantity) * num(p.price), 0);
    const topRated = products
      .filter((p) => num(p.rating) > 0)
      .map((p) => ({ name: p.name || p.sku || 'Unnamed', rating: num(p.rating), reviews: num(p.reviewCount) }))
      .sort((a, b) => b.reviews - a.reviews || b.rating - a.rating)
      .slice(0, 8);
    const bestSellers = [...products]
      .map((p) => ({ name: p.name || p.sku || 'Unnamed', value: num(p.reviewCount) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // ---- Group buying -------------------------------------------------
    const campaignsByStatus = gbOverview?.campaignsByStatus ?? {};
    const groupsByStatus = gbOverview?.groupsByStatus ?? {};
    const gbStatusMix = Object.entries(campaignsByStatus).map(([status, value]) => ({
      name: labelFor(status), value: num(value),
    }));
    const gbGroupMix = Object.entries(groupsByStatus).map(([status, value]) => ({
      name: labelFor(status), value: num(value),
    }));
    const gbDaily = (gbReports?.daily ?? []).map((row) => ({
      date: row.date,
      participants: num(row.participantsJoined),
      revenue: num(row.revenue),
      savings: num(row.savings),
      refunds: num(row.refunds),
    }));
    const gbSellers = (gbReports?.sellers ?? []).slice(0, 8).map((row) => ({
      name: row.storeName || 'Unnamed store',
      revenue: num(row.revenue),
      units: num(row.unitsSold),
      rate: num(row.successRate),
      buyers: num(row.buyers),
    }));
    const gbCampaigns = (gbReports?.campaigns ?? []).map((row) => ({
      name: row.title || row.productName || 'Untitled campaign',
      revenue: num(row.revenue),
      cost: num(row.cost),
      profit: num(row.profit),
      margin: num(row.marginPercent),
      discount: num(row.maxDiscountPercent),
      units: num(row.unitsSold),
      successRate: num(row.successRate),
    }));
    const gbDiscountBands = (gbReports?.discountBands ?? []).map((row) => ({
      label: row.label,
      successRate: num(row.successRate),
      revenue: num(row.revenue),
      units: num(row.unitsSold),
      campaigns: num(row.campaigns),
    }));
    const gbOutcomes = tallyEntries(
      gbReports?.campaignOutcomes,
      (key) => labelFor(key),
      (value) => num(value),
    );
    const gbCampaignStatusMix = tally(
      groupBuys,
      (c) => labelFor(c.status),
      () => 1,
    );

    // ---- Wholesale ----------------------------------------------------
    const wholesaleStatusMix = tally(wholesale, (w) => labelFor(w.status), () => 1);
    const lotTotals = wholesale.reduce(
      (acc, w) => {
        acc.active += num(w.activeLotCount);
        acc.completed += num(w.completedLotCount);
        acc.failed += num(w.failedLotCount);
        return acc;
      },
      { active: 0, completed: 0, failed: 0 },
    );
    const wholesaleSupply = wholesale
      .map((w) => ({
        name: w.productName || 'Unnamed product',
        available: num(w.availableQuantity),
        minimum: num(w.wholesaleMinimumQuantity),
        savings: num(w.productPrice) - num(w.wholesaleUnitPrice),
      }))
      .filter((row) => row.available > 0)
      .sort((a, b) => b.available - a.available)
      .slice(0, 8);

    // ---- Reverse buys and auctions ------------------------------------
    const rgbStatusMix = tally(rgb, (c) => labelFor(c.status), () => 1);
    const rgbProgress = rgb.slice(0, 10).map((c) => ({
      name: c.productName || 'Unnamed product',
      progress: num(c.targetProgressPercent),
      demand: num(c.currentDemand),
      target: num(c.targetQuantity),
      participants: num(c.participantCount),
    }));
    const auctionStatusMix = tally(auctions, (a) => labelFor(a.status), () => 1);
    const auctionBidding = auctions.slice(0, 10).map((a) => ({
      name: a.productName || 'Unnamed product',
      bids: num(a.bidCount),
      bidders: num(a.bidderCount),
      uplift: num(a.startingPrice) > 0
        ? ((num(a.finalPrice || a.currentPrice) - num(a.startingPrice)) / num(a.startingPrice)) * 100
        : 0,
    }));
    const gbAuctionStatusMix = tally(gbAuctions, (a) => labelFor(a.status), () => 1);
    const gbAuctionParticipation = gbAuctions.slice(0, 10).map((a) => ({
      name: a.productName || 'Unnamed product',
      collective: num(a.collectiveQuantity),
      minimum: num(a.minimumCollectiveQuantity),
      participants: num(a.participantCount),
      discount: num(a.discountPercent),
    }));
    const featureAdoption = [
      { dimension: 'Group buying', value: share(orders.filter((o) => o.orderType === 'GROUP_BUY').length, orders.length) },
      { dimension: 'Wholesale', value: share(orders.filter((o) => o.orderType === 'WHOLESALE').length, orders.length) },
      { dimension: 'Auctions', value: share(orders.filter((o) => o.orderType === 'AUCTION' || o.orderType === 'GROUP_BUYING_AUCTION').length, orders.length) },
      { dimension: 'Seller reverse', value: share(orders.filter((o) => o.orderType === 'REVERSE_GROUP_BUYING').length, orders.length) },
      { dimension: 'Group reverse', value: share(orders.filter((o) => o.orderType === 'GROUP_REVERSE_BUYING').length, orders.length) },
    ];

    // ---- Group reverse buying ------------------------------------------
    const grStatusMix = tally(groupReverse, (d) => labelFor(d.status), () => 1);
    const grProgress = groupReverse.slice(0, 10).map((d) => ({
      name: d.productName || 'Unnamed product',
      committed: num(d.committedQuantity),
      required: num(d.requiredQuantity),
      percent: num(d.progressPercent),
      offers: num(d.offerCount),
      members: num(d.memberCount),
    }));
    const grCities = tally(
      groupReverse,
      (d) => (d.deliveryCity || '').trim(),
      (d) => num(d.committedQuantity),
    ).filter((row) => row.name).slice(0, 8);
    const grOffers = groupReverse
      .filter((d) => num(d.offerCount) > 0)
      .map((d) => ({
        name: d.productName || 'Unnamed product',
        offers: num(d.offerCount),
        members: num(d.memberCount),
        discount: num(d.targetPrice) > 0 && num(d.lockedUnitPrice) > 0
          ? ((num(d.targetPrice) - num(d.lockedUnitPrice)) / num(d.targetPrice)) * 100
          : 0,
      }))
      .slice(0, 8);

    // ---- Forecasts ----------------------------------------------------
    const forecasts = (bi?.revenueForecasts ?? []).map((row) => ({
      date: row.dateLabel,
      revenue: num(row.predictedRevenue),
      orders: num(row.predictedOrderCount),
      confidence: num(row.confidencePercentage),
    }));
    const lowStock = (bi?.lowStockPredictions ?? []).map((row) => ({
      name: row.productName || row.sku || 'Unnamed',
      days: num(row.daysUntilStockout),
      stock: num(row.currentStock),
      burn: num(row.estimatedBurnRatePerDay),
      risk: row.riskLevel || 'UNKNOWN',
    }));
    const lowStockRisk = tally(lowStock, (r) => r.risk, () => 1);
    const fraud = (bi?.fraudAnomalies ?? []).map((row) => ({
      order: row.orderNumber,
      customer: row.userEmail,
      amount: num(row.amount),
      risk: num(row.riskScore),
      reason: row.anomalyReason,
      status: row.status,
    }));

    return {
      revenue, orderCount, aov, categorySales, topProducts, revenueTrends,
      orderStatusMix, orderTypeMix, paymentMix, orderBands, citySpend, totalDiscount,
      verifiedSellers, sellerVerification, ratingBuckets, topSellers, sellerRatingSpread, policyAdoption,
      roleMix, activeMix, signups, customerEngagement, buyingCustomers,
      productByCategory, stockBuckets, priceBands, inventoryValue, topRated, bestSellers,
      gbStatusMix, gbGroupMix, gbDaily, gbSellers, gbCampaigns, gbDiscountBands, gbOutcomes, gbCampaignStatusMix,
      wholesaleStatusMix, lotTotals, wholesaleSupply,
      rgbStatusMix, rgbProgress, auctionStatusMix, auctionBidding, gbAuctionStatusMix,
      gbAuctionParticipation, featureAdoption,
      grStatusMix, grProgress, grCities, grOffers,
      forecasts, lowStock, lowStockRisk, fraud,
      users, sellers, orders, products,
    };
  }, [data]);

  const hasOrders = m.orders.length > 0;
  const hasUsers = m.users.length > 0;
  const hasProducts = m.products.length > 0;
  const hasSellers = m.sellers.length > 0;

  const DOMAINS = [
    { id: 'all', label: 'Everything', icon: Layers },
    { id: 'commerce', label: 'Order Governance', icon: Package },
    { id: 'sellers', label: 'Seller Hub', icon: Store },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Products', icon: Boxes },
    { id: 'groupbuy', label: 'Group Buying', icon: TrendingUp },
    { id: 'wholesale', label: 'Wholesale', icon: Coins },
    { id: 'auctions', label: 'Reverse & Auctions', icon: Gavel },
    { id: 'groupreverse', label: 'Group Reverse', icon: Target },
    { id: 'forecast', label: 'Forecasting', icon: Brain },
  ];

  const show = (id) => domain === 'all' || domain === id;
  const anyFailed = Object.values(failed).some(Boolean);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <RefreshCw className="w-7 h-7 animate-spin text-rose-400" />
        <p className="text-sm font-medium">Building the analytics engine…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase text-rose-450 tracking-wider">Platform Analytics Engine</h3>
          <p className="text-[11px] text-slate-500">
            Every domain in one place, computed from live platform data
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {anyFailed && (
        <div className="rounded-2xl border border-amber-800 bg-amber-950/30 p-3 text-amber-200 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Some data could not be loaded, so the charts below are partial rather than absent:{' '}
            {Object.entries(failed).filter(([, v]) => v).map(([k]) => k).join(', ')}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile icon={Coins} label="Platform revenue" value={money(m.revenue)} hint="all time" accent="text-emerald-400" />
        <StatTile icon={Package} label="Orders" value={m.orderCount.toLocaleString()} hint={`${m.aov ? money(m.aov) : '—'} average`} />
        <StatTile icon={Activity} label="Discounts given" value={money(m.totalDiscount)} hint="customer savings" accent="text-amber-400" />
        <StatTile icon={Users} label="Customers" value={m.users.length.toLocaleString()} hint={`${m.buyingCustomers.size} have ordered`} />
        <StatTile icon={Store} label="Sellers" value={m.sellers.length.toLocaleString()} hint={`${m.verifiedSellers} verified`} accent="text-sky-400" />
        <StatTile icon={Boxes} label="Catalog" value={m.products.length.toLocaleString()} hint={`${money(m.inventoryValue)} stock value`} accent="text-violet-400" />
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Analytics domain">
        {DOMAINS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setDomain(option.id)}
              aria-pressed={domain === option.id}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition inline-flex items-center gap-1.5 ${
                domain === option.id ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {option.label}
            </button>
          );
        })}
      </nav>

      {show('commerce') && (
        <div className="space-y-4">
          <SectionTitle icon={Package} title="Order Governance" subtitle="Revenue, order states, and basket shape" />

          <ChartCard
            title="Revenue and order volume"
            subtitle="As reported by the platform analytics rollup"
            legend={[
              { label: 'Revenue', color: SERIES[0] },
              { label: 'Orders (right axis)', color: SERIES[3] },
            ]}
            empty={m.revenueTrends.length === 0}
            emptyText="No revenue trend reported yet."
            table={{
              columns: [
                ['Period', (row) => periodLabel(row.date)],
                ['Revenue', (row) => money(row.revenue), 'right'],
                ['Orders', (row) => row.orders.toLocaleString(), 'right'],
              ],
              rows: m.revenueTrends,
              rowKey: (row) => String(row.date),
            }}
          >
            <RevenueOrdersTrend
              data={m.revenueTrends}
              xKey="date"
              revenueKey="revenue"
              ordersKey="orders"
              height={280}
              xFormatter={periodLabel}
            />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Category market share"
              subtitle="Revenue share of every category that has sold"
              empty={m.categorySales.every((r) => r.revenue <= 0)}
              emptyText="No category sales recorded yet."
              table={{
                columns: [
                  ['Category', (row) => row.name],
                  ['Revenue', (row) => money(row.revenue), 'right'],
                  ['Share', (row) => formatPercent(share(row.revenue, m.revenue)), 'right'],
                  ['Units', (row) => row.units.toLocaleString(), 'right'],
                ],
                rows: m.categorySales,
                rowKey: (row) => row.name,
              }}
            >
              <Donut data={m.categorySales.map((r) => ({ name: r.name, value: r.revenue }))} nameKey="name" valueKey="value" valueFormatter={moneyAxis} />
            </ChartCard>

            <ChartCard
              title="Top products by revenue"
              subtitle="Platform best sellers, ranked"
              empty={m.topProducts.length === 0}
              emptyText="No product sales recorded yet."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Revenue', (row) => money(row.revenue), 'right'],
                  ['Units', (row) => row.units.toLocaleString(), 'right'],
                ],
                rows: m.topProducts,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.topProducts} labelKey="name" valueKey="revenue" label="Revenue" valueFormatter={moneyAxis} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Order states"
              subtitle="Where every order sits"
              empty={!hasOrders}
              emptyText="No orders yet."
            >
              <Donut data={m.orderStatusMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>
            <ChartCard
              title="Order types"
              subtitle="Regular against every collective feature"
              empty={!hasOrders}
              emptyText="No orders yet."
            >
              <SplitBar
                segments={m.orderTypeMix.map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
                total={m.orders.length}
                valueFormatter={(v) => `${v} order${Number(v) === 1 ? '' : 's'}`}
              />
            </ChartCard>
            <ChartCard
              title="Payment methods"
              subtitle="Which gateway orders complete on"
              empty={!hasOrders}
              emptyText="No payments yet."
            >
              <SplitBar
                segments={m.paymentMix.map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
                total={m.orders.length}
                valueFormatter={(v) => `${v} order${Number(v) === 1 ? '' : 's'}`}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Basket size distribution"
              subtitle="Many small orders against a few large ones"
              empty={!hasOrders}
              emptyText="No orders yet."
              table={{
                columns: [
                  ['Band', (row) => row.label],
                  ['Orders', (row) => row.count.toLocaleString(), 'right'],
                  ['Share', (row) => formatPercent(share(row.count, m.orders.length)), 'right'],
                ],
                rows: m.orderBands,
                rowKey: (row) => row.label,
              }}
            >
              <Columns data={m.orderBands} xKey="label" valueKey="count" label="Orders" color={SERIES[1]} />
            </ChartCard>

            <ChartCard
              title="Revenue by delivery city"
              subtitle="Where the demand actually sits geographically"
              empty={m.citySpend.length === 0}
              emptyText="No shipped orders yet."
              table={{
                columns: [
                  ['City', (row) => row.name],
                  ['Revenue', (row) => money(row.value), 'right'],
                ],
                rows: m.citySpend,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.citySpend} labelKey="name" valueKey="value" label="Revenue" valueFormatter={moneyAxis} />
            </ChartCard>
          </div>
        </div>
      )}

      {show('sellers') && (
        <div className="space-y-4">
          <SectionTitle icon={Store} title="Seller Hub" subtitle="Verification, ratings, and store economics" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Verification status"
              subtitle="Trust posture across the seller base"
              empty={!hasSellers}
              emptyText="No sellers registered yet."
            >
              <Donut data={m.sellerVerification} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Seller rating spread"
              subtitle="How the seller base is rated"
              empty={m.ratingBuckets.every((b) => b.count === 0)}
              emptyText="No seller ratings yet."
              table={{
                columns: [
                  ['Rating', (row) => row.star],
                  ['Sellers', (row) => row.count, 'right'],
                ],
                rows: m.ratingBuckets,
                rowKey: (row) => row.star,
              }}
            >
              <RatingHistogram data={m.ratingBuckets} xKey="star" valueKey="count" />
            </ChartCard>

            <ChartCard
              title="Store profile completeness"
              subtitle="Share of sellers with each field completed"
              empty={!hasSellers}
              emptyText="No sellers registered yet."
              table={{
                columns: [
                  ['Field', (row) => row.dimension],
                  ['Adoption', (row) => formatPercent(row.value), 'right'],
                ],
                rows: m.policyAdoption,
                rowKey: (row) => row.dimension,
              }}
            >
              <Columns
                data={m.policyAdoption}
                xKey="dimension"
                valueKey="value"
                label="Adoption"
                height={230}
                valueFormatter={(v) => formatPercent(v)}
                color={SERIES[2]}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Top stores by lifetime sales"
              subtitle="The sellers carrying the most volume"
              empty={m.topSellers.length === 0}
              emptyText="No store has recorded a sale yet."
              table={{
                columns: [['Store', (row) => row.name], ['Units sold', (row) => row.value.toLocaleString(), 'right']],
                rows: m.topSellers,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.topSellers} labelKey="name" valueKey="value" label="Units sold" valueFormatter={countAxis} />
            </ChartCard>

            <ChartCard
              title="Rating against sales volume"
              subtitle="Whether reputation tracks trade for each store"
              empty={m.sellerRatingSpread.length === 0}
              emptyText="No rated stores yet."
            >
              <Scatter
                data={m.sellerRatingSpread}
                xKey="sales"
                yKey="rating"
                nameKey="name"
                xLabel="Lifetime sales"
                yLabel="Rating"
                xFormatter={countAxis}
                yFormatter={(v) => num(v).toFixed(1)}
                domainMax={5}
              />
            </ChartCard>
          </div>
        </div>
      )}

      {show('customers') && (
        <div className="space-y-4">
          <SectionTitle icon={Users} title="Customers Directory" subtitle="Growth, composition, and engagement" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Accounts by role"
              subtitle="Everyone registered on the platform"
              empty={!hasUsers}
              emptyText="No accounts yet."
            >
              <Donut data={m.roleMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Account standing"
              subtitle="Active against suspended"
              empty={!hasUsers}
              emptyText="No accounts yet."
            >
              <Donut data={m.activeMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Purchase conversion"
              subtitle="Registered accounts that have ever ordered"
              empty={!hasUsers}
              emptyText="No accounts yet."
            >
              <SplitBar
                segments={m.customerEngagement.map((row, i) => ({
                  label: row.name, value: row.value, color: SERIES[i % SERIES.length],
                }))}
                total={m.users.length}
                valueFormatter={(v) => `${v} account${Number(v) === 1 ? '' : 's'}`}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Account signups"
            subtitle="New registrations per month"
            empty={m.signups.length === 0}
            emptyText="No registrations yet."
            table={{
              columns: [['Month', (row) => periodLabel(row.month)], ['Signups', (row) => row.count, 'right']],
              rows: m.signups,
              rowKey: (row) => row.month,
            }}
          >
            <GrowthArea data={m.signups} xKey="month" dataKey="count" label="Signups" height={260} xFormatter={periodLabel} valueFormatter={countAxis} />
          </ChartCard>
        </div>
      )}

      {show('products') && (
        <div className="space-y-4">
          <SectionTitle icon={Boxes} title="Product Management" subtitle="Catalog composition, pricing, and stock" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Catalog by category"
              subtitle="How the catalog is spread"
              empty={!hasProducts}
              emptyText="No products yet."
            >
              <Donut data={m.productByCategory} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Stock health"
              subtitle="Listings at risk of going unavailable"
              empty={!hasProducts}
              emptyText="No products yet."
              table={{
                columns: [
                  ['Band', (row) => row.name],
                  ['Products', (row) => row.value, 'right'],
                  ['Share', (row) => formatPercent(share(row.value, m.products.length)), 'right'],
                ],
                rows: m.stockBuckets,
                rowKey: (row) => row.name,
              }}
            >
              <Donut data={m.stockBuckets} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Price bands"
              subtitle="Where the catalog sits on price"
              empty={!hasProducts}
              emptyText="No products yet."
              table={{
                columns: [
                  ['Band', (row) => row.label],
                  ['Products', (row) => row.count, 'right'],
                ],
                rows: m.priceBands,
                rowKey: (row) => row.label,
              }}
            >
              <Columns data={m.priceBands} xKey="label" valueKey="count" label="Products" color={SERIES[3]} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Most reviewed products"
              subtitle="Social proof, ranked by review volume"
              empty={m.bestSellers.length === 0}
              emptyText="No reviews yet."
              table={{
                columns: [['Product', (row) => row.name], ['Reviews', (row) => row.value, 'right']],
                rows: m.bestSellers,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.bestSellers} labelKey="name" valueKey="value" label="Reviews" valueFormatter={countAxis} />
            </ChartCard>

            <ChartCard
              title="Rating against review volume"
              subtitle="Whether rating tracks how much a product has sold"
              empty={m.topRated.length === 0}
              emptyText="No rated products yet."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Rating', (row) => row.rating.toFixed(1), 'right'],
                  ['Reviews', (row) => row.reviews, 'right'],
                ],
                rows: m.topRated,
                rowKey: (row) => row.name,
              }}
            >
              <Scatter
                data={m.topRated}
                xKey="reviews"
                yKey="rating"
                nameKey="name"
                xLabel="Reviews"
                yLabel="Rating"
                xFormatter={countAxis}
                yFormatter={(v) => num(v).toFixed(1)}
                domainMax={5}
                color={SERIES[2]}
              />
            </ChartCard>
          </div>
        </div>
      )}

      {show('groupbuy') && (
        <div className="space-y-4">
          <SectionTitle icon={TrendingUp} title="Group Buying" subtitle="Campaign health, economics, and seller performance" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Campaign lifecycle"
              subtitle="Every campaign and where it stands"
              empty={m.gbCampaignStatusMix.length === 0}
              emptyText="No group buying campaigns yet."
            >
              <Donut data={m.gbCampaignStatusMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Group states"
              subtitle="Formed groups, from open to closed"
              empty={m.gbGroupMix.length === 0}
              emptyText="No groups formed yet."
            >
              <Donut data={m.gbGroupMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Campaign outcomes"
              subtitle="Success against failure and cancellation"
              empty={m.gbOutcomes.length === 0}
              emptyText="No closed campaigns yet."
              table={{
                columns: [
                  ['Outcome', (row) => row.name],
                  ['Campaigns', (row) => row.value, 'right'],
                ],
                rows: m.gbOutcomes,
                rowKey: (row) => row.name,
              }}
            >
              <Donut data={m.gbOutcomes} nameKey="name" valueKey="value" height={230} />
            </ChartCard>
          </div>

          <ChartCard
            title="Group buying over time"
            subtitle="Participants, revenue, and refunds from the reporting endpoint"
            legend={[
              { label: 'Revenue', color: SERIES[0] },
              { label: 'Participants (right axis)', color: SERIES[3] },
            ]}
            empty={m.gbDaily.length === 0}
            emptyText="No reporting window data yet."
            table={{
              columns: [
                ['Day', (row) => periodLabel(row.date)],
                ['Revenue', (row) => money(row.revenue), 'right'],
                ['Participants', (row) => row.participants, 'right'],
                ['Savings', (row) => money(row.savings), 'right'],
                ['Refunds', (row) => money(row.refunds), 'right'],
              ],
              rows: m.gbDaily,
              rowKey: (row) => String(row.date),
            }}
          >
            <RevenueOrdersTrend
              data={m.gbDaily}
              xKey="date"
              revenueKey="revenue"
              ordersKey="participants"
              height={280}
              xFormatter={periodLabel}
            />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Seller leaderboard"
              subtitle="Revenue driven through group buying"
              empty={m.gbSellers.length === 0}
              emptyText="No seller group buying revenue yet."
              table={{
                columns: [
                  ['Seller', (row) => row.name],
                  ['Revenue', (row) => money(row.revenue), 'right'],
                  ['Units', (row) => row.units.toLocaleString(), 'right'],
                  ['Success', (row) => formatPercent(row.rate / 100), 'right'],
                ],
                rows: m.gbSellers,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.gbSellers} labelKey="name" valueKey="revenue" label="Revenue" valueFormatter={moneyAxis} />
            </ChartCard>

            <ChartCard
              title="Discount depth against conversion"
              subtitle="Whether deeper discounts actually convert better"
              empty={m.gbCampaigns.length === 0}
              emptyText="No campaign performance yet."
              table={{
                columns: [
                  ['Campaign', (row) => row.name],
                  ['Discount', (row) => formatPercent(row.discount), 'right'],
                  ['Success', (row) => formatPercent(row.successRate), 'right'],
                  ['Revenue', (row) => money(row.revenue), 'right'],
                ],
                rows: m.gbCampaigns,
                rowKey: (row) => row.name,
              }}
            >
              <Scatter
                data={m.gbCampaigns}
                xKey="discount"
                yKey="successRate"
                nameKey="name"
                xLabel="Max discount %"
                yLabel="Success rate %"
                xFormatter={(v) => `${num(v).toFixed(1)}%`}
                yFormatter={(v) => `${num(v).toFixed(0)}%`}
                color={SERIES[1]}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Campaign economics"
              subtitle="Revenue against cost and realised profit"
              empty={m.gbCampaigns.every((c) => c.revenue <= 0)}
              emptyText="No campaign revenue yet."
              legend={[
                { label: 'Revenue', color: SERIES[0] },
                { label: 'Cost', color: SERIES[1] },
                { label: 'Profit', color: SERIES[2] },
              ]}
              table={{
                columns: [
                  ['Campaign', (row) => row.name],
                  ['Revenue', (row) => money(row.revenue), 'right'],
                  ['Cost', (row) => money(row.cost), 'right'],
                  ['Profit', (row) => money(row.profit), 'right'],
                  ['Margin', (row) => formatPercent(row.margin), 'right'],
                ],
                rows: m.gbCampaigns,
                rowKey: (row) => row.name,
              }}
            >
              <StackedBars
                data={m.gbCampaigns.slice(0, 10)}
                xKey="name"
                series={[
                  { key: 'revenue', label: 'Revenue', color: SERIES[0] },
                  { key: 'cost', label: 'Cost', color: SERIES[1] },
                  { key: 'profit', label: 'Profit', color: SERIES[2] },
                ]}
                height={280}
                xFormatter={(name) => (String(name).length > 12 ? `${String(name).slice(0, 12)}…` : name)}
                valueFormatter={moneyAxis}
              />
            </ChartCard>

            <ChartCard
              title="Success rate by discount band"
              subtitle="Which discount depth actually closes groups"
              empty={m.gbDiscountBands.every((b) => b.campaigns === 0)}
              emptyText="No discount band data yet."
              table={{
                columns: [
                  ['Band', (row) => row.label],
                  ['Campaigns', (row) => row.campaigns, 'right'],
                  ['Success', (row) => formatPercent(row.successRate), 'right'],
                  ['Revenue', (row) => money(row.revenue), 'right'],
                ],
                rows: m.gbDiscountBands,
                rowKey: (row) => row.label,
              }}
            >
              <Columns
                data={m.gbDiscountBands}
                xKey="label"
                valueKey="successRate"
                label="Success rate"
                height={280}
                valueFormatter={(v) => formatPercent(v)}
                color={SERIES[4]}
              />
            </ChartCard>
          </div>
        </div>
      )}

      {show('wholesale') && (
        <div className="space-y-4">
          <SectionTitle icon={Coins} title="Wholesale (CWP)" subtitle="Offer pipeline and lot outcomes" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Offer pipeline"
              subtitle="Wholesale offers by approval state"
              empty={m.wholesaleStatusMix.length === 0}
              emptyText="No wholesale offers yet."
            >
              <Donut data={m.wholesaleStatusMix} nameKey="name" valueKey="value" />
            </ChartCard>

            <ChartCard
              title="Lot outcomes"
              subtitle="Every lot across all wholesale offers"
              empty={m.lotTotals.active + m.lotTotals.completed + m.lotTotals.failed === 0}
              emptyText="No lots created yet."
              table={{
                columns: [
                  ['Outcome', (row) => row.name],
                  ['Lots', (row) => row.value, 'right'],
                ],
                rows: [
                  { name: 'Active', value: m.lotTotals.active },
                  { name: 'Completed', value: m.lotTotals.completed },
                  { name: 'Failed', value: m.lotTotals.failed },
                ],
                rowKey: (row) => row.name,
              }}
            >
              <Donut
                data={[
                  { name: 'Active', value: m.lotTotals.active },
                  { name: 'Completed', value: m.lotTotals.completed },
                  { name: 'Failed', value: m.lotTotals.failed },
                ]}
                nameKey="name"
                valueKey="value"
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Available wholesale supply"
            subtitle="How much stock is on offer versus the lot minimum"
            empty={m.wholesaleSupply.length === 0}
            emptyText="No wholesale supply available."
            legend={[
              { label: 'Available quantity', color: SERIES[0] },
              { label: 'Lot minimum', color: SERIES[1] },
            ]}
            table={{
              columns: [
                ['Product', (row) => row.name],
                ['Available', (row) => row.available.toLocaleString(), 'right'],
                ['Minimum', (row) => row.minimum.toLocaleString(), 'right'],
              ],
              rows: m.wholesaleSupply,
              rowKey: (row) => row.name,
            }}
          >
            <StackedBars
              data={m.wholesaleSupply}
              xKey="name"
              series={[
                { key: 'available', label: 'Available quantity', color: SERIES[0] },
                { key: 'minimum', label: 'Lot minimum', color: SERIES[1] },
              ]}
              xFormatter={(name) => (String(name).length > 12 ? `${String(name).slice(0, 12)}…` : name)}
              valueFormatter={countAxis}
            />
          </ChartCard>
        </div>
      )}

      {show('auctions') && (
        <div className="space-y-4">
          <SectionTitle icon={Gavel} title="Reverse Buys &amp; Auctions" subtitle="Seller-led reverse buying, proxy auctions, and collective auctions" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Seller-led reverse campaigns"
              subtitle="Campaign lifecycle"
              empty={m.rgbStatusMix.length === 0}
              emptyText="No reverse campaigns yet."
            >
              <Donut data={m.rgbStatusMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Proxy auctions"
              subtitle="Every auction by state"
              empty={m.auctionStatusMix.length === 0}
              emptyText="No auctions yet."
            >
              <Donut data={m.auctionStatusMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="Collective auctions"
              subtitle="Group buying auction lifecycle"
              empty={m.gbAuctionStatusMix.length === 0}
              emptyText="No collective auctions yet."
            >
              <Donut data={m.gbAuctionStatusMix} nameKey="name" valueKey="value" height={230} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Reverse campaign progress"
              subtitle="Demand raised against target, per campaign"
              empty={m.rgbProgress.length === 0}
              emptyText="No reverse campaigns yet."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Progress', (row) => formatPercent(row.progress), 'right'],
                  ['Demand', (row) => row.demand.toLocaleString(), 'right'],
                  ['Target', (row) => row.target.toLocaleString(), 'right'],
                ],
                rows: m.rgbProgress,
                rowKey: (row) => row.name,
              }}
            >
              <Columns
                data={m.rgbProgress}
                xKey="name"
                valueKey="progress"
                label="Progress"
                height={260}
                xFormatter={(name) => (String(name).length > 10 ? `${String(name).slice(0, 10)}…` : name)}
                valueFormatter={(v) => formatPercent(v)}
                color={SERIES[2]}
              />
            </ChartCard>

            <ChartCard
              title="Auction bid activity"
              subtitle="Bids placed and how many distinct bidders"
              empty={m.auctionBidding.length === 0}
              emptyText="No bidding activity yet."
              legend={[
                { label: 'Bids placed', color: SERIES[0] },
                { label: 'Distinct bidders', color: SERIES[3] },
              ]}
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Bids', (row) => row.bids, 'right'],
                  ['Bidders', (row) => row.bidders, 'right'],
                ],
                rows: m.auctionBidding,
                rowKey: (row) => row.name,
              }}
            >
              <StackedBars
                data={m.auctionBidding}
                xKey="name"
                series={[
                  { key: 'bids', label: 'Bids placed', color: SERIES[0] },
                  { key: 'bidders', label: 'Distinct bidders', color: SERIES[3] },
                ]}
                height={260}
                xFormatter={(name) => (String(name).length > 10 ? `${String(name).slice(0, 10)}…` : name)}
                valueFormatter={countAxis}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Collective auction fill rate"
              subtitle="Units pledged against the minimum needed to trigger"
              empty={m.gbAuctionParticipation.length === 0}
              emptyText="No collective auctions yet."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Pledged', (row) => row.collective.toLocaleString(), 'right'],
                  ['Minimum', (row) => row.minimum.toLocaleString(), 'right'],
                  ['Participants', (row) => row.participants.toLocaleString(), 'right'],
                ],
                rows: m.gbAuctionParticipation,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars
                data={m.gbAuctionParticipation}
                labelKey="name"
                valueKey="collective"
                label="Units pledged"
                valueFormatter={countAxis}
              />
            </ChartCard>

            <ChartCard
              title="Collective feature adoption"
              subtitle="Share of orders placed through each marketplace feature"
              empty={!hasOrders}
              emptyText="No orders yet."
            >
              <Radar
                data={m.featureAdoption}
                angleKey="dimension"
                series={[{ key: 'value', label: 'Share of orders %', color: SERIES[0] }]}
              />
            </ChartCard>
          </div>
        </div>
      )}

      {show('groupreverse') && (
        <div className="space-y-4">
          <SectionTitle icon={Target} title="Group Reverse Buying" subtitle="Customer-led buying groups and their offers" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Demand lifecycle"
              subtitle="Where every customer-led group stands"
              empty={m.grStatusMix.length === 0}
              emptyText="No group reverse demands yet."
            >
              <Donut data={m.grStatusMix} nameKey="name" valueKey="value" />
            </ChartCard>

            <ChartCard
              title="Committed quantity"
              subtitle="Units pledged against the quantity each group needs"
              empty={m.grProgress.length === 0}
              emptyText="No group reverse demands yet."
              legend={[
                { label: 'Committed', color: SERIES[0] },
                { label: 'Still required', color: SERIES[1] },
              ]}
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Progress', (row) => formatPercent(row.percent), 'right'],
                  ['Committed', (row) => row.committed.toLocaleString(), 'right'],
                  ['Required', (row) => row.required.toLocaleString(), 'right'],
                  ['Members', (row) => row.members, 'right'],
                ],
                rows: m.grProgress,
                rowKey: (row) => row.name,
              }}
            >
              <StackedBars
                data={m.grProgress.map((row) => ({ ...row, remaining: Math.max(0, row.required - row.committed) }))}
                xKey="name"
                series={[
                  { key: 'committed', label: 'Committed', color: SERIES[0] },
                  { key: 'remaining', label: 'Still required', color: SERIES[1] },
                ]}
                height={280}
                xFormatter={(name) => (String(name).length > 10 ? `${String(name).slice(0, 10)}…` : name)}
                valueFormatter={countAxis}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Offers received per group"
              subtitle="Seller response depth, with the saving each group secured"
              empty={m.grOffers.length === 0}
              emptyText="No seller offers received yet."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Offers', (row) => row.offers, 'right'],
                  ['Members', (row) => row.members, 'right'],
                  ['Saving', (row) => formatPercent(row.discount), 'right'],
                ],
                rows: m.grOffers,
                rowKey: (row) => row.name,
              }}
            >
              <Scatter
                data={m.grOffers}
                xKey="offers"
                yKey="discount"
                nameKey="name"
                xLabel="Offers received"
                yLabel="Saving %"
                xFormatter={countAxis}
                yFormatter={(v) => `${num(v).toFixed(0)}%`}
                color={SERIES[4]}
              />
            </ChartCard>

            <ChartCard
              title="Committed units by delivery city"
              subtitle="Where customer-led groups are forming"
              empty={m.grCities.length === 0}
              emptyText="No delivery cities recorded yet."
              table={{
                columns: [
                  ['City', (row) => row.name],
                  ['Units committed', (row) => row.value.toLocaleString(), 'right'],
                ],
                rows: m.grCities,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.grCities} labelKey="name" valueKey="value" label="Units committed" valueFormatter={countAxis} />
            </ChartCard>
          </div>
        </div>
      )}

      {show('forecast') && (
        <div className="space-y-4">
          <SectionTitle icon={Brain} title="Forecasting &amp; Risk" subtitle="Predicted revenue, stock risk, and fraud signals" />

          <ChartCard
            title="Revenue forecast"
            subtitle={`Projected revenue and order volume, with model confidence`}
            legend={[
              { label: 'Predicted revenue', color: SERIES[0] },
              { label: 'Predicted orders (right axis)', color: SERIES[3] },
            ]}
            empty={m.forecasts.length === 0}
            emptyText="No forecast available yet."
            table={{
              columns: [
                ['Day', (row) => periodLabel(row.date)],
                ['Predicted revenue', (row) => money(row.revenue), 'right'],
                ['Predicted orders', (row) => row.orders, 'right'],
                ['Confidence', (row) => formatPercent(row.confidence / 100), 'right'],
              ],
              rows: m.forecasts,
              rowKey: (row) => String(row.date),
            }}
          >
            <RevenueOrdersTrend
              data={m.forecasts}
              xKey="date"
              revenueKey="revenue"
              ordersKey="orders"
              height={280}
              xFormatter={periodLabel}
            />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Stockout risk"
              subtitle="Products the model expects to run out"
              empty={m.lowStock.length === 0}
              emptyText="No stockout risk detected."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['Days left', (row) => row.days, 'right'],
                  ['Stock', (row) => row.stock, 'right'],
                  ['Burn/day', (row) => row.burn, 'right'],
                  ['Risk', (row) => row.risk, 'right'],
                ],
                rows: m.lowStock,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars
                data={m.lowStock}
                labelKey="name"
                valueKey="days"
                label="Days until stockout"
                valueFormatter={countAxis}
              />
            </ChartCard>

            <ChartCard
              title="Risk distribution"
              subtitle="How severe the detected anomalies are"
              empty={m.lowStock.length === 0 && m.fraud.length === 0}
              emptyText="No risk signals detected."
            >
              <Donut
                data={m.lowStockRisk.length > 0 ? m.lowStockRisk : tally(m.fraud, (f) => f.status, () => 1)}
                nameKey="name"
                valueKey="value"
                height={240}
              />
            </ChartCard>
          </div>

          <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-emerald-400" /> Fraud signals
              </h3>
              <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-bold text-slate-300">
                {m.fraud.length} flagged
              </span>
            </div>
            {m.fraud.length > 0 ? (
              <>
                <Columns
                  data={m.fraud.slice(0, 12)}
                  xKey="order"
                  valueKey="risk"
                  label="Risk score"
                  height={220}
                  valueFormatter={(v) => num(v).toFixed(0)}
                  color={SERIES[4]}
                />
                <ul className="space-y-1.5 max-h-48 overflow-auto">
                  {m.fraud.slice(0, 12).map((row) => (
                    <li key={row.order} className="flex flex-wrap justify-between gap-2 p-2 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px]">
                      <span className="font-mono text-rose-300">{row.order}</span>
                      <span className="text-slate-400 truncate">{row.customer}</span>
                      <span className="font-mono text-slate-300">{money(row.amount)}</span>
                      <span className="font-bold text-amber-400">risk {row.risk}</span>
                      <span className="text-slate-500 w-full sm:w-auto sm:flex-1 sm:text-right">{row.reason}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                No fraud anomalies detected.
              </p>
            )}
          </section>

          {Array.isArray(data.bi?.aiBusinessSuggestions) && data.bi.aiBusinessSuggestions.length > 0 && (
            <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-rose-400" /> Suggested actions
              </h3>
              <ul className="space-y-2">
                {data.bi.aiBusinessSuggestions.map((suggestion, index) => (
                  <li key={index} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-[11px] text-slate-300 flex gap-2">
                    <Wallet className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Boxes,
  Coins,
  Package,
  Percent,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  ChartCard,
  Columns,
  Donut,
  RankedBars,
  RatingHistogram,
  RevenueOrdersTrend,
  SERIES,
  SplitBar,
  compactMoney,
  periodSafeLabel,
  shortDate,
} from '../../groupbuy/analytics/charts';
import { formatMoney, formatPercent } from '../../groupbuy/format';

/**
 * A stat tile that states what the number means, and how it moved.
 *
 * <p>`trend` is a fraction of change against the previous period (0.2 = up 20%). It is optional
 * because several of these totals have no earlier period to compare against yet.
 */
function StatTile({ icon: Icon, label, value, hint, trend, accent = 'text-indigo-400', children }) {
  const up = Number(trend) > 0;
  const flat = !trend || Math.abs(Number(trend)) < 0.0005;
  return (
    <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
        <Icon className={`w-4 h-4 ${accent} shrink-0`} />
      </div>
      <p className="text-xl font-black text-white leading-tight">{value}</p>
      <div className="flex items-center gap-2 min-h-[14px]">
        {!flat && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {formatPercent(Math.abs(Number(trend)) * 100)}
          </span>
        )}
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Sum of an order's money fields, tolerating a backend that reports any one of them. */
const orderTotal = (order) => {
  const value = Number(order.totalAmount ?? order.total ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const orderDate = (order) => {
  const parsed = new Date(order.createdAt || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Buckets an order into a local `YYYY-MM-DD` key so it lines up with the trend series. */
const dayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Midnight, `days` days back.
 *
 * <p>Always derived from a fresh `Date` rather than from another Date's `getDate()`. Subtracting
 * from a day-of-month lands in the wrong month whenever the arithmetic crosses a boundary, which
 * silently shifted the prior-period window used for the trend arrows.
 */
const daysAgo = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};

const withinDays = (date, days) => {
  if (!date) return false;
  return date >= daysAgo(days - 1);
};

/**
 * Axis label for a period key that may be an ISO date or an already-formatted label.
 *
 * <p>Delegated to the shared chart kit so this page and the admin engine cannot drift apart on how a
 * period bucket is rendered. The analytics rollup returns "Sep 27" while the series built from live
 * orders uses `YYYY-MM-DD`, and the shared helper handles both.
 */
const periodLabel = (value) => periodSafeLabel(value);

const RANGES = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
];

const ORDER_STATUS_META = {
  PENDING: { label: 'Pending', color: SERIES[3] },
  CONFIRMED: { label: 'Confirmed', color: SERIES[0] },
  PROCESSING: { label: 'Processing', color: SERIES[2] },
  SHIPPED: { label: 'Shipped', color: SERIES[4] },
  DELIVERED: { label: 'Delivered', color: SERIES[1] },
  CANCELLED: { label: 'Cancelled', color: '#64748b' },
  REFUNDED: { label: 'Refunded', color: '#94a3b8' },
};

const PAYMENT_LABELS = {
  CREDIT_CARD: 'Credit card',
  PAYPAL: 'PayPal',
  STRIPE: 'Stripe',
  CASH_ON_DELIVERY: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
};

const ORDER_TYPE_LABELS = {
  STANDARD: 'Standard orders',
  GROUP_BUY: 'Group buying',
  WHOLESALE: 'Wholesale (CWP)',
  AUCTION: 'Auction',
  GROUP_BUYING_AUCTION: 'Group buying auction',
  GROUP_REVERSE_BUYING: 'Customer-led group reverse',
  REVERSE_GROUP_BUYING: 'Seller-led reverse group buying',
};

/**
 * The seller's whole picture on one screen.
 *
 * <p>Everything here is derived from data the page already loads - the analytics rollup, the live
 * order list, inventory, reviews, wallet and coupons - so nothing here needs another round trip.
 * The range control narrows the order-derived charts; the server-side rollup has whatever window
 * it was computed over, so its numbers are labelled with their own period rather than silently
 * re-windowed.
 */
export default function SellerOverviewTab({ store, analytics, orders, products, inventoryList, reviews, wallet, coupons }) {
  const [range, setRange] = useState(30);

  const orderList = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const productList = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const inventory = useMemo(() => (Array.isArray(inventoryList) ? inventoryList : []), [inventoryList]);
  const reviewList = useMemo(() => (Array.isArray(reviews) ? reviews : []), [reviews]);
  const couponList = useMemo(() => (Array.isArray(coupons) ? coupons : []), [coupons]);

  const scopedOrders = useMemo(
    () => orderList.filter((o) => withinDays(orderDate(o), range)),
    [orderList, range],
  );

  // Daily series built from the orders themselves, so the range control is honest. The backend
  // rollup only supplies a prior-period comparison for the trend arrows.
  const daily = useMemo(() => {
    const buckets = new Map();
    const windowStart = daysAgo(range - 1);

    for (const order of scopedOrders) {
      const date = orderDate(order);
      if (!date) continue;
      const key = dayKey(date);
      const row = buckets.get(key) || { date: key, revenue: 0, orders: 0, aov: 0 };
      row.revenue += orderTotal(order);
      row.orders += 1;
      buckets.set(key, row);
    }

    const rows = [];
    for (let i = range - 1; i >= 0; i--) {
      const day = new Date(windowStart);
      day.setDate(windowStart.getDate() + i);
      const key = dayKey(day);
      const row = buckets.get(key) || { date: key, revenue: 0, orders: 0 };
      row.aov = row.orders > 0 ? row.revenue / row.orders : 0;
      rows.push(row);
    }
    return rows;
  }, [scopedOrders, range]);

  const rangeRevenue = useMemo(
    () => daily.reduce((sum, row) => sum + row.revenue, 0),
    [daily],
  );
  // Orders falling in the equivalent window immediately before the selected range, used as the
  // baseline for the trend arrows.
  const priorOrders = useMemo(() => {
    const windowStart = daysAgo(range * 2);
    const windowEnd = daysAgo(range);
    return orderList.filter((o) => {
      const date = orderDate(o);
      return date && date >= windowStart && date < windowEnd;
    });
  }, [orderList, range]);

  const priorRevenue = useMemo(
    () => priorOrders.reduce((sum, o) => sum + orderTotal(o), 0),
    [priorOrders],
  );

  const revenueTrend = priorRevenue > 0 ? (rangeRevenue - priorRevenue) / priorRevenue : null;

  const rangeAov = scopedOrders.length > 0 ? rangeRevenue / scopedOrders.length : 0;
  const priorAov = priorOrders.length > 0
    ? priorOrders.reduce((sum, o) => sum + orderTotal(o), 0) / priorOrders.length
    : null;
  const aovTrend = priorAov ? (rangeAov - priorAov) / priorAov : null;

  const statusMix = useMemo(() => {
    const counts = new Map();
    for (const order of orderList) {
      const meta = ORDER_STATUS_META[order.status];
      const label = meta ? meta.label : order.status || 'Unknown';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orderList]);

  const paymentMix = useMemo(() => {
    const counts = new Map();
    for (const order of orderList) {
      const label = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || 'Unspecified';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orderList]);

  const orderTypeMix = useMemo(() => {
    const counts = new Map();
    for (const order of orderList) {
      const label = ORDER_TYPE_LABELS[order.orderType] || order.orderType || 'Standard orders';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orderList]);

  const ratingBuckets = useMemo(() => {
    const buckets = [5, 4, 3, 2, 1].map((star) => ({ star: `${star}★`, count: 0 }));
    for (const review of reviewList) {
      const rating = Math.round(Number(review.rating) || 0);
      const row = buckets.find((b) => b.star === `${rating}★`);
      if (row) row.count += 1;
    }
    return buckets;
  }, [reviewList]);

  const ratingAverage = useMemo(() => {
    const numeric = reviewList.map((r) => Number(r.rating)).filter((n) => Number.isFinite(n) && n > 0);
    if (numeric.length === 0) return Number(store?.rating ?? 0);
    return numeric.reduce((sum, n) => sum + n, 0) / numeric.length;
  }, [reviewList, store]);

  const stockBuckets = useMemo(() => {
    const healthy = [], low = [], out = [];
    for (const row of inventory) {
      const stock = Number(row.currentStock ?? 0);
      if (stock <= 0) out.push(row);
      else if (row.lowStock || stock <= Number(row.lowStockThreshold ?? 5)) low.push(row);
      else healthy.push(row);
    }
    return { healthy, low, out };
  }, [inventory]);

  const topInventory = useMemo(
    () =>
      [...inventory]
        .map((row) => ({ ...row, stock: Number(row.currentStock ?? 0) }))
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 8)
        .map((row) => ({ name: row.productName || row.productSku || 'Unnamed', stock: row.stock })),
    [inventory],
  );

  const categorySales = useMemo(() => {
    const rows = Array.isArray(analytics?.categorySales) ? analytics.categorySales : [];
    return rows
      .map((row) => ({
        name: row.categoryName || 'Uncategorised',
        revenue: Number(row.totalRevenue ?? 0),
        units: Number(row.salesCount ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [analytics]);

  const topProducts = useMemo(() => {
    const rows = Array.isArray(analytics?.topProducts) ? analytics.topProducts : [];
    return rows
      .map((row) => ({
        name: row.productName || row.sku || 'Unnamed product',
        revenue: Number(row.totalRevenue ?? 0),
        units: Number(row.unitsSold ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [analytics]);

  const revenueTrendRows = Array.isArray(analytics?.revenueTrends) ? analytics.revenueTrends : [];

  const lifetimeRevenue = Number(analytics?.totalSalesRevenue ?? analytics?.totalRevenue ?? 0);
  const totalCustomers = Number(analytics?.totalCustomers ?? 0);
  const activeCoupons = couponList.filter((c) => c.active).length;
  const couponUses = couponList.reduce((sum, c) => sum + Number(c.timesUsed ?? 0), 0);
  const walletBalance = Number(wallet?.availableBalance ?? 0);
  const walletPending = Number(wallet?.pendingBalance ?? 0);
  const walletEarned = Number(wallet?.totalEarned ?? 0);
  const walletPaidOut = Number(wallet?.totalPaidOut ?? 0);
  const walletGrossSales = Number(wallet?.grossSales ?? 0);
  // Platform commission is the gap between what customers paid and what the seller earned;
  // showing the ratio is more useful than either figure alone.
  const takeRate = walletGrossSales > 0 ? (walletEarned / walletGrossSales) * 100 : null;

  const hasOrders = orderList.length > 0;
  const hasRevenueSeries = daily.some((row) => row.revenue > 0);

  return (
    <div className="space-y-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile
          icon={Banknote}
          label={`Revenue · last ${range}d`}
          value={formatMoney(rangeRevenue)}
          hint="live orders"
          trend={revenueTrend}
        />
        <StatTile
          icon={Package}
          label={`Orders · last ${range}d`}
          value={scopedOrders.length.toLocaleString()}
          hint={`${orderList.length.toLocaleString()} lifetime`}
        />
        <StatTile
          icon={TrendingUp}
          label="Avg order value"
          value={formatMoney(rangeAov)}
          hint={`last ${range}d`}
          trend={aovTrend}
          accent="text-emerald-400"
        />
        <StatTile
          icon={Boxes}
          label="Products"
          value={Number(analytics?.totalProducts ?? productList.length).toLocaleString()}
          hint={`${inventory.length} tracked in stock`}
          accent="text-amber-400"
        />
        <StatTile
          icon={Users}
          label="Customers"
          value={totalCustomers.toLocaleString()}
          hint={totalCustomers > 0 ? `${(scopedOrders.length / totalCustomers).toFixed(2)} orders each` : 'no customers yet'}
          accent="text-sky-400"
        />
        <StatTile
          icon={Star}
          label="Store rating"
          value={ratingAverage > 0 ? ratingAverage.toFixed(2) : '—'}
          hint={`${reviewList.length} review${reviewList.length === 1 ? '' : 's'}`}
          accent="text-yellow-400"
        />
      </div>

      {/* Range control scopes every order-derived chart below. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          Order charts cover the selected range. Lifetime revenue to date is{' '}
          <span className="text-slate-300 font-mono">{formatMoney(lifetimeRevenue)}</span>.
        </p>
        <nav className="flex gap-1.5" aria-label="Chart range">
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              aria-pressed={range === option.id}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                range === option.id ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Revenue against order volume: the one chart that needs both series at once. */}
      <ChartCard
        title="Revenue and order volume"
        subtitle={`Daily for the last ${range} days, built from your live order list`}
        legend={[
          { label: 'Revenue', color: SERIES[0] },
          { label: 'Orders (right axis)', color: SERIES[3] },
        ]}
        empty={!hasRevenueSeries}
        emptyText="No revenue recorded in this range yet."
        table={{
          columns: [
            ['Day', (row) => shortDate(row.date)],
            ['Revenue', (row) => formatMoney(row.revenue), 'right'],
            ['Orders', (row) => row.orders, 'right'],
            ['Avg order', (row) => formatMoney(row.aov), 'right'],
          ],
          rows: daily,
          rowKey: (row) => row.date,
        }}
      >
        <RevenueOrdersTrend data={daily} xKey="date" revenueKey="revenue" ordersKey="orders" xFormatter={shortDate} />
      </ChartCard>

      {/* Average order value: separates big-ticket days from busy days. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Average order value by day"
          subtitle="A single large order lifts this well above the day's order count"
          empty={!hasRevenueSeries}
          emptyText="No orders in this range yet."
          table={{
            columns: [
              ['Day', (row) => shortDate(row.date)],
              ['Orders', (row) => row.orders, 'right'],
              ['Revenue', (row) => formatMoney(row.revenue), 'right'],
              ['Average', (row) => formatMoney(row.aov), 'right'],
            ],
            rows: daily,
            rowKey: (row) => row.date,
          }}
        >
          <Columns
            data={daily}
            xKey="date"
            valueKey="aov"
            label="Average order value"
            xFormatter={shortDate}
            valueFormatter={compactMoney}
            color={SERIES[1]}
          />
        </ChartCard>

        <ChartCard
          title="Order status mix"
          subtitle="Every order this store has taken, by fulfilment state"
          empty={!hasOrders}
          emptyText="No orders yet."
          table={{
            columns: [
              ['Status', (row) => row.name],
              ['Orders', (row) => row.value, 'right'],
              [
                'Share',
                (row) =>
                  formatPercent(orderList.length > 0 ? (row.value / orderList.length) * 100 : 0),
                'right',
              ],
            ],
            rows: statusMix,
            rowKey: (row) => row.name,
          }}
        >
          <Donut data={statusMix} nameKey="name" valueKey="value" />
        </ChartCard>
      </div>

      {/* Where the money actually comes from. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Revenue by category"
          subtitle="Lifetime, from the platform analytics rollup"
          empty={categorySales.length === 0 || categorySales.every((r) => r.revenue <= 0)}
          emptyText="No category sales recorded yet."
          table={{
            columns: [
              ['Category', (row) => row.name],
              ['Revenue', (row) => formatMoney(row.revenue), 'right'],
              ['Units', (row) => row.units.toLocaleString(), 'right'],
            ],
            rows: categorySales,
            rowKey: (row) => row.name,
          }}
        >
          <RankedBars data={categorySales} labelKey="name" valueKey="revenue" label="Revenue" valueFormatter={compactMoney} />
        </ChartCard>

        <ChartCard
          title="Top products by revenue"
          subtitle="Lifetime best sellers, ranked"
          empty={topProducts.length === 0 || topProducts.every((r) => r.revenue <= 0)}
          emptyText="No product sales recorded yet."
          table={{
            columns: [
              ['Product', (row) => row.name],
              ['Revenue', (row) => formatMoney(row.revenue), 'right'],
              ['Units', (row) => row.units.toLocaleString(), 'right'],
            ],
            rows: topProducts,
            rowKey: (row) => row.name,
          }}
        >
          <RankedBars data={topProducts} labelKey="name" valueKey="revenue" label="Revenue" valueFormatter={compactMoney} />
        </ChartCard>
      </div>

      {/* How orders arrive. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Payment methods"
          subtitle="Which gateway customers finish on"
          empty={paymentMix.length === 0}
          emptyText="No payment activity yet."
        >
          <SplitBar
            segments={paymentMix.slice(0, 5).map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
            total={orderList.length}
            valueFormatter={(value) => `${value} order${Number(value) === 1 ? '' : 's'}`}
          />
        </ChartCard>

        <ChartCard
          title="Order types"
          subtitle="Standard sales against the collective-buying features"
          empty={orderTypeMix.length === 0}
          emptyText="No orders yet."
        >
          <SplitBar
            segments={orderTypeMix.slice(0, 5).map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
            total={orderList.length}
            valueFormatter={(value) => `${value} order${Number(value) === 1 ? '' : 's'}`}
          />
        </ChartCard>
      </div>

      {/* Customer sentiment and stock health, the two things a seller acts on directly. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Rating distribution"
          subtitle="What customers actually scored, not just the average"
          empty={reviewList.length === 0}
          emptyText="No reviews yet."
          table={{
            columns: [
              ['Rating', (row) => row.star],
              ['Reviews', (row) => row.count, 'right'],
            ],
            rows: ratingBuckets,
            rowKey: (row) => row.star,
          }}
        >
          <RatingHistogram data={ratingBuckets} xKey="star" valueKey="count" />
        </ChartCard>

        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-white">Inventory health</h3>
              <p className="text-[11px] text-slate-500">Where stock is running out</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-bold text-slate-300">
              {inventory.length} tracked
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-emerald-950/30 border border-emerald-900/60 rounded-xl">
              <p className="text-lg font-black text-emerald-300">{stockBuckets.healthy.length}</p>
              <p className="text-[10px] text-emerald-200/70">Healthy</p>
            </div>
            <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded-xl">
              <p className="text-lg font-black text-amber-300">{stockBuckets.low.length}</p>
              <p className="text-[10px] text-amber-200/70">Low stock</p>
            </div>
            <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded-xl">
              <p className="text-lg font-black text-rose-300">{stockBuckets.out.length}</p>
              <p className="text-[10px] text-rose-200/70">Out of stock</p>
            </div>
          </div>

          {topInventory.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Stock on hand</p>
              {topInventory.map((row) => (
                <div key={row.name} className="flex items-center justify-between gap-3">
                  <span className="truncate text-slate-300">{row.name}</span>
                  <span className="font-mono tabular-nums text-slate-100 shrink-0">{row.stock}</span>
                </div>
              ))}
            </div>
          )}

          {stockBuckets.out.length > 0 && (
            <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-300" />
              <div className="text-rose-200">
                <p className="font-bold">Out of stock</p>
                <p className="text-[10px] text-rose-300/80">
                  {stockBuckets.out.slice(0, 3).map((r) => r.productName).filter(Boolean).join(', ')}
                  {stockBuckets.out.length > 3 ? ` and ${stockBuckets.out.length - 3} more` : ''}
                </p>
              </div>
            </div>
          )}

          {inventory.length === 0 && (
            <p className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              No inventory records yet.
            </p>
          )}
        </section>
      </div>

      {/* Money and promotion, the last two numbers a seller checks daily. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" /> Wallet
            </h3>
            {store?.verified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <BadgeCheck className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>
          {wallet ? (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Available to withdraw</p>
                <p className="text-2xl font-black text-white">{formatMoney(walletBalance)}</p>
              </div>
              <dl className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Pending clearance</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(walletPending)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Gross sales</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(walletGrossSales)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Total earned</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(walletEarned)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Paid out</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(walletPaidOut)}</dd>
                </div>
                {takeRate != null && (
                  <div className="flex justify-between border-t border-slate-800 pt-1.5">
                    <dt className="text-slate-400">Your share of gross</dt>
                    <dd className="font-mono tabular-nums font-bold text-emerald-400">
                      {formatPercent(takeRate)}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p className="p-4 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              No wallet activity yet.
            </p>
          )}
        </section>

        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-rose-400" /> Promotion performance
              </h3>
              <p className="text-[11px] text-slate-500">Coupon reach and redemptions</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-bold text-slate-300">
              {activeCoupons} active of {couponList.length}
            </span>
          </div>
          {couponList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {couponList.slice(0, 6).map((coupon) => (
                <div key={coupon.id} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-rose-300 truncate">{coupon.code}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        coupon.active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {coupon.active ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    {coupon.discountType === 'PERCENTAGE'
                      ? `${coupon.discountValue}% off`
                      : `${formatMoney(coupon.discountValue)} off`}
                    {coupon.minOrderAmount > 0 ? ` over ${formatMoney(coupon.minOrderAmount)}` : ''}
                  </p>
                  <p className="flex items-center gap-1 text-slate-500 text-[10px]">
                    <Coins className="w-3 h-3" /> {Number(coupon.timesUsed ?? 0)} redemption
                    {Number(coupon.timesUsed) === 1 ? '' : 's'} of {coupon.usageLimit || '∞'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-4 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              No coupons created yet.
            </p>
          )}
          {couponList.length > 0 && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> {couponUses.toLocaleString()} total redemptions
            </p>
          )}
        </section>
      </div>

      {/* The server rollup, kept separate so its own period is never confused with the range above. */}
      {revenueTrendRows.length > 0 && (
        <ChartCard
          title="Platform-reported revenue trend"
          subtitle="The analytics rollup's own window, shown as returned"
          table={{
            columns: [
              ['Period', (row) => periodLabel(row.date)],
              ['Revenue', (row) => formatMoney(row.revenue), 'right'],
              ['Orders', (row) => Number(row.orderCount ?? 0), 'right'],
            ],
            rows: revenueTrendRows,
            rowKey: (row) => row.date,
          }}
        >
          <Columns
            data={revenueTrendRows.map((row) => ({ ...row, revenue: Number(row.revenue ?? 0) }))}
            xKey="date"
            valueKey="revenue"
            label="Revenue"
            xFormatter={periodLabel}
            valueFormatter={compactMoney}
            color={SERIES[2]}
          />
        </ChartCard>
      )}
    </div>
  );
}

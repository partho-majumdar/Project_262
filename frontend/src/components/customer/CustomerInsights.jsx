import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Heart,
  Package,
  PiggyBank,
  Receipt,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  ChartCard,
  Columns,
  Donut,
  RankedBars,
  RevenueOrdersTrend,
  SERIES,
  SplitBar,
  compactMoney,
  shortMonth,
} from '../groupbuy/analytics/charts';
import { formatMoney, formatPercent } from '../groupbuy/format';

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Midnight on the first of the month, `months` months back. */
const monthsAgo = (months) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  return date;
};

const orderTotal = (order) => {
  const value = Number(order.totalAmount ?? order.total ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const orderDate = (order) => {
  const parsed = new Date(order.createdAt || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const RANGES = [
  { id: 3, label: '3 mo' },
  { id: 6, label: '6 mo' },
  { id: 12, label: '12 mo' },
];

const STATUS_META = {
  PENDING: 'Pending',
  PROCESSING: 'Packed',
  SHIPPED: 'In transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const ORDER_TYPE_LABELS = {
  STANDARD: 'Regular orders',
  GROUP_BUY: 'Group buying',
  WHOLESALE: 'Wholesale (CWP)',
  REVERSE_GROUP_BUYING: 'Seller-led reverse buying',
  GROUP_BUYING_AUCTION: 'Group buying auction',
  AUCTION: 'Auction',
  GROUP_REVERSE_BUYING: 'Customer-led group reverse',
};

const PAYMENT_LABELS = {
  CREDIT_CARD: 'Credit card',
  PAYPAL: 'PayPal',
  STRIPE: 'Stripe',
  CASH_ON_DELIVERY: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
};

function StatTile({ icon: Icon, label, value, hint, trend, accent = 'text-nexus-400' }) {
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
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
              up ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {formatPercent(Math.abs(Number(trend)) * 100)}
          </span>
        )}
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * The customer's own purchasing history, turned into something readable.
 *
 * <p>Everything is derived from the order and wishlist lists the dashboard already loads, so this
 * adds no network traffic. A customer's own order list is small, which is why the buckets are
 * months rather than days: days would be a mostly-empty chart.
 */
export default function CustomerInsights({ orders, wishlistItems, recommendations = [] }) {
  const [range, setRange] = useState(6);

  const orderList = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const wishlist = useMemo(() => (Array.isArray(wishlistItems) ? wishlistItems : []), [wishlistItems]);

  const windowStart = useMemo(() => monthsAgo(range - 1), [range]);

  const scoped = useMemo(
    () => orderList.filter((o) => {
      const date = orderDate(o);
      return date && date >= windowStart;
    }),
    [orderList, windowStart],
  );

  const priorScoped = useMemo(() => {
    const start = monthsAgo(range * 2 - 1);
    const end = monthsAgo(range - 1);
    return orderList.filter((o) => {
      const date = orderDate(o);
      return date && date >= start && date < end;
    });
  }, [orderList, range]);

  // One row per month across the window, so gaps read as zero rather than vanishing.
  const monthly = useMemo(() => {
    const buckets = new Map();
    for (const order of scoped) {
      const date = orderDate(order);
      if (!date) continue;
      const key = monthKey(date);
      const row = buckets.get(key) || { month: key, spend: 0, orders: 0, saved: 0 };
      row.spend += orderTotal(order);
      row.orders += 1;
      row.saved += Number(order.discountAmount ?? 0) || 0;
      buckets.set(key, row);
    }

    const rows = [];
    for (let i = range - 1; i >= 0; i--) {
      const key = monthKey(monthsAgo(i));
      rows.push(buckets.get(key) || { month: key, spend: 0, orders: 0, saved: 0 });
    }
    return rows;
  }, [scoped, range]);

  const rangeSpend = useMemo(() => scoped.reduce((sum, o) => sum + orderTotal(o), 0), [scoped]);
  const priorSpend = useMemo(
    () => priorScoped.reduce((sum, o) => sum + orderTotal(o), 0),
    [priorScoped],
  );
  const spendTrend = priorSpend > 0 ? (rangeSpend - priorSpend) / priorSpend : null;

  const rangeAov = scoped.length > 0 ? rangeSpend / scoped.length : 0;
  const priorAov = priorScoped.length > 0
    ? priorSpend / priorScoped.length
    : null;
  const aovTrend = priorAov ? (rangeAov - priorAov) / priorAov : null;

  const lifetimeSpend = useMemo(
    () => orderList.reduce((sum, o) => sum + orderTotal(o), 0),
    [orderList],
  );
  const totalSaved = useMemo(
    () => orderList.reduce((sum, o) => sum + (Number(o.discountAmount) || 0), 0),
    [orderList],
  );
  const activeCount = orderList.filter((o) =>
    ['PENDING', 'PROCESSING', 'SHIPPED'].includes((o.status || '').toUpperCase()),
  ).length;
  const wishlistValue = wishlist.reduce((sum, item) => sum + (Number(item?.price) || 0), 0);

  const statusMix = useMemo(() => {
    const counts = new Map();
    for (const order of orderList) {
      const status = (order.status || '').toUpperCase();
      const label = STATUS_META[status] || status || 'Unknown';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orderList]);

  const typeMix = useMemo(() => {
    const counts = new Map();
    for (const order of orderList) {
      const label = ORDER_TYPE_LABELS[order.orderType] || order.orderType || 'Regular orders';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orderList]);

  const paymentMix = useMemo(() => {
    const counts = new Map();
    for (const order of orderList) {
      const label = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || 'Unspecified';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orderList]);

  // Spend by delivery city shows how scattered or focused a customer's shopping is.
  const citySpend = useMemo(() => {
    const totals = new Map();
    for (const order of orderList) {
      const city = (order.shippingCity || '').trim();
      if (!city) continue;
      totals.set(city, (totals.get(city) || 0) + orderTotal(order));
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [orderList]);

  // Products ranked by units, then by spend, merged into one table the chart can toggle between.
  const favouriteProducts = useMemo(() => {
    const stats = new Map();
    for (const order of orderList) {
      if ((order.status || '').toUpperCase() === 'CANCELLED') continue;
      for (const item of order.items || []) {
        const name = item.productName || 'Unnamed product';
        const row = stats.get(name) || { name, units: 0, spend: 0 };
        row.units += Number(item.quantity) || 0;
        row.spend += Number(item.subtotal ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)) || 0;
        stats.set(name, row);
      }
    }
    return [...stats.values()].sort((a, b) => b.units - a.units || b.spend - a.spend).slice(0, 8);
  }, [orderList]);

  const wishlistByCategory = useMemo(() => {
    const totals = new Map();
    for (const item of wishlist) {
      const category = item?.categoryName?.trim() || 'Uncategorised';
      totals.set(category, (totals.get(category) || 0) + 1);
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [wishlist]);

  // Order values bucketed by size: shows whether a customer buys many small things or a few large ones.
  const valueBuckets = useMemo(() => {
    const edges = [
      { label: 'Under ৳500', test: (v) => v < 500 },
      { label: '৳500–1,999', test: (v) => v >= 500 && v < 2000 },
      { label: '৳2,000–4,999', test: (v) => v >= 2000 && v < 5000 },
      { label: '৳5,000–9,999', test: (v) => v >= 5000 && v < 10000 },
      { label: '৳10,000+', test: (v) => v >= 10000 },
    ];
    return edges.map((edge) => ({
      label: edge.label,
      count: orderList.filter((o) => edge.test(orderTotal(o))).length,
    }));
  }, [orderList]);

  const hasOrders = orderList.length > 0;
  const hasSpend = monthly.some((row) => row.spend > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile
          icon={Wallet}
          label={`Spent · last ${range} mo`}
          value={formatMoney(rangeSpend)}
          hint={`${formatMoney(lifetimeSpend)} lifetime`}
          trend={spendTrend}
          accent="text-emerald-400"
        />
        <StatTile
          icon={Package}
          label={`Orders · last ${range} mo`}
          value={scoped.length.toLocaleString()}
          hint={`${orderList.length} all time`}
        />
        <StatTile
          icon={TrendingUp}
          label="Average order"
          value={formatMoney(rangeAov)}
          hint={`last ${range} mo`}
          trend={aovTrend}
        />
        <StatTile
          icon={PiggyBank}
          label="Total saved"
          value={formatMoney(totalSaved)}
          hint="discounts and coupons"
          accent="text-amber-400"
        />
        <StatTile
          icon={Truck}
          label="In progress"
          value={activeCount.toLocaleString()}
          hint="awaiting delivery"
          accent="text-indigo-400"
        />
        <StatTile
          icon={Heart}
          label="Wishlist value"
          value={formatMoney(wishlistValue)}
          hint={`${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}`}
          accent="text-rose-400"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          Your history in one place. Charts cover the selected window; totals are all-time.
        </p>
        <nav className="flex gap-1.5" aria-label="Insight range">
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              aria-pressed={range === option.id}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                range === option.id ? 'bg-nexus-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </nav>
      </div>

      <ChartCard
        title="Spending and order frequency"
        subtitle={`Monthly for the last ${range} months`}
        legend={[
          { label: 'Spend', color: SERIES[0] },
          { label: 'Orders (right axis)', color: SERIES[3] },
        ]}
        empty={!hasSpend}
        emptyText="No purchases in this window yet."
        table={{
          columns: [
            ['Month', (row) => shortMonth(row.month)],
            ['Spend', (row) => formatMoney(row.spend), 'right'],
            ['Orders', (row) => row.orders, 'right'],
            ['Saved', (row) => formatMoney(row.saved), 'right'],
          ],
          rows: monthly,
          rowKey: (row) => row.month,
        }}
      >
        <RevenueOrdersTrend
          data={monthly}
          xKey="month"
          revenueKey="spend"
          ordersKey="orders"
          height={280}
          xFormatter={shortMonth}
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Where your orders stand"
          subtitle="Every order, by where it got to"
          empty={!hasOrders}
          emptyText="No orders yet."
          table={{
            columns: [
              ['Status', (row) => row.name],
              ['Orders', (row) => row.value, 'right'],
              [
                'Share',
                (row) => formatPercent(orderList.length > 0 ? (row.value / orderList.length) * 100 : 0),
                'right',
              ],
            ],
            rows: statusMix,
            rowKey: (row) => row.name,
          }}
        >
          <Donut data={statusMix} nameKey="name" valueKey="value" />
        </ChartCard>

        <ChartCard
          title="How you order"
          subtitle="Regular shopping against the collective-buying features"
          empty={!hasOrders}
          emptyText="No orders yet."
        >
          <SplitBar
            segments={typeMix.slice(0, 5).map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
            total={orderList.length}
            valueFormatter={(value) => `${value} order${Number(value) === 1 ? '' : 's'}`}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Spend by delivery city"
          subtitle="Where your orders were shipped"
          empty={citySpend.length === 0}
          emptyText="No shipped orders yet."
          table={{
            columns: [
              ['City', (row) => row.name],
              ['Spend', (row) => formatMoney(row.value), 'right'],
            ],
            rows: citySpend,
            rowKey: (row) => row.name,
          }}
        >
          <RankedBars data={citySpend} labelKey="name" valueKey="value" label="Spend" valueFormatter={compactMoney} />
        </ChartCard>

        <ChartCard
          title="Your most purchased products"
          subtitle="Ranked by units, ignoring cancelled orders"
          empty={favouriteProducts.length === 0}
          emptyText="No purchased products yet."
          table={{
            columns: [
              ['Product', (row) => row.name],
              ['Units', (row) => row.units.toLocaleString(), 'right'],
              ['Spend', (row) => formatMoney(row.spend), 'right'],
            ],
            rows: favouriteProducts,
            rowKey: (row) => row.name,
          }}
        >
          <RankedBars
            data={favouriteProducts}
            labelKey="name"
            valueKey="units"
            label="Units bought"
            valueFormatter={(value) => `${value}`}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Order size distribution"
          subtitle="Whether you buy often in small amounts or rarely in bulk"
          empty={!hasOrders}
          emptyText="No orders yet."
          table={{
            columns: [
              ['Band', (row) => row.label],
              ['Orders', (row) => row.count, 'right'],
            ],
            rows: valueBuckets,
            rowKey: (row) => row.label,
          }}
        >
          <Columns
            data={valueBuckets}
            xKey="label"
            valueKey="count"
            label="Orders"
            color={SERIES[1]}
          />
        </ChartCard>

        <ChartCard
          title="Payment methods"
          subtitle="How you have paid"
          empty={!hasOrders}
          emptyText="No payments yet."
        >
          <SplitBar
            segments={paymentMix.slice(0, 5).map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
            total={orderList.length}
            valueFormatter={(value) => `${value} order${Number(value) === 1 ? '' : 's'}`}
          />
        </ChartCard>
      </div>

      {/* Wishlist: what the customer is saving for, which is intent worth surfacing. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Wishlist by category"
          subtitle={`${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}`}
          empty={wishlistByCategory.length === 0}
          emptyText="Your wishlist is empty."
          table={{
            columns: [
              ['Category', (row) => row.name],
              ['Items', (row) => row.value, 'right'],
            ],
            rows: wishlistByCategory,
            rowKey: (row) => row.name,
          }}
          className="lg:col-span-1"
        >
          <Donut data={wishlistByCategory} nameKey="name" valueKey="value" height={210} />
        </ChartCard>

        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" /> Monthly savings
              </h3>
              <p className="text-[11px] text-slate-500">What discounts and coupons returned to you</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-bold text-slate-300">
              {formatMoney(totalSaved)} saved
            </span>
          </div>
          {hasOrders ? (
            <div className="space-y-3">
              <Columns
                data={monthly}
                xKey="month"
                valueKey="saved"
                label="Saved"
                height={200}
                xFormatter={shortMonth}
                valueFormatter={compactMoney}
                color={SERIES[2]}
              />
              <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                <Star className="w-3 h-3" />
                Across {orderList.length} order{orderList.length === 1 ? '' : 's'} you have placed
              </p>
            </div>
          ) : (
            <p className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              No savings recorded yet.
            </p>
          )}
        </section>
      </div>

      {recommendations.length > 0 && (
        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-nexus-400" />
            <h3 className="text-sm font-extrabold text-white">Picked for you</h3>
            <span className="text-[10px] text-slate-500">
              Based on what you have browsed and bought
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {recommendations.slice(0, 6).map((item) => (
              <div key={item.id || item.productId} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1">
                <p className="text-[11px] font-bold text-slate-200 line-clamp-2">
                  {item.productName || item.name || 'Recommended'}
                </p>
                {item.price != null && (
                  <p className="text-[11px] font-mono text-emerald-400">{formatMoney(item.price)}</p>
                )}
                {item.reason && <p className="text-[9px] text-slate-500 line-clamp-2">{item.reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

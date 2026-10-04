import axiosClient from '../../api/axiosClient';
import { downloadCsv } from '../groupbuy/csv';
import { formatDateTime, formatMoney } from '../groupbuy/format';

/** Reports the admin dashboard can export. Each one pulls fresh data, so an export is never a stale page. */

const stamp = () => new Date().toISOString().slice(0, 10);
const listOf = (res) => {
  const data = res?.data ?? res;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Opens a printable version; the browser's print dialog saves it as a PDF. */
const printReport = (title, sections) => {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    throw new Error('Allow pop-ups for this site to open the printable report.');
  }
  const blocks = sections
    .map((section) => {
      const head = section.columns.map(([header]) => `<th>${escapeHtml(header)}</th>`).join('');
      const body = section.rows
        .map((row) => `<tr>${section.columns.map(([, get]) => `<td>${escapeHtml(get(row))}</td>`).join('')}</tr>`)
        .join('');
      return `<h2>${escapeHtml(section.heading)}</h2>${
        section.rows.length
          ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
          : '<p class="muted">Nothing to report.</p>'
      }`;
    })
    .join('');

  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; color: #0f172a; padding: 40px; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      h2 { margin: 28px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
      .muted { color: #64748b; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; color: #64748b; font-weight: 600; border-bottom: 1px solid #cbd5e1; padding: 6px 8px 6px 0; }
      td { padding: 6px 8px 6px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">GroupMart · generated ${escapeHtml(formatDateTime(new Date().toISOString()))} · amounts in Bangladeshi Taka</div>
    ${blocks}
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
};

const customerName = (user) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName || user.name || user.email;

/** Platform summary: the numbers on the dashboard banner, plus how orders and sellers break down. */
async function platformReport(format, { overview }) {
  const [orders, sellers] = await Promise.all([
    axiosClient.get('/admin/orders').then(listOf).catch(() => []),
    axiosClient.get('/admin/sellers').then(listOf).catch(() => []),
  ]);

  const byStatus = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
  const revenue = orders
    .filter((o) => o.paymentStatus === 'COMPLETED')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const groupBuyOrders = orders.filter((o) => o.orderType === 'GROUP_BUY');

  const summary = [
    ['Generated at', formatDateTime(new Date().toISOString())],
    ['Total users', overview?.totalUsers ?? ''],
    ['Total sellers', overview?.totalSellers ?? ''],
    ['Sellers awaiting verification', overview?.pendingSellerVerifications ?? ''],
    ['Total categories', overview?.totalCategories ?? ''],
    ['Total products', overview?.totalProducts ?? ''],
    ['Total orders', orders.length],
    ['Paid revenue', formatMoney(revenue)],
    ['Group buy orders', groupBuyOrders.length],
    ['Group buy revenue', formatMoney(groupBuyOrders.filter((o) => o.paymentStatus === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0))],
    ...Object.entries(byStatus).map(([status, count]) => [`Orders ${status.toLowerCase()}`, count]),
  ];

  if (format === 'PDF') {
    printReport('Platform report', [
      { heading: 'Summary', columns: [['Metric', (r) => r[0]], ['Value', (r) => r[1]]], rows: summary },
      {
        heading: 'Sellers',
        columns: [
          ['Store', (s) => s.storeName],
          ['Owner', (s) => s.ownerName || s.ownerEmail || ''],
          ['Verified', (s) => (s.verified ? 'Yes' : 'No')],
        ],
        rows: sellers,
      },
    ]);
    return 'Printable platform report opened.';
  }

  downloadCsv(`groupmart-platform-report-${stamp()}.csv`, [['Metric', (r) => r[0]], ['Value', (r) => r[1]]], summary);
  return `Platform report downloaded (${summary.length} metrics).`;
}

async function customerReport(format) {
  const users = await axiosClient.get('/admin/users', { params: { page: 0, size: 1000 } }).then(listOf);
  const customers = users.filter((u) => (u.role || '').includes('CUSTOMER') || !u.role);
  const columns = [
    ['Name', (u) => customerName(u)],
    ['Email', (u) => u.email],
    ['Role', (u) => u.role],
    ['Status', (u) => (u.enabled === false ? 'Suspended' : 'Active')],
    ['Joined', (u) => formatDateTime(u.createdAt)],
  ];
  if (format === 'PDF') {
    printReport('Customer report', [{ heading: `Customers (${customers.length})`, columns, rows: customers }]);
    return 'Printable customer report opened.';
  }
  downloadCsv(`groupmart-customers-${stamp()}.csv`, columns, customers);
  return `Customer report downloaded (${customers.length} customers).`;
}

async function sellerRevenueReport(format) {
  const [sellers, orders] = await Promise.all([
    axiosClient.get('/admin/sellers').then(listOf),
    axiosClient.get('/admin/orders').then(listOf).catch(() => []),
  ]);

  // Sellers are credited per line item, so revenue is summed from the items of paid orders
  const revenueByStore = {};
  orders
    .filter((o) => o.paymentStatus === 'COMPLETED')
    .forEach((o) =>
      (o.items || []).forEach((item) => {
        const key = item.sellerStoreName || 'GroupMart Official Store';
        revenueByStore[key] = (revenueByStore[key] || 0) + (Number(item.subtotal) || 0);
      }),
    );

  const rows = sellers.map((s) => ({ ...s, revenue: revenueByStore[s.storeName] || 0 }));
  const columns = [
    ['Store', (s) => s.storeName],
    ['Owner', (s) => s.ownerName || ''],
    ['Owner email', (s) => s.ownerEmail || ''],
    ['Verified', (s) => (s.verified ? 'Yes' : 'No')],
    ['Lifetime sales count', (s) => s.totalSales ?? 0],
    ['Revenue from paid orders', (s) => formatMoney(s.revenue)],
  ];
  if (format === 'PDF') {
    printReport('Seller revenue ledger', [{ heading: `Sellers (${rows.length})`, columns, rows }]);
    return 'Printable seller ledger opened.';
  }
  downloadCsv(`groupmart-seller-revenue-${stamp()}.csv`, columns, rows);
  return `Seller revenue ledger downloaded (${rows.length} stores).`;
}

async function transactionsReport(format) {
  const orders = await axiosClient.get('/admin/orders').then(listOf);
  const columns = [
    ['Order', (o) => o.orderNumber],
    ['Placed', (o) => formatDateTime(o.createdAt)],
    ['Customer', (o) => o.userName],
    ['Email', (o) => o.userEmail],
    ['Type', (o) => (o.orderType === 'GROUP_BUY' ? 'Group buy' : 'Standard')],
    ['Status', (o) => o.status],
    ['Payment', (o) => o.paymentStatus],
    ['Method', (o) => (o.paymentMethod || '').replace(/_/g, ' ')],
    ['Subtotal', (o) => o.subtotalAmount],
    ['Discount', (o) => o.discountAmount],
    ['Tax', (o) => o.taxAmount],
    ['Shipping', (o) => o.shippingAmount],
    ['Total', (o) => o.totalAmount],
  ];
  if (format === 'PDF') {
    printReport('Order & transaction log', [
      {
        heading: `Orders (${orders.length})`,
        columns: columns.filter(([header]) => !['Subtotal', 'Discount', 'Tax', 'Shipping', 'Email'].includes(header)),
        rows: orders,
      },
    ]);
    return 'Printable transaction log opened.';
  }
  downloadCsv(`groupmart-transactions-${stamp()}.csv`, columns, orders);
  return `Transaction log downloaded (${orders.length} orders).`;
}

const REPORTS = {
  Platform: platformReport,
  Customer: customerReport,
  'Seller Revenue': sellerRevenueReport,
  Transactions: transactionsReport,
};

/** Runs one report; returns a message for the dashboard banner. Throws with a readable message on failure. */
export async function exportAdminReport(type, format, context = {}) {
  const report = REPORTS[type];
  if (!report) {
    throw new Error(`There is no ${type} report yet.`);
  }
  return report(format === 'PDF' ? 'PDF' : 'CSV', context);
}

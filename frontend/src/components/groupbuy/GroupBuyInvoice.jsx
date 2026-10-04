import React from 'react';
import { Printer, Receipt } from 'lucide-react';
import { formatDateTime, formatMoney } from './format';

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

/** Invoice for a successful group buy, or a payment receipt while the group is still open/refunded. */
export default function GroupBuyInvoice({ group, membership, customerName, customerEmail }) {
  if (!membership) return null;

  const campaign = group.campaign;
  const isInvoice = membership.status === 'CONVERTED';
  const unitPrice = Number(membership.finalUnitPrice ?? membership.effectiveUnitPrice ?? membership.unitPriceAtJoin ?? 0);
  const baseTotal = Number(campaign.basePrice) * membership.quantity;
  const chargedTotal = isInvoice ? unitPrice * membership.quantity : Number(membership.amountPaid ?? 0);
  const documentNumber = membership.orderNumber || membership.paymentReference;

  const lines = [
    ['Product', campaign.productName],
    ['Seller', campaign.sellerStoreName],
    ['Group code', group.inviteCode],
    ['Quantity', membership.quantity],
    ['Regular price', `${formatMoney(campaign.basePrice)} each`],
    [isInvoice ? 'Group price' : 'Price at join', `${formatMoney(unitPrice)} each`],
    ['Group discount', formatMoney(Math.max(0, baseTotal - chargedTotal))],
    ['Payment method', membership.paymentMethod?.replace(/_/g, ' ')],
    ['Payment status', membership.paymentStatus],
    ['Transaction', membership.paymentReference],
    ...(Number(membership.refundAmount) > 0 ? [['Refunded', formatMoney(membership.refundAmount)]] : []),
    ['Ship to', membership.shippingAddress],
  ];

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    const rows = lines
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
      .join('');
    win.document.write(`<!doctype html><html><head><title>${isInvoice ? 'Invoice' : 'Receipt'} ${escapeHtml(documentNumber)}</title>
      <style>
        body { font-family: system-ui, sans-serif; color: #0f172a; padding: 40px; }
        h1 { margin: 0 0 4px; font-size: 22px; }
        .muted { color: #64748b; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
        td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        td:first-child { color: #64748b; width: 40%; }
        .total { margin-top: 16px; font-size: 18px; font-weight: 700; text-align: right; }
      </style></head><body>
      <h1>GroupMart ${isInvoice ? 'Group Buy Invoice' : 'Group Buy Payment Receipt'}</h1>
      <div class="muted">${escapeHtml(documentNumber)} · ${escapeHtml(formatDateTime(group.completedAt || membership.joinedAt))}</div>
      <div class="muted">Billed to ${escapeHtml(customerName)} (${escapeHtml(customerEmail)})</div>
      <table>${rows}</table>
      <div class="total">Total ${escapeHtml(formatMoney(chargedTotal))}</div>
      <p class="muted">Group buy prices include tax and shipping. Sandbox transaction.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-amber-400" /> {isInvoice ? 'Invoice' : 'Payment receipt'}
        </h3>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        {lines.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-200 text-right break-words">{value ?? '—'}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold text-white">
        <span>Total</span>
        <span className="font-mono">{formatMoney(chargedTotal)}</span>
      </div>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Users } from 'lucide-react';
import { formatDateTime, formatMoney } from '../groupbuy/format';

const STATUS_STYLE = {
  COMPLETED: 'bg-emerald-950 border-emerald-800 text-emerald-300',
  PENDING: 'bg-amber-950/60 border-amber-800 text-amber-300',
  FAILED: 'bg-rose-950/60 border-rose-800 text-rose-300',
  REFUNDED: 'bg-sky-950/60 border-sky-800 text-sky-300',
};

const STATUS_LABEL = {
  COMPLETED: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

const METHOD_LABEL = {
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  PAYPAL: 'PayPal',
  STRIPE: 'Stripe',
  CASH_ON_DELIVERY: 'Cash on delivery',
};

export function PaymentStatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLE[status] || STATUS_STYLE.PENDING}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

/** Payment summary, refund breakdown and transaction history for one order. */
export default function OrderPaymentDetails({ order }) {
  const details = order?.paymentDetails;
  if (!details) return null;

  const refunded = Number(details.refundedAmount || 0);
  const groupBuy = details.groupBuy;
  const transactions = details.transactions || [];

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold text-white flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-teal-400" /> Payment &amp; refunds
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{METHOD_LABEL[details.paymentMethod] || details.paymentMethod}</span>
          <PaymentStatusBadge status={details.paymentStatus} />
        </div>
      </div>

      {details.statusMessage && <p className="text-slate-300 leading-relaxed">{details.statusMessage}</p>}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
          <dt className="text-[10px] text-slate-500 font-semibold">Charged</dt>
          <dd className="font-mono font-bold text-white">{formatMoney(details.amountCharged)}</dd>
        </div>
        <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
          <dt className="text-[10px] text-slate-500 font-semibold">Refunded</dt>
          <dd className={`font-mono font-bold ${refunded > 0 ? 'text-sky-300' : 'text-slate-400'}`}>
            {refunded > 0 ? `-${formatMoney(refunded)}` : formatMoney(0)}
          </dd>
        </div>
        <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
          <dt className="text-[10px] text-slate-500 font-semibold">You paid</dt>
          <dd className="font-mono font-bold text-emerald-300">{formatMoney(details.netPaid)}</dd>
        </div>
      </dl>

      {groupBuy && (
        <div className="p-3 bg-nexus-950/40 border border-nexus-800/60 rounded-xl space-y-1.5">
          <p className="font-bold text-white flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-nexus-400" /> Group buy payment
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
            <p>
              Paid when joining ({formatDateTime(groupBuy.paidAt)}):{' '}
              <span className="text-white font-mono">{formatMoney(groupBuy.amountPaidAtJoin)}</span>
              <span className="text-slate-500"> ({groupBuy.quantity} × {formatMoney(groupBuy.unitPriceAtJoin)})</span>
            </p>
            {groupBuy.finalUnitPrice != null && (
              <p>
                Final group price: <span className="text-white font-mono">{formatMoney(groupBuy.finalUnitPrice)}</span> each
              </p>
            )}
            {Number(groupBuy.priceDropRefund) > 0 && (
              <p className="text-sky-300">
                Price-drop refund: <span className="font-mono">{formatMoney(groupBuy.priceDropRefund)}</span>
              </p>
            )}
            {groupBuy.paymentReference && (
              <p>
                Reference: <span className="font-mono text-slate-300 break-all">{groupBuy.paymentReference}</span>
              </p>
            )}
          </div>
          {order.groupBuyGroupId && (
            <Link to={`/group-buy/groups/${order.groupBuyGroupId}`} className="inline-block text-nexus-400 hover:underline font-semibold">
              View group →
            </Link>
          )}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Transaction history</p>
          <ul className="divide-y divide-slate-800">
            {transactions.map((txn) => {
              const isRefund = txn.kind === 'REFUND';
              return (
                <li key={txn.transactionId} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {isRefund ? (
                      <ArrowDownLeft className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-slate-200 font-semibold">{txn.description}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        {txn.transactionId} · {formatDateTime(txn.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className={`font-mono font-bold ${isRefund ? 'text-sky-300' : 'text-white'}`}>
                      {isRefund ? '+' : ''}
                      {formatMoney(txn.amount)}
                    </p>
                    <PaymentStatusBadge status={txn.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

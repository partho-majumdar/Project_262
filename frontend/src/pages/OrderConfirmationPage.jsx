import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  ArrowRight, 
  FileText,
  Sparkles
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrderDetails = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get(`/orders/${orderNumber}`);
        setOrder(response.data);
      } catch (err) {
        setError(err.message || 'Order not found');
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetails();
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading order receipt...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Order not found'}
        </div>
        <Link to="/products" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
          Return to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      
      {/* Hero Success Badge Banner */}
      <div className="glass-panel p-8 sm:p-12 rounded-3xl text-center space-y-4 border border-emerald-500/40 relative overflow-hidden">
        <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Order Confirmed & Authorized!</h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          Thank you for shopping with GroupMart AI. Order reference <strong className="text-nexus-400 font-mono">{order.orderNumber}</strong> has been logged in our processing queue.
        </p>

        <div className="pt-2 flex flex-wrap justify-center gap-4 text-xs font-semibold">
          <Link
            to="/orders"
            className="px-6 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl shadow-lg shadow-nexus-600/30 flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-4 h-4" /> View My Orders
          </Link>
          <Link
            to="/products"
            className="px-6 py-2.5 bg-slate-900 border border-slate-700 text-slate-200 hover:text-white rounded-xl flex items-center gap-1.5 transition-all"
          >
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Receipt Breakdown Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs text-slate-400 font-mono">ORDER # {order.orderNumber}</span>
            <h3 className="text-lg font-bold text-white">Order Receipt Details</h3>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-full">
              STATUS: {order.status}
            </span>
          </div>
        </div>

        {/* Delivery Destination & Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <MapPin className="w-4 h-4 text-nexus-400" /> Delivery Address
            </h4>
            <p className="text-slate-200">{order.userName}</p>
            <p className="text-slate-400">{order.shippingAddressLine1}</p>
            <p className="text-slate-400">{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</p>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <Truck className="w-4 h-4 text-indigo-400" /> Shipping & Payment
            </h4>
            <p className="text-slate-400">Payment Method: <span className="text-white font-semibold">{order.paymentMethod}</span></p>
            <p className="text-slate-400">Payment Status: <span className="text-emerald-400 font-semibold">{order.paymentStatus}</span></p>
            <p className="text-slate-400">Estimated Delivery: <span className="text-white font-semibold">3-5 Business Days</span></p>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Items ({order.items.length})</h4>
          <div className="divide-y divide-slate-800">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{item.productName}</p>
                    <p className="text-slate-500 font-mono text-[11px]">SKU: {item.productSku} • Qty: {item.quantity}</p>
                  </div>
                </div>
                <span className="font-bold text-white text-sm">${item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-200">${order.subtotalAmount.toFixed(2)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Discount ({order.couponCode})</span>
              <span>-${order.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400">
            <span>Tax</span>
            <span className="font-semibold text-slate-200">${order.taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Shipping</span>
            <span className="font-semibold text-slate-200">${order.shippingAmount.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline text-sm">
            <span className="font-bold text-white">Total Amount Paid</span>
            <span className="text-xl font-extrabold text-white">${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Eye,
  FileText,
  RefreshCw,
  MapPin
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import ReturnRequestModal from '../components/common/ReturnRequestModal';

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReturnOrder, setSelectedReturnOrder] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/orders');
      setOrders(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch customer orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (orderNumber) => {
    if (!window.confirm(`Are you sure you want to cancel order ${orderNumber}?`)) return;
    try {
      await axiosClient.put(`/orders/${orderNumber}/cancel`);
      fetchOrders();
      alert('Order cancelled successfully.');
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    }
  };

  const getStepProgress = (status) => {
    switch (status) {
      case 'PENDING': return 1;
      case 'PROCESSING': return 2;
      case 'SHIPPED': return 3;
      case 'DELIVERED': return 4;
      default: return 1;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading customer order history & live tracking...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-nexus-400" /> Customer Orders & Live Tracking
          </h1>
          <p className="text-xs text-slate-400">Track real-time shipment progress, view receipts, and request returns/refunds.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl space-y-3 border border-slate-800 max-w-md mx-auto">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">No Order Records Found</p>
          <p className="text-xs text-slate-400">You haven't placed any orders yet. Discover items in our catalog!</p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white text-xs font-semibold rounded-xl"
          >
            Explore Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const step = getStepProgress(order.status);

            return (
              <div
                key={order.id}
                className="glass-card rounded-3xl border border-slate-800 overflow-hidden space-y-6 p-6 hover:border-slate-700 transition-all"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-nexus-400">{order.orderNumber}</span>
                      <span className="text-xs text-slate-500">• {new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" /> Deliver to: {order.shippingAddressLine1}, {order.shippingCity}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      order.status === 'DELIVERED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      order.status === 'CANCELLED' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                      'bg-nexus-950 text-nexus-300 border border-nexus-800'
                    }`}>
                      {order.status}
                    </span>

                    {(order.status === 'PENDING' || order.status === 'PROCESSING') && (
                      <button
                        onClick={() => handleCancelOrder(order.orderNumber)}
                        className="px-3 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-semibold rounded-xl"
                      >
                        Cancel Order
                      </button>
                    )}

                    {(order.status === 'DELIVERED' || order.status === 'SHIPPED') && (
                      <button
                        onClick={() => setSelectedReturnOrder(order)}
                        className="px-3 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-bold rounded-xl flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Return / Refund
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Order Tracking Timeline Stepper */}
                <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Real-Time Shipment Progress</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className={`p-2 rounded-xl border space-y-1 ${step >= 1 ? 'bg-nexus-950 border-nexus-600 text-nexus-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                      <Clock className="w-4 h-4 mx-auto" />
                      <span className="font-bold text-[11px] block">Order Placed</span>
                    </div>

                    <div className={`p-2 rounded-xl border space-y-1 ${step >= 2 ? 'bg-nexus-950 border-nexus-600 text-nexus-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                      <Package className="w-4 h-4 mx-auto" />
                      <span className="font-bold text-[11px] block">Processing</span>
                    </div>

                    <div className={`p-2 rounded-xl border space-y-1 ${step >= 3 ? 'bg-indigo-950 border-indigo-600 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                      <Truck className="w-4 h-4 mx-auto" />
                      <span className="font-bold text-[11px] block">Dispatched</span>
                    </div>

                    <div className={`p-2 rounded-xl border space-y-1 ${step >= 4 ? 'bg-emerald-950 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                      <CheckCircle2 className="w-4 h-4 mx-auto" />
                      <span className="font-bold text-[11px] block">Delivered</span>
                    </div>
                  </div>
                </div>

                {/* Order Items List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                      <div className="w-12 h-12 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shrink-0">
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 text-xs space-y-0.5">
                        <p className="font-semibold text-white line-clamp-1">{item.productName}</p>
                        <p className="text-slate-400">{item.quantity} x ${item.unitPrice.toFixed(2)}</p>
                      </div>
                      <span className="font-bold text-white text-xs pr-2">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Order Footer */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">
                    Payment Method: <strong className="text-white">{order.paymentMethod}</strong> ({order.paymentStatus})
                  </span>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-white">Total: ${order.totalAmount.toFixed(2)}</span>
                    <Link
                      to={`/orders/confirmation/${order.orderNumber}`}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
                      title="View Full Receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Return & Refund Request Modal */}
      {selectedReturnOrder && (
        <ReturnRequestModal
          isOpen={!!selectedReturnOrder}
          onClose={() => setSelectedReturnOrder(null)}
          order={selectedReturnOrder}
        />
      )}

    </div>
  );
}

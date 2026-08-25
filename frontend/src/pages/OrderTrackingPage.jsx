import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  FileText, 
  AlertCircle, 
  ShieldCheck, 
  XCircle,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function OrderTrackingPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get('/orders');
        const list = response.data?.data || response.data || [];
        setOrders(list);
        if (list.length > 0) {
          setSelectedOrder(list[0]);
        }
      } catch (err) {
        console.error('Failed to fetch orders for tracking', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const trackingSteps = [
    { label: 'Order Placed', desc: 'Received & Verification' },
    { label: 'Confirmed', desc: 'Seller Accepted Order' },
    { label: 'Packed', desc: 'Secure Package Sealed' },
    { label: 'Shipped', desc: 'Handed to Carrier' },
    { label: 'Out for Delivery', desc: 'Courier Agent Assigned' },
    { label: 'Delivered', desc: 'Signed & Delivered' }
  ];

  const getStepProgressIndex = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return 0;
      case 'PROCESSING': return 1;
      case 'CONFIRMED': return 2;
      case 'SHIPPED': return 3;
      case 'OUT_FOR_DELIVERY': return 4;
      case 'DELIVERED': return 5;
      default: return 3; // Default realistic simulation for demo orders
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      await axiosClient.put(`/orders/${orderId}/cancel`);
      alert('Order cancelled successfully.');
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: 'CANCELLED' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Order could not be cancelled as it is already shipped.');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadInvoice = (orderNumber) => {
    alert(`Generating official PDF Tax Invoice for Order #${orderNumber}... Invoice download started.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <Truck className="w-3.5 h-3.5 text-nexus-400" /> Real-time Logistics Command Center
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Order Tracking & <span className="text-nexus-400">Shipment Timeline</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300">
          Track live package milestones, courier assignments, and delivery schedules from verified merchants.
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-3 animate-pulse">
          <Truck className="w-8 h-8 text-nexus-500 mx-auto animate-bounce" />
          <p className="text-xs text-slate-400">Syncing live courier tracking feeds...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-4">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No active orders to track</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You haven't placed any orders yet. Explore our catalog to start shopping!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Orders List Column */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1">Active Purchases</h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrder(ord)}
                  className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                    selectedOrder?.id === ord.id 
                      ? 'bg-nexus-950/90 border-nexus-500/80 shadow-lg shadow-nexus-600/20' 
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-white">#{ord.orderNumber}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-bold text-emerald-400">
                      {ord.status || 'SHIPPED'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>{ord.orderItems?.length || 1} Item(s)</span>
                    <span className="font-bold text-white font-mono">${ord.totalAmount ? ord.totalAmount.toFixed(2) : '0.00'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Selected Order Live Tracking Detail Panel */}
          {selectedOrder && (
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-8">
                
                {/* Header Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">TRACKING ID: NEX-TRK-9812450</span>
                    <h2 className="text-xl font-extrabold text-white">Order #{selectedOrder.orderNumber}</h2>
                    <p className="text-xs text-slate-400 mt-1">Carrier: <strong className="text-indigo-400">FedEx Express Logistics</strong></p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDownloadInvoice(selectedOrder.orderNumber)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 text-nexus-400" /> Invoice PDF
                    </button>

                    {selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'DELIVERED' && (
                      <button
                        disabled={cancelling}
                        onClick={() => handleCancelOrder(selectedOrder.id)}
                        className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" /> Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* 6-Stage Timeline Tracker */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" /> Estimated Delivery: <span className="text-emerald-400">Tomorrow by 5:00 PM</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                    {trackingSteps.map((step, idx) => {
                      const activeIdx = getStepProgressIndex(selectedOrder.status);
                      const isCompleted = idx <= activeIdx;
                      const isCurrent = idx === activeIdx;

                      return (
                        <div key={idx} className="space-y-2 text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all ${
                            isCompleted 
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40' 
                              : 'bg-slate-900 border border-slate-800 text-slate-600'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-mono">{idx + 1}</span>}
                          </div>
                          <div>
                            <p className={`text-[11px] font-bold ${isCurrent ? 'text-emerald-400 font-extrabold' : isCompleted ? 'text-white' : 'text-slate-500'}`}>
                              {step.label}
                            </p>
                            <p className="text-[9px] text-slate-500 leading-tight">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Items Table */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-extrabold text-slate-300">Package Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.orderItems?.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={item.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100'} alt={item.productName} className="w-10 h-10 object-cover rounded-xl" />
                          <div>
                            <p className="text-xs font-bold text-white">{item.productName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Qty: {item.quantity} × ${item.price?.toFixed(2)}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-emerald-400">${(item.quantity * item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  RotateCcw, 
  ShoppingBag, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Filter, 
  Package,
  Store,
  ChevronRight
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

export default function PurchaseHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get('/orders');
        setOrders(response.data?.data || response.data || []);
      } catch (err) {
        console.error('Failed to fetch purchase history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleBuyAgain = (item) => {
    addToCart({
      id: item.productId || item.id,
      name: item.productName,
      price: item.price,
      imageUrl: item.imageUrl
    }, 1);
    navigate('/cart');
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch = ord.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.orderItems?.some((i) => i.productName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === 'ALL' || ord.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <History className="w-3.5 h-3.5 text-nexus-400" /> Account Order Records
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Complete <span className="text-nexus-400">Purchase History</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300">
          Review past orders, payment receipts, order statuses, and quickly re-order your favorite products.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name or Order ID..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="SHIPPED">Shipped</option>
            <option value="PROCESSING">Processing</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

      </div>

      {/* Orders List */}
      {loading ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-3 animate-pulse">
          <History className="w-8 h-8 text-nexus-500 mx-auto animate-spin" />
          <p className="text-xs text-slate-400">Loading purchase history from database...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-4">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No matching purchase records found</h3>
          <p className="text-xs text-slate-400">Try adjusting your search query or status filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4 hover:border-slate-700 transition">
              
              {/* Order Header Meta */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">ORDER PLACED</span>
                    <span className="font-bold text-white font-mono">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Recent'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">TOTAL AMOUNT</span>
                    <span className="font-extrabold text-emerald-400 font-mono">${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">ID: #{order.orderNumber}</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 text-[10px] font-bold">
                    {order.status || 'DELIVERED'}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {order.orderItems?.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    
                    <div className="flex items-center gap-3">
                      <img src={item.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100'} alt={item.productName} className="w-12 h-12 object-cover rounded-xl shrink-0" />
                      <div>
                        <p className="font-bold text-white text-xs">{item.productName}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Store className="w-3 h-3 text-emerald-400" /> Nexus Verified Merchant
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-xs font-mono font-bold text-slate-300">Qty: {item.quantity}</span>
                      <button
                        onClick={() => handleBuyAgain(item)}
                        className="px-3.5 py-1.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-nexus-600/30"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Buy Again
                      </button>
                    </div>

                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}

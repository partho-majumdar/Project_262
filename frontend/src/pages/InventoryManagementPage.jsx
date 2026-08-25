import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Plus, 
  Minus, 
  FileText, 
  X, 
  ArrowLeft,
  Search,
  Sparkles
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function InventoryManagementPage() {
  const [inventoryList, setInventoryList] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [quantityChange, setQuantityChange] = useState(10);
  const [reason, setReason] = useState('RESTOCK');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [invRes, alertRes] = await Promise.all([
        axiosClient.get('/seller/inventory'),
        axiosClient.get('/seller/inventory/low-stock'),
      ]);
      setInventoryList(invRes.data);
      setLowStockAlerts(alertRes.data);
    } catch (err) {
      console.error('Failed to fetch inventory details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openRestockModal = (item) => {
    setSelectedProduct(item);
    setQuantityChange(10);
    setReason('RESTOCK');
    setIsRestockOpen(true);
  };

  const openLogsModal = async (item) => {
    setSelectedProduct(item);
    try {
      const response = await axiosClient.get(`/seller/inventory/products/${item.productId}/logs`);
      setLogs(response.data);
      setIsLogsOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to fetch inventory logs');
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axiosClient.put(`/seller/inventory/products/${selectedProduct.productId}/stock`, {
        quantityChange: parseInt(quantityChange),
        reason: reason,
        referenceId: 'MANUAL-REF-' + Date.now(),
      });
      setIsRestockOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventoryList.filter(
    (item) => item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.productSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
            <Package className="w-3.5 h-3.5" /> Merchant Warehouse & Stock Engine
          </div>
          <h1 className="text-3xl font-extrabold text-white">Inventory Management</h1>
          <p className="text-xs text-slate-400">Track stock levels, configure low-stock alerts, and view inventory audit trails.</p>
        </div>

        <Link
          to="/seller/dashboard"
          className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockAlerts.length > 0 && (
        <div className="p-4 bg-amber-950/60 border border-amber-800/80 rounded-2xl flex items-center justify-between gap-4 text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Inventory Warning:</strong> {lowStockAlerts.length} product(s) are currently below the minimum threshold (&lt;= 5 units).
            </span>
          </div>
          <button onClick={fetchInventory} className="underline text-amber-300 hover:text-white font-semibold">
            Refresh
          </button>
        </div>
      )}

      {/* Inventory Table Card */}
      <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden space-y-4 p-6">
        
        {/* Table Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product stock or SKU..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            onClick={fetchInventory}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-nexus-500 text-slate-300 rounded-xl text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync Stock Levels
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading warehouse stock data...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No inventory records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Current Stock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredInventory.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-900/50">
                    <td className="p-3 font-semibold text-white">{item.productName}</td>
                    <td className="p-3 text-slate-400 font-mono">{item.productSku}</td>
                    <td className="p-3 text-slate-400">{item.categoryName}</td>
                    <td className="p-3 font-bold text-sm text-white">{item.currentStock} units</td>
                    <td className="p-3">
                      {item.outOfStock ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300 flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" /> Out of Stock
                        </span>
                      ) : item.lowStock ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-300 flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Low Stock Warning
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> In Stock
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => openRestockModal(item)}
                        className="px-3 py-1 bg-nexus-600 hover:bg-nexus-500 text-white rounded text-[11px] font-semibold"
                      >
                        Adjust Stock
                      </button>
                      <button
                        onClick={() => openLogsModal(item)}
                        className="px-3 py-1 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 rounded text-[11px] font-semibold"
                      >
                        Audit Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {isRestockOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-nexus-400" /> Stock Adjustment: {selectedProduct.productName}
              </h3>
              <button onClick={() => setIsRestockOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400">Current Warehouse Balance</span>
                <p className="text-lg font-extrabold text-white">{selectedProduct.currentStock} units</p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Quantity Adjustment (+ Add, - Deduct)</label>
                <input
                  type="number"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(e.target.value)}
                  placeholder="e.g. 25 or -5"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Adjustment Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                >
                  <option value="RESTOCK">RESTOCK (Stock Received)</option>
                  <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT (Audit correction)</option>
                  <option value="DAMAGE_WRITE_OFF">DAMAGE_WRITE_OFF (Damaged units)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Logs Modal */}
      {isLogsOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl space-y-6 relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Audit Log History: {selectedProduct.productName}
              </h3>
              <button onClick={() => setIsLogsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {logs.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No audit logs recorded yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white uppercase bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                        {log.reason}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-300">
                      Adjustment: <span className={log.quantityChange >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {log.quantityChange >= 0 ? `+${log.quantityChange}` : log.quantityChange}
                      </span> (Previous: {log.previousQuantity} → New: {log.newQuantity})
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

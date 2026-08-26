import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
  Layers,
  Plus,
  BarChart3,
  Percent,
  RefreshCw,
  FileSpreadsheet,
  X,
  Search,
  ShoppingCart,
  Users,
  Sparkles,
  Settings,
  Edit3,
  Trash2,
  Copy,
  Printer,
  Send,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

const emptyProductForm = {
  id: null,
  name: '',
  price: '',
  compareAtPrice: '',
  categoryId: '',
  stockQuantity: '',
  description: '',
  imageUrls: [''],
  featured: false,
  variants: [{ size: 'M', color: 'Black', stock: 10, sku: '' }],
};

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

export default function SellerDashboardPage() {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [store, setStore] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  /** true when backend returns SellerStore not found for this user */
  const [needsStore, setNeedsStore] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [createStoreForm, setCreateStoreForm] = useState({
    storeName: '',
    description: '',
    taxId: '',
    logoUrl: '',
    bannerUrl: '',
  });
  const [createStoreError, setCreateStoreError] = useState('');

  // Product modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(emptyProductForm);

  // Bulk CSV (no backend endpoint yet — UI kept, clearly non-persistent)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');

  // Invoice
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Restock
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockReason, setRestockReason] = useState('RESTOCK');

  // AI helper
  const [aiProductKeywords, setAiProductKeywords] = useState('');
  const [aiGeneratedTitle, setAiGeneratedTitle] = useState('');
  const [aiGeneratedDesc, setAiGeneratedDesc] = useState('');
  const [aiGeneratedKeywords, setAiGeneratedKeywords] = useState([]);
  const [aiPriceRecommendation, setAiPriceRecommendation] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Coupons — start empty (no seller coupon API)
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: 0,
  });

  // Store profile
  const [storeProfile, setStoreProfile] = useState({
    storeName: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    gstin: '',
    bankAccount: '',
    bankName: '',
    shippingPolicy: '',
    returnPolicy: '',
  });

  // Finance — no wallet API; derive display from analytics only
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payouts, setPayouts] = useState([]);

  // Filters
  const [productSearch, setProductSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Reviews — start empty (no seller reviews API yet)
  const [reviews, setReviews] = useState([]);
  const [reviewReplyText, setReviewReplyText] = useState({});

  const isStoreMissingError = (err) => {
    const msg = String(err?.message || err?.error || err || '').toLowerCase();
    return (
      msg.includes('sellerstore not found') ||
      msg.includes('seller store not found') ||
      msg.includes('store not found')
    );
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    setNeedsStore(false);

    // 1) Store first — if missing, stop and show create-store UI
    let storeObj = null;
    try {
      const storeRes = await axiosClient.get('/seller/store/me');
      storeObj = storeRes?.data ?? storeRes ?? null;
    } catch (err) {
      if (isStoreMissingError(err)) {
        setNeedsStore(true);
        setStore(null);
        setLoading(false);
        return;
      }
      setError(err?.message || 'Failed to load seller store');
      setLoading(false);
      return;
    }

    setStore(storeObj);
    if (storeObj) {
      setStoreProfile((prev) => ({
        ...prev,
        storeName: storeObj.storeName || '',
        description: storeObj.description || '',
        logoUrl: storeObj.logoUrl || '',
        bannerUrl: storeObj.bannerUrl || '',
        gstin: storeObj.taxId || prev.gstin || '',
      }));
    }

    // 2) Rest of dashboard (tolerate individual failures)
    try {
      const results = await Promise.allSettled([
        axiosClient.get('/seller/dashboard'),
        axiosClient.get('/seller/analytics'),
        axiosClient.get('/seller/products'),
        axiosClient.get('/categories'),
        axiosClient.get('/seller/inventory'),
        axiosClient.get('/seller/orders'),
      ]);

      const val = (i) =>
        results[i].status === 'fulfilled' ? results[i].value : null;

      const dashRes = val(0);
      const anaRes = val(1);
      const prodRes = val(2);
      const catRes = val(3);
      const invRes = val(4);
      const orderRes = val(5);

      const overview = dashRes?.data ?? dashRes ?? null;
      const analyticsObj = anaRes?.data ?? anaRes ?? null;

      const unwrapList = (res) => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.data)) return res.data;
        return [];
      };

      const productList = unwrapList(prodRes);
      const invList = unwrapList(invRes);
      const orderList = unwrapList(orderRes);

      setProducts(productList);
      setCategories(unwrapList(catRes));
      setInventoryList(invList);
      setOrders(orderList);

      // LIVE aggregates from real lists.
      // Backend /seller/dashboard currently hardcodes demo values
      // (totalRevenue=12450, totalOrders=48, totalProducts=12, lowStock=2).
      // Prefer computed values so a new empty store shows 0s, not fake data.
      const liveProductCount = productList.length;
      const liveOrderCount = orderList.length;
      const liveRevenue = orderList.reduce((sum, o) => {
        const t = Number(o.totalAmount ?? o.total ?? 0);
        return sum + (Number.isFinite(t) ? t : 0);
      }, 0);
      const liveLowStock = invList.filter((i) => {
        const stock = Number(i.currentStock ?? i.stockQuantity ?? 0);
        const threshold = Number(i.lowStockThreshold ?? i.reorderLevel ?? 5);
        return stock <= threshold;
      }).length;
      const rated = productList.filter((p) => p.rating != null);
      const liveAvgRating =
        rated.length > 0
          ? rated.reduce((s, p) => s + Number(p.rating || 0), 0) / rated.length
          : Number(storeObj?.rating ?? 0);

      const backendLooksDemo =
        Number(overview?.totalRevenue) === 12450 ||
        Number(overview?.totalOrders) === 48 ||
        Number(overview?.totalProducts) === 12;

      setAnalytics({
        ...analyticsObj,
        totalSalesRevenue: backendLooksDemo
          ? liveRevenue
          : Number(
              overview?.totalRevenue ??
                analyticsObj?.totalSalesRevenue ??
                liveRevenue
            ),
        completedOrdersCount: backendLooksDemo
          ? liveOrderCount
          : Number(overview?.totalOrders ?? liveOrderCount),
        totalProducts: backendLooksDemo
          ? liveProductCount
          : Number(overview?.totalProducts ?? liveProductCount),
        lowStockAlertCount: backendLooksDemo
          ? liveLowStock
          : Number(overview?.lowStockAlertCount ?? liveLowStock),
        averageRating: liveAvgRating,
      });
    } catch (err) {
      setError(err?.message || 'Failed to load seller dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setCreateStoreError('');
    if (
      !createStoreForm.storeName.trim() ||
      !createStoreForm.description.trim() ||
      !createStoreForm.taxId.trim()
    ) {
      setCreateStoreError('Store name, description, and Tax ID are required.');
      return;
    }
    setCreatingStore(true);
    try {
      await axiosClient.post('/seller/store', {
        storeName: createStoreForm.storeName.trim(),
        description: createStoreForm.description.trim(),
        taxId: createStoreForm.taxId.trim(),
        logoUrl: createStoreForm.logoUrl.trim() || null,
        bannerUrl: createStoreForm.bannerUrl.trim() || null,
      });
      setNeedsStore(false);
      await loadData();
    } catch (err) {
      setCreateStoreError(
        err?.message ||
          'Failed to create store. Confirm you are logged in as ROLE_SELLER.'
      );
    } finally {
      setCreatingStore(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derived stats from real orders (for overview when no time-series API)
  const orderStats = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const total = list.length || 1;
    const delivered = list.filter((o) => o.status === 'DELIVERED').length;
    const shipped = list.filter((o) =>
      ['SHIPPED', 'DELIVERED'].includes(o.status)
    ).length;
    const cancelled = list.filter((o) => o.status === 'CANCELLED').length;
    return {
      processingRate: ((list.filter((o) => o.status !== 'PENDING').length / total) * 100).toFixed(1),
      shipRate: ((shipped / total) * 100).toFixed(1),
      cancelRate: ((cancelled / total) * 100).toFixed(1),
      deliveredCount: delivered,
    };
  }, [orders]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  // ---------- Product CRUD ----------
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: currentProduct.name,
        price: parseFloat(currentProduct.price),
        compareAtPrice: currentProduct.compareAtPrice
          ? parseFloat(currentProduct.compareAtPrice)
          : null,
        categoryId: currentProduct.categoryId || null,
        stockQuantity: parseInt(currentProduct.stockQuantity, 10) || 0,
        description: currentProduct.description,
        imageUrls: (currentProduct.imageUrls || []).filter(
          (url) => url && url.trim() !== ''
        ),
        featured: !!currentProduct.featured,
      };

      if (isEditing) {
        await axiosClient.put(`/seller/products/${currentProduct.id}`, payload);
        alert('Product updated successfully!');
      } else {
        await axiosClient.post('/seller/products', payload);
        alert('Product created successfully!');
      }

      setIsProductModalOpen(false);
      setCurrentProduct(emptyProductForm);
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to submit product');
    }
  };

  const handleEditProduct = (prod) => {
    setIsEditing(true);
    setCurrentProduct({
      id: prod.id,
      name: prod.name || '',
      price: prod.price ?? '',
      compareAtPrice: prod.compareAtPrice || '',
      categoryId: prod.categoryId || '',
      stockQuantity: prod.stockQuantity ?? 0,
      description: prod.description || '',
      imageUrls:
        prod.imageUrls && prod.imageUrls.length > 0 ? prod.imageUrls : [''],
      featured: !!prod.featured,
      variants: [
        {
          size: 'M',
          color: 'Black',
          stock: prod.stockQuantity ?? 0,
          sku: prod.sku || '',
        },
      ],
    });
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axiosClient.delete(`/seller/products/${id}`);
      alert('Product deleted successfully');
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to delete product');
    }
  };

  const handleDuplicateProduct = async (prod) => {
    try {
      const payload = {
        name: `${prod.name} (Copy)`,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice,
        categoryId: prod.categoryId,
        stockQuantity: prod.stockQuantity,
        description: prod.description,
        imageUrls: prod.imageUrls,
        featured: prod.featured,
      };
      await axiosClient.post('/seller/products', payload);
      alert('Product duplicated successfully!');
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to duplicate product');
    }
  };

  // Bulk — no backend; show clear message
  const handleBulkCsvUpload = async (e) => {
    e.preventDefault();
    setBulkStatus(
      'Bulk CSV import is not connected to the API yet. Use "Add Product" for individual items.'
    );
    setTimeout(() => {
      setIsBulkModalOpen(false);
      setBulkStatus('');
      setCsvContent('');
    }, 2500);
  };

  // Inventory
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.put(
        `/seller/inventory/products/${selectedInventoryItem.productId}/stock`,
        {
          quantityChange: parseInt(restockQty, 10),
          reason: restockReason,
          referenceId: 'MANUAL-' + Date.now(),
        }
      );
      alert('Stock level adjusted successfully!');
      setIsRestockOpen(false);
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to adjust stock');
    }
  };

  // Orders
  const handleOrderStatusUpdate = async (orderNumber, newStatus) => {
    try {
      await axiosClient.put(`/seller/orders/${orderNumber}/status`, {
        status: newStatus,
      });
      alert(`Order status set to ${newStatus}`);
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to update order status');
    }
  };

  // AI — real assistant endpoint
  const handleAiCopywrite = async () => {
    if (!aiProductKeywords.trim()) {
      alert('Please enter product keywords or details first');
      return;
    }
    setIsGeneratingAi(true);
    setAiGeneratedTitle('');
    setAiGeneratedDesc('');
    setAiGeneratedKeywords([]);
    setAiPriceRecommendation(null);
    try {
      const res = await axiosClient.post('/ai/assistant/chat', {
        message: `You are a product copywriter for an e-commerce seller. Based on these keywords/details: "${aiProductKeywords}". Reply with:
1) One optimized product title (max 80 chars)
2) A short product description (2-3 sentences)
3) Five SEO keywords comma-separated
4) A suggested retail price in USD as a number only on the last line like PRICE: 99.99`,
      });

      const text =
        res?.data?.reply ||
        res?.data?.message ||
        res?.data?.content ||
        (typeof res?.data === 'string' ? res.data : '') ||
        '';

      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      setAiGeneratedTitle(lines[0] || text.slice(0, 80));
      setAiGeneratedDesc(
        lines.slice(1, -1).join(' ') || text || 'No description returned.'
      );

      const kwLine =
        lines.find((l) => l.toLowerCase().includes('keyword')) ||
        lines[lines.length - 2] ||
        aiProductKeywords;
      setAiGeneratedKeywords(
        kwLine
          .replace(/keywords?:?/i, '')
          .split(/[,|]/)
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 8)
      );

      const priceMatch = text.match(/PRICE:\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (priceMatch) {
        const recommended = parseFloat(priceMatch[1]);
        setAiPriceRecommendation({
          recommendedPrice: recommended,
          marketAverage: (recommended * 1.12).toFixed(2),
          competitorHigh: (recommended * 1.35).toFixed(2),
          profitMargin: '—',
        });
      }
    } catch (err) {
      // Fallback local generation if AI service unavailable
      const first = aiProductKeywords.split(',')[0]?.trim() || 'Product';
      setAiGeneratedTitle(`Premium ${first} — Seller Edition`);
      setAiGeneratedDesc(
        `High-quality ${aiProductKeywords} designed for everyday use. Built for reliability and value.`
      );
      setAiGeneratedKeywords(
        aiProductKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 5)
      );
      alert(
        err?.message ||
          'AI service unavailable — used local template instead.'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Local-only coupon (no API)
  const handleCreateCoupon = (e) => {
    e.preventDefault();
    if (!newCoupon.code) return;
    setCoupons((prev) => [
      {
        id: Date.now().toString(),
        code: newCoupon.code.toUpperCase(),
        discountType: newCoupon.discountType,
        discountValue: Number(newCoupon.discountValue),
        minOrderAmount: Number(newCoupon.minOrderAmount),
        active: true,
        localOnly: true,
      },
      ...prev,
    ]);
    setNewCoupon({
      code: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 0,
    });
    alert(
      'Coupon saved locally only. Backend seller-coupon API is not available yet.'
    );
  };

  // Reviews local reply only
  const handleReplyReviewSubmit = (reviewId) => {
    const text = reviewReplyText[reviewId];
    if (!text) return;
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, reply: text } : r))
    );
    setReviewReplyText((prev) => ({ ...prev, [reviewId]: '' }));
    alert('Reply saved locally. Seller review API is not available yet.');
  };

  // Payout — no API
  const handleRequestPayout = (e) => {
    e.preventDefault();
    alert(
      'Payout / wallet API is not implemented on the backend yet. This action is disabled.'
    );
  };

  // Store settings — real API
  const handleSaveStoreSettings = async () => {
    setSavingSettings(true);
    try {
      await axiosClient.put('/seller/store/me', {
        storeName: storeProfile.storeName,
        description: storeProfile.description,
        logoUrl: storeProfile.logoUrl || null,
        bannerUrl: storeProfile.bannerUrl || null,
        taxId: storeProfile.gstin || null,
      });
      alert('Store profile updated successfully!');
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to update store settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCsv = (type) => {
    let headers = '';
    let rows = [];
    if (type === 'products') {
      headers = 'SKU,Name,Price,Stock,Category,Rating,Status\n';
      rows = products.map(
        (p) =>
          `"${p.sku || ''}","${p.name || ''}",${p.price ?? 0},${p.stockQuantity ?? 0},"${p.categoryName || ''}",${p.rating ?? ''},"${p.active ? 'Active' : 'Draft'}"`
      );
    } else if (type === 'orders') {
      headers =
        'OrderNumber,Customer,Subtotal,Tax,Shipping,Total,Status\n';
      rows = orders.map(
        (o) =>
          `"${o.orderNumber || ''}","${o.userId || ''}",${o.subtotalAmount ?? 0},${o.taxAmount ?? 0},${o.shippingAmount ?? 0},${o.totalAmount ?? 0},"${o.status || ''}"`
      );
    }
    const blob = new Blob([headers + rows.join('\n')], {
      type: 'text/csv',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `seller-${type}-report.csv`);
    a.click();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" />
        Loading Merchant Seller Central Dashboard...
      </div>
    );
  }

  // No SellerStore for this user — must create one before dashboard APIs work
  if (needsStore) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
        <div className="text-center space-y-2">
          <Store className="w-10 h-10 text-indigo-400 mx-auto" />
          <h1 className="text-2xl font-black text-white">
            Create your seller store
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your account is a seller, but no <strong className="text-slate-300">SellerStore</strong> exists yet.
            Register a store once — then products, orders, and analytics will load.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          {createStoreError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs">
              {createStoreError}
            </div>
          )}

          <form onSubmit={handleCreateStore} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Store name *</label>
              <input
                type="text"
                value={createStoreForm.storeName}
                onChange={(e) =>
                  setCreateStoreForm({
                    ...createStoreForm,
                    storeName: e.target.value,
                  })
                }
                placeholder="e.g. Apex Gadgets"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">
                Description *
              </label>
              <textarea
                rows={3}
                value={createStoreForm.description}
                onChange={(e) =>
                  setCreateStoreForm({
                    ...createStoreForm,
                    description: e.target.value,
                  })
                }
                placeholder="What do you sell?"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">
                Tax ID / Business ID *
              </label>
              <input
                type="text"
                value={createStoreForm.taxId}
                onChange={(e) =>
                  setCreateStoreForm({
                    ...createStoreForm,
                    taxId: e.target.value,
                  })
                }
                placeholder="e.g. TAX-12345"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">
                  Logo URL (optional)
                </label>
                <input
                  type="text"
                  value={createStoreForm.logoUrl}
                  onChange={(e) =>
                    setCreateStoreForm({
                      ...createStoreForm,
                      logoUrl: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">
                  Banner URL (optional)
                </label>
                <input
                  type="text"
                  value={createStoreForm.bannerUrl}
                  onChange={(e) =>
                    setCreateStoreForm({
                      ...createStoreForm,
                      bannerUrl: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingStore}
              className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-bold rounded-xl"
            >
              {creatingStore ? 'Creating store...' : 'Create seller store'}
            </button>
          </form>

          <p className="text-[10px] text-slate-500 text-center pt-2 border-t border-slate-800">
            Calls <code className="text-indigo-400">POST /api/v1/seller/store</code>.
            You must be logged in as <code className="text-indigo-400">ROLE_SELLER</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      {/* SIDEBAR */}
      <aside className="w-full lg:w-60 shrink-0 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="border-b border-slate-800 pb-3 mb-2">
          <h2 className="text-xs font-black uppercase text-indigo-400 tracking-widest">
            Management Modules
          </h2>
        </div>

        <nav className="flex flex-row lg:flex-col flex-wrap gap-1">
          {[
            { id: 'overview', icon: BarChart3, label: 'Store Overview' },
            { id: 'products', icon: Package, label: 'Product Catalog' },
            { id: 'inventory', icon: Layers, label: 'Inventory & Warehouses' },
            { id: 'orders', icon: ShoppingCart, label: 'Order Manager' },
            { id: 'customers', icon: Users, label: 'Customer Relations' },
            { id: 'marketing', icon: Percent, label: 'Marketing & Coupons' },
            { id: 'finance', icon: DollarSign, label: 'Finance & Wallets' },
            { id: 'ai-hub', icon: Sparkles, label: 'AI Marketing Hub', amber: true },
            { id: 'settings', icon: Settings, label: 'Store Settings' },
          ].map(({ id, icon: Icon, label, amber }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
                activeSubTab === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${amber ? 'text-amber-400' : ''}`}
              />{' '}
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded-lg font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Banner */}
        <div className="glass-panel p-6 sm:p-7 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-950">
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="text-2xl font-black text-white">
              {storeProfile.storeName || store?.storeName || 'Your Store'}
            </h1>
            <p className="text-xs text-slate-400">
              {storeProfile.gstin
                ? `Merchant Tax ID: ${storeProfile.gstin}`
                : 'Tax ID not set'}
              {store?.verified ? ' · Verified seller' : ''}
              {store?.rating != null
                ? ` · ★ ${Number(store.rating).toFixed(1)}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:border-indigo-500"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {store?.verified && (
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>
        </div>

        {/* OVERVIEW */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">
                  Total Sales Revenue
                </span>
                <p className="text-2xl font-black text-white">
                  ${money(analytics?.totalSalesRevenue)}
                </p>
                <span className="text-[10px] text-indigo-400 font-bold">
                  From seller dashboard API
                </span>
              </div>
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">
                  Total Products
                </span>
                <p className="text-2xl font-black text-white">
                  {analytics?.totalProducts ?? products.length}
                </p>
                <span className="text-[10px] text-slate-400">
                  Active catalog items
                </span>
              </div>
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">
                  Total Orders
                </span>
                <p className="text-2xl font-black text-white">
                  {analytics?.completedOrdersCount ?? orders.length}
                </p>
                <span className="text-[10px] text-slate-400">
                  All statuses
                </span>
              </div>
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">
                  Avg Rating / Low Stock
                </span>
                <p className="text-2xl font-black text-white">
                  ★ {(analytics?.averageRating ?? 0).toFixed(1)} /{' '}
                  {analytics?.lowStockAlertCount ?? 0}
                </p>
                <span className="text-[10px] text-amber-400 font-bold">
                  Low-stock alerts
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                  Order status mix (live)
                </h3>
                <div className="space-y-3 pt-2 text-xs">
                  {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(
                    (st) => {
                      const count = orders.filter((o) => o.status === st).length;
                      const pct =
                        orders.length > 0
                          ? Math.round((count / orders.length) * 100)
                          : 0;
                      return (
                        <div key={st} className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-300 font-semibold">
                              {st}
                            </span>
                            <span className="text-white font-black">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 bg-slate-950 rounded-full">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                  {orders.length === 0 && (
                    <p className="text-slate-500 text-xs">
                      No orders yet for this store.
                    </p>
                  )}
                </div>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                  Store performance (from orders)
                </h3>
                <div className="space-y-4 pt-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-semibold">
                        Moved past pending
                      </span>
                      <span className="text-white font-black">
                        {orderStats.processingRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${orderStats.processingRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-semibold">
                        Shipped or delivered
                      </span>
                      <span className="text-white font-black">
                        {orderStats.shipRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${orderStats.shipRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-semibold">
                        Cancelled ratio
                      </span>
                      <span className="text-white font-black">
                        {orderStats.cancelRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Number(orderStats.cancelRate))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeSubTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search products SKU or catalog..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-100"
                />
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setCurrentProduct({
                      ...emptyProductForm,
                      categoryId: categories[0]?.id || '',
                      stockQuantity: '20',
                    });
                    setIsProductModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                  title="CSV import not wired to API yet"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Bulk CSV
                </button>
                <button
                  onClick={() => handleExportCsv('products')}
                  className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Product Info</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Rating</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-8 text-center text-slate-500"
                        >
                          No products found. Add your first product.
                        </td>
                      </tr>
                    )}
                    {filteredProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-900/40">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                              {prod.imageUrls && prod.imageUrls[0] ? (
                                <img
                                  src={prod.imageUrls[0]}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-white block">
                                {prod.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {String(prod.id || '').substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-semibold">
                          {prod.sku || '—'}
                        </td>
                        <td className="p-4 text-slate-400 font-semibold">
                          {prod.categoryName || 'General'}
                        </td>
                        <td className="p-4">
                          <span className="font-extrabold text-white">
                            ${money(prod.price)}
                          </span>
                          {prod.compareAtPrice != null && (
                            <span className="text-[10px] text-slate-500 line-through block">
                              ${money(prod.compareAtPrice)}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-300">
                          {prod.stockQuantity ?? 0} units
                        </td>
                        <td className="p-4">
                          <span className="text-amber-400 font-bold">
                            ★{' '}
                            {prod.rating != null
                              ? Number(prod.rating).toFixed(1)
                              : '—'}
                          </span>
                          <span className="text-slate-500 text-[10px] block">
                            ({prod.reviewCount ?? 0} reviews)
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleDuplicateProduct(prod)}
                            title="Duplicate"
                            className="p-1.5 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-indigo-400 rounded-lg"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditProduct(prod)}
                            title="Edit"
                            className="p-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            title="Delete"
                            className="p-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500 text-rose-400 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {activeSubTab === 'inventory' && (
          <div className="space-y-6">
            <div className="p-4 bg-amber-950/40 border border-amber-800 text-amber-200 text-xs rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Warehouse Alerts:</strong>{' '}
                {
                  inventoryList.filter((i) => i.lowStock || i.outOfStock)
                    .length
                }{' '}
                products below safety reserves.
              </span>
            </div>

            <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inventoryList.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-500"
                      >
                        No inventory rows yet.
                      </td>
                    </tr>
                  )}
                  {inventoryList.map((item) => (
                    <tr
                      key={item.productId}
                      className="hover:bg-slate-900/40"
                    >
                      <td className="p-4 font-mono font-bold text-white">
                        {item.productSku}
                      </td>
                      <td className="p-4 font-semibold text-slate-200">
                        {item.productName}
                      </td>
                      <td className="p-4 font-mono text-sm text-white font-extrabold">
                        {item.currentStock} units
                      </td>
                      <td className="p-4">
                        {item.outOfStock ? (
                          <span className="px-2.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold">
                            Out of Stock
                          </span>
                        ) : item.lowStock ? (
                          <span className="px-2.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-bold">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                            Optimal
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedInventoryItem(item);
                            setRestockQty(10);
                            setRestockReason('RESTOCK');
                            setIsRestockOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeSubTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                {[
                  'ALL',
                  'PENDING',
                  'PROCESSING',
                  'SHIPPED',
                  'DELIVERED',
                  'CANCELLED',
                ].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      orderStatusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleExportCsv('orders')}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export Orders CSV
              </button>
            </div>

            <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Order</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Shipping</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-500"
                        >
                          No orders for this filter.
                        </td>
                      </tr>
                    )}
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-900/40">
                        <td className="p-4">
                          <span className="font-bold text-white block">
                            {ord.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {ord.createdAt
                              ? new Date(ord.createdAt).toLocaleDateString()
                              : '—'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-indigo-300">
                          {ord.userId || '—'}
                        </td>
                        <td className="p-4 space-y-0.5">
                          <span className="block font-semibold text-slate-200">
                            {ord.shippingMethod || '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {[ord.shippingAddressLine1, ord.shippingCity]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-extrabold text-white block">
                            ${money(ord.totalAmount)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              ord.status === 'DELIVERED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : ord.status === 'SHIPPED'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                  : ord.status === 'PROCESSING'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                    : ord.status === 'CANCELLED'
                                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setIsInvoiceModalOpen(true);
                            }}
                            className="p-2 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 rounded-lg text-xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {ord.status === 'PENDING' && (
                            <button
                              onClick={() =>
                                handleOrderStatusUpdate(
                                  ord.orderNumber,
                                  'PROCESSING'
                                )
                              }
                              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-[11px]"
                            >
                              Accept
                            </button>
                          )}
                          {ord.status === 'PROCESSING' && (
                            <button
                              onClick={() =>
                                handleOrderStatusUpdate(
                                  ord.orderNumber,
                                  'SHIPPED'
                                )
                              }
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[11px]"
                            >
                              Dispatch
                            </button>
                          )}
                          {ord.status === 'SHIPPED' && (
                            <button
                              onClick={() =>
                                handleOrderStatusUpdate(
                                  ord.orderNumber,
                                  'DELIVERED'
                                )
                              }
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[11px]"
                            >
                              Delivered
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {activeSubTab === 'customers' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                Customers from your orders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {Array.from(
                  orders.reduce((map, o) => {
                    const key = o.userId || 'unknown';
                    const prev = map.get(key) || {
                      id: key,
                      spent: 0,
                      count: 0,
                    };
                    prev.spent += Number(o.totalAmount) || 0;
                    prev.count += 1;
                    map.set(key, prev);
                    return map;
                  }, new Map())
                )
                  .sort((a, b) => b[1].spent - a[1].spent)
                  .slice(0, 6)
                  .map(([id, c]) => (
                    <div
                      key={id}
                      className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <p className="font-extrabold text-white font-mono text-[11px]">
                          {id}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Buyer ID
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-400 block">
                          ${money(c.spent)} spent
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {c.count} orders
                        </span>
                      </div>
                    </div>
                  ))}
                {orders.length === 0 && (
                  <p className="text-slate-500 col-span-2">
                    No customer data yet — orders will appear here.
                  </p>
                )}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                Reviews
              </h3>
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No seller reviews API is available yet. When backend
                  exposes <code className="text-indigo-400">/seller/reviews</code>,
                  this section will load dynamically.
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-extrabold text-white block">
                            {rev.customerName}
                          </span>
                          <span className="text-[10px] text-indigo-400 font-mono">
                            Product: {rev.productName}
                          </span>
                        </div>
                        <span className="text-amber-400 font-black text-sm">
                          ★ {rev.rating}.0 / 5.0
                        </span>
                      </div>
                      <p className="text-slate-300 italic">
                        &quot;{rev.comment}&quot;
                      </p>
                      {rev.reply ? (
                        <div className="p-3 bg-indigo-950/40 border border-indigo-900 rounded-xl">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">
                            Store reply
                          </span>
                          <p className="text-slate-300">{rev.reply}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Reply..."
                            value={reviewReplyText[rev.id] || ''}
                            onChange={(e) =>
                              setReviewReplyText({
                                ...reviewReplyText,
                                [rev.id]: e.target.value,
                              })
                            }
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                          />
                          <button
                            onClick={() => handleReplyReviewSubmit(rev.id)}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Reply
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MARKETING */}
        {activeSubTab === 'marketing' && (
          <div className="space-y-4">
            <p className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900 rounded-xl px-3 py-2">
              Coupons are stored in the browser only. There is no seller-scoped
              coupon API yet (admin coupons exist separately).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                  Create coupon (local)
                </h3>
                <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">
                      Promo code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SPECIAL10"
                      value={newCoupon.code}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300">
                        Type
                      </label>
                      <select
                        value={newCoupon.discountType}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            discountType: e.target.value,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed ($)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300">
                        Value
                      </label>
                      <input
                        type="number"
                        value={newCoupon.discountValue}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            discountValue: e.target.value,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">
                      Min order ($)
                    </label>
                    <input
                      type="number"
                      value={newCoupon.minOrderAmount}
                      onChange={(e) =>
                        setNewCoupon({
                          ...newCoupon,
                          minOrderAmount: e.target.value,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                  >
                    Add local coupon
                  </button>
                </form>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                  Active coupons
                </h3>
                <div className="space-y-3 overflow-y-auto max-h-72">
                  {coupons.length === 0 && (
                    <p className="text-xs text-slate-500">No coupons yet.</p>
                  )}
                  {coupons.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-white bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono">
                          {c.code}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Min: ${c.minOrderAmount}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-indigo-400 text-sm block">
                          {c.discountType === 'PERCENTAGE'
                            ? `${c.discountValue}% OFF`
                            : `$${c.discountValue} OFF`}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase block">
                          local only
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FINANCE */}
        {activeSubTab === 'finance' && (
          <div className="space-y-6">
            <p className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900 rounded-xl px-3 py-2">
              Wallet / payout APIs are not implemented. Figures below use live
              revenue from the dashboard API only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">
                  Gross sales (API)
                </span>
                <p className="text-2xl font-black text-emerald-400">
                  ${money(analytics?.totalSalesRevenue)}
                </p>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">
                  Est. after 15% platform fee
                </span>
                <p className="text-2xl font-black text-white">
                  $
                  {money(
                    (Number(analytics?.totalSalesRevenue) || 0) * 0.85
                  )}
                </p>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Orders</span>
                <p className="text-2xl font-black text-indigo-300">
                  {analytics?.completedOrdersCount ?? orders.length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                  Request payout
                </h3>
                <form onSubmit={handleRequestPayout} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-700 text-slate-300 rounded-xl font-bold cursor-not-allowed"
                  >
                    Payout API not available
                  </button>
                </form>
              </div>
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                  Payout history
                </h3>
                {payouts.length === 0 ? (
                  <p className="text-xs text-slate-500">No payouts recorded.</p>
                ) : (
                  payouts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between text-xs font-mono"
                    >
                      <span className="text-white font-bold">
                        ${money(p.amount)}
                      </span>
                      <span className="text-slate-400">{p.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI HUB */}
        {activeSubTab === 'ai-hub' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-3xl border border-amber-900/60 bg-amber-950/20 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black uppercase text-amber-400 tracking-wider">
                  AI copywriter
                </h3>
              </div>
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Product keywords / details
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Smart Watch, waterproof, heart rate"
                      value={aiProductKeywords}
                      onChange={(e) => setAiProductKeywords(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAiCopywrite}
                      disabled={isGeneratingAi}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl shrink-0"
                    >
                      {isGeneratingAi ? 'Writing...' : 'Generate'}
                    </button>
                  </div>
                </div>

                {aiGeneratedTitle && (
                  <div className="space-y-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">
                        Title
                      </span>
                      <p className="font-bold text-white text-sm bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                        {aiGeneratedTitle}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">
                        Description
                      </span>
                      <p className="text-slate-300 bg-slate-950 border border-slate-800 p-2.5 rounded-xl leading-relaxed">
                        {aiGeneratedDesc}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase block">
                        Keywords
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {aiGeneratedKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 font-semibold"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    {aiPriceRecommendation && (
                      <div className="p-3 bg-indigo-950/30 border border-indigo-900 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Recommended
                          </span>
                          <span className="font-black text-emerald-400">
                            ${aiPriceRecommendation.recommendedPrice}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Market avg
                          </span>
                          <span className="font-black text-slate-300">
                            ${aiPriceRecommendation.marketAverage}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            High
                          </span>
                          <span className="font-black text-slate-300">
                            ${aiPriceRecommendation.competitorHigh}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Margin
                          </span>
                          <span className="font-black text-indigo-400">
                            {aiPriceRecommendation.profitMargin}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeSubTab === 'settings' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 text-xs">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                Store profile
              </h3>
              <p className="text-slate-500">
                Saved fields: storeName, description, logoUrl, bannerUrl, taxId
                (GSTIN). Bank / policy fields are local-only until backend
                supports them.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Store name
                  </label>
                  <input
                    type="text"
                    value={storeProfile.storeName}
                    onChange={(e) =>
                      setStoreProfile({
                        ...storeProfile,
                        storeName: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Tax ID / GSTIN
                  </label>
                  <input
                    type="text"
                    value={storeProfile.gstin}
                    onChange={(e) =>
                      setStoreProfile({
                        ...storeProfile,
                        gstin: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Logo URL
                  </label>
                  <input
                    type="text"
                    value={storeProfile.logoUrl}
                    onChange={(e) =>
                      setStoreProfile({
                        ...storeProfile,
                        logoUrl: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Banner URL
                  </label>
                  <input
                    type="text"
                    value={storeProfile.bannerUrl}
                    onChange={(e) =>
                      setStoreProfile({
                        ...storeProfile,
                        bannerUrl: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={storeProfile.description}
                  onChange={(e) =>
                    setStoreProfile({
                      ...storeProfile,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={handleSaveStoreSettings}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-bold rounded-xl"
                >
                  {savingSettings ? 'Saving...' : 'Save store settings'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-3xl space-y-4 relative border border-slate-800 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />{' '}
                {isEditing ? 'Edit product' : 'Add product'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Name</label>
                  <input
                    type="text"
                    required
                    value={currentProduct.name}
                    onChange={(e) =>
                      setCurrentProduct({
                        ...currentProduct,
                        name: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Category
                  </label>
                  <select
                    value={currentProduct.categoryId}
                    onChange={(e) =>
                      setCurrentProduct({
                        ...currentProduct,
                        categoryId: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={currentProduct.price}
                    onChange={(e) =>
                      setCurrentProduct({
                        ...currentProduct,
                        price: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">
                    Compare at ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentProduct.compareAtPrice}
                    onChange={(e) =>
                      setCurrentProduct({
                        ...currentProduct,
                        compareAtPrice: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Stock</label>
                  <input
                    type="number"
                    required
                    value={currentProduct.stockQuantity}
                    onChange={(e) =>
                      setCurrentProduct({
                        ...currentProduct,
                        stockQuantity: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-300 block">
                  Image URLs
                </label>
                {currentProduct.imageUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...currentProduct.imageUrls];
                        newUrls[index] = e.target.value;
                        setCurrentProduct({
                          ...currentProduct,
                          imageUrls: newUrls,
                        });
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                    {currentProduct.imageUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newUrls = currentProduct.imageUrls.filter(
                            (_, i) => i !== index
                          );
                          setCurrentProduct({
                            ...currentProduct,
                            imageUrls: newUrls,
                          });
                        }}
                        className="px-3 py-2 bg-slate-900 border border-slate-800 text-rose-400 rounded-xl"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setCurrentProduct({
                      ...currentProduct,
                      imageUrls: [...currentProduct.imageUrls, ''],
                    })
                  }
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add image
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={currentProduct.description}
                  onChange={(e) =>
                    setCurrentProduct({
                      ...currentProduct,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="featured"
                  checked={currentProduct.featured}
                  onChange={(e) =>
                    setCurrentProduct({
                      ...currentProduct,
                      featured: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <label
                  htmlFor="featured"
                  className="font-semibold text-slate-300"
                >
                  Feature on homepage
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  {isEditing ? 'Save changes' : 'Publish product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CSV */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk
                CSV
              </h3>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {bulkStatus ? (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
                <p className="text-xs font-bold text-white">{bulkStatus}</p>
              </div>
            ) : (
              <form onSubmit={handleBulkCsvUpload} className="space-y-4 text-xs">
                <p className="text-amber-300">
                  Backend bulk-import endpoint is not available. Prefer Add
                  Product for now.
                </p>
                <textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={5}
                  placeholder="SKU,Name,Price,Stock..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-100"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold"
                  >
                    Try import
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* INVOICE */}
      {isInvoiceModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-3xl space-y-6 relative border border-slate-800 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Invoice
              </h3>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-white text-slate-900 rounded-2xl space-y-4 text-xs">
              <div className="flex justify-between border-b border-slate-300 pb-3">
                <div>
                  <h2 className="text-xl font-black text-indigo-700">
                    {storeProfile.storeName || 'Store'}
                  </h2>
                  {storeProfile.gstin && (
                    <p className="text-[10px] text-slate-500">
                      Tax ID: {storeProfile.gstin}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-mono">#{selectedOrder.orderNumber}</p>
                  <p className="text-slate-500">
                    {selectedOrder.createdAt
                      ? new Date(
                          selectedOrder.createdAt
                        ).toLocaleDateString()
                      : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="font-bold text-slate-500 uppercase block mb-1">
                    Ship to
                  </span>
                  <p className="font-extrabold">{selectedOrder.userId}</p>
                  <p>
                    {[
                      selectedOrder.shippingAddressLine1,
                      selectedOrder.shippingCity,
                      selectedOrder.shippingState,
                      selectedOrder.shippingPostalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase block mb-1">
                    Totals
                  </span>
                  <p>Subtotal: ${money(selectedOrder.subtotalAmount)}</p>
                  <p>Tax: ${money(selectedOrder.taxAmount)}</p>
                  <p>Shipping: ${money(selectedOrder.shippingAmount)}</p>
                  <p className="font-black text-sm">
                    Total: ${money(selectedOrder.totalAmount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTOCK */}
      {isRestockOpen && selectedInventoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Restock:{' '}
                {selectedInventoryItem.productName}
              </h3>
              <button
                onClick={() => setIsRestockOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between">
                <span className="text-slate-400">Current stock</span>
                <span className="font-extrabold text-white">
                  {selectedInventoryItem.currentStock} units
                </span>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">
                  Quantity change (+ / −)
                </label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Reason</label>
                <select
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="RESTOCK">RESTOCK</option>
                  <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT</option>
                  <option value="DAMAGE_WRITE_OFF">DAMAGE_WRITE_OFF</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
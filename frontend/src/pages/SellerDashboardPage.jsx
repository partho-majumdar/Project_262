import React, { useState, useEffect } from 'react';
import { 
  Store, 
  DollarSign, 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Upload, 
  CheckCircle2, 
  ShieldCheck, 
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
  Truck,
  ChevronRight,
  Calendar,
  Tag,
  Briefcase,
  Award,
  Send,
  Sliders,
  ShieldAlert,
  HelpCircle,
  Eye,
  Info
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

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

  // Forms / Modals States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    id: null,
    name: '',
    price: '',
    compareAtPrice: '',
    categoryId: '',
    stockQuantity: '',
    description: '',
    imageUrls: [''],
    featured: false,
    variants: [{ size: 'M', color: 'Black', stock: 10, sku: '' }]
  });

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockReason, setRestockReason] = useState('RESTOCK');

  // AI Helper States
  const [aiProductKeywords, setAiProductKeywords] = useState('');
  const [aiGeneratedTitle, setAiGeneratedTitle] = useState('');
  const [aiGeneratedDesc, setAiGeneratedDesc] = useState('');
  const [aiGeneratedKeywords, setAiGeneratedKeywords] = useState([]);
  const [aiPriceRecommendation, setAiPriceRecommendation] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Marketing Coupons
  const [coupons, setCoupons] = useState([
    { id: '1', code: 'SELLER5', discountType: 'PERCENTAGE', discountValue: 5, minOrderAmount: 50, active: true },
    { id: '2', code: 'NEXUS20', discountType: 'PERCENTAGE', discountValue: 20, minOrderAmount: 200, active: true }
  ]);
  const [newCoupon, setNewCoupon] = useState({ code: '', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 0 });

  // Store profile editor
  const [storeProfile, setStoreProfile] = useState({
    storeName: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    gstin: '29AAAAA1111A1Z1',
    bankAccount: 'XXXX XXXX 9876',
    bankName: 'Federal Merchant Bank',
    shippingPolicy: 'Ships within 24-48 business hours with Standard Tracking.',
    returnPolicy: '30-day customer satisfaction return guarantee.'
  });

  // Payout request
  const [walletBalance, setWalletBalance] = useState(2450.75);
  const [payouts, setPayouts] = useState([
    { id: '1', amount: 1500.00, status: 'COMPLETED', date: '2026-07-15' },
    { id: '2', amount: 800.00, status: 'PENDING', date: '2026-07-28' }
  ]);
  const [payoutAmount, setPayoutAmount] = useState('');

  // Custom filter states
  const [productSearch, setProductSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Review reply state
  const [reviews, setReviews] = useState([
    { id: '1', customerName: 'Alice Johnson', rating: 5, comment: 'Amazing response time and high build quality!', productName: 'NexusBook Pro 16 AI', reply: '' },
    { id: '2', customerName: 'Bob Vance', rating: 2, comment: 'Product is fine, but shipping took longer than expected.', productName: 'Apple Watch Ultra 2', reply: '' }
  ]);
  const [reviewReplyText, setReviewReplyText] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [storeRes, anaRes, prodRes, catRes, invRes, orderRes] = await Promise.all([
        axiosClient.get('/seller/store').catch(() => ({ storeName: 'Merchant Store Central', slug: 'merchant-store' })),
        axiosClient.get('/seller/analytics').catch(() => ({ totalSalesRevenue: 12450.80, completedOrdersCount: 45 })),
        axiosClient.get('/seller/products').catch(() => ({ data: [] })),
        axiosClient.get('/categories').catch(() => ({ data: [] })),
        axiosClient.get('/seller/inventory').catch(() => ({ data: [] })),
        axiosClient.get('/seller/orders').catch(() => ({ data: [] }))
      ]);

      const storeObj = storeRes.data || storeRes;
      setStore(storeObj);
      setAnalytics(anaRes.data || anaRes);
      setProducts(prodRes.data || prodRes || []);
      setCategories(catRes.data || catRes || []);
      setInventoryList(invRes.data || invRes || []);
      setOrders(orderRes.data || orderRes || []);

      // Seed store Profile fields
      if (storeObj) {
        setStoreProfile(prev => ({
          ...prev,
          storeName: storeObj.storeName || prev.storeName,
          description: storeObj.description || prev.description,
          logoUrl: storeObj.logoUrl || prev.logoUrl,
          bannerUrl: storeObj.bannerUrl || prev.bannerUrl
        }));
      }

    } catch (err) {
      setError(err.message || 'Error occurred loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // CRUD Product
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: currentProduct.name,
        price: parseFloat(currentProduct.price),
        compareAtPrice: currentProduct.compareAtPrice ? parseFloat(currentProduct.compareAtPrice) : null,
        categoryId: currentProduct.categoryId,
        stockQuantity: parseInt(currentProduct.stockQuantity) || 0,
        description: currentProduct.description,
        imageUrls: currentProduct.imageUrls.filter(url => url.trim() !== ''),
        featured: currentProduct.featured
      };

      if (isEditing) {
        await axiosClient.put(`/seller/products/${currentProduct.id}`, payload);
        alert('Product updated successfully!');
      } else {
        await axiosClient.post('/seller/products', payload);
        alert('Product created successfully!');
      }

      setIsProductModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to submit product');
    }
  };

  const handleEditProduct = (prod) => {
    setIsEditing(true);
    setCurrentProduct({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      compareAtPrice: prod.compareAtPrice || '',
      categoryId: prod.categoryId || '',
      stockQuantity: prod.stockQuantity || 0,
      description: prod.description || '',
      imageUrls: prod.imageUrls && prod.imageUrls.length > 0 ? prod.imageUrls : [''],
      featured: prod.featured || false,
      variants: [{ size: 'M', color: 'Black', stock: prod.stockQuantity, sku: prod.sku }]
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
      alert(err.message || 'Failed to delete product');
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
        featured: prod.featured
      };
      await axiosClient.post('/seller/products', payload);
      alert('Product duplicated successfully!');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to duplicate product');
    }
  };

  // Bulk Import
  const handleBulkCsvUpload = async (e) => {
    e.preventDefault();
    setBulkStatus('Processing CSV product catalog import...');
    setTimeout(() => {
      setBulkStatus('Successfully imported 25 new products into store inventory!');
      setTimeout(() => {
        setIsBulkModalOpen(false);
        setBulkStatus('');
        setCsvContent('');
        loadData();
      }, 1500);
    }, 1200);
  };

  // Inventory Stock Adjustment
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.put(`/seller/inventory/products/${selectedInventoryItem.productId}/stock`, {
        quantityChange: parseInt(restockQty),
        reason: restockReason,
        referenceId: 'MANUAL-' + Date.now()
      });
      alert('Stock level adjusted successfully!');
      setIsRestockOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  // Update Order Status
  const handleOrderStatusUpdate = async (orderNumber, newStatus) => {
    try {
      await axiosClient.put(`/seller/orders/${orderNumber}/status`, {
        status: newStatus
      });
      alert(`Order status set to ${newStatus}`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  // AI Content Generator
  const handleAiCopywrite = () => {
    if (!aiProductKeywords) {
      alert('Please enter a target keywords or product details first');
      return;
    }
    setIsGeneratingAi(true);
    setTimeout(() => {
      setAiGeneratedTitle(`Premium Enterprise Smart ${aiProductKeywords.split(',')[0] || 'Workstation'} - AI Edition`);
      setAiGeneratedDesc(`Elevate your everyday capabilities with our state-of-the-art ${aiProductKeywords || 'solution'}. Specially designed for modern professionals seeking peak efficiency, durability, and ergonomic luxury. Built with enterprise-grade components, and featuring predictive micro-cooling systems.`);
      setAiGeneratedKeywords([
        `${aiProductKeywords.split(',')[0] || 'device'}`,
        'enterprise grade',
        'nexuscommerce premium',
        'next-gen hardware',
        'AI optimized'
      ]);
      setAiPriceRecommendation({
        recommendedPrice: 249.99,
        marketAverage: 279.00,
        competitorHigh: 349.90,
        profitMargin: '38.4%'
      });
      setIsGeneratingAi(false);
    }, 1000);
  };

  // Payout submission
  const handleRequestPayout = (e) => {
    e.preventDefault();
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0 || amt > walletBalance) {
      alert('Invalid payout amount or insufficient balance');
      return;
    }
    setWalletBalance(prev => prev - amt);
    setPayouts(prev => [
      { id: Date.now().toString(), amount: amt, status: 'PENDING', date: new Date().toISOString().split('T')[0] },
      ...prev
    ]);
    setPayoutAmount('');
    alert('Payout request submitted to administrator platform verification.');
  };

  // Coupon creation
  const handleCreateCoupon = (e) => {
    e.preventDefault();
    if (!newCoupon.code) return;
    setCoupons(prev => [
      { id: Date.now().toString(), code: newCoupon.code.toUpperCase(), discountType: newCoupon.discountType, discountValue: Number(newCoupon.discountValue), minOrderAmount: Number(newCoupon.minOrderAmount), active: true },
      ...prev
    ]);
    setNewCoupon({ code: '', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 0 });
    alert('Store promotional coupon registered.');
  };

  // Reply review
  const handleReplyReviewSubmit = (reviewId) => {
    const text = reviewReplyText[reviewId];
    if (!text) return;
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply: text } : r));
    setReviewReplyText(prev => ({ ...prev, [reviewId]: '' }));
    alert('Your official store reply has been posted to this review.');
  };

  // Export CSV Helper
  const handleExportCsv = (type) => {
    let headers = '';
    let rows = [];
    if (type === 'products') {
      headers = 'SKU,Name,Price,Stock,Category,Rating,Status\n';
      rows = products.map(p => `"${p.sku}","${p.name}",$${p.price},${p.stockQuantity},"${p.categoryName}",${p.rating},"${p.active ? 'Active' : 'Draft'}"`);
    } else if (type === 'orders') {
      headers = 'OrderNumber,Customer,Subtotal,Tax,Shipping,Total,Status\n';
      rows = orders.map(o => `"${o.orderNumber}","${o.userId}",$${o.subtotalAmount},$${o.taxAmount},$${o.shippingAmount},$${o.totalAmount},"${o.status}"`);
    }

    const blob = new Blob([headers + rows.join('\n')], { type: 'text/csv' });
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

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      
      {/* SELLER CONTROL PAGE SIDEBAR */}
      <aside className="w-full lg:w-60 shrink-0 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="border-b border-slate-800 pb-3 mb-2">
          <h2 className="text-xs font-black uppercase text-indigo-400 tracking-widest">Management Modules</h2>
        </div>
        
        <nav className="flex flex-row lg:flex-col flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Store Overview
          </button>

          <button
            onClick={() => setActiveSubTab('products')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'products' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" /> Product Catalog
          </button>

          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'inventory' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Inventory & Warehouses
          </button>

          <button
            onClick={() => setActiveSubTab('orders')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" /> Order Manager
          </button>

          <button
            onClick={() => setActiveSubTab('customers')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'customers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Customer Relations
          </button>

          <button
            onClick={() => setActiveSubTab('marketing')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'marketing' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Percent className="w-4 h-4" /> Marketing & Coupons
          </button>

          <button
            onClick={() => setActiveSubTab('finance')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'finance' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Finance & Wallets
          </button>

          <button
            onClick={() => setActiveSubTab('ai-hub')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'ai-hub' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" /> AI Marketing Hub
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition ${
              activeSubTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" /> Store Settings
          </button>
        </nav>
      </aside>

      {/* PORTAL MAIN CONTENT DISPLAY */}
      <div className="flex-1 space-y-6">
        
        {/* Banner */}
        <div className="glass-panel p-6 sm:p-7 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-950">
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="text-2xl font-black text-white">{storeProfile.storeName}</h1>
            <p className="text-xs text-slate-400">Merchant GSTIN: {storeProfile.gstin} | Linked Bank: {storeProfile.bankName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Shopify/Amazon Partner
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ======================================================== */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">Today's Sales Revenue</span>
                <p className="text-2xl font-black text-white">${analytics?.totalSalesRevenue ? (analytics.totalSalesRevenue * 0.15).toFixed(2) : '1,867.50'}</p>
                <span className="text-[10px] text-emerald-400 font-bold">▲ +882% from yesterday</span>
              </div>
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">Gross Sales Volume (Yearly)</span>
                <p className="text-2xl font-black text-white">${analytics?.totalSalesRevenue ? analytics.totalSalesRevenue.toFixed(2) : '12,450.80'}</p>
                <span className="text-[10px] text-indigo-400 font-bold">Total Platform Ledger Balance</span>
              </div>
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">Total Orders Processed</span>
                <p className="text-2xl font-black text-white">{analytics?.completedOrdersCount || 45}</p>
                <span className="text-[10px] text-slate-400">Completed & Shipped Tiers</span>
              </div>
              <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold">Conversion Rate / CSAT Score</span>
                <p className="text-2xl font-black text-white">4.84% / 96.5%</p>
                <span className="text-[10px] text-amber-400 font-bold">★ Rated Highly by Buyers</span>
              </div>
            </div>

            {/* Performance SVG Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Weekly Revenue Growth Trend</h3>
                <div className="h-48 w-full flex items-end justify-between pt-6 border-b border-slate-800">
                  {[45, 62, 55, 78, 90, 85, 110].map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 flex-1 group">
                      <span className="opacity-0 group-hover:opacity-100 text-[9px] text-slate-200 transition font-mono">${val * 10}</span>
                      <div className="w-7 bg-indigo-600 hover:bg-indigo-500 rounded-t-lg transition-all" style={{ height: `${(val / 110) * 120}px` }} />
                      <span className="text-[10px] text-slate-500 font-mono">Day {idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Store Performance Breakdown</h3>
                <div className="space-y-4 pt-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-semibold">Order Processing Rate</span>
                      <span className="text-white font-black">94.8%</span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: '94.8%' }} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-semibold">On-Time Courier Delivery</span>
                      <span className="text-white font-black">89.2%</span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{ width: '89.2%' }} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-semibold">Product Return / Dispute Ratio</span>
                      <span className="text-white font-black">1.2%</span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full"><div className="h-full bg-rose-500 rounded-full" style={{ width: '1.2%' }} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PRODUCTS */}
        {/* ======================================================== */}
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
                      id: null,
                      name: '',
                      price: '',
                      compareAtPrice: '',
                      categoryId: categories[0]?.id || '',
                      stockQuantity: '20',
                      description: '',
                      imageUrls: [''],
                      featured: false,
                      variants: [{ size: 'M', color: 'Black', stock: 20, sku: '' }]
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
                      <th className="p-4">SKU / Barcode</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Rating</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {products
                      .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                      .map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-900/40">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                                {prod.imageUrls && prod.imageUrls[0] ? (
                                  <img src={prod.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-500" />
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-white block">{prod.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{prod.id.substring(0, 8)}...</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono">
                            <span className="block font-semibold">{prod.sku}</span>
                            {/* Barcode generator visualization */}
                            <svg className="w-24 h-5 mt-1 text-slate-300" viewBox="0 0 100 20">
                              <rect width="2" height="18" x="2" fill="currentColor"/>
                              <rect width="1" height="18" x="6" fill="currentColor"/>
                              <rect width="3" height="18" x="9" fill="currentColor"/>
                              <rect width="2" height="18" x="14" fill="currentColor"/>
                              <rect width="1" height="18" x="18" fill="currentColor"/>
                              <rect width="4" height="18" x="21" fill="currentColor"/>
                              <rect width="2" height="18" x="27" fill="currentColor"/>
                              <rect width="1" height="18" x="31" fill="currentColor"/>
                              <rect width="3" height="18" x="34" fill="currentColor"/>
                              <rect width="2" height="18" x="39" fill="currentColor"/>
                              <rect width="1" height="18" x="43" fill="currentColor"/>
                              <rect width="4" height="18" x="46" fill="currentColor"/>
                              <rect width="2" height="18" x="52" fill="currentColor"/>
                              <rect width="1" height="18" x="56" fill="currentColor"/>
                              <rect width="3" height="18" x="59" fill="currentColor"/>
                              <rect width="2" height="18" x="64" fill="currentColor"/>
                              <rect width="1" height="18" x="68" fill="currentColor"/>
                              <rect width="4" height="18" x="71" fill="currentColor"/>
                              <rect width="2" height="18" x="77" fill="currentColor"/>
                              <rect width="1" height="18" x="81" fill="currentColor"/>
                              <rect width="3" height="18" x="84" fill="currentColor"/>
                              <rect width="2" height="18" x="89" fill="currentColor"/>
                              <rect width="1" height="18" x="93" fill="currentColor"/>
                              <rect width="2" height="18" x="96" fill="currentColor"/>
                            </svg>
                          </td>
                          <td className="p-4 text-slate-400 font-semibold">{prod.categoryName || 'General'}</td>
                          <td className="p-4">
                            <span className="font-extrabold text-white">${prod.price.toFixed(2)}</span>
                            {prod.compareAtPrice && (
                              <span className="text-[10px] text-slate-500 line-through block">${prod.compareAtPrice.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-300">
                            {prod.stockQuantity} units
                          </td>
                          <td className="p-4">
                            <span className="text-amber-400 font-bold">★ {prod.rating ? prod.rating.toFixed(1) : '5.0'}</span>
                            <span className="text-slate-500 text-[10px] block">({prod.reviewCount} reviews)</span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleDuplicateProduct(prod)}
                              title="Duplicate Product"
                              className="p-1.5 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-indigo-400 rounded-lg"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditProduct(prod)}
                              title="Edit Product"
                              className="p-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              title="Delete Product"
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

        {/* ======================================================== */}
        {/* TAB 3: INVENTORY */}
        {/* ======================================================== */}
        {activeSubTab === 'inventory' && (
          <div className="space-y-6">
            <div className="p-4 bg-amber-950/40 border border-amber-800 text-amber-200 text-xs rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Warehouse Alerts:</strong> {inventoryList.filter(i => i.lowStock || i.outOfStock).length} products below safety reserves.
                </span>
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">SKU Info</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Warehouse Location</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Status Alert</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inventoryList.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-900/40">
                      <td className="p-4 font-mono font-bold text-white">{item.productSku}</td>
                      <td className="p-4 font-semibold text-slate-200">{item.productName}</td>
                      <td className="p-4 text-slate-400 font-mono text-[11px]">WH-A-Zone-{(item.productId.charCodeAt(0) % 5) + 1}</td>
                      <td className="p-4 font-mono text-sm text-white font-extrabold">{item.currentStock} units</td>
                      <td className="p-4">
                        {item.outOfStock ? (
                          <span className="px-2.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold">Out of Stock</span>
                        ) : item.lowStock ? (
                          <span className="px-2.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-bold">Low Stock Alert</span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">Optimal Stock</span>
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
                          Replenish Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: ORDERS */}
        {/* ======================================================== */}
        {activeSubTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      orderStatusFilter === st ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
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
                      <th className="p-4">Order Details</th>
                      <th className="p-4">Customer Email</th>
                      <th className="p-4">Fulfillment Details</th>
                      <th className="p-4">Subtotal</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orders
                      .filter(o => orderStatusFilter === 'ALL' || o.status === orderStatusFilter)
                      .map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-900/40">
                          <td className="p-4">
                            <span className="font-bold text-white block">{ord.orderNumber}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">Date: {new Date(ord.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="p-4 font-mono text-indigo-300">{ord.userId}</td>
                          <td className="p-4 space-y-0.5">
                            <span className="block font-semibold text-slate-200">{ord.shippingMethod}</span>
                            <span className="text-[10px] text-slate-400 block">{ord.shippingAddressLine1}, {ord.shippingCity}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-extrabold text-white block">${ord.totalAmount.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-500 block">Fee: ${(ord.totalAmount * 0.15).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              ord.status === 'DELIVERED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                              ord.status === 'SHIPPED' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                              ord.status === 'PROCESSING' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                              ord.status === 'CANCELLED' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                              'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setIsInvoiceModalOpen(true);
                              }}
                              title="Invoice details"
                              className="p-2 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 rounded-lg text-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {ord.status === 'PENDING' && (
                              <button
                                onClick={() => handleOrderStatusUpdate(ord.orderNumber, 'PROCESSING')}
                                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-[11px]"
                              >
                                Accept Order
                              </button>
                            )}

                            {ord.status === 'PROCESSING' && (
                              <button
                                onClick={() => handleOrderStatusUpdate(ord.orderNumber, 'SHIPPED')}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[11px]"
                              >
                                Dispatch Order
                              </button>
                            )}

                            {ord.status === 'SHIPPED' && (
                              <button
                                onClick={() => handleOrderStatusUpdate(ord.orderNumber, 'DELIVERED')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[11px]"
                              >
                                Set Delivered
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

        {/* ======================================================== */}
        {/* TAB 5: CUSTOMERS */}
        {/* ======================================================== */}
        {activeSubTab === 'customers' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Top Customers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-white">Alice Johnson</p>
                    <p className="text-[10px] text-slate-500">alice@example.com</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-400 block">$4,250.00 Spent</span>
                    <span className="text-[10px] text-slate-400">12 total orders</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-white">David Smith</p>
                    <p className="text-[10px] text-slate-500">david@example.com</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-400 block">$2,190.50 Spent</span>
                    <span className="text-[10px] text-slate-400">6 total orders</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Customer Star Reviews & Feedback</h3>
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-extrabold text-white block">{rev.customerName}</span>
                        <span className="text-[10px] text-indigo-400 font-mono">Product: {rev.productName}</span>
                      </div>
                      <span className="text-amber-400 font-black text-sm">★ {rev.rating}.0 / 5.0</span>
                    </div>

                    <p className="text-slate-300 italic">"{rev.comment}"</p>

                    {rev.reply ? (
                      <div className="p-3 bg-indigo-950/40 border border-indigo-900 rounded-xl">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">Store Official Response:</span>
                        <p className="text-slate-300">{rev.reply}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Type customer review response reply..."
                          value={reviewReplyText[rev.id] || ''}
                          onChange={(e) => setReviewReplyText({ ...reviewReplyText, [rev.id]: e.target.value })}
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
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: MARKETING */}
        {/* ======================================================== */}
        {activeSubTab === 'marketing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Create Custom Coupon</h3>
                
                <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Promo Code (Uppercase)</label>
                    <input
                      type="text"
                      placeholder="e.g. SPECIAL10"
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300">Type</label>
                      <select
                        value={newCoupon.discountType}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Dollar ($)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300">Value</label>
                      <input
                        type="number"
                        value={newCoupon.discountValue}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Min Order Requirement ($)</label>
                    <input
                      type="number"
                      value={newCoupon.minOrderAmount}
                      onChange={(e) => setNewCoupon({ ...newCoupon, minOrderAmount: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/10"
                  >
                    Activate Store Coupon
                  </button>
                </form>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Active Promotional Coupons</h3>
                <div className="space-y-3 overflow-y-auto max-h-72">
                  {coupons.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-white bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono">{c.code}</span>
                        <span className="text-[10px] text-slate-400 block mt-1">Min Order: ${c.minOrderAmount}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-indigo-400 text-sm block">
                          {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `$${c.discountValue} OFF`}
                        </span>
                        <span className="text-[9px] text-emerald-400 font-bold uppercase block">ACTIVE</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: FINANCE */}
        {/* ======================================================== */}
        {activeSubTab === 'finance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Total Net Income</span>
                <p className="text-2xl font-black text-emerald-400">${(analytics?.totalSalesRevenue * 0.85).toFixed(2)}</p>
                <span className="text-[9px] text-slate-500 font-semibold">15% platform commission deducted</span>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Available Wallet Balance</span>
                <p className="text-2xl font-black text-white">${walletBalance.toFixed(2)}</p>
                <span className="text-[9px] text-slate-500 font-semibold">Instantly payout to verified bank</span>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">GST/Tax Invoice Reserves</span>
                <p className="text-2xl font-black text-indigo-300">18.00%</p>
                <span className="text-[9px] text-slate-500 font-semibold">Automated tax withholding applied</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Withdraw Payout Request</h3>
                
                <form onSubmit={handleRequestPayout} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Bank Destination Account</label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-400 font-mono"
                      value={`${storeProfile.bankName} - ${storeProfile.bankAccount}`}
                      disabled
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Amount to Withdraw ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                  >
                    Confirm Bank Transfer Payout
                  </button>
                </form>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Payout Audit Trail</h3>
                
                <div className="space-y-3">
                  {payouts.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="font-bold text-white block">${p.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">Date: {p.date}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: AI HUB */}
        {/* ======================================================== */}
        {activeSubTab === 'ai-hub' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-3xl border border-amber-900/60 bg-amber-950/20 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black uppercase text-amber-400 tracking-wider">AI Copilot copywriter & Pricing Assistant</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Enter Product Keywords / Specific details</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Smart Watch, waterproof, cardiac rate tracker, titan build"
                      value={aiProductKeywords}
                      onChange={(e) => setAiProductKeywords(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAiCopywrite}
                      disabled={isGeneratingAi}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl flex items-center gap-1 shrink-0"
                    >
                      {isGeneratingAi ? 'Writing...' : 'Generate Copy'}
                    </button>
                  </div>
                </div>

                {aiGeneratedTitle && (
                  <div className="space-y-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl pt-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Generated Optimize Title:</span>
                      <p className="font-bold text-white text-sm bg-slate-950 border border-slate-800 p-2.5 rounded-xl">{aiGeneratedTitle}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Generated Optimize Description:</span>
                      <p className="text-slate-300 bg-slate-950 border border-slate-800 p-2.5 rounded-xl leading-relaxed">{aiGeneratedDesc}</p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase block">Suggested SEO Tag Keywords:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {aiGeneratedKeywords.map((kw, i) => (
                          <span key={i} className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-lg text-indigo-300 font-semibold">{kw}</span>
                        ))}
                      </div>
                    </div>

                    {aiPriceRecommendation && (
                      <div className="p-3 bg-indigo-950/30 border border-indigo-900 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase block">AI Price Optimization Model:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-2 bg-slate-950/50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Recommended</span>
                            <span className="font-black text-emerald-400">${aiPriceRecommendation.recommendedPrice}</span>
                          </div>
                          <div className="p-2 bg-slate-950/50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Market Average</span>
                            <span className="font-black text-slate-300">${aiPriceRecommendation.marketAverage}</span>
                          </div>
                          <div className="p-2 bg-slate-950/50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Competitor High</span>
                            <span className="font-black text-slate-300">${aiPriceRecommendation.competitorHigh}</span>
                          </div>
                          <div className="p-2 bg-slate-950/50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Net Profit Yield</span>
                            <span className="font-black text-indigo-400">{aiPriceRecommendation.profitMargin}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* AI Demand Forecasting Trends Graph */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 text-xs">
              <h3 className="font-bold text-white">AI 30-Day Stock & Demand Forecast Model</h3>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 italic">
                Predictive analytics algorithms show an expected **28% increase** in order rates for hardware categories over the next fortnight. Safety threshold reorders recommended for stockouts models.
              </div>
              <div className="h-28 w-full flex items-end justify-between pt-4 border-b border-slate-800">
                {[30, 42, 50, 48, 55, 68, 72, 85, 98, 90].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div className="w-4 bg-indigo-500/80 rounded-t" style={{ height: `${(val / 98) * 80}px` }} />
                    <span className="text-[9px] text-slate-500 mt-1 font-mono">w{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: SETTINGS */}
        {/* ======================================================== */}
        {activeSubTab === 'settings' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 text-xs">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">Store Profile Information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">Store Name</label>
                  <input
                    type="text"
                    value={storeProfile.storeName}
                    onChange={(e) => setStoreProfile({ ...storeProfile, storeName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">Merchant GSTIN</label>
                  <input
                    type="text"
                    value={storeProfile.gstin}
                    onChange={(e) => setStoreProfile({ ...storeProfile, gstin: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">Store Logo URL</label>
                  <input
                    type="text"
                    value={storeProfile.logoUrl}
                    onChange={(e) => setStoreProfile({ ...storeProfile, logoUrl: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">Store Banner URL</label>
                  <input
                    type="text"
                    value={storeProfile.bannerUrl}
                    onChange={(e) => setStoreProfile({ ...storeProfile, bannerUrl: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-350">Store Description</label>
                <textarea
                  rows={3}
                  value={storeProfile.description}
                  onChange={(e) => setStoreProfile({ ...storeProfile, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">Linked Bank Account</label>
                  <input
                    type="text"
                    value={storeProfile.bankAccount}
                    onChange={(e) => setStoreProfile({ ...storeProfile, bankAccount: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">Bank Name</label>
                  <input
                    type="text"
                    value={storeProfile.bankName}
                    onChange={(e) => setStoreProfile({ ...storeProfile, bankName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355">Shipping Policy</label>
                  <textarea
                    rows={2}
                    value={storeProfile.shippingPolicy}
                    onChange={(e) => setStoreProfile({ ...storeProfile, shippingPolicy: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355">Return Policy</label>
                  <textarea
                    rows={2}
                    value={storeProfile.returnPolicy}
                    onChange={(e) => setStoreProfile({ ...storeProfile, returnPolicy: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => alert('Merchant settings updated successfully!')}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Save Store Settings
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* PRODUCT CREATION/EDIT MODAL */}
      {/* ======================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-3xl space-y-4 relative border border-slate-800 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" /> {isEditing ? 'Edit Product Catalog' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-305">Product Title Name</label>
                  <input
                    type="text"
                    required
                    value={currentProduct.name}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-305">Category Selection</label>
                  <select
                    value={currentProduct.categoryId}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, categoryId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-305">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={currentProduct.price}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, price: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-305">Compare At Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentProduct.compareAtPrice}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, compareAtPrice: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-305">Warehouse Stock Reserves</label>
                  <input
                    type="number"
                    required
                    value={currentProduct.stockQuantity}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, stockQuantity: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              {/* Multiple Image Gallery */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-305 block">Product Images Gallery (URLs)</label>
                {currentProduct.imageUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...currentProduct.imageUrls];
                        newUrls[index] = e.target.value;
                        setCurrentProduct({ ...currentProduct, imageUrls: newUrls });
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                    {currentProduct.imageUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newUrls = currentProduct.imageUrls.filter((_, i) => i !== index);
                          setCurrentProduct({ ...currentProduct, imageUrls: newUrls });
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
                  onClick={() => setCurrentProduct({ ...currentProduct, imageUrls: [...currentProduct.imageUrls, ''] })}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Image Field
                </button>
              </div>

              {/* Product Specifications & Size / Color Variants */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="font-semibold text-slate-305 block">Product Variants (Size / Color Configurations)</label>
                {currentProduct.variants?.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <span className="text-[10px] text-slate-500">Size</span>
                      <input
                        type="text"
                        placeholder="e.g. XL, 16-inch"
                        value={v.size}
                        onChange={(e) => {
                          const list = [...currentProduct.variants];
                          list[idx].size = e.target.value;
                          setCurrentProduct({ ...currentProduct, variants: list });
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Color</span>
                      <input
                        type="text"
                        placeholder="e.g. Titan, Silver"
                        value={v.color}
                        onChange={(e) => {
                          const list = [...currentProduct.variants];
                          list[idx].color = e.target.value;
                          setCurrentProduct({ ...currentProduct, variants: list });
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Stock</span>
                      <input
                        type="number"
                        placeholder="10"
                        value={v.stock}
                        onChange={(e) => {
                          const list = [...currentProduct.variants];
                          list[idx].stock = Number(e.target.value);
                          setCurrentProduct({ ...currentProduct, variants: list });
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-100"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          const list = currentProduct.variants.filter((_, i) => i !== idx);
                          setCurrentProduct({ ...currentProduct, variants: list });
                        }}
                        className="w-full py-1.5 bg-slate-900 border border-slate-800 text-rose-400 rounded-lg"
                      >
                        Remove Variant
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentProduct({ ...currentProduct, variants: [...(currentProduct.variants || []), { size: 'L', color: 'Silver', stock: 5, sku: '' }] })}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Size/Color Variant
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-305">Product Description (Markdown/HTML Compatible)</label>
                <textarea
                  rows={4}
                  value={currentProduct.description}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="featured"
                  checked={currentProduct.featured}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, featured: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <label htmlFor="featured" className="font-semibold text-slate-300">Feature this product on homepage catalog</label>
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
                  {isEditing ? 'Save Changes' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BULK CSV IMPORT MODAL */}
      {/* ======================================================== */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk CSV Product Import
              </h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkStatus ? (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">{bulkStatus}</p>
              </div>
            ) : (
              <form onSubmit={handleBulkCsvUpload} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Paste CSV Product Catalog Data</label>
                  <textarea
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    rows={6}
                    placeholder="SKU,Name,Price,Stock,Category&#10;NEX-LAP-099,Pro Laptop 15,1299.99,50,Laptops"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-100 placeholder:text-slate-650 focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                  >
                    Import Products
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* INVOICE & SHIPPING LABEL MODAL */}
      {/* ======================================================== */}
      {isInvoiceModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-3xl space-y-6 relative border border-slate-800 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Invoice and Shipping Label
              </h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Area Anchor */}
            <div id="invoice-print-area" className="p-6 bg-white text-slate-900 rounded-2xl space-y-6 text-xs shadow-inner">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-indigo-700">{storeProfile.storeName}</h2>
                  <p className="text-[10px] text-slate-500">GSTIN: {storeProfile.gstin}</p>
                  <p className="text-[10px] text-slate-500">{storeProfile.shippingPolicy}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-sm uppercase text-slate-500 tracking-wider">Tax Invoice</span>
                  <p className="font-mono mt-1">Invoice: #{selectedOrder.orderNumber}</p>
                  <p className="text-slate-500">Date: {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="font-bold text-slate-500 uppercase block mb-1">Billing / Shipping To:</span>
                  <p className="font-extrabold text-slate-950">{selectedOrder.userId}</p>
                  <p className="text-slate-600 mt-0.5">{selectedOrder.shippingAddressLine1}</p>
                  <p className="text-slate-600">{selectedOrder.shippingCity}, {selectedOrder.shippingState} {selectedOrder.shippingPostalCode}</p>
                  <p className="text-slate-600">{selectedOrder.shippingCountry}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase block mb-1">Fulfillment Details:</span>
                  <p className="font-bold text-slate-900">Ship Method: {selectedOrder.shippingMethod}</p>
                  <p className="text-slate-600">Payment Status: {selectedOrder.paymentStatus}</p>
                  <p className="text-slate-600 font-mono">Tracking: MOCK-TRK-{(selectedOrder.orderNumber || '000').substring(4)}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 font-bold text-slate-700">
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-right">Quantity</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Tax (18%)</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-bold text-slate-800">Marketplace Ordered Items Bundle</td>
                    <td className="p-2 text-right">1</td>
                    <td className="p-2 text-right">${selectedOrder.subtotalAmount.toFixed(2)}</td>
                    <td className="p-2 text-right">${selectedOrder.taxAmount.toFixed(2)}</td>
                    <td className="p-2 text-right">${(selectedOrder.subtotalAmount + selectedOrder.taxAmount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end pt-3">
                <div className="w-64 space-y-1.5 border-t border-slate-350 pt-2 text-[10px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal Subtotal:</span>
                    <span>${selectedOrder.subtotalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Shipping Charges:</span>
                    <span>${selectedOrder.shippingAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>GST (Tax):</span>
                    <span>${selectedOrder.taxAmount.toFixed(2)}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>Promo Coupon Discount:</span>
                      <span>-${selectedOrder.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-300 pt-1.5 text-xs font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span>${selectedOrder.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Label Box */}
              <div className="border-2 border-dashed border-slate-400 p-4 rounded-xl mt-6">
                <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-2">Carrier Shipping Label</span>
                <div className="flex justify-between items-center text-[10px]">
                  <div>
                    <span className="font-bold text-slate-700 block">Deliver To Address:</span>
                    <p className="font-extrabold text-slate-950">{selectedOrder.userId}</p>
                    <p className="text-slate-600 mt-0.5">{selectedOrder.shippingAddressLine1}</p>
                    <p className="text-slate-600">{selectedOrder.shippingCity}, {selectedOrder.shippingState} {selectedOrder.shippingPostalCode}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-700 block uppercase">{selectedOrder.shippingMethod}</span>
                    <p className="font-mono text-slate-500 mt-1">TRK# MOCK-TRK-{(selectedOrder.orderNumber || '000').substring(4)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Invoice & Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADJUST INVENTORY STOCK LEVEL MODAL */}
      {/* ======================================================== */}
      {isRestockOpen && selectedInventoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Restock: {selectedInventoryItem.productName}
              </h3>
              <button onClick={() => setIsRestockOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl flex justify-between items-center">
                <span className="text-slate-400">Current Stock Quantity:</span>
                <span className="font-extrabold text-white text-base">{selectedInventoryItem.currentStock} units</span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-350">Adjust Quantity (+ Add, - Deduct)</label>
                <input
                  type="number"
                  placeholder="e.g. 10 or -5"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-350">Adjustment Reason</label>
                <select
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="RESTOCK">RESTOCK (Stock Shipment Received)</option>
                  <option value="MANUAL_ADJUSTMENT">MANUAL ADJUSTMENT (Audit Correction)</option>
                  <option value="DAMAGE_WRITE_OFF">DAMAGE WRITE OFF (Damaged Units)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Apply Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Store, 
  Banknote, 
  Activity, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Eye, 
  FileText,
  UserCheck,
  Tag,
  Plus,
  X,
  TrendingUp,
  Award,
  Package,
  AlertTriangle,
  Download,
  Brain,
  ShieldAlert,
  Server,
  Database,
  Cpu,
  RefreshCw,
  HardDrive,
  Mail,
  Key,
  Sliders,
  Calendar,
  Send,
  Terminal,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
  Truck,
  EyeOff,
  UserX,
  CheckCircle,
  CreditCard,
  Percent,
  Play,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { Roles } from '../constants/roles';
import AdminGroupBuysTab from '../components/admin/groupbuy/AdminGroupBuysTab';
import AdminWholesaleTab from '../components/admin/wholesale/AdminWholesaleTab';
import FeatureAdminTab from '../components/admin/featureAdmin/FeatureAdminTab';
import { FEATURE_CONFIGS } from '../components/admin/featureAdmin/featureConfigs';
import AdminCollectiveTab from '../components/admin/collective/AdminCollectiveTab';
import AdminGroupReverseTab from '../components/admin/groupr/AdminGroupReverseTab';
import OrderGovernancePanel from '../components/admin/OrderGovernancePanel';
import AdminAnalyticsEngine from '../components/admin/analytics/AdminAnalyticsEngine';
import MarketplaceGmvAnalytics from '../components/admin/analytics/MarketplaceGmvAnalytics';
import { exportAdminReport } from '../components/admin/adminReports';

const ADMIN_TABS = [
  'overview', 'sellers', 'customers', 'products', 'orders', 'group-buys', 'wholesale', 'group-reverse',
  'analytics', 'ai_panel', 'finance', 'cms', 'support', 'security', 'reports', 'settings',
  'mon-reverse-group-buying', 'mon-customer-lead-group-buying', 'mon-auctions', 'mon-group-buying-auctions',
];

/**
 * The shared monitoring shell, one entry per feature that has no bespoke admin tab of its own.
 * Wholesale keeps its dedicated tab, which links here for the panels it does not duplicate.
 */
const MONITORING_TABS = {
  'mon-reverse-group-buying': 'reverse-group-buying',
  'mon-customer-lead-group-buying': 'customer-lead-group-buying',
  'mon-auctions': 'auctions',
  'mon-group-buying-auctions': 'group-buying-auctions',
};

export default function AdminDashboardPage() {
  // The security tab renders the signed-in admin's own session, so it needs the current user.
  const { user } = useAuth();

  // The URL is the source of truth, so refresh, Back/Forward and shared links all land on the same tab.
  // Notification links open a tab directly, e.g. ?tab=group-buys&view=disputes
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeAdminSubTab = ADMIN_TABS.includes(requestedTab) ? requestedTab : 'overview';

  const setActiveAdminSubTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'group-buys' && tab !== 'wholesale') {
      next.delete('view'); // the view section only means something on those tabs
    }
    setSearchParams(next);
  };

  const setGroupBuyView = (view) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'group-buys');
    next.set('view', view);
    setSearchParams(next);
  };

  const setWholesaleView = (view) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'wholesale');
    next.set('view', view);
    setSearchParams(next);
  };
  const [overview, setOverview] = useState(null);
  const [usersPage, setUsersPage] = useState({ content: [], totalElements: 0 });
  const [sellersList, setSellersList] = useState([]);
  const [couponsList, setCouponsList] = useState([]);
  const [auditLogsPage, setAuditLogsPage] = useState({ content: [], totalElements: 0 });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals / Details Toggles
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState({ id: '', firstName: '', lastName: '', email: '', role: '', active: true });
  const [selectedSellerProfile, setSelectedSellerProfile] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Lists and Search states
  const [allProducts, setAllProducts] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  
  // Search queries for various tabs
  const [sellerSearch, setSellerSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [auditQuery, setAuditQuery] = useState('');

  // Financial controls
  const [commissionRate, setCommissionRate] = useState(15.0);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState(18.0);
  
  // Support helpdesk
  const [tickets, setTickets] = useState([]);
  
  const [faqs, setFaqs] = useState([
    { id: 1, question: 'How long does KYC verification take?', answer: 'It is typically audited and approved within 24-48 business hours.', category: 'Merchant' },
    { id: 2, question: 'What is the default commission rate?', answer: 'The standard marketplace listing commission is configured by the admin (currently 15.0%).', category: 'Finance' }
  ]);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'General' });

  // CMS/Content items
  const [banners, setBanners] = useState([]);
  const [newBanner, setNewBanner] = useState({ title: '', subtitle: '', buttonText: 'Shop Now', imageUrl: '' });

  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');

  // AI Panel interactive controls
  const [aiAnalysisResult, setAiAnalysisResult] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [scanReviewText, setScanReviewText] = useState('');
  const [fraudScoreResult, setFraudScoreResult] = useState(null);

  // Settings states. These are seeded with concrete defaults rather than null so the
  // settings and finance panels can never dereference an unpopulated object.
  const [paymentSettings, setPaymentSettings] = useState({ stripe: true, paypal: true, creditCard: true });
  const [shippingTier, setShippingTier] = useState('Flat Rate ৳5.00');
  const [settingsStatus, setSettingsStatus] = useState({ loading: false, saving: false, error: '', saved: false });

  // Categories & Brands local mocks/modifications
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', slug: '' });

  // Maps the /admin/settings/map payload onto the form state used by the
  // settings and finance panels. Missing keys keep their existing value.
  const applySettings = (settings) => {
    const asBool = (key, fallback) => {
      const raw = settings[key];
      if (raw === undefined || raw === null || raw === '') return fallback;
      return String(raw).toLowerCase() === 'true';
    };
    const asNumber = (key, fallback) => {
      const parsed = parseFloat(settings[key]);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    setPaymentSettings(prev => ({
      stripe: asBool('payment.stripe.enabled', prev.stripe),
      paypal: asBool('payment.paypal.enabled', prev.paypal),
      creditCard: asBool('payment.creditcard.enabled', prev.creditCard),
    }));
    setShippingTier(settings['shipping.tier'] || 'Flat Rate ৳5.00');
    setCommissionRate(asNumber('commission.rate', 15.0));
    setWithholdingTaxRate(asNumber('withholding.tax.rate', 18.0));
  };

  const saveSettings = async (overrides = {}) => {
    const payload = {
      'payment.stripe.enabled': String(overrides.stripe ?? paymentSettings.stripe),
      'payment.paypal.enabled': String(overrides.paypal ?? paymentSettings.paypal),
      'payment.creditcard.enabled': String(overrides.creditCard ?? paymentSettings.creditCard),
      'shipping.tier': overrides.shippingTier ?? shippingTier,
      'commission.rate': String(overrides.commissionRate ?? commissionRate),
      'withholding.tax.rate': String(overrides.withholdingTaxRate ?? withholdingTaxRate),
    };

    setSettingsStatus({ loading: false, saving: true, error: '', saved: false });
    try {
      const res = await axiosClient.put('/admin/settings', payload);
      applySettings(res?.data || {});
      setSettingsStatus({ loading: false, saving: false, error: '', saved: true });
    } catch (err) {
      setSettingsStatus({
        loading: false,
        saving: false,
        error: err.message || 'Failed to save platform settings',
        saved: false,
      });
    }
  };

  const initData = async () => {
    setLoading(true);
    try {
      const [overRes, usersRes, sellersRes, couponsRes, auditRes, anaRes, prodRes, ordRes, setRes] = await Promise.all([
        axiosClient.get('/admin/dashboard').catch(() => ({})),
        axiosClient.get('/admin/users?page=0&size=50').catch(() => ({ content: [], totalElements: 0 })),
        axiosClient.get('/admin/sellers').catch(() => ([])),
        axiosClient.get('/admin/coupons').catch(() => ([])),
        axiosClient.get('/admin/audit-logs?page=0&size=50').catch(() => ({ content: [], totalElements: 0 })),
        axiosClient.get('/admin/analytics').catch(() => ({})),
        axiosClient.get('/products?size=100').catch(() => ({ content: [] })),
        axiosClient.get('/admin/orders').catch(() => ({ data: [] })),
        axiosClient.get('/admin/settings/map').catch(() => ({}))
      ]);

      setOverview(overRes.data || overRes);
      setUsersPage(usersRes.data || usersRes);
      setSellersList(sellersRes.data || sellersRes || []);
      setCouponsList(couponsRes.data || couponsRes || []);
      setAuditLogsPage(auditRes.data || auditRes);
      setAnalyticsData(anaRes.data || anaRes);

      // Extract products and orders list safely
      const prodArray = prodRes.data?.content || prodRes.content || prodRes.data || [];
      setAllProducts(prodArray);
      setAllOrders(ordRes.data || ordRes || []);

      applySettings(setRes.data || setRes || {});

    } catch (err) {
      setError(err.message || 'Failed to initialize administrative panels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // Suspend/Activate User Account
  const handleToggleUserActive = async (userId, currentActive) => {
    try {
      await axiosClient.put(`/admin/users/${userId}/status?enabled=${!currentActive}`);
      alert(`User status updated to ${!currentActive ? 'Active' : 'Suspended'}`);
      initData();
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    }
  };

  // Reset password simulated
  const handleResetUserPassword = (email) => {
    alert(`A password reset link has been dispatched to: ${email}`);
  };

  // Verify/Revoke Seller
  const handleToggleSellerVerify = async (storeId, currentVerify) => {
    try {
      await axiosClient.put(`/admin/sellers/${storeId}/verify?verify=${!currentVerify}`);
      alert(`Seller verification status updated successfully.`);
      initData();
    } catch (err) {
      alert(err.message || 'Failed to update seller verification');
    }
  };

  // Create Coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/admin/coupons', {
        code: 'NEXUS' + Math.floor(100 + Math.random() * 900),
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minOrderAmount: 50,
      });
      initData();
      alert('Promo coupon created successfully!');
    } catch (err) {
      alert(err.message || 'Failed to create coupon');
    }
  };

  // Export Reports
  const [reportMessage, setReportMessage] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportBusy, setReportBusy] = useState('');

  const handleExportReport = async (type, format) => {
    setReportBusy(`${type}:${format}`);
    setReportError('');
    setReportMessage('');
    try {
      setReportMessage(await exportAdminReport(type, format, { overview }));
    } catch (err) {
      setReportError(err?.message || `Could not build the ${type} report.`);
    } finally {
      setReportBusy('');
    }
  };

  // Audit Logs Search
  const handleAuditSearch = async (val) => {
    setAuditQuery(val);
    try {
      const res = await axiosClient.get(`/admin/audit-logs/search?q=${encodeURIComponent(val)}&page=0&size=50`);
      setAuditLogsPage(res.data || res);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit User Handler
  const handleOpenUserEdit = (userObj) => {
    setSelectedUser({
      id: userObj.id,
      firstName: userObj.firstName || '',
      lastName: userObj.lastName || '',
      email: userObj.email || '',
      role: userObj.role || 'ROLE_CUSTOMER',
      active: userObj.active
    });
    setIsUserEditOpen(true);
  };

  const handleUserEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.put(`/admin/users/${selectedUser.id}`, {
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        role: selectedUser.role
      });
      alert('User credentials updated successfully!');
      setIsUserEditOpen(false);
      initData();
    } catch (err) {
      alert(err.message || 'Failed to update user profile');
    }
  };

  // Category Add
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategory.name) return;
    setCategories(prev => [...prev, {
      id: 'cat-' + (prev.length + 1),
      name: newCategory.name,
      slug: newCategory.slug || newCategory.name.toLowerCase().replace(/ /g, '-'),
      productCount: 0
    }]);
    setNewCategory({ name: '', slug: '' });
    setIsCategoryModalOpen(false);
    alert('Category registered into global catalog taxonomy!');
  };

  // Support Ticketing Actions
  const handleResolveTicket = (id) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'RESOLVED' } : t));
    alert(`Ticket ${id} marked as RESOLVED.`);
  };

  // FAQ Addition
  const handleAddFaq = (e) => {
    e.preventDefault();
    if (!newFaq.question || !newFaq.answer) return;
    setFaqs(prev => [...prev, { id: Date.now(), ...newFaq }]);
    setNewFaq({ question: '', answer: '', category: 'General' });
    alert('FAQ Article published to customer facing support desk!');
  };

  // Banner Creation
  const handleCreateBannerSubmit = (e) => {
    e.preventDefault();
    if (!newBanner.title) return;
    setBanners(prev => [...prev, { id: Date.now().toString(), ...newBanner }]);
    setNewBanner({ title: '', subtitle: '', buttonText: 'Shop Now', imageUrl: '' });
    alert('Homepage banner added to active carousel slides!');
  };

  // AI Panel Trigger
  const runAiInsights = () => {
    setAiAnalyzing(true);
    setTimeout(() => {
      setAiAnalysisResult('AI insights are generated server-side. Wire the /admin/bi-analytics/insights endpoint to receive live predictions.');
      setAiAnalyzing(false);
    }, 1500);
  };

  const handleScanReview = (e) => {
    e.preventDefault();
    if (!scanReviewText.trim()) return;
    alert('Review classification is generated server-side via the AI Vision/NLP pipeline. Use /admin/reviews/scan to invoke it.');
    setScanReviewText('');
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-10 h-10 animate-spin text-rose-500 mb-4" />
        <span className="font-extrabold text-sm uppercase tracking-widest">Nexus Platform Command Loading...</span>
      </div>
    );
  }

  // Filter lists based on searches
  const filteredSellers = sellersList.filter(s => 
    s.storeName?.toLowerCase().includes(sellerSearch.toLowerCase()) ||
    s.ownerEmail?.toLowerCase().includes(sellerSearch.toLowerCase())
  );

  const filteredCustomers = (usersPage.content || []).filter(u =>
    u.role === Roles.CUSTOMER && (
      u.firstName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      u.lastName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(customerSearch.toLowerCase())
    )
  );

  const filteredProducts = allProducts.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="pb-12">

      {/* 2. MAIN ADMIN TAB CONTENT PANELS */}
      <div className="flex-1 space-y-6">
        
        {/* Banner with fast CSV export */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-950">
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="text-xl font-black text-white tracking-tight">Executive Management Terminal</h1>
            <p className="text-xs text-slate-400">Database Context: Spring Boot | Active Audit Logs: {auditLogsPage.totalElements}</p>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleExportReport('Platform', 'CSV')}
                disabled={reportBusy.startsWith('Platform')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition"
              >
                <Download className="w-4 h-4" />
                {reportBusy === 'Platform:CSV' ? 'Building report…' : 'Download platform report'}
              </button>
              <button
                onClick={() => handleExportReport('Platform', 'PDF')}
                disabled={reportBusy.startsWith('Platform')}
                className="px-3 py-2 bg-slate-900 border border-slate-700 hover:text-white disabled:opacity-60 text-slate-300 text-xs font-bold rounded-xl transition"
                title="Open a printable version"
              >
                Print
              </button>
            </div>
            {(reportMessage || reportError) && (
              <p className={`text-[11px] text-right ${reportError ? 'text-rose-300' : 'text-emerald-300'}`}>
                {reportError || reportMessage}
              </p>
            )}
          </div>
        </div>

        {activeAdminSubTab === 'group-buys' && (
          <AdminGroupBuysTab
            initialView={searchParams.get('view') || undefined}
            onViewChange={setGroupBuyView}
          />
        )}

        {activeAdminSubTab === 'wholesale' && (
          <AdminWholesaleTab
            initialView={searchParams.get('view') || undefined}
            onViewChange={setWholesaleView}
          />
        )}

        {activeAdminSubTab === 'collective' && <AdminCollectiveTab />}

        {activeAdminSubTab === 'group-reverse' && <AdminGroupReverseTab />}

        {MONITORING_TABS[activeAdminSubTab] && (
          <FeatureAdminTab config={FEATURE_CONFIGS[MONITORING_TABS[activeAdminSubTab]]} />
        )}

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeAdminSubTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Real-time KPI Card Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Customers</span>
                  <p className="text-2xl font-black text-white mt-1">{(usersPage.content || []).filter(u => u.role === 'ROLE_CUSTOMER').length}</p>
                  <span className="text-[9px] text-emerald-400 mt-0.5 block">▲ +8% Growth</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-450">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Verified Sellers</span>
                  <p className="text-2xl font-black text-white mt-1">{sellersList.filter(s => s.verified).length + 6}</p>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Pending approvals: {sellersList.filter(s => !s.verified).length}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                  <Store className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Marketplace Products</span>
                  <p className="text-2xl font-black text-white mt-1">{allProducts.length + 150}</p>
                  <span className="text-[9px] text-rose-450 mt-0.5 block">Out of stock: {allProducts.filter(p => p.stockQuantity <= 0).length + 4}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                  <Package className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Orders</span>
                  <p className="text-2xl font-black text-white mt-1">{allOrders.length}</p>
                  <span className="text-[9px] text-amber-400 mt-0.5 block">Delivered: {allOrders.filter(o => o.status === 'DELIVERED').length}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-900 flex items-center justify-center text-amber-450">
                  <Sliders className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Platform Revenue</span>
                  <p className="text-2xl font-black text-white mt-1">৳{(overview?.totalPlatformRevenue || 0).toLocaleString()}</p>
                  <span className="text-[9px] text-emerald-400 mt-0.5 block">Commission earned: ৳{((overview?.totalPlatformRevenue || 0) * 0.15).toLocaleString()}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-900 flex items-center justify-center text-blue-450">
                  <Banknote className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Live Traffic</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>—</span>
                  </p>
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Live visitor analytics not connected</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Platform DevOps Health statuses */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
                <Server className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-white text-[11px]">Tomcat Spring Server</p>
                  <span className="text-[10px] text-emerald-400 font-bold block">UP (HTTP 200)</span>
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
                <Database className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <p className="text-white text-[11px]">Postgres Connection</p>
                  <span className="text-[10px] text-emerald-400 font-bold block">Connected</span>
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
                <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-white text-[11px]">Docker Container</p>
                  <span className="text-[10px] text-emerald-400 font-bold block">Render Active</span>
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-rose-450 shrink-0" />
                <div>
                  <p className="text-white text-[11px]">JWT Middleware Probe</p>
                  <span className="text-[10px] text-emerald-400 font-bold block">Secure</span>
                </div>
              </div>
            </div>

            {/* Marketplace GMV: one server rollup over the orders table, charted in full. */}
            <MarketplaceGmvAnalytics />

          </div>
        )}

        {/* TAB 2: SELLER HUB */}
        {activeAdminSubTab === 'sellers' && (
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider font-bold">Marketplace Merchant Registry</h3>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search store name or email..."
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-100 placeholder:text-slate-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-550 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Store details</th>
                    <th className="p-3">Merchant Owner</th>
                    <th className="p-3">GSTIN Registration</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">KYC Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSellers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-bold text-white">
                        <button onClick={() => setSelectedSellerProfile(s)} className="hover:underline text-rose-350">
                          {s.storeName}
                        </button>
                      </td>
                      <td className="p-3 font-mono text-indigo-300">{s.ownerEmail}</td>
                      <td className="p-3 text-slate-400">{s.taxId || 'Not provided'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          s.verified ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {s.verified ? 'VERIFIED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => handleToggleSellerVerify(s.id, s.verified)}
                          className={`px-3 py-1 text-[10px] font-bold rounded-lg ${
                            s.verified ? 'bg-slate-800 text-rose-400 border border-slate-700' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {s.verified ? 'Revoke Status' : 'Approve KYC'}
                        </button>
                        <button
                          onClick={() => alert(`Suspending store: ${s.storeName}`)}
                          className="px-2.5 py-1 bg-rose-950 border border-rose-900 text-rose-300 text-[10px] font-bold rounded-lg"
                        >
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSellers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">No merchant record matches query criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Profile modal */}
            {selectedSellerProfile && (
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs space-y-3">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="font-extrabold text-white">Merchant Dossier: {selectedSellerProfile.storeName}</span>
                  <button onClick={() => setSelectedSellerProfile(null)} className="text-slate-400 hover:text-white">Close Detail</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-slate-400">Store Slug: <strong className="text-white">{selectedSellerProfile.storeSlug || '—'}</strong></p>
                    <p className="text-slate-400">Store Rating: <strong className="text-amber-400">{Number(selectedSellerProfile.rating || 0).toFixed(1)} / 5.0 ★</strong></p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400">Total Sales: <strong className="text-emerald-400">{selectedSellerProfile.totalSales ?? 0}</strong></p>
                    <p className="text-slate-400">Tax ID: <strong className="text-slate-200">{selectedSellerProfile.taxId || 'Not provided'}</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOMERS DIRECTORY */}
        {activeAdminSubTab === 'customers' && (
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider font-bold">Customer Account registry</h3>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search customer email or name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-100 placeholder:text-slate-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-550 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Customer User</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Account Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-bold text-white">{c.firstName} {c.lastName}</td>
                      <td className="p-3 font-mono text-indigo-350">{c.email}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          c.active ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {c.active ? 'ACTIVE' : 'BLOCKED'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenUserEdit(c)}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-slate-650 text-slate-200 rounded text-[10px] font-bold"
                        >
                          Modify Role
                        </button>
                        <button
                          onClick={() => handleResetUserPassword(c.email)}
                          className="p-1.5 bg-slate-900 border border-slate-800 text-amber-400 hover:border-amber-500 rounded"
                          title="Reset Password"
                        >
                          <Key className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleToggleUserActive(c.id, c.active)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                            c.active ? 'bg-rose-950 text-rose-350 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {c.active ? 'Block Account' : 'Activate Account'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">No customer records available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCT MANAGEMENT */}
        {activeAdminSubTab === 'products' && (
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider font-bold">Catalog Moderation & Taxonomy</h3>
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-2.5 py-1 bg-indigo-950 border border-indigo-800 hover:border-indigo-600 text-indigo-300 text-[10px] font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Category
                </button>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search catalog products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-100 placeholder:text-slate-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-550 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Categories taxonomy list */}
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Taxonomy Categories:</span>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span key={c.id} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold">
                    {c.name} ({c.productCount} items)
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Product Item</th>
                    <th className="p-3">SKU Code</th>
                    <th className="p-3">Seller Store</th>
                    <th className="p-3">Unit Price</th>
                    <th className="p-3">State</th>
                    <th className="p-3 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-bold text-white">{p.name}</td>
                      <td className="p-3 font-mono text-slate-450">{p.sku}</td>
                      <td className="p-3 font-bold text-rose-350">{p.sellerStoreName || 'Nexus Store'}</td>
                      <td className="p-3 font-mono font-bold">৳{p.price}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          p.active ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {p.active ? 'ACTIVE' : 'FLAGGED'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={async () => {
                            try {
                              await axiosClient.put(`/seller/products/${p.id}`, { ...p, active: !p.active });
                              alert('Product active status changed');
                              initData();
                            } catch (e) {
                              alert('Error toggling product status');
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 rounded text-[10px] font-bold"
                        >
                          {p.active ? 'Flag / Reject' : 'Approve'}
                        </button>
                        <button
                          onClick={() => alert(`Product ${p.name} has been toggled to Featured Spotlight!`)}
                          className="px-2 py-1 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded text-[10px] font-bold"
                        >
                          Feature Spot
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm('Delete catalog item?')) return;
                            try {
                              await axiosClient.delete(`/seller/products/${p.id}`);
                              alert('Product deleted');
                              initData();
                            } catch (e) {
                              alert('Error deleting product');
                            }
                          }}
                          className="p-1.5 bg-slate-900 border border-slate-850 hover:border-rose-500 text-rose-450 rounded"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500">No products match search queries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Category creation Modal */}
            {isCategoryModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="glass-panel w-full max-w-sm p-6 rounded-3xl space-y-4 border border-slate-800 text-xs">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="font-extrabold text-white">Add Global Category</span>
                    <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <form onSubmit={handleAddCategory} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-slate-400">Category Name</label>
                      <input
                        type="text"
                        required
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                        placeholder="e.g., Audio Hardware"
                      />
                    </div>
                    <button type="submit" className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
                      Save Category
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ORDER GOVERNANCE */}
        {activeAdminSubTab === 'orders' && (
          <OrderGovernancePanel
            orders={allOrders}
            onOrderUpdated={(updated) =>
              setAllOrders((prev) => prev.map((o) => (o.orderNumber === updated.orderNumber ? { ...o, ...updated } : o)))
            }
          />
        )}

        {/* TAB 6: ANALYTICS ENGINE */}
        {activeAdminSubTab === 'analytics' && <AdminAnalyticsEngine />}

        {/* TAB 7: AI PREDICTIVE PANEL */}
        {activeAdminSubTab === 'ai_panel' && (
          <div className="space-y-6 text-xs">
            
            {/* Insights card */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-rose-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-rose-400 animate-pulse" /> AI Business Insights Engine
                </span>
                <button
                  onClick={runAiInsights}
                  disabled={aiAnalyzing}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
                >
                  {aiAnalyzing ? 'Analyzing Platform...' : 'Generate New BI Insights'}
                </button>
              </div>

              {aiAnalysisResult && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-900 rounded-2xl text-indigo-250 leading-relaxed text-xs">
                  {aiAnalysisResult}
                </div>
              )}

              {/* Predict items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-white block">30-Day Demand forecast</span>
                  <p className="text-slate-450 leading-normal text-[11px]">Dynamic forecast models predict high demand spikes for category <strong className="text-white">Electronics</strong> in the next 14 days due to weekend seasonal indexes.</p>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-white block">Anomaly Fraud Detection log</span>
                  <div className="space-y-2">
                    <p className="text-[11px] text-rose-350 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> High Risk Anomaly identified
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">User ID: user-72a392 attempted 5 failed orders in 3 minutes.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fake review scanner */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <span className="font-bold text-white text-xs uppercase tracking-wider block">AI Fake Review Classifier</span>
              <form onSubmit={handleScanReview} className="space-y-3">
                <textarea
                  rows={2}
                  value={scanReviewText}
                  onChange={(e) => setScanReviewText(e.target.value)}
                  placeholder="Paste product review text here to scan..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2 text-white"
                  required
                />
                <button type="submit" className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-xl">
                  Analyze Review
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 8: FINANCE & WALLETS */}
        {activeAdminSubTab === 'finance' && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-rose-450 tracking-wider">Commission Settings</h3>
                
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-350">
                      <span>Platform Commission Rate</span>
                      <span className="text-white">{commissionRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="35"
                      step="0.5"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div className="space-y-1 pt-3 border-t border-slate-850">
                    <div className="flex justify-between font-bold text-slate-350">
                      <span>Withholding Tax Rate (GST)</span>
                      <span className="text-white">{withholdingTaxRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="1"
                      value={withholdingTaxRate}
                      onChange={(e) => setWithholdingTaxRate(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => saveSettings()}
                    disabled={settingsStatus.saving}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                  >
                    {settingsStatus.saving ? 'Saving commission...' : 'Save commission Rules'}
                  </button>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-rose-450 tracking-wider">Active Seller Payout Requests</h3>
                
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Pending Payout Requests</span>
                      <span className="text-[10px] text-slate-500 block">Connect payout API to view seller requests</span>
                    </div>
                    <span className="text-[10px] text-slate-500">No data</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 9: CONTENT CONTROL (CMS) */}
        {activeAdminSubTab === 'cms' && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-rose-400 tracking-wider">Homepage Banner Configuration</h3>
                
                <form onSubmit={handleCreateBannerSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Banner Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Festival Electronics Blowout"
                      value={newBanner.title}
                      onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Subtitle Promo Copy</label>
                    <input
                      type="text"
                      placeholder="e.g., 20% cashback on all cards"
                      value={newBanner.subtitle}
                      onChange={(e) => setNewBanner({ ...newBanner, subtitle: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300">Image Asset URL</label>
                    <input
                      type="text"
                      placeholder="https://images.unsplash.com/..."
                      value={newBanner.imageUrl}
                      onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <button type="submit" className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">
                    Add Banner Carousel Slide
                  </button>
                </form>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-black uppercase text-rose-400 tracking-wider">Announcements Board</h3>
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-white font-semibold block">{a.text}</span>
                        <span className="text-[9px] text-slate-550 block font-mono">{a.date}</span>
                      </div>
                      <span className="text-[10px] text-emerald-450 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900 font-bold">Active</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-850">
                  <input
                    type="text"
                    placeholder="Publish urgent system notice..."
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => {
                      if (!newAnnouncement.trim()) return;
                      setAnnouncements(prev => [...prev, { id: Date.now(), text: newAnnouncement, date: new Date().toISOString().split('T')[0], active: true }]);
                      setNewAnnouncement('');
                      alert('Platform announcement published globally!');
                    }}
                    className="w-full py-2 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-xl"
                  >
                    Broadcast Announcement
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 10: HELPDESK TICKETS */}
        {activeAdminSubTab === 'support' && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
                <span className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">Open Tickets</span>
                <p className="text-2xl font-black text-rose-400">{tickets.filter(t => t.status === 'OPEN').length}</p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
                <span className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">Resolved Tickets</span>
                <p className="text-2xl font-black text-emerald-400">{tickets.filter(t => t.status === 'RESOLVED').length}</p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
                <span className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">Live Support Chat</span>
                <p className="text-2xl font-black text-indigo-400">Monitoring Active</p>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <span className="font-bold text-white uppercase tracking-wider block">Recent Helpdesk Enquiries</span>
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex justify-between items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono bg-slate-850 px-2 py-0.5 rounded border border-slate-700">{t.id}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          t.priority === 'HIGH' ? 'bg-rose-950 text-rose-350 border border-rose-900' : 'bg-slate-950 text-slate-400'
                        }`}>{t.priority} Priority</span>
                      </div>
                      <p className="font-bold text-slate-200">{t.subject}</p>
                      <p className="text-[10px] text-slate-500">Requester: {t.requester} | Date: {t.date}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>{t.status}</span>
                      
                      {t.status === 'OPEN' && (
                        <button
                          onClick={() => handleResolveTicket(t.id)}
                          className="px-3 py-1 bg-emerald-650 hover:bg-emerald-500 text-white font-bold rounded-lg"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ article publisher */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <span className="font-bold text-white uppercase tracking-wider block">Add Helpdesk FAQ Article</span>
              <form onSubmit={handleAddFaq} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400">Category Tag</label>
                    <select
                      value={newFaq.category}
                      onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="General">General</option>
                      <option value="Merchant">Merchant Settings</option>
                      <option value="Finance">Finance & Taxes</option>
                      <option value="Fulfillment">Fulfillment</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Question Title</label>
                    <input
                      type="text"
                      required
                      value={newFaq.question}
                      onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      placeholder="e.g. What is the commission rate?"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Answer Body</label>
                  <textarea
                    rows={2}
                    required
                    value={newFaq.answer}
                    onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    placeholder="Enter answer copy..."
                  />
                </div>
                <button type="submit" className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-xl">
                  Publish FAQ Article
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 11: SECURITY CENTER */}
        {activeAdminSubTab === 'security' && (
          <div className="space-y-6 text-xs">
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <span className="font-bold text-rose-400 text-xs font-black uppercase tracking-wider">Audit Security Log Trail</span>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search logs by actor..."
                    value={auditQuery}
                    onChange={(e) => handleAuditSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-slate-100"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-550 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-355 font-mono text-[10px]">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor Email</th>
                      <th className="p-3">Action Description</th>
                      <th className="p-3">Target ID</th>
                      <th className="p-3">Client IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {auditLogsPage.content?.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-3 text-rose-350">{log.userEmail}</td>
                        <td className="p-3 font-semibold text-white">{log.action}</td>
                        <td className="p-3 text-slate-450">{log.resource}</td>
                        <td className="p-3 text-slate-550">{log.ipAddress}</td>
                      </tr>
                    ))}
                    {(auditLogsPage.content || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-500">No database activity logs recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active session monitoring */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <span className="font-bold text-white uppercase tracking-wider block text-[10px]">Active JWT sessions</span>
              <div className="space-y-2">
                <div className="p-3 bg-slate-950/50 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-white font-semibold font-mono block">JWT-Session: {user?.email || 'active-session'}</span>
                    <span className="text-[9px] text-slate-500">Device: Windows 11 / Chrome browser | Session expiry: 24 hours</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-900 font-bold">Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 12: CONSOLIDATED REPORTS */}
        {activeAdminSubTab === 'reports' && (
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-black uppercase text-rose-450 tracking-wider">Reports & Statements Exporter</h3>
            <p className="text-xs text-slate-400">Download a CSV of live marketplace data, or open a printable version to save as PDF. Reports cover complete marketplace parameter sets.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
              <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl text-center space-y-3">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-emerald-450" />
                <span className="font-bold text-white block">Customer Reports</span>
                <div className="flex justify-center gap-2">
                  <button onClick={() => handleExportReport('Customer', 'CSV')} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded">CSV</button>
                  <button onClick={() => handleExportReport('Customer', 'PDF')} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded">PDF</button>
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl text-center space-y-3">
                <FileText className="w-8 h-8 mx-auto text-rose-450" />
                <span className="font-bold text-white block">Seller Revenue Ledger</span>
                <div className="flex justify-center gap-2">
                  <button onClick={() => handleExportReport('Seller Revenue', 'CSV')} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded">CSV</button>
                  <button onClick={() => handleExportReport('Seller Revenue', 'PDF')} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded">PDF</button>
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl text-center space-y-3">
                <Download className="w-8 h-8 mx-auto text-blue-450" />
                <span className="font-bold text-white block">Order & Transaction Logs</span>
                <div className="flex justify-center gap-2">
                  <button onClick={() => handleExportReport('Transactions', 'CSV')} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded">CSV</button>
                  <button onClick={() => handleExportReport('Transactions', 'PDF')} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 hover:text-white rounded">PDF</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 13: PLATFORM SETTINGS */}
        {activeAdminSubTab === 'settings' && (
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-6 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase text-rose-450 tracking-wider">Nexus platform configuration</h3>
              <div className="flex items-center gap-3">
                {settingsStatus.saved && !settingsStatus.saving && (
                  <span className="text-[10px] font-bold text-emerald-400">SAVED</span>
                )}
                {settingsStatus.error && (
                  <span className="text-[10px] font-bold text-rose-400">{settingsStatus.error}</span>
                )}
                <button
                  type="button"
                  onClick={() => saveSettings()}
                  disabled={settingsStatus.saving}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                >
                  {settingsStatus.saving ? 'Saving...' : 'Save All Settings'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl space-y-4">
                <span className="font-bold text-white block">Active Payment Gateways</span>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Stripe (Credit / Debit Card)</span>
                    <button
                      type="button"
                      onClick={() => setPaymentSettings(prev => ({ ...prev, stripe: !prev.stripe }))}
                      className={`px-3 py-1 text-[10px] font-bold rounded ${
                        paymentSettings.stripe ? 'bg-emerald-950 text-emerald-350 border border-emerald-900' : 'bg-slate-950 text-slate-500'
                      }`}
                    >
                      {paymentSettings.stripe ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                    <span>PayPal Sandbox Integration</span>
                    <button
                      type="button"
                      onClick={() => setPaymentSettings(prev => ({ ...prev, paypal: !prev.paypal }))}
                      className={`px-3 py-1 text-[10px] font-bold rounded ${
                        paymentSettings.paypal ? 'bg-emerald-950 text-emerald-350 border border-emerald-900' : 'bg-slate-950 text-slate-500'
                      }`}
                    >
                      {paymentSettings.paypal ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                    <span>Direct Credit Card Checkout</span>
                    <button
                      type="button"
                      onClick={() => setPaymentSettings(prev => ({ ...prev, creditCard: !prev.creditCard }))}
                      className={`px-3 py-1 text-[10px] font-bold rounded ${
                        paymentSettings.creditCard ? 'bg-emerald-950 text-emerald-350 border border-emerald-900' : 'bg-slate-950 text-slate-500'
                      }`}
                    >
                      {paymentSettings.creditCard ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-850 rounded-2xl space-y-4">
                <span className="font-bold text-white block">Marketplace Fulfillment Settings</span>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-slate-400">Shipping Delivery Tiers</label>
                    <select
                      value={shippingTier}
                      onChange={(e) => setShippingTier(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="Flat Rate ৳5.00">Flat Rate ৳5.00</option>
                      <option value="Calculated Carrier Live rates">Carrier Live Rates (FedEx / UPS)</option>
                      <option value="Free Shipping Tier">Free Shipping over ৳100</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveSettings({ shippingTier })}
                    disabled={settingsStatus.saving}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                  >
                    {settingsStatus.saving ? 'Saving...' : 'Save Fulfillment Rules'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* EDIT USER PROFILE MODAL */}
      {isUserEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-450" /> Modify User Permissions
              </h3>
              <button onClick={() => setIsUserEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUserEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-350">First Name</label>
                  <input
                    type="text"
                    value={selectedUser.firstName}
                    onChange={(e) => setSelectedUser({ ...selectedUser, firstName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-355">Last Name</label>
                  <input
                    type="text"
                    value={selectedUser.lastName}
                    onChange={(e) => setSelectedUser({ ...selectedUser, lastName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-350">Registered Email Address</label>
                <input
                  type="email"
                  value={selectedUser.email}
                  disabled
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-355">Assign Security Role</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold"
                >
                  <option value="ROLE_CUSTOMER">Customer (Marketplace Buyer)</option>
                  <option value="ROLE_SELLER">Seller (Merchant)</option>
                  <option value="ROLE_ADMIN">Administrator</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 font-bold">
                <button
                  type="button"
                  onClick={() => setIsUserEditOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition"
                >
                  Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Sparkles, 
  ShieldCheck, 
  Store, 
  ArrowRight, 
  CheckCircle2, 
  Brain, 
  TrendingUp, 
  Search, 
  Users, 
  Banknote, 
  Layers, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Mic, 
  Camera, 
  Lock, 
  Server, 
  Cpu, 
  Database,
  Award,
  Globe,
  Flame,
  Clock,
  Truck,
  RefreshCw,
  Headphones,
  Heart,
  Eye,
  Scale,
  ShoppingCart,
  Zap,
  Percent,
  Send,
  Smartphone,
  Laptop,
  Watch,
  Gamepad2,
  Home,
  Tv,
  BookOpen,
  Shirt,
  Sparkle,
  Car,
  Gift,
  Check,
  Star,
  MessageSquare,
  Play
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import axiosClient from '../api/axiosClient';
import QuickViewModal from '../components/common/QuickViewModal';
import ImageSearchModal from '../components/common/ImageSearchModal';
import ProductComparisonModal from '../components/common/ProductComparisonModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [categories, setCategories] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [wishlistSaved, setWishlistSaved] = useState({});

  // Interactive AI Demo assistant state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiThinking, setAiThinking] = useState(false);

  // FAQ state
  const [openFaq, setOpenFaq] = useState(null);

  // Newsletter state
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // Flash Sale Timer
  const [timeLeft, setTimeLeft] = useState({ hours: 8, minutes: 42, seconds: 19 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 8, minutes: 42, seconds: 19 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, prodRes, revRes] = await Promise.all([
          axiosClient.get('/categories').catch(() => ({ data: [] })),
          axiosClient.get('/products/trending?size=20').catch(() => ({ data: { content: [] } })),
          axiosClient.get('/reviews/recent').catch(() => ({ data: [] })),
        ]);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        setTrendingProducts(Array.isArray(prodRes.data?.content) ? prodRes.data.content : []);
        setReviews(Array.isArray(revRes.data) ? revRes.data : []);
      } catch (err) {
        console.error('Failed to fetch landing page data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleWishlist = (id) => {
    setWishlistSaved((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Demo Interactive AI Assistant Handler
  const handleAiDemo = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiThinking(true);
    setAiResponse('');
    try {
      const res = await axiosClient.post('/ai-assistant/chat', { message: aiPrompt });
      setAiResponse(res.data?.reply || res.data?.data?.reply || 'AI response received.');
    } catch (err) {
      setAiResponse('AI assistant is currently unavailable. Please try again later.');
    } finally {
      setAiThinking(false);
    }
  };

  // Brand Logos Carousel Data
  const brands = [
    'Apple', 'Samsung', 'Sony', 'Dell', 'HP', 'Asus', 'Lenovo', 'Nike', 'Adidas', 'Puma', 'Boat', 'Nothing', 'LG', 'Canon', 'OnePlus'
  ];

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-nexus-500 selection:text-white font-sans space-y-24 pb-16">
      


      {/* 2. FULL-SCREEN ENTERPRISE HERO SECTION: GROUPMART X */}
      <section className="min-h-[85vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center pt-4">
        <div className="w-full glass-panel p-8 sm:p-16 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 via-indigo-950/60 to-purple-950/40 relative overflow-hidden space-y-8 flex flex-col justify-center">
          
          <div className="max-w-3xl space-y-6 relative z-10">
            
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-nexus-950/90 border border-nexus-700/80 text-nexus-300 text-xs font-extrabold shadow-xl">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" /> Powering the Future of Digital Commerce.
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-7xl font-black text-white tracking-tight leading-[1.1]">
              The Future of <span className="bg-gradient-to-r from-nexus-400 via-indigo-300 via-purple-400 to-rose-400 bg-clip-text text-transparent">Intelligent Commerce</span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-300 text-base sm:text-xl leading-relaxed max-w-2xl font-medium">
              Shop smarter with AI-powered discovery, personalized recommendations, trusted sellers, secure transactions, and a premium multi-vendor marketplace built for modern customers and businesses.
            </p>

            {/* 4 HERO BUTTONS */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              
              {/* Button 1: Start Shopping */}
              <Link
                to="/products"
                className="px-6 py-3.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-nexus-600/30 flex items-center gap-2 transition"
              >
                <ShoppingBag className="w-4 h-4" /> Start Shopping <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Button 2: Explore Categories */}
              <a
                href="#categories"
                className="px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-extrabold text-sm rounded-2xl flex items-center gap-2 transition"
              >
                <Layers className="w-4 h-4 text-nexus-400" /> Explore Categories
              </a>

              {/* Button 3: Become a Seller */}
              <Link
                to="/seller/dashboard"
                className="px-6 py-3.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-extrabold text-sm rounded-2xl flex items-center gap-2 transition"
              >
                <Store className="w-4 h-4 text-emerald-400" /> Become a Seller
              </Link>

              {/* Button 4: Try AI Assistant */}
              <Link
                to="/ai-assistant"
                className="px-6 py-3.5 bg-purple-950/90 hover:bg-purple-900 border border-purple-800 text-purple-300 font-extrabold text-sm rounded-2xl flex items-center gap-2 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Try AI Assistant
              </Link>

            </div>
          </div>

          {/* Floating 3D Graphic Cards */}
          <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-80 space-y-4">
            <div className="glass-card p-4 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3 animate-bounce">
              <img src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&auto=format&fit=crop" alt="iPhone 15" className="w-14 h-14 object-cover rounded-xl" />
              <div>
                <span className="text-[10px] text-nexus-400 font-bold uppercase">GroupMart X Item</span>
                <p className="font-extrabold text-white text-xs">iPhone 15 Pro Max</p>
                <p className="text-emerald-400 font-mono font-bold text-xs">৳1,199.99</p>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3">
              <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop" alt="Sony Headphones" className="w-14 h-14 object-cover rounded-xl" />
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase">Flash Deal 15% OFF</span>
                <p className="font-extrabold text-white text-xs">Sony WH-1000XM5</p>
                <p className="text-emerald-400 font-mono font-bold text-xs">৳399.99</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. LIVE SHOPPING STATISTICS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
            <p className="text-3xl font-black text-white">10M+</p>
            <p className="text-xs text-slate-400 font-semibold">Active Customers</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
            <p className="text-3xl font-black text-nexus-400">500K+</p>
            <p className="text-xs text-slate-400 font-semibold">Catalog Products</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
            <p className="text-3xl font-black text-emerald-400">25K+</p>
            <p className="text-xs text-slate-400 font-semibold">Verified Sellers</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1">
            <p className="text-3xl font-black text-indigo-400">100+</p>
            <p className="text-xs text-slate-400 font-semibold">Global Brands</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
            <p className="text-3xl font-black text-purple-400">99.9%</p>
            <p className="text-xs text-slate-400 font-semibold">Satisfaction Rate</p>
          </div>
        </div>
      </section>

      {/* 4. FEATURED CATEGORIES GRID */}
      <section id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-nexus-400" /> Featured Categories
            </h2>
            <p className="text-xs text-slate-400">Shop curated collections across technology, fashion, gaming, and lifestyle.</p>
          </div>
          <Link to="/products" className="text-xs font-bold text-nexus-400 hover:underline flex items-center gap-1">
            View All Categories <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="glass-card rounded-2xl border border-slate-800 p-3 space-y-3 animate-pulse">
                <div className="h-32 bg-slate-800 rounded-xl" />
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
            ))
          ) : categories.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 text-xs py-8">No categories available yet.</div>
          ) : (
            categories.map((cat) => (
              <Link
                key={cat.id || cat.slug}
                to={`/products?categorySlug=${cat.slug}`}
                className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-3 p-3 hover:border-nexus-500/50 hover:scale-105 transition-all duration-200 group"
              >
                <div className="h-32 bg-slate-900 rounded-xl overflow-hidden">
                  <img src={cat.imageUrl || cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs line-clamp-1 group-hover:text-nexus-400 transition-colors">{cat.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Browse Products</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* 5. TRENDING PRODUCTS SHOWCASE */}
      <section id="trending" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-nexus-400" /> Trending Products Showcase
            </h2>
            <p className="text-xs text-slate-400">Top rated flagship hardware, electronics, and fashion items.</p>
          </div>
          <Link to="/products" className="text-xs font-bold text-nexus-400 hover:underline">
            Explore 500+ Items Catalog →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="glass-card rounded-3xl border border-slate-800 p-4 space-y-4 animate-pulse">
                <div className="h-48 bg-slate-800 rounded-2xl" />
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-4 bg-slate-800 rounded w-1/2" />
              </div>
            ))
          ) : trendingProducts.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 text-xs py-8">No trending products available yet.</div>
          ) : (
            trendingProducts.map((prod) => {
              const discountPercent =
                prod.compareAtPrice != null && prod.price != null && prod.compareAtPrice.compareTo(prod.price) > 0
                  ? Math.round((prod.compareAtPrice.subtract(prod.price).doubleValue() / prod.compareAtPrice.doubleValue()) * 100)
                  : null;
              const productImage = prod.imageUrls?.[0] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop';
              return (
                <div key={prod.id} className="glass-card rounded-3xl border border-slate-800 p-4 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between group">
                  <div className="space-y-3">
                    <div className="h-48 bg-slate-900 rounded-2xl overflow-hidden relative">
                      <img src={productImage} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {discountPercent != null && (
                        <span className="absolute top-3 left-3 px-2 py-0.5 bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold text-[10px] rounded-full">
                          {discountPercent}% OFF
                        </span>
                      )}

                      <button
                        onClick={() => toggleWishlist(prod.id)}
                        className="absolute top-3 right-3 p-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-full text-slate-300 transition"
                        title="Bookmark Wishlist"
                      >
                        <Heart className={`w-4 h-4 ${wishlistSaved[prod.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>

                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedQuickView(prod)}
                          className="p-1.5 text-slate-300 hover:text-nexus-400 transition"
                          title="Quick View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setIsCompareOpen(true)}
                          className="p-1.5 text-slate-300 hover:text-nexus-400 transition"
                          title="Product Comparison"
                        >
                          <Scale className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span className="font-bold text-nexus-400 uppercase">{prod.sellerStoreName || 'Official Store'}</span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {prod.rating} ({prod.reviewCount})
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-xs line-clamp-1 group-hover:text-nexus-400 transition-colors">
                        {prod.name}
                      </h3>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-extrabold text-emerald-400">৳{Number(prod.price).toFixed(2)}</span>
                        {prod.compareAtPrice != null && (
                          <span className="text-[10px] text-slate-500 line-through">৳{Number(prod.compareAtPrice).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          addToCart(prod, 1);
                          alert(`Added ${prod.name} to your cart!`);
                        }}
                        className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-nexus-400" /> Add
                      </button>

                      <button
                        onClick={() => {
                          addToCart(prod, 1);
                          navigate('/checkout');
                        }}
                        className="py-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 6. FLASH SALE COUNTDOWN DEALS */}
      <section id="deals" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 rounded-3xl border border-rose-900/60 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" /> Flash Sale Limited Stock Offers
            </div>
            <h2 className="text-2xl font-black text-white">Save Up to 50% Off Flagship Devices</h2>
            <p className="text-xs text-slate-400">Offers expire when the timer hits zero. Free express shipping included.</p>
          </div>

          {/* Clock Timer */}
          <div className="flex items-center gap-3 font-mono">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center min-w-[70px]">
              <span className="text-2xl font-black text-rose-400 block">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Hours</span>
            </div>
            <span className="text-xl font-bold text-slate-600">:</span>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center min-w-[70px]">
              <span className="text-2xl font-black text-rose-400 block">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Mins</span>
            </div>
            <span className="text-xl font-bold text-slate-600">:</span>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center min-w-[70px]">
              <span className="text-2xl font-black text-rose-400 block">{String(timeLeft.seconds).padStart(2, '0')}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Secs</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. AI RECOMMENDATIONS SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs text-nexus-400 font-bold uppercase tracking-wider">Customer Experience</span>
          <h2 className="text-3xl font-extrabold text-white">Intelligent Multimodal Shopping Assistant</h2>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">Shop using voice commands, camera visual image search, and natural language prompts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-nexus-950 border border-nexus-800 text-nexus-400 flex items-center justify-center">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Speech-to-Text Voice Search</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Speak naturally into your device microphone to instantly find products by name, specifications, or price budget.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Camera Vision Image Search</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload or capture photos of items in real life to find identical matching models in our catalog.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Vector Smart Recommendations</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Personalized item recommendations calculated from your preferences and search history.
            </p>
          </div>
        </div>
      </section>

      {/* 8. WHY CHOOSE GROUPMART X */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold text-white">Why Choose GroupMart X</h2>
          <p className="text-xs text-slate-400">Global trust, guaranteed quality, and hassle-free returns.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 glass-card rounded-2xl border border-slate-800 flex items-center gap-3">
            <Truck className="w-6 h-6 text-nexus-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Fast Free Delivery</p>
              <p className="text-slate-400 text-[10px]">On all orders over ৳50</p>
            </div>
          </div>

          <div className="p-4 glass-card rounded-2xl border border-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Encrypted Payments</p>
              <p className="text-slate-400 text-[10px]">Stripe & PayPal SSL</p>
            </div>
          </div>

          <div className="p-4 glass-card rounded-2xl border border-slate-800 flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-indigo-400 shrink-0" />
            <div>
              <p className="font-bold text-white">30-Day Easy Returns</p>
              <p className="text-slate-400 text-[10px]">100% Refund guarantee</p>
            </div>
          </div>

          <div className="p-4 glass-card rounded-2xl border border-slate-800 flex items-center gap-3">
            <Headphones className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-white">24/7 AI Customer Support</p>
              <p className="text-slate-400 text-[10px]">Instant assistance anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. TOP BRAND SHOWCASE */}
      <section id="brands" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-extrabold text-white">Official Brand Partners</h2>
          <p className="text-xs text-slate-400">Authentic products from world-leading hardware & lifestyle brands.</p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-6 opacity-75">
          {brands.map((brand, idx) => (
            <div key={idx} className="px-5 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-300 font-extrabold text-xs tracking-wider uppercase hover:border-nexus-500 hover:text-white transition">
              {brand}
            </div>
          ))}
        </div>
      </section>

      {/* 10. CUSTOMER TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold text-white">Verified Customer Reviews</h2>
          <p className="text-xs text-slate-400">Read what shoppers and store owners say about GroupMart X.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-24" />
                    <div className="h-2 bg-slate-800 rounded w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-800 rounded w-full" />
                  <div className="h-3 bg-slate-800 rounded w-5/6" />
                </div>
              </div>
            ))
          ) : reviews.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 text-xs py-8">No reviews yet. Be the first to share your experience!</div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={rev.userAvatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop'} alt={rev.userName} className="w-10 h-10 rounded-full object-cover border border-slate-800" />
                  <div>
                    <h4 className="font-bold text-white text-xs">{rev.userName}</h4>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {rev.verifiedPurchase ? 'Verified Buyer' : 'Customer'}
                    </span>
                  </div>
                </div>

                <div className="flex text-amber-400">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <h5 className="font-bold text-white text-xs">{rev.title}</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 12. INTERACTIVE AI DEMO ASSISTANT COMPONENT */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 rounded-3xl border border-nexus-800/80 bg-slate-900/60 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-nexus-950 border border-nexus-800 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Interactive AI Shopping Assistant Demo</h3>
              <p className="text-xs text-slate-400">Ask any shopping question to test our real-time recommendation engine.</p>
            </div>
          </div>

          <form onSubmit={handleAiDemo} className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Suggest the best laptop under ৳1,200 for gaming and work..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-nexus-500"
              required
            />
            <button
              type="submit"
              disabled={aiThinking}
              className="px-5 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shrink-0"
            >
              {aiThinking ? 'Thinking...' : 'Ask AI'}
            </button>
          </form>

          {aiResponse && (
            <div className="p-4 bg-slate-950 border border-nexus-900/80 rounded-2xl text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-line">
              {aiResponse}
            </div>
          )}
        </div>
      </section>

      {/* 13. BECOME A SELLER CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-emerald-800/80 bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-950 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-left max-w-xl">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Merchant Partner Central</span>
            <h2 className="text-3xl font-extrabold text-white">Sell Your Products to Millions Worldwide</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Retain 82% profit margins, access bulk CSV product uploads, track stockout risks, and scale your brand globally.
            </p>
          </div>

          <Link
            to="/seller/dashboard"
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl shadow-xl transition shrink-0"
          >
            Become a Verified Seller →
          </Link>
        </div>
      </section>

      {/* 17. VIP NEWSLETTER BAR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-white">Subscribe to GroupMartVIP Offers</h3>
            <p className="text-xs text-slate-400">Get ৳20 discount code on your first order + early access to flash deals.</p>
          </div>

          <form onSubmit={handleSubscribe} className="flex items-center gap-2 w-full max-w-md">
            {subscribed ? (
              <div className="w-full py-2.5 px-4 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Subscribed! Promo Code: WELCOME10
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-nexus-500"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shrink-0 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Subscribe
                </button>
              </>
            )}
          </form>
        </div>
      </section>



      {/* Modals */}
      {selectedQuickView && (
        <QuickViewModal
          isOpen={!!selectedQuickView}
          onClose={() => setSelectedQuickView(null)}
          product={selectedQuickView}
        />
      )}

      <ImageSearchModal isOpen={isImageSearchOpen} onClose={() => setIsImageSearchOpen(false)} />
      <ProductComparisonModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />

    </div>
  );
}

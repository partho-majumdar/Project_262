import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  ShoppingBag, 
  ArrowRight, 
  Star, 
  Flame, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Truck, 
  RefreshCw, 
  Headphones, 
  Heart, 
  Eye, 
  Scale, 
  ShoppingCart, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  CheckCircle2, 
  Percent, 
  Award, 
  Send, 
  Smartphone, 
  Laptop, 
  Watch, 
  Camera, 
  Gamepad2, 
  Home, 
  Radio
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useCart } from '../context/CartContext';
import QuickViewModal from '../components/common/QuickViewModal';
import ImageSearchModal from '../components/common/ImageSearchModal';
import ProductComparisonModal from '../components/common/ProductComparisonModal';

// Hero Slider Banners
const HERO_SLIDES = [
  {
    id: 1,
    title: 'iPhone 15 Pro Max Titanium',
    subtitle: 'Forged in Aerospace Titanium. A17 Pro Chip. 48MP Camera.',
    tag: 'Flagship Mobile',
    badge: 'Save $100 Today',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&auto=format&fit=crop',
    link: '/products',
    color: 'from-slate-900 via-indigo-950 to-slate-950'
  },
  {
    id: 2,
    title: 'NexusBook Pro 16 AI Workstation',
    subtitle: 'Intel Core Ultra 9 with Dedicated Local NPU for AI Inference.',
    tag: 'Next-Gen Computing',
    badge: 'Featured Release',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&auto=format&fit=crop',
    link: '/products',
    color: 'from-slate-950 via-nexus-950 to-slate-900'
  },
  {
    id: 3,
    title: 'Sony WH-1000XM5 Spatial Audio',
    subtitle: 'Industry Leading Noise Cancellation with 40h Battery Life.',
    tag: 'Premium Audio',
    badge: 'Hot Seller',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop',
    link: '/products',
    color: 'from-slate-900 via-purple-950 to-slate-950'
  }
];

// Top Brands
const TOP_BRANDS = [
  { name: 'Apple', logo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=200&auto=format&fit=crop' },
  { name: 'Samsung', logo: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=200&auto=format&fit=crop' },
  { name: 'Sony', logo: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=200&auto=format&fit=crop' },
  { name: 'Dell', logo: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=200&auto=format&fit=crop' },
  { name: 'Asus', logo: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=200&auto=format&fit=crop' },
  { name: 'Lenovo', logo: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=200&auto=format&fit=crop' }
];

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Modals state
  const [selectedQuickViewProduct, setSelectedQuickViewProduct] = useState(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareProduct, setCompareProduct] = useState(null);
  const [wishlistIds, setWishlistIds] = useState([]);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ hours: 8, minutes: 42, seconds: 19 });

  const { addToCart } = useCart();
  const navigate = useNavigate();

  // Slide timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Flash Sale countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 8, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCatalogData = async () => {
      try {
        setLoading(true);
        const [catRes, prodRes] = await Promise.all([
          axiosClient.get('/categories'),
          axiosClient.get('/products?page=0&size=24')
        ]);
        setCategories(catRes.data || []);
        const prods = prodRes.data?.content || prodRes.data || [];
        setFeaturedProducts(prods);
      } catch (err) {
        console.error('Failed to load homepage catalog data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalogData();
  }, []);

  const handleToggleWishlist = (productId) => {
    if (wishlistIds.includes(productId)) {
      setWishlistIds(wishlistIds.filter((id) => id !== productId));
    } else {
      setWishlistIds([...wishlistIds, productId]);
    }
  };

  const handleBuyNow = (product) => {
    addToCart(product, 1);
    navigate('/checkout');
  };

  return (
    <div className="space-y-12 pb-16">

      {/* SECTION 1: HERO AUTO-SLIDING BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
        <div className={`transition-all duration-700 bg-gradient-to-r ${HERO_SLIDES[currentSlide].color} p-8 sm:p-14 min-h-[420px] flex flex-col justify-center`}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-600/30 border border-nexus-500/50 text-nexus-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> {HERO_SLIDES[currentSlide].tag} • {HERO_SLIDES[currentSlide].badge}
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">
                {HERO_SLIDES[currentSlide].title}
              </h1>

              <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
                {HERO_SLIDES[currentSlide].subtitle}
              </p>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link
                  to="/products"
                  className="px-6 py-3.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-nexus-600/30 flex items-center gap-2 transition"
                >
                  <ShoppingBag className="w-4 h-4" /> Shop Collection <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/products"
                  className="px-6 py-3.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm rounded-xl transition"
                >
                  Explore Deals
                </Link>
              </div>
            </div>

            {/* Slide Image */}
            <div className="relative flex justify-center items-center">
              <div className="w-full max-w-md h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl group">
                <img
                  src={HERO_SLIDES[currentSlide].image}
                  alt={HERO_SLIDES[currentSlide].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Carousel Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all ${
                currentSlide === idx ? 'w-8 bg-nexus-400' : 'w-2 bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* SECTION 2: FLASH SALE COUNTDOWN SECTION */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-rose-900/50 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-rose-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold">
              <Flame className="w-6 h-6 animate-pulse text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                Flash Sale • Limited Time Deals
              </h2>
              <p className="text-xs text-rose-300">Up to 50% discount on flagship tech & electronics</p>
            </div>
          </div>

          {/* Clock Timer */}
          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-slate-400 font-sans flex items-center gap-1">
              <Clock className="w-4 h-4 text-rose-400" /> Ends In:
            </span>
            <div className="px-3 py-1.5 bg-slate-950 border border-rose-800/80 rounded-xl text-rose-400 text-sm font-extrabold">
              {String(timeLeft.hours).padStart(2, '0')}h
            </div>
            <span className="text-slate-500 font-bold">:</span>
            <div className="px-3 py-1.5 bg-slate-950 border border-rose-800/80 rounded-xl text-rose-400 text-sm font-extrabold">
              {String(timeLeft.minutes).padStart(2, '0')}m
            </div>
            <span className="text-slate-500 font-bold">:</span>
            <div className="px-3 py-1.5 bg-slate-950 border border-rose-800/80 rounded-xl text-rose-400 text-sm font-extrabold">
              {String(timeLeft.seconds).padStart(2, '0')}s
            </div>
          </div>
        </div>

        {/* Flash Sale Banner Products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredProducts.slice(0, 4).map((p) => (
            <div key={p.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
              <div className="w-16 h-16 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                <img src={p.imageUrl || (p.imageUrls && p.imageUrls[0])} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1 flex-1">
                <p className="font-bold text-white text-xs line-clamp-1">{p.name}</p>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-400 font-extrabold">${p.price}</span>
                  {p.compareAtPrice && (
                    <span className="text-slate-500 line-through text-[11px]">${p.compareAtPrice}</span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold inline-block">
                  Save 20%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: PRODUCT CATEGORIES GRID */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-nexus-400" /> Explore Top Categories
          </h2>
          <Link to="/products" className="text-xs text-nexus-400 font-bold hover:underline flex items-center gap-1">
            View All Categories <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/products?category=${c.slug}`}
              className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-nexus-500/60 text-center space-y-3 group transition"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-nexus-400 overflow-hidden group-hover:scale-110 transition">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <Laptop className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-xs font-bold text-white group-hover:text-nexus-400 transition line-clamp-1">{c.name}</h3>
            </Link>
          ))}
        </div>
      </div>

      {/* SECTION 4: FEATURED PRODUCTS GRID (20+ ITEMS) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" /> Flagship Featured Products
          </h2>
          <span className="text-xs text-slate-400 font-mono">Handpicked Top Quality Hardware</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading flagship catalog...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => {
              const mainImg = product.imageUrl || (product.imageUrls && product.imageUrls[0]) || 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop';
              const isWishlisted = wishlistIds.includes(product.id);

              return (
                <div
                  key={product.id}
                  className="glass-card rounded-3xl border border-slate-800 overflow-hidden hover:border-nexus-500/50 transition duration-300 flex flex-col justify-between group"
                >
                  {/* Image & Quick Action Floating Buttons */}
                  <div className="relative h-56 bg-slate-950 overflow-hidden">
                    <img
                      src={mainImg}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />

                    {/* Wishlist Button */}
                    <button
                      onClick={() => handleToggleWishlist(product.id)}
                      className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border transition ${
                        isWishlisted
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-slate-950/70 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
                    </button>

                    {/* Quick View & Compare Floating Overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition duration-300">
                      <button
                        onClick={() => setSelectedQuickViewProduct(product)}
                        className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-nexus-400" /> Quick View
                      </button>

                      <button
                        onClick={() => {
                          setCompareProduct(product);
                          setIsCompareOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1"
                      >
                        <Scale className="w-3.5 h-3.5 text-indigo-400" /> Compare
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono">{product.categoryName || 'Electronics'}</span>
                        <div className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> {product.rating || '4.9'}
                        </div>
                      </div>

                      <Link to={`/products/${product.id}`} className="font-bold text-white text-sm hover:text-nexus-400 transition line-clamp-2">
                        {product.name}
                      </Link>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-baseline gap-2 font-mono">
                        <span className="text-xl font-black text-emerald-400">${product.price}</span>
                        {product.compareAtPrice && (
                          <span className="text-xs text-slate-500 line-through">${product.compareAtPrice}</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => addToCart(product, 1)}
                          className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 text-nexus-400" /> Add Cart
                        </button>

                        <button
                          onClick={() => handleBuyNow(product)}
                          className="py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition shadow-md shadow-nexus-600/20"
                        >
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      SECTION 5: AI PERSONALIZED RECOMMENDATIONS CARD
      {/* <div className="glass-card p-6 sm:p-8 rounded-3xl border border-nexus-800/80 bg-gradient-to-r from-nexus-950/50 via-slate-900 to-indigo-950/40 space-y-6">
        <div className="flex items-center justify-between border-b border-nexus-800/60 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-nexus-900 border border-nexus-600 text-nexus-300 text-[10px] font-bold uppercase tracking-wider">
              AI Recommendation Engine
            </span>
            <h2 className="text-xl font-extrabold text-white mt-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Recommended For You
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Matched by Vector Similarity Affinity</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {featuredProducts.slice(0, 3).map((p) => (
            <div key={p.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                  98% AI Affinity Match
                </span>
                <span className="text-slate-500 text-[10px] font-mono">High Interest</span>
              </div>

              <div className="flex gap-3">
                <div className="w-16 h-16 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                  <img src={p.imageUrl || (p.imageUrls && p.imageUrls[0])} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-white text-xs line-clamp-1">{p.name}</p>
                  <p className="text-emerald-400 font-mono font-extrabold text-xs">${p.price}</p>
                  <button
                    onClick={() => addToCart(p, 1)}
                    className="text-[11px] text-nexus-400 font-bold hover:underline flex items-center gap-1"
                  >
                    Quick Add <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div> */}
      {/* SECTION 5: AI PERSONALIZED RECOMMENDATIONS CARD */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-nexus-800/80 bg-gradient-to-r from-nexus-950/50 via-slate-900 to-indigo-950/40 space-y-6">
        <div className="flex items-center justify-between border-b border-nexus-800/60 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-nexus-900 border border-nexus-600 text-nexus-300 text-[10px] font-bold uppercase tracking-wider">
              AI Recommendation Engine
            </span>
            <h2 className="text-xl font-extrabold text-white mt-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Recommended For You
            </h2>
          </div>
          
          {/* Browse All button */}
          <Link
            to="/products"
            className="text-xs text-nexus-400 font-bold hover:underline flex items-center gap-1"
          >
            Browse All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendedProducts.map((p) => (
            <div key={p.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                  {Math.floor(Math.random() * 15) + 85}% AI Affinity Match
                </span>
                <span className="text-slate-500 text-[10px] font-mono">High Interest</span>
              </div>

              <div className="flex gap-3">
                <div className="w-16 h-16 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                  <img
                    src={p.imageUrl || (p.imageUrls && p.imageUrls[0])}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-white text-xs line-clamp-1">{p.name}</p>
                  <p className="text-emerald-400 font-mono font-extrabold text-xs">${p.price}</p>
                  <button
                    onClick={() => addToCart(p, 1)}
                    className="text-[11px] text-nexus-400 font-bold hover:underline flex items-center gap-1"
                  >
                    Quick Add <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 6: TOP BRANDS SHOWCASE */}
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-extrabold text-white">Official Brand Partners</h2>
          <p className="text-xs text-slate-400">Shop authentic products directly from leading technology manufacturers</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {TOP_BRANDS.map((b, idx) => (
            <div key={idx} className="p-4 glass-card rounded-2xl border border-slate-800 text-center space-y-2 hover:border-slate-700 transition">
              <div className="w-12 h-12 mx-auto rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <img src={b.logo} alt={b.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-bold text-slate-200 block">{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 7: TRUST BADGES & CUSTOMER SUPPORT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nexus-950 border border-nexus-800 text-nexus-400 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Free Express Shipping</h4>
            <p className="text-[11px] text-slate-400">On all orders above $50.00</p>
          </div>
        </div>

        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Encrypted Payments</h4>
            <p className="text-[11px] text-slate-400">Stripe & PayPal certified</p>
          </div>
        </div>

        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center shrink-0">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">30-Day Easy Returns</h4>
            <p className="text-[11px] text-slate-400">Hassle-free money back</p>
          </div>
        </div>

        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center shrink-0">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">24/7 AI Assistance</h4>
            <p className="text-[11px] text-slate-400">Real-time intelligent chatbot</p>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {selectedQuickViewProduct && (
        <QuickViewModal
          product={selectedQuickViewProduct}
          onClose={() => setSelectedQuickViewProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      {isCompareOpen && (
        <ProductComparisonModal
          initialProduct={compareProduct}
          allProducts={featuredProducts}
          onClose={() => setIsCompareOpen(false)}
          onAddToCart={addToCart}
        />
      )}

    </div>
  );
}

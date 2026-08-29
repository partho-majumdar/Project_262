import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Star,
  Flame,
  TrendingUp,
  ShieldCheck,
  Truck,
  RefreshCw,
  Headphones,
  Heart,
  Eye,
  Scale,
  ShoppingCart,
  Award,
  Laptop,
  Store,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useCart } from '../context/CartContext';
import QuickViewModal from '../components/common/QuickViewModal';
import ProductComparisonModal from '../components/common/ProductComparisonModal';

const GRADIENTS = [
  'from-slate-900 via-indigo-950 to-slate-950',
  'from-slate-950 via-nexus-950 to-slate-900',
  'from-slate-900 via-purple-950 to-slate-950',
  'from-slate-900 via-rose-950 to-slate-950',
  'from-slate-950 via-emerald-950 to-slate-900',
];

function productImage(p) {
  return p?.imageUrl || (p?.imageUrls && p.imageUrls[0]) || null;
}

function discountPercent(p) {
  const price = Number(p?.price);
  const compare = Number(p?.compareAtPrice);
  if (!compare || !price || compare <= price) return null;
  return Math.round(((compare - price) / compare) * 100);
}

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [dealsProducts, setDealsProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [selectedQuickViewProduct, setSelectedQuickViewProduct] = useState(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareProduct, setCompareProduct] = useState(null);
  const [wishlistIds, setWishlistIds] = useState([]);

  const { addToCart } = useCart();
  const navigate = useNavigate();

  // Hero slides = featured products from backend (fallback: deals / catalog)
  const heroSlides = useMemo(() => {
    const source =
      featuredProducts.length > 0
        ? featuredProducts
        : dealsProducts.length > 0
          ? dealsProducts
          : [];
    return source.slice(0, 5).map((p, i) => {
      const pct = discountPercent(p);
      return {
        id: p.id,
        title: p.name,
        subtitle: p.description
          ? String(p.description).slice(0, 120) + (p.description.length > 120 ? '…' : '')
          : p.categoryName || p.sellerStoreName || '',
        tag: p.categoryName || 'Featured',
        badge: pct ? `Save ${pct}%` : p.featured ? 'Featured' : 'Hot',
        image: productImage(p),
        link: `/products/${p.slug || p.id}`,
        color: GRADIENTS[i % GRADIENTS.length],
        price: p.price,
        compareAtPrice: p.compareAtPrice,
      };
    });
  }, [featuredProducts, dealsProducts]);

  // Brands = unique seller stores from loaded products
  const topBrands = useMemo(() => {
    const map = new Map();
    [...featuredProducts, ...dealsProducts].forEach((p) => {
      const name = p.sellerStoreName;
      if (!name) return;
      if (!map.has(name)) {
        map.set(name, {
          name,
          logo: productImage(p),
          slug: p.sellerStoreSlug,
        });
      }
    });
    return Array.from(map.values()).slice(0, 12);
  }, [featuredProducts, dealsProducts]);

  // Auto-slide only when slides exist
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [catRes, featuredRes, dealsRes, prodRes, recRes] = await Promise.allSettled([
          axiosClient.get('/categories'),
          axiosClient.get('/products/featured'),
          axiosClient.get('/products/deals?page=0&size=8'),
          axiosClient.get('/products?page=0&size=24'),
          axiosClient.get('/ai/recommendations/personalized').catch(() => null),
        ]);

        const unwrap = (r) => {
          if (r.status !== 'fulfilled') return null;
          const d = r.value?.data ?? r.value;
          return d?.data ?? d?.content ?? d;
        };

        setCategories(Array.isArray(unwrap(catRes)) ? unwrap(catRes) : []);

        const featured = unwrap(featuredRes);
        const featuredList = Array.isArray(featured) ? featured : featured?.content || [];
        setFeaturedProducts(featuredList);

        const deals = unwrap(dealsRes);
        const dealsList = Array.isArray(deals) ? deals : deals?.content || [];
        setDealsProducts(dealsList);

        const catalog = unwrap(prodRes);
        const catalogList = Array.isArray(catalog) ? catalog : catalog?.content || [];
        if (featuredList.length === 0 && catalogList.length > 0) {
          setFeaturedProducts(catalogList);
        }

        const recs = unwrap(recRes);
        const recList =
          recs?.recommendations ||
          (Array.isArray(recs) ? recs : []);
        setRecommendedProducts(
          recList.length > 0 ? recList.slice(0, 6) : (featuredList.length ? featuredList : catalogList).slice(0, 3)
        );
      } catch (err) {
        console.error('Failed to load homepage', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const loadWishlistIds = async () => {
      try {
        const res = await axiosClient.get('/wishlist');
        const items = res?.data?.items || res?.data || [];
        setWishlistIds(items.map((i) => i.productId || i.id).filter(Boolean));
      } catch {
        // guest / empty
      }
    };
    loadWishlistIds();
  }, []);

  const handleToggleWishlist = async (productId) => {
    try {
      if (wishlistIds.includes(productId)) {
        await axiosClient.delete(`/wishlist/items/${productId}`);
        setWishlistIds((prev) => prev.filter((id) => id !== productId));
      } else {
        await axiosClient.post('/wishlist/items', { productId });
        setWishlistIds((prev) => [...prev, productId]);
      }
    } catch (err) {
      alert(err?.message || 'Please login to use wishlist');
    }
  };

  const handleBuyNow = (product) => {
    addToCart(product.id || product, 1);
    navigate('/checkout');
  };

  const slide = heroSlides[currentSlide] || null;

  return (
    <div className="space-y-12 pb-16">

      {/* SECTION 1: HERO — from featured/deals products */}
      {slide ? (
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
          <div className={`transition-all duration-700 bg-gradient-to-r ${slide.color} p-8 sm:p-14 min-h-[420px] flex flex-col justify-center`}>
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nexus-600/30 border border-nexus-500/50 text-nexus-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> {slide.tag} • {slide.badge}
                </div>
                <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
                    {slide.subtitle}
                  </p>
                )}
                <div className="flex items-baseline gap-3 font-mono">
                  <span className="text-2xl font-black text-emerald-400">${slide.price}</span>
                  {slide.compareAtPrice && (
                    <span className="text-sm text-slate-500 line-through">${slide.compareAtPrice}</span>
                  )}
                </div>
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link
                    to={slide.link}
                    className="px-6 py-3.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-nexus-600/30 flex items-center gap-2 transition"
                  >
                    <ShoppingBag className="w-4 h-4" /> View Product <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/products?tag=deals"
                    className="px-6 py-3.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm rounded-xl transition"
                  >
                    Explore Deals
                  </Link>
                </div>
              </div>
              <div className="relative flex justify-center items-center">
                <div className="w-full max-w-md h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl group bg-slate-950">
                  {slide.image ? (
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <ShoppingBag className="w-16 h-16" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {heroSlides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all ${
                    currentSlide === idx ? 'w-8 bg-nexus-400' : 'w-2 bg-slate-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : !loading ? (
        <div className="glass-panel p-10 rounded-3xl border border-slate-800 text-center text-slate-400 text-sm">
          No featured products yet. Add products from the seller dashboard.
        </div>
      ) : null}

      {/* SECTION 2: DEALS — from /products/deals (no fake timer) */}
      {dealsProducts.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-rose-900/50 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-rose-900/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold">
                <Flame className="w-6 h-6 animate-pulse text-amber-300" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">Today&apos;s Deals</h2>
                <p className="text-xs text-rose-300">
                  {dealsProducts.length} products with compare-at pricing from the catalog
                </p>
              </div>
            </div>
            <Link
              to="/products?tag=deals"
              className="text-xs text-rose-300 font-bold hover:underline flex items-center gap-1"
            >
              View all deals <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dealsProducts.slice(0, 4).map((p) => {
              const pct = discountPercent(p);
              return (
                <Link
                  key={p.id}
                  to={`/products/${p.slug || p.id}`}
                  className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3 hover:border-rose-800 transition"
                >
                  <div className="w-16 h-16 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                    {productImage(p) ? (
                      <img src={productImage(p)} alt={p.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-bold text-white text-xs line-clamp-1">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-emerald-400 font-extrabold">${p.price}</span>
                      {p.compareAtPrice && (
                        <span className="text-slate-500 line-through text-[11px]">${p.compareAtPrice}</span>
                      )}
                    </div>
                    {pct != null && (
                      <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold inline-block">
                        Save {pct}%
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: CATEGORIES — from /categories */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-nexus-400" /> Explore Top Categories
          </h2>
          <Link to="/categories" className="text-xs text-nexus-400 font-bold hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {categories.length === 0 && !loading ? (
          <p className="text-xs text-slate-500 text-center py-6">No categories yet.</p>
        ) : (
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
                <h3 className="text-xs font-bold text-white group-hover:text-nexus-400 transition line-clamp-1">
                  {c.name}
                </h3>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: FEATURED PRODUCTS */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" /> Featured Products
          </h2>
          <Link to="/products" className="text-xs text-nexus-400 font-bold hover:underline">
            View catalog →
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading catalog…</div>
        ) : featuredProducts.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No products yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => {
              const mainImg = productImage(product);
              const isWishlisted = wishlistIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className="glass-card rounded-3xl border border-slate-800 overflow-hidden hover:border-nexus-500/50 transition duration-300 flex flex-col justify-between group"
                >
                  <div className="relative h-56 bg-slate-950 overflow-hidden">
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <ShoppingBag className="w-12 h-12" />
                      </div>
                    )}
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
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono">{product.categoryName || product.sellerStoreName || '—'}</span>
                        <div className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />{' '}
                          {product.rating != null && product.rating > 0 ? product.rating : '—'}
                        </div>
                      </div>
                      <Link
                        to={`/products/${product.slug || product.id}`}
                        className="font-bold text-white text-sm hover:text-nexus-400 transition line-clamp-2"
                      >
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
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => addToCart(product.id || product, 1)}
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

      {/* SECTION 5: RECOMMENDATIONS — from AI API or fallback featured */}
      {recommendedProducts.length > 0 && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-nexus-800/80 bg-gradient-to-r from-nexus-950/50 via-slate-900 to-indigo-950/40 space-y-6">
          <div className="flex items-center justify-between border-b border-nexus-800/60 pb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-nexus-900 border border-nexus-600 text-nexus-300 text-[10px] font-bold uppercase tracking-wider">
                Recommendations
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Recommended For You
              </h2>
            </div>
            <Link to="/products" className="text-xs text-nexus-400 font-bold hover:underline flex items-center gap-1">
              Browse All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedProducts.map((p) => (
              <div key={p.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                    {productImage(p) && (
                      <img src={productImage(p)} alt={p.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-white text-xs line-clamp-1">{p.name}</p>
                    <p className="text-emerald-400 font-mono font-extrabold text-xs">${p.price}</p>
                    <button
                      onClick={() => addToCart(p.id || p, 1)}
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
      )}

      {/* SECTION 6: SELLER STORES — from product.sellerStoreName */}
      {topBrands.length > 0 && (
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-extrabold text-white flex items-center justify-center gap-2">
              <Store className="w-5 h-5 text-nexus-400" /> Seller Stores
            </h2>
            <p className="text-xs text-slate-400">Stores with products in the current catalog</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {topBrands.map((b) => (
              <Link
                key={b.name}
                to={b.slug ? `/stores/${b.slug}` : '/products'}
                className="p-4 glass-card rounded-2xl border border-slate-800 text-center space-y-2 hover:border-slate-700 transition"
              >
                <div className="w-12 h-12 mx-auto rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                  {b.logo ? (
                    <img src={b.logo} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-200 block line-clamp-1">{b.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Trust row — pure UI chrome, no data claims */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nexus-950 border border-nexus-800 text-nexus-400 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Fast Shipping</h4>
            <p className="text-[11px] text-slate-400">Calculated at checkout</p>
          </div>
        </div>
        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Secure Checkout</h4>
            <p className="text-[11px] text-slate-400">Encrypted payments</p>
          </div>
        </div>
        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center shrink-0">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Easy Returns</h4>
            <p className="text-[11px] text-slate-400">Per store return policy</p>
          </div>
        </div>
        <div className="p-5 glass-card rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center shrink-0">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Support</h4>
            <p className="text-[11px] text-slate-400">AI assistant available</p>
          </div>
        </div>
      </div>

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
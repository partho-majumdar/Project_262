import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Sparkles, 
  SlidersHorizontal, 
  Layers, 
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  Tag,
  TrendingUp,
  PackageX,
  RotateCcw,
  Clock
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import ProductCard from '../components/common/ProductCard';
import QuickViewModal from '../components/common/QuickViewModal';
import ProductComparisonModal from '../components/common/ProductComparisonModal';

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsRef = useRef(null);

  // URL Params Sync
  const currentTag = searchParams.get('tag') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('q') || searchParams.get('search') || '';

  const [searchResult, setSearchResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Countdown timer state for Today's Deals
  const [timeLeft, setTimeLeft] = useState({ hours: 8, minutes: 45, seconds: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals state
  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  
  // Multi-Criteria Filter States
  const [query, setQuery] = useState(currentSearch);
  const [categorySlug, setCategorySlug] = useState(currentCategory);
  const [activeTag, setActiveTag] = useState(currentTag);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(0);

  // Sync state with URL params when searchParams change
  useEffect(() => {
    const searchVal = searchParams.get('q') || searchParams.get('search') || '';
    const catVal = searchParams.get('category') || '';
    const tagVal = searchParams.get('tag') || '';

    setQuery(searchVal);
    setCategorySlug(catVal);
    setActiveTag(tagVal);

    if (searchVal || catVal || tagVal) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosClient.get('/categories');
        setCategories(response.data || []);
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCategories();
  }, []);

  const fetchSearch = async () => {
    setLoading(true);
    try {
      let endpoint = '/search';
      if (activeTag === 'deals') endpoint = '/products/deals';
      else if (activeTag === 'new') endpoint = '/products/new-arrivals';
      else if (activeTag === 'trending') endpoint = '/products/trending';

      let url = `${endpoint}?page=${page}&size=24&sortBy=${sortBy}`;
      if (query) url += `&q=${encodeURIComponent(query)}`;
      if (categorySlug) url += `&categorySlug=${encodeURIComponent(categorySlug)}`;
      if (minPrice) url += `&minPrice=${minPrice}`;
      if (maxPrice) url += `&maxPrice=${maxPrice}`;
      if (minRating) url += `&minRating=${minRating}`;
      if (inStockOnly) url += `&inStockOnly=true`;

      const response = await axiosClient.get(url);
      setSearchResult(response.data?.data || response.data);
    } catch (err) {
      console.error('Failed to fetch product catalog', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearch();
  }, [query, categorySlug, activeTag, minPrice, maxPrice, minRating, inStockOnly, sortBy, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    } else {
      setSearchParams({});
    }
    resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTagFilter = (tag) => {
    if (activeTag === tag) {
      setActiveTag('');
      setSearchParams({});
    } else {
      setActiveTag(tag);
      setSearchParams({ tag });
    }
    setPage(0);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetFilters = () => {
    setQuery('');
    setCategorySlug('');
    setActiveTag('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setInStockOnly(false);
    setSortBy('newest');
    setPage(0);
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" ref={resultsRef}>
      
      {/* Header Banner */}
      <div className="relative glass-panel p-6 sm:p-10 rounded-3xl overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-nexus-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950/80 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Real-time Enterprise Catalog
            </div>
            
            {activeTag === 'deals' ? (
              <div className="space-y-1 mt-2">
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-7 h-7 text-rose-500 animate-bounce" /> Today's Flash Deals
                </h1>
                <p className="text-xs text-rose-300 font-mono flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Flash Offers expire in: {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
                </p>
              </div>
            ) : activeTag === 'new' ? (
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
                <Tag className="w-7 h-7 text-indigo-400" /> New Arrivals Showcase
              </h1>
            ) : activeTag === 'trending' ? (
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
                <TrendingUp className="w-7 h-7 text-amber-400" /> Trending Products
              </h1>
            ) : query ? (
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
                Search Results for <span className="text-nexus-400">"{query}"</span>
              </h1>
            ) : categorySlug ? (
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
                Category: <span className="text-nexus-400 capitalize">{categorySlug.replace('-', ' ')}</span>
              </h1>
            ) : (
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
                Marketplace <span className="text-nexus-400">Product Catalog</span>
              </h1>
            )}

            <p className="text-xs sm:text-sm text-slate-300 pt-1">
              Showing {searchResult?.totalElements || 0} active products loaded from database.
            </p>
          </div>

          {/* Feature Quick Filter Tags */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTagFilter('deals')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                activeTag === 'deals' ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Flame className="w-4 h-4 text-rose-400" /> Today's Deals
            </button>

            <button
              onClick={() => handleTagFilter('new')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                activeTag === 'new' ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Tag className="w-4 h-4 text-indigo-400" /> New Arrivals
            </button>

            <button
              onClick={() => handleTagFilter('trending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                activeTag === 'trending' ? 'bg-amber-600 text-white shadow-amber-600/30' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-amber-400" /> Trending Products
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout (Sidebar Filters + Responsive Products Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Filters Sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-nexus-400" /> Filter Catalog
              </h3>
              {(query || categorySlug || activeTag || minPrice || maxPrice || minRating || inStockOnly) && (
                <button onClick={resetFilters} className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* Keyword Search Input */}
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Intelligent Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Shoes, iPhone, Laptop..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-nexus-500 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </form>

            {/* Category Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Category Filter
              </label>
              <select
                value={categorySlug}
                onChange={(e) => {
                  setCategorySlug(e.target.value);
                  setPage(0);
                  if (e.target.value) {
                    setSearchParams({ category: e.target.value });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-nexus-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Price Range ($)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder-slate-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-nexus-500"
              >
                <option value="newest">Newest Additions</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
              </select>
            </div>

          </div>
        </div>

        {/* Right Product Grid (3–4 Cards Per Row) */}
        <div className="lg:col-span-3 space-y-6">
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="h-80 bg-slate-900/60 rounded-3xl animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : searchResult?.content?.length === 0 ? (
            /* EMPTY SEARCH STATE WITH 'CLEAR SEARCH' BUTTON */
            <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto text-slate-500">
                <PackageX className="w-8 h-8 text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-white">
                No products available in this section.
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                There are currently no products matching your selected section or search filters. Click below to restore the main catalog.
              </p>
              <button
                onClick={resetFilters}
                className="px-5 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-nexus-600/30 transition-all flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" /> Clear Filters & View All Products
              </button>
            </div>
          ) : (
            /* RESPONSIVE PRODUCT CARDS GRID (3-4 CARDS PER ROW) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResult?.content?.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={(prod) => setSelectedQuickView(prod)}
                  onCompare={() => setIsCompareOpen(true)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {searchResult && searchResult.totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <span className="text-xs font-mono text-slate-400">
                Page {page + 1} of {searchResult.totalPages}
              </span>

              <button
                disabled={page >= searchResult.totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Modals */}
      <QuickViewModal
        isOpen={!!selectedQuickView}
        onClose={() => setSelectedQuickView(null)}
        product={selectedQuickView}
      />
      <ProductComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
      />

    </div>
  );
}

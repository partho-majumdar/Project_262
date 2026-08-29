import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  Layers,
  ChevronLeft,
  ChevronRight,
  Flame,
  Tag,
  TrendingUp,
  PackageX,
  RotateCcw,
  DollarSign,
  Star,
  CheckCircle2,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import ProductCard from '../components/common/ProductCard';
import QuickViewModal from '../components/common/QuickViewModal';
import ProductComparisonModal from '../components/common/ProductComparisonModal';

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsRef = useRef(null);

  const currentTag = searchParams.get('tag') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('q') || searchParams.get('search') || '';

  const [searchResult, setSearchResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedQuickView, setSelectedQuickView] = useState(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const [query, setQuery] = useState(currentSearch);
  const [categorySlug, setCategorySlug] = useState(currentCategory);
  const [activeTag, setActiveTag] = useState(currentTag);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(0);

  const hasActiveFilters =
    !!(query || categorySlug || activeTag || minPrice || maxPrice || minRating || inStockOnly);

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

  const title = (() => {
    if (activeTag === 'deals') {
      return (
        <div className="space-y-1 mt-2">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Flame className="w-7 h-7 text-rose-500" /> Today's Flash Deals
          </h1>
          <p className="text-xs text-rose-300/90">Live deals from the catalog</p>
        </div>
      );
    }
    if (activeTag === 'new') {
      return (
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
          <Tag className="w-7 h-7 text-indigo-400" /> New Arrivals Showcase
        </h1>
      );
    }
    if (activeTag === 'trending') {
      return (
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-amber-400" /> Trending Products
        </h1>
      );
    }
    if (query) {
      return (
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
          Search Results for <span className="text-nexus-400">"{query}"</span>
        </h1>
      );
    }
    if (categorySlug) {
      return (
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
          Category:{' '}
          <span className="text-nexus-400 capitalize">{categorySlug.replace(/-/g, ' ')}</span>
        </h1>
      );
    }
    return (
      <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
        Marketplace <span className="text-nexus-400">Product Catalog</span>
      </h1>
    );
  })();

  const ratingOptions = [
    { value: '', label: 'Any rating' },
    { value: '4', label: '4★ & up' },
    { value: '3', label: '3★ & up' },
    { value: '2', label: '2★ & up' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" ref={resultsRef}>
      {/* Hero / section header */}
      <div className="relative glass-panel p-6 sm:p-10 rounded-3xl overflow-hidden space-y-4 border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-nexus-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950/80 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Real-time Enterprise Catalog
            </div>
            {title}
            <p className="text-xs sm:text-sm text-slate-300 pt-1">
              Showing {searchResult?.totalElements || 0} active products loaded from database.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              {
                tag: 'deals',
                label: "Today's Deals",
                icon: Flame,
                active: 'bg-rose-600 text-white shadow-md shadow-rose-600/30',
                iconCls: 'text-rose-400',
              },
              {
                tag: 'new',
                label: 'New Arrivals',
                icon: Tag,
                active: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30',
                iconCls: 'text-indigo-400',
              },
              {
                tag: 'trending',
                label: 'Trending',
                icon: TrendingUp,
                active: 'bg-amber-600 text-white shadow-md shadow-amber-600/30',
                iconCls: 'text-amber-400',
              },
            ].map(({ tag, label, icon: Icon, active, iconCls }) => (
              <button
                key={tag}
                onClick={() => handleTagFilter(tag)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  activeTag === tag
                    ? active
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeTag === tag ? 'text-white' : iconCls}`} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout: filters + products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filter sidebar — modern card */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden sticky top-24">
            {/* Filter header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-nexus-950 border border-nexus-800 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4 text-nexus-400" />
                </span>
                Filters
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-950/40 transition"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Search
                </label>
                <form onSubmit={handleSearchSubmit}>
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500/30 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </form>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Category
                </label>
                <select
                  value={categorySlug}
                  onChange={(e) => {
                    setCategorySlug(e.target.value);
                    setPage(0);
                    setSearchParams(e.target.value ? { category: e.target.value } : {});
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500/30 transition"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Price range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">
                      $
                    </span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => {
                        setMinPrice(e.target.value);
                        setPage(0);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-6 pr-2 text-xs text-white placeholder-slate-500 focus:border-nexus-500 transition"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">
                      $
                    </span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(e.target.value);
                        setPage(0);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-6 pr-2 text-xs text-white placeholder-slate-500 focus:border-nexus-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400" /> Minimum rating
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ratingOptions.map((opt) => (
                    <button
                      key={opt.value || 'any'}
                      type="button"
                      onClick={() => {
                        setMinRating(opt.value);
                        setPage(0);
                      }}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition ${
                        minRating === opt.value
                          ? 'bg-nexus-950 border-nexus-500 text-nexus-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* In stock */}
              <button
                type="button"
                onClick={() => {
                  setInStockOnly((v) => !v);
                  setPage(0);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-xs font-semibold transition ${
                  inStockOnly
                    ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${inStockOnly ? 'text-emerald-400' : 'text-slate-500'}`}
                  />
                  In stock only
                </span>
                <span
                  className={`w-9 h-5 rounded-full relative transition ${
                    inStockOnly ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition ${
                      inStockOnly ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>

              {/* Sort */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Sort by
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(0);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-nexus-500 focus:ring-1 focus:ring-nexus-500/30 transition"
                >
                  <option value="newest">Newest Additions</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* Product grid — max 2 per row */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-96 bg-slate-900/60 rounded-3xl animate-pulse border border-slate-800"
                />
              ))}
            </div>
          ) : searchResult?.content?.length === 0 ? (
            <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto border border-slate-800">
                <PackageX className="w-8 h-8 text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-white">No products available in this section.</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                There are currently no products matching your selected section or search filters.
              </p>
              <button
                onClick={resetFilters}
                className="px-5 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-nexus-600/30 transition-all flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" /> Clear Filters & View All Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
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

          {searchResult && searchResult.totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1 hover:border-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs font-mono text-slate-400">
                Page {page + 1} of {searchResult.totalPages}
              </span>
              <button
                disabled={page >= searchResult.totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1 hover:border-slate-700 transition"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <QuickViewModal
        isOpen={!!selectedQuickView}
        onClose={() => setSelectedQuickView(null)}
        product={selectedQuickView}
      />
      <ProductComparisonModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />
    </div>
  );
}

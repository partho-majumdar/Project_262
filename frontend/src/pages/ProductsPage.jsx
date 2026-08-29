import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Layers,
  ChevronLeft,
  ChevronRight,
  Flame,
  Tag,
  TrendingUp,
  PackageX,
  RotateCcw,
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

  const hasActiveFilters = !!(
    query ||
    categorySlug ||
    activeTag ||
    minPrice ||
    maxPrice ||
    minRating ||
    inStockOnly
  );

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

  const pageTitle = (() => {
    if (activeTag === 'deals') return "Today's Deals";
    if (activeTag === 'new') return 'New Arrivals';
    if (activeTag === 'trending') return 'Trending';
    if (query) return `Results for “${query}”`;
    if (categorySlug) return categorySlug.replace(/-/g, ' ');
    return 'All Products';
  })();

  const collectionTabs = [
    {
      tag: 'deals',
      label: 'Deals',
      icon: Flame,
      active: 'bg-rose-600 border-rose-500 text-white',
      idle: 'text-rose-300 border-slate-800 hover:border-rose-800/60',
    },
    {
      tag: 'new',
      label: 'New',
      icon: Tag,
      active: 'bg-indigo-600 border-indigo-500 text-white',
      idle: 'text-indigo-300 border-slate-800 hover:border-indigo-800/60',
    },
    {
      tag: 'trending',
      label: 'Trending',
      icon: TrendingUp,
      active: 'bg-amber-600 border-amber-500 text-white',
      idle: 'text-amber-300 border-slate-800 hover:border-amber-800/60',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4" ref={resultsRef}>
      {/* Row 1: title + collection tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate capitalize">
            {pageTitle}
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {searchResult?.totalElements ?? 0} products
            {loading ? ' · loading…' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {collectionTabs.map(({ tag, label, icon: Icon, active, idle }) => (
            <button
              key={tag}
              onClick={() => handleTagFilter(tag)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                activeTag === tag ? active : `bg-slate-900 ${idle}`
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: HORIZONTAL filters under Deals / New / Trending */}
      <div className="glass-card rounded-2xl border border-slate-800 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-xl py-2 pl-8 pr-2.5 text-xs text-white placeholder-slate-600"
            />
          </form>

          {/* Category */}
          <div className="relative">
            <Layers className="w-3 h-3 text-indigo-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={categorySlug}
              onChange={(e) => {
                setCategorySlug(e.target.value);
                setPage(0);
                setSearchParams(e.target.value ? { category: e.target.value } : {});
              }}
              className="appearance-none bg-slate-950 border border-slate-800 rounded-xl py-2 pl-8 pr-7 text-xs text-white focus:border-nexus-500 min-w-[130px]"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Min price */}
          <input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setPage(0);
            }}
            className="w-[88px] bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-xs text-white placeholder-slate-600 focus:border-nexus-500"
          />

          {/* Max price */}
          <input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setPage(0);
            }}
            className="w-[88px] bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-xs text-white placeholder-slate-600 focus:border-nexus-500"
          />

          {/* Rating */}
          <div className="relative">
            <Star className="w-3 h-3 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={minRating}
              onChange={(e) => {
                setMinRating(e.target.value);
                setPage(0);
              }}
              className="appearance-none bg-slate-950 border border-slate-800 rounded-xl py-2 pl-8 pr-7 text-xs text-white focus:border-nexus-500 min-w-[100px]"
            >
              <option value="">Any rating</option>
              <option value="4">4★ & up</option>
              <option value="3">3★ & up</option>
              <option value="2">2★ & up</option>
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-xs text-white focus:border-nexus-500 min-w-[110px]"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="rating">Rating</option>
          </select>

          {/* In stock */}
          <button
            type="button"
            onClick={() => {
              setInStockOnly((v) => !v);
              setPage(0);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition whitespace-nowrap ${
              inStockOnly
                ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${inStockOnly ? 'text-emerald-400' : ''}`} />
            In stock
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Products — 2 per row */}
      <div className="space-y-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-80 bg-slate-900/60 rounded-2xl animate-pulse border border-slate-800"
              />
            ))}
          </div>
        ) : searchResult?.content?.length === 0 ? (
          <div className="glass-card p-10 rounded-2xl border border-slate-800 text-center space-y-3">
            <PackageX className="w-10 h-10 text-rose-400 mx-auto opacity-80" />
            <h3 className="text-base font-bold text-white">No products found</h3>
            <p className="text-xs text-slate-400">Try different filters or clear them.</p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-[11px] font-mono text-slate-500">
              {page + 1} / {searchResult.totalPages}
            </span>
            <button
              disabled={page >= searchResult.totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
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

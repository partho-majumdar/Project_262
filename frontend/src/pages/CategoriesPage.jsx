import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, 
  ArrowRight, 
  Sparkles, 
  Search, 
  Smartphone,
  Laptop,
  Footprints,
  ShoppingBag,
  Camera,
  Headphones,
  Car,
  Utensils,
  BookOpen,
  Gamepad2,
  Watch,
  Heart,
  Package,
  Tv,
  Shirt
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fallback visual mapping to guarantee unique HD images for every category
  const UNIQUE_IMAGE_MAP = {
    'electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&auto=format&fit=crop',
    'mobiles': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop',
    'laptops': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop',
    'fashion': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop',
    'clothing': 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&auto=format&fit=crop',
    'shoes': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop',
    'sports': 'https://images.unsplash.com/photo-1517649763962-0c623266010b?w=800&auto=format&fit=crop',
    'home-kitchen': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop',
    'beauty': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop',
    'books': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop',
    'toys': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop',
    'automotive': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop',
    'grocery': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop',
    'audio-headphones': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop',
    'ai-gaming-gear': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop',
    'smart-watches': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop',
    'cameras-photography': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop'
  };

  const getCategoryIcon = (slug, name) => {
    const s = (slug || name || '').toLowerCase();
    if (s.includes('mobile') || s.includes('phone')) return <Smartphone className="w-5 h-5 text-indigo-400" />;
    if (s.includes('laptop') || s.includes('computer')) return <Laptop className="w-5 h-5 text-nexus-400" />;
    if (s.includes('shoe') || s.includes('footwear')) return <Footprints className="w-5 h-5 text-rose-400" />;
    if (s.includes('cloth') || s.includes('fashion') || s.includes('apparel')) return <Shirt className="w-5 h-5 text-purple-400" />;
    if (s.includes('camera') || s.includes('photo')) return <Camera className="w-5 h-5 text-amber-400" />;
    if (s.includes('headphone') || s.includes('audio')) return <Headphones className="w-5 h-5 text-emerald-400" />;
    if (s.includes('car') || s.includes('auto')) return <Car className="w-5 h-5 text-blue-400" />;
    if (s.includes('kitchen') || s.includes('home')) return <Utensils className="w-5 h-5 text-orange-400" />;
    if (s.includes('book')) return <BookOpen className="w-5 h-5 text-cyan-400" />;
    if (s.includes('gaming') || s.includes('toy')) return <Gamepad2 className="w-5 h-5 text-fuchsia-400" />;
    if (s.includes('watch')) return <Watch className="w-5 h-5 text-teal-400" />;
    if (s.includes('beauty')) return <Sparkles className="w-5 h-5 text-pink-400" />;
    return <Layers className="w-5 h-5 text-slate-400" />;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get('/categories');
        setCategories(response.data || []);
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const getCategoryImage = (cat) => {
    if (cat?.imageUrl && !cat.imageUrl.includes('photo-1542291026-7eec264c27ff')) {
      return cat.imageUrl;
    }
    const slugKey = (cat?.slug || cat?.name || '').toLowerCase().replaceAll('[^a-z0-9]', '-');
    for (const key in UNIQUE_IMAGE_MAP) {
      if (slugKey.includes(key)) {
        return UNIQUE_IMAGE_MAP[key];
      }
    }
    return cat?.imageUrl || UNIQUE_IMAGE_MAP['electronics'];
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Header Banner */}
      <div className="relative glass-panel p-8 sm:p-12 rounded-3xl overflow-hidden text-center space-y-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-nexus-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950/80 border border-nexus-500/30 text-nexus-400 text-xs font-semibold relative z-10">
          <Layers className="w-3.5 h-3.5 text-nexus-400" /> Platform Taxonomy
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight relative z-10">
          Explore Product <span className="bg-gradient-to-r from-nexus-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Categories</span>
        </h1>

        <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed relative z-10">
          Discover curated collections across Electronics, Mobiles, Laptops, Fashion, Clothing, Shoes, Sports, Beauty, Books, Toys, Automotive, and Grocery.
        </p>

        {/* Search filter bar */}
        <div className="max-w-md mx-auto pt-4 relative z-10">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category (e.g., 'Shoes', 'Mobiles', 'Laptops')..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-nexus-500 shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Category Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="h-64 bg-slate-900/60 rounded-3xl animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No categories found matching "{searchQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCategories.map((category) => {
            const cardImg = getCategoryImage(category);
            const cardIcon = getCategoryIcon(category.slug, category.name);

            return (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                className="glass-card rounded-3xl overflow-hidden border border-slate-800 flex flex-col justify-between group hover:border-nexus-500/80 hover:shadow-2xl hover:shadow-nexus-500/10 transition-all duration-300"
              >
                {/* Category Image Header */}
                <div className="h-44 relative bg-slate-900 overflow-hidden">
                  <img
                    src={cardImg}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  
                  {/* Floating Category Icon Badge */}
                  <div className="absolute top-3 right-3 p-2 bg-slate-950/80 border border-slate-800 rounded-xl backdrop-blur-md shadow-md">
                    {cardIcon}
                  </div>

                  <div className="absolute bottom-3 left-4 right-4">
                    <h2 className="text-lg font-extrabold text-white tracking-tight group-hover:text-nexus-400 transition-colors">
                      {category.name}
                    </h2>
                  </div>
                </div>

                {/* Description & CTAs */}
                <div className="p-5 space-y-3 flex-grow flex flex-col justify-between">
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {category.description || `Browse top-rated products in ${category.name}.`}
                  </p>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Package className="w-3 h-3 text-indigo-400" /> Explore Catalog
                    </span>
                    <span className="inline-flex items-center gap-1 text-nexus-400 font-bold text-xs group-hover:translate-x-1 transition-transform">
                      Browse <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}

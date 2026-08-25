import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Layers, ShoppingBag, Sparkles, Star, Heart } from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function CategoryDetailPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCategoryDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const catRes = await axiosClient.get(`/categories/${slug}`);
        setCategory(catRes.data);

        const prodRes = await axiosClient.get(`/products/category/${slug}`);
        setProducts(prodRes.data);
      } catch (err) {
        setError(err.message || 'Category not found');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryDetails();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading category details & products...
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Category not found'}
        </div>
        <Link to="/categories" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/" className="hover:text-white">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to="/categories" className="hover:text-white">Categories</Link>
        {category.parentCategoryName && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-400">{category.parentCategoryName}</span>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-nexus-400 font-semibold">{category.name}</span>
      </nav>

      {/* Category Hero Banner */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-3 max-w-xl z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" /> Product Category
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{category.name}</h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {category.description || 'Discover curated high quality enterprise products.'}
          </p>
        </div>

        {category.imageUrl && (
          <div className="w-full md:w-64 h-40 rounded-2xl overflow-hidden border border-slate-800 shrink-0">
            <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Subcategories pills */}
      {category.subCategories && category.subCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Subcategories in {category.name}</h3>
          <div className="flex flex-wrap gap-2">
            {category.subCategories.map((sub) => (
              <Link
                key={sub.id}
                to={`/categories/${sub.slug}`}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-nexus-500 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-nexus-400" /> {sub.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Live Category Products Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-nexus-400" /> Available Products ({products.length})
          </h3>
        </div>

        {products.length === 0 ? (
          <div className="glass-card p-12 rounded-3xl text-center space-y-3 border border-slate-800">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white">No products currently listed in this category</p>
            <p className="text-xs text-slate-400">Check back soon as merchants list new items!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="glass-card rounded-3xl overflow-hidden border border-slate-800 flex flex-col justify-between group hover:border-nexus-500/60 transition-all duration-300"
              >
                <div className="h-44 bg-slate-900 relative overflow-hidden">
                  <img
                    src={product.imageUrls?.[0] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.compareAtPrice && product.compareAtPrice > product.price && (
                    <span className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                      SALE
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
                  <div className="space-y-1">
                    <Link to={`/products/${product.slug}`} className="block">
                      <h4 className="font-bold text-white text-sm hover:text-nexus-400 transition-colors line-clamp-1">
                        {product.name}
                      </h4>
                    </Link>
                    <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">${product.price.toFixed(2)}</span>
                    <Link
                      to={`/products/${product.slug}`}
                      className="px-3 py-1.5 bg-nexus-600 hover:bg-nexus-500 text-white text-xs font-semibold rounded-xl"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

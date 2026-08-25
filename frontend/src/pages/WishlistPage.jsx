import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { 
  Heart, 
  Trash2, 
  ShoppingCart, 
  ArrowRight, 
  Star, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { fetchCart } = useCart();

  const fetchWishlist = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get('/wishlist');
      setWishlist(response.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = async (productId) => {
    try {
      const response = await axiosClient.delete(`/wishlist/items/${productId}`);
      setWishlist(response.data);
    } catch (err) {
      alert(err.message || 'Failed to remove product from wishlist');
    }
  };

  const handleMoveToCart = async (productId) => {
    try {
      await axiosClient.post(`/wishlist/items/${productId}/move-to-cart`);
      await fetchCart();
      await fetchWishlist();
      alert('Product moved to your shopping cart!');
    } catch (err) {
      alert(err.message || 'Failed to move product to cart');
    }
  };

  const handleClearWishlist = async () => {
    try {
      const response = await axiosClient.delete('/wishlist/clear');
      setWishlist(response.data);
    } catch (err) {
      alert(err.message || 'Failed to clear wishlist');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading saved wishlist items...
      </div>
    );
  }

  if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="glass-panel p-10 rounded-3xl space-y-4 border border-slate-800">
          <div className="w-16 h-16 bg-nexus-950/80 border border-nexus-500/40 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Your Wishlist is Empty</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Save items you like to track prices and move them to your cart whenever you are ready.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-nexus-600/30 text-xs transition-all"
          >
            Explore Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-400 fill-rose-400/20" /> My Saved Wishlist
            <span className="text-xs bg-rose-950 border border-rose-800 text-rose-300 px-2.5 py-0.5 rounded-full font-semibold">
              {wishlist.totalItems} Saved Items
            </span>
          </h1>
          <p className="text-xs text-slate-400">Save products to review later or transfer directly to your cart</p>
        </div>

        <button
          onClick={handleClearWishlist}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 font-semibold hover:underline w-fit"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Wishlist
        </button>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {wishlist.items.map((item) => (
          <div
            key={item.id}
            className="glass-card rounded-3xl overflow-hidden border border-slate-800 flex flex-col justify-between group hover:border-nexus-500/60 transition-all duration-300 relative"
          >
            <button
              onClick={() => handleRemove(item.productId)}
              className="absolute top-3 right-3 p-2 bg-slate-950/70 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-full border border-slate-800 transition-colors z-10"
              title="Remove from Wishlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="h-44 bg-slate-900 relative overflow-hidden">
              <img
                src={item.imageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop'}
                alt={item.productName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-nexus-400 uppercase tracking-wider">
                  {item.categoryName}
                </span>
                <Link to={`/products/${item.productSlug}`} className="block">
                  <h4 className="font-bold text-white text-sm hover:text-nexus-400 transition-colors line-clamp-1">
                    {item.productName}
                  </h4>
                </Link>
                <div className="flex items-center gap-2 text-xs pt-1">
                  <span className="text-base font-extrabold text-white">${item.price.toFixed(2)}</span>
                  {item.inStock ? (
                    <span className="text-emerald-400 text-[10px] font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> In Stock
                    </span>
                  ) : (
                    <span className="text-rose-400 text-[10px] font-semibold flex items-center gap-0.5">
                      <XCircle className="w-3 h-3" /> Out of Stock
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleMoveToCart(item.productId)}
                disabled={!item.inStock}
                className="w-full inline-flex items-center justify-center gap-2 bg-nexus-600 hover:bg-nexus-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all disabled:opacity-40"
              >
                <ShoppingCart className="w-4 h-4" /> Move to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Star, 
  ShoppingBag, 
  Heart, 
  Eye, 
  Scale, 
  Store, 
  ShieldCheck,
  Check
} from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function ProductCard({ product, onQuickView, onCompare }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);

  // Fallback high-res image if URL is missing, invalid, or fails to load
  const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop';

  // Determine initial image URL
  const primaryImage = (!imgError && product?.imageUrls?.length > 0 && product.imageUrls[0])
    ? product.imageUrls[0]
    : (!imgError && product?.imageUrl)
    ? product.imageUrl
    : DEFAULT_PLACEHOLDER;

  const discountPercent = (product?.compareAtPrice && product?.price && product.compareAtPrice > product.price)
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    navigate('/checkout');
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 p-4 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between group h-full">
      <div className="space-y-3">
        
        {/* Product Image Container with Fallback Handler */}
        <div className="h-52 bg-slate-900 rounded-2xl overflow-hidden relative">
          <img
            src={primaryImage}
            alt={product?.name || 'Nexus Product'}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Discount Badge */}
          {discountPercent && (
            <span className="absolute top-3 left-3 px-2 py-0.5 bg-rose-950/90 border border-rose-800 text-rose-300 font-mono font-bold text-[10px] rounded-full shadow-md">
              {discountPercent}% OFF
            </span>
          )}

          {/* Stock Status Badge */}
          <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-slate-950/80 border border-slate-800 text-emerald-400 font-mono text-[9px] font-bold rounded-lg backdrop-blur-sm">
            {product?.stockQuantity > 0 ? 'In Stock' : 'Limited Stock'}
          </span>

          {/* Wishlist Bookmark Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsWishlisted(!isWishlisted);
            }}
            className="absolute top-3 right-3 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-full text-slate-300 transition shadow-md"
            title="Add to Wishlist"
          >
            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>

          {/* Quick Action Overlay Icons */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-slate-800">
            {onQuickView && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onQuickView(product);
                }}
                className="p-1.5 text-slate-300 hover:text-nexus-400 transition"
                title="Quick View"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            {onCompare && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onCompare(product);
                }}
                className="p-1.5 text-slate-300 hover:text-emerald-400 transition"
                title="Compare Product"
              >
                <Scale className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Product Metadata */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span className="font-bold text-nexus-400 uppercase tracking-wider">{product?.brandName || product?.brand?.name || product?.brand || 'NEXUS'}</span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {product?.rating ? product.rating.toFixed(1) : '4.9'} ({product?.reviewCount || 120})
            </span>
          </div>

          <Link
            to={`/products/${product?.slug || product?.id}`}
            className="font-bold text-white text-xs line-clamp-1 group-hover:text-nexus-400 transition-colors block"
          >
            {product?.name || 'Untitled Product'}
          </Link>

          {/* Category & Seller Store Badges */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span className="truncate max-w-[120px] text-indigo-300 font-semibold">{product?.categoryName || product?.category?.name || 'Electronics'}</span>
            <span className="text-slate-500 flex items-center gap-1 truncate max-w-[110px]">
              <Store className="w-2.5 h-2.5 text-emerald-400" /> {product?.sellerStoreName || 'Nexus Store'}
            </span>
          </div>
        </div>
      </div>

      {/* Pricing & Action CTAs */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-extrabold text-emerald-400">${product?.price ? product.price.toFixed(2) : '0.00'}</span>
            {product?.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-[10px] text-slate-500 line-through">${product.compareAtPrice.toFixed(2)}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddToCart}
            className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
              added 
                ? 'bg-emerald-950 border-emerald-800 text-emerald-300' 
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            {added ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ShoppingBag className="w-3.5 h-3.5 text-nexus-400" />}
            {added ? 'Added' : 'Add'}
          </button>

          <button
            onClick={handleBuyNow}
            className="py-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-nexus-600/30"
          >
            Buy Now
          </button>
        </div>
      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Star,
  ShoppingBag,
  Heart,
  Eye,
  Scale,
  Store,
  Check,
  ImageOff,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';

export default function ProductCard({ product, onQuickView, onCompare }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);

  const primaryImage =
    !imgError && product?.imageUrls?.length > 0
      ? product.imageUrls[0]
      : !imgError && product?.imageUrl
        ? product.imageUrl
        : null;

  const discountPercent =
    product?.compareAtPrice != null &&
    product?.price != null &&
    Number(product.compareAtPrice) > Number(product.price)
      ? Math.round(
          ((Number(product.compareAtPrice) - Number(product.price)) /
            Number(product.compareAtPrice)) *
            100
        )
      : null;

  const rating =
    product?.rating != null && product.rating !== '' ? Number(product.rating) : null;
  const reviewCount =
    product?.reviewCount != null ? Number(product.reviewCount) : null;

  const brand =
    product?.brandName || product?.brand?.name || product?.brand || null;
  const category =
    product?.categoryName || product?.category?.name || product?.category || null;
  const sellerStore =
    product?.sellerStoreName ||
    product?.sellerStore?.storeName ||
    product?.storeName ||
    null;

  const price = product?.price != null ? Number(product.price) : null;
  const compareAt =
    product?.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const inStock = (product?.stockQuantity ?? 0) > 0;
  const productId = product?.id;

  // Load wishlist state from API when logged in
  useEffect(() => {
    if (!isAuthenticated || !productId) {
      setIsWishlisted(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/wishlist');
        const data = res.data?.data ?? res.data;
        const items = data?.items || [];
        if (!cancelled) {
          setIsWishlisted(
            items.some((i) => i.productId === productId || i.product?.id === productId)
          );
        }
      } catch {
        if (!cancelled) setIsWishlisted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, productId]);

  const handleToggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!productId) return;
    if (!isAuthenticated) {
      alert('Please log in to use wishlist');
      return;
    }
    setWishlistLoading(true);
    try {
      if (isWishlisted) {
        await axiosClient.delete(`/wishlist/items/${productId}`);
        setIsWishlisted(false);
      } else {
        await axiosClient.post(`/wishlist/items/${productId}`);
        setIsWishlisted(true);
      }
    } catch (err) {
      alert(err?.message || 'Wishlist update failed');
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!productId || !inStock) return;
    try {
      await addToCart(productId, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      alert(err?.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!productId || !inStock) return;
    try {
      await addToCart(productId, 1);
      navigate('/checkout');
    } catch (err) {
      alert(err?.message || 'Failed to add to cart');
    }
  };

  return (
    <div className="glass-card rounded-3xl border border-slate-800 p-4 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between group h-full">
      <div className="space-y-3">
        <div className="h-52 bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-800/80">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product?.name || 'Product'}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
              <ImageOff className="w-8 h-8 opacity-50" />
              <span className="text-[10px] font-medium">No image</span>
            </div>
          )}

          {discountPercent != null && (
            <span className="absolute top-3 left-3 px-2 py-0.5 bg-rose-950/90 border border-rose-800 text-rose-300 font-mono font-bold text-[10px] rounded-full shadow-md">
              {discountPercent}% OFF
            </span>
          )}

          <span
            className={`absolute bottom-3 left-3 px-2 py-0.5 bg-slate-950/80 border border-slate-800 font-mono text-[9px] font-bold rounded-lg backdrop-blur-sm ${
              inStock ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>

          <button
            onClick={handleToggleWishlist}
            disabled={wishlistLoading}
            className="absolute top-3 right-3 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-full text-slate-300 transition shadow-md disabled:opacity-50"
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`}
            />
          </button>

          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-slate-800">
            {onQuickView && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
                  e.stopPropagation();
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

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 gap-2">
            {brand ? (
              <span className="font-bold text-nexus-400 uppercase tracking-wider truncate">
                {brand}
              </span>
            ) : (
              <span />
            )}

            {rating != null ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
                {reviewCount != null && (
                  <span className="text-slate-500 font-medium">({reviewCount})</span>
                )}
              </span>
            ) : (
              <span className="text-slate-500 font-medium shrink-0">No ratings yet</span>
            )}
          </div>

          <Link
            to={`/products/${product?.slug || product?.id}`}
            className="font-bold text-white text-xs line-clamp-2 group-hover:text-nexus-400 transition-colors block"
          >
            {product?.name || 'Untitled product'}
          </Link>

          {(category || sellerStore) && (
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 gap-2">
              {category ? (
                <span className="truncate max-w-[50%] text-indigo-300 font-semibold">
                  {category}
                </span>
              ) : (
                <span />
              )}
              {sellerStore && (
                <span className="text-slate-500 flex items-center gap-1 truncate max-w-[50%]">
                  <Store className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  {sellerStore}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/80 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-extrabold text-emerald-400">
            {price != null ? `$${price.toFixed(2)}` : '—'}
          </span>
          {compareAt != null && price != null && compareAt > price && (
            <span className="text-[10px] text-slate-500 line-through">
              ${compareAt.toFixed(2)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddToCart}
            disabled={!inStock}
            className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border disabled:opacity-40 disabled:cursor-not-allowed ${
              added
                ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            {added ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ShoppingBag className="w-3.5 h-3.5 text-nexus-400" />
            )}
            {added ? 'Added' : 'Add'}
          </button>

          <button
            onClick={handleBuyNow}
            disabled={!inStock}
            className="py-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-nexus-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

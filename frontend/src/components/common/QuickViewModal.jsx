import React, { useState, useEffect } from 'react';
import { X, Star, ShoppingCart, CheckCircle2, ImageOff, Heart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';

export default function QuickViewModal({ isOpen, onClose, product }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setQuantity(1);
      setSelectedImageIndex(0);
      setAddedMessage(false);
    }
  }, [isOpen, product?.id]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !product?.id) {
      setWishlisted(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/wishlist');
        const data = res.data?.data ?? res.data;
        const items = data?.items || [];
        if (!cancelled) {
          setWishlisted(
            items.some((i) => i.productId === product.id || i.product?.id === product.id)
          );
        }
      } catch {
        if (!cancelled) setWishlisted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAuthenticated, product?.id]);

  if (!isOpen || !product) return null;

  const images = Array.isArray(product.imageUrls)
    ? product.imageUrls.filter(Boolean)
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  const rating = product.rating != null ? Number(product.rating) : null;
  const reviewCount = product.reviewCount != null ? Number(product.reviewCount) : null;
  const price = product.price != null ? Number(product.price) : null;
  const compareAt =
    product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const stock = product.stockQuantity != null ? Number(product.stockQuantity) : 0;
  const inStock = stock > 0;

  const handleAddToCart = async () => {
    if (!product.id || !inStock) return;
    try {
      await addToCart(product.id, quantity);
      setAddedMessage(true);
      setTimeout(() => {
        setAddedMessage(false);
        onClose();
      }, 1000);
    } catch (err) {
      alert(err.message || 'Failed to add to cart');
    }
  };

  const handleToggleWishlist = async () => {
    if (!product.id) return;
    if (!isAuthenticated) {
      alert('Please log in to use wishlist');
      return;
    }
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await axiosClient.delete(`/wishlist/items/${product.id}`);
        setWishlisted(false);
      } else {
        await axiosClient.post(`/wishlist/items/${product.id}`);
        setWishlisted(true);
      }
    } catch (err) {
      alert(err.message || 'Wishlist update failed');
    } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-3xl p-6 sm:p-8 rounded-3xl space-y-6 relative border border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="h-64 sm:h-80 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative">
              {images[selectedImageIndex] ? (
                <img
                  src={images[selectedImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                  <ImageOff className="w-8 h-8 opacity-50" />
                  <span className="text-xs">No image</span>
                </div>
              )}
              {product.categoryName && (
                <span className="absolute top-3 left-3 px-2.5 py-1 bg-nexus-950/90 border border-nexus-800 text-nexus-300 text-[10px] font-extrabold uppercase rounded-full">
                  {product.categoryName}
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border transition shrink-0 ${
                      selectedImageIndex === idx
                        ? 'border-nexus-500 ring-2 ring-nexus-500/50'
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                {rating != null ? (
                  <>
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-bold text-white">{rating.toFixed(1)}</span>
                    {reviewCount != null && (
                      <span className="text-slate-500">({reviewCount})</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500">No ratings yet</span>
                )}
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">{product.name}</h2>
                {product.sku && (
                  <p className="text-[11px] text-slate-500 font-mono">SKU: {product.sku}</p>
                )}
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-emerald-400">
                  {price != null ? `$${price.toFixed(2)}` : '—'}
                </span>
                {compareAt != null && price != null && compareAt > price && (
                  <span className="text-xs text-slate-500 line-through">
                    ${compareAt.toFixed(2)}
                  </span>
                )}
              </div>

              {product.description && (
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {product.description}
                </p>
              )}

              <p className="text-[11px]">
                {inStock ? (
                  <span className="text-emerald-400 font-semibold">In stock ({stock})</span>
                ) : (
                  <span className="text-rose-400 font-semibold">Out of stock</span>
                )}
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-slate-400 hover:text-white font-bold"
                  >
                    -
                  </button>
                  <span className="px-3 py-2 text-xs font-bold text-white font-mono">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={!inStock}
                    className="px-3 py-2 text-slate-400 hover:text-white font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={addedMessage || !inStock}
                  className="flex-1 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {addedMessage ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Added
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" /> Add to Cart
                    </>
                  )}
                </button>

                <button
                  onClick={handleToggleWishlist}
                  disabled={wishlistLoading}
                  className={`p-2.5 border rounded-xl transition ${
                    wishlisted
                      ? 'bg-rose-950/50 border-rose-700 text-rose-400'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-rose-400'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-500' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

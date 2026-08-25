import React, { useState } from 'react';
import { X, Star, ShoppingCart, Heart, ShieldCheck, Truck, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function QuickViewModal({ isOpen, onClose, product }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState(false);
  const { addToCart } = useCart();

  if (!isOpen || !product) return null;

  const images = product.imageUrls && product.imageUrls.length > 0 
    ? product.imageUrls 
    : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop'];

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAddedMessage(true);
    setTimeout(() => {
      setAddedMessage(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-3xl p-6 sm:p-8 rounded-3xl space-y-6 relative border border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left: Product Images */}
          <div className="space-y-4">
            <div className="h-64 sm:h-80 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative group">
              <img
                src={images[selectedImageIndex]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute top-3 left-3 px-2.5 py-1 bg-nexus-950/90 border border-nexus-800 text-nexus-300 text-[10px] font-extrabold uppercase rounded-full">
                {product.categoryName || 'Flagship Item'}
              </span>
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border transition shrink-0 ${
                      selectedImageIndex === idx ? 'border-nexus-500 ring-2 ring-nexus-500/50' : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Meta & Add to Cart */}
          <div className="space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              
              {/* Rating */}
              <div className="flex items-center gap-2 text-amber-400 text-xs">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.floor(product.rating || 4.5) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                    />
                  ))}
                </div>
                <span className="font-bold text-white text-xs">{product.rating || 4.8}</span>
                <span className="text-slate-500">• ({product.reviewCount || 120} reviews)</span>
              </div>

              {/* Title & SKU */}
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">{product.name}</h2>
                <p className="text-[11px] text-slate-500 font-mono">SKU: {product.sku || 'NEX-8840'}</p>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-emerald-400">${product.price?.toFixed(2)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="text-xs text-slate-500 line-through">${product.compareAtPrice?.toFixed(2)}</span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                {product.description || 'Enterprise high-performance hardware featuring industry-leading build quality, AI integration, and 2-year warranty.'}
              </p>

              {/* Highlights */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 2-Year Enterprise Warranty
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-nexus-400" /> Free Express Shipping
                </div>
              </div>

            </div>

            {/* Quantity Selector & CTA Buttons */}
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
                    className="px-3 py-2 text-slate-400 hover:text-white font-bold"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={addedMessage}
                  className="flex-1 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                >
                  {addedMessage ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Added to Cart!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" /> Add to Cart
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

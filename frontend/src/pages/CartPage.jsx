import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { 
  ShoppingCart, 
  Trash2, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  Tag, 
  ShoppingBag,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function CartPage() {
  const { cart, loading, updateQuantity, removeFromCart, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const navigate = useNavigate();

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim() || !cart) return;

    setValidatingCoupon(true);
    setCouponError('');
    try {
      const response = await axiosClient.post('/coupons/validate', {
        code: couponCode.trim(),
        subtotal: cart.subtotalAmount,
      });

      if (response.data.valid) {
        setAppliedCoupon(response.data);
        setCouponCode('');
      } else {
        setCouponError(response.data.message || 'Invalid coupon code');
      }
    } catch (err) {
      setCouponError(err.message || 'Failed to validate promo code');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeAppliedCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading shopping cart...
      </div>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="glass-panel p-10 rounded-3xl space-y-4 border border-slate-800">
          <div className="w-16 h-16 bg-nexus-950/80 border border-nexus-500/40 text-nexus-400 rounded-2xl flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Your Cart is Empty</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Looks like you haven't added any products to your cart yet. Explore our enterprise catalog!
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-nexus-600/30 text-xs transition-all"
          >
            Browse Products Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Prefer backend values when available — no hardcoded business rules
  const discountAmount = appliedCoupon ? Number(appliedCoupon.calculatedDiscount || 0) : 0;
  const subtotal = Number(cart.subtotalAmount || 0);
  const finalSubtotal = Math.max(0, subtotal - discountAmount);

  const taxRate = cart.taxRate != null ? Number(cart.taxRate) : 0.08;
  const finalTax = cart.taxAmount != null
    ? Number(cart.taxAmount)
    : finalSubtotal * taxRate;

  const freeShippingThreshold = cart.freeShippingThreshold != null
    ? Number(cart.freeShippingThreshold)
    : 100;

  const shippingFee = cart.shippingAmount != null
    ? Number(cart.shippingAmount)
    : (finalSubtotal >= freeShippingThreshold || cart.totalItems === 0 ? 0 : 15);

  const finalTotalAmount = cart.totalAmount != null && !appliedCoupon
    ? Number(cart.totalAmount)
    : finalSubtotal + finalTax + shippingFee;

  const progressPercentage = Math.min(100, (finalSubtotal / freeShippingThreshold) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-nexus-400" /> Shopping Cart
            <span className="text-xs bg-nexus-950 border border-nexus-800 text-nexus-300 px-2.5 py-0.5 rounded-full font-semibold">
              {cart.totalItems} Items
            </span>
          </h1>
          <p className="text-xs text-slate-400">Review line items, apply promotional discount coupons, and prepare for checkout</p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 font-semibold hover:underline w-fit"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Cart
        </button>
      </div>

      {/* Free Shipping Progress Indicator */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 flex items-center gap-1.5 font-medium">
            <Truck className="w-4 h-4 text-nexus-400" />
            {finalSubtotal >= freeShippingThreshold ? (
              <span className="text-emerald-400 font-bold">You qualify for FREE Express Shipping!</span>
            ) : (
              <span>Add ${(freeShippingThreshold - finalSubtotal).toFixed(2)} more to qualify for <strong>FREE Shipping</strong></span>
            )}
          </span>
          <span className="text-slate-400 font-bold">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-nexus-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Cart Line Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="glass-card p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-20 h-20 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                  <img
                    src={item.imageUrl || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=300&auto=format&fit=crop'}
                    alt={item.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <Link to={`/products/${item.productSlug}`} className="font-bold text-white text-sm hover:text-nexus-400 transition-colors line-clamp-1">
                    {item.productName}
                  </Link>
                  <p className="text-[11px] text-slate-500 font-mono">SKU: {item.productSku}</p>
                  <p className="text-xs text-nexus-400 font-semibold">${Number(item.unitPrice).toFixed(2)} each</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                {/* Quantity Controls */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
                  <button
                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    className="text-slate-400 hover:text-white px-2 font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-bold text-white">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stockAvailable}
                    className="text-slate-400 hover:text-white px-2 font-bold text-sm disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                <div className="text-right">
                  <p className="text-base font-extrabold text-white">${Number(item.subtotal).toFixed(2)}</p>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                  title="Remove Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Order Summary Box & Promo Codes */}
        <div className="space-y-6">
          
          {/* Promo Code Input Box */}
          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Tag className="w-4 h-4 text-nexus-400" /> Apply Promotional Coupon
            </h4>

            {appliedCoupon ? (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-2xl flex items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" /> Code: {appliedCoupon.code}
                  </div>
                  <p className="text-[11px] text-emerald-400/80">
                    Saving ${Number(appliedCoupon.calculatedDiscount || 0).toFixed(2)} off your subtotal
                  </p>
                </div>
                <button onClick={removeAppliedCoupon} className="text-slate-400 hover:text-rose-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter promo code"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 uppercase focus:border-nexus-500"
                  />
                  <button
                    type="submit"
                    disabled={validatingCoupon || !couponCode.trim()}
                    className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {couponError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {couponError}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Summary Box */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-nexus-400" /> Order Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({cart.totalItems} items)</span>
                <span className="font-semibold text-slate-200">${subtotal.toFixed(2)}</span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Promo Discount ({appliedCoupon.code})</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400">
                <span>Estimated Tax {taxRate ? `(${(taxRate * 100).toFixed(0)}%)` : ''}</span>
                <span className="font-semibold text-slate-200">${finalTax.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Shipping Fee</span>
                <span className="font-semibold text-slate-200">
                  {shippingFee === 0 ? <span className="text-emerald-400 font-bold uppercase">FREE</span> : `$${shippingFee.toFixed(2)}`}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline text-sm">
                <span className="font-bold text-white">Total Amount</span>
                <span className="text-xl font-extrabold text-white">${finalTotalAmount.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-nexus-600/30 text-xs transition-all"
            >
              Proceed to Secure Checkout <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 256-Bit Encrypted Secure Checkout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
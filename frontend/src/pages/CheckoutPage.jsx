import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import {
  MapPin,
  Truck,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import AddressSelectorModal from '../components/common/AddressSelectorModal';

export default function CheckoutPage() {
  const { cart, fetchCart } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [shippingMethods, setShippingMethods] = useState([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('STD_GROUND');

  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [paymentIntent, setPaymentIntent] = useState(null);

  // Empty defaults — no simulated card numbers
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    const initAddressAndShipping = async () => {
      try {
        const addrRes = await axiosClient.get('/users/addresses');
        if (addrRes.data?.length > 0) {
          const defaultAddr = addrRes.data.find((a) => a.isDefault) || addrRes.data[0];
          setSelectedAddress(defaultAddr);
        }
        const subtotal = cart ? Number(cart.subtotalAmount ?? 0) : 0;
        const shipRes = await axiosClient.get('/shipping/methods', {
          params: { subtotal }
        });
        setShippingMethods(shipRes.data || []);
      } catch (err) {
        console.error('Checkout initialization failed', err);
      }
    };
    initAddressAndShipping();
  }, [cart]);

  const handleCreatePaymentIntent = async () => {
    if (!cart) return;
    if (
      paymentMethod === 'CREDIT_CARD' &&
      (!cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim())
    ) {
      alert('Please enter card details');
      return;
    }
    try {
      const response = await axiosClient.post('/payments/create-intent', {
        amount: getCurrentTotal(),
        paymentMethod,
      });
      setPaymentIntent(response.data);
      setStep(4);
    } catch (err) {
      alert(err.message || 'Failed to initialize payment gateway intent');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      alert('Please select a valid delivery address');
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const response = await axiosClient.post('/orders/checkout', {
        addressId: selectedAddress.id,
        paymentMethod,
        shippingOptionId: selectedShippingMethod,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
      });

      if (paymentIntent?.transactionId && paymentMethod !== 'CASH_ON_DELIVERY') {
        await axiosClient.post('/payments/webhook', {
          transactionId: paymentIntent.transactionId,
          status: 'COMPLETED',
          gatewayEvent: 'charge.succeeded',
          payload: `Payment authorized via ${paymentMethod} for Order ${response.data.orderNumber}`,
        });
      }

      await fetchCart();
      navigate(`/orders/confirmation/${response.data.orderNumber}`);
    } catch (err) {
      alert(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentSubtotal = () => Number(cart?.subtotalAmount ?? 0);

  const getCurrentDiscount = () => (appliedCoupon ? couponDiscount : 0);

  const getCurrentTax = () => {
    const subtotal = getCurrentSubtotal();
    const discount = getCurrentDiscount();
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const taxRate = Number(cart?.taxRate ?? 0.08);
    return discountedSubtotal * taxRate;
  };

  const getCurrentShipping = () => {
    const selectedMethod = shippingMethods.find((m) => m.id === selectedShippingMethod);
    if (selectedMethod) {
      return Number(selectedMethod.rate);
    }
    const subtotal = getCurrentSubtotal();
    const discount = getCurrentDiscount();
    const discountedSubtotal = Math.max(0, subtotal - discount);
    if (discountedSubtotal >= 100) return 0;
    return Number(cart?.shippingAmount ?? 15);
  };

  const getCurrentTotal = () => {
    const subtotal = getCurrentSubtotal();
    const discount = getCurrentDiscount();
    const discountedSubtotal = Math.max(0, subtotal - discount);
    return discountedSubtotal + getCurrentTax() + getCurrentShipping();
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !cart) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const subtotal = getCurrentSubtotal();
      const apiResponse = await axiosClient.post('/coupons/validate', {
        code: couponCode.trim(),
        subtotal,
      });
      const result = apiResponse.data;
      if (result && result.valid) {
        setAppliedCoupon(result);
        setCouponDiscount(Number(result.calculatedDiscount || 0));
        const discountedSubtotal = Math.max(0, subtotal - Number(result.calculatedDiscount || 0));
        const shipRes = await axiosClient.get('/shipping/methods', {
          params: { subtotal: discountedSubtotal }
        });
        setShippingMethods(shipRes.data || []);
        setCouponCode('');
      } else {
        setCouponError('Invalid or expired coupon code');
      }
    } catch (err) {
      setCouponError(err.message || 'Failed to apply coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError('');
    const subtotal = getCurrentSubtotal();
    try {
      const shipRes = await axiosClient.get('/shipping/methods', {
        params: { subtotal }
      });
      setShippingMethods(shipRes.data || []);
    } catch (err) {
      console.error('Failed to refresh shipping methods', err);
    }
  };

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 text-xs">
          Your cart is empty. Add products before checking out.
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Catalog
        </Link>
      </div>
    );
  }

  const taxLabel =
    cart.taxRate != null ? ` (${(Number(cart.taxRate) * 100).toFixed(0)}%)` : '';
  const subtotalDisplay = Number(cart.subtotalAmount ?? 0).toFixed(2);
  const taxDisplay = getCurrentTax().toFixed(2);
  const shippingDisplay = getCurrentShipping().toFixed(2);
  const totalDisplay = getCurrentTotal().toFixed(2);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" /> Enterprise Secure Checkout
          </h1>
          <p className="text-xs text-slate-400">
            Complete your shipping, delivery method, and payment authorization
          </p>
        </div>
        <Link
          to="/cart"
          className="text-xs text-nexus-400 hover:underline flex items-center gap-1 font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Cart
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto">
        {[
          { n: 1, icon: MapPin, label: '1. Address' },
          { n: 2, icon: Truck, label: '2. Shipping' },
          { n: 3, icon: CreditCard, label: '3. Payment' },
          { n: 4, icon: ShieldCheck, label: '4. Review' },
        ].map(({ n, icon: Icon, label }) => (
          <div
            key={n}
            className={`p-3 rounded-2xl border text-center transition-all ${
              step >= n
                ? 'bg-nexus-950/80 border-nexus-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <Icon className={`w-4 h-4 mx-auto mb-1 ${n === 4 ? 'text-emerald-400' : 'text-nexus-400'}`} />
            <span className="text-[11px] font-bold block">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-nexus-400" /> Select Delivery Destination Address
              </h3>

              {selectedAddress ? (
                <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{selectedAddress.addressLine1}</span>
                    <button
                      onClick={() => setIsAddressModalOpen(true)}
                      className="text-xs text-nexus-400 hover:underline font-semibold"
                    >
                      Change Address
                    </button>
                  </div>
                  {selectedAddress.addressLine2 && (
                    <p className="text-xs text-slate-400">{selectedAddress.addressLine2}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    {selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}
                  </p>
                  <p className="text-xs text-slate-500 font-semibold">{selectedAddress.country}</p>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                  <p className="text-xs text-slate-400">No primary address selected.</p>
                  <button
                    onClick={() => setIsAddressModalOpen(true)}
                    className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold"
                  >
                    Select or Add Address
                  </button>
                </div>
              )}

              <div className="pt-4 flex justify-end border-t border-slate-800">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedAddress}
                  className="px-6 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                >
                  Continue to Shipping Method <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-nexus-400" /> Choose Carrier Delivery Method
              </h3>

              <div className="space-y-3">
                {shippingMethods.map((method) => (
                  <div
                    key={method.id}
                    onClick={() => setSelectedShippingMethod(method.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                      selectedShippingMethod === method.id
                        ? 'bg-nexus-950/60 border-nexus-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{method.name}</span>
                        {method.isFree && (
                          <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold rounded">
                            FREE
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400">
                        {method.carrier} • Estimated Delivery: {method.estimatedDelivery}
                      </p>
                    </div>
                    <span className="text-base font-extrabold text-white">
                      {Number(method.rate) === 0 ? 'FREE' : `৳${Number(method.rate).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-between border-t border-slate-800">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  Continue to Payment <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-nexus-400" /> Select Payment Method
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { id: 'CREDIT_CARD', label: 'Credit Card (Stripe)' },
                  { id: 'PAYPAL', label: 'PayPal Express' },
                  { id: 'CASH_ON_DELIVERY', label: 'Cash on Delivery' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all ${
                      paymentMethod === id
                        ? 'bg-nexus-950 border-nexus-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'CREDIT_CARD' && (
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="Card number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-300 font-semibold">Expiry Date</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-300 font-semibold">CVC / CVV</label>
                      <input
                        type="password"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="CVC"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-between border-t border-slate-800">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleCreatePaymentIntent}
                  className="px-6 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  Initialize Gateway & Review <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Final Order Authorization &
                Settlement
              </h3>

              <div className="space-y-3 border-t border-b border-slate-800 py-4 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Shipping Address:</span>
                  <span className="font-semibold text-white text-right">
                    {selectedAddress?.addressLine1}, {selectedAddress?.city},{' '}
                    {selectedAddress?.state}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Carrier Shipping Tier:</span>
                  <span className="font-semibold text-white uppercase">
                    {selectedShippingMethod.replace(/_/g, ' ')}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Promo Code Applied:</span>
                    <span className="font-semibold text-emerald-400">
                      {appliedCoupon.code} (-৳{couponDiscount.toFixed(2)})
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Gateway Authorization:</span>
                  <span className="font-semibold text-emerald-400 uppercase">
                    {paymentMethod.replace(/_/g, ' ')}
                  </span>
                </div>
                {paymentIntent && (
                  <div className="flex justify-between font-mono text-[11px] text-slate-400 pt-1">
                    <span>Gateway Reference ID:</span>
                    <span className="text-nexus-400">{paymentIntent.transactionId}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Back to Payment
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-nexus-600/30 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing Order & Settlement...' : 'Authorize & Complete Order'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
              Order Items ({cart.totalItems})
            </h3>

            <div className="space-y-2">
              {appliedCoupon ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-bold text-emerald-300 block truncate">{appliedCoupon.code}</span>
                    <p className="text-[11px] text-emerald-400">
                      {appliedCoupon.discountType === 'PERCENTAGE'
                        ? `${appliedCoupon.discountValue}% off`
                        : `৳${Number(appliedCoupon.discountValue).toFixed(2)} off`}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-xs text-slate-400 hover:text-white font-semibold shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 uppercase font-mono"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold disabled:opacity-40"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && (
                <p className="text-[11px] text-red-400">{couponError}</p>
              )}
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-xs">
                  <div className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="font-semibold text-white line-clamp-1">{item.productName}</p>
                    <p className="text-slate-400">
                      {item.quantity} x ৳{Number(item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                  <span className="font-bold text-white">৳{Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-xs pt-3 border-t border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-200">৳{subtotalDisplay}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span className="font-semibold">-৳{couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Estimated Tax{taxLabel}</span>
                <span className="font-semibold text-slate-200">৳{taxDisplay}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping Fee</span>
                <span className="font-semibold text-slate-200">৳{shippingDisplay}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline text-sm">
                <span className="font-bold text-white">Total Amount</span>
                <span className="text-xl font-extrabold text-white">৳{totalDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddressSelectorModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        selectedAddressId={selectedAddress?.id}
        onSelectAddress={(addr) => setSelectedAddress(addr)}
      />
    </div>
  );
}

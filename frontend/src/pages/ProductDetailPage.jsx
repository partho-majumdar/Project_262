import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  Heart,
  Star,
  CheckCircle2,
  ShieldCheck,
  Truck,
  ArrowLeft,
  ChevronRight,
  Store,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  Plus,
  X,
  ImageOff,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState('');

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const fetchProduct = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get(`/products/${slug}`);
      const prod = response.data?.data ?? response.data;
      setProduct(prod);
      setSelectedImage(0);

      if (prod?.id) {
        const [revRes, sumRes, simRes] = await Promise.allSettled([
          axiosClient.get(`/reviews/product/${prod.id}`),
          axiosClient.get(`/reviews/product/${prod.id}/summary`),
          axiosClient.get(`/ai/recommendations/similar/${prod.id}`),
        ]);

        const unwrap = (r) =>
          r.status === 'fulfilled' ? r.value?.data?.data ?? r.value?.data ?? null : null;

        const revData = unwrap(revRes);
        setReviews(Array.isArray(revData) ? revData : revData?.content || []);
        setSummary(unwrap(sumRes));
        const simData = unwrap(simRes);
        setSimilarProducts(Array.isArray(simData) ? simData : simData?.recommendations || []);
      }
    } catch (err) {
      setError(err.message || 'Product not found');
    } finally {
      setLoading(false);
    }
  };

  // Load wishlist state for this product
  useEffect(() => {
    if (!isAuthenticated || !product?.id) {
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
          setWishlisted(items.some((i) => i.productId === product.id || i.product?.id === product.id));
        }
      } catch {
        if (!cancelled) setWishlisted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, product?.id]);

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  const handleAddToCart = async () => {
    if (!product?.id) return;
    setAddingToCart(true);
    try {
      await addToCart(product.id, quantity);
      alert(`Added ${quantity} × "${product.name}" to cart`);
    } catch (err) {
      alert(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!product?.id) return;
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

  const handleVoteHelpful = async (reviewId) => {
    try {
      await axiosClient.post(`/reviews/${reviewId}/helpful`);
      fetchProduct();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!product?.id) return;
    setSubmittingReview(true);
    try {
      await axiosClient.post(`/customer/reviews/product/${product.id}`, {
        rating: newRating,
        title: newTitle,
        comment: newComment,
      });
      setIsReviewModalOpen(false);
      setNewTitle('');
      setNewComment('');
      setNewRating(5);
      fetchProduct();
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400 text-sm">
        Loading product…
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Product not found'}
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to catalog
        </Link>
      </div>
    );
  }

  const images = Array.isArray(product.imageUrls) ? product.imageUrls.filter(Boolean) : [];
  const mainImage = images[selectedImage] || images[0] || null;
  const price = product.price != null ? Number(product.price) : null;
  const compareAt =
    product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const rating = product.rating != null ? Number(product.rating) : null;
  const reviewCount = product.reviewCount != null ? Number(product.reviewCount) : null;
  const stock = product.stockQuantity != null ? Number(product.stockQuantity) : 0;
  const inStock = stock > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <nav className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <Link to="/" className="hover:text-white">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link to="/products" className="hover:text-white">
          Products
        </Link>
        {product.categoryName && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link
              to={product.categorySlug ? `/categories/${product.categorySlug}` : '/products'}
              className="hover:text-white"
            >
              {product.categoryName}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-nexus-400 font-semibold line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="h-96 sm:h-[450px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 relative">
            {mainImage ? (
              <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                <ImageOff className="w-10 h-10 opacity-50" />
                <span className="text-xs">No image</span>
              </div>
            )}
            {compareAt != null && price != null && compareAt > price && (
              <span className="absolute top-4 left-4 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-lg">
                Save ${(compareAt - price).toFixed(2)}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImage === idx ? 'border-nexus-500 scale-105' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {product.categoryName && (
                <span className="px-2.5 py-1 rounded-md bg-nexus-950 border border-nexus-800 text-nexus-400 text-xs font-semibold uppercase">
                  {product.categoryName}
                </span>
              )}
              {product.sku && (
                <span className="text-xs text-slate-500 font-mono">SKU: {product.sku}</span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              {rating != null ? (
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{rating.toFixed(1)}</span>
                  {reviewCount != null && (
                    <span className="text-slate-500 font-normal">({reviewCount} reviews)</span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">No ratings yet</span>
              )}
              {product.sellerStoreName && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Store className="w-4 h-4 text-indigo-400" /> {product.sellerStoreName}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-white">
              {price != null ? `$${price.toFixed(2)}` : '—'}
            </span>
            {compareAt != null && price != null && compareAt > price && (
              <span className="text-sm text-slate-500 line-through">${compareAt.toFixed(2)}</span>
            )}
          </div>

          <div className="text-xs">
            {inStock ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> In stock ({stock} available)
              </span>
            ) : (
              <span className="text-rose-400 font-semibold">Out of stock</span>
            )}
          </div>

          {product.description && (
            <div className="space-y-1 text-sm text-slate-300 leading-relaxed border-t border-b border-slate-800/80 py-4">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wide">Overview</h4>
              <p className="text-xs sm:text-sm">{product.description}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-slate-400 hover:text-white px-2 font-bold"
              >
                -
              </button>
              <span className="px-4 text-sm font-bold text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(stock || quantity + 1, quantity + 1))}
                disabled={!inStock}
                className="text-slate-400 hover:text-white px-2 font-bold disabled:opacity-40"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={addingToCart || !inStock}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-nexus-600/30 transition-all disabled:opacity-50 text-sm"
            >
              <ShoppingBag className="w-5 h-5" />
              {addingToCart ? 'Adding…' : 'Add to Cart'}
            </button>

            <button
              onClick={handleToggleWishlist}
              disabled={wishlistLoading}
              title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`p-3 border rounded-xl transition-all ${
                wishlisted
                  ? 'bg-rose-950/50 border-rose-700 text-rose-400'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-rose-500 hover:text-rose-400'
              }`}
            >
              <Heart className={`w-5 h-5 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-400">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-2">
              <Truck className="w-4 h-4 text-nexus-400 shrink-0" /> Fast shipping
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> Secure checkout
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-nexus-400" /> Reviews
          </h2>
          {isAuthenticated ? (
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Write a review
            </button>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 bg-slate-900 border border-slate-700 text-nexus-400 text-xs font-semibold rounded-xl"
            >
              Log in to review
            </Link>
          )}
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <div className="text-center space-y-1">
              <p className="text-4xl font-black text-white">
                {Number(summary.averageRating || 0).toFixed(1)}
              </p>
              <div className="flex justify-center text-amber-400 gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(summary.averageRating || 0)
                        ? 'fill-amber-400'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {summary.totalReviews || 0} reviews
              </p>
            </div>
            <div className="md:col-span-2 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.ratingCounts?.[star] || 0;
                const total = summary.totalReviews || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-8 text-slate-300 font-semibold">{star}★</span>
                    <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-500 font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="py-6 text-center text-slate-400 text-xs">No reviews yet.</p>
          ) : (
            reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(rev.userName || '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">
                          {rev.userName || 'Customer'}
                        </span>
                        {rev.verifiedPurchase && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                            Verified
                          </span>
                        )}
                      </div>
                      {rev.createdAt && (
                        <span className="text-[11px] text-slate-500">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex text-amber-400 gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= (rev.rating || 0) ? 'fill-amber-400' : 'text-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {rev.title && <h4 className="text-xs font-bold text-white">{rev.title}</h4>}
                {rev.comment && (
                  <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                )}
                {rev.sellerReply && (
                  <div className="mt-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300">
                    <span className="text-nexus-400 font-semibold">Seller reply: </span>
                    {rev.sellerReply}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleVoteHelpful(rev.id)}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-nexus-400 text-[11px]"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Helpful ({rev.helpfulVotes ?? 0})
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Similar — real data only */}
      {similarProducts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-nexus-400" /> Similar products
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {similarProducts.map((prod) => (
              <Link
                key={prod.id}
                to={`/products/${prod.slug || prod.id}`}
                className="glass-card rounded-2xl border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition flex gap-4"
              >
                <div className="w-24 h-24 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-800">
                  {prod.imageUrls?.[0] ? (
                    <img
                      src={prod.imageUrls[0]}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <ImageOff className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                  {prod.categoryName && (
                    <span className="text-[10px] font-bold text-nexus-400 uppercase">
                      {prod.categoryName}
                    </span>
                  )}
                  <h4 className="font-bold text-white text-xs line-clamp-2">{prod.name}</h4>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {prod.price != null ? `$${Number(prod.price).toFixed(2)}` : '—'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Review modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Write a review</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
              <div className="space-y-1 text-center">
                <label className="font-semibold text-slate-300 block">Rating</label>
                <div className="flex justify-center gap-2 text-amber-400 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setNewRating(star)} className="p-1">
                      <Star
                        className={`w-6 h-6 ${
                          star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Comment</label>
                <textarea
                  rows="4"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {submittingReview ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

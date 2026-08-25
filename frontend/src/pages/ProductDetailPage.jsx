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
  RotateCcw, 
  ArrowLeft, 
  ChevronRight,
  Store,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  Plus,
  X,
  User
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

  // Reviews & AI Recommendations State
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchProduct = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get(`/products/${slug}`);
      const prod = response.data;
      setProduct(prod);

      // Fetch Reviews, Summary, and AI Similar Products
      const [revRes, sumRes, simRes] = await Promise.all([
        axiosClient.get(`/reviews/product/${prod.id}`),
        axiosClient.get(`/reviews/product/${prod.id}/summary`),
        axiosClient.get(`/ai/recommendations/similar/${prod.id}`),
      ]);
      setReviews(revRes.data);
      setSummary(sumRes.data);
      setSimilarProducts(simRes.data);
    } catch (err) {
      setError(err.message || 'Product not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await addToCart(product.id, quantity);
      alert(`Added ${quantity} x "${product.name}" to your shopping cart!`);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart');
    } finally {
      setAddingToCart(false);
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
    if (!product) return;
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
      alert('Thank you! Your product review has been published.');
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading product details & reviews...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Product not found'}
        </div>
        <Link to="/products" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Return to Product Catalog
        </Link>
      </div>
    );
  }

  const mainImage = product.imageUrls?.[selectedImage] || product.imageUrls?.[0];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/" className="hover:text-white">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to="/products" className="hover:text-white">Products</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/categories/${product.categorySlug}`} className="hover:text-white">{product.categoryName}</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-nexus-400 font-semibold line-clamp-1">{product.name}</span>
      </nav>

      {/* Main Product Showcase Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          <div className="h-96 sm:h-[450px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 relative">
            <img
              src={product.imageUrls?.[selectedImage] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&auto=format&fit=crop'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="absolute top-4 left-4 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-lg">
                SAVE ${(product.compareAtPrice - product.price).toFixed(2)}
              </span>
            )}
          </div>

          {/* Thumbnail Strip */}
          {product.imageUrls && product.imageUrls.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.imageUrls.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImage === idx ? 'border-nexus-500 scale-105' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Specifications & Actions */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-nexus-950 border border-nexus-800 text-nexus-400 text-xs font-semibold uppercase">
                {product.categoryName}
              </span>
              <span className="text-xs text-slate-500 font-mono">SKU: {product.sku}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{product.name}</h1>

            {/* Rating & Merchant Badge */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{product.rating ? product.rating.toFixed(1) : '5.0'}</span>
                <span className="text-slate-500 font-normal">({product.reviewCount} customer reviews)</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1 text-slate-300 font-semibold">
                <Store className="w-4 h-4 text-indigo-400" /> {product.sellerStoreName}
              </div>
            </div>
          </div>

          {/* Price Box */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-white">${product.price.toFixed(2)}</span>
            {product.compareAtPrice && (
              <span className="text-sm text-slate-500 line-through">${product.compareAtPrice.toFixed(2)}</span>
            )}
          </div>

          {/* Stock Indicator */}
          <div className="flex items-center gap-2 text-xs">
            {product.stockQuantity > 0 ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> In Stock ({product.stockQuantity} units available)
              </span>
            ) : (
              <span className="text-rose-400 font-semibold">Out of Stock</span>
            )}
          </div>

          {/* Product Description */}
          <div className="space-y-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-b border-slate-800/80 py-4">
            <h4 className="font-semibold text-white">Product Overview</h4>
            <p>{product.description}</p>
          </div>

          {/* Purchase Actions */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-slate-400 hover:text-white px-2 font-bold"
                >
                  -
                </button>
                <span className="px-4 text-sm font-bold text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="text-slate-400 hover:text-white px-2 font-bold"
                >
                  +
                </button>
              </div>

              <button 
                onClick={handleAddToCart}
                disabled={addingToCart || product.stockQuantity <= 0}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-nexus-600/30 transition-all disabled:opacity-50 text-sm"
              >
                <ShoppingBag className="w-5 h-5" /> {addingToCart ? 'Adding to Cart...' : 'Add to Cart'}
              </button>

              <button className="p-3 bg-slate-900 border border-slate-800 hover:border-rose-500 text-slate-300 hover:text-rose-400 rounded-xl transition-all">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-2 gap-3 pt-4 text-xs text-slate-400">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-2">
              <Truck className="w-4 h-4 text-nexus-400" /> Express Global Shipping
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 30-Day Money Back Guarantee
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews & Rating Distribution Section */}
      <div className="glass-card p-6 sm:p-10 rounded-3xl border border-slate-800 space-y-8">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-nexus-400" /> Customer Reviews & Ratings
            </h2>
            <p className="text-xs text-slate-400">Read verified buyer feedback and ratings for this product</p>
          </div>

          {isAuthenticated ? (
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-5 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-nexus-600/30 transition-all"
            >
              <Plus className="w-4 h-4" /> Write a Review
            </button>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 bg-slate-900 border border-slate-700 text-nexus-400 text-xs font-semibold rounded-xl"
            >
              Log in to Write a Review
            </Link>
          )}
        </div>

        {/* Rating Breakdown Bars */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
            <div className="text-center space-y-1">
              <p className="text-5xl font-black text-white">{summary.averageRating.toFixed(1)}</p>
              <div className="flex justify-center text-amber-400 gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`w-4 h-4 ${star <= Math.round(summary.averageRating) ? 'fill-amber-400' : 'text-slate-700'}`} />
                ))}
              </div>
              <p className="text-xs text-slate-400 pt-1">Based on {summary.totalReviews} verified reviews</p>
            </div>

            <div className="md:col-span-2 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.ratingCounts?.[star] || 0;
                const percentage = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-8 text-slate-300 font-semibold flex items-center gap-1">
                      {star} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="w-10 text-right text-slate-500 font-mono text-[11px]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No customer reviews yet. Be the first to share your experience!
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-xs font-bold">
                      {rev.userName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{rev.userName}</span>
                        {rev.verifiedPurchase && (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex text-amber-400 gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-3.5 h-3.5 ${star <= rev.rating ? 'fill-amber-400' : 'text-slate-800'}`} />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">{rev.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                </div>

                <div className="pt-2 flex items-center justify-end text-xs">
                  <button
                    onClick={() => handleVoteHelpful(rev.id)}
                    className="inline-flex items-center gap-1.5 text-slate-400 hover:text-nexus-400 font-medium text-[11px]"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Helpful ({rev.helpfulVotes})
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Frequently Bought Together Bundle Card */}
      {similarProducts && similarProducts.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-indigo-900/60 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-nexus-400" /> Frequently Bought Together
            </h3>
            <span className="text-xs text-emerald-400 font-bold font-mono">Bundle & Save 15%</span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
                <img src={mainImage} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />
                <div>
                  <p className="font-bold text-white line-clamp-1">{product.name}</p>
                  <p className="text-emerald-400 font-mono font-bold">${product.price}</p>
                </div>
              </div>

              <span className="text-slate-500 font-extrabold text-lg">+</span>

              <div className="flex items-center gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
                <img src={similarProducts[0]?.imageUrls?.[0] || mainImage} alt="Accessory" className="w-12 h-12 object-cover rounded-lg" />
                <div>
                  <p className="font-bold text-white line-clamp-1">{similarProducts[0]?.name || 'Protective Sleeve Case'}</p>
                  <p className="text-emerald-400 font-mono font-bold">${similarProducts[0]?.price || 49.99}</p>
                </div>
              </div>
            </div>

            <div className="text-right space-y-2 shrink-0">
              <div className="text-xs text-slate-400 font-mono">
                Bundle Price: <strong className="text-lg font-black text-emerald-400">${(product.price + (similarProducts[0]?.price || 49.99) * 0.85).toFixed(2)}</strong>
              </div>
              <button
                onClick={() => {
                  addToCart(product, 1);
                  if (similarProducts[0]) addToCart(similarProducts[0], 1);
                  alert('Bundle added to cart with 15% discount!');
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg"
              >
                Add 2-Item Bundle to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Vector Similar Products Section */}
      {similarProducts && similarProducts.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-nexus-400" /> AI Vector Similar Recommendations
            </h3>
            <span className="text-xs text-slate-400 font-mono">Matched by Price & Feature Vector</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProducts.map((prod) => (
              <div key={prod.id} className="glass-card rounded-2xl border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-40 bg-slate-900 rounded-xl overflow-hidden">
                    <img src={prod.imageUrls?.[0]} alt={prod.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-nexus-400 uppercase tracking-wider">{prod.categoryName}</span>
                    <h4 className="font-bold text-white text-xs line-clamp-1">{prod.name}</h4>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-white">${prod.price.toFixed(2)}</span>
                  <Link
                    to={`/products/${prod.slug}`}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write a Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Write Product Review
              </h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
              <div className="space-y-1 text-center">
                <label className="font-semibold text-slate-300 block">Overall Rating</label>
                <div className="flex justify-center gap-2 text-amber-400 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star className={`w-6 h-6 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Review Headline Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Exceptional AI performance and battery life"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Detailed Feedback / Comments</label>
                <textarea
                  rows="4"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Describe your real-world experience with this product..."
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
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

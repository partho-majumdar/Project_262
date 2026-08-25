import React, { useState, useEffect } from 'react';
import { Scale, X, Sparkles, Trophy, Check, Star, RefreshCw } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

export default function ProductComparisonModal({ isOpen, onClose }) {
  const [productsList, setProductsList] = useState([]);
  const [prodId1, setProdId1] = useState('');
  const [prodId2, setProdId2] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      axiosClient.get('/products?page=0&size=50')
        .then((res) => {
          const content = res.data?.content || res.data || [];
          setProductsList(content);
          if (content.length >= 2) {
            setProdId1(content[0].id);
            setProdId2(content[1].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCompare = async () => {
    if (!prodId1 || !prodId2 || prodId1 === prodId2) return;

    setLoading(true);
    try {
      const response = await axiosClient.post('/ai/vision/compare', {
        productId1: prodId1,
        productId2: prodId2
      });
      setComparison(response.data);
    } catch (err) {
      console.error('Failed to execute AI product comparison', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-3xl p-6 rounded-3xl space-y-6 border border-slate-800 relative bg-slate-950/95 text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-nexus-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                AI Side-by-Side Product Comparison <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">Compare specs, ratings, price math, and AI pros/cons across two products.</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-300">Product A</label>
            <select
              value={prodId1}
              onChange={(e) => setProdId1(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-nexus-500"
            >
              {productsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">Product B</label>
            <select
              value={prodId2}
              onChange={(e) => setProdId2(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-nexus-500"
            >
              {productsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !prodId1 || !prodId2 || prodId1 === prodId2}
          className="w-full py-2.5 bg-nexus-600 hover:bg-nexus-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
          {loading ? 'Analyzing Product Matrix...' : 'Compare Products Side-by-Side'}
        </button>

        {/* Comparison Matrix Results */}
        {comparison && (
          <div className="space-y-6 border-t border-slate-800 pt-4 text-xs">
            
            {/* AI Summary Recommendation Box */}
            <div className="p-4 bg-nexus-950/60 border border-nexus-800/80 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Trophy className="w-4 h-4" /> AI Winner & Recommendation Summary
              </div>
              <p className="text-slate-200 leading-relaxed">{comparison.aiSummaryRecommendation}</p>
            </div>

            {/* Side-by-Side Comparison Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Specification</th>
                    <th className="p-3 font-bold text-white">{comparison.product1.name}</th>
                    <th className="p-3 font-bold text-white">{comparison.product2.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3 text-slate-400 font-semibold">Price</td>
                    <td className="p-3 font-bold text-emerald-400">${comparison.product1.price}</td>
                    <td className="p-3 font-bold text-emerald-400">${comparison.product2.price}</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3 text-slate-400 font-semibold">Rating</td>
                    <td className="p-3 text-amber-400 font-bold">★ {comparison.product1.rating} ({comparison.product1.reviewCount})</td>
                    <td className="p-3 text-amber-400 font-bold">★ {comparison.product2.rating} ({comparison.product2.reviewCount})</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3 text-slate-400 font-semibold">Category</td>
                    <td className="p-3">{comparison.product1.categoryName}</td>
                    <td className="p-3">{comparison.product2.categoryName}</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-3 text-slate-400 font-semibold">In Stock</td>
                    <td className="p-3">{comparison.product1.stockQuantity} units</td>
                    <td className="p-3">{comparison.product2.stockQuantity} units</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

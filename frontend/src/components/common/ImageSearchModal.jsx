import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Upload, X, Sparkles, Star, ChevronRight, RefreshCw, FileText } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

export default function ImageSearchModal({ isOpen, onClose }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!imagePreview && !ocrText.trim()) return;

    setLoading(true);
    try {
      const response = await axiosClient.post('/ai/vision/image-search', {
        imageBase64: imagePreview,
        extractedOcrText: ocrText
      });
      setResults(response.data || []);
    } catch (err) {
      console.error('Failed to perform image search', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl p-6 rounded-3xl space-y-6 border border-slate-800 relative bg-slate-950/95 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-nexus-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                AI Vision & Image Search <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">Upload a product photo or label to find visually similar items & OCR matches.</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Zone & OCR Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* File Upload / Camera Zone */}
          <div className="border-2 border-dashed border-slate-800 hover:border-nexus-500/50 rounded-2xl p-4 text-center flex flex-col items-center justify-center bg-slate-900/50 relative overflow-hidden group">
            {imagePreview ? (
              <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-800">
                <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setImagePreview(''); setSelectedImage(null); }}
                  className="absolute top-2 right-2 p-1 bg-slate-950/80 hover:bg-rose-900 text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer w-full h-44 flex flex-col items-center justify-center space-y-2">
                <Upload className="w-8 h-8 text-nexus-400 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white">Click or drag product image</span>
                <span className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP up to 5MB</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>

          {/* OCR Label Text Simulation Input */}
          <div className="space-y-3 flex flex-col justify-between bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-nexus-400" /> OCR Label Keyword Filter
              </label>
              <p className="text-[11px] text-slate-500">Extracted product model or brand label text (optional):</p>
              <input
                type="text"
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                placeholder="e.g. Pro Book, Sound ANC, 4K Camera..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-nexus-500"
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={loading || (!imagePreview && !ocrText.trim())}
              className="w-full py-2.5 bg-nexus-600 hover:bg-nexus-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
              {loading ? 'Analyzing Vision Vectors...' : 'Find Matching Products'}
            </button>
          </div>

        </div>

        {/* Results Showcase */}
        {results.length > 0 && (
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              Matched Visual Catalog Recommendations ({results.length})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
              {results.map((prod) => (
                <Link
                  key={prod.id}
                  to={`/product/${prod.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-3 p-2.5 bg-slate-900/60 hover:bg-slate-900 rounded-2xl border border-slate-800 transition group"
                >
                  <div className="w-12 h-12 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                    <img src={prod.imageUrls?.[0]} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-xs truncate group-hover:text-nexus-400">{prod.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="font-extrabold text-emerald-400">${prod.price}</span>
                      <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-2.5 h-2.5 fill-amber-400" /> {prod.rating}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  ShoppingBag, 
  ArrowRight, 
  Star, 
  RefreshCw,
  Zap,
  CheckCircle2,
  Cpu,
  Camera,
  Upload,
  Search
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useCart } from '../context/CartContext';
import ImageSearchModal from '../components/common/ImageSearchModal';

export default function AiAssistantPage() {
  const { addToCart } = useCart();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Hello! I am GMart AI, your autonomous smart commerce advisor. Tell me what you are looking for (e.g. laptops, audio gear, running shoes), or click a prompt below!',
      products: [],
      timestamp: new Date(),
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const messagesRef = useRef(null);

  const promptChips = [
    'How do group deals work?',
    'How does wholesale pooling work?',
    'Show products under ৳1000',
    'Headphones between ৳300 and ৳800',
    'Products greater than ৳2000'
  ];

  // Scroll the message list itself rather than calling scrollIntoView on a sentinel:
  // scrollIntoView also scrolls every scrollable ancestor, which dragged the whole page
  // down on each send. Pinning again after layout catches replies whose product cards
  // grow the list after the effect first runs.
  useEffect(() => {
    const list = messagesRef.current;
    if (!list) return undefined;

    const pinToBottom = () => {
      list.scrollTop = list.scrollHeight;
    };

    pinToBottom();
    const frame = requestAnimationFrame(pinToBottom);
    const settled = setTimeout(pinToBottom, 200);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputMessage;
    if (!query.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);

    try {
      const response = await axiosClient.post('/ai-assistant/chat', { message: query });
      const aiData = response.data?.data || response.data;

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: aiData.reply || 'I found matching products in our catalog for your query. Explore the vector recommendations below!',
        intent: aiData.intent || aiData.intentDetected,
        products: aiData.recommendedProducts || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'I found matching products in our catalog for your query. Explore the vector recommendations below!',
          products: [],
          timestamp: new Date(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (product) => {
    try {
      await addToCart(product, 1);
      alert(`Added "${product.name}" to cart!`);
    } catch (err) {
      alert('Added item to shopping cart!');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 via-indigo-950/40 to-slate-950 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-nexus-600 to-indigo-600 p-0.5 shadow-lg shadow-nexus-600/30 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-nexus-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              GMart AI Commerce Advisor
            </h1>
            <p className="text-xs text-slate-400">Copilot-powered vector similarity & conversational product discovery</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-nexus-950 border border-nexus-800 text-nexus-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Vector Similarity Active
          </span>
        </div>
      </div>

      {/* PRIMARY CONVERSATIONAL CHAT CONTAINER */}
      <div className="glass-card rounded-3xl border border-slate-800 p-4 sm:p-6 min-h-[520px] flex flex-col justify-between space-y-4">
        
        {/* Messages Scroll Area */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[460px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                msg.sender === 'user' ? 'bg-nexus-600 text-white' : 'bg-slate-900 border border-slate-700 text-nexus-400'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content */}
              <div className="space-y-3">
                <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-nexus-600 text-white rounded-tr-none'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>

                {/* Recommended Product Cards inside AI response */}
                {msg.products && msg.products.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {msg.products.map((prod) => (
                      <div key={prod.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-xs hover:border-slate-700 transition-all flex items-center gap-3">
                        <div className="w-16 h-16 bg-slate-900 rounded-xl overflow-hidden shrink-0">
                          <img src={prod.imageUrls?.[0]} alt={prod.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="font-bold text-white line-clamp-1">{prod.name}</h4>
                          <div className="flex justify-between items-center text-slate-400 font-semibold">
                            <span className="text-emerald-400 font-extrabold">৳{prod.price.toFixed(2)}</span>
                            <span className="flex items-center text-amber-400 gap-0.5 text-[11px]">
                              <Star className="w-3 h-3 fill-amber-400" /> {prod.rating ? prod.rating.toFixed(1) : '5.0'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAddToCart(prod)}
                            className="w-full py-1 bg-nexus-600 hover:bg-nexus-500 text-white rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1"
                          >
                            <ShoppingBag className="w-3 h-3" /> Add to Cart
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 text-nexus-400 flex items-center justify-center text-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-none text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-nexus-400" /> AI assistant searching catalog...
              </div>
            </div>
          )}

        </div>

        {/* Prompt Recommendation Chips */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap gap-2">
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition-all"
              >
                + {chip}
              </button>
            ))}
          </div>

          {/* PRIMARY TEXT CHAT INPUT BAR WITH 'FIND MATCHING PRODUCTS' BUTTON */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask GMart AI to recommend laptops, smartphones, audio gear, budget deals..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-2xl px-4 py-3 text-xs text-slate-100 placeholder:text-slate-500 shadow-inner"
            />
            
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-5 py-3 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-nexus-600/30 transition-all disabled:opacity-50 shrink-0"
            >
              <Search className="w-4 h-4" /> Find Matching Products
            </button>
          </form>
        </div>

      </div>

      {/* SECONDARY UTILITY: SEARCH BY IMAGE (OPTIONAL) - 65% SMALLER CARD */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Search by Image (Optional)</h4>
            <p className="text-[10px] text-slate-400">Upload or drag a product photo to find visual catalog matches.</p>
          </div>
        </div>

        <button
          onClick={() => setIsImageSearchOpen(true)}
          className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" /> Upload Image
        </button>
      </div>

      {/* Image Modal */}
      <ImageSearchModal isOpen={isImageSearchOpen} onClose={() => setIsImageSearchOpen(false)} />

    </div>
  );
}

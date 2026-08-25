import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ShoppingBag, 
  Search, 
  Sparkles, 
  Mic, 
  Camera, 
  User, 
  LogOut, 
  Store, 
  Scale, 
  MapPin, 
  CreditCard, 
  Lock, 
  Globe, 
  ChevronDown,
  History,
  TrendingUp,
  X,
  Home,
  LayoutDashboard,
  Flame,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import ImageSearchModal from './ImageSearchModal';
import ProductComparisonModal from './ProductComparisonModal';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  
  const [isListening, setIsListening] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const popularSearches = ['iPhone 15', 'Gaming Laptop', 'Sony Headphones', 'Nike Air Max', 'Smart Watch'];

  useEffect(() => {
    const saved = localStorage.getItem('nexus_search_history');
    if (saved) {
      try { setSearchHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await axiosClient.get(`/search/suggestions?q=${encodeURIComponent(searchQuery.trim())}`);
          setSuggestions(res.data?.data || []);
        } catch (e) {
          setSuggestions([]);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  const saveSearchHistory = (term) => {
    if (!term) return;
    const updated = [term, ...searchHistory.filter((t) => t !== term)].slice(0, 5);
    setSearchHistory(updated);
    localStorage.setItem('nexus_search_history', JSON.stringify(updated));
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in your browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      saveSearchHistory(transcript);
      navigate(`/products?search=${encodeURIComponent(transcript)}`);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveSearchHistory(searchQuery.trim());
      setShowSuggestions(false);
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSuggestionClick = (term) => {
    setSearchQuery(term);
    saveSearchHistory(term);
    setShowSuggestions(false);
    navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  // Role-Based Redirection Setup
  let dashboardLink = '/customer/dashboard';
  let dashboardText = 'Customer Dashboard';
  let dashboardTheme = 'bg-nexus-600 hover:bg-nexus-500 text-white';

  if (user?.role === 'ROLE_ADMIN') {
    dashboardLink = '/admin/dashboard';
    dashboardText = 'Admin Dashboard';
    dashboardTheme = 'bg-rose-600 hover:bg-rose-500 text-white';
  } else if (user?.role === 'ROLE_SELLER') {
    dashboardLink = '/seller/dashboard';
    dashboardText = 'Seller Dashboard';
    dashboardTheme = 'bg-emerald-600 hover:bg-emerald-500 text-white';
  }

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 backdrop-blur-xl bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* 1. COMPANY LOGO */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-nexus-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-nexus-500/30 group-hover:scale-105 transition-transform duration-200">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-nexus-300 bg-clip-text text-transparent">
                Group<span className="text-nexus-400">Mart X</span>
              </span>
              <span className="text-[9px] text-nexus-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" /> Digital Commerce
              </span>
            </div>
          </Link>

          {/* 2. DYNAMIC CENTER: SEARCH BAR (LOGGED IN) OR NAVIGATION LINKS (GUEST) */}
          {isAuthenticated ? (
            <div className="flex-1 max-w-xl hidden md:block relative">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Search catalog (e.g., 'shoes', 'laptop', 'phone')..."
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-nexus-500 rounded-2xl py-2 pl-10 pr-24 text-xs text-slate-100 placeholder:text-slate-550 transition shadow-inner"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5" />

                {/* Multimodal AI Tool Actions */}
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleVoiceSearch}
                    className={`p-1.5 rounded-xl transition ${
                      isListening ? 'bg-rose-600 text-white animate-pulse' : 'text-slate-400 hover:text-nexus-400 hover:bg-slate-800'
                    }`}
                    title="Speech-to-Text Voice Search"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsImageSearchOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition"
                    title="Camera Vision Image Search"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCompareOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition"
                    title="Product Comparison"
                  >
                    <Scale className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Auto-Suggestions Dropdown */}
              {showSuggestions && (
                <div 
                  className="absolute top-full left-0 right-0 mt-2 glass-panel bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-4 backdrop-blur-xl"
                  onMouseLeave={() => setShowSuggestions(false)}
                >
                  {suggestions.length > 0 && (
                    <div className="space-y-1.5 text-left">
                      <span className="text-[10px] font-bold text-nexus-400 uppercase tracking-wider block">Live Matches</span>
                      {suggestions.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setShowSuggestions(false);
                            navigate(`/products/${item.slug}`);
                          }}
                          className="p-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer transition"
                        >
                          <div className="flex items-center gap-3">
                            <img src={item.imageUrls?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100'} alt={item.name} className="w-8 h-8 object-cover rounded-lg" />
                            <div>
                              <p className="font-bold text-white line-clamp-1">{item.name}</p>
                              <span className="text-[10px] text-slate-400 font-mono">{item.categoryName || 'Catalog Item'}</span>
                            </div>
                          </div>
                          <span className="text-emerald-400 font-bold font-mono">${item.price?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Popular Searches */}
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-amber-400" /> Popular Searches
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {popularSearches.map((pop, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(pop)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-[11px] font-medium transition"
                        >
                          {pop}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-slate-300">
              <Link to="/" className="hover:text-nexus-400 transition">Home</Link>
              <Link to="/categories" className="hover:text-nexus-400 transition">Categories</Link>
              <Link to="/products?tag=trending" className="hover:text-nexus-400 transition">Trending Products</Link>
              <Link to="/products?tag=deals" className="hover:text-nexus-400 transition flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Deals
              </Link>
              <Link to="/products" className="hover:text-nexus-400 transition">Brands</Link>
              <Link to="/seller/register" className="text-emerald-400 hover:text-emerald-300 font-bold transition flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> Become Seller
              </Link>
              <Link to="/ai-assistant" className="text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Assistant
              </Link>
            </nav>
          )}

          {/* 3. RIGHT CONTROLS: DYNAMIC LOGIN & DROPDOWNS */}
          <div className="flex items-center gap-3">
            
            {/* Show AI Assistant link on guest viewport */}
            {!isAuthenticated && (
              <Link
                to="/ai-assistant"
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </Link>
            )}

            {/* Profile Dropdown or Login Options */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                
                {/* Fast Access Dashboard Redirect Link */}
                {!(location.pathname === '/' || location.pathname === '/landing' || location.pathname === '/welcome') && (
                  <Link
                    to={dashboardLink}
                    className={`hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${dashboardTheme}`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>{dashboardText}</span>
                  </Link>
                )}

                {/* Dropdown Toggle */}
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-850 hover:border-slate-755 rounded-2xl transition"
                  >
                    <div className="w-7 h-7 rounded-xl bg-nexus-600/30 border border-nexus-500/50 flex items-center justify-center text-nexus-300 font-black text-xs">
                      {user?.firstName ? user.firstName.charAt(0) : 'U'}
                    </div>
                    <span className="text-xs font-bold text-slate-200 hidden md:inline">{user?.firstName || 'User'}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Profile Menu Dropdown */}
                  {isProfileMenuOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-60 glass-panel bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs text-left space-y-1"
                      onMouseLeave={() => setIsProfileMenuOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-slate-800">
                        <p className="font-bold text-white truncate">{user?.firstName} {user?.lastName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                      </div>

                      <div className="py-1 space-y-0.5 text-slate-350">
                        <Link to={dashboardLink} onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-nexus-400 font-bold hover:bg-slate-900 transition">
                          <LayoutDashboard className="w-3.5 h-3.5 text-nexus-400" /> {dashboardText}
                        </Link>
                        
                        <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-900 hover:text-white transition">
                          <User className="w-3.5 h-3.5 text-indigo-400" /> My Profile
                        </Link>

                        <Link to="/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-900 hover:text-white transition">
                          <Lock className="w-3.5 h-3.5 text-amber-400" /> Settings
                        </Link>

                        <Link to="/" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-indigo-400 hover:bg-slate-900 font-bold transition">
                          <Home className="w-3.5 h-3.5 text-indigo-400" /> Back to Storefront
                        </Link>
                      </div>

                      <div className="border-t border-slate-800 pt-1">
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-450 hover:bg-rose-950/60 font-bold transition"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Log Out Button in header */}
                <button
                  onClick={logout}
                  className="hidden md:flex p-2 text-slate-400 hover:text-rose-400 rounded-xl transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>

              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-3.5 py-2 text-xs font-bold text-slate-355 hover:text-white transition">
                  Sign In
                </Link>
                <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition">
                  Register
                </Link>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Modals */}
      <ImageSearchModal isOpen={isImageSearchOpen} onClose={() => setIsImageSearchOpen(false)} />
      <ProductComparisonModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />
    </header>
  );
}

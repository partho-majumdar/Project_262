import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bot, 
  X, 
  Minimize2, 
  Maximize2, 
  Send, 
  Sparkles, 
  RefreshCw, 
  ShoppingBag, 
  Star, 
  HelpCircle, 
  Truck, 
  RotateCcw, 
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';

export default function FloatingAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Hello! I am GMart AI, your personal shopping assistant. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedPrompts: [
        'Suggest gaming laptops under $2000',
        'What is your shipping policy?',
        'How do I track my order?',
        'Show top photography phones'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await axiosClient.post('/ai/assistant/chat', { message: query });
      const data = response.data;

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: data.reply,
        recommendedProducts: data.recommendedProducts || [],
        suggestedPrompts: data.suggestedPrompts || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: 'I encountered a brief connection glitch while processing your request. Please try again or check store policies.',
        suggestedPrompts: ['What is your return policy?', 'Show electronics'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'ai',
        text: 'Conversation cleared! How can I assist you now?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPrompts: [
          'Suggest gaming laptops under $2000',
          'What is your return policy?',
          'Track my order'
        ]
      }
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Expanded Chat Window */}
      {isOpen && (
        <div 
          className={`glass-panel border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 mb-4 bg-slate-950/95 backdrop-blur-xl ${
            isExpanded ? 'w-[90vw] md:w-[680px] h-[80vh]' : 'w-[90vw] sm:w-[380px] h-[520px]'
          }`}
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-nexus-600 to-indigo-500 flex items-center justify-center shadow-lg text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  GMart AI Shopping Assistant <Sparkles className="w-3 h-3 text-amber-400" />
                </h3>
                <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online • Intelligent Support
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button 
                onClick={handleClearChat} 
                title="Clear Chat" 
                className="p-1.5 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                title={isExpanded ? "Minimize Window" : "Expand Window"} 
                className="p-1.5 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                title="Close Assistant" 
                className="p-1.5 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[85%] p-3.5 rounded-2xl space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-nexus-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  {/* Embedded Product Recommendations */}
                  {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="font-bold text-[11px] text-amber-400 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" /> Recommended Products:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {msg.recommendedProducts.map((prod) => (
                          <Link 
                            to={`/product/${prod.slug}`} 
                            key={prod.id} 
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 p-2 bg-slate-950/80 hover:bg-slate-950 rounded-xl border border-slate-800 transition group"
                          >
                            <div className="w-9 h-9 bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-slate-800">
                              <img 
                                src={prod.imageUrls?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'} 
                                alt={prod.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-[11px] truncate group-hover:text-nexus-400">{prod.name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="font-extrabold text-emerald-400">${prod.price}</span>
                                {prod.rating > 0 && (
                                  <span className="flex items-center gap-0.5 text-amber-400">
                                    <Star className="w-2.5 h-2.5 fill-amber-400" /> {prod.rating}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className={`block text-[9px] ${msg.sender === 'user' ? 'text-nexus-200 text-right' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </span>
                </div>

                {/* Suggested Prompts Chips */}
                {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                    {msg.suggestedPrompts.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(chip)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-[10px] text-slate-300 hover:text-white transition"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-2 text-slate-400 text-xs">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-400 animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-400 animate-bounce delay-200"></span>
                  <span className="text-[10px] ml-1 font-mono text-slate-500">GMart AI processing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Support Shortcuts */}
          <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <button onClick={() => handleSend("What is the shipping policy?")} className="hover:text-nexus-400 flex items-center gap-1">
              <Truck className="w-3 h-3" /> Shipping
            </button>
            <button onClick={() => handleSend("What is the return policy?")} className="hover:text-nexus-400 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Returns
            </button>
            <button onClick={() => handleSend("How to track order?")} className="hover:text-nexus-400 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> Track Order
            </button>
          </div>

          {/* Input Footer */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask GMart AI (e.g. gaming laptops, return policy)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-nexus-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-nexus-600 hover:bg-nexus-500 disabled:opacity-50 text-white rounded-xl transition shadow-md shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white rounded-full shadow-2xl border border-nexus-400/30 transition-all duration-300 hover:scale-105"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950"></span>
          </div>
          <span className="text-xs font-bold tracking-wide">Ask GMart AI</span>
        </button>
      )}

    </div>
  );
}

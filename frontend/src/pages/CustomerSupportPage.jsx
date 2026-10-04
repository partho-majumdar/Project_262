import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import {
  Send,
  MessageSquare,
  Search,
  Inbox,
  User,
  Store,
  RefreshCw,
  Clock,
  Plus,
  ArrowLeft,
  X,
} from 'lucide-react';

export default function CustomerSupportPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSellerPicker, setShowSellerPicker] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const res = await axiosClient.get('/support/conversations');
      const data = res.data?.data || res.data || [];
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (partnerId) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await axiosClient.get(`/support/conversation/${partnerId}`);
      const data = res.data?.data || res.data || [];
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadSellers = async () => {
    setLoadingSellers(true);
    setSellers([]);
    try {
      const res = await axiosClient.get('/stores');
      const data = res.data?.data || res.data || [];
      setSellers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load sellers', err);
      setSellers([]);
    } finally {
      setLoadingSellers(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      loadMessages(selectedPartner.id);
    }
  }, [selectedPartner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (conv) => {
    const partnerId = conv.senderId === user.id ? conv.receiverId : conv.senderId;
    const partner = {
      id: partnerId,
      name: conv.senderId === user.id ? conv.receiverName : conv.senderName,
      email: conv.senderId === user.id ? conv.receiverEmail : conv.senderEmail,
    };
    setSelectedPartner(partner);
    if (conv.subject && !subject) {
      setSubject(conv.subject);
    }
    setShowSellerPicker(false);
  };

  const handleSelectSeller = (seller) => {
    setSelectedPartner({
      id: seller.userId,
      name: seller.storeName,
      email: null,
    });
    setSubject('');
    setBody('');
    setMessages([]);
    setShowSellerPicker(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedPartner || !subject.trim() || !body.trim()) return;
    setSending(true);
    const tempMessage = {
      id: 'temp-' + Date.now(),
      senderId: user.id,
      senderName: user.firstName + ' ' + user.lastName,
      subject: subject.trim(),
      message: body.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setBody('');

    try {
      await axiosClient.post('/support/send', {
        receiverId: selectedPartner.id,
        subject: subject.trim(),
        message: tempMessage.message,
      });
      await loadMessages(selectedPartner.id);
      await loadConversations();
      textareaRef.current?.focus();
    } catch (err) {
      alert(err?.message || 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const partnerName = conv.senderId === user.id ? conv.receiverName : conv.senderName;
    return partnerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredSellers = sellers.filter((s) =>
    s.storeName.toLowerCase().includes(sellerSearch.toLowerCase())
  );

  const getLastMessage = (conv) => {
    if (!conv.message) return 'No messages';
    return conv.message.length > 60 ? conv.message.slice(0, 60) + '...' : conv.message;
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)]">
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden flex h-full">
        {/* Conversation List */}
        <div className="w-full sm:w-80 border-r border-slate-800 flex flex-col bg-slate-900/40">
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-nexus-400" /> Messages
              </h2>
              <button
                onClick={() => {
                  setShowSellerPicker(true);
                  loadSellers();
                }}
                className="p-1.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-lg"
                title="New conversation"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 text-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 space-y-3">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No conversations yet.</p>
                <button
                  onClick={() => {
                    setShowSellerPicker(true);
                    loadSellers();
                  }}
                  className="px-3 py-1.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const partnerId = conv.senderId === user.id ? conv.receiverId : conv.senderId;
                const partnerName = conv.senderId === user.id ? conv.receiverName : conv.senderName;
                const isSelected = selectedPartner?.id === partnerId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition ${
                      isSelected ? 'bg-nexus-950/60 border-l-2 border-l-nexus-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">{partnerName}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">{formatTime(conv.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{getLastMessage(conv)}</p>
                        {conv.subject && (
                          <p className="text-[10px] text-nexus-400 font-mono truncate mt-0.5">{conv.subject}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Seller Picker Overlay */}
        {showSellerPicker && (
          <div className="hidden sm:flex flex-1 flex-col bg-slate-950/60">
            <div className="p-4 border-b border-slate-800 flex items-center gap-3">
              <button
                onClick={() => setShowSellerPicker(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-bold text-white">Choose a seller to chat with</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  placeholder="Search stores..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {loadingSellers ? (
                  <div className="text-center text-xs text-slate-400 py-8">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                    Loading sellers...
                  </div>
                ) : sellers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No sellers available at the moment.</p>
                ) : filteredSellers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No sellers match your search.</p>
                ) : (
                  filteredSellers.map((seller) => (
                    <button
                      key={seller.id}
                      onClick={() => handleSelectSeller(seller)}
                      className="w-full text-left p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-nexus-600 transition flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        {seller.logoUrl ? (
                          <img src={seller.logoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Store className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{seller.storeName}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{seller.description || 'No description'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {seller.verified && (
                            <span className="text-[10px] font-bold text-emerald-400">Verified</span>
                          )}
                          <span className="text-[10px] text-slate-500">Rating: {Number(seller.rating).toFixed(1)}</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="hidden sm:flex flex-1 flex-col bg-slate-950/60">
          {selectedPartner ? (
            <>
              <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Store className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{selectedPartner.name}</p>
                  {selectedPartner.email && (
                    <p className="text-[10px] text-slate-400 truncate">{selectedPartner.email}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="text-center text-xs text-slate-400 py-8">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-8 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                    <p>Start a conversation with {selectedPartner.name}.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-1 ${
                            isMe
                              ? 'bg-nexus-600 text-white rounded-br-sm'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'
                          }`}
                        >
                          {!isMe && (
                            <p className="text-[10px] font-bold text-nexus-400">{msg.senderName}</p>
                          )}
                          {msg.subject && isMe && (
                            <p className="text-[10px] font-bold text-nexus-200 opacity-80">{msg.subject}</p>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <div className={`flex items-center gap-1 text-[10px] ${isMe ? 'text-nexus-200' : 'text-slate-500'}`}>
                            <Clock className="w-3 h-3" />
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-slate-800">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                      required
                    />
                    {subject && (
                      <button
                        type="button"
                        onClick={() => setSubject('')}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
                        title="Clear subject"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      ref={textareaRef}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Type your message..."
                      rows={2}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 resize-none"
                      required
                    />
                    <button
                      type="submit"
                      disabled={sending || !body.trim() || !subject.trim()}
                      className="px-4 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl disabled:opacity-40 self-end"
                    >
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : showSellerPicker ? null : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="space-y-3">
                <Inbox className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">Select a conversation or start a new chat</p>
                <button
                  onClick={() => {
                    setShowSellerPicker(true);
                    loadSellers();
                  }}
                  className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold"
                >
                  Browse Sellers
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

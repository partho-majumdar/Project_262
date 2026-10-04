import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import {
  Send,
  MessageSquare,
  Search,
  User,
  RefreshCw,
  Clock,
  ArrowLeft,
} from 'lucide-react';

export default function SellerSupportPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('list'); // list | chat
  const messagesEndRef = useRef(null);

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const res = await axiosClient.get('/support/seller/customers');
      const data = res.data?.data || res.data || [];
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load customer conversations', err);
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

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedPartner && view === 'chat') {
      loadMessages(selectedPartner.id);
    }
  }, [selectedPartner, view]);

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
    setView('chat');
  };

  const handleBack = () => {
    setView('list');
    setSelectedPartner(null);
    setMessages([]);
    loadConversations();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedPartner || !body.trim()) return;
    setSending(true);
    const existingSubject = messages.find((m) => m.senderId === user.id)?.subject || 'Re: Support';
    const tempMessage = {
      id: 'temp-' + Date.now(),
      senderId: user.id,
      senderName: user.firstName + ' ' + user.lastName,
      subject: existingSubject,
      message: body.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setBody('');

    try {
      await axiosClient.post('/support/send', {
        receiverId: selectedPartner.id,
        subject: existingSubject,
        message: tempMessage.message,
      });
      await loadMessages(selectedPartner.id);
      await loadConversations();
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
        {view === 'list' ? (
          /* Conversation List */
          <div className="w-full sm:w-80 border-r border-slate-800 flex flex-col bg-slate-900/40">
            <div className="p-4 border-b border-slate-800 space-y-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" /> Customer Messages
              </h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customers..."
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
                <div className="p-4 text-center text-xs text-slate-500">
                  No customer messages yet.
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
                        isSelected ? 'bg-indigo-950/60 border-l-2 border-l-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white truncate">{partnerName}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">{formatTime(conv.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{getLastMessage(conv)}</p>
                          {conv.subject && (
                            <p className="text-[10px] text-indigo-400 font-mono truncate mt-0.5">{conv.subject}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Chat Area */
          <div className="hidden sm:flex flex-1 flex-col bg-slate-950/60">
            {selectedPartner ? (
              <>
                <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                  <button
                    onClick={handleBack}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{selectedPartner.name}</p>
                    <p className="text-[10px] text-slate-400">{selectedPartner.email}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="text-center text-xs text-slate-400 py-8">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-8">
                      No messages yet. Waiting for customer inquiry.
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
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'
                            }`}
                          >
                            {!isMe && (
                              <p className="text-[10px] font-bold text-indigo-400">{msg.senderName}</p>
                            )}
                            {msg.subject && isMe && (
                              <p className="text-[10px] font-bold text-indigo-200 opacity-80">{msg.subject}</p>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            <div className={`flex items-center gap-1 text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-500'}`}>
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
                  <div className="flex gap-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Reply to customer..."
                      rows={2}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 resize-none"
                      required
                    />
                    <button
                      type="submit"
                      disabled={sending || !body.trim()}
                      className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-40 self-end"
                    >
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div className="space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-400">Select a customer conversation to reply</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

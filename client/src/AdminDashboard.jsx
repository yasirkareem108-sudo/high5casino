import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LogOut, Send, Paperclip, Inbox, CheckCircle2, XCircle, Loader2, ShieldCheck, Bell, X, ArrowLeft,
} from 'lucide-react';
import { socket, API_BASE, safeJson } from './socket';
import { subscribeAdminToPush } from './push';
import { setBadge, clearBadge } from './badge';

const TOKEN_KEY = 'h5c_admin_token';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Two-tone notification chime via Web Audio — no external sound file needed
function playNotifySound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    // audio not available (e.g. blocked before first user gesture) — toast still shows
  }
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [authed, setAuthed] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [authTick, setAuthTick] = useState(0);

  const selectedIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Unread alerts live on the server (per conversation), so they survive reloads and are the
  // same on every admin device. The app-icon badge is simply their sum.
  const totalUnread = conversations.reduce((sum, c) => sum + (c.adminUnread || 0), 0);

  // Wait for the first load so a badge set by a push while the app was closed isn't wiped
  // to 0 before the real count arrives.
  useEffect(() => {
    if (authed && conversationsLoaded) setBadge(totalUnread);
  }, [authed, conversationsLoaded, totalUnread]);

  const markRead = useCallback((id) => {
    setConversations((prev) => prev.map((c) => (c._id === id ? { ...c, adminUnread: 0 } : c)));
    socket.emit('admin:read', id);
  }, []);

  // Coming back to a tab that has a conversation open counts as reading whatever arrived meanwhile.
  useEffect(() => {
    const onVisible = () => {
      const id = selectedIdRef.current;
      if (document.visibilityState !== 'visible' || !id) return;
      const open = conversationsRef.current.find((c) => c._id === id);
      if (open?.adminUnread > 0) markRead(id);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  const fetchConversations = useCallback(async (activeToken) => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data);
      setConversationsLoaded(true);
    } catch {
      // ignore — list stays empty, real-time updates will still arrive via socket
    }
  }, []);

  // Socket listeners (registered once)
  useEffect(() => {
    const onAuthed = () => {
      setAuthed(true);
      setAuthTick((t) => t + 1); // also fires on reconnect, so anything missed while offline is re-fetched
    };
    const onAuthError = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAuthed(false);
    };
    const onConversationNew = (conv) => {
      setConversations((prev) => [conv, ...prev]);
    };
    const onConversationUpdate = (update) => {
      // If the admin is looking at this conversation right now, what just arrived is already read.
      const beingRead =
        update.conversationId === selectedIdRef.current &&
        document.visibilityState === 'visible' &&
        update.adminUnread > 0;

      setConversations((prev) => {
        const next = prev.map((c) =>
          c._id === update.conversationId
            ? {
                ...c,
                userName: update.userName ?? c.userName,
                email: update.email ?? c.email,
                lastMessageText: update.lastMessageText ?? c.lastMessageText,
                lastMessageAt: update.lastMessageAt ?? c.lastMessageAt,
                adminUnread: beingRead ? 0 : update.adminUnread ?? c.adminUnread ?? 0,
              }
            : c
        );
        return next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
      if (beingRead) socket.emit('admin:read', update.conversationId);
    };
    const onMessageNew = (msg) => {
      if (msg.conversationId === selectedIdRef.current) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
    };
    const onDepositUpdated = (u) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === u.messageId ? { ...m, meta: { ...m.meta, status: u.status } } : m))
      );
    };
    const onNotify = (payload) => {
      playNotifySound();
      const toastId = `${payload.conversationId}-${Date.now()}`;
      setToasts((prev) => [...prev, { id: toastId, ...payload }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 7000);
    };

    socket.on('admin:authed', onAuthed);
    socket.on('admin:auth_error', onAuthError);
    socket.on('conversation:new', onConversationNew);
    socket.on('conversation:update', onConversationUpdate);
    socket.on('message:new', onMessageNew);
    socket.on('deposit:updated', onDepositUpdated);
    socket.on('admin:notify', onNotify);

    return () => {
      socket.off('deposit:updated', onDepositUpdated);
      socket.off('admin:authed', onAuthed);
      socket.off('admin:auth_error', onAuthError);
      socket.off('conversation:new', onConversationNew);
      socket.off('conversation:update', onConversationUpdate);
      socket.off('message:new', onMessageNew);
      socket.off('admin:notify', onNotify);
    };
  }, []);

  // Authenticate the socket whenever we have a token
  useEffect(() => {
    if (!token) return;
    const authenticate = () => socket.emit('admin:auth', token);
    if (socket.connected) authenticate();
    socket.on('connect', authenticate);
    return () => socket.off('connect', authenticate);
  }, [token]);

  useEffect(() => {
    if (authed && token) fetchConversations(token);
  }, [authed, token, authTick, fetchConversations]);

  useEffect(() => {
    if (authed && token) subscribeAdminToPush(token);
  }, [authed, token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAuthed(false);
    setConversations([]);
    setConversationsLoaded(false);
    setMessages([]);
    setSelectedId(null);
    clearBadge();
  };

  const selectConversation = async (id) => {
    setSelectedId(id);
    setMessages([]);
    markRead(id);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeJson(res);
      setMessages(data);
    } catch {
      // conversation stays empty on failure
    }
    socket.emit('admin:join_conversation', id);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text || !selectedId) return;
    socket.emit('admin:message', { conversationId: selectedId, text });
    setMessageInput('');
  };

  // Deposits created before status tracking existed have no depositId — fall back to a plain reply.
  const decideDeposit = (message, decision) => {
    if (!selectedId) return;
    if (message.meta?.depositId) {
      socket.emit('admin:deposit_decision', { depositId: message.meta.depositId, decision });
      return;
    }
    const game = message.meta?.game;
    const text =
      decision === 'approved'
        ? `✅ Your $${Number(message.meta?.amount).toFixed(2)} deposit for ${game} has been approved and credited. Enjoy!`
        : `❌ Your deposit request for ${game} could not be verified. Please reach out here with more details.`;
    socket.emit('admin:message', { conversationId: selectedId, text });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      const data = await safeJson(res);
      if (data.url) socket.emit('admin:message', { conversationId: selectedId, imageUrl: data.url });
    } catch {
      // upload failed silently — demo scope
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!token || !authed) {
    return (
      <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-sm bg-[#0D111A] border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-amber-400" />
            <h1 className="text-lg font-black text-white">Staff Login</h1>
          </div>
          <p className="text-[11px] text-gray-500 mb-5">High 5 Casino — Support & Deposit Inbox</p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
              className="w-full bg-[#131824] border border-gray-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500/80"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full bg-[#131824] border border-gray-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500/80"
            />
            {loginError && <p className="text-[11px] text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-sm disabled:opacity-50 hover:brightness-110 transition-all"
            >
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c._id === selectedId);

  return (
    <div className="h-dvh bg-[#07090E] text-white flex font-sans overflow-hidden">
      {/* New Deposit Notifications */}
      <div className="fixed top-3 right-3 left-3 sm:left-auto sm:top-4 sm:right-4 z-[200] flex flex-col gap-2 sm:w-80">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              selectConversation(t.conversationId);
              setToasts((prev) => prev.filter((x) => x.id !== t.id));
            }}
            className="text-left bg-[#131824] border border-amber-500/50 rounded-xl p-3 shadow-2xl flex items-start gap-2 animate-pulse hover:animate-none"
          >
            <Bell size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">New Deposit Request</p>
              <p className="text-[11px] text-gray-400 truncate">
                {t.userName} — ${Number(t.amount).toFixed(2)} on {t.game}
              </p>
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
              }}
              className="text-gray-500 hover:text-white shrink-0"
            >
              <X size={14} />
            </span>
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <aside
        className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-72 bg-[#0D111A] md:border-r border-gray-800/80 flex-col shrink-0 min-w-0`}
      >
        <div className="px-4 py-3 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-amber-400" />
            <h2 className="text-xs font-black uppercase tracking-wide">Support Inbox</h2>
            {totalUnread > 0 && (
              <span
                data-testid="total-unread"
                className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <button onClick={handleLogout} aria-label="Log out" className="p-2 -mr-2 text-gray-400 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-[11px] text-gray-600 text-center mt-6 px-4">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => selectConversation(c._id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-900 transition-all ${
                selectedId === c._id ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'hover:bg-[#131824]'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-white truncate">{c.userName}</span>
                <span className="text-[9px] text-gray-500 shrink-0 ml-2">{timeAgo(c.lastMessageAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-gray-500 truncate">{c.lastMessageText || 'No messages yet'}</p>
                {c.adminUnread > 0 && (
                  <span
                    data-testid="conv-unread"
                    className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shrink-0"
                  >
                    {c.adminUnread > 99 ? '99+' : c.adminUnread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Message Thread */}
      <main className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            Select a conversation to start chatting
          </div>
        ) : (
          <>
            <div className="px-3 md:px-5 py-3 border-b border-gray-800/80 bg-[#0D111A] flex items-center gap-2">
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Back to inbox"
                className="md:hidden p-2 -ml-1 text-gray-300 hover:text-white shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{selectedConv?.userName}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {selectedConv?.email || `Guest — ${selectedConv?.userId}`}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3">
              {messages.map((m) => (
                <div key={m._id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  {m.type === 'deposit_card' ? (
                    <div className="w-full max-w-[92%] md:max-w-sm bg-[#131824] border border-amber-500/30 rounded-xl p-3 text-xs space-y-1.5">
                      <p className="text-amber-400 font-black uppercase text-[10px] tracking-wide mb-1">
                        💳 Deposit Request
                      </p>
                      {m.meta?.name && (
                        <div className="flex justify-between gap-3"><span className="text-gray-500 shrink-0">Player</span><span className="text-white font-semibold text-right break-words min-w-0">{m.meta.name}</span></div>
                      )}
                      {m.meta?.email && (
                        <div className="flex justify-between gap-3"><span className="text-gray-500 shrink-0">Email</span><span className="text-white font-semibold text-right break-all min-w-0">{m.meta.email}</span></div>
                      )}
                      <div className="flex justify-between gap-3"><span className="text-gray-500 shrink-0">Game</span><span className="text-white font-semibold text-right break-words min-w-0">{m.meta?.game}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-500 shrink-0">Method</span><span className="text-white font-semibold text-right break-words min-w-0">{m.meta?.method}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-500 shrink-0">Amount</span><span className="text-emerald-400 font-bold">${Number(m.meta?.amount).toFixed(2)}</span></div>
                      {m.meta?.status === 'approved' || m.meta?.status === 'rejected' ? (
                        <p className={`pt-2 font-bold ${m.meta.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.meta.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                        </p>
                      ) : (
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => decideDeposit(m, 'approved')}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 md:py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] md:text-[10px] font-bold hover:bg-emerald-500/25 transition-all"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                          <button
                            onClick={() => decideDeposit(m, 'rejected')}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 md:py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-[11px] md:text-[10px] font-bold hover:bg-red-500/25 transition-all"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ) : m.type === 'image' ? (
                    <img
                      src={`${API_BASE}${m.imageUrl}`}
                      alt="attachment"
                      className="max-w-[80%] md:max-w-[70%] rounded-xl border border-gray-800"
                    />
                  ) : (
                    <div
                      className={`max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-xl text-sm md:text-xs break-words ${
                        m.sender === 'admin' ? 'bg-amber-500 text-black' : 'bg-[#131824] text-gray-200'
                      }`}
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="border-t border-gray-800/80 p-3 flex items-center gap-2 bg-[#0D111A]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="admin-file-upload"
              />
              <label
                htmlFor="admin-file-upload"
                aria-label="Attach image"
                className="w-9 h-9 shrink-0 rounded-lg bg-[#131824] border border-gray-800 flex items-center justify-center text-gray-400 hover:text-amber-400 hover:border-amber-500/50 cursor-pointer transition-all"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              </label>
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Reply to player..."
                className="flex-1 min-w-0 bg-[#131824] border border-gray-800 rounded-lg px-3 py-2 text-base md:text-xs text-white focus:outline-none focus:border-amber-500/60"
              />
              <button type="submit" aria-label="Send" className="w-9 h-9 shrink-0 rounded-lg bg-amber-500 text-black flex items-center justify-center hover:brightness-110 transition-all">
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

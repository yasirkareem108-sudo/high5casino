import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, X, Send, Paperclip, Loader2, LogIn, UserPlus } from 'lucide-react';
import { API_BASE, safeJson } from './socket';
import { usePlayer } from './PlayerContext';

const STATUS_LABEL = {
  pending: '⏳ Pending review',
  approved: '✅ Approved',
  rejected: '❌ Rejected',
};

export default function ChatWidget() {
  const navigate = useNavigate();
  const { user, chatOpen, setChatOpen, messages, chatReady, sendText, sendImage } = usePlayer();
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !chatReady) return;
    sendText(text);
    setInput('');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chatReady) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      const data = await safeJson(res);
      if (data.url) sendImage(data.url);
    } catch {
      // upload failed silently — demo scope
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        onClick={() => setChatOpen((o) => !o)}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black flex items-center justify-center shadow-2xl shadow-amber-500/30 hover:scale-105 transition-all"
      >
        {chatOpen ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {chatOpen && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-5 z-40 sm:w-80 h-[min(70dvh,480px)] sm:h-[420px] bg-[#0D111A] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-[#131824] border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <MessageSquare size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">24/7 Live Support</p>
                <p className="text-[10px] text-emerald-400">● Online</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="p-1 text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {!user ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-6">
              <MessageSquare size={28} className="text-amber-400" />
              <p className="text-sm font-bold text-white">Log in to chat with support</p>
              <p className="text-[11px] text-gray-500">
                Your conversation is saved to your account, so it&apos;s always here when you come back.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#131824] border border-gray-700 hover:border-amber-500/50 transition-all"
                >
                  <LogIn size={14} className="text-amber-400" /> Login
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-black bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 transition-all"
                >
                  <UserPlus size={14} /> Register
                </button>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {!chatReady && (
                  <div className="text-[11px] text-gray-500 text-center mt-2">Loading your conversation…</div>
                )}
                {chatReady && messages.length === 0 && (
                  <div className="text-[11px] text-gray-500 text-center mt-2">
                    👋 Welcome, {user.name}! Ask us anything, or click a game to start a deposit.
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m._id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.type === 'deposit_card' ? (
                      <div className="max-w-[85%] bg-[#131824] border border-amber-500/30 rounded-xl p-3 text-[11px] space-y-1">
                        <p className="text-amber-400 font-black uppercase text-[9px] tracking-wide mb-1">💳 Deposit Request</p>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Game</span><span className="text-white font-semibold text-right">{m.meta?.game}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Method</span><span className="text-white font-semibold text-right">{m.meta?.method}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Amount</span><span className="text-emerald-400 font-bold">${Number(m.meta?.amount).toFixed(2)}</span></div>
                        {STATUS_LABEL[m.meta?.status] && (
                          <p className="text-gray-400 pt-1 border-t border-gray-800 mt-1">{STATUS_LABEL[m.meta.status]}</p>
                        )}
                      </div>
                    ) : m.type === 'image' ? (
                      <img src={`${API_BASE}${m.imageUrl}`} alt="attachment" className="max-w-[75%] rounded-xl border border-gray-800" />
                    ) : (
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-xs break-words ${
                          m.sender === 'admin' ? 'bg-[#131824] text-gray-200' : 'bg-amber-500 text-black'
                        }`}
                      >
                        {m.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} className="border-t border-gray-800 p-2 flex gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="chat-file-upload"
                />
                <label
                  htmlFor="chat-file-upload"
                  aria-label="Attach image"
                  className="w-9 h-9 shrink-0 rounded-lg bg-[#131824] border border-gray-800 flex items-center justify-center text-gray-400 hover:text-amber-400 hover:border-amber-500/50 cursor-pointer transition-all"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                </label>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 min-w-0 bg-[#131824] border border-gray-800 rounded-lg px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-amber-500/60"
                />
                <button type="submit" aria-label="Send" className="w-9 h-9 shrink-0 rounded-lg bg-amber-500 text-black flex items-center justify-center">
                  <Send size={14} />
                </button>
              </form>
              <p className="text-[9px] text-gray-600 text-center pb-2 shrink-0">
                Saved to your account. Never share passwords or card numbers here.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}

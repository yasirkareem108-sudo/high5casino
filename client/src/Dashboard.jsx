import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LogOut, MessageSquare, Gamepad2, Loader2, Clock, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import { API_BASE, safeJson } from './socket';
import { usePlayer } from './PlayerContext';
import ChatWidget from './ChatWidget';

const STATUS_STYLE = {
  pending: { label: 'Pending', icon: Clock, cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  approved: { label: 'Approved', icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  rejected: { label: 'Rejected', icon: XCircle, cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Dashboard() {
  const { user, token, logout, setChatOpen, depositsVersion } = usePlayer();
  const [profile, setProfile] = useState(null);
  const [deposits, setDeposits] = useState(null);
  const [error, setError] = useState('');

  // Re-fetches whenever an admin decides one of this player's deposits (depositsVersion bumps).
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [meRes, depRes] = await Promise.all([
          fetch(`${API_BASE}/api/me`, { headers }),
          fetch(`${API_BASE}/api/me/deposits`, { headers }),
        ]);
        if (cancelled) return;
        if (meRes.status === 401 || depRes.status === 401) {
          logout();
          return;
        }
        const me = await safeJson(meRes);
        const dep = await safeJson(depRes);
        if (cancelled) return;
        setProfile(me.user);
        setDeposits(dep.deposits);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, logout, depositsVersion]);

  if (!user) return <Navigate to="/login" replace />;

  const shown = profile || user;
  const list = deposits || [];
  const approvedTotal = list.filter((d) => d.status === 'approved').reduce((sum, d) => sum + d.amount, 0);
  const pendingCount = list.filter((d) => d.status === 'pending').length;

  return (
    <div className="min-h-dvh bg-[#07090E] text-white font-sans">
      <header className="bg-[#0D111A]/90 border-b border-gray-800/80 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 text-black font-black flex items-center justify-center text-lg border border-yellow-300">
            5
          </div>
          <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 tracking-wider text-sm sm:text-lg whitespace-nowrap">
            HIGH 5 CASINO
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#131824] border border-gray-700/80 hover:border-amber-500/50 transition-all"
          >
            <Gamepad2 size={14} className="text-amber-400" /> <span className="hidden sm:inline">Lobby</span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#131824] border border-gray-700/80 hover:border-red-500/50 hover:text-red-400 transition-all"
          >
            <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-3 sm:p-6 space-y-5">
        <section className="bg-gradient-to-r from-amber-950/50 via-[#131824] to-[#0A0D14] border border-amber-500/30 rounded-2xl p-4 sm:p-6 flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 text-black font-black text-2xl flex items-center justify-center">
            {shown.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">My Account</p>
            <h1 className="text-lg sm:text-xl font-black truncate">{shown.name}</h1>
            <p className="text-xs text-gray-400 break-all">{shown.email}</p>
            {profile?.createdAt && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Requests', value: deposits ? list.length : '—' },
            { label: 'Pending', value: deposits ? pendingCount : '—' },
            { label: 'Approved', value: deposits ? `$${approvedTotal.toFixed(2)}` : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-[#131824] border border-gray-800 rounded-xl p-3 text-center min-w-0">
              <p className="text-base sm:text-xl font-black text-white truncate">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="flex gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-black hover:brightness-110 transition-all"
          >
            <MessageSquare size={15} /> Open my chat
          </button>
          <Link
            to="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#131824] border border-gray-700 text-white text-xs font-bold hover:border-amber-500/50 transition-all"
          >
            <Wallet size={15} className="text-amber-400" /> New deposit
          </Link>
        </section>

        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 mb-3">Deposit history</h2>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          {!deposits && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}
          {deposits && list.length === 0 && (
            <div className="bg-[#131824] border border-gray-800 rounded-xl p-6 text-center text-xs text-gray-500">
              No deposit requests yet. Pick a game in the lobby to make your first one.
            </div>
          )}
          <ul className="space-y-2">
            {list.map((d) => {
              const s = STATUS_STYLE[d.status] || STATUS_STYLE.pending;
              const Icon = s.icon;
              return (
                <li key={d._id} className="bg-[#131824] border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{d.game}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {d.method} · {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-emerald-400">${d.amount.toFixed(2)}</p>
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${s.cls}`}>
                      <Icon size={10} /> {s.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <ChatWidget />
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Gamepad2, Dices, Flame, Trophy, Wallet, ArrowUpRight,
  MessageSquare, Search, LogIn, UserPlus, Sparkles, Crown,
  Play, Volume2, Zap, X, Landmark, Send, Smartphone,
  CreditCard, DollarSign, Bitcoin, Clock, LogOut, Menu, LayoutDashboard, ChevronDown, ListChecks
} from 'lucide-react';
import { usePlayer } from './PlayerContext';
import { API_BASE, safeJson } from './socket';
import ChatWidget from './ChatWidget';

const NAV_ITEMS = [
  { name: 'Lobby Home', icon: Home, tab: 'all' },
  { name: 'All Slots 777', icon: Sparkles, tab: 'slots' },
  { name: 'Fish Games', icon: Flame, tab: 'fish' },
  { name: 'Live Casino', icon: Gamepad2, tab: null },
  { name: 'Arcade Arena', icon: Dices, tab: 'arcade' },
  { name: 'VIP Tables', icon: Trophy, tab: 'table' },
];

const CATEGORY_LABELS = {
  fish: 'Fish Games',
  slots: 'Slots',
  arcade: 'Arcade',
  table: 'Table Games',
};

const PAYMENT_METHODS = [
  { id: 'paypal', name: 'PayPal', icon: Wallet },
  { id: 'chime', name: 'Chime', icon: Landmark },
  { id: 'zelle', name: 'Zelle', icon: Send },
  { id: 'googlepay', name: 'Google Pay', icon: Smartphone },
  { id: 'applepay', name: 'Apple Pay', icon: Smartphone },
  { id: 'venmo', name: 'Venmo', icon: Send },
  { id: 'stripe', name: 'Stripe', icon: CreditCard },
  { id: 'cashapp', name: 'Cash App', icon: DollarSign },
  { id: 'bitcoin', name: 'Bitcoin', icon: Bitcoin },
  { id: 'card', name: 'Card Payment', icon: CreditCard },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('all');
  const [jackpot, setJackpot] = useState(12849206.80);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const gamesRef = useRef(null);

  // Account + persistent chat thread live in PlayerContext (shared with the dashboard)
  const { user: player, token, logout, setChatOpen, sendDeposit, depositsVersion } = usePlayer();

  // This player's deposits — drives the first-deposit guide and the "pending" indicators.
  const [myDeposits, setMyDeposits] = useState(null);
  // Dismissing the guide is remembered per account, so a second new player on this device still sees it.
  const guideKey = player ? `h5c_guide_dismissed:${player.email}` : null;
  const [, setGuideTick] = useState(0);
  const guideDismissed = !!guideKey && localStorage.getItem(guideKey) === '1';
  useEffect(() => {
    if (!token) {
      setMyDeposits(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/me/deposits`, { headers: { Authorization: `Bearer ${token}` } })
      .then(safeJson)
      .then((data) => {
        if (!cancelled && Array.isArray(data.deposits)) setMyDeposits(data.deposits);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, depositsVersion]);
  const pendingCount = myDeposits ? myDeposits.filter((d) => d.status === 'pending').length : 0;
  const showGuide = !!player && myDeposits !== null && myDeposits.length === 0 && !guideDismissed;

  // Close the profile menu on outside click / Escape.
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setUserMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('touchstart', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('touchstart', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const scrollToGames = () => gamesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Mock Deposit Flow — the summary card is sent into the player's chat thread,
  // no real payment is ever processed
  const [depositGame, setDepositGame] = useState(null);
  const [depositStep, setDepositStep] = useState('form');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount] = useState('');

  // Live Progressive Jackpot Motion
  useEffect(() => {
    const interval = setInterval(() => {
      setJackpot((prev) => prev + Math.random() * 3.40);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const openDeposit = (game) => {
    if (!player) {
      // Remember the game so its deposit window opens right after they log in.
      navigate('/login', { state: { from: '/', openGame: game.name } });
      return;
    }
    setDepositGame(game);
    setDepositStep('form');
    setSelectedMethod(null);
    setAmount('');
  };

  const closeDeposit = () => {
    setDepositGame(null);
  };

  // The request goes into this player's own persistent thread and creates a tracked Deposit.
  const handleDepositSubmit = (e) => {
    e.preventDefault();
    if (!selectedMethod || !amount || Number(amount) <= 0) return;
    setDepositStep('pending');
    sendDeposit({
      game: depositGame.name,
      method: PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.name,
      amount: Number(amount),
    });
  };

  const goToChat = () => {
    closeDeposit();
    setChatOpen(true);
  };

  const games = [
    { id: 1, name: 'Orion Star', category: 'slots', thumbnail: '/assets/games/orion-star.svg', badge: 'POPULAR', rtp: '97.5%' },
    { id: 2, name: 'Juwa 777', category: 'slots', thumbnail: '/assets/games/juwa-777.svg', badge: 'HOT', rtp: '98.4%' },
    { id: 3, name: 'Game Vault 99', category: 'fish', thumbnail: '/assets/games/game-vault-99.svg', badge: 'JACKPOT', rtp: '96.9%' },
    { id: 4, name: 'Fire Kirin', category: 'fish', thumbnail: '/assets/games/fire-kirin.jpg', badge: 'HOT', rtp: '98.8%' },
    { id: 5, name: 'Milky Way', category: 'fish', thumbnail: '/assets/games/milky-way.svg', badge: 'POPULAR', rtp: '97.9%' },
    { id: 6, name: 'Panda Master', category: 'arcade', thumbnail: '/assets/games/panda-master.svg', badge: 'NEW', rtp: '99.1%' },
    { id: 7, name: 'Vblink', category: 'arcade', thumbnail: '/assets/games/vblink.svg', badge: 'HOT', rtp: '98.2%' },
    { id: 8, name: 'Ultra Panda', category: 'arcade', thumbnail: '/assets/games/ultra-panda.svg', badge: 'MEGA', rtp: '98.6%' },
    { id: 9, name: 'Yolo', category: 'arcade', thumbnail: '/assets/games/yolo.svg', badge: 'NEW', rtp: '97.3%' },
    { id: 10, name: 'Cash Master', category: 'slots', thumbnail: '/assets/games/cash-master.svg', badge: 'POPULAR', rtp: '97.7%' },
    { id: 11, name: 'Vegas Sweep', category: 'fish', thumbnail: '/assets/games/vegas-sweep.svg', badge: 'LIVE', rtp: '97.0%' },
    { id: 12, name: 'Juwa 2.0', category: 'slots', thumbnail: '/assets/games/juwa-2-0.svg', badge: 'NEW', rtp: '98.0%' },
    { id: 13, name: 'Game Vault', category: 'fish', thumbnail: '/assets/games/game-vault.svg', badge: 'JACKPOT', rtp: '96.5%' },
    { id: 14, name: 'Game Room', category: 'fish', thumbnail: '/assets/games/game-room.svg', badge: 'POPULAR', rtp: '97.4%' },
    { id: 15, name: 'Megas Spin', category: 'slots', thumbnail: '/assets/games/megas-spin.svg', badge: 'HOT', rtp: '98.9%' },
    { id: 16, name: 'Mr All In One', category: 'slots', thumbnail: '/assets/games/mr-all-in-one.svg', badge: 'NEW', rtp: '97.6%' },
    { id: 17, name: 'Cash Machine', category: 'slots', thumbnail: '/assets/games/cash-machine.svg', badge: 'MEGA', rtp: '99.4%' },
    { id: 18, name: 'Cash Frenzy', category: 'slots', thumbnail: '/assets/games/cash-frenzy.svg', badge: 'HOT', rtp: '98.3%' },
    { id: 19, name: 'Mafia', category: 'arcade', thumbnail: '/assets/games/mafia.svg', badge: 'POPULAR', rtp: '97.2%' },
    { id: 20, name: 'Mohhla', category: 'arcade', thumbnail: '/assets/games/mohhla.svg', badge: 'NEW', rtp: '96.8%' },
    { id: 21, name: 'High Stake', category: 'table', thumbnail: '/assets/games/high-stake.svg', badge: 'LIVE', rtp: '97.8%' },
    { id: 22, name: 'E Game', category: 'arcade', thumbnail: '/assets/games/e-game.svg', badge: 'HOT', rtp: '98.1%' },
    { id: 23, name: 'Blue Dragon', category: 'fish', thumbnail: '/assets/games/blue-dragon.svg', badge: 'JACKPOT', rtp: '99.0%' },
  ];

  // Arrived from login/register after tapping a game: open that game's deposit window, once.
  useEffect(() => {
    const wanted = location.state?.openGame;
    if (!wanted || !player) return;
    navigate(location.pathname, { replace: true, state: null });
    const game = games.find((g) => g.name === wanted);
    if (game) openDeposit(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, player]);

  const filteredGames = games.filter(
    (g) => (activeTab === 'all' || g.category === activeTab) &&
           g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* Top Live Winner Stream Ticker */}
      <div className="bg-gradient-to-r from-amber-950/80 via-[#0E131F] to-amber-950/80 border-b border-amber-500/20 text-[11px] py-1.5 px-3 sm:px-6 flex justify-between items-center gap-3 text-gray-300">
        <div className="flex items-center gap-2 shrink-0">
          <Volume2 size={13} className="text-amber-400 animate-pulse" />
          <span className="text-amber-400 font-extrabold uppercase tracking-wider text-[10px]">
            LIVE<span className="hidden sm:inline"> PAYOUTS:</span>
          </span>
        </div>
        <div className="flex gap-8 font-medium overflow-hidden whitespace-nowrap text-xs min-w-0">
          <span>🎉 Player <strong className="text-amber-300">Alex_NY</strong> won <strong className="text-emerald-400">$12,450</strong> on Fire Kirin</span>
          <span className="hidden sm:inline">💎 Player <strong className="text-amber-300">VegasKing</strong> won <strong className="text-emerald-400">$8,200</strong> on Ultra Panda</span>
          <span className="hidden md:inline">🔥 Player <strong className="text-amber-300">Sarah_777</strong> won <strong className="text-emerald-400">$45,000</strong> Mega Jackpot</span>
        </div>
      </div>

      {/* Main Top Header */}
      <header className="bg-[#0D111A]/90 backdrop-blur-md border-b border-gray-800/80 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-xl">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="lg:hidden p-2 -ml-1 text-gray-300 hover:text-white shrink-0"
          >
            <Menu size={22} />
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 text-black font-black flex items-center justify-center text-lg sm:text-xl shadow-lg shadow-amber-500/25 border border-yellow-300">
            5
          </div>
          <div className="min-w-0">
            <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 tracking-wider text-sm sm:text-lg block leading-none whitespace-nowrap">
              HIGH 5 CASINO
            </span>
            <span className="hidden sm:block text-[9px] tracking-[0.25em] text-amber-400/80 uppercase font-semibold">
              Vegas VIP Gaming
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md mx-6 hidden md:block">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search 1,000+ slots, live casino & fish games..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131824] border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500/80 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Single Right Auth Bar (Clean & Non-repetitive) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {player ? (
            <>
              <button
                onClick={scrollToGames}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 shadow-lg shadow-amber-500/25 transition-all whitespace-nowrap"
              >
                <Wallet size={14} /> Deposit
              </button>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  data-testid="user-menu"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="Account menu"
                  className="flex items-center gap-2 pl-1.5 pr-2 sm:pr-2.5 py-1.5 rounded-xl bg-[#131824] border border-gray-700/80 hover:border-amber-500/50 transition-all"
                >
                  <span className="relative w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 text-black text-xs font-black flex items-center justify-center">
                    {player.name?.[0]?.toUpperCase()}
                    {pendingCount > 0 && (
                      <span
                        data-testid="pending-badge"
                        className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#0D111A]"
                      >
                        {pendingCount}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:block text-xs font-bold text-white max-w-[7rem] truncate">{player.name}</span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-64 bg-[#0D111A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-[70]">
                    <div className="px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-amber-950/40 to-transparent">
                      <p className="text-sm font-bold text-white truncate">{player.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{player.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        role="menuitem"
                        data-testid="menu-account"
                        onClick={() => { setUserMenuOpen(false); navigate('/dashboard'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-[#131824] transition-colors"
                      >
                        <LayoutDashboard size={16} className="text-amber-400" /> My Account
                      </button>
                      <button
                        role="menuitem"
                        data-testid="menu-deposits"
                        onClick={() => { setUserMenuOpen(false); navigate('/dashboard'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-[#131824] transition-colors"
                      >
                        <ListChecks size={16} className="text-amber-400" /> My Deposits
                        {pendingCount > 0 && (
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black">
                            {pendingCount} pending
                          </span>
                        )}
                      </button>
                      <button
                        role="menuitem"
                        data-testid="menu-chat"
                        onClick={() => { setUserMenuOpen(false); setChatOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-[#131824] transition-colors"
                      >
                        <MessageSquare size={16} className="text-amber-400" /> Support Chat
                      </button>
                    </div>
                    <div className="border-t border-gray-800 py-1">
                      <button
                        role="menuitem"
                        data-testid="menu-logout"
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={16} /> Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-[#131824] border border-gray-700/80 hover:border-amber-500/50 hover:bg-[#1A2131] transition-all"
              >
                <LogIn size={14} className="text-amber-400" /> Login
              </button>
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-xs font-black text-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 whitespace-nowrap"
              >
                <UserPlus size={14} className="hidden min-[400px]:block" /> <span className="hidden sm:inline">VIP </span>Register
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile menu drawer (below lg, where the sidebar is hidden) */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[90] flex" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <nav
            className="relative w-72 max-w-[85vw] h-full bg-[#0D111A] border-r border-gray-800/80 p-4 overflow-y-auto flex flex-col gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500/80">Main Menu</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-2 -mr-2 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.tab && item.tab === activeTab;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.tab) setActiveTab(item.tab);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                    active
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-extrabold'
                      : 'text-gray-300 hover:bg-[#131824] hover:text-white font-medium'
                  }`}
                >
                  <Icon size={18} /> {item.name}
                </button>
              );
            })}
            <div className="pt-4 mt-3 border-t border-gray-800/80 flex flex-col gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 px-3 mb-1">Account Action</span>
              <button
                onClick={() => navigate(player ? '/dashboard' : '/login')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-300 hover:bg-[#131824] hover:text-amber-400 transition-all"
              >
                <LayoutDashboard size={18} /> {player ? 'My Dashboard' : 'Login / Dashboard'}
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-300 hover:bg-[#131824] hover:text-amber-400 transition-all">
                <Wallet size={18} /> Fast Deposit
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-300 hover:bg-[#131824] hover:text-amber-400 transition-all">
                <ArrowUpRight size={18} /> Instant Cashout
              </button>
              <button
                onClick={() => {
                  setChatOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-300 hover:bg-[#131824] hover:text-amber-400 transition-all"
              >
                <MessageSquare size={18} /> 24/7 Live Support
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Web App 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sleek Navigation Menu */}
        <aside className="w-52 bg-[#0D111A] border-r border-gray-800/80 p-3 hidden lg:flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500/80 px-3">
              Main Menu
            </div>
            
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => item.tab && setActiveTab(item.tab)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${
                      item.tab && item.tab === activeTab
                        ?'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-extrabold shadow-sm' 
                        : 'text-gray-400 hover:bg-[#131824] hover:text-white font-medium'
                    }`}
                  >
                    <Icon size={16} />
                    {item.name}
                  </button>
                );
              })}

              <div className="pt-4 border-t border-gray-800/80 my-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 px-3 mb-2">
                  Account Action
                </div>
                <button
                  onClick={() => navigate(player ? '/dashboard' : '/login')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:bg-[#131824] hover:text-amber-400 transition-all"
                >
                  <LayoutDashboard size={16} /> {player ? 'My Dashboard' : 'Login / Dashboard'}
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:bg-[#131824] hover:text-amber-400 transition-all">
                  <Wallet size={16} /> Fast Deposit
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:bg-[#131824] hover:text-amber-400 transition-all">
                  <ArrowUpRight size={16} /> Instant Cashout
                </button>
                <button
                  onClick={() => setChatOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:bg-[#131824] hover:text-amber-400 transition-all"
                >
                  <MessageSquare size={16} /> 24/7 Live Support
                </button>
              </div>
            </nav>
          </div>

          {/* VIP Badge */}
          <div className="bg-gradient-to-r from-amber-950/40 to-[#131824] border border-amber-500/20 rounded-xl p-3 text-center">
            <Crown size={20} className="text-yellow-400 mx-auto mb-1 animate-bounce" />
            <p className="text-[11px] font-extrabold text-white">VIP Royalty Club</p>
            <p className="text-[9px] text-gray-400 mt-0.5">Instant 10% Weekly Cashback</p>
          </div>
        </aside>

        {/* Center Main Games & Showcase */}
        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-y-auto">

          {/* Search (the header search bar is hidden below md) */}
          <div className="md:hidden relative mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131824] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-base text-white focus:outline-none focus:border-amber-500/80"
            />
          </div>

          {/* Animated Hero Jackpot Showcase Banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-amber-950/60 via-[#131824] to-[#0A0D14] border border-amber-500/30 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6 shadow-2xl mb-6 md:mb-8">
            <div className="max-w-xl z-10 w-full md:w-auto">
              <span
                data-testid="hero-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-3 uppercase tracking-wider max-w-full"
              >
                <Zap size={13} className="text-yellow-400 fill-yellow-400 shrink-0" />
                <span className="truncate">
                  {player ? `Welcome, ${player.name.split(' ')[0]}` : '$1,000 Free Welcome Bonus'}
                </span>
              </span>
              <h1 className="text-2xl min-[400px]:text-3xl md:text-5xl font-black tracking-tight leading-tight mb-2">
                LAS VEGAS <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500">JACKPOT ARENA</span>
              </h1>
              <p className="text-xs text-gray-300 mb-5">
                America's premier online casino platform with 99%+ RTP certified slots & instant crypto/fiat payouts.
              </p>
              <button
                onClick={scrollToGames}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-black text-sm tracking-wider flex items-center gap-2.5 shadow-xl shadow-amber-500/30 hover:scale-105 transition-all"
              >
                <Play fill="black" size={16} /> {player ? 'CHOOSE A GAME' : 'START PLAYING NOW'}
              </button>
            </div>

            {/* Live Progressive Animated Counter Box */}
            <div className="bg-black/80 backdrop-blur-md border border-amber-500/50 rounded-2xl p-4 md:p-5 text-center w-full md:w-auto md:min-w-[270px] shadow-2xl z-10">
              <p className="text-[11px] text-amber-400 font-black uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
                <Trophy size={14} /> Progressive Vegas Jackpot
              </p>
              <p className="text-xl min-[400px]:text-2xl md:text-3xl font-black font-mono text-yellow-300 tracking-wide md:tracking-wider">
                ${jackpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* First-deposit guide: shown until the player has made a deposit (or dismisses it) */}
          {showGuide && (
            <div data-testid="first-deposit-guide" className="relative mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-[#131824] to-[#0A0D14] p-4 sm:p-5">
              <button
                onClick={() => { localStorage.setItem(guideKey, '1'); setGuideTick((t) => t + 1); }}
                aria-label="Dismiss guide"
                className="absolute top-2.5 right-2.5 p-1.5 text-gray-500 hover:text-white"
              >
                <X size={16} />
              </button>
              <p className="text-sm font-black text-white mb-3 pr-8">Make your first deposit in 3 steps</p>
              <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ['1', 'Pick a game', 'Tap any game below to start.'],
                  ['2', 'Choose amount & method', 'Select how you\'d like to pay and enter the amount.'],
                  ['3', 'Track it', 'Our team confirms it in your chat. See the status under My Account.'],
                ].map(([n, title, text]) => (
                  <li key={n} className="flex gap-3">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-amber-500 text-black text-xs font-black flex items-center justify-center">{n}</span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-white">{title}</span>
                      <span className="block text-[11px] text-gray-400 leading-snug">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Pending deposits reminder */}
          {player && pendingCount > 0 && (
            <button
              onClick={() => navigate('/dashboard')}
              data-testid="pending-strip"
              className="w-full mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left hover:bg-amber-500/15 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-200 min-w-0">
                <Clock size={16} className="shrink-0" />
                <span className="truncate">
                  {pendingCount} deposit{pendingCount === 1 ? '' : 's'} waiting for confirmation
                </span>
              </span>
              <span className="text-[11px] font-bold text-amber-300 shrink-0">View →</span>
            </button>
          )}

          {/* Interactive Category Filter Bar */}
          <div ref={gamesRef} className="scroll-mt-24 flex justify-between items-center border-b border-gray-800/80 pb-3 gap-4 min-w-0">
            <div className="flex gap-2 overflow-x-auto min-w-0 pb-1">
              {[
                { id: 'all', name: 'All Games', icon: Sparkles },
                { id: 'fish', name: 'Fish Games', icon: Flame },
                { id: 'slots', name: 'Slots 777', icon: Zap },
                { id: 'arcade', name: 'Arcade', icon: Dices },
                { id: 'table', name: 'VIP Tables', icon: Trophy },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold shadow-md shadow-amber-500/20'
                        : 'bg-[#131824] text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dense Casino-Style Game Grid */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 mt-6">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                onClick={() => openDeposit(game)}
                className="group relative bg-[#131824] border border-gray-800 hover:border-amber-500/60 rounded-lg overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-lg cursor-pointer"
              >
                {/* Game Thumbnail Artwork */}
                <div className="relative aspect-[3/2] overflow-hidden bg-[#0B0E14]">
                  <img
                    src={game.thumbnail}
                    alt={game.name}
                    width={300}
                    height={200}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 select-none"
                  />

                  {/* Compact Badge */}
                  <span className="absolute top-1 left-1 bg-amber-500 text-black px-1 py-[1px] rounded text-[6px] font-black uppercase shadow-sm leading-none">
                    {game.badge}
                  </span>

                  {/* Hover Overlay Play Button */}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play fill="black" size={13} />
                    </button>
                  </div>
                </div>

                {/* Compact Footer */}
                <div className="px-1.5 py-1.5 bg-[#0F131C]">
                  <p className="text-[10px] leading-tight font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                    {game.name}
                    <span className="text-gray-500 font-normal"> — {CATEGORY_LABELS[game.category]}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

        </main>

        {/* Right Sidebar (Live Promos & VIP Benefits) */}
        <aside className="w-64 bg-[#0D111A] border-l border-gray-800/80 p-4 hidden xl:block shrink-0">
          <div className="space-y-5">
            
            {/* VIP Rewards Widget */}
            <div className="bg-[#131824] border border-amber-500/30 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={16} className="text-amber-400" />
                <h3 className="text-xs font-bold text-white">VIP Loyalty Benefits</h3>
              </div>
              <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                Unlock instant daily cashbacks, higher deposit limits, and a personal VIP manager.
              </p>
              <button className="w-full py-2 rounded-xl bg-[#1D2536] border border-gray-700 text-amber-300 text-xs font-bold hover:bg-amber-500 hover:text-black transition-all">
                Explore VIP Club
              </button>
            </div>

            {/* Promotions Showcase */}
            <div className="bg-gradient-to-br from-amber-950/50 via-[#131824] to-[#131824] border border-amber-500/40 rounded-2xl p-4 shadow-lg">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase mb-2">
                PROMO
              </span>
              <h3 className="text-xs font-extrabold text-white mb-1">100% DEPOSIT MATCH</h3>
              <p className="text-[10px] text-gray-400 mb-3">Double your first deposit up to $1,000 instantly.</p>
              <button className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-extrabold rounded-xl hover:brightness-110 transition-all shadow-md">
                Claim Welcome Bonus
              </button>
            </div>

          </div>
        </aside>

      </div>

      {/* Mock Deposit Flow Modal (UI-only demo — no real payment processing) */}
      {depositGame && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeDeposit}
        >
          {depositStep === 'form' ? (
            <div
              className="bg-[#0D111A] border border-amber-500/30 rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-5 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={closeDeposit} className="absolute top-3 right-3 text-gray-400 hover:text-white">
                <X size={18} />
              </button>

              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Deposit To Play</p>
              <h2 className="text-lg font-black text-white mb-1">{depositGame.name}</h2>
              <p className="text-[10px] text-gray-500 mb-4">
                Demo only — this simulates a deposit. No real payment is processed and no funds are charged.
              </p>

              <form onSubmit={handleDepositSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-bold block mb-2">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setSelectedMethod(m.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                            selectedMethod === m.id
                              ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                              : 'bg-[#131824] border-gray-800 text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <Icon size={14} /> {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-bold block mb-2">
                    Deposit Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#131824] border border-gray-800 rounded-xl pl-7 pr-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500/80"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedMethod || !amount || Number(amount) <= 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                >
                  Confirm Deposit
                </button>
              </form>
            </div>
          ) : (
            <div
              className="bg-[#0D111A] border border-amber-500/30 rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={closeDeposit} className="absolute top-3 right-3 text-gray-400 hover:text-white">
                <X size={18} />
              </button>

              <Clock size={40} className="text-amber-400 mx-auto mb-3 animate-pulse" />
              <h2 className="text-lg font-black text-white mb-1">Deposit Pending</h2>
              <p className="text-xs text-gray-400 mb-4">
                Simulated confirmation for demo purposes only — no funds were charged. This request has been sent to
                support chat for review.
              </p>

              <div className="bg-[#131824] border border-gray-800 rounded-xl p-4 text-left space-y-2 mb-5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Game</span>
                  <span className="text-white font-semibold">{depositGame.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Method</span>
                  <span className="text-white font-semibold">
                    {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.name}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Amount</span>
                  <span className="text-emerald-400 font-bold">${Number(amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={closeDeposit}
                  className="flex-1 py-3 rounded-xl bg-[#131824] border border-gray-700 text-white text-xs font-bold hover:border-amber-500/50 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={goToChat}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-black hover:brightness-110 transition-all"
                >
                  Continue in Chat →
                </button>
              </div>
              <button
                onClick={() => { closeDeposit(); navigate('/dashboard'); }}
                data-testid="view-deposits"
                className="mt-3 w-full py-2.5 text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors"
              >
                View my deposits →
              </button>
            </div>
          )}
        </div>
      )}

      <ChatWidget />
    </div>
  );
}

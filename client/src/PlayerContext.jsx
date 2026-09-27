import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { socket, API_BASE } from './socket';

const TOKEN_KEY = 'h5c_player_token';
const NAME_KEY = 'h5c_player_name';
const EMAIL_KEY = 'h5c_player_email';

const PlayerContext = createContext(null);
export const usePlayer = () => useContext(PlayerContext);

function readSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const name = localStorage.getItem(NAME_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  return token && name && email ? { token, user: { name, email } } : { token: null, user: null };
}

function writeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, user.name);
  localStorage.setItem(EMAIL_KEY, user.email);
}

function wipeSession() {
  [TOKEN_KEY, NAME_KEY, EMAIL_KEY].forEach((k) => localStorage.removeItem(k));
}

// Wraps every player-facing route (not /admin) so login state and the chat thread
// are shared between the lobby, dashboard and auth pages instead of re-created per page.
export function PlayerShell() {
  const [session, setSession] = useState(readSession);
  const { token, user } = session;

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatReady, setChatReady] = useState(false);
  const [depositsVersion, setDepositsVersion] = useState(0);
  const conversationIdRef = useRef(null);

  const login = useCallback((newToken, newUser) => {
    writeSession(newToken, newUser);
    setSession({ token: newToken, user: { name: newUser.name, email: newUser.email } });
  }, []);

  const logout = useCallback(() => {
    wipeSession();
    setSession({ token: null, user: null });
    setChatOpen(false);
    // A fresh socket drops the server-side room membership for the old account.
    socket.disconnect();
    socket.connect();
  }, []);

  // Returning visitors: confirm the saved token is still good and refresh the profile.
  // Only a 401 logs them out — a slow/sleeping server must not.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (res.status === 401) {
          logout();
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        writeSession(token, data.user);
        setSession({ token, user: { name: data.user.name, email: data.user.email } });
      } catch {
        // offline or server waking up — keep the cached session
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  // The persistent inbox: join this account's one conversation, keyed server-side by user id.
  useEffect(() => {
    if (!token) {
      conversationIdRef.current = null;
      setMessages([]);
      setChatReady(false);
      return undefined;
    }

    const join = () => socket.emit('user:join', { token });
    const onJoined = ({ conversationId, messages: history }) => {
      conversationIdRef.current = conversationId;
      setMessages(history);
      setChatReady(true);
    };
    const onNew = (msg) => {
      if (msg.conversationId !== conversationIdRef.current) return;
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      if (msg.type === 'deposit_card') setDepositsVersion((v) => v + 1);
    };
    const onDepositUpdated = (u) => {
      if (u.conversationId !== conversationIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === u.messageId ? { ...m, meta: { ...m.meta, status: u.status } } : m))
      );
      setDepositsVersion((v) => v + 1);
    };
    const onAuthError = () => logout();

    socket.on('connect', join);
    socket.on('user:joined', onJoined);
    socket.on('message:new', onNew);
    socket.on('deposit:updated', onDepositUpdated);
    socket.on('user:auth_error', onAuthError);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('user:joined', onJoined);
      socket.off('message:new', onNew);
      socket.off('deposit:updated', onDepositUpdated);
      socket.off('user:auth_error', onAuthError);
    };
  }, [token, logout]);

  const sendText = useCallback((text) => socket.emit('user:message', { text }), []);
  const sendImage = useCallback((imageUrl) => socket.emit('user:message', { imageUrl }), []);
  const sendDeposit = useCallback(
    (meta) => socket.emit('user:message', { type: 'deposit_card', meta }),
    []
  );

  const value = {
    user,
    token,
    login,
    logout,
    chatOpen,
    setChatOpen,
    messages,
    chatReady,
    sendText,
    sendImage,
    sendDeposit,
    depositsVersion,
  };

  return (
    <PlayerContext.Provider value={value}>
      <Outlet />
    </PlayerContext.Provider>
  );
}

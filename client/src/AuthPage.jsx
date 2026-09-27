import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { API_BASE, safeJson } from './socket';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? form : { email: form.email, password: form.password };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || 'Something went wrong');

      localStorage.setItem('h5c_player_token', data.token);
      localStorage.setItem('h5c_player_name', data.user.name);
      localStorage.setItem('h5c_player_email', data.user.email);

      const redirectTo = location.state?.from || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-sm bg-[#0D111A] border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 text-black font-black flex items-center justify-center text-lg shadow-lg shadow-amber-500/25">
            5
          </div>
          <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 tracking-wider text-base">
            HIGH 5 CASINO
          </span>
        </div>
        <p className="text-[11px] text-gray-500 mb-5 flex items-center gap-1">
          <ShieldCheck size={12} className="text-amber-500" />
          {isRegister ? 'Create your VIP account' : 'Welcome back — log in to deposit & play'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <input
              type="text"
              placeholder="Full name"
              required
              value={form.name}
              onChange={handleChange('name')}
              className="w-full bg-[#131824] border border-gray-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500/80"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            required
            value={form.email}
            onChange={handleChange('email')}
            className="w-full bg-[#131824] border border-gray-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500/80"
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={form.password}
            onChange={handleChange('password')}
            className="w-full bg-[#131824] border border-gray-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500/80"
          />

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-sm disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Login'}
          </button>
        </form>

        <p className="text-[11px] text-gray-500 text-center mt-4">
          {isRegister ? (
            <>Already have an account? <Link to="/login" className="text-amber-400 font-semibold hover:underline">Login</Link></>
          ) : (
            <>New here? <Link to="/register" className="text-amber-400 font-semibold hover:underline">Create an account</Link></>
          )}
        </p>
        <p className="text-[10px] text-gray-600 text-center mt-2">
          <Link to="/" className="hover:text-gray-400">← Back to lobby</Link>
        </p>
      </div>
    </div>
  );
}

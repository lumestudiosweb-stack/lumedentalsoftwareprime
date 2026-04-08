import { useState } from 'react';
import { useAuthStore } from '../../contexts/authStore';
import { authAPI } from '../../services/mockApi';
import { Hexagon } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.login({ email, password });
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="bg-surface-2 border border-white/5 rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Hexagon size={40} className="mx-auto text-lume-400 mb-3" />
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">LumeDental</h1>
          <p className="text-gray-500 mt-2 text-sm">3D Predictive Visualization Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-surface-3 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-lume-500/50 focus:border-lume-500/50 outline-none placeholder-gray-600"
              placeholder="doctor@clinic.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-surface-3 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-lume-500/50 focus:border-lume-500/50 outline-none placeholder-gray-600"
              placeholder="Enter password"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

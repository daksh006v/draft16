import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, guestLogin } from '../services/authService';
import { setToken } from '../utils/auth';
import { useServerWarmup } from '../hooks/useServerWarmup';
import ServerWarmingOverlay from '../components/ui/ServerWarmingOverlay';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const navigate = useNavigate();

  // Silently ping backend on mount to pre-warm the Render server
  useServerWarmup();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const data = await login({ email, password });
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setWarmingUp(true);
    // Small delay so overlay renders before the redirect takes over
    setTimeout(() => {
      window.location.href = `${import.meta.env.VITE_API_URL || 'https://draft16.onrender.com/api'}/auth/google`;
    }, 300);
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const data = await guestLogin();
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Guest login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <ServerWarmingOverlay visible={warmingUp} onCancel={() => setWarmingUp(false)} />
    <div className="flex justify-center items-center min-h-[calc(100vh-73px)] p-6" style={{ background: 'var(--bg-main)' }}>
      <div className="w-full max-w-md" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '12px', padding: '32px' }}>
        <h2 className="font-display text-3xl font-semibold text-center mb-8 tracking-tight" style={{ color: 'var(--text-main)' }}>Welcome Back</h2>
        
        {error && (
          <div className="p-3 rounded-lg mb-6 text-sm text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* Google Login Button (Primary) */}
        <button
          id="google-login-btn"
          onClick={handleGoogleLogin}
          className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-3 transition-all"
          style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--bg-border)',
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-muted)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--bg-border)'}
        >
          {/* Minimal Google 'G' SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="currentColor"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="currentColor"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="currentColor"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="currentColor"/>
          </svg>
          Continue with Google
        </button>

        {/* Guest Login Button */}
        <button
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full py-3 mt-3 rounded-lg font-medium flex items-center justify-center gap-3 transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--bg-border)',
            color: 'var(--text-muted)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = 'var(--text-muted)';
              e.currentTarget.style.color = 'var(--text-main)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = 'var(--bg-border)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Continue as Guest
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: 'var(--bg-border)' }}></div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--bg-border)' }}></div>
        </div>
        
        {/* Email Form (Secondary) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg outline-none transition-all"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--bg-border)', color: 'var(--text-main)' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--bg-border)'}
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg outline-none transition-all"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--bg-border)', color: 'var(--text-main)' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--bg-border)'}
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-lg font-medium text-white transition-all"
            style={{ background: loading ? 'var(--accent-hover)' : 'var(--accent-primary)', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-8" style={{ color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold hover:underline" style={{ color: 'var(--accent-primary)' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
    </>
  );
};

export default Login;


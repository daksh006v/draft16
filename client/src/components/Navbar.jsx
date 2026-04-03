import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { getToken, removeToken } from '../utils/auth';
import { ThemeContext } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = !!getToken();
  const { theme, toggleTheme } = useContext(ThemeContext);

  const handleLogout = () => {
    removeToken();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: 'var(--bg-main)',
      borderBottom: '1px solid var(--bg-border)',
      color: 'var(--text-main)',
    }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center whitespace-nowrap">
        <Link
          to="/"
          className="font-display transition-opacity hover:opacity-75 flex items-center text-xl sm:text-[28px]"
          style={{ color: 'var(--text-main)', letterSpacing: '-0.05em', fontWeight: 800 }}
        >
          Draft<span style={{ color: 'var(--accent-primary)', fontWeight: 800, marginLeft: '0.04em' }}>16</span>
        </Link>
        
        <div className="flex gap-3 sm:gap-6 items-center">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-medium transition-colors"
                style={{ color: isActive('/dashboard') ? 'var(--accent-primary)' : 'var(--text-muted)' }}
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium transition-colors"
                style={{ color: isActive('/login') ? 'var(--accent-primary)' : 'var(--text-muted)' }}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-xs sm:text-sm font-medium text-white px-3 sm:px-4 py-2 rounded-lg transition-opacity"
                style={{ background: 'var(--accent-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Get Started
              </Link>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center transition-all duration-200"
            style={{
              background: 'transparent',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '8px',
              padding: '6px',
              opacity: 0.7,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
            aria-label="Toggle theme"
          >
            {theme === 'light'
              ? <Moon size={16} strokeWidth={1.5} />
              : <Sun size={16} strokeWidth={1.5} />
            }
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;


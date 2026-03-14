import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { getToken, removeToken } from '../utils/auth';
import { ThemeContext } from '../context/ThemeContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = !!getToken();
  const { theme, toggleTheme } = useContext(ThemeContext);

  const handleLogout = () => {
    removeToken();
    navigate('/');
  };

  return (
    <nav className="p-4 bg-gray-800 dark:bg-gray-900 border-b border-gray-700 text-white shadow-md transition-colors">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold hover:text-gray-300">Draft16</Link>
        
        <div className="flex gap-6 items-center">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className={`hover:text-gray-300 ${location.pathname === '/dashboard' ? 'font-semibold' : ''}`}>Dashboard</Link>
              <button onClick={handleLogout} className="hover:text-gray-300">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className={`hover:text-gray-300 ${location.pathname === '/login' ? 'font-semibold' : ''}`}>Login</Link>
              <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-medium">Sign Up</Link>
            </>
          )}

          <button 
            onClick={toggleTheme}
            className="p-2 bg-gray-700 hover:bg-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors leading-none"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '🌞'}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

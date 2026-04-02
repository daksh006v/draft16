import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../utils/auth';

const AuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      setToken(token);
      // Clean up the URL so the token doesn't remain in history
      window.history.replaceState({}, document.title, '/dashboard');
      navigate('/dashboard', { replace: true });
    } else {
      // If directly hit without a token
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-73px)]" style={{ background: 'var(--bg-main)' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--accent-primary)] mx-auto mb-4"></div>
        <p style={{ color: 'var(--text-muted)' }}>Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;


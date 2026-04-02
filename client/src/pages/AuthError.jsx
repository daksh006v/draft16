import { Link } from 'react-router-dom';

const AuthError = () => {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-73px)]" style={{ background: 'var(--bg-main)' }}>
      <div className="text-center max-w-md p-6" style={{ background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--bg-border)' }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#ef4444' }}>Authentication Failed</h2>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
          There was a problem signing you in with Google. 
          Please try again or use another method.
        </p>
        <Link 
          to="/login"
          className="px-6 py-2 rounded-lg font-medium inline-block transition-all"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--bg-border)' }}
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default AuthError;


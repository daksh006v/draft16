import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-73px)] bg-[var(--bg-main)]">
      <main className="text-center px-4 z-10 max-w-3xl">
        <h1 className="font-display text-5xl md:text-7xl font-bold text-[var(--text-main)] mb-6 tracking-tight leading-tight">
          Professional songwriting workspace.
        </h1>
        <p className="text-lg md:text-2xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto font-sans leading-relaxed">
          The ultimate drafting workspace for lyricists. Write verses, record takes, play beats, and perfect your flow in a distraction-free environment.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link 
            to="/signup" 
            className="w-full sm:w-auto text-white px-8 py-4 rounded-lg font-medium text-lg transition-all flex items-center justify-center"
            style={{ background: 'var(--accent-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Start Writing for Free
          </Link>
          <Link 
            to="/login" 
            className="w-full sm:w-auto bg-transparent border border-[var(--bg-border)] text-[var(--text-main)] px-8 py-4 rounded-lg font-medium text-lg hover:bg-[var(--bg-elevated)] transition-all flex items-center justify-center"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Home;


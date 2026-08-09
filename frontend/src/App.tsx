import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Package2, Lock, LayoutDashboard, HelpCircle, LogOut, Loader2, Plus } from 'lucide-react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { CreatePackageModal } from './components/CreatePackageModal';

interface NavigationProps {
  user: User | null;
  onLogout: () => Promise<void>;
  onOpenCreateModal: () => void;
}

function Navigation({ user, onLogout, onOpenCreateModal }: NavigationProps) {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-card-border bg-[#0a0a0c]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-xl tracking-tight text-white hover:opacity-90 transition-opacity">
          <Package2 className="h-6 w-6 text-primary" />
          <span className="font-heading">Digi<span className="text-secondary font-bold">Doc</span></span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-muted hover:text-white transition-colors">Verify Package</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-white transition-colors">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <button 
                onClick={onOpenCreateModal}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-secondary hover:bg-secondary-hover text-black rounded-md transition-colors shadow-glow-cyan"
              >
                <Plus className="h-3.5 w-3.5" /> Create Package
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-card-border">
                <span className="text-xs text-muted font-mono hidden md:inline">
                  {user.email}
                </span>
                <button 
                  onClick={onLogout} 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 border border-card-border hover:bg-neutral-800 text-white rounded-md transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" /> Logout
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary hover:bg-primary-hover text-white rounded-md transition-colors shadow-glow-indigo">
              <Lock className="h-3.5 w-3.5" /> Sender Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Home() {
  return (
    <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl glass-panel shadow-glass text-center border border-card-border">
      <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
        <Package2 className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Claim Your Package</h1>
      <p className="text-sm text-muted mb-6">Enter an 8-character Access Code to download files secure and fast.</p>
      
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="XXXX-XXXX" 
            maxLength={9}
            className="w-full h-12 bg-black/40 border border-card-border rounded-lg px-4 text-center font-mono text-lg tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all uppercase"
          />
        </div>
        <button className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-all shadow-glow-indigo">
          Claim Package
        </button>
      </form>
    </div>
  );
}

function Login({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      },
    });

    if (error) {
      setLoginError(error.message);
      console.error('OAuth login error:', error.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl glass-panel shadow-glass border border-card-border">
      <h2 className="text-2xl font-bold tracking-tight text-white text-center mb-6 font-heading">Sender Login</h2>
      <p className="text-sm text-center text-muted mb-8">Access your dashboard to create and manage temporary delivery packages.</p>
      
      {loginError && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-500/20 text-red-400 rounded-lg text-xs">
          ⚠️ {loginError}
        </div>
      )}

      <button 
        onClick={handleGoogleLogin} 
        className="w-full h-12 bg-white text-black font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors shadow-lg"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}

interface DashboardProps {
  user: User | null;
  loading: boolean;
  onOpenCreateModal: () => void;
}

function Dashboard({ user, loading, onOpenCreateModal }: DashboardProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-32 gap-3 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading session state...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto mt-12 px-4 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Sender Dashboard</h1>
          <p className="text-sm text-muted">Create and manage your secure digital packages.</p>
        </div>
        <button 
          onClick={onOpenCreateModal}
          className="h-10 px-4 bg-secondary hover:bg-secondary-hover text-black font-semibold rounded-lg transition-colors shadow-glow-cyan text-sm flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Create Package
        </button>
      </div>
      <div className="p-12 text-center rounded-2xl glass-panel border border-card-border shadow-glass">
        <p className="text-muted">No active packages found. Click "+ Create Package" to build one!</p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    // 1. Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        localStorage.setItem('digidoc_token', session.access_token);
        localStorage.setItem('digidoc_user', JSON.stringify(session.user));
      }
    });

    // 2. Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        localStorage.setItem('digidoc_token', session.access_token);
        localStorage.setItem('digidoc_user', JSON.stringify(session.user));
      } else {
        localStorage.removeItem('digidoc_token');
        localStorage.removeItem('digidoc_user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error.message);
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navigation 
          user={user} 
          onLogout={handleLogout} 
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
        />
        <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login user={user} />} />
            <Route 
              path="/dashboard" 
              element={
                <Dashboard 
                  user={user} 
                  loading={loading} 
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                />
              } 
            />
            <Route path="*" element={
              <div className="text-center mt-20">
                <HelpCircle className="h-12 w-12 text-muted mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white">Page Not Found</h2>
                <Link to="/" className="text-primary hover:underline mt-2 inline-block">Return Home</Link>
              </div>
            } />
          </Routes>
        </main>

        {/* Global Create Package Modal */}
        <CreatePackageModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)}
        />
      </div>
    </Router>
  );
}

export default App;

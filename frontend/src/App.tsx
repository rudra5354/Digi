import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { 
  Package2, 
  Lock, 
  LayoutDashboard, 
  HelpCircle, 
  LogOut, 
  Loader2, 
  Plus, 
  Copy, 
  Check, 
  QrCode, 
  Trash2, 
  EyeOff, 
  ExternalLink, 
  Clock, 
  Files, 
  DownloadCloud, 
  X 
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { CreatePackageModal } from './components/CreatePackageModal';
import { ShareView } from './components/ShareView';
import { VerifyPackage } from './components/VerifyPackage';
import { PackageQrCode } from './components/PackageQrCode';
import { getPackageRetrievalUrl } from './lib/qr';

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
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = code.trim().replace(/\s+/g, '');
    
    // Validate format XXXX-XXXX
    if (!/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/.test(normalized)) {
      setError('Please enter a valid 8-character Access Code (format: XXXX-XXXX).');
      return;
    }

    navigate(`/verify?code=${encodeURIComponent(normalized.toUpperCase())}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    // Auto-insert hyphen if they type 4 chars
    if (val.length === 4 && !val.includes('-') && e.nativeEvent instanceof InputEvent && e.nativeEvent.inputType !== 'deleteContentBackward') {
      val = val + '-';
    }
    setCode(val);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl glass-panel shadow-glass text-center border border-card-border animate-fade-in">
      <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
        <Package2 className="h-8 w-8 text-primary animate-pulse-glow" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Claim Your Package</h1>
      <p className="text-sm text-muted mb-6">Enter an 8-character Access Code to retrieve secure package details.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="XXXX-XXXX" 
            maxLength={9}
            value={code}
            onChange={handleInputChange}
            className="w-full h-12 bg-black/40 border border-card-border rounded-lg px-4 text-center font-mono text-lg tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all uppercase"
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs mt-1 text-left">⚠️ {error}</p>
        )}
        <button type="submit" className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-all shadow-glow-indigo">
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
    <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl glass-panel shadow-glass border border-card-border animate-fade-in">
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
  refreshTrigger: number;
}

function Dashboard({ user, loading, onOpenCreateModal, refreshTrigger }: DashboardProps) {
  const navigate = useNavigate();
  
  // Dashboard states
  const [packages, setPackages] = useState<any[]>([]);
  const [fetchingPackages, setFetchingPackages] = useState(true);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [activeQrCode, setActiveQrCode] = useState<string | null>(null);
  const [activeQrTitle, setActiveQrTitle] = useState<string | null>(null);
  
  // Revoke/Delete action states
  const [actionPackageId, setActionPackageId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'REVOKE' | 'DELETE' | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch packages on mount and trigger
  const fetchPackages = async () => {
    if (!user) return;
    setFetchingPackages(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/packages', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const result = await res.json();
      if (result.success) {
        setPackages(result.data);
      }
    } catch (err) {
      console.error('Error fetching sender packages:', err);
    } finally {
      setFetchingPackages(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    } else if (user) {
      fetchPackages();
    }
  }, [user, loading, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-32 gap-3 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading session state...</p>
      </div>
    );
  }

  if (!user) return null;

  const copyAccessCode = (pkg: any) => {
    const shareUrl = getPackageRetrievalUrl(pkg.accessCode);
    navigator.clipboard.writeText(shareUrl);
    setCopiedCodeId(pkg.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleOpenQr = (pkg: any) => {
    const shareUrl = getPackageRetrievalUrl(pkg.accessCode);
    setActiveQrUrl(shareUrl);
    setActiveQrCode(pkg.accessCode);
    setActiveQrTitle(pkg.title);
  };

  const handleOpenActionModal = (pkg: any, type: 'REVOKE' | 'DELETE') => {
    setActionPackageId(pkg.id);
    setActionType(type);
    setActionError(null);
  };

  const handleCloseActionModal = () => {
    setActionPackageId(null);
    setActionType(null);
    setActionError(null);
  };

  const handleExecuteAction = async () => {
    if (!actionPackageId || !actionType) return;
    setIsActionSubmitting(true);
    setActionError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const url = `/api/packages/${actionPackageId}${actionType === 'REVOKE' ? '/revoke' : ''}`;
      const method = actionType === 'REVOKE' ? 'POST' : 'DELETE';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || `Failed to ${actionType.toLowerCase()} package.`);
      }

      // Success: Close and Refresh list
      handleCloseActionModal();
      fetchPackages();
    } catch (err: any) {
      console.error(`Error during ${actionType} package:`, err);
      setActionError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Expiry styling helpers
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full uppercase tracking-wider">
            Active
          </span>
        );
      case 'REVOKED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full uppercase tracking-wider">
            Revoked
          </span>
        );
      case 'EXPIRED':
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 rounded-full uppercase tracking-wider">
            Expired
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Sender Dashboard</h1>
          <p className="text-sm text-muted">Create, share, and manage your secure digital packages.</p>
        </div>
        <button 
          onClick={onOpenCreateModal}
          className="h-10 px-4 bg-secondary hover:bg-secondary-hover text-black font-semibold rounded-lg transition-colors shadow-glow-cyan text-sm flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Package
        </button>
      </div>

      {fetchingPackages ? (
        <div className="flex flex-col items-center justify-center p-20 gap-3 text-muted">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs">Fetching package dashboard...</p>
        </div>
      ) : packages.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-card-border shadow-glass">
          <p className="text-muted">No active packages found. Click "+ Create Package" to build one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const isPkgActive = pkg.status.toUpperCase() === 'ACTIVE';
            const shareUrl = getPackageRetrievalUrl(pkg.accessCode);
            return (
              <div key={pkg.id} className="glass-panel border border-card-border rounded-xl p-5 flex flex-col justify-between hover:border-white/15 transition-all shadow-glass hover:shadow-glass-sm relative overflow-hidden group">
                {/* Header Info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    {getStatusBadge(pkg.status)}
                    <span className="text-[10px] text-muted font-mono">{new Date(pkg.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base truncate pr-2 group-hover:text-primary transition-colors" title={pkg.title}>
                      {pkg.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="font-mono font-extrabold text-lg text-secondary tracking-wider bg-black/30 px-2 py-0.5 rounded border border-white/5">
                        {pkg.accessCode}
                      </span>
                      {isPkgActive && (
                        <button 
                          onClick={() => copyAccessCode(pkg)}
                          className="p-1.5 bg-neutral-900 border border-card-border hover:bg-neutral-800 rounded transition-colors text-slate-400 hover:text-white"
                          title="Copy share link"
                        >
                          {copiedCodeId === pkg.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-card-border text-[11px] text-muted">
                    <div className="flex items-center gap-1">
                      <Files className="h-3.5 w-3.5 text-slate-500" />
                      <span>{pkg.filesCount} file(s)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DownloadCloud className="h-3.5 w-3.5 text-slate-500" />
                      <span>{pkg.downloadCount} download(s)</span>
                    </div>
                    <div className="flex items-center gap-1 col-span-2 truncate">
                      <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Expires: {new Date(pkg.expiresAt).toLocaleString()}</span>
                    </div>
                    {pkg.hasPin && (
                      <div className="flex items-center gap-1 text-accent-purple font-semibold col-span-2">
                        <Lock className="h-3.5 w-3.5" />
                        <span>PIN Protected</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3.5 border-t border-card-border flex items-center justify-between gap-2">
                  {isPkgActive ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleOpenQr(pkg)}
                          className="flex items-center gap-1 px-2 py-1.5 bg-neutral-900 border border-card-border hover:bg-neutral-800 rounded text-[10px] font-semibold text-slate-300 transition-colors"
                          title="View share QR"
                        >
                          <QrCode className="h-3 w-3" /> QR
                        </button>
                        <a 
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1.5 bg-neutral-900 border border-card-border hover:bg-neutral-800 rounded text-[10px] font-semibold text-slate-300 transition-colors"
                          title="Open share page"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleOpenActionModal(pkg, 'REVOKE')}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-950/20 border border-amber-500/20 text-amber-400 hover:bg-amber-950/40 rounded text-[10px] font-semibold transition-colors"
                        >
                          <EyeOff className="h-3 w-3" /> Revoke
                        </button>
                        <button 
                          onClick={() => handleOpenActionModal(pkg, 'DELETE')}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/40 rounded text-[10px] font-semibold transition-colors"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleOpenActionModal(pkg, 'DELETE')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 text-red-400 rounded text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Purge Package from Cloud
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Modal */}
      {activeQrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-sm w-full bg-slate-900 border border-card-border rounded-2xl p-6 text-center text-white shadow-2xl">
            <button 
              onClick={() => {
                setActiveQrUrl(null);
                setActiveQrCode(null);
                setActiveQrTitle(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4">
              <Package2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-bold text-lg">Sender QR Share</h3>
              <p className="text-xs text-slate-400 mt-1 truncate px-2" title={activeQrTitle || ''}>
                QR Code for "{activeQrTitle}"
              </p>
            </div>
            
            {activeQrCode && <PackageQrCode accessCode={activeQrCode} title={activeQrTitle || 'package'} />}

            <div className="bg-slate-950 p-2.5 rounded-lg border border-card-border flex items-center justify-between text-xs font-mono">
              <span className="truncate text-left select-all pr-4">{activeQrUrl}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(activeQrUrl);
                  setCopiedCodeId('MODAL_QR_URL');
                  setTimeout(() => setCopiedCodeId(null), 2000);
                }}
                className="shrink-0 p-1 bg-primary/20 text-primary hover:bg-primary/30 rounded transition-colors"
              >
                {copiedCodeId === 'MODAL_QR_URL' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Action Modal (Revoke/Delete) */}
      {actionPackageId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-950 border border-card-border rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Confirm Package {actionType === 'REVOKE' ? 'Revocation' : 'Deletion'}
            </h3>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              {actionType === 'REVOKE' 
                ? 'Are you sure you want to revoke this package? Recipients will no longer be able to verify, claim, or download any files. This action is irreversible.' 
                : 'Are you sure you want to delete this package? This will permanently delete the metadata and purge all physical files from cloud storage. This action cannot be undone.'}
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/25 text-red-400 rounded-lg text-xs">
                ⚠️ {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleCloseActionModal}
                disabled={isActionSubmitting}
                className="px-4 h-9 text-xs font-semibold text-muted hover:text-white border border-card-border hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={isActionSubmitting}
                className={`px-4 h-9 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 ${
                  actionType === 'REVOKE' 
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-glow-indigo' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isActionSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    {actionType === 'REVOKE' ? <EyeOff className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Confirm {actionType === 'REVOKE' ? 'Revoke' : 'Delete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const handlePackageCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
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
            <Route path="/verify" element={<VerifyPackage />} />
            <Route path="/login" element={<Login user={user} />} />
            <Route path="/share/:accessCode" element={<ShareView />} />
            <Route 
              path="/dashboard" 
              element={
                <Dashboard 
                  user={user} 
                  loading={loading} 
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  refreshTrigger={refreshTrigger}
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
          onPackageCreated={handlePackageCreated}
        />
      </div>
    </Router>
  );
}

export default App;

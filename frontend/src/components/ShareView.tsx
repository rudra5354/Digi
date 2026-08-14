import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Package2, 
  Lock, 
  Unlock, 
  FileText, 
  Download, 
  AlertTriangle, 
  Clock, 
  ArrowLeft, 
  ShieldCheck, 
  KeyRound, 
  Copy, 
  Check, 
  QrCode, 
  X,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  File
} from 'lucide-react';
import QRCode from 'qrcode';

interface PackageMeta {
  id: string;
  title: string;
  accessCode: string;
  status: string;
  expiresAt: string;
  hasPin: boolean;
  downloadCount: number;
  createdAt: string;
  filesCount: number;
}

interface PackageFile {
  id: string;
  packageId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export const ShareView: React.FC = () => {
  const { accessCode } = useParams<{ accessCode: string }>();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [meta, setMeta] = useState<PackageMeta | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [files, setFiles] = useState<PackageFile[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Fetch Initial Metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!accessCode) return;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/packages/share/${accessCode}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          setError({
            code: result.error?.code || 'ERROR',
            message: result.error?.message || 'Failed to retrieve package metadata.'
          });
          setLoading(false);
          return;
        }

        setMeta(result.data);

        // If package has no PIN, we can claim it immediately
        if (!result.data.hasPin) {
          await handleClaim(result.data.accessCode);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Fetch metadata error:', err);
        setError({
          code: 'NETWORK_ERROR',
          message: 'Could not connect to the server. Please check your connection.'
        });
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [accessCode]);

  // 2. Fetch Files List (Claim)
  const handleClaim = async (code: string, providedPin?: string) => {
    if (providedPin) {
      setVerifyingPin(true);
      setPinError(null);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/packages/share/${code}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: providedPin }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.error?.code === 'INVALID_PIN') {
          setPinError('The PIN you entered is incorrect. Please try again.');
        } else {
          setError({
            code: result.error?.code || 'CLAIM_ERROR',
            message: result.error?.message || 'Failed to claim package files.'
          });
        }
        return;
      }

      setFiles(result.data.files);
      setClaimed(true);
    } catch (err: any) {
      console.error('Claim package error:', err);
      setError({
        code: 'NETWORK_ERROR',
        message: 'Could not connect to the server. Please check your connection.'
      });
    } finally {
      setLoading(false);
      setVerifyingPin(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setPinError('PIN is required.');
      return;
    }
    if (!/^\d{4,8}$/.test(pin.trim())) {
      setPinError('PIN must be 4 to 8 numeric digits.');
      return;
    }
    if (meta) {
      handleClaim(meta.accessCode, pin.trim());
    }
  };

  // 3. File Downloads
  const handleDownload = (fileId: string) => {
    if (!meta) return;
    const downloadUrl = `/api/packages/share/${meta.accessCode}/files/${fileId}/download${
      meta.hasPin ? `?pin=${encodeURIComponent(pin.trim())}` : ''
    }`;
    // Direct browser navigation triggers redirect download
    window.open(downloadUrl, '_blank');
  };

  // Helper: Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper: Get File Icon based on mime-type
  const getFileIcon = (mime: string) => {
    const m = mime.toLowerCase();
    if (m.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
    if (m.includes('image')) return <FileImage className="h-5 w-5 text-emerald-400" />;
    if (m.includes('video')) return <FileVideo className="h-5 w-5 text-cyan-400" />;
    if (m.includes('zip') || m.includes('rar') || m.includes('tar') || m.includes('compressed')) {
      return <FileArchive className="h-5 w-5 text-amber-400" />;
    }
    if (m.includes('javascript') || m.includes('typescript') || m.includes('json') || m.includes('html')) {
      return <FileCode className="h-5 w-5 text-blue-400" />;
    }
    return <File className="h-5 w-5 text-primary" />;
  };

  // Share tools
  const shareUrl = window.location.href;
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Draw QR code canvas
  useEffect(() => {
    if (showQrModal && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, shareUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.error('QR code generation error:', err);
      });
    }
  }, [showQrModal, shareUrl]);

  // Loading State UI
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-32 gap-3 text-muted">
        <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-medium">Validating secure access code...</p>
      </div>
    );
  }

  // Error State UI (e.g. expired, not found)
  if (error) {
    const isExpired = error.code === 'INACTIVE_PACKAGE';
    return (
      <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl glass-panel shadow-glass text-center border border-card-border animate-fade-in">
        <div className={`h-16 w-16 ${isExpired ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} rounded-full flex items-center justify-center mx-auto mb-6 border`}>
          {isExpired ? <Clock className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          {isExpired ? 'Package Expired' : 'Package Not Found'}
        </h1>
        <p className="text-sm text-muted mb-6">
          {isExpired 
            ? 'This package has reached its expiration time limit or has been revoked by the sender.' 
            : 'We could not find a package matching the access code provided. Please verify the code and try again.'}
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-5 h-11 bg-neutral-900 border border-card-border hover:bg-neutral-800 text-white font-medium rounded-lg transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Go to Verification Screen
        </Link>
      </div>
    );
  }

  // PIN CHALLENGE VIEW
  if (meta && meta.hasPin && !claimed) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl glass-panel shadow-glass border border-card-border animate-fade-in">
        <div className="h-14 w-14 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20 text-primary animate-pulse-glow">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white text-center mb-2 font-heading">PIN Protected Package</h2>
        <p className="text-sm text-center text-muted mb-6">This digital package is protected. Please enter the passcode to access files.</p>
        
        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Verification PIN
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <KeyRound className="h-4 w-4" />
              </span>
              <input 
                type="password" 
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // only digits
                placeholder="Enter PIN (4-8 digits)" 
                className="w-full h-11 bg-black/40 border border-card-border rounded-lg pl-10 pr-4 font-mono text-sm tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                required
              />
            </div>
            {pinError && (
              <p className="text-red-400 text-xs mt-2">⚠️ {pinError}</p>
            )}
          </div>
          <button 
            type="submit" 
            disabled={verifyingPin}
            className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-all shadow-glow-indigo flex items-center justify-center gap-2"
          >
            {verifyingPin ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" /> Unlock & View Files
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-card-border text-center">
          <Link to="/" className="text-xs text-muted hover:text-white transition-colors flex items-center justify-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Claim another package
          </Link>
        </div>
      </div>
    );
  }

  // ACTIVE FILES LIST / DOWNLOAD VIEW
  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 animate-fade-in">
      
      {/* Header Panel */}
      <div className="p-6 md:p-8 rounded-2xl glass-panel border border-card-border shadow-glass mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Secure Package
              </span>
              <span className="text-xs text-muted font-mono">{meta?.accessCode}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{meta?.title}</h1>
            <p className="text-xs text-muted">
              Uploaded on {meta ? new Date(meta.createdAt).toLocaleDateString() : ''} • Expires at: {meta ? new Date(meta.expiresAt).toLocaleString() : ''}
            </p>
          </div>

          {/* Quick Sharing actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-neutral-900 border border-card-border hover:bg-neutral-800 text-white rounded-lg transition-colors"
              title="Copy shareable link"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" /> Copy Link
                </>
              )}
            </button>
            <button 
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-neutral-900 border border-card-border hover:bg-neutral-800 text-white rounded-lg transition-colors"
              title="View sharing QR code"
            >
              <QrCode className="h-3.5 w-3.5 text-slate-400" /> Share QR
            </button>
          </div>
        </div>
      </div>

      {/* Files List Card */}
      <div className="glass-panel border border-card-border rounded-2xl shadow-glass overflow-hidden">
        <div className="p-4 md:p-6 border-b border-card-border bg-white/5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Package Attachments ({files.length})</h2>
        </div>

        <div className="divide-y divide-card-border">
          {files.map((file) => (
            <div key={file.id} className="p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 bg-black/40 rounded-lg flex items-center justify-center shrink-0 border border-card-border">
                  {getFileIcon(file.mimeType)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatBytes(file.fileSize)} • {file.mimeType}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleDownload(file.id)}
                className="flex items-center justify-center h-10 w-10 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors shadow-glow-indigo shrink-0"
                title="Download file"
              >
                <Download className="h-4.5 w-4.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-8">
        <Link to="/" className="text-xs text-muted hover:text-white transition-colors inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Verification Page
        </Link>
      </div>

      {/* QR Code Sharing Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-sm w-full bg-slate-900 border border-card-border rounded-2xl p-6 text-center text-white shadow-2xl">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4">
              <Package2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-bold text-lg">Recipient QR Share</h3>
              <p className="text-xs text-slate-400 mt-1">Scan to open and download files instantly on mobile.</p>
            </div>
            
            <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-4 border-2 border-primary/20">
              <canvas ref={qrCanvasRef} className="mx-auto" />
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-card-border flex items-center justify-between text-xs font-mono">
              <span className="truncate text-left select-all pr-4">{shareUrl}</span>
              <button 
                onClick={copyShareLink}
                className="shrink-0 p-1 bg-primary/20 text-primary hover:bg-primary/30 rounded transition-colors"
              >
                {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

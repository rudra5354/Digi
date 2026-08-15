import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, KeyRound, Loader2, Package2, ShieldCheck } from 'lucide-react';

interface RetrievedPackage {
  id: string;
  title: string;
  status: 'ACTIVE';
  expiresAt: string;
  hasPin: boolean;
  fileCount: number;
}

const normalizeCode = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase();
const isValidCode = (value: string) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(value);

export const VerifyPackage = () => {
  const [searchParams] = useSearchParams();
  const initialCode = normalizeCode(searchParams.get('code') || '');
  const [code, setCode] = useState(initialCode);
  const [packageInfo, setPackageInfo] = useState<RetrievedPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retrievePackage = async (submittedCode: string) => {
    const normalizedCode = normalizeCode(submittedCode);
    if (!isValidCode(normalizedCode)) {
      setPackageInfo(null);
      setError('Enter a valid access code in the format XXXX-XXXX.');
      return;
    }

    setLoading(true);
    setError(null);
    setPackageInfo(null);
    try {
      const response = await fetch(`/api/packages/retrieve/${encodeURIComponent(normalizedCode)}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Unable to retrieve this package.');
      }
      setPackageInfo(result.data);
      setPin('');
      setPinError(null);
      setPinVerified(false);
    } catch (requestError: any) {
      setError(requestError.message || 'Unable to retrieve this package.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) retrievePackage(initialCode);
  }, [initialCode]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    retrievePackage(code);
  };

  const handlePinSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!packageInfo) return;
    if (!/^\d{4,8}$/.test(pin)) {
      setPinError('PIN must be 4 to 8 numeric digits.');
      return;
    }

    setVerifyingPin(true);
    setPinError(null);
    try {
      const response = await fetch(`/api/packages/${packageInfo.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'PIN verification failed.');
      }
      setPinVerified(true);
      setPin('');
    } catch (verificationError: any) {
      setPinError(verificationError.message || 'PIN verification failed.');
    } finally {
      setVerifyingPin(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 rounded-2xl glass-panel shadow-glass border border-card-border animate-fade-in">
      <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
        <Package2 className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white text-center mb-2">Verify Package</h1>
      <p className="text-sm text-muted text-center mb-6">Enter an access code to retrieve secure package details.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="XXXX-XXXX"
          maxLength={9}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="w-full h-12 bg-black/40 border border-card-border rounded-lg px-4 text-center font-mono text-lg tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
        />
        <button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium rounded-lg transition-all flex justify-center items-center gap-2">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Retrieving…</> : 'Retrieve Package'}
        </button>
      </form>

      {error && <div className="mt-5 p-3 rounded-lg bg-red-950/40 border border-red-500/25 text-red-300 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

      {packageInfo && (
        <div className="mt-6 p-5 rounded-xl bg-white/5 border border-card-border space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wide"><ShieldCheck className="h-4 w-4" /> Package retrieved</div>
          <h2 className="text-lg font-bold text-white">{packageInfo.title}</h2>
          <p className="text-xs text-muted flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Expires {new Date(packageInfo.expiresAt).toLocaleString()}</p>
          <p className="text-xs text-muted">{packageInfo.fileCount} attachment{packageInfo.fileCount === 1 ? '' : 's'}</p>
          {packageInfo.hasPin && !pinVerified && (
            <form onSubmit={handlePinSubmit} className="pt-2 space-y-2">
              <label className="text-xs text-muted flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Enter the recipient PIN to continue.</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                placeholder="4–8 digit PIN"
                className="w-full h-10 bg-black/40 border border-card-border rounded-lg px-3 text-center font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-primary/50"
              />
              {pinError && <p className="text-xs text-red-400">{pinError}</p>}
              <button type="submit" disabled={verifyingPin} className="w-full h-10 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {verifyingPin ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</> : 'Verify PIN'}
              </button>
            </form>
          )}
          {packageInfo.hasPin && pinVerified && <p className="text-xs text-emerald-400 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> PIN verified. You may proceed when package preview becomes available.</p>}
          {!packageInfo.hasPin && <p className="text-xs text-muted flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> No PIN is required. Package preview will be available in the next stage.</p>}
        </div>
      )}
    </div>
  );
};

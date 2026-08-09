import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  File, 
  Trash2, 
  Lock, 
  Clock, 
  Sparkles, 
  Check, 
  Copy, 
  AlertCircle, 
  ShieldCheck,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreatePackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPackageCreated?: (packageData: any) => void;
}

export const CreatePackageModal: React.FC<CreatePackageModalProps> = ({
  isOpen,
  onClose,
  onPackageCreated,
}) => {
  // Form State
  const [title, setTitle] = useState('');
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [enablePin, setEnablePin] = useState(false);
  const [pin, setPin] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdPackage, setCreatedPackage] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // File Handling
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);

    // Validate size (50MB limit)
    const MAX_SIZE = 50 * 1024 * 1024;
    const oversizedFiles = fileArray.filter((f) => f.size > MAX_SIZE);

    if (oversizedFiles.length > 0) {
      setErrorMessage(`File "${oversizedFiles[0].name}" exceeds the 50 MB size limit.`);
      return;
    }

    setErrorMessage(null);
    setSelectedFiles((prev) => [...prev, ...fileArray]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please enter a package title.');
      return;
    }

    if (enablePin && (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))) {
      setErrorMessage('PIN must be a 4 to 8 digit numeric code.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Get Auth Token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setErrorMessage('Authentication session expired. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      // 2. Call backend API POST /api/packages
      const response = await fetch('/api/packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          expiryHours,
          pin: enablePin ? pin : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to create package');
      }

      // 3. Show Created Success Screen
      setCreatedPackage(result.data);
      if (onPackageCreated) {
        onPackageCreated(result.data);
      }
    } catch (err: any) {
      console.error('Package creation error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAccessCode = () => {
    if (createdPackage?.accessCode) {
      navigator.clipboard.writeText(createdPackage.accessCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleResetModal = () => {
    setTitle('');
    setExpiryHours(24);
    setEnablePin(false);
    setPin('');
    setSelectedFiles([]);
    setErrorMessage(null);
    setCreatedPackage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl glass-panel border border-card-border rounded-2xl p-6 md:p-8 shadow-glass text-foreground overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-card-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-white font-heading">
              {createdPackage ? 'Package Created!' : 'Create Digital Package'}
            </h2>
          </div>
          <button 
            onClick={handleResetModal}
            className="p-1 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {createdPackage ? (
            /* SUCCESS VIEW */
            <div className="space-y-6 text-center py-4">
              <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{createdPackage.title}</h3>
                <p className="text-xs text-muted">Ready to share temporarily with recipients</p>
              </div>

              {/* ACCESS CODE DISPLAY BOX */}
              <div className="p-6 rounded-xl bg-black/60 border border-primary/40 shadow-glow-indigo">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">Access Code</span>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-3xl font-extrabold text-white tracking-widest">
                    {createdPackage.accessCode}
                  </span>
                  <button 
                    onClick={copyAccessCode}
                    className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                    title="Copy Access Code"
                  >
                    {copiedCode ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left text-xs bg-white/5 p-4 rounded-lg border border-white/5">
                <div>
                  <span className="text-muted block">Expires At:</span>
                  <span className="font-medium text-white">{new Date(createdPackage.expiresAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted block">PIN Protection:</span>
                  <span className="font-medium text-white">{createdPackage.hasPin ? 'Enabled' : 'None'}</span>
                </div>
              </div>

              <button
                onClick={handleResetModal}
                className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Done & Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* CREATE FORM VIEW */
            <form id="create-package-form" onSubmit={handleSubmit} className="space-y-4">
              
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                  Package Title *
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Financial Report & Documentation"
                  className="w-full h-11 bg-black/40 border border-card-border rounded-lg px-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  required
                />
              </div>

              {/* Drag and Drop File Upload Area */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
                  Attach Files (50 MB Max per file)
                </label>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-primary bg-primary/10' 
                      : 'border-card-border bg-black/20 hover:border-primary/50 hover:bg-black/40'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={(e) => handleFileSelect(e.target.files)}
                    multiple 
                    className="hidden" 
                  />
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2 border border-primary/20">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-white">Click or drag & drop files here</p>
                  <p className="text-xs text-muted mt-1">Supports PDF, DOCX, PNG, JPG, ZIP (Up to 50 MB)</p>
                </div>

                {/* Selected File List */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-black/40 border border-card-border rounded-lg text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <File className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate text-white">{file.name}</span>
                          <span className="text-muted text-[10px]">({formatBytes(file.size)})</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeFile(idx)}
                          className="text-muted hover:text-red-400 p-1 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expiry Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-secondary" /> Auto-Expiry Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '1 Hour', hours: 1 },
                    { label: '12 Hours', hours: 12 },
                    { label: '24 Hours (1 Day)', hours: 24 },
                    { label: '48 Hours (2 Days)', hours: 48 },
                    { label: '7 Days', hours: 168 },
                  ].map((option) => (
                    <button
                      key={option.hours}
                      type="button"
                      onClick={() => setExpiryHours(option.hours)}
                      className={`h-9 px-2 text-xs font-medium rounded-lg border transition-all ${
                        expiryHours === option.hours
                          ? 'bg-primary text-white border-primary shadow-glow-indigo'
                          : 'bg-black/40 text-muted border-card-border hover:border-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional PIN Protection */}
              <div className="pt-2 border-t border-card-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-accent-purple" />
                    <div>
                      <span className="text-xs font-semibold text-white block">Require Recipient PIN</span>
                      <span className="text-[11px] text-muted block">Recipients must enter this PIN to preview or download</span>
                    </div>
                  </div>
                  <input 
                    type="checkbox"
                    checked={enablePin}
                    onChange={(e) => setEnablePin(e.target.checked)}
                    className="h-4 w-4 rounded bg-black/40 border-card-border text-primary focus:ring-primary/50 cursor-pointer"
                  />
                </div>

                {enablePin && (
                  <div className="mt-3">
                    <input 
                      type="password"
                      maxLength={8}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter 4 to 8 digit PIN"
                      className="w-full h-10 bg-black/40 border border-card-border rounded-lg px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/50 font-mono tracking-widest"
                    />
                  </div>
                )}
              </div>

            </form>
          )}
        </div>

        {/* Footer Actions */}
        {!createdPackage && (
          <div className="pt-4 border-t border-card-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleResetModal}
              className="px-4 h-10 text-xs font-semibold text-muted hover:text-white bg-black/30 hover:bg-black/50 border border-card-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-package-form"
              disabled={isSubmitting}
              className="px-6 h-10 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-glow-indigo flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Package...
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" /> Generate Package & Access Code
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

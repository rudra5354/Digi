import { useEffect, useState } from 'react';
import { Download, Expand, File, FileAudio, FileImage, FileText, FileVideo, Loader2, TriangleAlert, X } from 'lucide-react';

interface PreviewFile {
  id: string; fileName: string; fileSize: number; mimeType: string;
  previewKind: 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | 'unavailable';
  previewAvailable: boolean; previewUrl?: string; previewMessage?: string;
}
interface PackagePreviewProps { packageId: string; previewToken: string; }

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Number((bytes / 1024 ** index).toFixed(2))} ${['Bytes', 'KB', 'MB', 'GB'][index]}`;
};

const TextPreview = ({ url, fullScreen = false }: { url: string; fullScreen?: boolean }) => {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { fetch(url).then((response) => response.ok ? response.text() : Promise.reject()).then(setText).catch(() => setError(true)); }, [url]);
  if (error) return <div className="p-4 text-xs text-muted">Preview unavailable: the text file could not be read.</div>;
  if (text === null) return <div className="p-4 text-xs text-muted flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading text preview…</div>;
  return <pre className={`${fullScreen ? 'h-[calc(100vh-11rem)]' : 'max-h-96'} overflow-auto p-4 bg-black/30 text-xs text-slate-200 whitespace-pre-wrap break-words`}>{text}</pre>;
};

const FileIcon = ({ kind }: { kind: PreviewFile['previewKind'] }) => (
  kind === 'pdf' || kind === 'text' ? <FileText className="h-5 w-5 text-red-400 shrink-0" /> : kind === 'image' ? <FileImage className="h-5 w-5 text-emerald-400 shrink-0" /> : kind === 'video' ? <FileVideo className="h-5 w-5 text-cyan-400 shrink-0" /> : kind === 'audio' ? <FileAudio className="h-5 w-5 text-violet-400 shrink-0" /> : <File className="h-5 w-5 text-slate-400 shrink-0" />
);

export const PackagePreview = ({ packageId, previewToken }: PackagePreviewProps) => {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<PreviewFile | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null);

  useEffect(() => {
    const loadPreviews = async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/packages/${packageId}/preview`, { headers: { Authorization: `Bearer ${previewToken}` } });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to load file previews.');
        setFiles(result.data.files);
      } catch (previewError: any) { setError(previewError.message || 'Unable to load file previews.'); }
      finally { setLoading(false); }
    };
    loadPreviews();
  }, [packageId, previewToken]);

  const downloadFile = async (file: PreviewFile) => {
    setDownloadingId(file.id); setDownloadError(null); setDownloadedFile(null);
    try {
      const response = await fetch(`/api/packages/${packageId}/files/${file.id}/download`, { method: 'POST', headers: { Authorization: `Bearer ${previewToken}` } });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.downloadUrl) throw new Error();
      const link = document.createElement('a');
      link.href = result.data.downloadUrl; link.download = file.fileName;
      document.body.appendChild(link); link.click(); link.remove();
      setDownloadedFile(file.fileName);
    } catch { setDownloadError('Unable to download file. Please try again.'); }
    finally { setDownloadingId(null); }
  };

  const renderPreview = (file: PreviewFile, fullScreen = false) => {
    const sizing = fullScreen ? 'max-h-[calc(100vh-11rem)]' : 'max-h-96';
    if (!file.previewAvailable || !file.previewUrl) return <div className={`${fullScreen ? 'h-[calc(100vh-11rem)]' : 'min-h-36'} p-4 flex items-center justify-center text-xs text-muted bg-black/30`}>{file.previewMessage || 'Preview unavailable for this file type.'}</div>;
    if (file.previewKind === 'pdf') return <iframe title={`Preview of ${file.fileName}`} src={file.previewUrl} className={`w-full ${fullScreen ? 'h-[calc(100vh-11rem)]' : 'h-96'} bg-white`} />;
    if (file.previewKind === 'image') return <div className="bg-black/30 p-3 flex justify-center"><img src={file.previewUrl} alt={`Preview of ${file.fileName}`} className={`${sizing} max-w-full object-contain rounded`} /></div>;
    if (file.previewKind === 'video') return <video controls className={`w-full ${sizing} bg-black`} src={file.previewUrl}>Your browser cannot preview this video.</video>;
    if (file.previewKind === 'audio') return <div className="p-5 bg-black/30"><audio controls className="w-full" src={file.previewUrl}>Your browser cannot preview this audio.</audio></div>;
    if (file.previewKind === 'text') return <TextPreview url={file.previewUrl} fullScreen={fullScreen} />;
    return null;
  };

  if (loading) return <div className="mt-6 flex justify-center items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading secure previews…</div>;
  if (error) return <div className="mt-6 p-3 text-sm text-red-300 bg-red-950/40 border border-red-500/25 rounded-lg flex gap-2"><TriangleAlert className="h-4 w-4 shrink-0" />{error}</div>;

  return <section className="mt-6 space-y-4">
    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Secure file preview ({files.length})</h2>
    {downloadError && <div className="p-3 text-sm text-red-300 bg-red-950/40 border border-red-500/25 rounded-lg">{downloadError}</div>}
    {downloadedFile && <div className="p-3 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-500/25 rounded-lg">Download started for {downloadedFile}.</div>}
    {files.length === 0 ? <div className="p-5 rounded-xl glass-panel text-sm text-muted">This package has no files to preview.</div> : files.map((file) => <article key={file.id} className="rounded-xl glass-panel border border-card-border overflow-hidden">
      <div className="p-4 flex items-center gap-3"><FileIcon kind={file.previewKind} /><div className="min-w-0"><p className="text-sm font-medium text-white truncate">{file.fileName}</p><p className="text-xs text-muted">{file.mimeType} · {formatBytes(file.fileSize)}</p></div></div>
      <div className="border-y border-card-border">{renderPreview(file)}</div>
      <div className="p-3 flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={() => setActiveFile(file)} className="flex-1 h-10 flex items-center justify-center gap-2 text-xs font-semibold bg-neutral-900 border border-card-border hover:bg-neutral-800 text-white rounded-lg transition-colors" aria-label={`Open ${file.fileName} in full screen`}><Expand className="h-3.5 w-3.5" /> Open Full Screen</button>
        <button type="button" onClick={() => downloadFile(file)} disabled={downloadingId === file.id} className="flex-1 h-10 flex items-center justify-center gap-2 text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg transition-colors" aria-label={`Download ${file.fileName}`}>{downloadingId === file.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing download…</> : <><Download className="h-3.5 w-3.5" /> Download File</>}</button>
      </div>
    </article>)}
    {activeFile && <div className="fixed inset-0 z-[100] bg-[#09090b] p-4 sm:p-6 flex flex-col" role="dialog" aria-modal="true" aria-label={`Full screen preview of ${activeFile.fileName}`}>
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4 pb-4 text-white"><div className="min-w-0"><p className="font-semibold truncate">{activeFile.fileName}</p><p className="text-xs text-muted">{activeFile.mimeType} · {formatBytes(activeFile.fileSize)}</p></div><button type="button" onClick={() => setActiveFile(null)} className="shrink-0 h-10 px-3 flex items-center gap-2 text-xs font-semibold bg-neutral-900 border border-card-border hover:bg-neutral-800 rounded-lg" aria-label="Close full screen preview"><X className="h-4 w-4" /> Close Full Screen</button></div>
      <div className="max-w-7xl w-full mx-auto flex-1 min-h-0 overflow-auto rounded-xl glass-panel border border-card-border">{renderPreview(activeFile, true)}</div>
      <div className="max-w-7xl w-full mx-auto pt-4"><button type="button" onClick={() => downloadFile(activeFile)} disabled={downloadingId === activeFile.id} className="w-full sm:w-auto h-10 px-4 flex items-center justify-center gap-2 text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg"><Download className="h-3.5 w-3.5" /> {downloadingId === activeFile.id ? 'Preparing download…' : 'Download File'}</button></div>
    </div>}
  </section>;
};

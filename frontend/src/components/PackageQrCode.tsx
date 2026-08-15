import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { getPackageRetrievalUrl } from '../lib/qr';

interface PackageQrCodeProps {
  accessCode: string;
  title: string;
  size?: number;
}

export const PackageQrCode = ({ accessCode, title, size = 220 }: PackageQrCodeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const retrievalUrl = getPackageRetrievalUrl(accessCode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, retrievalUrl, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(() => setError(null)).catch((generationError: unknown) => {
      console.error('QR code generation error:', generationError);
      setError('Unable to generate the QR code. Please try again.');
    });
  }, [retrievalUrl, size]);

  const downloadQr = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `digi-doc-${accessCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-3 text-center">
      <div className="bg-white p-4 rounded-xl inline-block border-2 border-primary/20">
        <canvas ref={canvasRef} aria-label={`QR code for ${title}`} />
      </div>
      <p className="text-[11px] text-muted break-all select-all">{retrievalUrl}</p>
      <button
        type="button"
        onClick={downloadQr}
        className="mx-auto flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-neutral-900 border border-card-border hover:bg-neutral-800 text-white rounded-lg transition-colors"
      >
        <Download className="h-3.5 w-3.5" /> Download QR image
      </button>
    </div>
  );
};

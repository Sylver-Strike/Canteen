import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, Scan, CheckCircle, ShieldAlert } from 'lucide-react';

interface AdminScannerProps {
  onCompleteOrder: (orderId: string) => Promise<{ message: string }>;
}

export const AdminScanner: React.FC<AdminScannerProps> = ({
  onCompleteOrder
}) => {
  const [manualId, setManualId] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [scannerActive, setScannerActive] = useState<boolean>(false);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (scannerActive) {
      // Create scanner instance
      scanner = new Html5QrcodeScanner(
        'qr-scanner-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        /* verbose= */ false
      );

      scanner.render(
        async (decodedText) => {
          // Success callback
          console.log(`Scan result: ${decodedText}`);
          if (scanner) {
            scanner.clear().catch(err => console.error(err));
          }
          setScannerActive(false);
          await handleScanSuccess(decodedText);
        },
        () => {
          // Silence spam errors from the scanner engine
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.log('Cleanup error', err));
      }
    };
  }, [scannerActive]);

  const handleScanSuccess = async (orderId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await onCompleteOrder(orderId);
      setMessage({ text: res.message || 'Order completed successfully!', isError: false });
    } catch (err: any) {
      setMessage({ text: err.message || 'Invalid Order ID', isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const res = await onCompleteOrder(manualId.trim());
      setMessage({ text: res.message || 'Order completed successfully!', isError: false });
      setManualId('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Invalid Order ID', isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanner-container animate-fade-in">
      <div className="glass" style={{ width: '100%', padding: '20px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', fontSize: '18px' }}>
          <Scan size={20} className="primary" />
          Pre-Order QR Validator
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Scan the student's receipt QR code or enter the Order ID to mark it as Completed upon food handoff.
        </p>
      </div>

      {message && (
        <div
          className="glass"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            borderLeft: `4px solid ${message.isError ? '#ef4444' : '#10b981'}`,
            background: message.isError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px'
          }}
        >
          {message.isError ? (
            <ShieldAlert size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
          )}
          <span style={{ color: '#ffffff' }}>{message.text}</span>
        </div>
      )}

      {/* Camera scan area */}
      <div className="scanner-viewscreen">
        {scannerActive ? (
          <div id="qr-scanner-reader" style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-muted)',
              padding: '20px'
            }}
          >
            <Camera size={48} strokeWidth={1} className="primary" />
            <button
              className="btn btn-primary"
              style={{ maxWidth: '200px' }}
              onClick={() => setScannerActive(true)}
            >
              Start Camera Scanner
            </button>
          </div>
        )}
        {scannerActive && <div className="scanner-overlay-line" />}
      </div>

      {scannerActive && (
        <button
          className="btn btn-secondary"
          onClick={() => setScannerActive(false)}
          style={{ maxWidth: '180px' }}
        >
          Cancel Scan
        </button>
      )}

      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>or enter manually</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
      </div>

      {/* Manual Input Form */}
      <form onSubmit={handleManualSubmit} className="manual-input-box">
        <input
          type="text"
          className="text-input"
          placeholder="e.g. ORD-104928"
          value={manualId}
          onChange={e => setManualId(e.target.value.toUpperCase())}
          disabled={loading}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: 'auto', padding: '0 24px' }}
          disabled={loading || !manualId.trim()}
        >
          {loading ? 'Validating...' : 'Complete'}
        </button>
      </form>
    </div>
  );
};
export default AdminScanner;

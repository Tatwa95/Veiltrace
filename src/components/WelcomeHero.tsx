import { ClipboardPaste, FileSpreadsheet, ShieldCheck, Sparkles, Upload } from 'lucide-react';

interface WelcomeHeroProps {
  onFocusPaste: () => void;
  onTriggerUpload: () => void;
  onLoadSampleText: () => void;
  onLoadSampleCsv: () => void;
}

export function WelcomeHero({
  onFocusPaste,
  onTriggerUpload,
  onLoadSampleText,
  onLoadSampleCsv,
}: WelcomeHeroProps) {
  return (
    <section className="hero-section" aria-labelledby="welcome-heading">
      <div className="hero-eyebrow">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Private Data Sanitization &amp; Provenance Workbench</span>
      </div>

      <h1 id="welcome-heading" className="hero-title">
        Know what’s in your file before you share it.
      </h1>

      <p className="hero-desc">
        Find what’s sensitive. Redact it locally. Share with confidence. Paste text or upload a <code>.txt</code> or{' '}
        <code>.csv</code> file, select <strong>Scan and redact</strong>, review every finding with plain-language
        explanations, and download a safer copy.
      </p>

      <div className="hero-note" role="note">
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
        <span>
          <strong>Browser-only processing (.txt &amp; .csv only):</strong> VeilTrace currently supports pasted
          plain text, <code>.txt</code>, and <code>.csv</code> files only—image, PDF, and Word documents are not
          supported. All inspection runs strictly in browser memory and nothing is uploaded or stored.
        </span>
      </div>

      <div className="hero-actions">
        <button type="button" className="btn btn-primary" onClick={onFocusPaste}>
          <ClipboardPaste size={18} aria-hidden="true" />
          <span>Paste text</span>
        </button>

        <button type="button" className="btn btn-secondary" onClick={onTriggerUpload}>
          <Upload size={18} aria-hidden="true" />
          <span>Upload .txt or .csv</span>
        </button>

        <button type="button" className="btn btn-secondary" onClick={onLoadSampleText}>
          <Sparkles size={18} aria-hidden="true" />
          <span>Try sample</span>
        </button>

        <button type="button" className="btn btn-ghost" onClick={onLoadSampleCsv}>
          <FileSpreadsheet size={18} aria-hidden="true" />
          <span>Try CSV sample</span>
        </button>
      </div>
    </section>
  );
}

import { ShieldCheck } from 'lucide-react';

export function AboutView() {
  return (
    <div className="workspace-stack">
      <section className="card card-padded">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <ShieldCheck size={22} aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>About VeilTrace</h1>
        </div>
        <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
          <strong>VeilTrace</strong> is a Private Data Sanitization &amp; Provenance Workbench built for the Google
          PromptWars challenge. Its goal is to make reviewing and redacting sensitive text clear, calm, and
          approachable—even for non-technical users and older adults.
        </p>

        <div className="prose-grid prose-grid-2" style={{ marginTop: '1rem' }}>
          <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Supported Formats (.txt and .csv Only)</h2>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
              <li>
                <strong>Pasted or typed plain text</strong> (exported as <code>.txt</code>)
              </li>
              <li>
                <strong>Plain text files (<code>.txt</code>)</strong> up to 5 MB
              </li>
              <li>
                <strong>Structured CSV files (<code>.csv</code>)</strong> up to 5 MB, preserving rows, columns,
                headers, quoting, commas, escaped quotes, and embedded line breaks
              </li>
            </ul>
          </div>

          <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Unsupported Formats</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              VeilTrace currently supports <strong>pasted text, <code>.txt</code>, and <code>.csv</code> only</strong>.
              Image files, PDFs, Word documents (<code>.docx</code>), OCR, and image pixel redaction are not
              supported in this release so every visible control remains reliable, local-only, and honest.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Privacy &amp; Guarantee Notice</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            VeilTrace is hosted as a static site, processes all user data and temporary custom terms strictly inside
            browser memory, and enforces a self-origin Content Security Policy (<code>connect-src &apos;self&apos;</code>).
            Automated pattern detection assists manual review; it may miss personal details and does not guarantee
            complete redaction, prove card validity, or verify legal identity.
          </p>
        </div>
      </section>
    </div>
  );
}

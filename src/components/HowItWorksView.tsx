import { CheckCircle2, Lock, ShieldAlert } from 'lucide-react';

const CHECKLIST_ROWS = [
  {
    requirement: 'Paste text, .txt/.csv upload, and synthetic Try sample',
    demonstrated: 'Sanitize tab -> Step 1 input, upload dropzone (5 MB limit), Try sample, Try CSV sample',
  },
  {
    requirement: 'Two-phase Scan and redact workflow & out-of-date notice',
    demonstrated: 'Pre-scan hides empty panels; editing input after scan flags results out of date with Scan again',
  },
  {
    requirement: 'Detect Email, Phone (IN & intl), IPv4, IPv6, PAN, Aadhaar-like, Card',
    demonstrated: 'Deterministic regex + boundary validator in src/lib/detector.ts',
  },
  {
    requirement: 'Reject Luhn-failing card lookalikes; label passing cards accurately',
    demonstrated: 'Sample tests 4532 1488 0343 6464 (passes Luhn) vs 4532 1488 0343 6469 (rejected)',
  },
  {
    requirement: 'Reject invalid IPs & numeric lookalikes',
    demonstrated: 'Sample ignores 999.42.10.300, 10.20.30.40.50, v2.4.1.0, and 1000456789012345',
  },
  {
    requirement: 'All 3 redaction modes + per-document consistent pseudonyms',
    demonstrated: 'Mode cards + PseudonymRegistry with explicit New document / reset mappings',
  },
  {
    requirement: 'Interactive highlights, annotated output, and What changed guidance',
    demonstrated: 'Select match inspector + shaded replacements + deterministic guidance in src/lib/guidance.ts',
  },
  {
    requirement: 'CSV structural preservation on parse & export',
    demonstrated: 'RFC 4180 cell-level redaction via PapaParse preserving quotes & newlines',
  },
  {
    requirement: 'Editorial monochrome UI, local-only privacy, and Prompt Log',
    demonstrated: 'High-contrast B&W editorial UI, CSP connect-src self, Prompt Log & About views',
  },
];

export function HowItWorksView() {
  return (
    <div className="workspace-stack">
      <section className="card card-padded">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <Lock size={20} aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>How local processing works</h1>
        </div>
        <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
          The VeilTrace application code is served as a static website from Firebase Hosting. Once loaded in your
          browser, <strong>all inspection, pattern matching, temporary custom-term matching, redaction, and CSV/TXT
          export run locally on your device</strong>. VeilTrace currently supports pasted text, <code>.txt</code>, and{' '}
          <code>.csv</code> files only (images, PDFs, and Word documents are not supported).
        </p>

        <div className="prose-grid prose-grid-2">
          <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>What VeilTrace does</h2>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
              <li>Keeps pasted text and uploaded files in browser memory only.</li>
              <li>Uses deterministic pattern rules, boundary checks, and Luhn checksum validation.</li>
              <li>Applies redactions once using original character offsets so offsets never drift.</li>
              <li>Clears working data from memory when you click Clear data or close the tab.</li>
            </ul>
          </div>

          <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>What VeilTrace never does</h2>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
              <li>Never uploads your files or text to a backend server or AI model.</li>
              <li>Never stores user content in localStorage, sessionStorage, IndexedDB, cookies, or URLs.</li>
              <li>Never writes user text to application logs or analytics.</li>
              <li>Never loads third-party fonts, trackers, or external scripts.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="card card-padded">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <ShieldAlert size={20} aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Important limitations to keep in mind</h2>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.45rem' }}>
          <li>
            <strong>“No detections found” is not proof of safety:</strong> It only means no supported patterns
            matched. Names, addresses, account notes, or unstructured secrets can still be present.
          </li>
          <li>
            <strong>Pattern matching is not verification:</strong> PAN and Aadhaar-like matches recognize formatting
            only—they do not verify real identities.
          </li>
          <li>
            <strong>Luhn is a checksum only:</strong> A passing 13–19 digit card candidate means the check digit is
            mathematically consistent, not that a card is active or real.
          </li>
          <li>
            <strong>Partial masking &amp; pseudonyms keep clues:</strong> Use Full Mask when sharing externally if
            even last-four digits or email domains could identify someone.
          </li>
        </ul>
      </section>

      <section className="card card-padded">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <CheckCircle2 size={20} aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Challenge Checklist (Feature Map)</h2>
        </div>
        <p style={{ marginTop: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Quick reference for reviewers showing where each core requirement is implemented. This is a functional
          feature guide, not a legal or security compliance certification.
        </p>

        <div className="csv-table-wrap">
          <table className="checklist-table">
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Where it is demonstrated</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLIST_ROWS.map((row) => (
                <tr key={row.requirement}>
                  <td>
                    <strong>{row.requirement}</strong>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.demonstrated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

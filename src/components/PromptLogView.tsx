import { FileCode2, Info } from 'lucide-react';
import { DEVELOPMENT_PROMPT_LOG } from '../data/promptLogData';

export function PromptLogView() {
  return (
    <div className="workspace-stack">
      <section className="card card-padded">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
          <FileCode2 size={22} aria-hidden="true" />
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Development Prompt Log</h1>
        </div>
        <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
          This log records the actual development prompts and iterations used to build VeilTrace (matching{' '}
          <code>PROMPT_LOG.md</code> in the repository).
        </p>

        <div className="alert-box" role="note" style={{ marginBottom: '1.25rem' }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <span>
            <strong>Separated from user data:</strong> Nothing you paste or upload in the Sanitize workspace is ever
            recorded here.
          </span>
        </div>

        <div className="findings-list">
          {DEVELOPMENT_PROMPT_LOG.map((entry) => (
            <article key={entry.step} className="finding-row" style={{ flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <span className="badge badge-dark">{entry.step}</span>
                <span className="badge">{entry.timestamp}</span>
              </div>
              <div>
                <strong>Prompt brief:</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{entry.promptSummary}</span>
              </div>
              <div>
                <strong>Outcome:</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{entry.outcome}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

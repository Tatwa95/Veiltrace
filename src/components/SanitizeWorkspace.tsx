import { ChangeEvent, DragEvent, KeyboardEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Info,
  Plus,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  CustomTerm,
  Detection,
  EntityType,
  RedactionMode,
  ScanSnapshot,
} from '../types/veiltrace';
import { ALL_ENTITY_TYPES, ENTITY_META } from '../lib/detector';
import type { OutputSegment } from '../lib/redactor';
import { parseCsvContent } from '../lib/csv';
import { useSanitizationResults } from '../hooks/useSanitizationResults';
import {
  SAMPLE_CSV_FILE_NAME,
  SAMPLE_FILE_NAME,
  SYNTHETIC_SAMPLE_CSV,
  SYNTHETIC_SAMPLE_TEXT,
} from '../lib/sampleData';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB browser memory safeguard
const MODES_ORDER: RedactionMode[] = ['full', 'partial', 'pseudonym'];

interface SanitizeWorkspaceProps {
  rawInput: string;
  setRawInput: (val: string) => void;
  sourceName: string;
  setSourceName: (name: string) => void;
  sourceSizeBytes: number | null;
  setSourceSizeBytes: (size: number | null) => void;
  sourceKind: 'text' | 'csv';
  setSourceKind: (kind: 'text' | 'csv') => void;
  mode: RedactionMode;
  setMode: (mode: RedactionMode) => void;
  customTerms: CustomTerm[];
  setCustomTerms: (terms: CustomTerm[]) => void;
  exclusions: Map<string, boolean>;
  setExclusions: (map: Map<string, boolean>) => void;
  scanSnapshot: ScanSnapshot | null;
  setScanSnapshot: (snapshot: ScanSnapshot | null) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  fileInputRef: RefObject<HTMLInputElement>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildSanitizedFilename(sourceName: string, kind: 'text' | 'csv'): string {
  const ext = kind === 'csv' ? '.csv' : '.txt';
  const clean = sourceName.trim() || (kind === 'csv' ? 'table.csv' : 'pasted-text.txt');
  const dotIdx = clean.lastIndexOf('.');
  const base = dotIdx > 0 ? clean.slice(0, dotIdx) : clean;
  return `${base}-sanitized${ext}`;
}

function HighlightedTextSegment({
  text,
  detections,
  selectedId,
  onSelect,
}: {
  text: string;
  detections: Detection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!text) return null;
  if (detections.length === 0) {
    return <>{text}</>;
  }

  const sorted = [...detections].sort((a, b) => a.start - b.start);
  const parts: Array<{ key: string; text: string; detection?: Detection }> = [];
  let cursor = 0;

  for (const det of sorted) {
    if (det.start < cursor || det.end > text.length) continue;
    if (det.start > cursor) {
      parts.push({ key: `plain-${cursor}`, text: text.slice(cursor, det.start) });
    }
    parts.push({
      key: det.id,
      text: text.slice(det.start, det.end),
      detection: det,
    });
    cursor = det.end;
  }

  if (cursor < text.length) {
    parts.push({ key: `tail-${cursor}`, text: text.slice(cursor) });
  }

  return (
    <>
      {parts.map((part) => {
        if (!part.detection) {
          return <span key={part.key}>{part.text}</span>;
        }
        const det = part.detection;
        const isSelected = selectedId === det.id;
        return (
          <button
            key={part.key}
            type="button"
            className={`highlight-token ${det.included ? '' : 'excluded'} ${
              isSelected ? 'active-selected' : ''
            }`}
            onClick={() => onSelect(det.id)}
            aria-pressed={isSelected}
            title={`${ENTITY_META[det.type].label} (${det.label}) — Select to inspect or toggle`}
            aria-label={`${ENTITY_META[det.type].label}: ${part.text}. ${det.label}. Currently ${
              det.included ? 'included for redaction' : 'excluded'
            }. Select to inspect.`}
          >
            <span>{part.text}</span>
            <span className="highlight-tag">{ENTITY_META[det.type].shortLabel}</span>
          </button>
        );
      })}
    </>
  );
}

function AnnotatedOutputSegments({ segments }: { segments: OutputSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <>
      {segments.map((seg, idx) =>
        seg.isReplacement ? (
          <span
            key={`rep-${idx}`}
            className="replacement-token"
            title={
              seg.detection
                ? `Replaced ${ENTITY_META[seg.detection.type].label}`
                : 'Replaced value'
            }
          >
            {seg.text}
          </span>
        ) : (
          <span key={`txt-${idx}`}>{seg.text}</span>
        )
      )}
    </>
  );
}

export function SanitizeWorkspace({
  rawInput,
  setRawInput,
  sourceName,
  setSourceName,
  sourceSizeBytes,
  setSourceSizeBytes,
  sourceKind,
  setSourceKind,
  mode,
  setMode,
  customTerms,
  setCustomTerms,
  exclusions,
  setExclusions,
  scanSnapshot,
  setScanSnapshot,
  textareaRef,
  fileInputRef,
}: SanitizeWorkspaceProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [newTermInput, setNewTermInput] = useState('');
  const [customTermFeedback, setCustomTermFeedback] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | EntityType>('ALL');
  const [csvViewMode, setCsvViewMode] = useState<'table' | 'raw'>('table');
  const [copied, setCopied] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);

  const resultsRegionRef = useRef<HTMLDivElement>(null);
  const cancelClearBtnRef = useRef<HTMLButtonElement>(null);
  const modeCardRefs = useRef<Record<RedactionMode, HTMLButtonElement | null>>({
    full: null,
    partial: null,
    pseudonym: null,
  });

  useEffect(() => {
    if (confirmClearOpen) {
      cancelClearBtnRef.current?.focus();
    }
  }, [confirmClearOpen]);

  const handleLoadSampleText = () => {
    setFileError(null);
    setCustomTermFeedback(null);
    setSourceKind('text');
    setSourceName(SAMPLE_FILE_NAME);
    setSourceSizeBytes(new Blob([SYNTHETIC_SAMPLE_TEXT]).size);
    setExclusions(new Map());
    setScanSnapshot(null);
    setSelectedDetectionId(null);
    setRawInput(SYNTHETIC_SAMPLE_TEXT);
    setStatusMessage('Loaded synthetic sample text. Select Scan and redact to inspect.');
  };

  const handleLoadSampleCsv = () => {
    setFileError(null);
    setCustomTermFeedback(null);
    setSourceKind('csv');
    setSourceName(SAMPLE_CSV_FILE_NAME);
    setSourceSizeBytes(new Blob([SYNTHETIC_SAMPLE_CSV]).size);
    setExclusions(new Map());
    setScanSnapshot(null);
    setSelectedDetectionId(null);
    setRawInput(SYNTHETIC_SAMPLE_CSV);
    setCsvViewMode('table');
    setStatusMessage('Loaded synthetic CSV sample. Select Scan and redact to inspect.');
  };

  const processSelectedFile = async (file: File) => {
    setFileError(null);
    setCustomTermFeedback(null);

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv');
    const isTxt = lowerName.endsWith('.txt');

    if (!isCsv && !isTxt) {
      setFileError(
        `Unsupported file format ("${file.name}"). VeilTrace currently supports .txt and .csv files only—image, PDF, and Word documents are not supported.`
      );
      return;
    }

    if (file.size === 0) {
      setFileError(`"${file.name}" is empty (0 bytes). Paste text or choose a non-empty .txt or .csv file.`);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFileError(
        `"${file.name}" (${formatBytes(file.size)}) exceeds the ${formatBytes(
          MAX_FILE_BYTES
        )} browser processing limit. Split the file or paste a smaller excerpt.`
      );
      return;
    }

    setIsLoadingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const sampleSlice = bytes.subarray(0, Math.min(bytes.length, 4096));
      for (let i = 0; i < sampleSlice.length; i += 1) {
        if (sampleSlice[i] === 0) {
          throw new Error('This file appears to contain binary data and cannot be read safely as plain text.');
        }
      }

      // A lossy decode can alter an identifier before detection. Fail clearly
      // so users can re-export the file as UTF-8 instead of trusting a partial scan.
      let decoded: string;
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new Error('This file is not valid UTF-8. Re-save it as UTF-8 and upload it again.');
      }
      if (isCsv) {
        parseCsvContent(decoded);
      }

      setSourceKind(isCsv ? 'csv' : 'text');
      setSourceName(file.name);
      setSourceSizeBytes(file.size);
      setExclusions(new Map());
      setScanSnapshot(null);
      setSelectedDetectionId(null);
      setRawInput(decoded);
      if (isCsv) setCsvViewMode('table');
      setStatusMessage(
        `Loaded ${file.name} (${formatBytes(file.size)}) in browser memory. Select Scan and redact to continue.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to read the selected file.';
      setFileError(`Could not read "${file.name}": ${message}`);
    } finally {
      setIsLoadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const runScan = () => {
    if (!rawInput.trim()) return;
    setFileError(null);
    setSelectedDetectionId(null);
    setExclusions(new Map());
    setScanSnapshot({
      text: rawInput,
      kind: sourceKind,
      sourceName,
      sizeBytes: sourceSizeBytes,
    });
    setTypeFilter('ALL');
    setReviewOpen(true);
    setStatusMessage('Scan complete. Review detected items, custom terms, and sanitized output below.');
    window.setTimeout(() => {
      resultsRegionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const isOutOfDate =
    scanSnapshot !== null &&
    (rawInput !== scanSnapshot.text || sourceKind !== scanSnapshot.kind);

  const {
    parsedCsv,
    detections,
    sanitizedOutput,
    sanitizedSegments,
    sanitizedCsvRowSegments,
    pseudonymMappings,
    stats,
    summarySentence,
    guidanceLines,
    filteredDetections,
    csvDetectionsByCell,
  } = useSanitizationResults({
    snapshot: scanSnapshot,
    customTerms,
    exclusions,
    mode,
    typeFilter,
  });
  const selectedDetection = useMemo(
    () => detections.find((d) => d.id === selectedDetectionId) ?? null,
    [detections, selectedDetectionId]
  );

  const toggleDetection = (id: string) => {
    const current = detections.find((d) => d.id === id);
    const nextIncluded = current ? !current.included : false;
    const next = new Map(exclusions);
    next.set(id, nextIncluded);
    setExclusions(next);
  };

  const setAllIncluded = (included: boolean) => {
    const next = new Map(exclusions);
    for (const det of filteredDetections) {
      next.set(det.id, included);
    }
    setExclusions(next);
    setStatusMessage(
      included
        ? `Included ${filteredDetections.length} findings for redaction.`
        : `Excluded ${filteredDetections.length} findings from redaction.`
    );
  };

  const handleAddCustomTerm = () => {
    const trimmed = newTermInput.trim();
    if (!trimmed) return;
    const duplicate = customTerms.some(
      (item) => item.term.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setNewTermInput('');
      setCustomTermFeedback(`"${trimmed}" is already in your active custom terms list.`);
      return;
    }
    const nextTerms = [...customTerms, { id: `${Date.now()}-${Math.random()}`, term: trimmed }];
    setCustomTerms(nextTerms);
    setNewTermInput('');
    const msg = `Added custom term "${trimmed}" (browser memory only) — detections and sanitized output updated.`;
    setCustomTermFeedback(msg);
    setStatusMessage(msg);
  };

  const handleRemoveCustomTerm = (id: string, termLabel: string) => {
    setCustomTerms(customTerms.filter((t) => t.id !== id));
    const msg = `Removed custom term "${termLabel}" — detections and sanitized output updated.`;
    setCustomTermFeedback(msg);
    setStatusMessage(msg);
  };

  const handleResetMappings = () => {
    setExclusions(new Map());
    setSelectedDetectionId(null);
    setStatusMessage('Reset pseudonym mappings and finding exclusions for this document.');
  };

  const handleRemoveFile = () => {
    setSourceName('Pasted text');
    setSourceSizeBytes(null);
    setSourceKind('text');
    setFileError(null);
    setExclusions(new Map());
    setScanSnapshot(null);
    setSelectedDetectionId(null);
    setRawInput('');
    setStatusMessage('Removed loaded file and cleared input.');
  };

  const performClearAll = () => {
    setRawInput('');
    setSourceName('Pasted text');
    setSourceSizeBytes(null);
    setSourceKind('text');
    setCustomTerms([]);
    setCustomTermFeedback(null);
    setExclusions(new Map());
    setScanSnapshot(null);
    setSelectedDetectionId(null);
    setFileError(null);
    setTypeFilter('ALL');
    setConfirmClearOpen(false);
    setStatusMessage('Cleared all working data and custom terms from browser memory.');
  };

  const handleRequestClear = () => {
    if (!rawInput.trim() && customTerms.length === 0 && scanSnapshot === null) {
      performClearAll();
      return;
    }
    setConfirmClearOpen(true);
  };

  const handleDownload = () => {
    if (!scanSnapshot) return;
    const filename = buildSanitizedFilename(scanSnapshot.sourceName, scanSnapshot.kind);
    const mimeType =
      scanSnapshot.kind === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([sanitizedOutput], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    setStatusMessage(`Downloaded sanitized file "${filename}".`);
  };

  const handleCopyOutput = async () => {
    if (!sanitizedOutput) return;
    try {
      await navigator.clipboard.writeText(sanitizedOutput);
      setCopied(true);
      setStatusMessage('Copied sanitized output to clipboard.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('Could not copy automatically. Select the preview text to copy.');
    }
  };

  const handleModeKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentMode: RedactionMode) => {
    const idx = MODES_ORDER.indexOf(currentMode);
    let nextIdx = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = (idx + 1) % MODES_ORDER.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = (idx - 1 + MODES_ORDER.length) % MODES_ORDER.length;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      const targetMode = MODES_ORDER[nextIdx];
      setMode(targetMode);
      modeCardRefs.current[targetMode]?.focus();
    }
  };

  const hasRawInput = rawInput.trim().length > 0;

  return (
    <div className="workspace-stack">
      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>

      {/* Step 1: Pre-scan Input & Upload Card */}
      <section className="card card-padded" aria-labelledby="input-section-heading">
        <div className="toolbar-row" style={{ marginBottom: '1rem' }}>
          <div>
            <span className="editorial-kicker">Step 1 · Input</span>
            <h2 id="input-section-heading" style={{ margin: '0.15rem 0 0', fontSize: '1.25rem' }}>
              Provide text or upload a supported file
            </h2>
            <div className="source-meta" style={{ marginTop: '0.5rem' }}>
              <span className="badge badge-dark">
                <FileText size={14} aria-hidden="true" />
                <span>{rawInput.length > 0 ? sourceName : 'No document loaded'}</span>
              </span>
              {sourceSizeBytes !== null && (
                <span className="badge">{formatBytes(sourceSizeBytes)}</span>
              )}
              {rawInput.length > 0 && (
                <span className="badge">
                  {sourceKind === 'csv' ? 'CSV (structure preserved)' : 'Plain text'}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadSampleText}>
              <Sparkles size={15} aria-hidden="true" />
              <span>Try sample</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadSampleCsv}>
              <span>Try CSV sample</span>
            </button>
            {sourceSizeBytes !== null && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleRemoveFile}>
                <X size={15} aria-hidden="true" />
                <span>Remove file</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRequestClear}
              disabled={!hasRawInput && customTerms.length === 0 && scanSnapshot === null}
            >
              <Trash2 size={15} aria-hidden="true" />
              <span>Clear data</span>
            </button>
          </div>
        </div>

        {/* Drag & drop upload */}
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{ marginBottom: '1rem' }}
        >
          <div>
            <strong>Upload a local file (.txt or .csv only)</strong>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Supported formats only: <code>.txt</code> and <code>.csv</code> up to{' '}
              <strong>{formatBytes(MAX_FILE_BYTES)}</strong>. Image, PDF, and Word documents are not supported.
              Processed strictly in browser memory.
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              id="veiltrace-file-input"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingFile}
            >
              <Upload size={17} aria-hidden="true" />
              <span>{isLoadingFile ? 'Reading file…' : 'Choose .txt or .csv'}</span>
            </button>
          </div>
        </div>

        {fileError && (
          <div className="alert-box alert-box-dark" role="alert" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <div>
                <strong>File could not be loaded</strong>
                <div>{fileError}</div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="veiltrace-text-input" className="field-label">
            Paste or edit text directly
          </label>
          <textarea
            ref={textareaRef}
            id="veiltrace-text-input"
            className="textarea-input"
            value={rawInput}
            onChange={(e) => {
              const val = e.target.value;
              setRawInput(val);
              if (val.length === 0) {
                setSourceName('Pasted text');
                setSourceSizeBytes(null);
                setSourceKind('text');
              } else if (!sourceSizeBytes) {
                setSourceName('Pasted text');
              }
            }}
            placeholder="Paste emails, notes, logs, or CSV content here — or click “Try sample” above, then select Scan and redact."
          />
        </div>

        {/* Prominent Scan and Redact action bar */}
        <div className="scan-action-bar">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {!hasRawInput
              ? 'Add text or upload a .txt / .csv file to enable scanning.'
              : scanSnapshot === null
                ? 'Ready to inspect locally in your browser.'
                : isOutOfDate
                  ? 'Input changed — scan again to refresh results.'
                  : 'Last scan matches current input.'}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={runScan}
            disabled={!hasRawInput || isLoadingFile}
          >
            <ScanSearch size={20} aria-hidden="true" />
            <span>{scanSnapshot === null || isOutOfDate ? 'Scan and redact' : 'Scan again'}</span>
          </button>
        </div>
      </section>

      {/* Post-scan results — hidden prior to scanning */}
      {scanSnapshot !== null && (
        <div ref={resultsRegionRef} className="workspace-stack" id="scan-results-region">
          {isOutOfDate && (
            <div className="alert-box alert-box-dark" role="alert">
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <strong>Results are out of date</strong>
                  <div>
                    The input text changed after your last scan. Select <strong>Scan again</strong> to inspect the
                    updated content.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={runScan}
                disabled={!hasRawInput}
              >
                <RefreshCw size={15} aria-hidden="true" />
                <span>Scan again</span>
              </button>
            </div>
          )}

          {parsedCsv.error && (
            <div className="alert-box" role="alert">
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <strong>CSV parsing notice:</strong> {parsedCsv.error} Falling back to plain text inspection.
                </div>
              </div>
            </div>
          )}

          {/* Scan Summary & Category Counts */}
          <section className="card card-padded" aria-labelledby="scan-summary-heading">
            <span className="editorial-kicker">Step 2 · Scan Summary</span>
            <h2 id="scan-summary-heading" style={{ margin: '0.15rem 0 0.85rem', fontSize: '1.3rem' }}>
              {summarySentence}
            </h2>

            <div className="stats-grid" style={{ marginBottom: '0.85rem' }}>
              <div className="stat-card stat-card-dark">
                <div className="stat-value">{stats.included}</div>
                <div className="stat-label">Selected to redact</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total detected</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.excluded}</div>
                <div className="stat-label">Excluded from redaction</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{customTerms.length}</div>
                <div className="stat-label">Custom terms (memory)</div>
              </div>
            </div>

            <div className="category-strip" aria-label="Counts by entity category">
              {ALL_ENTITY_TYPES.map((type) => {
                const count = stats.byType.get(type)!;
                return (
                  <div key={type} className="category-chip">
                    <strong>{ENTITY_META[type].shortLabel}:</strong>
                    <span>{count.total}</span>
                    {count.excluded > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                        ({count.excluded} excluded)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Prominent Temporary Custom Terms Panel (near Scan Summary) */}
          <section className="card card-padded" aria-labelledby="custom-terms-heading">
            <div className="toolbar-row" style={{ marginBottom: '0.5rem' }}>
              <div>
                <span className="editorial-kicker">Optional · Session Memory Only</span>
                <h2 id="custom-terms-heading" style={{ margin: '0.15rem 0 0', fontSize: '1.15rem' }}>
                  Temporary custom terms (names, project labels, ticket references)
                </h2>
              </div>
              <span className="badge">
                <Tag size={13} aria-hidden="true" />
                <span>{customTerms.length} active</span>
              </span>
            </div>

            <p style={{ margin: '0 0 0.85rem', fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
              Automatic pattern detection may miss personal details. Optional custom terms let you redact specific
              names, project labels, or ticket references that built-in patterns do not detect. Terms stay in browser
              memory only for this session and are never saved.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label htmlFor="custom-term-input" className="sr-only">
                Add temporary custom term
              </label>
              <input
                id="custom-term-input"
                type="text"
                className="text-input"
                style={{ flex: '1 1 250px', minHeight: '44px' }}
                value={newTermInput}
                onChange={(e) => setNewTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTerm();
                  }
                }}
                placeholder="e.g. Aarav Mehta, Helios-9, TK-101"
              />
              <button type="button" className="btn btn-primary" onClick={handleAddCustomTerm}>
                <Plus size={17} aria-hidden="true" />
                <span>Add custom term</span>
              </button>
            </div>

            {customTermFeedback && (
              <div
                className="alert-box"
                role="status"
                style={{ marginTop: '0.75rem', padding: '0.65rem 0.9rem' }}
              >
                <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
                  <Check size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span>{customTermFeedback}</span>
                </div>
              </div>
            )}

            {customTerms.length > 0 && (
              <div className="term-chips" aria-label="Active custom terms">
                {customTerms.map((item) => (
                  <span key={item.id} className="term-chip">
                    <span>{item.term}</span>
                    <button
                      type="button"
                      className="term-remove-btn"
                      aria-label={`Remove custom term ${item.term}`}
                      onClick={() => handleRemoveCustomTerm(item.id, item.term)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Redaction Mode Selector */}
          <section className="card card-padded" aria-labelledby="mode-heading">
            <div className="toolbar-row" style={{ marginBottom: '0.85rem' }}>
              <div>
                <span className="editorial-kicker">Redaction Mode</span>
                <h2 id="mode-heading" style={{ margin: '0.15rem 0 0', fontSize: '1.15rem' }}>
                  Choose how selected items are replaced
                </h2>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Illustrative examples only · Updates preview immediately
              </span>
            </div>

            <div className="mode-grid" role="radiogroup" aria-label="Redaction mode">
              <button
                ref={(el) => {
                  modeCardRefs.current.full = el;
                }}
                type="button"
                role="radio"
                aria-checked={mode === 'full'}
                className={`mode-card ${mode === 'full' ? 'selected' : ''}`}
                onClick={() => setMode('full')}
                onKeyDown={(e) => handleModeKeyDown(e, 'full')}
              >
                <span className="mode-card-title">Full Mask</span>
                <span className="mode-card-desc">
                  Replaces the entire value with a category marker. Strongest option for sharing.
                </span>
                <span className="mode-card-example">Example: [REDACTED: EMAIL]</span>
              </button>

              <button
                ref={(el) => {
                  modeCardRefs.current.partial = el;
                }}
                type="button"
                role="radio"
                aria-checked={mode === 'partial'}
                className={`mode-card ${mode === 'partial' ? 'selected' : ''}`}
                onClick={() => setMode('partial')}
                onKeyDown={(e) => handleModeKeyDown(e, 'partial')}
              >
                <span className="mode-card-title">Partial Mask</span>
                <span className="mode-card-desc">
                  Hides most characters and keeps minimal context (such as last 4 digits).
                </span>
                <span className="mode-card-example">Example: **** **** **** 6464</span>
              </button>

              <button
                ref={(el) => {
                  modeCardRefs.current.pseudonym = el;
                }}
                type="button"
                role="radio"
                aria-checked={mode === 'pseudonym'}
                className={`mode-card ${mode === 'pseudonym' ? 'selected' : ''}`}
                onClick={() => setMode('pseudonym')}
                onKeyDown={(e) => handleModeKeyDown(e, 'pseudonym')}
              >
                <span className="mode-card-title">Consistent Pseudonymization</span>
                <span className="mode-card-desc">
                  Replaces repeated normalized values with stable document placeholders per category.
                </span>
                <span className="mode-card-example">Example: EMAIL_01, CARD_01</span>
              </button>
            </div>
          </section>

          {/* No-detections explicit safeguard notice */}
          {detections.length === 0 && (
            <div className="alert-box" role="status">
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <strong>No detections found.</strong> This only means no supported patterns were found; it does not
                  prove the file contains no sensitive information (such as names, street addresses, or passwords).
                  Add optional custom terms above if needed.
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison Panes */}
          <section className="comparison-grid" aria-label="Original and sanitized comparison">
            {/* Left: Highlighted Original */}
            <div className="pane-card">
              <div className="pane-header">
                <div>
                  <h3 className="pane-title">Highlighted Original</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Select any highlight to inspect its reason and toggle redaction
                  </span>
                </div>

                {scanSnapshot.kind === 'csv' && parsedCsv.doc && (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${csvViewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCsvViewMode('table')}
                    >
                      Table view
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${csvViewMode === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCsvViewMode('raw')}
                    >
                      Raw CSV
                    </button>
                  </div>
                )}
              </div>

              <div className="pane-body">
                {scanSnapshot.kind === 'csv' && parsedCsv.doc && csvViewMode === 'table' ? (
                  <div className="csv-table-wrap">
                    <table className="csv-table">
                      <thead>
                        <tr>
                          {(parsedCsv.doc.rows[0] ?? []).map((cell, cIdx) => (
                            <th key={`orig-h-${cIdx}`}>
                              <HighlightedTextSegment
                                text={cell}
                                detections={csvDetectionsByCell.get(`0:${cIdx}`) ?? []}
                                selectedId={selectedDetectionId}
                                onSelect={setSelectedDetectionId}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedCsv.doc.rows.slice(1).map((row, rOffset) => {
                          const rIdx = rOffset + 1;
                          return (
                            <tr key={`orig-r-${rIdx}`}>
                              {row.map((cell, cIdx) => (
                                <td key={`orig-c-${rIdx}-${cIdx}`}>
                                  <HighlightedTextSegment
                                    text={cell}
                                    detections={csvDetectionsByCell.get(`${rIdx}:${cIdx}`) ?? []}
                                    selectedId={selectedDetectionId}
                                    onSelect={setSelectedDetectionId}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="pre-surface">
                    {scanSnapshot.kind === 'csv' && parsedCsv.doc ? (
                      scanSnapshot.text
                    ) : (
                      <HighlightedTextSegment
                        text={scanSnapshot.text}
                        detections={detections}
                        selectedId={selectedDetectionId}
                        onSelect={setSelectedDetectionId}
                      />
                    )}
                  </pre>
                )}

                {selectedDetection && (
                  <div className="selected-inspector" role="region" aria-label="Selected finding details">
                    <div style={{ flex: '1 1 240px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                        <span className="badge badge-dark">{ENTITY_META[selectedDetection.type].label}</span>
                        <span className="badge">{selectedDetection.label}</span>
                      </div>
                      <div style={{ marginTop: '0.45rem' }}>
                        <code className="mono-code">{selectedDetection.value}</code>
                      </div>
                      <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        {selectedDetection.reason}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn btn-sm ${selectedDetection.included ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => toggleDetection(selectedDetection.id)}
                    >
                      {selectedDetection.included ? 'Exclude from redaction' : 'Include in redaction'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sanitized Output Preview */}
            <div className="pane-card">
              <div className="pane-header">
                <div>
                  <h3 className="pane-title">Sanitized Output</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Replacements are shaded · Download matches exact plain output
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={runScan}>
                    <RefreshCw size={15} aria-hidden="true" />
                    <span>Scan again</span>
                  </button>

                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyOutput}>
                    {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    <span>{copied ? 'Copied' : 'Copy sanitized output'}</span>
                  </button>

                  <button type="button" className="btn btn-primary btn-sm" onClick={handleDownload}>
                    <Download size={16} aria-hidden="true" />
                    <span>Download sanitized file</span>
                  </button>
                </div>
              </div>

              <div className="pane-body">
                {scanSnapshot.kind === 'csv' && parsedCsv.doc && csvViewMode === 'table' ? (
                  <div className="csv-table-wrap">
                    <table className="csv-table">
                      <thead>
                        <tr>
                          {(sanitizedCsvRowSegments[0] ?? []).map((cellSegs, cIdx) => (
                            <th key={`san-h-${cIdx}`}>
                              <AnnotatedOutputSegments segments={cellSegs} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sanitizedCsvRowSegments.slice(1).map((rowSegs, rOffset) => (
                          <tr key={`san-r-${rOffset + 1}`}>
                            {rowSegs.map((cellSegs, cIdx) => (
                              <td key={`san-c-${rOffset + 1}-${cIdx}`}>
                                <AnnotatedOutputSegments segments={cellSegs} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : scanSnapshot.kind === 'csv' && parsedCsv.doc ? (
                  <pre className="pre-surface">{sanitizedOutput}</pre>
                ) : (
                  <pre className="pre-surface">
                    <AnnotatedOutputSegments segments={sanitizedSegments} />
                  </pre>
                )}
              </div>
            </div>
          </section>

          {/* What Changed / Guidance */}
          <section className="card card-padded" aria-labelledby="what-changed-heading">
            <span className="editorial-kicker">What Changed · Plain-Language Guidance</span>
            <h2 id="what-changed-heading" style={{ margin: '0.15rem 0 0', fontSize: '1.15rem' }}>
              Summary of planned replacements
            </h2>
            <ul className="guidance-list">
              {guidanceLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p style={{ margin: '0.85rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              VeilTrace uses deterministic pattern matching locally in your browser. It cannot guarantee that an output
              is completely free of sensitive data; always review before sharing.
            </p>
          </section>

          {/* Collapsible Review Findings */}
          <section className="card card-padded" aria-labelledby="review-findings-btn">
            <div className="toolbar-row">
              <button
                id="review-findings-btn"
                type="button"
                className="btn btn-ghost"
                style={{ paddingLeft: 0, fontSize: '1.1rem', fontWeight: 700 }}
                aria-expanded={reviewOpen}
                onClick={() => setReviewOpen((o) => !o)}
              >
                {reviewOpen ? (
                  <ChevronUp size={20} aria-hidden="true" />
                ) : (
                  <ChevronDown size={20} aria-hidden="true" />
                )}
                <span>Review findings ({detections.length})</span>
              </button>

              {reviewOpen && detections.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <label htmlFor="finding-type-filter" className="sr-only">
                    Filter findings by type
                  </label>
                  <select
                    id="finding-type-filter"
                    className="text-input"
                    style={{ width: 'auto', minHeight: '40px', padding: '0.35rem 0.7rem' }}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'ALL' | EntityType)}
                  >
                    <option value="ALL">All types ({detections.length})</option>
                    {ALL_ENTITY_TYPES.map((t) => {
                      const total = stats.byType.get(t)!.total;
                      if (total === 0) return null;
                      return (
                        <option key={t} value={t}>
                          {ENTITY_META[t].label} ({total})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAllIncluded(true)}
                  >
                    Include all
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAllIncluded(false)}
                  >
                    Exclude all
                  </button>
                </div>
              )}
            </div>

            {reviewOpen && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div className="toolbar-row">
                    <div>
                      <strong>Document Mapping &amp; Selection Controls</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Pseudonyms are scoped to this document only and never saved across sessions.
                      </div>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetMappings}>
                      <RotateCcw size={14} aria-hidden="true" />
                      <span>New document / reset mappings</span>
                    </button>
                  </div>

                  {mode === 'pseudonym' && pseudonymMappings.length > 0 && (
                    <div className="category-strip" style={{ marginTop: '0.75rem' }}>
                      {pseudonymMappings.map((m) => (
                        <span key={`${m.type}-${m.token}`} className="badge">
                          <span>{m.token}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            ({ENTITY_META[m.type].shortLabel})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {filteredDetections.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    No findings match the current filter.
                  </p>
                ) : (
                  <div className="findings-list">
                    {filteredDetections.map((det) => (
                      <div
                        key={det.id}
                        className={`finding-row ${det.included ? '' : 'excluded'} ${
                          selectedDetectionId === det.id ? 'selected-row' : ''
                        }`}
                      >
                        <div style={{ flex: '1 1 280px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
                            <span className="badge badge-dark">{ENTITY_META[det.type].shortLabel}</span>
                            <span className="badge">{det.label}</span>
                            {det.rowIndex !== undefined && (
                              <span className="badge badge-dashed">
                                Row {det.rowIndex + 1}
                                {det.columnHeader ? ` · ${det.columnHeader}` : ''}
                              </span>
                            )}
                          </div>
                          <div style={{ marginTop: '0.5rem' }}>
                            <code className="mono-code">{det.value}</code>
                          </div>
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.35rem',
                            }}
                          >
                            {det.reason}
                          </div>
                        </div>

                        <div>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              className="checkbox-input"
                              checked={det.included}
                              onChange={() => toggleDetection(det.id)}
                            />
                            <span>{det.included ? 'Include in redaction' : 'Excluded'}</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      {confirmClearOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setConfirmClearOpen(false);
            }
          }}
        >
          <div className="modal-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
              <ShieldAlert size={22} aria-hidden="true" />
              <h2 id="clear-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                Clear current working data?
              </h2>
            </div>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)' }}>
              This discards the current text or file, scan results, temporary custom terms, exclusions, and
              pseudonym mappings from browser memory.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                ref={cancelClearBtnRef}
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmClearOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={performClearAll}>
                Yes, clear data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

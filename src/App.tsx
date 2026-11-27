import { useRef, useState } from 'react';
import { AppTab, CustomTerm, RedactionMode } from './types/veiltrace';
import { Navbar } from './components/Navbar';
import { WelcomeHero } from './components/WelcomeHero';
import { SanitizeWorkspace } from './components/SanitizeWorkspace';
import { HowItWorksView } from './components/HowItWorksView';
import { PromptLogView } from './components/PromptLogView';
import { AboutView } from './components/AboutView';
import {
  SAMPLE_CSV_FILE_NAME,
  SAMPLE_FILE_NAME,
  SYNTHETIC_SAMPLE_CSV,
  SYNTHETIC_SAMPLE_TEXT,
} from './lib/sampleData';

export interface ScanSnapshot {
  text: string;
  kind: 'text' | 'csv';
  sourceName: string;
  sizeBytes: number | null;
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('sanitize');
  const [rawInput, setRawInput] = useState('');
  const [sourceName, setSourceName] = useState('Pasted text');
  const [sourceSizeBytes, setSourceSizeBytes] = useState<number | null>(null);
  const [sourceKind, setSourceKind] = useState<'text' | 'csv'>('text');
  const [mode, setMode] = useState<RedactionMode>('full');
  const [customTerms, setCustomTerms] = useState<CustomTerm[]>([]);
  const [exclusions, setExclusions] = useState<Map<string, boolean>>(new Map());
  const [scanSnapshot, setScanSnapshot] = useState<ScanSnapshot | null>(null);
  const [mappingEpoch, setMappingEpoch] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFocusPaste = () => {
    setActiveTab('sanitize');
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleTriggerUpload = () => {
    setActiveTab('sanitize');
    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleLoadSampleText = () => {
    setActiveTab('sanitize');
    setSourceKind('text');
    setSourceName(SAMPLE_FILE_NAME);
    setSourceSizeBytes(new Blob([SYNTHETIC_SAMPLE_TEXT]).size);
    setExclusions(new Map());
    setScanSnapshot(null);
    setMappingEpoch((e) => e + 1);
    setRawInput(SYNTHETIC_SAMPLE_TEXT);
  };

  const handleLoadSampleCsv = () => {
    setActiveTab('sanitize');
    setSourceKind('csv');
    setSourceName(SAMPLE_CSV_FILE_NAME);
    setSourceSizeBytes(new Blob([SYNTHETIC_SAMPLE_CSV]).size);
    setExclusions(new Map());
    setScanSnapshot(null);
    setMappingEpoch((e) => e + 1);
    setRawInput(SYNTHETIC_SAMPLE_CSV);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="main-content" style={{ flex: 1 }}>
        <div className="container">
          {activeTab === 'sanitize' && (
            <>
              <WelcomeHero
                onFocusPaste={handleFocusPaste}
                onTriggerUpload={handleTriggerUpload}
                onLoadSampleText={handleLoadSampleText}
                onLoadSampleCsv={handleLoadSampleCsv}
              />
              <SanitizeWorkspace
                rawInput={rawInput}
                setRawInput={setRawInput}
                sourceName={sourceName}
                setSourceName={setSourceName}
                sourceSizeBytes={sourceSizeBytes}
                setSourceSizeBytes={setSourceSizeBytes}
                sourceKind={sourceKind}
                setSourceKind={setSourceKind}
                mode={mode}
                setMode={setMode}
                customTerms={customTerms}
                setCustomTerms={setCustomTerms}
                exclusions={exclusions}
                setExclusions={setExclusions}
                scanSnapshot={scanSnapshot}
                setScanSnapshot={setScanSnapshot}
                mappingEpoch={mappingEpoch}
                setMappingEpoch={setMappingEpoch}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
              />
            </>
          )}

          {activeTab === 'how-it-works' && <HowItWorksView />}
          {activeTab === 'prompt-log' && <PromptLogView />}
          {activeTab === 'about' && <AboutView />}
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>
            <strong>VeilTrace</strong> — Find what’s sensitive. Redact it locally. Share with confidence.
          </span>
          <span>Browser-only processing · No data uploaded or stored</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

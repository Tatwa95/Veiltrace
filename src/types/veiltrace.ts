export type EntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'IPV4'
  | 'IPV6'
  | 'PAN'
  | 'AADHAAR'
  | 'CARD'
  | 'CUSTOM';

export type RedactionMode = 'full' | 'partial' | 'pseudonym';

export interface ScanSnapshot {
  text: string;
  kind: 'text' | 'csv';
  sourceName: string;
  sizeBytes: number | null;
}

export type ConfidenceLabel = 'Pattern match' | 'Review recommended' | 'Passes Luhn check';

export interface Detection {
  id: string;
  type: EntityType;
  value: string;
  normalizedValue: string;
  start: number;
  end: number;
  label: ConfidenceLabel;
  reason: string;
  included: boolean;
  /** Present when input is parsed as CSV */
  rowIndex?: number;
  colIndex?: number;
  columnHeader?: string;
}

export interface CustomTerm {
  id: string;
  term: string;
}

export interface EntityMeta {
  type: EntityType;
  label: string;
  shortLabel: string;
  description: string;
  partialExample: string;
  pseudonymPrefix: string;
}

export interface ParsedCsvDocument {
  rows: string[][];
  delimiter: string;
  newline: '\r\n' | '\n';
}

export type AppTab = 'sanitize' | 'how-it-works' | 'prompt-log' | 'about';

import Papa from 'papaparse';
import { CustomTerm, Detection, ParsedCsvDocument, RedactionMode } from '../types/veiltrace';
import { detectSensitiveData } from './detector';
import { buildRedactedSegments, OutputSegment, PseudonymRegistry } from './redactor';

export function parseCsvContent(rawCsv: string): ParsedCsvDocument {
  const newline: '\r\n' | '\n' = rawCsv.includes('\r\n') ? '\r\n' : '\n';

  const result = Papa.parse<string[]>(rawCsv, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
  });

  // A missing closing quote can make PapaParse absorb later rows into one cell.
  // Reject that input instead of letting the user review a misleading preview.
  const quoteError = result.errors.find(
    (error) => error.code === 'MissingQuotes' || error.code === 'InvalidQuotes'
  );
  if (quoteError) {
    throw new Error(`Invalid CSV quoting: ${quoteError.message}`);
  }
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors[0].message || 'Could not parse CSV file.');
  }

  // Work on our own rows; never mutate the parser's result while trimming the
  // optional record created by a trailing newline.
  const rows = result.data.map((row) => [...row]);
  if (
    rows.length > 1 &&
    rows[rows.length - 1].length === 1 &&
    rows[rows.length - 1][0] === '' &&
    (rawCsv.endsWith('\n') || rawCsv.endsWith('\r\n'))
  ) {
    rows.pop();
  }

  return {
    rows,
    delimiter: result.meta.delimiter || ',',
    newline,
  };
}

export function detectCsvDocument(
  doc: ParsedCsvDocument,
  customTerms: CustomTerm[],
  existingExclusions: Map<string, boolean>
): Detection[] {
  const headers = doc.rows[0] ?? [];
  const allDetections: Detection[] = [];

  for (let r = 0; r < doc.rows.length; r += 1) {
    const row = doc.rows[r];
    for (let c = 0; c < row.length; c += 1) {
      const cellValue = row[c];
      if (!cellValue) continue;
      const cellDetections = detectSensitiveData(cellValue, customTerms, existingExclusions, {
        rowIndex: r,
        colIndex: c,
        columnHeader: r === 0 ? undefined : headers[c] || `Column ${c + 1}`,
      });
      allDetections.push(...cellDetections);
    }
  }

  return allDetections;
}

export function redactCsvDocument(
  doc: ParsedCsvDocument,
  detections: Detection[],
  mode: RedactionMode,
  registry: PseudonymRegistry
): {
  sanitizedRows: string[][];
  sanitizedRowSegments: OutputSegment[][][];
  serializedCsv: string;
} {
  const byCell = new Map<string, Detection[]>();
  for (const det of detections) {
    const key = `${det.rowIndex ?? 0}:${det.colIndex ?? 0}`;
    const list = byCell.get(key) ?? [];
    list.push(det);
    byCell.set(key, list);
  }

  const sanitizedRows: string[][] = [];
  const sanitizedRowSegments: OutputSegment[][][] = [];

  for (let r = 0; r < doc.rows.length; r += 1) {
    const row = doc.rows[r];
    const outRow: string[] = [];
    const outSegRow: OutputSegment[][] = [];

    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      const cellDetections = byCell.get(`${r}:${c}`);
      if (!cellDetections || cellDetections.length === 0) {
        outRow.push(cell);
        outSegRow.push(cell ? [{ text: cell, isReplacement: false }] : []);
      } else {
        const res = buildRedactedSegments(cell, cellDetections, mode, registry);
        outRow.push(res.text);
        outSegRow.push(res.segments);
      }
    }

    sanitizedRows.push(outRow);
    sanitizedRowSegments.push(outSegRow);
  }

  const serializedCsv = Papa.unparse(sanitizedRows, {
    delimiter: doc.delimiter,
    newline: doc.newline,
    quotes: false,
    escapeChar: '"',
    quoteChar: '"',
  });

  return { sanitizedRows, sanitizedRowSegments, serializedCsv };
}

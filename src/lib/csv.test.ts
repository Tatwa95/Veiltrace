import { describe, expect, it } from 'vitest';
import { detectCsvDocument, parseCsvContent, redactCsvDocument } from './csv';
import { PseudonymRegistry } from './redactor';

describe('CSV sanitization', () => {
  it('preserves quoting, commas, escaped quotes, embedded newlines, and CRLF records', () => {
    const source =
      'name,email,note\r\nAlice,ana@example.org,"hello, ""team"""\r\nBob,ana@example.org,"line one\nline two"\r\n';
    const document = parseCsvContent(source);
    const detections = detectCsvDocument(document, [], new Map());
    const result = redactCsvDocument(document, detections, 'pseudonym', new PseudonymRegistry());
    const reparsed = parseCsvContent(result.serializedCsv);

    expect(document.newline).toBe('\r\n');
    expect(reparsed.rows).toEqual([
      ['name', 'email', 'note'],
      ['Alice', 'EMAIL_01', 'hello, "team"'],
      ['Bob', 'EMAIL_01', 'line one\nline two'],
    ]);
    expect(result.serializedCsv).toContain('\r\n');
    expect(detections[0]).toMatchObject({ rowIndex: 1, colIndex: 1, columnHeader: 'email' });
  });

  it('rejects an unclosed quoted field instead of returning a misleading parse', () => {
    expect(() => parseCsvContent('name,note\nAlice,"unfinished')).toThrow(/Invalid CSV quoting/);
  });

  it('trims only the empty EOF row caused by a final newline', () => {
    expect(parseCsvContent('name,value\nAlice,1\n').rows).toEqual([
      ['name', 'value'],
      ['Alice', '1'],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { detectSensitiveData } from './detector';
import {
  applyRedactionsToText,
  buildRedactedSegments,
  maskPartial,
  PseudonymRegistry,
} from './redactor';
import type { Detection } from '../types/veiltrace';

function makeDetection(type: Detection['type'], value: string): Detection {
  return {
    id: `${type}:0-${value.length}`,
    type,
    value,
    normalizedValue: value.toLowerCase(),
    start: 0,
    end: value.length,
    label: 'Pattern match',
    reason: 'Synthetic test value.',
    included: true,
  };
}

describe('redaction modes', () => {
  it('fully masks detected values', () => {
    const text = 'Contact ana@example.org';
    const result = buildRedactedSegments(text, detectSensitiveData(text), 'full', new PseudonymRegistry());
    expect(result.text).toBe('Contact [REDACTED: EMAIL]');
    expect(result.segments.some(({ isReplacement }) => isReplacement)).toBe(true);
  });

  it('partially masks payment cards while retaining the last four digits', () => {
    const text = 'Card 4111111111111111';
    const result = buildRedactedSegments(text, detectSensitiveData(text), 'partial', new PseudonymRegistry());
    expect(result.text).toBe('Card **** **** **** 1111');
  });

  it.each([
    ['AADHAAR', '2345-6789-0123', 'XXXX XXXX 0123'],
    ['PHONE', '+919876543210', '********3210'],
    ['EMAIL', 'ana@example.org', 'a***@example.org'],
    ['PAN', 'ABCDE1234F', '********4F'],
    ['IPV4', '192.0.2.10', '192.0.*.*'],
    ['IPV6', '2001:db8::1', '2001:****:****'],
    ['CUSTOM', 'ProjectX', 'P******'],
    ['CUSTOM', 'ID', '***'],
  ] as const)('partially masks %s values', (type, value, expected) => {
    expect(maskPartial(makeDetection(type, value))).toBe(expected);
  });

  it('uses one stable pseudonym for repeated normalized values', () => {
    const text = 'ana@example.org / ANA@example.org';
    const result = buildRedactedSegments(
      text,
      detectSensitiveData(text),
      'pseudonym',
      new PseudonymRegistry()
    );

    expect(result.text).toBe('EMAIL_01 / EMAIL_01');
  });

  it('ignores invalid offsets and resolves same-start spans deterministically', () => {
    const detection = (id: string, start: number, end: number): Detection => ({
      ...makeDetection('CUSTOM', 'secret'),
      id,
      start,
      end,
    });

    const result = buildRedactedSegments(
      'secret tail',
      [detection('invalid', -1, 3), detection('short', 0, 3), detection('long', 0, 6)],
      'full',
      new PseudonymRegistry()
    );

    expect(result.text).toBe('[REDACTED: CUSTOM] tail');
  });

  it('handles empty input, excluded findings, and the string-only helper', () => {
    const detection = makeDetection('EMAIL', 'ana@example.org');
    expect(buildRedactedSegments('', [detection], 'full', new PseudonymRegistry())).toEqual({
      text: '',
      segments: [],
    });
    expect(buildRedactedSegments('unchanged', [], 'full', new PseudonymRegistry()).text).toBe(
      'unchanged'
    );
    expect(
      applyRedactionsToText('ana@example.org', [detection], 'full', new PseudonymRegistry())
    ).toBe('[REDACTED: EMAIL]');
  });

  it('summarizes pseudonym mappings without exposing unregistered values', () => {
    const registry = new PseudonymRegistry();
    expect(registry.getSummary()).toEqual([]);
    expect(registry.getOrCreate('EMAIL', 'ana@example.org')).toBe('EMAIL_01');
    expect(registry.getOrCreate('EMAIL', 'bob@example.org')).toBe('EMAIL_02');
    expect(registry.getSummary()).toEqual([
      { type: 'EMAIL', normalizedValue: 'ana@example.org', token: 'EMAIL_01' },
      { type: 'EMAIL', normalizedValue: 'bob@example.org', token: 'EMAIL_02' },
    ]);
  });
});

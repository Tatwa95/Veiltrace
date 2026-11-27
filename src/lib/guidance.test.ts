import { describe, expect, it } from 'vitest';
import { detectSensitiveData } from './detector';
import { buildGuidanceStatements, buildScanSummarySentence } from './guidance';

describe('scan guidance', () => {
  it('summarizes no findings and mixed finding counts accurately', () => {
    expect(buildScanSummarySentence([])).toBe('No supported patterns were found in this document.');

    const detections = detectSensitiveData('ana@example.org and 192.0.2.10');
    expect(buildScanSummarySentence(detections)).toBe('We found 2 items to review across 2 categories.');
  });

  it('explains Luhn limits, excluded findings, and the selected mode', () => {
    const detections = detectSensitiveData('ana@example.org and 4111111111111111');
    detections[0].included = false;
    const guidance = buildGuidanceStatements(detections, 'pseudonym');

    expect(guidance.join(' ')).toContain('Luhn checksum');
    expect(guidance.join(' ')).toContain('finding was excluded');
    expect(guidance.join(' ')).toContain('within this document only');
  });

  it('explains phone, identity-format, IP, and custom-term counts', () => {
    const detections = [
      ...detectSensitiveData('Call +91 98765 43210'),
      ...detectSensitiveData('PAN ABCDE1234F and ID 2345-6789-0123'),
      ...detectSensitiveData('IPv4 192.0.2.10 and IPv6 2001:db8::1'),
      ...detectSensitiveData('Project CASE-42', [{ id: 'case', term: 'CASE-42' }]),
    ];
    const guidance = buildGuidanceStatements(detections, 'partial').join(' ');

    expect(guidance).toContain('phone number');
    expect(guidance).toContain('format only');
    expect(guidance).toContain('IP addresses');
    expect(guidance).toContain('custom session term match');
    expect(guidance).toContain('Partial Mask retains limited context');
  });

  it('gives a manual-review reminder when no supported patterns are found', () => {
    expect(buildGuidanceStatements([], 'full').join(' ')).toContain('Review the content manually');
  });
});

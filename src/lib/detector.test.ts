import { describe, expect, it } from 'vitest';
import { detectSensitiveData } from './detector';

describe('detectSensitiveData', () => {
  it.each([
    ['Contact ana@example.org', 'EMAIL', 'ana@example.org'],
    ['Call +91 98765 43210', 'PHONE', '+91 98765 43210'],
    ['Gateway 192.0.2.10', 'IPV4', '192.0.2.10'],
    ['Gateway 2001:db8::1', 'IPV6', '2001:db8::1'],
    ['PAN ABCDE1234F', 'PAN', 'ABCDE1234F'],
    ['ID 2345-6789-0123', 'AADHAAR', '2345-6789-0123'],
    ['Card 4111111111111111', 'CARD', '4111111111111111'],
  ])('detects %s as %s', (text, expectedType, expectedValue) => {
    const detections = detectSensitiveData(text);
    expect(detections).toContainEqual(
      expect.objectContaining({ type: expectedType, value: expectedValue, included: true })
    );
  });

  it('rejects invalid card checksums and malformed network addresses', () => {
    const detections = detectSensitiveData(
      '4111111111111112 1234567890123456 999.42.10.300 2001:db8:::1'
    );

    expect(detections.some(({ type }) => type === 'CARD')).toBe(false);
    expect(detections.some(({ type }) => type === 'IPV4' || type === 'IPV6')).toBe(false);
  });

  it('finds custom terms and respects an existing exclusion', () => {
    const text = 'Ticket CASE-42 belongs to ana@example.org';
    const customTerms = [{ id: 'ticket', term: 'CASE-42' }];
    const firstPass = detectSensitiveData(text, customTerms);
    const ticket = firstPass.find(({ type }) => type === 'CUSTOM');
    expect(ticket).toBeDefined();

    const detections = detectSensitiveData(text, customTerms, new Map([[ticket!.id, false]]));
    expect(detections.find(({ type }) => type === 'CUSTOM')?.included).toBe(false);
    expect(detections.find(({ type }) => type === 'EMAIL')?.included).toBe(true);
  });

  it('attaches CSV row, column, and header context to findings', () => {
    const [detection] = detectSensitiveData('ana@example.org', [], new Map(), {
      rowIndex: 2,
      colIndex: 1,
      columnHeader: 'email',
    });

    expect(detection).toMatchObject({ rowIndex: 2, colIndex: 1, columnHeader: 'email' });
    expect(detection.id).toMatch(/^r2-c1-/);
  });
});

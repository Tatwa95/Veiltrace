import { Detection, EntityType, RedactionMode } from '../types/veiltrace';

function countWord(n: number): string {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  return n >= 0 && n < words.length ? words[n] : String(n);
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildScanSummarySentence(detections: Detection[]): string {
  if (detections.length === 0) {
    return 'No supported patterns were found in this document.';
  }

  const activeCategories = new Set(detections.map((d) => d.type)).size;
  return `We found ${detections.length} ${pluralize(
    detections.length,
    'item',
    'items'
  )} to review across ${activeCategories} ${pluralize(activeCategories, 'category', 'categories')}.`;
}

/**
 * Deterministic, plain-language guidance generated purely from current scan results.
 * Never calls an AI model and never claims output is guaranteed safe.
 */
export function buildGuidanceStatements(
  detections: Detection[],
  mode: RedactionMode
): string[] {
  if (detections.length === 0) {
    return [
      'No supported patterns were found. Review the content manually before sharing, or add temporary custom terms for names and internal IDs.',
    ];
  }

  const activeByType = new Map<EntityType, number>();
  let excludedCount = 0;

  for (const det of detections) {
    if (det.included) {
      activeByType.set(det.type, (activeByType.get(det.type) ?? 0) + 1);
    } else {
      excludedCount += 1;
    }
  }

  const lines: string[] = [];

  const emailCount = activeByType.get('EMAIL') ?? 0;
  if (emailCount > 0) {
    lines.push(
      `${countWord(emailCount)} ${pluralize(emailCount, 'email address', 'email addresses')} will be replaced.`
    );
  }

  const phoneCount = activeByType.get('PHONE') ?? 0;
  if (phoneCount > 0) {
    lines.push(
      `${countWord(phoneCount)} ${pluralize(phoneCount, 'phone number', 'phone numbers')} will be replaced.`
    );
  }

  const cardCount = activeByType.get('CARD') ?? 0;
  if (cardCount > 0) {
    lines.push(
      `${countWord(cardCount)} ${pluralize(
        cardCount,
        'card candidate passes',
        'card candidates pass'
      )} the Luhn checksum. This does not prove ${pluralize(cardCount, 'it is a real card', 'they are real cards')}.`
    );
  }

  const panCount = activeByType.get('PAN') ?? 0;
  const aadhaarCount = activeByType.get('AADHAAR') ?? 0;
  if (panCount > 0 || aadhaarCount > 0) {
    const parts: string[] = [];
    if (panCount > 0) {
      parts.push(`${countWord(panCount).toLowerCase()} Indian PAN ${pluralize(panCount, 'format match', 'format matches')}`);
    }
    if (aadhaarCount > 0) {
      parts.push(
        `${countWord(aadhaarCount).toLowerCase()} Aadhaar-like 12-digit ${pluralize(
          aadhaarCount,
          'match',
          'matches'
        )}`
      );
    }
    lines.push(
      `Detected ${parts.join(' and ')} by pattern format only; this does not verify identity.`
    );
  }

  const ipCount = (activeByType.get('IPV4') ?? 0) + (activeByType.get('IPV6') ?? 0);
  if (ipCount > 0) {
    lines.push(
      `${countWord(ipCount)} ${pluralize(ipCount, 'IP address', 'IP addresses')} will be replaced.`
    );
  }

  const customCount = activeByType.get('CUSTOM') ?? 0;
  if (customCount > 0) {
    lines.push(
      `${countWord(customCount)} custom session ${pluralize(customCount, 'term match', 'term matches')} will be replaced.`
    );
  }

  if (excludedCount > 0) {
    lines.push(
      `${countWord(excludedCount)} ${pluralize(
        excludedCount,
        'finding was excluded and remains',
        'findings were excluded and remain'
      )} visible in the output.`
    );
  }

  if (mode === 'partial') {
    lines.push(
      'Partial Mask retains limited context (such as last four digits or domain). Switch to Full Mask if those clues could identify someone.'
    );
  } else if (mode === 'pseudonym') {
    lines.push(
      'Consistent Pseudonymization links repeated normalized values within this document only and resets when you start a new document.'
    );
  }

  return lines;
}

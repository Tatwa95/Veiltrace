import { CustomTerm, Detection, EntityMeta, EntityType } from '../types/veiltrace';
import { passesLuhnCheck } from './luhn';

export const ENTITY_META: Record<EntityType, EntityMeta> = {
  EMAIL: {
    type: 'EMAIL',
    label: 'Email Address',
    shortLabel: 'EMAIL',
    description: 'Standard email address format',
    partialExample: 'a***@example.com',
    pseudonymPrefix: 'EMAIL',
  },
  PHONE: {
    type: 'PHONE',
    label: 'Phone Number',
    shortLabel: 'PHONE',
    description: 'Indian or international telephone format',
    partialExample: '******3210',
    pseudonymPrefix: 'PHONE',
  },
  IPV4: {
    type: 'IPV4',
    label: 'IPv4 Address',
    shortLabel: 'IPV4',
    description: 'Four dotted octets (0–255)',
    partialExample: '192.168.*.*',
    pseudonymPrefix: 'IPV4',
  },
  IPV6: {
    type: 'IPV6',
    label: 'IPv6 Address',
    shortLabel: 'IPV6',
    description: 'Standard or compressed 128-bit IPv6 format',
    partialExample: '2001:db8::****',
    pseudonymPrefix: 'IPV6',
  },
  PAN: {
    type: 'PAN',
    label: 'Indian PAN Format',
    shortLabel: 'PAN',
    description: '10-character AAAAA9999A format (format recognition only)',
    partialExample: '********4F',
    pseudonymPrefix: 'PAN',
  },
  AADHAAR: {
    type: 'AADHAAR',
    label: 'Aadhaar-like 12-Digit',
    shortLabel: 'AADHAAR',
    description: '12-digit Aadhaar-like format (format recognition only)',
    partialExample: 'XXXX XXXX 9012',
    pseudonymPrefix: 'AADHAAR',
  },
  CARD: {
    type: 'CARD',
    label: 'Payment Card Candidate',
    shortLabel: 'CARD',
    description: '13–19 digit grouping passing Luhn checksum',
    partialExample: '**** **** **** 6467',
    pseudonymPrefix: 'CARD',
  },
  CUSTOM: {
    type: 'CUSTOM',
    label: 'Custom Term',
    shortLabel: 'CUSTOM',
    description: 'Temporary session-only user term',
    partialExample: 'A***',
    pseudonymPrefix: 'CUSTOM',
  },
};

export const ALL_ENTITY_TYPES: EntityType[] = [
  'EMAIL',
  'PHONE',
  'CARD',
  'PAN',
  'AADHAAR',
  'IPV4',
  'IPV6',
  'CUSTOM',
];

const PRIORITY: Record<EntityType, number> = {
  CUSTOM: 8,
  EMAIL: 7,
  CARD: 6,
  AADHAAR: 5,
  PAN: 4,
  IPV6: 3,
  IPV4: 2,
  PHONE: 1,
};

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

function isDigitOrAlpha(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

function isValidIPv4(raw: string): boolean {
  const parts = raw.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}

/**
 * Validates IPv6 including compressed `::` and optional trailing IPv4.
 * Returns normalized 8-hextet lowercase string or null if invalid.
 */
function normalizeIPv6(raw: string): string | null {
  if (!raw || raw === '::' || raw.includes(':::')) return null;

  // Reject single leading or trailing colon
  if ((raw.startsWith(':') && !raw.startsWith('::')) || (raw.endsWith(':') && !raw.endsWith('::'))) {
    return null;
  }

  const doubleColonParts = raw.split('::');
  if (doubleColonParts.length > 2) return null;

  const hasCompression = doubleColonParts.length === 2;
  const leftGroups = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
  const rightGroups = hasCompression && doubleColonParts[1] ? doubleColonParts[1].split(':') : [];

  const parseGroups = (groups: string[], allowTrailingIpv4: boolean): string[] | null => {
    const out: string[] = [];
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      if (!g) return null;
      if (allowTrailingIpv4 && i === groups.length - 1 && g.includes('.')) {
        if (!isValidIPv4(g)) return null;
        const octets = g.split('.').map(Number);
        const hi = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, '0');
        const lo = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, '0');
        out.push(hi, lo);
      } else {
        if (!/^[0-9A-Fa-f]{1,4}$/.test(g)) return null;
        out.push(g.toLowerCase().padStart(4, '0'));
      }
    }
    return out;
  };

  const leftParsed = parseGroups(leftGroups, !hasCompression);
  if (!leftParsed) return null;

  const rightParsed = hasCompression ? parseGroups(rightGroups, true) : [];
  if (!rightParsed) return null;

  const totalGroups = leftParsed.length + rightParsed.length;
  if (hasCompression) {
    if (totalGroups >= 8 || totalGroups < 1) return null;
    const zeros = new Array<string>(8 - totalGroups).fill('0000');
    return [...leftParsed, ...zeros, ...rightParsed].join(':');
  }

  if (totalGroups !== 8) return null;
  return leftParsed.join(':');
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  // Normalize Indian mobile variants (+91..., 0..., 10-digit) to the same key
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `IN:${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `IN:${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `IN:${digits.slice(2)}`;
  }
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface RawCandidate {
  type: EntityType;
  value: string;
  normalizedValue: string;
  start: number;
  end: number;
  label: Detection['label'];
  reason: string;
}

function findEmailCandidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  const regex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    const prev = text[start - 1];
    const next = text[end];

    if (isWordChar(prev) || isWordChar(next)) continue;

    const [local, domain] = value.split('@');
    if (!local || !domain) continue;
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) continue;
    if (domain.startsWith('-') || domain.endsWith('-') || domain.includes('..')) continue;

    results.push({
      type: 'EMAIL',
      value,
      normalizedValue: value.toLowerCase(),
      start,
      end,
      label: 'Pattern match',
      reason: 'Matches standard local@domain.tld email syntax.',
    });
  }
  return results;
}

function findCardCandidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  // Common 13-19 digit card groupings with uniform spaces or hyphens, or contiguous digits
  const regex = /\b(?:\d{4}(?:[ -]\d{4}){2,3}(?:[ -]\d{1,3})?|\d{4}[ -]\d{6}[ -]\d{5}|\d{13,19})\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    const prev = text[start - 1];
    const next = text[end];

    // Prevent matching inside longer hyphenated/dotted/alphanumeric tokens
    if (prev === '-' || prev === '.' || next === '-' || next === '.') continue;
    if (isDigitOrAlpha(prev) || isDigitOrAlpha(next)) continue;

    const digits = value.replace(/\D/g, '');
    if (!passesLuhnCheck(digits)) continue;

    results.push({
      type: 'CARD',
      value,
      normalizedValue: digits,
      start,
      end,
      label: 'Passes Luhn check',
      reason: '13–19 digit grouping passes Luhn checksum (checksum only, not a verified card).',
    });
  }
  return results;
}

function findAadhaarCandidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  // Matches 4-4-4 with consistent separator (' ' or '-') or unspaced 12 digits starting 2-9
  const regex = /(?:[1-9]\d{3}([\s-])\d{4}\1\d{4}|[2-9]\d{11})/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    const prev = text[start - 1];
    const prev2 = text[start - 2];
    const next = text[end];
    const next2 = text[end + 1];

    // Strict boundary check so 12-digit slices of 16-digit cards or longer numbers are never matched
    if (isDigitOrAlpha(prev) || isDigitOrAlpha(next)) continue;
    if ((prev === ' ' || prev === '-' || prev === '.') && /\d/.test(prev2 ?? '')) continue;
    if ((next === ' ' || next === '-' || next === '.') && /\d/.test(next2 ?? '')) continue;

    const digits = value.replace(/\D/g, '');
    if (/^(\d)\1+$/.test(digits)) continue;

    results.push({
      type: 'AADHAAR',
      value,
      normalizedValue: digits,
      start,
      end,
      label: 'Review recommended',
      reason: 'Matches 12-digit Aadhaar-like format (format recognition only, not identity proof).',
    });
  }
  return results;
}

function findPanCandidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  const regex = /[A-Z]{5}[0-9]{4}[A-Z]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    if (isDigitOrAlpha(text[start - 1]) || isDigitOrAlpha(text[end])) continue;

    results.push({
      type: 'PAN',
      value,
      normalizedValue: value,
      start,
      end,
      label: 'Pattern match',
      reason: 'Matches 10-character Indian PAN format (format recognition only).',
    });
  }
  return results;
}

function findIPv6Candidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  const regex = /(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?:\.\d{1,3}){0,3}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    const prev = text[start - 1];
    const next = text[end];

    if (prev === ':' || isDigitOrAlpha(prev)) continue;
    if (next === ':' || next === '.' || isDigitOrAlpha(next)) continue;

    const normalized = normalizeIPv6(value);
    if (!normalized) continue;

    results.push({
      type: 'IPV6',
      value,
      normalizedValue: normalized,
      start,
      end,
      label: 'Pattern match',
      reason: 'Valid IPv6 address structure (including compressed notation).',
    });
  }
  return results;
}

function findIPv4Candidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  const regex = /\d{1,3}(?:\.\d{1,3}){3}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    const prev = text[start - 1];
    const next = text[end];

    // Reject longer dotted sequences (1.2.3.4.5), version tags (v1.2.3.4), or embedded IPv6 tails
    if (prev === '.' || prev === ':' || isDigitOrAlpha(prev)) continue;
    if (next === '.' || next === ':' || isDigitOrAlpha(next)) continue;
    if (!isValidIPv4(value)) continue;

    results.push({
      type: 'IPV4',
      value,
      normalizedValue: value,
      start,
      end,
      label: 'Review recommended',
      reason: 'Four valid 0–255 octets matching IPv4 format; verify it is not a version number.',
    });
  }
  return results;
}

function findPhoneCandidates(text: string): RawCandidate[] {
  const results: RawCandidate[] = [];
  // 1. International prefix (+CC ...), 2. Indian 0-prefixed mobile, 3. Parenthesized area code, 4. 10-digit Indian mobile
  const regex =
    /(?:\+[1-9]\d{0,2}(?:[\s.-]?\(?\d{1,4}\)?){1,5}|0[6-9]\d{4}[\s-]?\d{5}|\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}|[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{9})/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0].trim();
    const start = match.index + (match[0].length - match[0].trimStart().length);
    const end = start + value.length;
    const prev = text[start - 1];
    const prev2 = text[start - 2];
    const next = text[end];
    const next2 = text[end + 1];

    // Prevent grabbing substrings inside cards, Aadhaar, IPs, dates, or order IDs
    if (isDigitOrAlpha(prev) || isDigitOrAlpha(next)) continue;
    if ((prev === '-' || prev === '.' || prev === ' ' || prev === ':') && /\d/.test(prev2 ?? '')) {
      continue;
    }
    if ((next === '-' || next === '.' || next === ' ' || next === ':') && /\d/.test(next2 ?? '')) {
      continue;
    }

    const digits = value.replace(/\D/g, '');
    if (value.startsWith('+')) {
      if (digits.length < 8 || digits.length > 15) continue;
    } else if (digits.length !== 10 && !(digits.length === 11 && digits.startsWith('0'))) {
      continue;
    }

    // Reject obvious repeating digits like 9999999999? Keep only if not all identical
    if (/^(\d)\1+$/.test(digits)) continue;

    results.push({
      type: 'PHONE',
      value,
      normalizedValue: normalizePhone(value),
      start,
      end,
      label: value.startsWith('+') || value.includes('-') || value.includes(' ')
        ? 'Pattern match'
        : 'Review recommended',
      reason: value.startsWith('+')
        ? 'Matches international telephone prefix and digit length.'
        : 'Matches 10-digit Indian phone format; review if this is an ordinary reference number.',
    });
  }
  return results;
}

function findCustomCandidates(text: string, customTerms: CustomTerm[]): RawCandidate[] {
  const results: RawCandidate[] = [];
  for (const item of customTerms) {
    const term = item.term.trim();
    if (!term) continue;

    const startsAlpha = /[A-Za-z0-9]/.test(term[0]);
    const endsAlpha = /[A-Za-z0-9]/.test(term[term.length - 1]);
    const pattern = `${startsAlpha ? '\\b' : ''}${escapeRegex(term)}${endsAlpha ? '\\b' : ''}`;
    const regex = new RegExp(pattern, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      const start = match.index;
      const end = start + value.length;

      results.push({
        type: 'CUSTOM',
        value,
        normalizedValue: term.toLowerCase(),
        start,
        end,
        label: 'Pattern match',
        reason: `Matches temporary custom term "${term}" (session-only).`,
      });
    }
  }
  return results;
}

/**
 * Deterministic overlap resolution:
 * Sort by earliest start, then longest span, then entity priority.
 * Never allows two kept detections to overlap.
 */
function resolveOverlaps(candidates: RawCandidate[]): RawCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return PRIORITY[b.type] - PRIORITY[a.type];
  });

  const resolved: RawCandidate[] = [];
  let lastEnd = -1;

  for (const cand of sorted) {
    if (cand.start >= lastEnd) {
      resolved.push(cand);
      lastEnd = cand.end;
    }
  }

  return resolved;
}

export function detectSensitiveData(
  text: string,
  customTerms: CustomTerm[] = [],
  existingExclusions: Map<string, boolean> = new Map(),
  cellContext?: { rowIndex: number; colIndex: number; columnHeader?: string }
): Detection[] {
  if (!text) return [];

  const raw: RawCandidate[] = [
    ...findCustomCandidates(text, customTerms),
    ...findEmailCandidates(text),
    ...findCardCandidates(text),
    ...findAadhaarCandidates(text),
    ...findPanCandidates(text),
    ...findIPv6Candidates(text),
    ...findIPv4Candidates(text),
    ...findPhoneCandidates(text),
  ];

  const resolved = resolveOverlaps(raw);

  return resolved.map((cand) => {
    const prefix = cellContext ? `r${cellContext.rowIndex}-c${cellContext.colIndex}-` : '';
    const id = `${prefix}${cand.type}:${cand.start}-${cand.end}`;
    const included = existingExclusions.has(id) ? existingExclusions.get(id)! : true;

    return {
      id,
      type: cand.type,
      value: cand.value,
      normalizedValue: cand.normalizedValue,
      start: cand.start,
      end: cand.end,
      label: cand.label,
      reason: cand.reason,
      included,
      rowIndex: cellContext?.rowIndex,
      colIndex: cellContext?.colIndex,
      columnHeader: cellContext?.columnHeader,
    };
  });
}

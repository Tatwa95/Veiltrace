import { Detection, EntityType, RedactionMode } from '../types/veiltrace';
import { ENTITY_META } from './detector';

export interface OutputSegment {
  text: string;
  isReplacement: boolean;
  detection?: Detection;
}

export class PseudonymRegistry {
  private maps = new Map<EntityType, Map<string, string>>();

  getOrCreate(type: EntityType, normalizedValue: string): string {
    let typeMap = this.maps.get(type);
    if (!typeMap) {
      typeMap = new Map<string, string>();
      this.maps.set(type, typeMap);
    }

    const existing = typeMap.get(normalizedValue);
    if (existing) {
      return existing;
    }

    const nextIndex = typeMap.size + 1;
    const prefix = ENTITY_META[type].pseudonymPrefix;
    const token = `${prefix}_${String(nextIndex).padStart(2, '0')}`;
    typeMap.set(normalizedValue, token);
    return token;
  }

  getSummary(): Array<{ type: EntityType; normalizedValue: string; token: string }> {
    const entries: Array<{ type: EntityType; normalizedValue: string; token: string }> = [];
    for (const [type, typeMap] of this.maps.entries()) {
      for (const [normalizedValue, token] of typeMap.entries()) {
        entries.push({ type, normalizedValue, token });
      }
    }
    return entries;
  }
}

export function maskPartial(detection: Detection): string {
  const { type, value } = detection;

  switch (type) {
    case 'CARD': {
      const digits = value.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      return `**** **** **** ${last4}`;
    }
    case 'AADHAAR': {
      const digits = value.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      return `XXXX XXXX ${last4}`;
    }
    case 'PHONE': {
      const digits = value.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      const maskedCount = Math.max(4, digits.length - 4);
      return `${'*'.repeat(maskedCount)}${last4}`;
    }
    case 'EMAIL': {
      const atIdx = value.indexOf('@');
      if (atIdx <= 0) return '[REDACTED: EMAIL]';
      const local = value.slice(0, atIdx);
      const domain = value.slice(atIdx + 1);
      const clue = local.length > 1 ? `${local[0]}***` : '***';
      return `${clue}@${domain}`;
    }
    case 'PAN': {
      return `********${value.slice(-2)}`;
    }
    case 'IPV4': {
      const octets = value.split('.');
      if (octets.length !== 4) return '[REDACTED: IPV4]';
      return `${octets[0]}.${octets[1]}.*.*`;
    }
    case 'IPV6': {
      const firstSegment = value.split(':')[0] || '*';
      return `${firstSegment}:****:****`;
    }
    case 'CUSTOM': {
      if (value.length <= 2) return '***';
      return `${value[0]}${'*'.repeat(Math.min(6, value.length - 1))}`;
    }
  }
}

export function formatReplacement(
  detection: Detection,
  mode: RedactionMode,
  registry: PseudonymRegistry
): string {
  if (mode === 'full') {
    return `[REDACTED: ${ENTITY_META[detection.type].shortLabel}]`;
  }
  if (mode === 'partial') {
    return maskPartial(detection);
  }
  return registry.getOrCreate(detection.type, detection.normalizedValue);
}

/**
 * Single-pass offset replacement on the original immutable string.
 * Returns both the exact plain text string and annotated segments for preview.
 */
export function buildRedactedSegments(
  originalText: string,
  detections: Detection[],
  mode: RedactionMode,
  registry: PseudonymRegistry
): { text: string; segments: OutputSegment[] } {
  if (!originalText) {
    return { text: '', segments: [] };
  }

  // Validate offsets at the final replacement boundary as well as in the
  // detector. This prevents malformed ranges from corrupting output or
  // silently leaving text unredacted if another caller supplies detections.
  const active = detections
    .filter(
      (d) =>
        d.included &&
        Number.isInteger(d.start) &&
        Number.isInteger(d.end) &&
        d.start >= 0 &&
        d.end > d.start &&
        d.end <= originalText.length
    )
    .sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));

  if (active.length === 0) {
    return {
      text: originalText,
      segments: [{ text: originalText, isReplacement: false }],
    };
  }

  const segments: OutputSegment[] = [];
  let cursor = 0;

  for (const det of active) {
    if (det.start < cursor || det.end > originalText.length) {
      continue;
    }
    if (det.start > cursor) {
      segments.push({
        text: originalText.slice(cursor, det.start),
        isReplacement: false,
      });
    }
    segments.push({
      text: formatReplacement(det, mode, registry),
      isReplacement: true,
      detection: det,
    });
    cursor = det.end;
  }

  if (cursor < originalText.length) {
    segments.push({
      text: originalText.slice(cursor),
      isReplacement: false,
    });
  }

  return {
    text: segments.map((s) => s.text).join(''),
    segments,
  };
}

export function applyRedactionsToText(
  originalText: string,
  detections: Detection[],
  mode: RedactionMode,
  registry: PseudonymRegistry
): string {
  return buildRedactedSegments(originalText, detections, mode, registry).text;
}

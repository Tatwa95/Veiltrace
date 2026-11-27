import { useMemo } from 'react';
import type {
  CustomTerm,
  Detection,
  EntityType,
  RedactionMode,
  ScanSnapshot,
} from '../types/veiltrace';
import { ALL_ENTITY_TYPES, detectSensitiveData } from '../lib/detector';
import { buildGuidanceStatements, buildScanSummarySentence } from '../lib/guidance';
import { buildRedactedSegments, PseudonymRegistry } from '../lib/redactor';
import type { OutputSegment } from '../lib/redactor';
import { detectCsvDocument, parseCsvContent, redactCsvDocument } from '../lib/csv';

interface UseSanitizationResultsOptions {
  snapshot: ScanSnapshot | null;
  customTerms: CustomTerm[];
  exclusions: Map<string, boolean>;
  mode: RedactionMode;
  typeFilter: 'ALL' | EntityType;
}

export function useSanitizationResults({
  snapshot,
  customTerms,
  exclusions,
  mode,
  typeFilter,
}: UseSanitizationResultsOptions) {
  const parsedCsv = useMemo(() => {
    if (!snapshot || snapshot.kind !== 'csv' || !snapshot.text) {
      return { doc: null, error: null };
    }

    try {
      return { doc: parseCsvContent(snapshot.text), error: null };
    } catch (error) {
      return {
        doc: null,
        error: error instanceof Error ? error.message : 'CSV structure could not be parsed.',
      };
    }
  }, [snapshot]);

  const detections = useMemo<Detection[]>(() => {
    if (!snapshot?.text) return [];
    if (snapshot.kind === 'csv' && parsedCsv.doc) {
      return detectCsvDocument(parsedCsv.doc, customTerms, exclusions);
    }
    return detectSensitiveData(snapshot.text, customTerms, exclusions);
  }, [snapshot, parsedCsv.doc, customTerms, exclusions]);

  const { sanitizedOutput, sanitizedSegments, sanitizedCsvRowSegments, pseudonymMappings } =
    useMemo(() => {
      const registry = new PseudonymRegistry();
      if (!snapshot?.text) {
        return {
          sanitizedOutput: '',
          sanitizedSegments: [] as OutputSegment[],
          sanitizedCsvRowSegments: [] as OutputSegment[][][],
          pseudonymMappings: [] as Array<{ type: EntityType; normalizedValue: string; token: string }>,
        };
      }

      if (snapshot.kind === 'csv' && parsedCsv.doc) {
        const { sanitizedRowSegments, serializedCsv } = redactCsvDocument(
          parsedCsv.doc,
          detections,
          mode,
          registry
        );
        return {
          sanitizedOutput: serializedCsv,
          sanitizedSegments: [] as OutputSegment[],
          sanitizedCsvRowSegments: sanitizedRowSegments,
          pseudonymMappings: registry.getSummary(),
        };
      }

      const result = buildRedactedSegments(snapshot.text, detections, mode, registry);
      return {
        sanitizedOutput: result.text,
        sanitizedSegments: result.segments,
        sanitizedCsvRowSegments: [] as OutputSegment[][][],
        pseudonymMappings: registry.getSummary(),
      };
    }, [snapshot, parsedCsv.doc, detections, mode]);

  const stats = useMemo(() => {
    const byType = new Map<EntityType, { total: number; included: number; excluded: number }>(
      ALL_ENTITY_TYPES.map((type) => [type, { total: 0, included: 0, excluded: 0 }])
    );
    let included = 0;
    let excluded = 0;

    for (const detection of detections) {
      const counts = byType.get(detection.type);
      if (!counts) continue;
      counts.total += 1;
      if (detection.included) {
        counts.included += 1;
        included += 1;
      } else {
        counts.excluded += 1;
        excluded += 1;
      }
    }

    return { total: detections.length, included, excluded, byType };
  }, [detections]);

  const summarySentence = useMemo(() => buildScanSummarySentence(detections), [detections]);
  const guidanceLines = useMemo(() => buildGuidanceStatements(detections, mode), [detections, mode]);
  const filteredDetections = useMemo(
    () => (typeFilter === 'ALL' ? detections : detections.filter((item) => item.type === typeFilter)),
    [detections, typeFilter]
  );
  const csvDetectionsByCell = useMemo(() => {
    const byCell = new Map<string, Detection[]>();
    for (const detection of detections) {
      const key = `${detection.rowIndex ?? 0}:${detection.colIndex ?? 0}`;
      const cellDetections = byCell.get(key) ?? [];
      cellDetections.push(detection);
      byCell.set(key, cellDetections);
    }
    return byCell;
  }, [detections]);

  return {
    parsedCsv,
    detections,
    sanitizedOutput,
    sanitizedSegments,
    sanitizedCsvRowSegments,
    pseudonymMappings,
    stats,
    summarySentence,
    guidanceLines,
    filteredDetections,
    csvDetectionsByCell,
  };
}

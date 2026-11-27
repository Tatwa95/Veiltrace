export interface PromptLogEntry {
  step: string;
  timestamp: string;
  promptSummary: string;
  outcome: string;
}

/**
 * Truthful development prompt log for the Prompt Log view.
 * Strictly contains development build history only — never user-provided data.
 */
export const DEVELOPMENT_PROMPT_LOG: PromptLogEntry[] = [
  {
    step: '1. Repository Setup',
    timestamp: '2026-11-27',
    promptSummary: 'Clone the public Veiltrace repository (https://github.com/Tatwa95/Veiltrace.git) into the workspace.',
    outcome: 'Cloned repository on branch main (initial commit c0e2d40 containing README.md).',
  },
  {
    step: '2. Product Specification & Core Build',
    timestamp: '2026-11-27',
    promptSummary:
      'Build VeilTrace — Private Data Sanitization & Provenance Workbench for Google PromptWars: client-side React + TypeScript + Vite SPA with deterministic PII/network detection, Luhn-checked cards, Full/Partial/Pseudonymized redaction, RFC 4180 CSV preservation, monochrome black-and-white accessible UI, prompt log, and Firebase Hosting deployment.',
    outcome:
      'Inspected repository and environment, installed Node.js LTS and Firebase CLI, configured Firebase Hosting security headers (CSP connect-src self), built the core local-only sanitization workbench, and verified manually in Antigravity browser preview.',
  },
  {
    step: '3. Scan-First Workflow, Guidance & Initial Deploy',
    timestamp: '2026-11-27',
    promptSummary:
      'Refine VeilTrace into a two-phase Scan and redact workflow (hiding empty result panels before scan, marking results out of date on input edits), add click-to-inspect match details, shade replacements in sanitized output, generate deterministic What changed guidance, refine editorial monochrome styling, and deploy to veiltrace-d05ac.web.app.',
    outcome:
      'Implemented scanSnapshot + stale detection, AnnotatedOutputSegments, src/lib/guidance.ts templates, editorial monochrome CSS tokens, and deployed to https://veiltrace-d05ac.web.app/.',
  },
  {
    step: '4. Custom-Term Prominence, Format Clarity & CSV Round-Trip',
    timestamp: '2026-11-27',
    promptSummary:
      'Promote temporary custom terms near the scan summary with memory-only explanation and confirmation, clarify .txt/.csv-only support across app and README, manually verify CSV download and re-upload round-trip, phone layout, and keyboard navigation, and redeploy to veiltrace-d05ac.web.app.',
    outcome:
      'Elevated Temporary Custom Terms panel below Scan Summary, added arrow-key mode navigation and Escape dialog handling, clarified .txt/.csv-only format messaging, verified CSV round-trip and accessibility in browser preview, and redeployed.',
  },
];

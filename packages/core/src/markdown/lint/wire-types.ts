import type { BrokenLinkSuppression } from '../../schemas/api/agent-write.ts';
import type { LinterConfig } from './plugin-meta.ts';
import type { ValidationDiagnostic } from './types.ts';
import type { ValidationSourceCounts } from './validation-counts.ts';

export type { ValidationSourceCounts };

export interface LintConfigResponse {
  effective: LinterConfig;
  configFile?: string | null;
  configProblems?: string[];
}

export interface WireLocalTargetEvidence extends Record<string, unknown> {
  href: string;
  targetKind: string;
  role: string;
  sourceForm: string;
  resolvedTarget: string | null;
  reason: string;
  resolutionMethod: string;
  fallbackTarget?: string | null;
  definition?: Record<string, unknown> & { line: number; label: string };
}

export interface WireValidationDiagnostic
  extends Omit<ValidationDiagnostic, 'source' | 'localTarget'> {
  source: string;
  localTarget?: WireLocalTargetEvidence;
}

export interface ValidationDocResult {
  file: string;
  diagnostics: WireValidationDiagnostic[];
}

export interface ValidationAuditResponse {
  files: ValidationDocResult[];
  fileCount: number;
  errorCount: number;
  warningCount: number;
  warnings: string[];
  ran?: string[];
  brokenLinkSuppression?: BrokenLinkSuppression;
}

export interface ValidationDocCounts {
  file: string;
  lint: ValidationSourceCounts;
  links: ValidationSourceCounts;
}

export interface ValidationAuditCountsResponse {
  files: ValidationDocCounts[];
  fileCount: number;
  errorCount: number;
  warningCount: number;
  warnings: string[];
  brokenLinkSuppression?: BrokenLinkSuppression;
}

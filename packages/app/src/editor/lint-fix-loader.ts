import type { SweepFixOutcome } from '@/components/problems-sweep';

export function sweepFixLintDoc(docName: string): Promise<SweepFixOutcome> {
  return import('./lint-config-client.ts').then(({ fixLintDoc }) => fixLintDoc(docName));
}

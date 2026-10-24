import type * as peleLazy from 'pele/lazy';
import type { DiagramType } from 'pele/lazy';
import { createRetryingLoader } from '@/lib/retrying-loader.ts';

type PeleLazyApi = typeof peleLazy;

export const loadPeleLazy: () => Promise<PeleLazyApi> = createRetryingLoader(
  () => import('pele/lazy'),
);

const loadedTypes = new Set<DiagramType>();

export async function ensurePeleDiagram(type: DiagramType | null): Promise<boolean> {
  if (type === null) return false;
  if (loadedTypes.has(type)) return true;
  const pele = await loadPeleLazy();
  const ok = await pele.load(type);
  if (ok) loadedTypes.add(type);
  return ok;
}

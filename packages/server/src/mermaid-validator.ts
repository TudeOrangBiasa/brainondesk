/// <reference lib="es2024" />
import { detectFmRegion, type RenderWarning } from '@inkeep/open-knowledge-core';
import type { DiagramType, PeleError } from 'pele/lazy';
import { getLogger } from './logger.ts';

const log = getLogger('mermaid-validator');

const MAX_FENCE_BYTES = 100_000;
const MAX_FENCE_LINES = 2_000;
const MAX_FENCES_PARSED = 20;
const TOTAL_PARSE_BUDGET_MS = 2_000;
const MAX_WARNINGS = 10;
const MAX_MESSAGE_CHARS = 500;
const MAX_FIRST_LINE_CHARS = 200;

interface MermaidFence {
  firstLine: string;
  body: string;
}

type MermaidParseApi = {
  parse(text: string): unknown;
};

type PeleParseApi = {
  PeleError: typeof PeleError;
  detectType(text: string): DiagramType | null;
  load(type: DiagramType | null): Promise<boolean>;
  parse(text: string): unknown;
};

type MermaidImporter = () => Promise<MermaidParseApi | null>;

let initPromise: Promise<PeleParseApi | MermaidParseApi | null> | null = null;
let importerOverride: MermaidImporter | null = null;

export function setMermaidImporterForTests(importer: MermaidImporter | null): void {
  importerOverride = importer;
  initPromise = null;
}

export function extractMermaidFences(body: string): MermaidFence[] {
  const fences: MermaidFence[] = [];
  const lines = body.split('\n');
  const fenceLine = (line: string) => (line.endsWith('\r') ? line.slice(0, -1) : line);
  let i = 0;
  while (i < lines.length) {
    const line = fenceLine(lines[i] ?? '');
    const open = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/);
    if (!open) {
      i++;
      continue;
    }
    const marker = open[1] ?? '';
    const fenceChar = marker[0] ?? '`';
    if (fenceChar === '`' && line.slice(line.indexOf(marker) + marker.length).includes('`')) {
      i++;
      continue;
    }
    const lang = open[2] ?? '';
    const closeRe = new RegExp(`^ {0,3}\\${fenceChar}{${marker.length},}[ \t]*$`);
    const bodyLines: string[] = [];
    let j = i + 1;
    while (j < lines.length && !closeRe.test(fenceLine(lines[j] ?? ''))) {
      bodyLines.push(lines[j] ?? '');
      j++;
    }
    if (lang === 'mermaid') {
      const body = bodyLines.join('\n');
      const firstLine = (bodyLines.find((l) => l.trim().length > 0)?.trim() ?? '').slice(
        0,
        MAX_FIRST_LINE_CHARS,
      );
      fences.push({ firstLine, body });
    }
    i = j + 1;
  }
  return fences;
}

async function initMermaid(): Promise<PeleParseApi | MermaidParseApi | null> {
  if (importerOverride) return importerOverride();
  return import('pele/lazy');
}

function getMermaid(docName: string): Promise<PeleParseApi | MermaidParseApi | null> {
  initPromise ??= initMermaid().catch((err) => {
    log.warn(
      { err, 'doc.name': docName },
      'mermaid validator unavailable — render validation disabled for this process',
    );
    return null;
  });
  return initPromise;
}

function isPeleApi(api: PeleParseApi | MermaidParseApi): api is PeleParseApi {
  return 'detectType' in api && 'load' in api;
}

async function parseFence(api: PeleParseApi | MermaidParseApi, body: string): Promise<unknown> {
  if (!isPeleApi(api)) return api.parse(body);
  await api.load(api.detectType(body));
  return api.parse(body);
}

function extractLineNumber(
  api: PeleParseApi | MermaidParseApi,
  err: unknown,
  message: string,
): number | undefined {
  if (isPeleApi(api) && err instanceof api.PeleError) {
    return Number.isSafeInteger(err.line) && err.line > 0 ? err.line : undefined;
  }
  const match = message.match(/Parse error on line (\d+)/);
  if (!match?.[1]) return undefined;
  const line = Number(match[1]);
  return Number.isSafeInteger(line) && line > 0 ? line : undefined;
}

export async function validateMermaidFences(
  ytextSnapshot: string,
  docName: string,
): Promise<RenderWarning[] | undefined> {
  try {
    if (!ytextSnapshot.includes('mermaid')) return undefined;
    const { body } = detectFmRegion(ytextSnapshot);
    const fences = extractMermaidFences(body);
    if (fences.length === 0) return undefined;

    const initStartedAt = performance.now();
    const mermaid = await getMermaid(docName);
    if (mermaid === null) return undefined;
    const parseStartedAt = performance.now();

    const warnings: RenderWarning[] = [];
    let parsed = 0;
    for (let i = 0; i < fences.length && warnings.length < MAX_WARNINGS; i++) {
      if (parsed >= MAX_FENCES_PARSED) break;
      if (performance.now() - parseStartedAt > TOTAL_PARSE_BUDGET_MS) {
        log.debug(
          { 'doc.name': docName, skippedFrom: i + 1, fences: fences.length },
          'mermaid validation budget exceeded — remaining fences skipped',
        );
        break;
      }
      const fence = fences[i];
      if (fence === undefined) continue;
      if (fence.body.length > MAX_FENCE_BYTES || fence.body.split('\n').length > MAX_FENCE_LINES) {
        log.debug(
          { 'doc.name': docName, fenceIndex: i + 1 },
          'mermaid fence over validation caps — skipped',
        );
        continue;
      }
      try {
        parsed++;
        await parseFence(mermaid, fence.body);
      } catch (err) {
        if (err instanceof TypeError) {
          log.debug(
            { err, 'doc.name': docName, fenceIndex: i + 1 },
            'mermaid validation skipped fence — environment failure',
          );
          continue;
        }
        const rawMessage = err instanceof Error ? err.message : String(err);
        const message = rawMessage.slice(0, MAX_MESSAGE_CHARS);
        const line = extractLineNumber(mermaid, err, rawMessage);
        warnings.push({
          kind: 'mermaid-parse-error',
          fenceIndex: i + 1,
          fenceFirstLine: fence.firstLine,
          message,
          ...(line !== undefined ? { line } : {}),
        });
      }
    }
    const durationMs = Math.round(performance.now() - initStartedAt);
    if (warnings.length === 0) {
      if (durationMs > 250) {
        log.debug(
          { 'doc.name': docName, durationMs, fences: fences.length },
          'mermaid validation slow (no warnings)',
        );
      }
      return undefined;
    }
    log.debug(
      { 'doc.name': docName, count: warnings.length, durationMs },
      'mermaid render warnings emitted',
    );
    return warnings;
  } catch (err) {
    log.warn({ err, 'doc.name': docName }, 'mermaid validation errored unexpectedly — skipped');
    return undefined;
  }
}

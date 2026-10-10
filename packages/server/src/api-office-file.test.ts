import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createApiExtension } from './api-extension.test-helper.ts';
import { closeTestHttpServer } from './http-server.test-helper.ts';
import { listenOnLoopback } from './loopback-rig-test-helpers.ts';

interface Harness {
  baseURL: string;
  close: () => Promise<void>;
}

async function startHarness(contentDir: string, projectDir?: string): Promise<Harness> {
  const ext = createApiExtension({
    hocuspocus: undefined,
    sessionManager: undefined,
    contentDir,
    projectDir,
    serverInstanceId: 'test-server',
    getFileIndex: () => new Map(),
  });

  const server: Server = createServer((req, res) => {
    void ext.onRequest({ request: req as IncomingMessage, response: res as ServerResponse });
  });

  const { baseUrl } = await listenOnLoopback(server);

  return {
    baseURL: baseUrl,
    close: () => closeTestHttpServer(server),
  };
}

function officeUrl(baseURL: string, path: string | null): string {
  return path === null
    ? `${baseURL}/api/office/file`
    : `${baseURL}/api/office/file?path=${encodeURIComponent(path)}`;
}

describe('office file api', () => {
  let tmpDir: string;
  let contentDir: string;
  let harness: Harness;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ok-api-office-'));
    contentDir = join(tmpDir, 'content');
    mkdirSync(join(contentDir, 'docs'), { recursive: true });
    writeFileSync(join(contentDir, 'docs', 'report.docx'), Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    writeFileSync(join(contentDir, 'docs', 'notes.txt'), 'not office');
    harness = await startHarness(contentDir, tmpDir);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads office bytes with etag', async () => {
    const res = await fetch(officeUrl(harness.baseURL, 'content/docs/report.docx'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers.get('etag')).toMatch(/^W\/".+"$/);
    expect(res.headers.get('x-office-doc-type')).toBe('docs');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });

  test('saves office bytes atomically and round-trips', async () => {
    const put = await fetch(officeUrl(harness.baseURL, 'content/docs/deck.pptx'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from([0x50, 0x4b, 0x07, 0x08]),
    });

    expect(put.status).toBe(201);
    const putEtag = put.headers.get('etag');
    expect(putEtag).toMatch(/^W\/".+"$/);

    const get = await fetch(officeUrl(harness.baseURL, 'content/docs/deck.pptx'));
    expect(get.status).toBe(200);
    expect(get.headers.get('etag')).toBe(putEtag);
    expect(Buffer.from(await get.arrayBuffer()).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))).toBe(
      true,
    );
  });

  test('returns 409 on etag mismatch with current etag', async () => {
    const first = await fetch(officeUrl(harness.baseURL, 'content/docs/report.docx'));
    const etag = first.headers.get('etag');
    expect(etag).not.toBeNull();
    await first.arrayBuffer();

    const external = await fetch(officeUrl(harness.baseURL, 'content/docs/report.docx'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from([0x50, 0x4b, 0x09, 0x09]),
    });
    expect(external.status).toBe(200);
    const currentEtag = external.headers.get('etag');
    expect(currentEtag).not.toBe(etag);

    const stale = await fetch(officeUrl(harness.baseURL, 'content/docs/report.docx'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'If-Match': etag as string },
      body: Buffer.from([0x50, 0x4b, 0x0a, 0x0a]),
    });
    expect(stale.status).toBe(409);
    expect(stale.headers.get('etag')).toBe(currentEtag);
  });

  test('rejects traversal, missing path, and unsupported types', async () => {
    expect((await fetch(officeUrl(harness.baseURL, '../outside.docx'))).status).toBe(400);
    expect((await fetch(officeUrl(harness.baseURL, null))).status).toBe(400);
    expect((await fetch(officeUrl(harness.baseURL, 'content/docs/notes.txt'))).status).toBe(415);
    expect((await fetch(officeUrl(harness.baseURL, 'content/docs/missing.xlsx'))).status).toBe(404);
  });

  test('leaves no temp siblings after save', async () => {
    const { readdirSync } = await import('node:fs');
    const put = await fetch(officeUrl(harness.baseURL, 'content/docs/report.docx'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from([0x50, 0x4b, 0x0b, 0x0b]),
    });
    expect(put.status).toBe(200);
    const entries = readdirSync(join(contentDir, 'docs'));
    expect(entries.some((entry) => entry.includes('.tmp.'))).toBe(false);
  });
});

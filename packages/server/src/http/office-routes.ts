import type { IncomingMessage, ServerResponse } from 'node:http';
import { EmptyRequestSchema } from '@inkeep/open-knowledge-core';
import type { PinoLogger } from '../logger.ts';
import type { OfficeFileService } from '../services/office-files.ts';
import { type ApiRouteGroup, createApiRouteGroup } from './api-pipeline.ts';
import { errorResponse } from './error-response.ts';
import { errnoCode } from './handler-utils.ts';
import { withValidation } from './request-validation.ts';
export interface OfficeRouteDeps {
  officeFileService: OfficeFileService;
  log: PinoLogger;
  maxBytes?: number | undefined;
}

const OFFICE_GET_ERRORS = {
  'missing-path': [400, 'urn:ok:error:invalid-request', 'Missing office file path.'],
  'unsupported-type': [415, 'urn:ok:error:unsupported-asset-type', 'Unsupported office file type.'],
  'not-found': [404, 'urn:ok:error:asset-not-found', 'Office file not found.'],
  'invalid-path': [400, 'urn:ok:error:path-escape', 'Path escapes content directory.'],
} as const;

const OFFICE_PUT_ERRORS = {
  'missing-path': [400, 'urn:ok:error:invalid-request', 'Missing office file path.'],
  'unsupported-type': [415, 'urn:ok:error:unsupported-asset-type', 'Unsupported office file type.'],
  'not-found': [404, 'urn:ok:error:asset-not-found', 'Office file not found.'],
  'invalid-path': [400, 'urn:ok:error:path-escape', 'Path escapes content directory.'],
  'payload-too-large': [413, 'urn:ok:error:payload-too-large', 'Office file exceeds size cap.'],
  'write-failed': [500, 'urn:ok:error:internal-server-error', 'Office file write failed.'],
} as const;

const PUT_MAX_BYTES = 100 * 1_048_576;

function readRawBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>();
  const chunks: Buffer[] = [];
  let total = 0;
  req.on('data', (chunk: Buffer) => {
    total += chunk.length;
    if (total > maxBytes) {
      reject(new Error('payload-too-large'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
  return promise;
}
export function createOfficeRoutes(deps: OfficeRouteDeps): ApiRouteGroup {
  const { officeFileService, log } = deps;
  const maxBytes = deps.maxBytes ?? PUT_MAX_BYTES;

  const handleOfficeGet = withValidation(
    EmptyRequestSchema,
    async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const filePath = url.searchParams.get('path');
        const resolution = await officeFileService.resolveOfficeFile(filePath);
        if (!resolution.ok) {
          const [status, type, title] = OFFICE_GET_ERRORS[resolution.reason];
          errorResponse(res, status, type, title, {
            handler: 'office-file',
            ...(resolution.cause !== undefined ? { cause: resolution.cause } : {}),
          });
          return;
        }
        const ifNoneMatch = req.headers['if-none-match'];
        if (typeof ifNoneMatch === 'string' && ifNoneMatch === resolution.etag) {
          res.writeHead(304, { ETag: resolution.etag });
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': resolution.contentType,
          'Content-Length': String(resolution.size),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
          ETag: resolution.etag,
          'X-Office-Doc-Type': resolution.docType,
          'X-Office-Path': resolution.relativePath,
        });
        try {
          res.end(resolution.bytes);
        } catch (streamError) {
          const code = errnoCode(streamError);
          if (!res.destroyed) {
            res.destroy(streamError instanceof Error ? streamError : undefined);
          }
          log.error(
            {
              event: 'api.office-file.pipeline-failed',
              handler: 'office-file',
              code,
              err: streamError,
            },
            '[office-file] pipeline failed mid-stream',
          );
        }
      } catch (e) {
        errorResponse(res, 500, 'urn:ok:error:internal-server-error', 'Internal server error.', {
          handler: 'office-file',
          cause: e,
        });
      }
    },
    { handler: 'office-file', method: 'GET', skipBodyParse: true },
  );

  const handleOfficePut = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'PUT') {
      errorResponse(res, 405, 'urn:ok:error:method-not-allowed', 'Method not allowed.', {
        handler: 'office-file-put',
        extraHeaders: { Allow: 'PUT' },
      });
      return;
    }
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const filePath = url.searchParams.get('path');
      const ifMatchRaw = req.headers['if-match'];
      const ifMatch = typeof ifMatchRaw === 'string' ? ifMatchRaw : null;
      let bytes: Buffer;
      try {
        bytes = await readRawBody(req, maxBytes);
      } catch (bodyError) {
        if (bodyError instanceof Error && bodyError.message === 'payload-too-large') {
          errorResponse(
            res,
            413,
            'urn:ok:error:payload-too-large',
            'Office file exceeds size cap.',
            { handler: 'office-file-put' },
          );
          return;
        }
        throw bodyError;
      }
      const outcome = await officeFileService.writeOfficeFile(filePath, bytes, ifMatch);
      if (!outcome.ok) {
        if (outcome.reason === 'conflict') {
          errorResponse(
            res,
            409,
            'urn:ok:error:stale-external-write',
            'Office file changed on disk since load.',
            {
              handler: 'office-file-put',
              detail:
                outcome.currentEtag !== undefined
                  ? `Current etag is ${outcome.currentEtag}. Reload and retry.`
                  : 'Reload and retry.',
              extensions: { currentEtag: outcome.currentEtag },
              extraHeaders:
                outcome.currentEtag !== undefined ? { ETag: outcome.currentEtag } : undefined,
            },
          );
          return;
        }
        const [status, type, title] = OFFICE_PUT_ERRORS[outcome.reason];
        errorResponse(res, status, type, title, {
          handler: 'office-file-put',
          ...(outcome.cause !== undefined ? { cause: outcome.cause } : {}),
        });
        return;
      }
      res.writeHead(outcome.created ? 201 : 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ETag: outcome.etag,
      });
      res.end(
        JSON.stringify({
          path: outcome.relativePath,
          etag: outcome.etag,
          size: outcome.size,
          mtimeMs: outcome.mtimeMs,
          created: outcome.created,
        }),
      );
      return;
    } catch (e) {
      errorResponse(res, 500, 'urn:ok:error:internal-server-error', 'Internal server error.', {
        handler: 'office-file-put',
        cause: e,
      });
      return;
    }
  };

  return createApiRouteGroup(
    {
      '/api/office/file': (async (req, res) => {
        if (req.method === 'PUT') {
          await handleOfficePut(req, res);
          return;
        }
        await handleOfficeGet(req, res);
      }) as (req: IncomingMessage, res: ServerResponse) => Promise<void>,
    },
    { mutating: ['/api/office/file'] },
  );
}

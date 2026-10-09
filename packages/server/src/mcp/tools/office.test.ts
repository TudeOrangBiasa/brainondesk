import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { z } from 'zod';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { registerOfficeTools } from './office.ts';
import {
  InMemoryOfficeRelayTransport,
  type OfficeToolCallResult,
  officeTabNotOpenError,
} from './office-relay.ts';
import type { ServerInstance } from './shared.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: true;
}

type Handler = (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResult>;

function createCaptureServer() {
  const tools: Array<{
    name: string;
    description: string;
    schema: Record<string, z.ZodType>;
    handler: Handler;
  }> = [];
  const server = {
    registerTool(
      name: string,
      config: { description?: string; inputSchema?: Record<string, z.ZodType> },
      handler: Handler,
    ) {
      tools.push({
        name,
        description: config.description ?? '',
        schema: config.inputSchema ?? {},
        handler,
      });
    },
  } as unknown as ServerInstance;
  return {
    server,
    getTool(name: string) {
      const tool = tools.find((entry) => entry.name === name);
      if (!tool) throw new Error(`Tool ${name} not registered`);
      return tool;
    },
    names() {
      return tools.map((entry) => entry.name);
    },
  };
}

let tmpDir = '';

beforeEach(async () => {
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-office-relay-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function echoHandler(output: unknown, isError = false) {
  return {
    tabId: 'tab-1',
    path: 'decks/q3.pptx',
    handleToolCall: async (): Promise<OfficeToolCallResult> => ({ output, isError }),
  };
}

describe('office relay tools — registration', () => {
  test('registers office_echo and office_list_open', () => {
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay: new InMemoryOfficeRelayTransport(),
    });
    expect(cap.names().sort()).toEqual(['office_echo', 'office_list_open']);
  });
});

describe('office relay round-trip', () => {
  test('office_echo returns the tab answer through the ACP-shaped path', async () => {
    const relay = new InMemoryOfficeRelayTransport();
    relay.registerHandler(echoHandler({ echoed: { ping: 1 } }));
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay,
    });
    const result = await cap
      .getTool('office_echo')
      .handler({ path: 'decks/q3.pptx', input: { ping: 1 } });
    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      path: string;
      tool: string;
      output: unknown;
      text: string;
    };
    expect(structured.path).toBe('decks/q3.pptx');
    expect(structured.tool).toBe('office_echo');
    expect(structured.output).toEqual({ echoed: { ping: 1 } });
    expect(typeof structured.text).toBe('string');
  });

  test('office_list_open reports the registered tab', async () => {
    const relay = new InMemoryOfficeRelayTransport();
    relay.registerHandler(echoHandler(null));
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay,
    });
    const result = await cap.getTool('office_list_open').handler({});
    const structured = result.structuredContent as { open: string[]; text: string };
    expect(structured.open).toEqual(['decks/q3.pptx']);
  });

  test('unopened file returns a clear MVP error naming the path', async () => {
    const relay = new InMemoryOfficeRelayTransport();
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay,
    });
    const result = await cap
      .getTool('office_echo')
      .handler({ path: 'decks/missing.pptx', input: {} });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('decks/missing.pptx');
    expect(result.content[0]?.text).toContain('not open');
    expect(officeTabNotOpenError('decks/missing.pptx').reason).toBe('tab-not-open');
  });

  test('a silent tab times out with a clear error', async () => {
    const relay = new InMemoryOfficeRelayTransport();
    relay.registerHandler({
      tabId: 'tab-silent',
      path: 'decks/slow.pptx',
      handleToolCall: async () => new Promise<OfficeToolCallResult>(() => {}),
    });
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay,
      timeoutMs: 5,
    });
    const result = await cap.getTool('office_echo').handler({ path: 'decks/slow.pptx' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('timed out');
  });

  test('a cancelled call reports cancellation', async () => {
    const relay = new InMemoryOfficeRelayTransport();
    relay.registerHandler({
      tabId: 'tab-never',
      path: 'decks/hung.pptx',
      handleToolCall: async () => new Promise<OfficeToolCallResult>(() => {}),
    });
    const controller = new AbortController();
    controller.abort();
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay,
    });
    const result = await cap
      .getTool('office_echo')
      .handler({ path: 'decks/hung.pptx' }, { signal: controller.signal });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('cancelled');
  });

  test('path escaping the project root is refused', async () => {
    const relay = new InMemoryOfficeRelayTransport();
    relay.registerHandler(echoHandler(null));
    const cap = createCaptureServer();
    registerOfficeTools(cap.server, {
      config: BASE_CONFIG,
      resolveCwd: async () => tmpDir,
      relay,
    });
    const result = await cap.getTool('office_echo').handler({ path: '../outside.pptx' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('escapes');
  });
});

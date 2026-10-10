import { z } from 'zod';
import type { AgentIdentity } from '../agent-identity.ts';
import {
  getOfficeRelayTransport,
  OFFICE_RELAY_DEFAULT_TIMEOUT_MS,
  OfficeRelayError,
  type OfficeRelayTransport,
} from './office-relay.ts';
import { resolveWithinRoot } from './path-safety.ts';
import type { ConfigOrResolver, ServerInstance } from './shared.ts';
import {
  outputSchemaWithText,
  ROUTED_CWD_DESCRIPTION,
  textPlusStructured,
  textResult,
} from './shared.ts';

export interface OfficeToolDeps {
  resolveCwd: (explicit?: string) => Promise<string>;
  config: ConfigOrResolver;
  identityRef?: { current: AgentIdentity };
  relay?: OfficeRelayTransport | undefined;
  timeoutMs?: number | undefined;
}

export const OFFICE_ECHO_DESCRIPTION = [
  'Relay a call to the live office tab editing a file: office_echo sends input to the tab and returns its answer. File must be open in the app; otherwise the call fails with a clear error naming the path. Pass at most office_echo input plus path and cwd.',
  'Per-type office tools land in later phases; this scaffold proves the relay path only.',
].join('\n');

export const OFFICE_LIST_OPEN_DESCRIPTION = [
  'List office files currently open in live app tabs and reachable through the office relay. No running OK server needed. cwd selects project.',
].join('\n');

const OfficePathInput = z
  .string()
  .min(1)
  .describe('Office file path, relative to the content root (e.g. "decks/q3-review.pptx").');

const OfficeEchoInputSchema = {
  path: OfficePathInput,
  input: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Payload delivered to the tab handler. Omit for an empty payload.'),
  timeoutMs: z
    .number()
    .int()
    .min(1)
    .max(120_000)
    .optional()
    .describe('Relay wait budget in milliseconds. Defaults to 30000, max 120000.'),
  cwd: z.string().optional().describe(ROUTED_CWD_DESCRIPTION),
} as const;

const OfficeEchoOutputSchema = outputSchemaWithText({
  path: z.string().describe('Echo of the target office file path.'),
  tool: z.string().describe('Echo of the relayed tool name.'),
  output: z.unknown().describe('Answer returned by the live tab handler.'),
});

const OfficeListOpenOutputSchema = outputSchemaWithText({
  open: z.array(z.string()).describe('Office file paths with a live tab handler registered.'),
});

interface OfficeEchoArgs {
  path: string;
  input?: Record<string, unknown>;
  timeoutMs?: number;
  cwd?: string;
}

interface OfficeListOpenArgs {
  cwd?: string;
}

interface ToolExtraWithSignal {
  signal?: AbortSignal;
}

function isToolExtraWithSignal(value: unknown): value is ToolExtraWithSignal {
  return (
    value !== null && typeof value === 'object' && 'signal' in (value as Record<string, unknown>)
  );
}

export function relayErrorText(path: string, tool: string, err: unknown): string {
  if (err instanceof OfficeRelayError) return `Error: ${err.message}`;
  if (err instanceof Error && err.name === 'TimeoutError') {
    return `Error: Office tool call "${tool}" for "${path}" timed out. The tab did not answer; retry or reload the tab.`;
  }
  return `Error: Office tool call "${tool}" for "${path}" failed: ${err instanceof Error ? err.message : String(err)}`;
}

export function registerOfficeTools(server: ServerInstance, deps: OfficeToolDeps): void {
  const relay = deps.relay ?? getOfficeRelayTransport();
  const defaultTimeout = deps.timeoutMs ?? OFFICE_RELAY_DEFAULT_TIMEOUT_MS;

  server.registerTool(
    'office_echo',
    {
      description: OFFICE_ECHO_DESCRIPTION,
      inputSchema: OfficeEchoInputSchema,
      outputSchema: OfficeEchoOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args: OfficeEchoArgs, extra?: unknown) => {
      let cwd: string;
      try {
        cwd = await deps.resolveCwd(args.cwd);
      } catch (err) {
        return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`, true);
      }
      const contained = resolveWithinRoot(cwd, args.path);
      if (!contained.ok) return textResult(`Error: ${contained.reason}`, true);
      const signal = isToolExtraWithSignal(extra) ? extra.signal : undefined;
      try {
        const result = await relay.callTab(contained.rel, 'office_echo', args.input ?? {}, {
          ...(signal !== undefined ? { signal } : {}),
          timeoutMs: args.timeoutMs ?? defaultTimeout,
        });
        return textPlusStructured(JSON.stringify(result.output ?? null), {
          path: contained.rel,
          tool: 'office_echo',
          output: result.output ?? null,
        });
      } catch (err) {
        return textResult(relayErrorText(contained.rel, 'office_echo', err), true);
      }
    },
  );

  server.registerTool(
    'office_list_open',
    {
      description: OFFICE_LIST_OPEN_DESCRIPTION,
      inputSchema: {
        cwd: z.string().optional().describe(ROUTED_CWD_DESCRIPTION),
      },
      outputSchema: OfficeListOpenOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args: OfficeListOpenArgs) => {
      try {
        await deps.resolveCwd(args.cwd);
      } catch (err) {
        return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`, true);
      }
      const open = relay.listOpen();
      return textPlusStructured(JSON.stringify(open), { open });
    },
  );
}

export { OFFICE_RELAY_DEFAULT_TIMEOUT_MS };

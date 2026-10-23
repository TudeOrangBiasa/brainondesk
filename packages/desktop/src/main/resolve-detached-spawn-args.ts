import type { SpawnOptions } from 'node:child_process';
import { totalmem } from 'node:os';
import { posix as pathPosix, win32 as pathWin32 } from 'node:path';
import { resolveHelperBundleBinary } from '@inkeep/open-knowledge-core/helper-bundle';
import { fallbackPaths } from '@inkeep/open-knowledge-server';
export const SERVER_MAX_OLD_SPACE_ENV_VAR = 'OK_SERVER_MAX_OLD_SPACE_MB';
export const SERVER_MAX_OLD_SPACE_CAP_MB = 4096;
export const SERVER_MAX_OLD_SPACE_MIN_MB = 512;
export function resolveServerMaxOldSpaceMb(
  env: Readonly<Record<string, string | undefined>>,
  totalMemBytes: number = totalmem(),
): number {
  const raw = env[SERVER_MAX_OLD_SPACE_ENV_VAR];
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isSafeInteger(parsed) && parsed >= SERVER_MAX_OLD_SPACE_MIN_MB) return parsed;
  }
  const quarterRamMb = Math.floor(totalMemBytes / 4 / 1024 / 1024);
  return Math.max(SERVER_MAX_OLD_SPACE_MIN_MB, Math.min(SERVER_MAX_OLD_SPACE_CAP_MB, quarterRamMb));
}
export function serverHeapExecArg(
  env: Readonly<Record<string, string | undefined>>,
  totalMemBytes: number = totalmem(),
): string {
  return `--max-old-space-size=${resolveServerMaxOldSpaceMb(env, totalMemBytes)}`;
}
export interface ResolveDetachedSpawnArgsInput {
  readonly platform: NodeJS.Platform;
  readonly isPackaged: boolean;
  readonly parentExecPath: string;
  readonly bundleCliMjsPath: string;
  readonly reactShellDistDir: string;
  readonly contentDir: string;
  readonly spawnErrorLogFd: number;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly singleFile?: string;
  readonly projectDir?: string;
  readonly terminalAuthAvailable?: boolean;
  readonly totalMemBytes?: number;
}

export const TERMINAL_AUTH_ARG = '--terminal-auth';

export interface ResolvedDetachedSpawnArgs {
  readonly file: string;
  readonly args: readonly string[];
  readonly opts: SpawnOptions;
}

function platformPathDelimiter(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':';
}

function gitEnrichmentDirs(platform: NodeJS.Platform): readonly string[] {
  const dn = platform === 'win32' ? pathWin32.dirname : pathPosix.dirname;
  return fallbackPaths(platform).map((p) => dn(p));
}

function isPathKey(key: string): boolean {
  return /^path$/i.test(key);
}

function readEnvPath(env: Readonly<Record<string, string | undefined>>): string | undefined {
  for (const key of Object.keys(env)) {
    if (isPathKey(key)) return env[key];
  }
  return undefined;
}

function buildEnrichedPath(platform: NodeJS.Platform, currentPath: string | undefined): string {
  const delimiter = platformPathDelimiter(platform);
  const dirs = gitEnrichmentDirs(platform);
  const currentSegments = (currentPath ?? '').split(delimiter).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const seg of dirs) {
    if (!seen.has(seg)) {
      seen.add(seg);
      result.push(seg);
    }
  }
  for (const seg of currentSegments) {
    if (!seen.has(seg)) {
      seen.add(seg);
      result.push(seg);
    }
  }
  return result.join(delimiter);
}

export function resolveDetachedSpawnArgs(
  input: ResolveDetachedSpawnArgsInput,
): ResolvedDetachedSpawnArgs {
  const {
    platform,
    isPackaged,
    parentExecPath,
    bundleCliMjsPath,
    reactShellDistDir,
    contentDir,
    spawnErrorLogFd,
    env,
    singleFile,
    projectDir,
    terminalAuthAvailable,
  } = input;

  const file =
    platform === 'darwin' && isPackaged
      ? resolveHelperBundleBinary(parentExecPath)
      : parentExecPath;

  const projectRoot = projectDir ?? contentDir;
  const totalMemBytes = input.totalMemBytes ?? totalmem();
  const args = [
    serverHeapExecArg(env, totalMemBytes),
    bundleCliMjsPath,
    'start',
    '--react-shell-dist-dir',
    reactShellDistDir,
    ...(singleFile !== undefined
      ? ['--single-file', singleFile, '--project-dir', projectRoot]
      : []),
    ...(terminalAuthAvailable === true ? [TERMINAL_AUTH_ARG] : []),
  ];

  const inheritedPath = readEnvPath(env);
  const envWithoutPath: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!isPathKey(key)) envWithoutPath[key] = value;
  }

  const opts: SpawnOptions = {
    env: {
      ...envWithoutPath,
      PATH: buildEnrichedPath(platform, inheritedPath),
      ELECTRON_RUN_AS_NODE: '1',
      OK_LOCK_KIND: 'interactive',
    },
    detached: true,
    stdio: ['ignore', 'ignore', spawnErrorLogFd],
    cwd: projectRoot,
    /*
     * UPSTREAM(nodejs/node#21825): Node ignores `windowsHide` under
     * `detached: true`. Kept for every-spawn consistency; the spawned binary is
     * Electron (GUI subsystem), so no console window appears either way.
     */
    windowsHide: true,
  };

  return { file, args, opts };
}

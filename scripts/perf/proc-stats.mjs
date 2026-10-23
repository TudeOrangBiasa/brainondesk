const SMAPS_ROLLUP_KEY_RE = /^(Rss|Pss):\s+(\d+)\s+kB\s*$/;

export function parseSmapsRollup(text) {
  const out = { rssKB: null, pssKB: null };
  for (const line of text.split('\n')) {
    const match = SMAPS_ROLLUP_KEY_RE.exec(line.trim());
    if (match?.[1] === 'Rss' && out.rssKB === null) out.rssKB = Number(match[2]);
    if (match?.[1] === 'Pss' && out.pssKB === null) out.pssKB = Number(match[2]);
  }
  return out;
}

export function procStatCpuTicks(statText) {
  const afterComm = statText.slice(statText.lastIndexOf(')') + 1).trim().split(/\s+/);
  const utime = Number(afterComm[11]);
  const stime = Number(afterComm[12]);
  if (!Number.isFinite(utime) || !Number.isFinite(stime)) return null;
  return { utime, stime };
}

export function cpuSecondsBetween(before, after, ticksPerSecond) {
  return (after.utime + after.stime - before.utime - before.stime) / ticksPerSecond;
}

export function normalizeIdleCpuToSixty(rawCpuSec, seconds) {
  if (rawCpuSec === null || !Number.isFinite(rawCpuSec)) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return (rawCpuSec * 60) / seconds;
}

export function kernelTicksPerSecond() {
  return 100;
}

export function parseServerLock(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { pid, port } = parsed;
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (!Number.isInteger(port) || port <= 0) return null;
  return { pid, port };
}

export function serverLockPath(projectDir) {
  return `${projectDir}/.ok/local/server.lock`;
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

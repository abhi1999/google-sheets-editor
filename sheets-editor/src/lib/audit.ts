// Shared diffing helpers for building audit log entries out of nested evaluation
// objects (fitness/skills/ratings), so a single save only logs the fields that
// actually changed instead of the whole blob.

export function diffRecord(
  oldR: Record<string, string | number> | undefined | null,
  newR: Record<string, string | number> | undefined | null
): { old: Record<string, string | number>; new: Record<string, string | number> } | null {
  const o = oldR || {};
  const n = newR || {};
  const oldOut: Record<string, string | number> = {};
  const newOut: Record<string, string | number> = {};
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  for (const k of keys) {
    const ov = o[k] ?? '';
    const nv = n[k] ?? '';
    if (String(ov) !== String(nv)) {
      oldOut[k] = ov;
      newOut[k] = nv;
    }
  }
  return Object.keys(newOut).length > 0 ? { old: oldOut, new: newOut } : null;
}

export function safeJsonParse<T>(json: string | undefined | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function normalizeTransitionConfig(data) {
  return {
    enabled: data?.enabled !== false,
    delayMs: Number.isFinite(data?.delayMs) ? Math.max(0, data.delayMs) : 20,
    durationMs: Number.isFinite(data?.durationMs) ? Math.max(0, data.durationMs) : 60,
  };
}

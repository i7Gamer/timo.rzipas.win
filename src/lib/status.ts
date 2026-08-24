/** Status a service can report live via /status.json. */
export type LiveStatus = 'online' | 'offline';

/** Everything the status dot on a service card can display. */
export type IndicatorStatus = LiveStatus | 'planned';

export const STATUS_DOT_CLASS: Record<IndicatorStatus, string> = {
  online: 'bg-emerald-400',
  planned: 'bg-amber-400',
  offline: 'bg-red-400',
};

/**
 * Parses the payload of /status.json (written by deploy/update-status.ps1
 * on the Docker host) into service name → live status. Anything that does
 * not match the expected shape is ignored so a broken generator can never
 * break the page — the static labels simply remain.
 */
export function parseStatusPayload(payload: unknown): Map<string, LiveStatus> {
  const result = new Map<string, LiveStatus>();
  if (typeof payload !== 'object' || payload === null) {
    return result;
  }
  const services = (payload as { services?: unknown }).services;
  if (
    typeof services !== 'object' ||
    services === null ||
    Array.isArray(services)
  ) {
    return result;
  }
  for (const [name, status] of Object.entries(services)) {
    if (status === 'online' || status === 'offline') {
      result.set(name, status);
    }
  }
  return result;
}

/** Minutes after which a status.json is considered outdated. */
export const STATUS_STALE_AFTER_MINUTES = 15;

/** Reads the generation timestamp of /status.json, or null if unusable. */
export function parseGeneratedAt(payload: unknown): Date | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const generatedAt = (payload as { generatedAt?: unknown }).generatedAt;
  if (typeof generatedAt !== 'string') {
    return null;
  }
  const date = new Date(generatedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whether the status data is older than the given threshold. */
export function isStale(
  generatedAt: Date,
  now: Date,
  thresholdMinutes: number,
): boolean {
  const MS_PER_MINUTE = 60_000;
  return (
    now.getTime() - generatedAt.getTime() > thresholdMinutes * MS_PER_MINUTE
  );
}

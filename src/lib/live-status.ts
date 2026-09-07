import {
  isStale,
  parseGeneratedAt,
  parseStatusPayload,
  STATUS_DOT_CLASS,
  STATUS_STALE_AFTER_MINUTES,
  STATUS_FUTURE_TOLERANCE_MS,
  type LiveStatus,
} from './status';

/** Translated labels for the statuses status.json can report. */
export type StatusLabels = Partial<
  Record<LiveStatus | 'unknown', string | undefined>
>;

const ALL_DOT_CLASSES = Object.values(STATUS_DOT_CLASS);

/**
 * Flips the dot and label of every service card under `root` that the
 * payload names, and returns how many cards were updated. Missing or invalid
 * statuses become unknown; planned services keep their label. Cards are matched on
 * their data attribute rather than through a selector, because names may
 * contain quotes.
 */
export function applyStatuses(
  root: ParentNode,
  payload: unknown,
  labels: StatusLabels,
): number {
  const statuses = parseStatusPayload(payload);
  let updated = 0;
  for (const card of root.querySelectorAll<HTMLElement>('[data-service]')) {
    const reported = statuses.get(card.dataset.service ?? '');
    if (card.dataset.planned === 'true') {
      continue;
    }
    const status = reported ?? 'unknown';
    const dot = card.querySelector('[data-status-dot]');
    const label = card.querySelector('[data-status-label]');
    if (dot === null || label === null) {
      continue;
    }
    dot.classList.remove(...ALL_DOT_CLASSES);
    dot.classList.add(STATUS_DOT_CLASS[status]);
    label.textContent = labels[status] ?? status;
    updated += 1;
  }
  return updated;
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};
const TIME_PLACEHOLDER = '{time}';

/**
 * When status.json is old, says so instead of pretending it is live.
 * Returns whether the note was shown.
 */
export function markStaleData(
  asOf: HTMLElement,
  payload: unknown,
  now: Date,
  lang?: string,
): boolean {
  const generatedAt = parseGeneratedAt(payload);
  asOf.hidden = true;
  asOf.textContent = '';
  if (
    generatedAt === null ||
    !isStale(generatedAt, now, STATUS_STALE_AFTER_MINUTES)
  ) {
    return false;
  }
  const time = generatedAt.toLocaleTimeString(lang, TIME_FORMAT);
  asOf.textContent = (asOf.dataset.label ?? TIME_PLACEHOLDER).replace(
    TIME_PLACEHOLDER,
    time,
  );
  asOf.hidden = false;
  return true;
}

const STATUS_URL = '/status.json';
export const STATUS_REFRESH_MS = 60_000;
export const STATUS_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fetches the live statuses and applies them to the cards under `grid`,
 * whose data attributes carry the translated labels. Only fresh, timestamped
 * readings are trusted. Failed checks reset previous results to unknown.
 */
export async function loadLiveStatus(
  grid: HTMLElement,
  asOf: HTMLElement | null,
  now?: Date,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    STATUS_REQUEST_TIMEOUT_MS,
  );
  let payload: unknown;
  try {
    const response = await fetch(STATUS_URL, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.ok) {
      payload = await response.json();
    }
  } catch {
    // Unavailable data must not look like a successful service check.
  } finally {
    clearTimeout(timeout);
  }
  const checkedAt = now ?? new Date();
  const generatedAt = parseGeneratedAt(payload);
  const fresh =
    generatedAt !== null &&
    Number.isFinite(checkedAt.getTime()) &&
    generatedAt.getTime() - checkedAt.getTime() <= STATUS_FUTURE_TOLERANCE_MS &&
    !isStale(generatedAt, checkedAt, STATUS_STALE_AFTER_MINUTES);
  applyStatuses(grid, fresh ? payload : null, {
    online: grid.dataset.labelOnline,
    offline: grid.dataset.labelOffline,
    unknown: grid.dataset.labelUnknown,
  });
  if (asOf !== null) {
    // An empty lang attribute would make toLocaleTimeString throw.
    markStaleData(
      asOf,
      payload,
      checkedAt,
      document.documentElement.lang || undefined,
    );
  }
}

/** Refresh while mounted, and restart when restored from the back/forward cache. */
export function startLiveStatus(
  grid: HTMLElement,
  asOf: HTMLElement | null,
): () => void {
  let inFlight = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const refresh = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await loadLiveStatus(grid, asOf);
    } finally {
      inFlight = false;
    }
  };
  const pause = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const resume = () => {
    if (timer === undefined)
      timer = setInterval(() => {
        void refresh();
      }, STATUS_REFRESH_MS);
    void refresh();
  };
  const onVisibility = () => {
    if (!document.hidden) void refresh();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resume();
  return () => {
    pause();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', pause);
    window.removeEventListener('pageshow', resume);
  };
}

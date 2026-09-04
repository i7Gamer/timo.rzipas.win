import {
  isStale,
  parseGeneratedAt,
  parseStatusPayload,
  STATUS_DOT_CLASS,
  STATUS_STALE_AFTER_MINUTES,
  type LiveStatus,
} from './status';

/** Translated labels for the statuses status.json can report. */
export type StatusLabels = Partial<Record<LiveStatus, string | undefined>>;

const ALL_DOT_CLASSES = Object.values(STATUS_DOT_CLASS);

/**
 * Flips the dot and label of every service card under `root` that the
 * payload names, and returns how many cards changed. A malformed payload
 * changes nothing, so the build-time labels remain. Cards are matched on
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
    const status = statuses.get(card.dataset.service ?? '');
    const dot = card.querySelector('[data-status-dot]');
    const label = card.querySelector('[data-status-label]');
    if (status === undefined || dot === null || label === null) {
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

/**
 * Fetches the live statuses and applies them to the cards under `grid`,
 * whose data attributes carry the translated labels. A missing file leaves
 * the page untouched; a network failure rejects, for the caller to swallow.
 */
export async function loadLiveStatus(
  grid: HTMLElement,
  asOf: HTMLElement | null,
  now: Date = new Date(),
): Promise<void> {
  const response = await fetch(STATUS_URL, { cache: 'no-store' });
  if (!response.ok) {
    return;
  }
  const payload: unknown = await response.json();
  applyStatuses(grid, payload, {
    online: grid.dataset.labelOnline,
    offline: grid.dataset.labelOffline,
  });
  if (asOf !== null) {
    // An empty lang attribute would make toLocaleTimeString throw.
    markStaleData(
      asOf,
      payload,
      now,
      document.documentElement.lang || undefined,
    );
  }
}

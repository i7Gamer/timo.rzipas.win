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
    card.dataset.status = status;
    updated += 1;
  }
  return updated;
}

/** Fills a {placeholder} template; unknown placeholders stay as they are. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

/** Checked services under `scope` and how many of them were seen online. */
function countServices(scope: ParentNode): { total: number; online: number } {
  const cards = [
    ...scope.querySelectorAll<HTMLElement>('[data-service]'),
  ].filter((card) => card.dataset.planned !== 'true');
  return {
    total: cards.length,
    online: cards.filter((card) => card.dataset.status === 'online').length,
  };
}

/**
 * Writes the online counts into the summary line and each group header
 * (elements carrying data-template). Without a fresh check (`time` null) the
 * build-time texts in data-static come back, so a failed check never shows
 * "0 online".
 */
export function updateCounts(root: ParentNode, time: string | null): void {
  const targets = root.querySelectorAll<HTMLElement>(
    '[data-status-summary], [data-group-count]',
  );
  for (const target of targets) {
    const { template, static: staticText } = target.dataset;
    if (template === undefined || staticText === undefined) {
      continue;
    }
    if (time === null) {
      target.textContent = staticText;
      continue;
    }
    const scope = target.closest<HTMLElement>('[data-service-group]') ?? root;
    const { total, online } = countServices(scope);
    target.textContent = fill(template, {
      total: String(total),
      online: String(online),
      time,
    });
  }
}

const CHECK_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
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
  const time = generatedAt.toLocaleString(lang, DATE_TIME_FORMAT);
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
  // An empty lang attribute would make toLocaleString throw.
  const lang = document.documentElement.lang || undefined;
  updateCounts(
    grid,
    fresh ? checkedAt.toLocaleTimeString(lang, CHECK_TIME_FORMAT) : null,
  );
  if (asOf !== null) {
    markStaleData(asOf, payload, checkedAt, lang);
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

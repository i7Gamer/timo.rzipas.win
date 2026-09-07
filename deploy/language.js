// Dependency-free JavaScript shared by nginx njs and the unit tests.
const LOCALES = ['en', 'de'];
const DEFAULT_LOCALE = LOCALES[0];
const DEFAULT_QUALITY = 1;
const EXCLUDED_QUALITY = 0;
const NO_PREFERENCE = -1;
const RANGE =
  /^\s*([a-z]{1,8}(?:-[a-z0-9]{1,8})*|\*)\s*(?:;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i;

/** Highest supported quality wins; ties follow header order, then English. */
function accept(request) {
  const header = request.headersIn['Accept-Language'] || '';
  const preferences = [];
  header.split(',').forEach((entry) => {
    const match = RANGE.exec(entry);
    if (match === null) return;
    preferences.push({
      locale: match[1].toLowerCase().split('-')[0],
      quality: match[2] === undefined ? DEFAULT_QUALITY : Number(match[2]),
      order: preferences.length,
    });
  });
  let selected = DEFAULT_LOCALE;
  let bestQuality = EXCLUDED_QUALITY;
  let bestOrder = Infinity;
  LOCALES.forEach((locale) => {
    // An explicit language preference overrides the wildcard, including q=0.
    const explicit = preferences.filter((entry) => entry.locale === locale);
    const matches = explicit.length
      ? explicit
      : preferences.filter((entry) => entry.locale === '*');
    let quality = NO_PREFERENCE;
    let order = Infinity;
    matches.forEach((entry) => {
      if (entry.quality > quality) {
        quality = entry.quality;
        order = entry.order;
      }
    });
    if (
      quality > EXCLUDED_QUALITY &&
      (quality > bestQuality || (quality === bestQuality && order < bestOrder))
    ) {
      selected = locale;
      bestQuality = quality;
      bestOrder = order;
    }
  });
  // When nothing is acceptable, retain the documented English fallback.
  return selected;
}

export default { accept };

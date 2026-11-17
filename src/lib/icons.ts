import { icons as lucide } from '@iconify-json/lucide';
import { icons as simpleIcons } from '@iconify-json/simple-icons';
import { getIconData, iconToSVG, replaceIDs } from '@iconify/utils';

type IconSet = typeof lucide;

const ICON_SETS: Record<string, IconSet> = {
  lucide,
  'simple-icons': simpleIcons,
};

/**
 * Renders an Iconify id ("set:name") to an inline <svg> string at build time.
 * Both sets draw with currentColor, so CSS `color` tints the icon.
 */
export function renderIconSvg(id: string, size: number): string {
  const [prefix, name, ...rest] = id.split(':');
  if (!prefix || !name || rest.length > 0)
    throw new Error(`Icon id must look like prefix:name, got "${id}"`);
  const set = ICON_SETS[prefix];
  if (!set) throw new Error(`Unknown icon set "${prefix}" in "${id}"`);
  const data = getIconData(set, name);
  if (!data) throw new Error(`Icon "${name}" not found in set "${prefix}"`);
  const { attributes, body } = iconToSVG(data, { width: size, height: size });
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${replaceIDs(body)}</svg>`;
}

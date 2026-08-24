export function normalizePath(path: string): string {
  const stripped = path.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

export function isActivePath(currentPath: string, href: string): boolean {
  return normalizePath(currentPath) === normalizePath(href);
}

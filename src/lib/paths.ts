export function normalizePath(path: string): string {
  const stripped = path.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

export function isActivePath(currentPath: string, href: string): boolean {
  return normalizePath(currentPath) === normalizePath(href);
}

export function isSectionPath(currentPath: string, href: string): boolean {
  const section = normalizePath(href);
  return (
    isActivePath(currentPath, section) ||
    (section !== '/' && normalizePath(currentPath).startsWith(`${section}/`))
  );
}

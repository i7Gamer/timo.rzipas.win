/**
 * Printouts must not lose what is folded away on screen: the about page
 * doubles as a CV, and the homelab services collapse into groups. Every
 * <details> marked with data-print-open opens right before printing.
 */
export const PRINT_OPEN_SELECTOR = 'details[data-print-open]';

export function openDetailsForPrint(target: Window): void {
  target.addEventListener('beforeprint', () => {
    for (const details of target.document.querySelectorAll<HTMLDetailsElement>(
      PRINT_OPEN_SELECTOR,
    )) {
      details.open = true;
    }
  });
}

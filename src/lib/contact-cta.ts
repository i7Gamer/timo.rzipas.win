/**
 * The hero "Get in touch →" link scrolls to #contact. When the contact panel
 * is already fully on screen the click does nothing visible and the link looks
 * broken, so it is hidden then (visibility only, so the hero does not reflow).
 */
export const CTA_HIDDEN_CLASS = 'invisible';

/** The part of DOMRect the check reads. */
export interface VerticalBox {
  top: number;
  bottom: number;
}

/** Whether the box lies wholly inside a viewport of the given height. */
export function isFullyInView(
  box: VerticalBox,
  viewportHeight: number,
): boolean {
  return box.top >= 0 && box.bottom <= viewportHeight;
}

/** Hides the link while the target is fully visible; re-checks on scroll and resize. */
export function setUpContactCta(link: HTMLElement, target: Element): void {
  const update = () => {
    link.classList.toggle(
      CTA_HIDDEN_CLASS,
      isFullyInView(target.getBoundingClientRect(), window.innerHeight),
    );
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

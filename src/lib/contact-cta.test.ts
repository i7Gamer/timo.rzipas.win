// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CTA_HIDDEN_CLASS,
  isFullyInView,
  setUpContactCta,
} from './contact-cta';

const VIEWPORT = 800;

describe('isFullyInView', () => {
  it('is true when the box sits inside the viewport', () => {
    expect(isFullyInView({ top: 100, bottom: 500 }, VIEWPORT)).toBe(true);
  });

  it('is true when the box touches both edges exactly', () => {
    expect(isFullyInView({ top: 0, bottom: VIEWPORT }, VIEWPORT)).toBe(true);
  });

  it('is false when the box starts above the viewport', () => {
    expect(isFullyInView({ top: -1, bottom: 500 }, VIEWPORT)).toBe(false);
  });

  it('is false when the box ends below the viewport', () => {
    expect(isFullyInView({ top: 100, bottom: VIEWPORT + 1 }, VIEWPORT)).toBe(
      false,
    );
  });

  it('is false when the box is entirely below the viewport', () => {
    expect(isFullyInView({ top: 900, bottom: 1200 }, VIEWPORT)).toBe(false);
  });

  it('is false when the box is taller than the viewport', () => {
    expect(isFullyInView({ top: -10, bottom: VIEWPORT + 10 }, VIEWPORT)).toBe(
      false,
    );
  });
});

describe('setUpContactCta', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function mount(rect: { top: number; bottom: number }) {
    document.body.innerHTML = `<a data-contact-cta href="#contact">CTA</a><section id="contact"></section>`;
    const link = document.querySelector<HTMLElement>('[data-contact-cta]')!;
    const target = document.getElementById('contact')!;
    const spy = vi
      .spyOn(target, 'getBoundingClientRect')
      .mockReturnValue(rect as DOMRect);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: VIEWPORT,
    });
    return { link, spy };
  }

  it('hides the link at once when the target is already fully visible', () => {
    const { link } = mount({ top: 100, bottom: 500 });
    setUpContactCta(link, document.getElementById('contact')!);
    expect(link.classList.contains(CTA_HIDDEN_CLASS)).toBe(true);
  });

  it('shows the link when the target is partly off screen', () => {
    const { link } = mount({ top: 700, bottom: 1200 });
    setUpContactCta(link, document.getElementById('contact')!);
    expect(link.classList.contains(CTA_HIDDEN_CLASS)).toBe(false);
  });

  it('updates on scroll', () => {
    const { link, spy } = mount({ top: 700, bottom: 1200 });
    setUpContactCta(link, document.getElementById('contact')!);
    spy.mockReturnValue({ top: 100, bottom: 600 } as DOMRect);
    window.dispatchEvent(new Event('scroll'));
    expect(link.classList.contains(CTA_HIDDEN_CLASS)).toBe(true);
  });

  it('updates on resize', () => {
    const { link } = mount({ top: 100, bottom: 500 });
    setUpContactCta(link, document.getElementById('contact')!);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 400,
    });
    window.dispatchEvent(new Event('resize'));
    expect(link.classList.contains(CTA_HIDDEN_CLASS)).toBe(false);
  });
});

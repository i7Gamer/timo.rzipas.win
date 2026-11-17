// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { openDetailsForPrint } from './print';

describe('openDetailsForPrint', () => {
  it('opens every collapsible marked for print before printing', () => {
    document.body.innerHTML = `
      <details data-print-open><summary>a</summary>x</details>
      <details data-print-open open><summary>b</summary>y</details>
      <details><summary>other</summary>z</details>`;
    openDetailsForPrint(window);
    window.dispatchEvent(new Event('beforeprint'));
    const [first, second, other] = document.querySelectorAll('details');
    expect(first.open).toBe(true);
    expect(second.open).toBe(true);
    expect(other.open).toBe(false);
  });

  it('leaves entries alone until printing starts', () => {
    document.body.innerHTML = `<details data-print-open><summary>a</summary>x</details>`;
    openDetailsForPrint(window);
    expect(document.querySelector('details')!.open).toBe(false);
  });

  it('does nothing when nothing is marked', () => {
    document.body.innerHTML = '';
    openDetailsForPrint(window);
    expect(() => window.dispatchEvent(new Event('beforeprint'))).not.toThrow();
  });
});

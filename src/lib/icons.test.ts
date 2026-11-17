import { describe, expect, it } from 'vitest';

import { renderIconSvg } from './icons';

describe('renderIconSvg', () => {
  it('renders a simple-icons id as a currentColor svg of the given size', () => {
    const svg = renderIconSvg('simple-icons:docker', 28);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('width="28"');
    expect(svg).toContain('height="28"');
    expect(svg).toContain('currentColor');
  });

  it('renders a lucide id as a currentColor svg', () => {
    expect(renderIconSvg('lucide:network', 28)).toContain('currentColor');
  });

  it('never emits hardcoded colours', () => {
    expect(renderIconSvg('simple-icons:oracle', 28)).not.toMatch(
      /#[0-9a-f]{3}/i,
    );
  });

  it('throws on a malformed id', () => {
    expect(() => renderIconSvg('docker', 28)).toThrow(/prefix:name/);
  });

  it('throws on an unknown icon set', () => {
    expect(() => renderIconSvg('nope:docker', 28)).toThrow(/icon set/);
  });

  it('throws on an unknown icon name', () => {
    expect(() => renderIconSvg('lucide:does-not-exist', 28)).toThrow(
      /does-not-exist/,
    );
  });
});

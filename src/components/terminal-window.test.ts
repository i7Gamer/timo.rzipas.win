import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import TerminalLine from './TerminalLine.astro';
import TerminalWindow from './TerminalWindow.astro';

describe('TerminalWindow', () => {
  it('shows its prompt title and its contents', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalWindow, {
      props: { title: 'timo@homelab:~' },
      slots: { default: '<p>hello</p>' },
    });
    expect(html).toContain('timo@homelab:~');
    expect(html).toContain('hello');
  });

  // The hero script finds the scroll area through this hook.
  it('marks the scrollable content area', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalWindow, {
      props: { title: 't' },
      slots: { default: 'x' },
    });
    expect(html).toContain('data-terminal-content');
    expect(html).toContain('overflow-x-auto');
  });

  it('keeps the window-chrome dots out of the accessibility tree', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalWindow, {
      props: { title: 't' },
      slots: { default: 'x' },
    });
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(3);
  });
});

describe('TerminalLine', () => {
  it('prints the command after a prompt', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalLine, {
      props: { cmd: 'whoami' },
    });
    expect(html).toContain('~ $');
    expect(html).toContain('whoami');
  });

  it('prints the output when there is one', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalLine, {
      props: { cmd: 'whoami', out: 'Timo Rzipa' },
    });
    expect(html).toContain('Timo Rzipa');
  });

  it('renders no output paragraph when the command has none', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalLine, {
      props: { cmd: 'fastfetch' },
    });
    expect(html.match(/<p/g)).toHaveLength(1);
  });

  it('adds a blinking cursor only when asked', async () => {
    const container = await AstroContainer.create();
    const withCursor = await container.renderToString(TerminalLine, {
      props: { cmd: '', cursor: true },
    });
    const without = await container.renderToString(TerminalLine, {
      props: { cmd: '' },
    });
    expect(withCursor).toContain('animate-cursor');
    expect(without).not.toContain('animate-cursor');
  });
});

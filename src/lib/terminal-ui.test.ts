// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { setUpTerminal } from './terminal-ui';
import type { TerminalStrings } from './terminal';

const STRINGS: TerminalStrings = {
  whoami: 'WHOAMI_OUT',
  skills: 'SKILLS_OUT',
  health: 'HEALTH_OUT',
  help: 'HELP_OUT',
  sudo: 'SUDO_OUT',
};

beforeAll(() => {
  // happy-dom leaves this out; the terminal calls it after every command.
  Element.prototype.scrollIntoView ??= () => {};
});

/** The markup TerminalWindow renders around the hero terminal, reduced. */
function mount(withStrings = true): HTMLElement {
  const strings = withStrings
    ? ` data-strings='${JSON.stringify(STRINGS)}'`
    : '';
  document.body.innerHTML = `<div data-hero-terminal${strings} data-input-label="Terminal input">
    <div class="panel shadow-sm">
      <div data-terminal-content>
        <p>~ $ whoami</p>
        <div data-terminal-idle><p>~ $ <span class="animate-cursor"></span></p></div>
      </div>
    </div>
  </div>`;
  return document.querySelector('[data-hero-terminal]') as HTMLElement;
}

function input(): HTMLInputElement {
  return document.querySelector('input') as HTMLInputElement;
}

function press(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true });
  input().dispatchEvent(event);
  return event;
}

function type(command: string): void {
  input().value = command;
  press('Enter');
}

function lines(): string[] {
  return [...document.querySelectorAll('[data-terminal-content] > p')].map(
    (p) => p.textContent.trim(),
  );
}

describe('setUpTerminal', () => {
  it('does nothing without the localized strings', () => {
    const root = mount(false);
    setUpTerminal(root);
    expect(document.querySelector('input')).toBeNull();
    expect(document.querySelector('[data-terminal-idle]')).not.toBeNull();
  });

  it('swaps the decorative cursor for a labelled input and lights the glow', () => {
    const root = mount();
    setUpTerminal(root);
    expect(document.querySelector('[data-terminal-idle]')).toBeNull();
    expect(input().getAttribute('aria-label')).toBe('Terminal input');
    expect(input().autocapitalize).toBe('none');
    expect(root.classList.contains('terminal-halo')).toBe(true);
    const panel = document.querySelector('.panel')!;
    expect(panel.classList.contains('terminal-glow')).toBe(true);
    expect(panel.classList.contains('shadow-sm')).toBe(false);
  });

  it('falls back to a generic input label', () => {
    const root = mount();
    delete root.dataset.inputLabel;
    setUpTerminal(root);
    expect(input().getAttribute('aria-label')).toBe('Terminal');
  });

  it('echoes the command and prints its output', () => {
    setUpTerminal(mount());
    type('whoami');
    expect(lines()).toEqual(['~ $ whoami', '~ $ whoami', 'WHOAMI_OUT', '~ $']);
    expect(input().value).toBe('');
  });

  it('clears everything but the input row', () => {
    setUpTerminal(mount());
    type('whoami');
    type('clear');
    expect(lines()).toEqual(['~ $']);
    expect(document.querySelector('input')).not.toBeNull();
  });

  it('navigates through the injected callback', () => {
    const navigate = vi.fn();
    setUpTerminal(mount(), { navigate });
    type('cd projects');
    expect(navigate).toHaveBeenCalledWith('/projects/');
  });

  it('recalls history with the arrow keys and claims the keystroke', () => {
    setUpTerminal(mount());
    type('whoami');
    type('ls');
    expect(press('ArrowUp').defaultPrevented).toBe(true);
    expect(input().value).toBe('ls');
    press('ArrowUp');
    expect(input().value).toBe('whoami');
    press('ArrowDown');
    expect(input().value).toBe('ls');
  });

  it('leaves the arrow keys alone while there is nothing to recall', () => {
    setUpTerminal(mount());
    expect(press('ArrowUp').defaultPrevented).toBe(false);
    expect(press('ArrowDown').defaultPrevented).toBe(false);
  });

  it('ignores other keys', () => {
    setUpTerminal(mount());
    input().value = 'wh';
    press('a');
    expect(input().value).toBe('wh');
    expect(lines()).toHaveLength(2);
  });

  it('focuses the prompt when the terminal is clicked', () => {
    const root = mount();
    setUpTerminal(root);
    root.click();
    expect(document.activeElement).toBe(input());
  });

  it('does not steal focus from a text selection', () => {
    const root = mount();
    setUpTerminal(root);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'selected text',
    } as Selection);
    root.click();
    expect(document.activeElement).not.toBe(input());
  });
});

import {
  createCommandHistory,
  runTerminalCommand,
  type TerminalStrings,
} from './terminal';

export interface TerminalUiOptions {
  /** Where `cd` sends the visitor; defaults to a real navigation. */
  navigate?: (href: string) => void;
}

const CONTENT_SELECTOR = '[data-terminal-content]';
const IDLE_SELECTOR = '[data-terminal-idle]';
const PANEL_SELECTOR = '.panel';
const PROMPT = '~ $';
const FALLBACK_INPUT_LABEL = 'Terminal';

function realNavigation(href: string): void {
  window.location.href = href;
}

/**
 * Turns the static hero terminal into an interactive one: replaces the
 * decorative cursor with an input line, wires history and commands, and
 * lights the CRT glow. Does nothing when the localized strings are missing.
 */
export function setUpTerminal(
  root: HTMLElement,
  { navigate = realNavigation }: TerminalUiOptions = {},
): void {
  const content = root.querySelector(CONTENT_SELECTOR);
  if (!(content instanceof HTMLElement) || !root.dataset.strings) {
    return;
  }
  const strings = JSON.parse(root.dataset.strings) as TerminalStrings;

  root.querySelector(IDLE_SELECTOR)?.remove();
  content.classList.add('max-h-72', 'overflow-y-auto');
  const frame = content.closest(PANEL_SELECTOR);
  frame?.classList.remove('shadow-sm');
  frame?.classList.add('terminal-glow');
  // The pulse lives on the wrapper so it escapes the panel's overflow clip.
  root.classList.add('terminal-halo');

  const row = document.createElement('p');
  row.className = 'group flex items-center gap-2';
  const prompt = document.createElement('span');
  prompt.className = 'text-accent select-none';
  prompt.textContent = PROMPT;
  const idleCursor = document.createElement('span');
  idleCursor.className =
    'animate-cursor bg-accent inline-block h-[1.05em] w-[0.55em] group-focus-within:hidden';
  idleCursor.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.className = 'text-ink min-w-0 flex-1 bg-transparent outline-none';
  input.setAttribute(
    'aria-label',
    root.dataset.inputLabel ?? FALLBACK_INPUT_LABEL,
  );
  input.autocapitalize = 'none';
  input.autocomplete = 'off';
  input.spellcheck = false;
  row.append(prompt, idleCursor, input);
  content.append(row);

  const insertLine = (className: string, ...children: (Node | string)[]) => {
    const line = document.createElement('p');
    line.className = className;
    line.append(...children);
    content.insertBefore(line, row);
  };

  const history = createCommandHistory();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const recalled =
        event.key === 'ArrowUp' ? history.previous() : history.next();
      if (recalled !== undefined) {
        event.preventDefault();
        input.value = recalled;
      }
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    const value = input.value;
    input.value = '';
    history.add(value);
    insertLine('text-ink', prompt.cloneNode(true), ` ${value}`);
    const action = runTerminalCommand(value, strings);
    if (action.type === 'print') {
      for (const outputLine of action.lines) {
        insertLine('text-muted', outputLine);
      }
    } else if (action.type === 'navigate') {
      navigate(action.href);
    } else if (action.type === 'clear') {
      for (const line of [...content.querySelectorAll('p')]) {
        if (line !== row) {
          line.remove();
        }
      }
    }
    row.scrollIntoView({ block: 'nearest' });
  });

  // Clicking anywhere in the terminal focuses the prompt — unless the
  // visitor is selecting text to copy.
  root.addEventListener('click', () => {
    if (window.getSelection()?.toString()) {
      return;
    }
    input.focus();
  });
}

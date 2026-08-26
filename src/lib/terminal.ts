/** Localized outputs for the interactive hero terminal. */
export interface TerminalStrings {
  whoami: string;
  skills: string;
  health: string;
  help: string;
  sudo: string;
}

export type TerminalAction =
  | { type: 'none' }
  | { type: 'clear' }
  | { type: 'navigate'; href: string }
  | { type: 'print'; lines: string[] };

const PAGE_ROUTES: Readonly<Record<string, string>> = {
  projects: '/projects/',
  homelab: '/homelab/',
  about: '/about/',
  // German alias, so the German help text's `cd <seite>` hint holds up.
  projekte: '/projects/',
};

const SKILLS_FILE = 'skills.txt';
const LS_OUTPUT = `about  homelab  projects  ${SKILLS_FILE}`;

const HISTORY_LIMIT = 50;

export interface CommandHistory {
  add(command: string): void;
  previous(): string | undefined;
  next(): string | undefined;
}

/**
 * ↑/↓ recall for the fake terminal, with bash-like edges: hold at the
 * oldest entry going up, walk forward back down to a blank live line.
 * `undefined` means "nothing to recall" — the caller leaves the input alone.
 */
export function createCommandHistory(limit = HISTORY_LIMIT): CommandHistory {
  const entries: string[] = [];
  // Browse position; entries.length is the blank "live" line.
  let index = 0;

  return {
    add(command) {
      const trimmed = command.trim();
      if (trimmed !== '' && trimmed !== entries.at(-1)) {
        entries.push(trimmed);
        if (entries.length > limit) {
          entries.shift();
        }
      }
      index = entries.length;
    },
    previous() {
      if (entries.length === 0) {
        return undefined;
      }
      if (index > 0) {
        index -= 1;
      }
      return entries[index];
    },
    next() {
      if (index >= entries.length) {
        return undefined;
      }
      index += 1;
      return index === entries.length ? '' : entries[index];
    },
  };
}

function print(...lines: string[]): TerminalAction {
  return { type: 'print', lines };
}

/**
 * Interprets one command of the fake hero terminal. Faux-bash error
 * messages stay English on purpose — just like a real shell with LANG=C.
 */
export function runTerminalCommand(
  input: string,
  strings: TerminalStrings,
): TerminalAction {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { type: 'none' };
  }
  const [cmd, ...args] = trimmed.split(/\s+/);

  switch (cmd) {
    case 'help':
      return print(strings.help);
    case 'whoami':
      return print(strings.whoami);
    case 'ls':
      return print(LS_OUTPUT);
    case 'cat': {
      const file = args[0];
      if (file === undefined) {
        return print('usage: cat <file>');
      }
      if (file === SKILLS_FILE) {
        return print(strings.skills);
      }
      return print(`cat: ${file}: No such file or directory`);
    }
    case 'cd': {
      const target = args[0] ?? '';
      // "~/projects" · "/projects" · "projects/" all mean "projects".
      const cleaned = target.replace(/^~\/?/, '').replace(/^\/+|\/+$/g, '');
      if (cleaned === '') {
        return { type: 'navigate', href: '/' };
      }
      const href = PAGE_ROUTES[cleaned];
      if (href !== undefined) {
        return { type: 'navigate', href };
      }
      if (cleaned === SKILLS_FILE) {
        return print(`bash: cd: ${target}: Not a directory`);
      }
      return print(`bash: cd: ${target}: No such file or directory`);
    }
    case 'clear':
      return { type: 'clear' };
    case 'sudo':
      return print(strings.sudo);
    case 'curl': {
      if (args.length === 0) {
        return print('usage: curl <url> — try curl healthz');
      }
      if (args.some((arg) => arg.includes('healthz'))) {
        return print(strings.health);
      }
      const host = args.find((arg) => !arg.startsWith('-')) ?? args[0];
      return print(`curl: (6) Could not resolve host: ${host}`);
    }
    case 'exit':
    case 'logout':
      return print('logout');
    default:
      return print(`bash: ${cmd}: command not found`);
  }
}

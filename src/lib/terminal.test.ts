import { describe, expect, it } from 'vitest';

import {
  createCommandHistory,
  runTerminalCommand,
  type TerminalStrings,
} from './terminal';

const strings: TerminalStrings = {
  whoami: 'WHOAMI_OUT',
  skills: 'SKILLS_OUT',
  health: 'HEALTH_OUT',
  help: 'HELP_OUT',
  sudo: 'SUDO_OUT',
};

const run = (input: string) => runTerminalCommand(input, strings);

describe('runTerminalCommand', () => {
  it.each(['', '   ', '\t'])('does nothing for blank input %j', (input) => {
    expect(run(input)).toEqual({ type: 'none' });
  });

  it('prints help', () => {
    expect(run('help')).toEqual({ type: 'print', lines: ['HELP_OUT'] });
  });

  it('prints whoami', () => {
    expect(run('whoami')).toEqual({ type: 'print', lines: ['WHOAMI_OUT'] });
  });

  it('lists the pages and skills.txt', () => {
    expect(run('ls')).toEqual({
      type: 'print',
      lines: ['about  homelab  projects  skills.txt'],
    });
  });

  it('cats skills.txt', () => {
    expect(run('cat skills.txt')).toEqual({
      type: 'print',
      lines: ['SKILLS_OUT'],
    });
  });

  it('fails to cat unknown files like bash', () => {
    expect(run('cat passwords.txt')).toEqual({
      type: 'print',
      lines: ['cat: passwords.txt: No such file or directory'],
    });
  });

  it('hints usage for cat without a file', () => {
    expect(run('cat')).toEqual({ type: 'print', lines: ['usage: cat <file>'] });
  });

  it.each(['cd', 'cd ~', 'cd /', 'cd ~/'])('%s navigates home', (input) => {
    expect(run(input)).toEqual({ type: 'navigate', href: '/' });
  });

  it.each([
    ['cd projects', '/projects/'],
    ['cd projects/', '/projects/'],
    ['cd /projects', '/projects/'],
    ['cd ~/projects', '/projects/'],
    ['cd homelab', '/homelab/'],
    ['cd about', '/about/'],
    ['cd projekte', '/projects/'],
  ])('%s navigates to %s', (input, href) => {
    expect(run(input)).toEqual({ type: 'navigate', href });
  });

  it('rejects unknown directories like bash', () => {
    expect(run('cd secrets')).toEqual({
      type: 'print',
      lines: ['bash: cd: secrets: No such file or directory'],
    });
  });

  it('rejects cd into a file like bash', () => {
    expect(run('cd skills.txt')).toEqual({
      type: 'print',
      lines: ['bash: cd: skills.txt: Not a directory'],
    });
  });

  it('clears the terminal', () => {
    expect(run('clear')).toEqual({ type: 'clear' });
  });

  it.each(['sudo', 'sudo rm -rf /'])('%s gets the joke answer', (input) => {
    expect(run(input)).toEqual({ type: 'print', lines: ['SUDO_OUT'] });
  });

  it('curls the health endpoint', () => {
    expect(run('curl healthz')).toEqual({
      type: 'print',
      lines: ['HEALTH_OUT'],
    });
    expect(run('curl -s https://timo.rzipas.win/healthz')).toEqual({
      type: 'print',
      lines: ['HEALTH_OUT'],
    });
  });

  it('fails to curl other hosts', () => {
    expect(run('curl example.com')).toEqual({
      type: 'print',
      lines: ['curl: (6) Could not resolve host: example.com'],
    });
  });

  it('hints usage for curl without a target', () => {
    expect(run('curl')).toEqual({
      type: 'print',
      lines: ['usage: curl <url> — try curl healthz'],
    });
  });

  it.each(['exit', 'logout'])('%s prints logout', (input) => {
    expect(run(input)).toEqual({ type: 'print', lines: ['logout'] });
  });

  it('reports unknown commands like bash', () => {
    expect(run('vim')).toEqual({
      type: 'print',
      lines: ['bash: vim: command not found'],
    });
  });

  it('is case-sensitive like a real shell', () => {
    expect(run('Help')).toEqual({
      type: 'print',
      lines: ['bash: Help: command not found'],
    });
  });

  it('collapses extra whitespace between arguments', () => {
    expect(run('  cat    skills.txt  ')).toEqual({
      type: 'print',
      lines: ['SKILLS_OUT'],
    });
  });
});

describe('createCommandHistory', () => {
  it('recalls commands newest-first', () => {
    const history = createCommandHistory();
    history.add('whoami');
    history.add('ls');
    expect(history.previous()).toBe('ls');
    expect(history.previous()).toBe('whoami');
  });

  it('holds at the oldest entry like bash', () => {
    const history = createCommandHistory();
    history.add('whoami');
    expect(history.previous()).toBe('whoami');
    expect(history.previous()).toBe('whoami');
  });

  it('walks forward back down to a blank live line', () => {
    const history = createCommandHistory();
    history.add('whoami');
    history.add('ls');
    history.previous();
    history.previous();
    expect(history.next()).toBe('ls');
    expect(history.next()).toBe('');
    expect(history.next()).toBeUndefined();
  });

  it('returns undefined while empty', () => {
    expect(createCommandHistory().previous()).toBeUndefined();
    expect(createCommandHistory().next()).toBeUndefined();
  });

  it('records commands trimmed and ignores blank ones', () => {
    const history = createCommandHistory();
    history.add('   ');
    expect(history.previous()).toBeUndefined();
    history.add('  ls  ');
    expect(history.previous()).toBe('ls');
  });

  it('skips consecutive duplicates', () => {
    const history = createCommandHistory();
    history.add('ls');
    history.add('ls');
    history.add('whoami');
    expect(history.previous()).toBe('whoami');
    expect(history.previous()).toBe('ls');
    expect(history.previous()).toBe('ls');
  });

  it('restarts browsing at the newest entry after adding', () => {
    const history = createCommandHistory();
    history.add('whoami');
    history.previous();
    history.add('ls');
    expect(history.previous()).toBe('ls');
  });

  it('evicts the oldest entry beyond the limit', () => {
    const LIMIT = 2;
    const history = createCommandHistory(LIMIT);
    history.add('one');
    history.add('two');
    history.add('three');
    expect(history.previous()).toBe('three');
    expect(history.previous()).toBe('two');
    expect(history.previous()).toBe('two');
  });
});

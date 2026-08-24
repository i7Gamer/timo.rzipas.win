import { describe, expect, it } from 'vitest';

import { runTerminalCommand, type TerminalStrings } from './terminal';

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
  ])('%s navigates to %s', (input, href) => {
    expect(run(input)).toEqual({ type: 'navigate', href });
  });

  it('rejects unknown directories like bash', () => {
    expect(run('cd secrets')).toEqual({
      type: 'print',
      lines: ['bash: cd: secrets: No such file or directory'],
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

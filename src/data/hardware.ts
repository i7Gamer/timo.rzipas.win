import type { UIKey } from '../i18n';

/**
 * Total bulk storage in the server. Quoted in copy all over the site —
 * hardware spec sheet, hero stats, homelab teaser, 404 joke — so it lives
 * here once. src/data/hardware.test.ts fails if a literal creeps back in.
 */
export const STORAGE_TOTAL = '140 TB';

/**
 * Server memory, single-sourced for the same reason: quoted in the spec
 * sheet and the hero stats. src/data/hardware.test.ts guards it too.
 */
export const RAM_TOTAL = '64 GB';

/**
 * One row in a machine's spec sheet. The value is either a literal
 * (product names, which are the same in every language) or a UI key
 * (anything that needs translating).
 */
export interface HardwareSpec {
  labelKey: UIKey;
  value?: string;
  valueKey?: UIKey;
}

export interface Machine {
  id: string;
  titleKey: UIKey;
  /** Prompt shown in the terminal window's title bar. */
  terminalTitle: string;
  specs: readonly HardwareSpec[];
}

export const MACHINES: readonly Machine[] = [
  {
    id: 'server',
    titleKey: 'homelab.machine.server',
    terminalTitle: 'timo@homelab:~',
    specs: [
      { labelKey: 'homelab.hw.cpu', value: 'Intel Core i5-13500 · 14C / 20T' },
      { labelKey: 'homelab.hw.ram', value: `${RAM_TOTAL} DDR4` },
      { labelKey: 'homelab.hw.board', value: 'Gigabyte Z690 UD DDR4' },
      {
        labelKey: 'homelab.hw.storage',
        valueKey: 'homelab.hw.storage.value',
      },
      { labelKey: 'homelab.hw.network', value: '2.5 GbE' },
      { labelKey: 'homelab.hw.os', value: 'Windows Server 2025 + Docker' },
    ],
  },
  {
    id: 'workstation',
    titleKey: 'homelab.machine.workstation',
    terminalTitle: 'timo@desktop:~',
    specs: [
      { labelKey: 'homelab.hw.cpu', value: 'Intel Core i7-13700K · 16C / 24T' },
      { labelKey: 'homelab.hw.ram', value: '32 GB DDR5' },
      { labelKey: 'homelab.hw.gpu', value: 'NVIDIA GeForce RTX 5090 · 32 GB' },
      {
        labelKey: 'homelab.hw.storage',
        valueKey: 'homelab.hw.storage.workstation',
      },
      { labelKey: 'homelab.hw.network', value: '2.5 GbE' },
      {
        labelKey: 'homelab.hw.os',
        valueKey: 'homelab.hw.os.workstation',
      },
    ],
  },
];

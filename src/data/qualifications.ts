import type { Localized } from '../i18n';

interface Qualification {
  id: string;
  kind: 'certificate' | 'course';
  title: Localized<string>;
  issuer: string;
  date: string;
}

export const QUALIFICATIONS: readonly Qualification[] = [
  {
    id: 'cisco',
    kind: 'course',
    date: '2015-02-19',
    title: {
      en: 'Routing and Switching Essentials — course completion',
      de: 'Routing and Switching Essentials — Kursabschluss',
    },
    issuer: 'Cisco Networking Academy · HTL Dornbirn',
  },
  {
    id: 'pma',
    kind: 'certificate',
    date: '2014-06-04',
    title: {
      en: 'pm basic — project management certificate',
      de: 'pm basic — Projektmanagement-Zertifikat',
    },
    issuer: 'Projekt Management Austria · OCG',
  },
];

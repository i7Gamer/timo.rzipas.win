import type { Locale } from '../../i18n';

export const LOCAL_PETS_PATH = '/api/ask-local-pets';

export interface LocalPets {
  overview: Record<Locale, string>;
  cats: {
    name: string;
    description: Record<Locale, string>;
    unverifiedVariety?: true;
  }[];
}

export function parseLocalPets(value: unknown): LocalPets | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as LocalPets;
  const translated = (text: Record<Locale, string>) =>
    typeof text?.en === 'string' && typeof text?.de === 'string';
  if (
    !translated(data.overview) ||
    !Array.isArray(data.cats) ||
    !data.cats.every(
      (cat) =>
        cat &&
        typeof cat.name === 'string' &&
        !!cat.name.trim() &&
        translated(cat.description) &&
        (cat.unverifiedVariety === undefined || cat.unverifiedVariety === true),
    )
  )
    return null;
  return {
    overview: { en: data.overview.en, de: data.overview.de },
    cats: data.cats.map(({ name, description, unverifiedVariety }) => ({
      name,
      description: { en: description.en, de: description.de },
      ...(unverifiedVariety ? { unverifiedVariety } : {}),
    })),
  };
}

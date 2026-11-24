import { createHash } from 'node:crypto';
import {
  catalogContent,
  facts,
  sourceLink,
  sources,
  type SourceId,
} from './catalog.ts';

export const corpusVersion = createHash('sha256')
  .update(catalogContent)
  .digest('base64url');

export function publicFactBundle() {
  return {
    schemaVersion: 1,
    corpusVersion,
    sources: Object.fromEntries(
      (Object.keys(sources) as SourceId[]).map((id) => {
        const { label: en, href: hrefEn } = sourceLink(id, 'en');
        const { label: de, href: hrefDe } = sourceLink(id, 'de');
        return [
          id,
          {
            en: { label: en, href: hrefEn },
            'de-CH': { label: de, href: hrefDe },
          },
        ];
      }),
    ),
    facts: facts.map(
      ({
        id,
        facet,
        aliases,
        standalone,
        answer,
        lead,
        sourceId,
        partial,
      }) => ({
        id,
        topic: facet,
        aliases: [...new Set([...aliases, ...(standalone ?? [])])],
        answers: { en: answer.en, 'de-CH': answer.de },
        ...(lead ? { lead: { en: lead.en, 'de-CH': lead.de } } : {}),
        sourceId,
        ...(partial ? { partial } : {}),
      }),
    ),
  };
}

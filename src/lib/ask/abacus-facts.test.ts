import { describe, expect, it } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import { JOBS } from '../../data/jobs';
import { facts } from './catalog';

const abacus = JOBS.find(({ id }) => id === 'abacus')!;
const fact = (id: string) => facts.find((entry) => entry.id === id)!;

describe('Abacus recognition ownership', () => {
  it('states on the job entry that other teams develop the recognition', () => {
    expect(abacus.contribution?.en).toMatch(
      /recognition itself is developed by other parts and teams of the company/,
    );
    expect(abacus.contribution?.de).toMatch(
      /Erkennung selbst entwickeln andere Bereiche und Teams des Unternehmens/,
    );
  });

  it('answers recognition ownership as a reviewed fact, not an open gap', () => {
    const recognition = fact('abacus-recognition');
    expect(recognition.partial).toBeUndefined();
    expect(recognition.answer.en).toMatch(/did not develop/);
    expect(recognition.answer.en).toMatch(/other parts and teams/);
    expect(recognition.answer.de).toMatch(/nicht Timo entwickelt/);
    expect(recognition.answer.de).toMatch(/anderen Bereichen und Teams/);
    expect(recognition.evidence).toEqual(['abacus.contribution']);
  });

  it.each([
    ['en', 'Did Timo develop automatic document recognition at Abacus?'],
    ['de', 'Hat Timo die automatische Belegerkennung bei Abacus entwickelt?'],
  ] as const)('answers %s ownership questions directly', (locale, question) => {
    const { fallback } = prepareQuestion(question, locale);
    expect(fallback.status).toBe('answer');
    expect(fallback.claims.map(({ id }) => id)).toEqual(['abacus-recognition']);
  });
});

describe('Abacus missing-data workflow', () => {
  it('describes the missing-data handling on the job entry', () => {
    const [first] = abacus.highlights ?? [];
    expect(first?.en).toMatch(/missing data/);
    expect(first?.en).toMatch(/pending list/);
    expect(first?.de).toMatch(/fehlende Daten/);
    expect(first?.de).toMatch(/Liste offener Belege/);
  });

  it('keeps a bilingual reviewed fact backed by the job highlights', () => {
    const missing = fact('abacus-missing-data');
    expect(missing.sourceId).toBe('abacus');
    expect(missing.evidence).toEqual(['abacus.highlights']);
    for (const text of [missing.answer.en, missing.answer.de])
      expect(text).toMatch(/Timo/);
    expect(missing.answer.en).toMatch(/supplier|payment method|address/);
    expect(missing.answer.en).toMatch(/pending/);
    expect(missing.answer.de).toMatch(/Lieferant|Zahlungsart|Adresse/);
  });

  it.each([
    ['en', 'What happens when a supplier is missing in the Abacus workflow?'],
    ['en', 'What does the Abacus workflow do with missing payment methods?'],
    ['de', 'Was passiert bei Abacus, wenn ein Lieferant fehlt?'],
    ['de', 'Wie behandelt der Abacus-Workflow fehlende Zahlungsarten?'],
  ] as const)('offers the missing-data fact for %s %j', (locale, question) => {
    const { fallback, candidates } = prepareQuestion(question, locale);
    const ids = [
      ...fallback.claims.map(({ id }) => id),
      ...candidates.map(({ id }) => id),
    ];
    expect(ids).toContain('abacus-missing-data');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  askModel,
  broadEvidencePool,
  rankedWithTopics,
  prepareBoundedQuestion,
  prepareQuestion,
  shortlist,
  type SelectFacts,
} from '../../../services/ask/selection.ts';
import {
  CV_OVERVIEW_IDS,
  EXTENDED_PITCH_IDS,
  WORK_EXPERIENCE_IDS,
  facts,
  longProjectSummary,
} from './catalog';
import { corpusVersion } from './version';
import { findSiteContent, parseSiteContent } from './site-content';
import { TOPIC_PROMPTS, topicCandidates } from './topics';

const HIRE_IDS = ['abacus-workflow', 'stadler-vpn', 'spotify-python'];
const SUMMARY_IDS = [
  'portfolio-pitch',
  'career-role-titles',
  'portfolio-project-inventory',
];
const SCOPE_ONLY_IDS = [
  'cv-masters-listing',
  'carini-billing-scope',
  'myspeed-forecast-scope',
  'stadler-start-month',
  'tutto-kniffel-completed-fixture',
  'tutto-kniffel-completion-fixture',
];

const citedPages = [
  '/about/',
  '/projects/',
  '/projects/spotify-stats-tracker/',
];
const siteIndex = (locale: 'en' | 'de') =>
  parseSiteContent(
    {
      locale,
      pages: citedPages.map((href) => ({
        href,
        title: href,
        overview: [],
        sections: [],
      })),
    },
    locale,
  )!;

const claimIds = (question: string, locale: 'en' | 'de') =>
  prepareQuestion(question, locale).fallback.claims.map(({ id }) => id);

describe('owner feedback questions', () => {
  it.each([
    ['summary', 'en', SUMMARY_IDS],
    ['why hire?', 'en', HIRE_IDS],
    ['benefits', 'en', HIRE_IDS],
    ['cv', 'en', CV_OVERVIEW_IDS],
    ['lebenslauf', 'de', CV_OVERVIEW_IDS],
    ['Vorteile', 'de', HIRE_IDS],
    ['Erfahrung', 'de', WORK_EXPERIENCE_IDS],
  ] as const)(
    'answers %j with reviewed evidence',
    (question, locale, expected) => {
      const prepared = prepareQuestion(question, locale);
      expect(prepared.fallback.status).toBe('answer');
      expect(prepared.fallback.claims.map(({ id }) => id)).toEqual(expected);
    },
  );

  it.each([
    ['cv', 'en'],
    ['lebenslauf', 'de'],
    ['resume', 'en'],
  ] as const)('answers %j in the browser without the model', (q, locale) => {
    const answer = findSiteContent(q, siteIndex(locale), 'overview');
    expect(answer?.status).toBe('answer');
    expect(answer?.sources.flatMap(({ excerpts }) => excerpts)).toHaveLength(
      CV_OVERVIEW_IDS.length,
    );
  });

  it('no longer asks whether benefits mean employer perks', () => {
    const answer = findSiteContent('Vorteile', siteIndex('de'), 'overview');
    expect(answer?.note ?? '').not.toMatch(/Zusatzleistungen/);
    expect(answer?.status).toBe('answer');
  });
});

describe('scope-only facts', () => {
  it.each(['cv', 'lebenslauf', 'Tell me about his education history'])(
    'keeps them out of the evidence for %j',
    (question) => {
      const prepared = prepareQuestion(question, 'en');
      const offered = [
        ...prepared.fallback.claims.map(({ id }) => id),
        ...prepared.candidates.map(({ id }) => id),
        ...prepared.semanticPool,
        ...broadEvidencePool(question),
      ];
      for (const id of SCOPE_ONLY_IDS) expect(offered).not.toContain(id);
    },
  );

  it.each([
    'What did Timo build at Carini?',
    'Tell me about MySpeed',
    'Which Kniffel tests does Tutto have?',
  ])('excludes them from the shortlist for %j', (question) => {
    const shortlisted = shortlist(question).map(({ id }) => id);
    for (const id of SCOPE_ONLY_IDS) expect(shortlisted).not.toContain(id);
  });

  it('still answers the explicit question it covers', () => {
    expect(
      claimIds(
        'Ist im Lebenslauf nach der FH Vorarlberg ein Masterabschluss aufgeführt?',
        'de',
      ),
    ).toEqual(['cv-masters-listing']);
  });
});

describe('broad search', () => {
  it('keeps scope-only facts out of the broad pool', () => {
    const pool = broadEvidencePool('what makes him stand out');
    expect(pool.length).toBeGreaterThan(0);
    for (const id of SCOPE_ONLY_IDS) expect(pool).not.toContain(id);
  });
});

describe('topic buttons', () => {
  it.each([
    ...TOPIC_PROMPTS.en.map((q) => [q, 'en'] as const),
    ...TOPIC_PROMPTS.de.map((q) => [q, 'de'] as const),
  ])('answers the %j button without the model', (question, locale) => {
    expect(prepareQuestion(question, locale).fallback.status).toBe('answer');
  });
});

describe('topic selection fallback', () => {
  it('offers topic overviews when no fact matches', () => {
    const prepared = prepareQuestion('what makes him stand out', 'en');
    expect(prepared.fallback.status).toBe('unknown');
    expect(prepared.candidates.map(({ id }) => id)).toEqual(
      topicCandidates().map(({ id }) => id),
    );
  });

  it.each([
    'What is his salary?',
    'What are his weak points?',
    'Who won the World Cup?',
    'Welche Jobs hatte er bei Microsoft?',
    'Give me a summary of his work experience at Google',
  ])(
    'does not offer topics for unrelated or qualified question %j',
    (question) => {
      expect(prepareQuestion(question, 'en').candidates).toEqual([]);
    },
  );

  it('expands the selected topic into reviewed claims', async () => {
    const prepared = prepareQuestion('what makes him stand out', 'en');
    const select = vi.fn<SelectFacts>(async (_q, _l, candidates) => ({
      status: 'answer',
      slots: [candidates.findIndex(({ id }) => id === 'topic:hire') + 1],
    }));
    const result = await askModel(
      select,
      'what makes him stand out',
      'en',
      prepared.candidates,
      AbortSignal.timeout(1_000),
    );
    expect(result).toMatchObject({
      status: 'answer',
      mode: 'local',
      corpusVersion,
    });
    expect(result?.claims.map(({ id }) => id)).toEqual(HIRE_IDS);
    expect(
      result?.claims.every(({ id }) => facts.some((f) => f.id === id)),
    ).toBe(true);
  });

  it('abstains when the selector finds no topic', async () => {
    const prepared = prepareQuestion('Is he left-handed?', 'en');
    const select = vi.fn<SelectFacts>(async () => ({
      status: 'unknown',
      slots: [],
    }));
    const result = await askModel(
      select,
      'Is he left-handed?',
      'en',
      prepared.candidates,
      AbortSignal.timeout(1_000),
    );
    expect(result?.status).toBe('unknown');
  });
});

describe('ranked facts with topic candidates', () => {
  const fact = (id: string) => facts.find((entry) => entry.id === id)!;

  it('offers ranked facts first and keeps the topic candidates', () => {
    const ranked = [fact('coilwatch-mobile-dashboard')];
    const merged = rankedWithTopics(ranked, topicCandidates());
    expect(merged.map(({ id }) => id)).toEqual([
      'coilwatch-mobile-dashboard',
      ...topicCandidates().map(({ id }) => id),
    ]);
  });

  it('uses the ranked facts alone when there are no candidates', () => {
    const ranked = [fact('spotify-recovery')];
    expect(rankedWithTopics(ranked, [])).toEqual(ranked);
  });

  it('keeps ordinary candidates unchanged', () => {
    const candidates = [fact('spotify-python')];
    expect(rankedWithTopics([fact('tutto-stack')], candidates)).toEqual(
      candidates,
    );
  });

  it('lets the selector prefer a topic over a weak ranked fact', async () => {
    const candidates = rankedWithTopics(
      [fact('portfolio-role-location')],
      prepareQuestion('what makes him stand out', 'en').candidates,
    );
    const select = vi.fn<SelectFacts>(async (_q, _l, offered) => ({
      status: 'answer',
      slots: [offered.findIndex(({ id }) => id === 'topic:hire') + 1],
    }));
    const result = await askModel(
      select,
      'what makes him stand out',
      'en',
      candidates,
      AbortSignal.timeout(1_000),
    );
    expect(result?.claims.map(({ id }) => id)).toEqual(HIRE_IDS);
  });
});

describe('second round of owner feedback', () => {
  it.each([
    ['200 word summary', 'en', EXTENDED_PITCH_IDS],
    ['CV download', 'en', CV_OVERVIEW_IDS],
    [
      '200 word summary about hearthcoil',
      'en',
      longProjectSummary('/projects/hearthcoil/'),
    ],
  ] as const)('answers %j without the model', (question, locale, expected) => {
    const prepared = prepareBoundedQuestion(question, locale);
    expect(prepared.fallback.status).toBe('answer');
    expect(prepared.fallback.claims.map(({ id }) => id)).toEqual(expected);
    expect(prepared.retrievalRequired).toBe(false);
  });

  it('shows the project summary in the browser with the cited page', () => {
    const answer = findSiteContent(
      '200 word summary about hearthcoil',
      parseSiteContent(
        {
          locale: 'en',
          pages: [
            {
              href: '/projects/hearthcoil/',
              title: 'Hearthcoil',
              overview: [],
              sections: [],
            },
          ],
        },
        'en',
      )!,
      'overview',
    );
    expect(answer?.status).toBe('answer');
    expect(answer?.preferModel).toBeUndefined();
    expect(answer?.sources.flatMap(({ excerpts }) => excerpts)).toHaveLength(
      longProjectSummary('/projects/hearthcoil/').length,
    );
  });
});

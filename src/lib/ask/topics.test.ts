import { describe, expect, it } from 'vitest';
import {
  CV_OVERVIEW_IDS,
  WORK_EXPERIENCE_IDS,
  facts,
  normalize,
} from './catalog';
import {
  TOPIC_PROMPTS,
  expandTopicMatches,
  questionTopics,
  topicCandidates,
  topicFactIds,
  topicLongerSummary,
} from './topics';

const HIRE_IDS = ['abacus-workflow', 'stadler-vpn', 'spotify-python'];
const SUMMARY_IDS = [
  'portfolio-pitch',
  'career-role-titles',
  'portfolio-project-inventory',
];
const EDUCATION_IDS = ['cv-degree', 'cv-matura'];
const SKILL_IDS = ['abacus-workflow', 'spotify-python', 'tutto-stack'];

const ids = (question: string) => topicFactIds(normalize(question));

describe('topic keywords', () => {
  // The questions from the owner’s feedback file plus unseen rewordings.
  it.each([
    ['why hire?', HIRE_IDS],
    ['benefits', HIRE_IDS],
    ['Vorteile', HIRE_IDS],
    ['strengths?', HIRE_IDS],
    ['Stärken', HIRE_IDS],
    ['Why should we hire Timo?', HIRE_IDS],
    ['why him', HIRE_IDS],
    ['Warum sollte ich ihn einstellen?', HIRE_IDS],
    ['summary', SUMMARY_IDS],
    ['Zusammenfassung', SUMMARY_IDS],
    ['overview please', SUMMARY_IDS],
    ['intro', SUMMARY_IDS],
    ['who is he?', SUMMARY_IDS],
    ['wer ist er', SUMMARY_IDS],
    ['cv', CV_OVERVIEW_IDS],
    ['lebenslauf', CV_OVERVIEW_IDS],
    ['resume pls', CV_OVERVIEW_IDS],
    ['his CV?', CV_OVERVIEW_IDS],
    ['Lebenslauf bitte', CV_OVERVIEW_IDS],
    ['cv summary', CV_OVERVIEW_IDS],
    ['Erfahrung', WORK_EXPERIENCE_IDS],
    ['experience', WORK_EXPERIENCE_IDS],
    ['jobs', WORK_EXPERIENCE_IDS],
    ['Berufserfahrung?', WORK_EXPERIENCE_IDS],
    ['what is his career', WORK_EXPERIENCE_IDS],
    ['Karriere', WORK_EXPERIENCE_IDS],
    ['education', EDUCATION_IDS],
    ['Studium', EDUCATION_IDS],
    ['what degree does he have', EDUCATION_IDS],
    ['skills', SKILL_IDS],
    ["what's he good at", SKILL_IDS],
    ['Fähigkeiten', SKILL_IDS],
    ['hobbies?', ['portfolio-leisure']],
    ['Freizeit', ['portfolio-leisure']],
    ['location', ['portfolio-role-location']],
    ['Wo wohnt er?', ['portfolio-role-location']],
  ])('routes %j', (question, expected) => {
    expect(ids(question)).toEqual(expected);
  });

  it.each([
    ['lebenslaif', CV_OVERVIEW_IDS],
    ['experiance', WORK_EXPERIENCE_IDS],
    ['strenghts', HIRE_IDS],
  ])('repairs a single typo in %j', (question, expected) => {
    expect(ids(question)).toEqual(expected);
  });

  it.each([
    'experience with python',
    'Erfahrung mit Java',
    'how does it work',
    'does it work offline',
    'what is that',
    'tell me about hearthcoil',
    'summary of hearthcoil',
    'more',
    'beides',
    'thanks',
    'Who won the World Cup?',
    'programming languages',
    'stack',
    'experience with kubernetes',
    'projects',
    'Summarize project.',
  ])('leaves %j to the specific routes', (question) => {
    expect(ids(question)).toBeUndefined();
  });

  it('combines two topics without exceeding the claim limit', () => {
    const combined = ids('education and skills');
    expect(combined).toEqual([...EDUCATION_IDS, SKILL_IDS[0]]);
  });

  it('reports the matched topic ids in question order', () => {
    expect(questionTopics(normalize('cv and hobbies'))).toEqual([
      'cv',
      'hobbies',
    ]);
    expect(questionTopics(normalize('nothing relevant here'))).toEqual([]);
  });

  it('only cites published facts', () => {
    const known = new Set(facts.map(({ id }) => id));
    for (const prompt of [...TOPIC_PROMPTS.en, ...TOPIC_PROMPTS.de])
      for (const id of ids(prompt) ?? []) expect(known.has(id), id).toBe(true);
  });
});

describe('longer summaries after a topic answer', () => {
  it.each([
    ['cv', 'longer summary of his cv'],
    ['Lebenslauf', 'longer summary of his cv'],
    ['Erfahrung', 'longer summary of his work experience'],
    ['summary', 'longer summary of timo'],
    ['why hire?', 'longer summary of timo'],
  ])('expands %j', (anchor, expected) => {
    expect(topicLongerSummary(normalize(anchor))).toBe(expected);
  });

  it('has no expansion for topics without a reviewed longer summary', () => {
    expect(topicLongerSummary(normalize('hobbies'))).toBeUndefined();
    expect(topicLongerSummary(normalize('hearthcoil'))).toBeUndefined();
  });
});

describe('topic candidates for the selector', () => {
  it.each(['en', 'de'] as const)(
    'describes every topic in %s without exposing fact ids',
    (locale) => {
      const candidates = topicCandidates();
      expect(candidates.length).toBeGreaterThan(1);
      for (const candidate of candidates) {
        expect(candidate.answer[locale]).toBeTruthy();
        expect(candidate.answer[locale]).not.toMatch(/topic:/);
      }
    },
  );

  it('expands a chosen topic into its reviewed facts', () => {
    const hire = topicCandidates().find(({ id }) => id === 'topic:hire');
    expect(hire).toBeDefined();
    expect(expandTopicMatches([hire!]).map(({ id }) => id)).toEqual(HIRE_IDS);
  });

  it('keeps real facts and removes duplicates', () => {
    const work = topicCandidates().find(({ id }) => id === 'topic:work')!;
    const abacus = facts.find(({ id }) => id === 'abacus-workflow')!;
    expect(expandTopicMatches([abacus, work]).map(({ id }) => id)).toEqual(
      WORK_EXPERIENCE_IDS,
    );
  });
});

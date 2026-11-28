import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../../data/projects';
import { facts, sourceLink } from './catalog';

describe('expanded Ask evidence', () => {
  it('publishes the Hearthcoil story as a bilingual source page', () => {
    const project = PROJECTS.find(({ slug }) => slug === 'hearthcoil');
    expect(project?.story).toBeDefined();
    expect(sourceLink('hearthcoil', 'en').href).toBe('/projects/hearthcoil/');
    expect(sourceLink('hearthcoil', 'de').href).toBe('/projects/hearthcoil/');
    expect(project?.story?.contribution.en).toContain(
      'filmed them from two angles as animation reference',
    );
    expect(project?.story?.contribution.de).toContain(
      'aus zwei Blickwinkeln gefilmt',
    );
  });

  it('keeps owner-supplied Hearthcoil claims bilingual and source-backed', () => {
    const ids = [
      'hearthcoil-game',
      'hearthcoil-contribution',
      'hearthcoil-rules-testing',
      'hearthcoil-playtest',
      'hearthcoil-supervisor',
      'hearthcoil-supervisor-verification',
    ];
    const selected = facts.filter(({ id }) => ids.includes(id));
    expect(selected.map(({ id }) => id)).toEqual(ids);
    for (const fact of selected) {
      expect(fact.answer.en).toBeTruthy();
      expect(fact.answer.de).toBeTruthy();
      expect(fact.evidence.length).toBeGreaterThan(0);
      expect(fact.sourceId).toBe('hearthcoil');
    }
    expect(JSON.stringify(selected)).not.toMatch(
      /cloudflare|vpn|remote access|internet-facing/i,
    );
  });

  it('describes attack footage as animation reference and playtests as observations', () => {
    const contribution = facts.find(
      ({ id }) => id === 'hearthcoil-contribution',
    );
    const playtest = facts.find(({ id }) => id === 'hearthcoil-playtest');
    const hearthcoil = PROJECTS.find(({ slug }) => slug === 'hearthcoil');
    expect(contribution?.answer.en).toMatch(
      /performed attack movements himself and filmed them from two angles as animation reference/i,
    );
    expect(contribution?.answer.de).toMatch(
      /Angriffsbewegungen selbst vorgemacht und aus zwei Blickwinkeln gefilmt.*Animationsreferenz/i,
    );
    expect(JSON.stringify(contribution)).not.toMatch(
      /motion.?capture|tracking suit/i,
    );
    expect(playtest?.answer.en).toMatch(
      /playtests Hearthcoil weekly.*early takeaway.*felt too easy.*tried increasing enemy pressure and adding enemies/i,
    );
    expect(playtest?.answer.de).toMatch(
      /wöchentlich.*früher Eindruck.*zu leicht.*Gegnerdruck.*weitere Gegner/i,
    );
    expect(JSON.stringify(playtest)).not.toMatch(
      /shipped|released|veröffentlicht/i,
    );
    expect(hearthcoil?.story?.contribution.en).toMatch(
      /performed attack movements myself and filmed them from two angles as animation reference/i,
    );
    expect(hearthcoil?.story?.outcome.en).toMatch(
      /playtest.*weekly.*early takeaway.*tried increasing enemy pressure/i,
    );
  });

  it('keeps the bilingual Spotify reconciliation example available to chat', () => {
    const fact = facts.find(
      ({ id }) => id === 'spotify-reconciliation-example',
    );
    expect(fact?.sourceId).toBe('spotify');
    expect(fact?.answer.en).toMatch(
      /long pause.*API import.*live listener.*same play twice.*observed end/i,
    );
    expect(fact?.answer.de).toMatch(
      /langen Pause.*API-Import.*Live-Erfassung.*dieselbe Wiedergabe doppelt.*beobachteten Wiedergabeendes/i,
    );
    expect(fact?.evidence).toContain('spotify.decisions');
  });

  it('adds Abacus Jenkins and review/testing claims from both published CVs', () => {
    const jenkins = facts.find(({ id }) => id === 'abacus-jenkins');
    const review = facts.find(({ id }) => id === 'abacus-reviews-tests');
    expect(jenkins?.sourceId).toBe('cv-experience');
    expect(review?.sourceId).toBe('cv-experience');
    expect(jenkins?.evidence).toContain('cv.pdf');
    expect(review?.evidence).toContain('cv.pdf');
    expect(jenkins?.answer.en).toContain('Jenkins');
    expect(jenkins?.answer.de).toContain('Jenkins');
    expect(review?.answer.en).toContain('JUnit and Mockito');
    expect(review?.answer.de).toContain('JUnit und Mockito');
    expect(sourceLink('cv-experience', 'en').href).toBe(
      '/downloads/timo-rzipa-cv-en.pdf#page=1',
    );
    expect(sourceLink('cv-experience', 'de').href).toBe(
      '/downloads/timo-rzipa-cv-de.pdf#page=1',
    );
  });
});

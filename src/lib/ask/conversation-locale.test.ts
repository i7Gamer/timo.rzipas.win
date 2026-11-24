import { describe, expect, it } from 'vitest';
import { questionLocale } from './conversation';

describe('questionLocale', () => {
  it.each([
    ['Was SpotifyTracker a rewrite?', 'en', 'en'],
    ['Was Hearthcoil built in Unity?', 'de', 'en'],
    ['Was SpotifyTracker?', 'en', 'en'],
    ['Was SpotifyTracker?', 'de', 'de'],
    ['Was the tracker rewritten?', 'en', 'en'],
    ['Was kostet SpotifyTracker?', 'en', 'de'],
    ['Was hat SpotifyTracker gebaut?', 'en', 'de'],
    ['Was macht SpotifyTracker?', 'en', 'de'],
    ['Was nutzt SpotifyTracker?', 'en', 'de'],
    ['Was ist SpotifyTracker?', 'en', 'de'],
    ['Was?', 'de', 'de'],
    ['Was?', 'en', 'en'],
  ] as const)('detects the locale of %j', (question, fallback, expected) => {
    expect(questionLocale(question, fallback)).toBe(expected);
  });
});

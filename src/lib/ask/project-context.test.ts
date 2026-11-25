import { describe, expect, it } from 'vitest';
import { projectFollowUp } from './project-context';

describe('project follow-up anchors', () => {
  it('keeps a project overview anchor across acknowledgement turns', () => {
    const history = [
      {
        question: 'Tell me about your projects',
        answer: 'SpotifyTracker began as a project.',
      },
      { question: 'Thanks', answer: 'You’re welcome.' },
      {
        question: 'Tell me more',
        answer:
          'Which project would you like to hear more about? SpotifyTracker, MySpeed, Tutto.',
      },
      { question: 'Thanks', answer: 'You’re welcome.' },
    ];

    expect(projectFollowUp('tell me more', history)).toMatchObject({
      overview: history[0],
      focus: { id: 'spotify-rewrite' },
    });
  });

  it('retains an offered project choice across repeated clarification turns', () => {
    const history = [
      {
        question: 'Tell me about your projects',
        answer: 'SpotifyTracker began as a project.',
      },
      {
        question: 'Tell me more',
        answer:
          'Which project would you like to hear more about? SpotifyTracker.',
      },
    ];

    expect(projectFollowUp('tell me more', history)).toMatchObject({
      overview: history[0],
      focus: { id: 'spotify-rewrite' },
    });
  });
});

import { describe, expect, it } from '@jest/globals';

import { createSwipeDeck, SwipeDeck } from '../SwipeDeck';

describe('createSwipeDeck factory surface', () => {
  it('adds registry hooks only to factory instances', () => {
    const ProfileDeck = createSwipeDeck<{ id: string }>();

    expect(typeof ProfileDeck.useDeckState).toBe('function');
    expect(typeof ProfileDeck.useDeckActions).toBe('function');
    expect(typeof ProfileDeck.useDeckInteraction).toBe('function');
    expect('useDeckState' in SwipeDeck).toBe(false);
    expect('useDeckActions' in SwipeDeck).toBe(false);
    expect('useDeckInteraction' in SwipeDeck).toBe(false);
  });
});

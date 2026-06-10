import { describe, expect, it } from '@jest/globals';

import {
  appendSwipeDeckUndoHistoryEntry,
  createSwipeDeckUndoHistoryEntry,
  createSwipeDeckUndoKeyIndex,
  hasValidSwipeDeckUndoHistoryEntry,
  pruneSwipeDeckUndoHistory,
  removeSwipeDeckUndoHistoryEntryByToken,
  resolveLatestSwipeDeckUndoHistoryEntry,
  resolveSwipeDeckUndoRestoreTarget,
  type SwipeDeckUndoHistoryEntry,
} from '../registry/undoHistory';

type Profile = {
  id: string;
  name: string;
};

const adaProfile: Profile = { id: 'ada', name: 'Ada' };
const graceProfile: Profile = { id: 'grace', name: 'Grace' };
const linusProfile: Profile = { id: 'linus', name: 'Linus' };

const getProfileKey = (profile: Profile) => profile.id;

describe('undo history helpers', () => {
  it('creates a token and key-based history entry from a swipe commit', () => {
    expect(
      createSwipeDeckUndoHistoryEntry({
        token: 1,
        item: adaProfile,
        index: 0,
        direction: 'right',
        getKey: getProfileKey,
      }),
    ).toEqual({
      token: 1,
      key: 'ada',
      index: 0,
      direction: 'right',
    });
  });

  it('resolves the latest valid entry by current data key', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'ada', index: 0, direction: 'right' },
      { token: 2, key: 'grace', index: 1, direction: 'left' },
    ];

    expect(
      resolveLatestSwipeDeckUndoHistoryEntry(
        history,
        [adaProfile, graceProfile],
        createSwipeDeckUndoKeyIndex([adaProfile, graceProfile], getProfileKey),
      ),
    ).toMatchObject({
      historyIndex: 1,
      index: 1,
      item: graceProfile,
    });
  });

  it('restores reordered data by current key index', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'ada', index: 0, direction: 'right' },
    ];

    expect(
      resolveLatestSwipeDeckUndoHistoryEntry(
        history,
        [graceProfile, adaProfile],
        createSwipeDeckUndoKeyIndex([graceProfile, adaProfile], getProfileKey),
      ),
    ).toMatchObject({
      index: 1,
      item: adaProfile,
    });
  });

  it('does not restore a same-index replacement with a different key', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'ada', index: 0, direction: 'right' },
    ];

    expect(
      resolveLatestSwipeDeckUndoHistoryEntry(
        history,
        [graceProfile],
        createSwipeDeckUndoKeyIndex([graceProfile], getProfileKey),
      ),
    ).toBeNull();
  });

  it('updates restored index when items are inserted before the history entry', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'grace', index: 1, direction: 'left' },
    ];

    expect(
      resolveLatestSwipeDeckUndoHistoryEntry(
        history,
        [linusProfile, adaProfile, graceProfile],
        createSwipeDeckUndoKeyIndex([linusProfile, adaProfile, graceProfile], getProfileKey),
      ),
    ).toMatchObject({
      index: 2,
      item: graceProfile,
    });
  });

  it('resolves an undo restore target by current key index', () => {
    const data = [graceProfile, adaProfile];

    expect(
      resolveSwipeDeckUndoRestoreTarget({
        data,
        getKey: getProfileKey,
        key: 'ada',
        keyIndex: createSwipeDeckUndoKeyIndex(data, getProfileKey),
      }),
    ).toEqual({
      index: 1,
      item: adaProfile,
    });
  });

  it('returns null when the restore target key is missing', () => {
    const data = [adaProfile];

    expect(
      resolveSwipeDeckUndoRestoreTarget({
        data,
        getKey: getProfileKey,
        key: 'missing',
        keyIndex: createSwipeDeckUndoKeyIndex(data, getProfileKey),
      }),
    ).toBeNull();
  });

  it('returns null when a stale key index points to a different current item key', () => {
    expect(
      resolveSwipeDeckUndoRestoreTarget({
        data: [graceProfile],
        getKey: getProfileKey,
        key: 'ada',
        keyIndex: new Map([['ada', 0]]),
      }),
    ).toBeNull();
  });

  it('resolves an empty string restore target key', () => {
    const emptyKeyProfile = { id: '', name: 'Empty' };
    const data = [emptyKeyProfile];

    expect(
      resolveSwipeDeckUndoRestoreTarget({
        data,
        getKey: getProfileKey,
        key: '',
        keyIndex: createSwipeDeckUndoKeyIndex(data, getProfileKey),
      }),
    ).toEqual({
      index: 0,
      item: emptyKeyProfile,
    });
  });

  it('prunes missing entries and preserves valid ones', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'ada', index: 0, direction: 'right' },
      { token: 2, key: 'missing', index: 1, direction: 'left' },
    ];

    expect(
      pruneSwipeDeckUndoHistory(history, createSwipeDeckUndoKeyIndex([adaProfile], getProfileKey)),
    ).toEqual([{ token: 1, key: 'ada', index: 0, direction: 'right' }]);
  });

  it('removes the accepted undo entry by stable token', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'ada', index: 0, direction: 'right' },
      { token: 2, key: 'grace', index: 1, direction: 'left' },
      { token: 3, key: 'ada', index: 0, direction: 'right' },
    ];

    expect(removeSwipeDeckUndoHistoryEntryByToken(history, 3)).toEqual([
      { token: 1, key: 'ada', index: 0, direction: 'right' },
      { token: 2, key: 'grace', index: 1, direction: 'left' },
    ]);
  });

  it('appends entries as a LIFO history', () => {
    const history: SwipeDeckUndoHistoryEntry[] = [
      { token: 1, key: 'ada', index: 0, direction: 'right' },
      { token: 2, key: 'grace', index: 1, direction: 'left' },
    ];

    expect(
      appendSwipeDeckUndoHistoryEntry(history, {
        token: 3,
        key: 'linus',
        index: 2,
        direction: 'right',
      }),
    ).toEqual([
      { token: 1, key: 'ada', index: 0, direction: 'right' },
      { token: 2, key: 'grace', index: 1, direction: 'left' },
      { token: 3, key: 'linus', index: 2, direction: 'right' },
    ]);
  });

  it('checks whether any valid undo entry remains', () => {
    expect(
      hasValidSwipeDeckUndoHistoryEntry(
        [{ token: 1, key: 'missing', index: 0, direction: 'right' }],
        createSwipeDeckUndoKeyIndex([adaProfile], getProfileKey),
      ),
    ).toBe(false);
    expect(
      hasValidSwipeDeckUndoHistoryEntry(
        [{ token: 1, key: 'ada', index: 0, direction: 'right' }],
        createSwipeDeckUndoKeyIndex([adaProfile], getProfileKey),
      ),
    ).toBe(true);
  });
});

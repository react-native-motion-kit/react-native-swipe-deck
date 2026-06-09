import type { SwipeDirection } from './types';

export type SwipeDeckUndoHistoryEntry = {
  token: number;
  key: string;
  index: number;
  direction: SwipeDirection;
};

export type ResolvedSwipeDeckUndoHistoryEntry<T> = {
  entry: SwipeDeckUndoHistoryEntry;
  historyIndex: number;
  index: number;
  item: T;
};

export type SwipeDeckUndoKeyIndex = ReadonlyMap<string, number>;

type CreateSwipeDeckUndoHistoryEntryArgs<T> = {
  token: number;
  item: T;
  index: number;
  direction: SwipeDirection;
  getKey: (item: T, index: number) => string;
};

type ResolveSwipeDeckUndoRestoreTargetArgs<T> = {
  data: readonly T[];
  getKey: (item: T, index: number) => string;
  key: string;
  keyIndex: SwipeDeckUndoKeyIndex;
};

type SwipeDeckUndoRestoreTarget<T> = {
  index: number;
  item: T;
};

export function createSwipeDeckUndoHistoryEntry<T>({
  token,
  item,
  index,
  direction,
  getKey,
}: CreateSwipeDeckUndoHistoryEntryArgs<T>): SwipeDeckUndoHistoryEntry {
  return {
    token,
    key: getKey(item, index),
    index,
    direction,
  };
}

export function createSwipeDeckUndoKeyIndex<T>(
  data: readonly T[],
  getKey: (item: T, index: number) => string,
): SwipeDeckUndoKeyIndex {
  const keyIndex = new Map<string, number>();

  data.forEach((item, index) => {
    const key = getKey(item, index);

    if (!keyIndex.has(key)) {
      keyIndex.set(key, index);
    }
  });

  return keyIndex;
}

function findItemIndexByKey(key: string, keyIndex: SwipeDeckUndoKeyIndex): number {
  return keyIndex.get(key) ?? -1;
}

export function resolveSwipeDeckUndoRestoreTarget<T>({
  data,
  getKey,
  key,
  keyIndex,
}: ResolveSwipeDeckUndoRestoreTargetArgs<T>): SwipeDeckUndoRestoreTarget<T> | null {
  const index = findItemIndexByKey(key, keyIndex);
  const item = index >= 0 ? data[index] : undefined;

  if (item === undefined) {
    return null;
  }

  if (getKey(item, index) !== key) {
    return null;
  }

  return { index, item };
}

export function resolveLatestSwipeDeckUndoHistoryEntry<T>(
  history: readonly SwipeDeckUndoHistoryEntry[],
  data: readonly T[],
  keyIndex: SwipeDeckUndoKeyIndex,
): ResolvedSwipeDeckUndoHistoryEntry<T> | null {
  for (let historyIndex = history.length - 1; historyIndex >= 0; historyIndex -= 1) {
    const entry = history[historyIndex];

    if (!entry) {
      continue;
    }

    const index = findItemIndexByKey(entry.key, keyIndex);

    if (index >= 0) {
      return {
        entry,
        historyIndex,
        index,
        item: data[index] as T,
      };
    }
  }

  return null;
}

function removeSwipeDeckUndoHistoryEntry(
  history: readonly SwipeDeckUndoHistoryEntry[],
  historyIndex: number,
): SwipeDeckUndoHistoryEntry[] {
  return history.filter((_, index) => index !== historyIndex);
}

export function appendSwipeDeckUndoHistoryEntry(
  history: readonly SwipeDeckUndoHistoryEntry[],
  entry: SwipeDeckUndoHistoryEntry,
): SwipeDeckUndoHistoryEntry[] {
  return [...history, entry];
}

export function removeSwipeDeckUndoHistoryEntryByToken(
  history: readonly SwipeDeckUndoHistoryEntry[],
  token: number,
): SwipeDeckUndoHistoryEntry[] {
  const removeIndex = history.findIndex((entry) => entry.token === token);

  if (removeIndex < 0) {
    return [...history];
  }

  return removeSwipeDeckUndoHistoryEntry(history, removeIndex);
}

export function pruneSwipeDeckUndoHistory(
  history: readonly SwipeDeckUndoHistoryEntry[],
  keyIndex: SwipeDeckUndoKeyIndex,
): SwipeDeckUndoHistoryEntry[] {
  return history.filter((entry) => findItemIndexByKey(entry.key, keyIndex) >= 0);
}

export function hasValidSwipeDeckUndoHistoryEntry(
  history: readonly SwipeDeckUndoHistoryEntry[],
  keyIndex: SwipeDeckUndoKeyIndex,
): boolean {
  for (let historyIndex = history.length - 1; historyIndex >= 0; historyIndex -= 1) {
    const entry = history[historyIndex];

    if (!entry) {
      continue;
    }

    if (findItemIndexByKey(entry.key, keyIndex) >= 0) {
      return true;
    }
  }

  return false;
}

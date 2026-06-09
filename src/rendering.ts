import type { SwipeRenderInfo } from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { clampActiveIndex, getSwipeWindow, normalizeVisibleCardCount } from './windowing';

export type SwipeRenderTransition = {
  fromOffset: number;
  toOffset: number;
};

export type SwipeRenderItem<T> = SwipeRenderInfo<T> & {
  descriptor: SwipeWindowDescriptor;
  itemKey: string;
  transition?: SwipeRenderTransition;
};

type GetSwipeDeckStackRenderItemsArgs<T> = {
  data: readonly T[];
  activeIndex: number;
  getKey: (item: T, index: number) => string;
  undoIndex?: number;
  undoKey?: string;
  visibleCardCount?: number;
};

type GetSwipeUndoRenderItemsArgs<T> = {
  data: readonly T[];
  currentIndex: number;
  getKey: (item: T, index: number) => string;
  restoredIndex: number;
  visibleCardCount?: number;
};

function getSwipeRole(offset: number) {
  return offset === 0 ? 'current' : 'next';
}

function createSwipeWindowDescriptor(index: number, offset: number): SwipeWindowDescriptor {
  return {
    index,
    offset,
    role: getSwipeRole(offset),
    isActive: offset === 0,
  };
}

function createSwipeRenderItem<T>({
  data,
  descriptor,
  getKey,
  transition,
}: {
  data: readonly T[];
  descriptor: SwipeWindowDescriptor;
  getKey: (item: T, index: number) => string;
  transition?: SwipeRenderTransition;
}): SwipeRenderItem<T> {
  const item = data[descriptor.index] as T;

  return {
    descriptor,
    itemKey: getKey(item, descriptor.index),
    item,
    index: descriptor.index,
    offset: descriptor.offset,
    role: descriptor.role,
    isActive: descriptor.isActive,
    transition,
  };
}

function getForwardDescriptors({
  dataLength,
  startIndex,
  count,
  excludedIndex,
}: {
  dataLength: number;
  startIndex: number;
  count: number;
  excludedIndex?: number;
}): SwipeWindowDescriptor[] {
  if (count <= 0 || dataLength <= 0 || startIndex >= dataLength) {
    return [];
  }

  const descriptors: SwipeWindowDescriptor[] = [];
  const currentIndex = clampActiveIndex(dataLength, startIndex);

  for (let index = currentIndex; index < dataLength && descriptors.length < count; index += 1) {
    if (index === excludedIndex) {
      continue;
    }

    descriptors.push(createSwipeWindowDescriptor(index, index - currentIndex));
  }

  return descriptors;
}

export function getSwipeRenderItems<T>(
  data: readonly T[],
  activeIndex: number,
  getKey: (item: T, index: number) => string,
  visibleCardCount?: number,
): SwipeRenderItem<T>[] {
  return getSwipeWindow(data.length, activeIndex, visibleCardCount).map((descriptor) =>
    createSwipeRenderItem({ data, descriptor, getKey }),
  );
}

export function getSwipeUndoRenderItems<T>({
  data,
  currentIndex,
  getKey,
  restoredIndex,
  visibleCardCount,
}: GetSwipeUndoRenderItemsArgs<T>): SwipeRenderItem<T>[] {
  if (data.length <= 0 || restoredIndex < 0 || restoredIndex >= data.length) {
    return [];
  }

  const renderCount = normalizeVisibleCardCount(visibleCardCount);
  const restoredDescriptor = createSwipeWindowDescriptor(restoredIndex, 0);
  const oldStackDescriptors = getForwardDescriptors({
    dataLength: data.length,
    startIndex: currentIndex,
    count: renderCount - 1,
    excludedIndex: restoredIndex,
  });
  const restoredItem = createSwipeRenderItem({
    data,
    descriptor: restoredDescriptor,
    getKey,
  });
  const oldStackItems = oldStackDescriptors.map((descriptor, targetOffsetIndex) => {
    const targetOffset = targetOffsetIndex + 1;
    const targetDescriptor = createSwipeWindowDescriptor(descriptor.index, targetOffset);

    return createSwipeRenderItem({
      data,
      descriptor: targetDescriptor,
      getKey,
      transition: {
        fromOffset: descriptor.offset,
        toOffset: targetOffset,
      },
    });
  });

  return [restoredItem, ...oldStackItems];
}

export function getSwipeStackRenderItems<T>(renderItems: readonly T[]): T[] {
  return [...renderItems].reverse();
}

function resolveUndoRestoredIndex<T>({
  data,
  getKey,
  undoIndex,
  undoKey,
}: {
  data: readonly T[];
  getKey: (item: T, index: number) => string;
  undoIndex?: number;
  undoKey?: string;
}): number {
  if (undoKey === undefined) {
    return -1;
  }

  if (undoIndex !== undefined) {
    const indexedItem = data[undoIndex];

    if (indexedItem !== undefined && getKey(indexedItem, undoIndex) === undoKey) {
      return undoIndex;
    }
  }

  return data.findIndex((item, index) => getKey(item, index) === undoKey);
}

export function getSwipeDeckStackRenderItems<T>({
  data,
  activeIndex,
  getKey,
  undoIndex,
  undoKey,
  visibleCardCount,
}: GetSwipeDeckStackRenderItemsArgs<T>): SwipeRenderItem<T>[] {
  const restoredIndex = resolveUndoRestoredIndex({ data, getKey, undoIndex, undoKey });
  const renderItems =
    restoredIndex >= 0
      ? getSwipeUndoRenderItems({
          data,
          currentIndex: activeIndex,
          getKey,
          restoredIndex,
          visibleCardCount,
        })
      : getSwipeRenderItems(data, activeIndex, getKey, visibleCardCount);

  return getSwipeStackRenderItems(renderItems);
}

import type { SwipeRole } from './types';

export type SwipeWindowDescriptor = {
  index: number;
  offset: number;
  role: SwipeRole;
  isActive: boolean;
};

const DEFAULT_VISIBLE_CARD_COUNT = 5;
const MIN_VISIBLE_CARD_COUNT = 5;

export function clampActiveIndex(dataLength: number, activeIndex: number): number {
  if (dataLength <= 0) {
    return 0;
  }

  if (activeIndex < 0) {
    return 0;
  }

  if (activeIndex >= dataLength) {
    return dataLength;
  }

  return activeIndex;
}

export function normalizeVisibleCardCount(visibleCardCount?: number): number {
  if (!Number.isFinite(visibleCardCount)) {
    return DEFAULT_VISIBLE_CARD_COUNT;
  }

  return Math.max(MIN_VISIBLE_CARD_COUNT, Math.floor(visibleCardCount as number));
}

function getSwipeRole(offset: number): SwipeRole {
  return offset === 0 ? 'current' : offset < 0 ? 'previous' : 'next';
}

export function getSwipeWindow(
  dataLength: number,
  activeIndex: number,
  visibleCardCount?: number,
): SwipeWindowDescriptor[] {
  if (dataLength <= 0 || activeIndex >= dataLength) {
    return [];
  }

  const currentIndex = clampActiveIndex(dataLength, activeIndex);

  if (currentIndex >= dataLength) {
    return [];
  }

  const renderCount = Math.min(dataLength, normalizeVisibleCardCount(visibleCardCount));
  const previousCount = Math.floor((renderCount - 1) / 2);
  const desiredStartIndex = currentIndex - previousCount;
  const startIndex = Math.max(0, Math.min(desiredStartIndex, dataLength - renderCount));

  return Array.from({ length: renderCount }, (_, itemOffset) => {
    const index = startIndex + itemOffset;
    const offset = index - currentIndex;

    return {
      index,
      offset,
      role: getSwipeRole(offset),
      isActive: offset === 0,
    };
  });
}

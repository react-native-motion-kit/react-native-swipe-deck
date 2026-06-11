import type { SwipeRole } from '../types';

export type SwipeWindowDescriptor = {
  index: number;
  offset: number;
  role: SwipeRole;
  isActive: boolean;
};

const DEFAULT_VISIBLE_CARD_COUNT = 3;
const MIN_VISIBLE_CARD_COUNT = 2;

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
  return offset === 0 ? 'current' : 'next';
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

  const remainingCount = dataLength - currentIndex;
  const renderCount = Math.min(remainingCount, normalizeVisibleCardCount(visibleCardCount));

  return Array.from({ length: renderCount }, (_, offset) => {
    const index = currentIndex + offset;

    return {
      index,
      offset,
      role: getSwipeRole(offset),
      isActive: offset === 0,
    };
  });
}

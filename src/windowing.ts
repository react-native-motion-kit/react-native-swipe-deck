import type { SwipeRole } from './types';

export type SwipeWindowDescriptor = {
  index: number;
  role: SwipeRole;
  isActive: boolean;
};

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

export function getSwipeWindow(dataLength: number, activeIndex: number): SwipeWindowDescriptor[] {
  if (dataLength <= 0 || activeIndex >= dataLength) {
    return [];
  }

  const currentIndex = clampActiveIndex(dataLength, activeIndex);

  if (currentIndex >= dataLength) {
    return [];
  }

  if (currentIndex === 0) {
    return dataLength === 1
      ? [{ index: currentIndex, role: 'current', isActive: true }]
      : [
          { index: currentIndex, role: 'current', isActive: true },
          { index: currentIndex + 1, role: 'next', isActive: false },
        ];
  }

  if (currentIndex === dataLength - 1) {
    return [
      { index: currentIndex - 1, role: 'previous', isActive: false },
      { index: currentIndex, role: 'current', isActive: true },
    ];
  }

  return [
    { index: currentIndex - 1, role: 'previous', isActive: false },
    { index: currentIndex, role: 'current', isActive: true },
    { index: currentIndex + 1, role: 'next', isActive: false },
  ];
}

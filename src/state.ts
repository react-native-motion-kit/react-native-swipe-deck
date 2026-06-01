export type SwipeCommit = {
  swipedIndex: number;
  nextIndex: number;
  isCompleted: boolean;
  shouldEmitEndReached: boolean;
};

export function getSwipeCommit(
  dataLength: number,
  activeIndex: number,
  endReached: boolean,
): SwipeCommit | null {
  if (dataLength <= 0 || activeIndex < 0 || activeIndex >= dataLength) {
    return null;
  }

  const nextIndex = activeIndex + 1;
  const isCompleted = nextIndex >= dataLength;

  return {
    swipedIndex: activeIndex,
    nextIndex,
    isCompleted,
    shouldEmitEndReached: isCompleted && !endReached,
  };
}

export function shouldResetEndReached(activeIndex: number, dataLength: number): boolean {
  return activeIndex < dataLength;
}

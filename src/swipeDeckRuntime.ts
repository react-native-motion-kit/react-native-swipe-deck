export function resolveProgressDirection(translationX: number): -1 | 0 | 1 {
  'worklet';

  if (translationX < 0) {
    return -1;
  }

  if (translationX > 0) {
    return 1;
  }

  return 0;
}

export function resolveSignedSwipeProgress(translationX: number, distance: number): number {
  'worklet';

  const direction = resolveProgressDirection(translationX);

  return direction * Math.min(Math.abs(translationX) / Math.max(distance, 1), 1);
}

export function getActiveRenderItemId(dataLength: number, activeIndex: number): number {
  if (activeIndex < 0 || activeIndex >= dataLength) {
    return -1;
  }

  return activeIndex;
}

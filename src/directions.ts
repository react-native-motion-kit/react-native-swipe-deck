import type { SwipeDeckLayout, SwipeDirection } from './types';

type ResolveSwipeDirectionArgs = {
  translationX: number;
  velocityX: number;
  disabled?: boolean;
  layout?: SwipeDeckLayout;
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  velocityThreshold?: number;
};

export function resolveSwipeDirection({
  translationX,
  velocityX,
  disabled = false,
  layout,
  swipeThreshold,
  velocityThreshold,
}: ResolveSwipeDirectionArgs): SwipeDirection | null {
  'worklet';

  if (disabled) {
    return null;
  }

  const resolvedLayout = layout ?? { width: 0, height: 0 };
  const resolvedVelocityThreshold = velocityThreshold ?? 800;
  const resolvedSwipeThreshold =
    typeof swipeThreshold === 'function' ? swipeThreshold(resolvedLayout) : (swipeThreshold ?? 120);

  if (velocityX >= resolvedVelocityThreshold || translationX >= resolvedSwipeThreshold) {
    return 'right';
  }

  if (velocityX <= -resolvedVelocityThreshold || translationX <= -resolvedSwipeThreshold) {
    return 'left';
  }

  return null;
}

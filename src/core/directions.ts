import type { SwipeDeckLayout, SwipeDirection } from '../types';

export type SwipeDeckDirectionPolicy = {
  left: boolean;
  right: boolean;
};

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

export function createSwipeDeckDirectionPolicy(
  allowedDirections?: readonly SwipeDirection[],
): SwipeDeckDirectionPolicy {
  if (allowedDirections === undefined) {
    return { left: true, right: true };
  }

  return {
    left: allowedDirections.includes('left'),
    right: allowedDirections.includes('right'),
  };
}

export function hasAllowedSwipeDirection(policy: SwipeDeckDirectionPolicy): boolean {
  'worklet';

  return policy.left || policy.right;
}

export function isSwipeDirectionAllowed(
  direction: SwipeDirection,
  policy: SwipeDeckDirectionPolicy,
): boolean {
  'worklet';

  return direction === 'left' ? policy.left : policy.right;
}

export function resolveAllowedSwipeDirection(
  direction: SwipeDirection | null,
  policy: SwipeDeckDirectionPolicy,
): SwipeDirection | null {
  'worklet';

  if (!direction) {
    return null;
  }

  return isSwipeDirectionAllowed(direction, policy) ? direction : null;
}

import type { SwipeDeckLayout, SwipeDeckTinderDragMode, SwipeDirection } from '../types';

type HorizontalSwipeDirection = Extract<SwipeDirection, 'left' | 'right'>;

export type SwipeDeckDirectionPolicy = {
  left: boolean;
  right: boolean;
  up: boolean;
};

type ResolveSwipeDirectionArgs = {
  translationX: number;
  translationY?: number;
  velocityX: number;
  velocityY?: number;
  directionPolicy?: SwipeDeckDirectionPolicy;
  disabled?: boolean;
  dragMode?: SwipeDeckTinderDragMode;
  layout?: SwipeDeckLayout;
  swipeThreshold?: number | ((layout: SwipeDeckLayout) => number);
  velocityThreshold?: number;
};

type ResolveSwipeIntentWinnerArgs = {
  horizontalDirection: HorizontalSwipeDirection | null;
  horizontalQualified: boolean;
  horizontalScore: number;
  upwardQualified: boolean;
  upwardScore: number;
};

const DEFAULT_DIRECTION_POLICY: SwipeDeckDirectionPolicy = {
  left: true,
  right: true,
  up: false,
};

function resolveHorizontalSwipeDirection({
  translationX,
  velocityX,
  swipeThreshold,
  velocityThreshold,
}: {
  translationX: number;
  velocityX: number;
  swipeThreshold: number;
  velocityThreshold: number;
}): HorizontalSwipeDirection | null {
  'worklet';

  if (velocityX >= velocityThreshold || translationX >= swipeThreshold) {
    return 'right';
  }

  if (velocityX <= -velocityThreshold || translationX <= -swipeThreshold) {
    return 'left';
  }

  return null;
}

export function resolveSwipeIntentWinner({
  horizontalDirection,
  horizontalQualified,
  horizontalScore,
  upwardQualified,
  upwardScore,
}: ResolveSwipeIntentWinnerArgs): SwipeDirection | null {
  'worklet';

  if (upwardQualified && upwardScore > horizontalScore * 1.5) {
    return 'up';
  }

  if (horizontalQualified) {
    return horizontalDirection;
  }

  return null;
}

// Worklets capture module-scope dependencies during initialization, so these helpers must be
// initialized before worklets that reference them.
export function isSwipeDirectionAllowed(
  direction: SwipeDirection,
  policy: SwipeDeckDirectionPolicy,
): boolean {
  'worklet';

  if (direction === 'left') {
    return policy.left;
  }

  if (direction === 'right') {
    return policy.right;
  }

  return policy.up;
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

export function resolveSwipeDirection({
  translationX,
  translationY = 0,
  velocityX,
  velocityY = 0,
  directionPolicy,
  disabled = false,
  dragMode = 'free',
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

  const policy = directionPolicy ?? DEFAULT_DIRECTION_POLICY;
  const horizontalDirection = resolveHorizontalSwipeDirection({
    translationX,
    velocityX,
    swipeThreshold: resolvedSwipeThreshold,
    velocityThreshold: resolvedVelocityThreshold,
  });
  const canResolveUp = policy.up === true && dragMode === 'free';
  const upwardDistance = Math.max(-translationY, 0);
  const upwardVelocity = Math.max(-velocityY, 0);
  const hasUpwardDirection =
    canResolveUp &&
    (upwardDistance >= resolvedSwipeThreshold || upwardVelocity >= resolvedVelocityThreshold);
  const normalizedSwipeThreshold = Math.max(resolvedSwipeThreshold, 1);
  const normalizedVelocityThreshold = Math.max(resolvedVelocityThreshold, 1);

  const horizontalScore = Math.max(
    Math.abs(translationX) / normalizedSwipeThreshold,
    Math.abs(velocityX) / normalizedVelocityThreshold,
  );
  const upwardScore = Math.max(
    upwardDistance / normalizedSwipeThreshold,
    upwardVelocity / normalizedVelocityThreshold,
  );
  const rawWinner = resolveSwipeIntentWinner({
    horizontalDirection,
    horizontalQualified: horizontalDirection !== null,
    horizontalScore,
    upwardQualified: hasUpwardDirection,
    upwardScore,
  });

  return resolveAllowedSwipeDirection(rawWinner, policy);
}

export function createSwipeDeckDirectionPolicy(
  allowedDirections?: readonly SwipeDirection[],
): SwipeDeckDirectionPolicy {
  if (allowedDirections === undefined) {
    return { left: true, right: true, up: false };
  }

  return {
    left: allowedDirections.includes('left'),
    right: allowedDirections.includes('right'),
    up: allowedDirections.includes('up'),
  };
}

export function hasAllowedSwipeDirection(policy: SwipeDeckDirectionPolicy): boolean {
  'worklet';

  return policy.left || policy.right || policy.up;
}

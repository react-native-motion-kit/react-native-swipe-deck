import type { SwipeDirection } from '../types';

export type SwipeDeckMotionAxis = 'x' | 'y';

export type SwipeDeckMotionTranslation = {
  translateX: number;
  translateY: number;
};

export type SwipeDeckMotionVector = SwipeDeckMotionTranslation & {
  axis: SwipeDeckMotionAxis;
};

export function resolveSwipeDeckDirectionTranslation({
  direction,
  distance,
  crossAxisTranslation = 0,
}: {
  direction: SwipeDirection;
  distance: number;
  crossAxisTranslation?: number;
}): SwipeDeckMotionVector {
  'worklet';

  if (direction === 'up') {
    return {
      translateX: crossAxisTranslation,
      translateY: -distance,
      axis: 'y',
    };
  }

  return {
    translateX: direction === 'right' ? distance : -distance,
    translateY: crossAxisTranslation,
    axis: 'x',
  };
}

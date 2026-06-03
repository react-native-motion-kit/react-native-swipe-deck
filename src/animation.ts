import type {
  ResolvedSwipeDeckAnimationConfig,
  SwipeDeckAnimationConfig,
  SwipeDeckLayout,
} from './types';

export function resolveSwipeDeckAnimationConfig(
  animationConfig: SwipeDeckAnimationConfig | undefined,
  layout: SwipeDeckLayout,
): ResolvedSwipeDeckAnimationConfig {
  const swipeProgressDistance = animationConfig?.swipeProgressDistance;
  const resolvedSwipeProgressDistance =
    typeof swipeProgressDistance === 'function'
      ? swipeProgressDistance(layout)
      : (swipeProgressDistance ?? Math.max(layout.width * 0.35, 120));

  return {
    nextScale: animationConfig?.nextScale ?? 0.95,
    nextOpacity: animationConfig?.nextOpacity ?? 1,
    nextTranslateY: animationConfig?.nextTranslateY ?? 12,
    swipeProgressDistance: resolvedSwipeProgressDistance,
  };
}

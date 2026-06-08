import type {
  SwipeDeckActionDirectMotionRecipe,
  SwipeDeckActionDirectMotionOptions,
  SwipeDeckActionMotionRecipe,
  SwipeDeckActionSpringboardMotionRecipe,
  SwipeDeckActionSpringboardMotionOptions,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
} from './types';

const ACTION_MOTION_KIND = 'swipe-deck-action-motion';
const DEFAULT_ANTICIPATION_DURATION = 80;

type SwipeDeckActionMotionFallback = {
  dismissDuration?: number;
  dismissEasing: SwipeDeckMotionEasing;
  offscreenMultiplier: number;
};

type InternalSwipeDeckActionDirectMotion = {
  type: 'direct';
  dismissDuration?: number;
  dismissEasing: SwipeDeckMotionEasing;
  offscreenMultiplier: number;
};

type InternalSwipeDeckActionSpringboardMotion = {
  type: 'springboard';
  anticipationDistance: number;
  anticipationDuration: number;
  anticipationEasing: SwipeDeckMotionEasing;
  dismissDuration?: number;
  dismissEasing: SwipeDeckMotionEasing;
  offscreenMultiplier: number;
};

type InternalSwipeDeckActionMotion =
  | InternalSwipeDeckActionDirectMotion
  | InternalSwipeDeckActionSpringboardMotion;

type ResolveSwipeDeckActionMotionArgs = {
  fallback: SwipeDeckActionMotionFallback;
  layout: SwipeDeckLayout;
  recipe?: SwipeDeckActionMotionRecipe;
};

type ResolveSwipeDeckActionMotionRecipeArgs = {
  defaultActionMotion?: SwipeDeckActionMotionRecipe;
  rootActionMotion?: SwipeDeckActionMotionRecipe;
  actionMotion?: SwipeDeckActionMotionRecipe;
};

function resolveLayoutValue(
  value: number | ((layout: SwipeDeckLayout) => number) | undefined,
  layout: SwipeDeckLayout,
  fallback: number,
): number {
  if (typeof value === 'function') {
    return value(layout);
  }

  return value ?? fallback;
}

function createDirectActionMotion(
  options: SwipeDeckActionDirectMotionOptions = {},
): SwipeDeckActionDirectMotionRecipe {
  return {
    ...options,
    kind: ACTION_MOTION_KIND,
    type: 'direct',
  };
}

function createSpringboardActionMotion(
  options: SwipeDeckActionSpringboardMotionOptions = {},
): SwipeDeckActionSpringboardMotionRecipe {
  return {
    ...options,
    kind: ACTION_MOTION_KIND,
    type: 'springboard',
  };
}

export const SwipeDeckActionMotion = {
  direct: createDirectActionMotion,
  springboard: createSpringboardActionMotion,
};

export function isSwipeDeckActionMotionRecipe(
  value: unknown,
): value is SwipeDeckActionMotionRecipe {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SwipeDeckActionMotionRecipe>;

  return (
    candidate.kind === ACTION_MOTION_KIND &&
    (candidate.type === 'direct' || candidate.type === 'springboard')
  );
}

export function resolveSwipeDeckActionMotionRecipe({
  defaultActionMotion,
  rootActionMotion,
  actionMotion,
}: ResolveSwipeDeckActionMotionRecipeArgs): SwipeDeckActionMotionRecipe | undefined {
  return actionMotion ?? rootActionMotion ?? defaultActionMotion;
}

export function resolveSwipeDeckActionMotion({
  fallback,
  layout,
  recipe = SwipeDeckActionMotion.direct(),
}: ResolveSwipeDeckActionMotionArgs): InternalSwipeDeckActionMotion {
  if (recipe.type === 'springboard') {
    const dismissEasing = recipe.dismissEasing ?? fallback.dismissEasing;

    return {
      type: 'springboard',
      anticipationDistance: resolveLayoutValue(
        recipe.anticipationDistance,
        layout,
        layout.width * 0.04,
      ),
      anticipationDuration: recipe.anticipationDuration ?? DEFAULT_ANTICIPATION_DURATION,
      anticipationEasing: recipe.anticipationEasing ?? dismissEasing,
      dismissDuration: recipe.dismissDuration ?? fallback.dismissDuration,
      dismissEasing,
      offscreenMultiplier: recipe.offscreenMultiplier ?? fallback.offscreenMultiplier,
    };
  }

  return {
    type: 'direct',
    dismissDuration: recipe.duration ?? fallback.dismissDuration,
    dismissEasing: recipe.easing ?? fallback.dismissEasing,
    offscreenMultiplier: recipe.offscreenMultiplier ?? fallback.offscreenMultiplier,
  };
}

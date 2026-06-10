import { Easing, type WithSpringConfig } from 'react-native-reanimated';

import type {
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckUndoMotionFrom,
  SwipeDeckUndoMotionRecipe,
  SwipeDeckUndoSpringMotionOptions,
  SwipeDeckUndoSpringMotionRecipe,
  SwipeDeckUndoTimingMotionOptions,
  SwipeDeckUndoTimingMotionRecipe,
  SwipeDirection,
} from '../types';

const UNDO_MOTION_KIND = 'swipe-deck-undo-motion';
const DEFAULT_UNDO_TIMING_DURATION = 0;
const DEFAULT_UNDO_TIMING_EASING: SwipeDeckMotionEasing = Easing.out(Easing.cubic);
const DEFAULT_UNDO_SPRING_CONFIG: WithSpringConfig = {
  damping: 36,
  stiffness: 300,
  mass: 3,
};

type ResolvedSwipeDeckUndoSpringMotion = {
  type: 'spring';
  from: {
    translateX: number;
  };
  springConfig: NonNullable<SwipeDeckUndoSpringMotionOptions['springConfig']>;
};

type ResolvedSwipeDeckUndoTimingMotion = {
  type: 'timing';
  from: {
    translateX: number;
  };
  duration: number;
  easing: SwipeDeckMotionEasing;
};

export type ResolvedSwipeDeckUndoMotion =
  | ResolvedSwipeDeckUndoSpringMotion
  | ResolvedSwipeDeckUndoTimingMotion;

type ResolveSwipeDeckUndoMotionRecipeArgs = {
  defaultUndoMotion?: SwipeDeckUndoMotionRecipe;
  rootUndoMotion?: SwipeDeckUndoMotionRecipe;
  undoMotion?: SwipeDeckUndoMotionRecipe;
};

type ResolveSwipeDeckUndoMotionArgs = {
  defaultEntryDistance: number;
  layout: SwipeDeckLayout;
  originalDirection: SwipeDirection;
  recipe?: SwipeDeckUndoMotionRecipe;
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

function getUndoMotionFromSide(
  from: SwipeDeckUndoMotionFrom | undefined,
  originalDirection: SwipeDirection,
): SwipeDirection {
  if (!from || from === 'auto') {
    return originalDirection;
  }

  return from;
}

function createSpringUndoMotion(
  options: SwipeDeckUndoSpringMotionOptions = {},
): SwipeDeckUndoSpringMotionRecipe {
  return {
    ...options,
    kind: UNDO_MOTION_KIND,
    type: 'spring',
  };
}

function createTimingUndoMotion(
  options: SwipeDeckUndoTimingMotionOptions = {},
): SwipeDeckUndoTimingMotionRecipe {
  return {
    ...options,
    kind: UNDO_MOTION_KIND,
    type: 'timing',
  };
}

export const SwipeDeckUndoMotion = {
  spring: createSpringUndoMotion,
  timing: createTimingUndoMotion,
};

export function isSwipeDeckUndoMotionRecipe(value: unknown): value is SwipeDeckUndoMotionRecipe {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SwipeDeckUndoMotionRecipe>;

  return (
    candidate.kind === UNDO_MOTION_KIND &&
    (candidate.type === 'spring' || candidate.type === 'timing')
  );
}

export function resolveSwipeDeckUndoMotionRecipe({
  defaultUndoMotion,
  rootUndoMotion,
  undoMotion,
}: ResolveSwipeDeckUndoMotionRecipeArgs): SwipeDeckUndoMotionRecipe | undefined {
  return undoMotion ?? rootUndoMotion ?? defaultUndoMotion;
}

export function resolveSwipeDeckUndoMotion({
  defaultEntryDistance,
  layout,
  originalDirection,
  recipe = SwipeDeckUndoMotion.timing(),
}: ResolveSwipeDeckUndoMotionArgs): ResolvedSwipeDeckUndoMotion {
  const fromSide = getUndoMotionFromSide(recipe.from, originalDirection);
  const entryDistance = Math.max(
    resolveLayoutValue(recipe.entryDistance, layout, defaultEntryDistance),
    1,
  );
  const translateX = fromSide === 'right' ? entryDistance : -entryDistance;
  const from = { translateX };

  if (recipe.type === 'timing') {
    return {
      type: 'timing',
      from,
      duration: recipe.duration ?? DEFAULT_UNDO_TIMING_DURATION,
      easing: recipe.easing ?? DEFAULT_UNDO_TIMING_EASING,
    };
  }

  return {
    type: 'spring',
    from,
    springConfig: recipe.springConfig ?? DEFAULT_UNDO_SPRING_CONFIG,
  };
}

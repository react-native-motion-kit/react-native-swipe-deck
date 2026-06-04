import { Easing } from 'react-native-reanimated';

import type {
  ResolvedSwipeDeckMotionConfig,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckMotionPreset,
  SwipeDeckRotationOrigin,
  SwipeDeckTinderMotionConfig,
  SwipeDeckTinderMotionPreset,
} from './types';

const DEFAULT_DISMISS_MIN_DURATION = 120;
const DEFAULT_DISMISS_MAX_DURATION = 320;
const DEFAULT_CENTER_MAX_DEGREES = 20;
const DEFAULT_BOTTOM_CENTER_MAX_DEGREES = 18;
const DEFAULT_OFFSCREEN_MULTIPLIER = 1.5;
const DEFAULT_DISMISS_EASING: SwipeDeckMotionEasing = Easing.out(Easing.cubic);

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

function getDefaultMaxDegrees(origin: SwipeDeckRotationOrigin | undefined): number {
  if (origin === 'bottom-center') {
    return DEFAULT_BOTTOM_CENTER_MAX_DEGREES;
  }

  return DEFAULT_CENTER_MAX_DEGREES;
}

function resolveOffscreenMultiplier(offscreenMultiplier: number | undefined): number {
  return Math.max(offscreenMultiplier ?? DEFAULT_OFFSCREEN_MULTIPLIER, 1);
}

function resolveSwipeDeckDismissDestinationDistance(
  offscreenMultiplier: number | undefined,
  layout: SwipeDeckLayout,
): number {
  return Math.max(layout.width, 1) * resolveOffscreenMultiplier(offscreenMultiplier);
}

export function mergeSwipeDeckMotionConfig(
  base: SwipeDeckTinderMotionConfig | undefined,
  override: SwipeDeckTinderMotionConfig | undefined,
): SwipeDeckTinderMotionConfig | undefined {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    rotation: {
      ...base.rotation,
      ...override.rotation,
    },
    dismiss: {
      ...base.dismiss,
      ...override.dismiss,
    },
  };
}

function createTinderMotionConfig(
  overrides?: SwipeDeckTinderMotionConfig,
): SwipeDeckTinderMotionConfig {
  const base: SwipeDeckTinderMotionConfig = {
    nextScale: 0.95,
    nextOpacity: 1,
    nextTranslateY: 12,
    swipeProgressDistance: ({ width }) => Math.max(width * 0.35, 120),
    rotation: {
      origin: 'center',
      inputRange: ({ width }) => Math.max(width, 1),
    },
    liftYFactor: 0,
    dismiss: {
      offscreenMultiplier: DEFAULT_OFFSCREEN_MULTIPLIER,
      easing: DEFAULT_DISMISS_EASING,
      minDuration: DEFAULT_DISMISS_MIN_DURATION,
      maxDuration: DEFAULT_DISMISS_MAX_DURATION,
    },
  };

  return mergeSwipeDeckMotionConfig(base, overrides) ?? base;
}

function createTinderMotion(config?: SwipeDeckTinderMotionConfig): SwipeDeckTinderMotionPreset {
  return {
    type: 'tinder',
    config,
  };
}

export const SwipeDeckMotion = {
  tinder: createTinderMotion,
};

export function mergeSwipeDeckMotionPreset(
  base: SwipeDeckMotionPreset | undefined,
  override: SwipeDeckMotionPreset | undefined,
): SwipeDeckMotionPreset | undefined {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  if (base.type !== override.type) {
    return override;
  }

  return SwipeDeckMotion.tinder(mergeSwipeDeckMotionConfig(base.config, override.config));
}

function resolveTinderMotionConfig(
  motionConfig: SwipeDeckTinderMotionConfig | undefined,
  layout: SwipeDeckLayout,
): ResolvedSwipeDeckMotionConfig {
  const motion = createTinderMotionConfig(motionConfig);
  const dismiss = motion.dismiss ?? {};
  const rotation = motion.rotation ?? {};
  const dismissThreshold =
    typeof dismiss.threshold === 'function' ? dismiss.threshold(layout) : dismiss.threshold;
  const dismissDestinationDistance = resolveSwipeDeckDismissDestinationDistance(
    dismiss.offscreenMultiplier,
    layout,
  );

  return {
    nextScale: motion.nextScale ?? 0.95,
    nextOpacity: motion.nextOpacity ?? 1,
    nextTranslateY: motion.nextTranslateY ?? 12,
    swipeProgressDistance: resolveLayoutValue(
      motion.swipeProgressDistance,
      layout,
      Math.max(layout.width * 0.35, 120),
    ),
    rotation: {
      origin: rotation.origin ?? 'center',
      maxDegrees: rotation.maxDegrees ?? getDefaultMaxDegrees(rotation.origin),
      inputRange: resolveLayoutValue(rotation.inputRange, layout, Math.max(layout.width, 1)),
    },
    liftYFactor: motion.liftYFactor ?? 0,
    dismiss: {
      threshold: dismissThreshold,
      destinationDistance: dismissDestinationDistance,
      velocityThreshold: dismiss.velocityThreshold,
      duration: dismiss.duration,
      minDuration: dismiss.minDuration ?? DEFAULT_DISMISS_MIN_DURATION,
      maxDuration: dismiss.maxDuration ?? DEFAULT_DISMISS_MAX_DURATION,
      easing: dismiss.easing ?? DEFAULT_DISMISS_EASING,
    },
    cancelSpringConfig: motion.cancelSpringConfig,
  };
}

export function resolveSwipeDeckMotionConfig(
  motionPreset: SwipeDeckMotionPreset | undefined,
  layout: SwipeDeckLayout,
): ResolvedSwipeDeckMotionConfig {
  const preset = motionPreset ?? SwipeDeckMotion.tinder();

  return resolveTinderMotionConfig(preset.config, layout);
}

export type ResolveSwipeDeckDismissDurationArgs = {
  translationX: number;
  velocityX: number;
  destinationX: number;
  duration?: number;
  minDuration: number;
  maxDuration: number;
};

export function resolveSwipeDeckDismissDuration({
  translationX,
  velocityX,
  destinationX,
  duration,
  minDuration,
  maxDuration,
}: ResolveSwipeDeckDismissDurationArgs): number {
  'worklet';

  if (duration !== undefined) {
    return duration;
  }

  const remainingDistance = Math.abs(destinationX - translationX);
  const destinationDirection = destinationX >= translationX ? 1 : -1;
  const velocityTowardDestination = velocityX * destinationDirection;
  const velocity = Math.max(velocityTowardDestination, 1);
  const velocityDuration = (remainingDistance / velocity) * 1000;

  return Math.min(Math.max(velocityDuration, minDuration), maxDuration);
}

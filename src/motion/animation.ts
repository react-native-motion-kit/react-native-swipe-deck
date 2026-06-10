import { Easing } from 'react-native-reanimated';

import type {
  ResolvedSwipeDeckMotionConfig,
  SwipeDeckLayout,
  SwipeDeckMotionEasing,
  SwipeDeckMotionPreset,
  SwipeDeckTinderFixedRotationOrigin,
  SwipeDeckTinderRotationConfig,
  SwipeDirection,
  SwipeDeckTinderRotationDirection,
  SwipeDeckTinderRotationMode,
  SwipeDeckTinderDragMode,
  SwipeDeckTinderMotionConfig,
  SwipeDeckTinderMotionPreset,
} from '../types';

const DEFAULT_DISMISS_MIN_DURATION = 120;
const DEFAULT_DISMISS_MAX_DURATION = 320;
const DEFAULT_CENTER_MAX_DEGREES = 20;
const DEFAULT_EDGE_MAX_DEGREES = 18;
const DEFAULT_OFFSCREEN_MULTIPLIER = 1.5;
const DEFAULT_DRAG_MODE: SwipeDeckTinderDragMode = 'free';
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

function getDefaultMaxDegrees(
  origin: SwipeDeckTinderFixedRotationOrigin | 'grab-position',
): number {
  if (origin === 'center') {
    return DEFAULT_CENTER_MAX_DEGREES;
  }

  return DEFAULT_EDGE_MAX_DEGREES;
}

function resolveOffscreenMultiplier(offscreenMultiplier: number | undefined): number {
  'worklet';

  return Math.max(offscreenMultiplier ?? DEFAULT_OFFSCREEN_MULTIPLIER, 1);
}

function degreesToRadians(degrees: number): number {
  'worklet';

  return (degrees * Math.PI) / 180;
}

type SwipeDeckRotationBounds = {
  minX: number;
  maxX: number;
};

type SwipeDeckRotationPoint = {
  x: number;
  y: number;
};

type ResolveSwipeDeckTinderRotationAnchorArgs = {
  mode: SwipeDeckTinderRotationMode;
  origin?: SwipeDeckTinderFixedRotationOrigin;
  gestureStartYRatio: number;
};

function resolveSwipeDeckTinderRotationAnchor({
  mode,
  origin,
  gestureStartYRatio,
}: ResolveSwipeDeckTinderRotationAnchorArgs): SwipeDeckTinderFixedRotationOrigin {
  'worklet';

  if (mode === 'grab-position' && gestureStartYRatio < 0.5) {
    return 'top-center';
  }

  if (mode === 'grab-position') {
    return 'bottom-center';
  }

  return origin ?? 'center';
}

type ResolveSwipeDeckTinderRotationOriginPointArgs = ResolveSwipeDeckTinderRotationAnchorArgs & {
  width: number;
  height: number;
};

function resolveSwipeDeckTinderRotationOriginPoint({
  mode,
  origin,
  gestureStartYRatio,
  width,
  height,
}: ResolveSwipeDeckTinderRotationOriginPointArgs): SwipeDeckRotationPoint {
  'worklet';

  const anchor = resolveSwipeDeckTinderRotationAnchor({ mode, origin, gestureStartYRatio });

  if (anchor === 'top-center') {
    return { x: width / 2, y: 0 };
  }

  if (anchor === 'bottom-center') {
    return { x: width / 2, y: height };
  }

  return { x: width / 2, y: height / 2 };
}

function rotatePointX({
  x,
  y,
  originX,
  originY,
  radians,
}: {
  x: number;
  y: number;
  originX: number;
  originY: number;
  radians: number;
}): number {
  'worklet';

  const dx = x - originX;
  const dy = y - originY;

  return originX + dx * Math.cos(radians) - dy * Math.sin(radians);
}

function resolveRotatedCardBounds({
  width,
  height,
  originX,
  originY,
  radians,
}: {
  width: number;
  height: number;
  originX: number;
  originY: number;
  radians: number;
}): SwipeDeckRotationBounds {
  'worklet';

  const topLeftX = rotatePointX({ x: 0, y: 0, originX, originY, radians });
  const topRightX = rotatePointX({ x: width, y: 0, originX, originY, radians });
  const bottomLeftX = rotatePointX({ x: 0, y: height, originX, originY, radians });
  const bottomRightX = rotatePointX({ x: width, y: height, originX, originY, radians });

  return {
    minX: Math.min(topLeftX, topRightX, bottomLeftX, bottomRightX),
    maxX: Math.max(topLeftX, topRightX, bottomLeftX, bottomRightX),
  };
}

function resolveSwipeDeckTinderRotationSignValue({
  mode,
  direction,
  gestureStartYRatio,
}: ResolveSwipeDeckTinderRotationSignArgs): number {
  'worklet';

  if (mode === 'grab-position') {
    const isLowerHalfGrab = gestureStartYRatio >= 0.5;

    if (direction === 'reverse') {
      return isLowerHalfGrab ? 1 : -1;
    }

    return isLowerHalfGrab ? -1 : 1;
  }

  if (direction === 'reverse') {
    return -1;
  }

  return 1;
}

export type ResolveSwipeDeckDismissDestinationDistanceArgs = {
  offscreenMultiplier: number | undefined;
  layout: SwipeDeckLayout;
  rotationMaxDegrees: number;
  rotationMode: SwipeDeckTinderRotationMode;
  rotationOrigin?: SwipeDeckTinderFixedRotationOrigin;
  rotationDirection?: SwipeDeckTinderRotationDirection;
  gestureStartYRatio: number;
  swipeDirection: SwipeDirection;
};

export function resolveSwipeDeckDismissDestinationDistance({
  offscreenMultiplier,
  layout,
  rotationMaxDegrees,
  rotationMode,
  rotationOrigin,
  rotationDirection,
  gestureStartYRatio,
  swipeDirection,
}: ResolveSwipeDeckDismissDestinationDistanceArgs): number {
  'worklet';

  const width = Math.max(layout.width, 1);
  const height = Math.max(layout.height, 0);
  const rotationSign = resolveSwipeDeckTinderRotationSignValue({
    mode: rotationMode,
    direction: rotationDirection,
    gestureStartYRatio,
  });
  const swipeSign = swipeDirection === 'right' ? 1 : -1;
  const radians = degreesToRadians(rotationMaxDegrees * rotationSign * swipeSign);
  const originPoint = resolveSwipeDeckTinderRotationOriginPoint({
    mode: rotationMode,
    origin: rotationOrigin,
    gestureStartYRatio,
    width,
    height,
  });
  const bounds = resolveRotatedCardBounds({
    width,
    height,
    originX: originPoint.x,
    originY: originPoint.y,
    radians,
  });
  const clearDistance = swipeDirection === 'right' ? width - bounds.minX : bounds.maxX;

  return clearDistance * resolveOffscreenMultiplier(offscreenMultiplier);
}

function mergeSwipeDeckTinderRotationConfig(
  base: SwipeDeckTinderRotationConfig | undefined,
  override: SwipeDeckTinderRotationConfig | undefined,
): SwipeDeckTinderRotationConfig | undefined {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  const direction = override.direction ?? base.direction;
  const maxDegrees = override.maxDegrees ?? base.maxDegrees;
  const inputRange = override.inputRange ?? base.inputRange;

  if (override.mode === 'grab-position') {
    return {
      mode: 'grab-position',
      direction,
      maxDegrees,
      inputRange,
    };
  }

  if (base.mode === 'grab-position' && override.mode !== 'fixed') {
    return {
      mode: 'grab-position',
      direction,
      maxDegrees,
      inputRange,
    };
  }

  const fixedBase = base.mode === 'grab-position' ? {} : base;

  return {
    ...fixedBase,
    ...override,
    direction,
    maxDegrees,
    inputRange,
  };
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
    drag: {
      ...base.drag,
      ...override.drag,
    },
    rotation: mergeSwipeDeckTinderRotationConfig(base.rotation, override.rotation),
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
    drag: {
      mode: DEFAULT_DRAG_MODE,
      liftYFactor: 0,
    },
    rotation: {
      mode: 'grab-position',
      inputRange: ({ width }) => Math.max(width, 1),
    },
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

function getFixedRotationOrigin(
  rotation: SwipeDeckTinderRotationConfig,
): SwipeDeckTinderFixedRotationOrigin {
  if (rotation.mode === 'grab-position') {
    return 'center';
  }

  return rotation.origin ?? 'center';
}

function getRotationDirection(
  rotation: SwipeDeckTinderRotationConfig,
): SwipeDeckTinderRotationDirection {
  return rotation.direction ?? 'default';
}

function getRotationDefaultMaxDegrees(rotation: SwipeDeckTinderRotationConfig): number {
  if (rotation.mode === 'grab-position') {
    return getDefaultMaxDegrees('grab-position');
  }

  return getDefaultMaxDegrees(rotation.origin ?? 'center');
}

function resolveTinderMotionConfig(
  motionConfig: SwipeDeckTinderMotionConfig | undefined,
  layout: SwipeDeckLayout,
): ResolvedSwipeDeckMotionConfig {
  const motion = createTinderMotionConfig(motionConfig);
  const drag = motion.drag ?? {};
  const dismiss = motion.dismiss ?? {};
  const rotation = motion.rotation ?? {
    mode: 'grab-position',
    inputRange: ({ width }: SwipeDeckLayout) => Math.max(width, 1),
  };
  const dismissThreshold =
    typeof dismiss.threshold === 'function' ? dismiss.threshold(layout) : dismiss.threshold;
  const rotationMaxDegrees = rotation.maxDegrees ?? getRotationDefaultMaxDegrees(rotation);
  const dismissOffscreenMultiplier = resolveOffscreenMultiplier(dismiss.offscreenMultiplier);

  return {
    nextScale: motion.nextScale ?? 0.95,
    nextOpacity: motion.nextOpacity ?? 1,
    nextTranslateY: motion.nextTranslateY ?? 12,
    swipeProgressDistance: resolveLayoutValue(
      motion.swipeProgressDistance,
      layout,
      Math.max(layout.width * 0.35, 120),
    ),
    drag: {
      mode: drag.mode ?? DEFAULT_DRAG_MODE,
      liftYFactor: drag.liftYFactor ?? 0,
    },
    rotation: {
      mode: rotation.mode,
      origin: getFixedRotationOrigin(rotation),
      direction: getRotationDirection(rotation),
      maxDegrees: rotationMaxDegrees,
      inputRange: resolveLayoutValue(rotation.inputRange, layout, Math.max(layout.width, 1)),
    },
    dismiss: {
      threshold: dismissThreshold,
      offscreenMultiplier: dismissOffscreenMultiplier,
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

export type ResolveSwipeDeckDragTranslateYArgs = {
  mode: SwipeDeckTinderDragMode;
  liftYFactor: number;
  translationX: number;
  translationY: number;
};

export function resolveSwipeDeckDragTranslateY({
  mode,
  liftYFactor,
  translationX,
  translationY,
}: ResolveSwipeDeckDragTranslateYArgs): number {
  'worklet';

  const fingerTranslateY = mode === 'free' ? translationY : 0;

  return fingerTranslateY - Math.abs(translationX) * liftYFactor;
}

export type ResolveSwipeDeckTinderRotationSignArgs = {
  mode: SwipeDeckTinderRotationMode;
  direction?: SwipeDeckTinderRotationDirection;
  gestureStartYRatio: number;
};

export function resolveSwipeDeckTinderRotationSign(
  args: ResolveSwipeDeckTinderRotationSignArgs,
): number {
  'worklet';

  return resolveSwipeDeckTinderRotationSignValue(args);
}

export type ResolveSwipeDeckGestureStartYRatioArgs = {
  y: number | undefined;
  height: number;
};

export function resolveSwipeDeckGestureStartYRatio({
  y,
  height,
}: ResolveSwipeDeckGestureStartYRatioArgs): number {
  'worklet';

  if (typeof y !== 'number' || !Number.isFinite(y) || height <= 0) {
    return 0.5;
  }

  return Math.min(Math.max(y / height, 0), 1);
}

export type SwipeDeckTinderTransformOrigin = ['50%', '0%' | '100%', 0];

export type ResolveSwipeDeckTinderTransformOriginArgs = {
  mode: SwipeDeckTinderRotationMode;
  origin?: SwipeDeckTinderFixedRotationOrigin;
  gestureStartYRatio: number;
};

export function resolveSwipeDeckTinderTransformOrigin({
  mode,
  origin,
  gestureStartYRatio,
}: ResolveSwipeDeckTinderTransformOriginArgs): SwipeDeckTinderTransformOrigin | undefined {
  'worklet';

  const anchor = resolveSwipeDeckTinderRotationAnchor({ mode, origin, gestureStartYRatio });

  if (anchor === 'top-center') {
    return ['50%', '0%', 0];
  }

  if (anchor === 'bottom-center') {
    return ['50%', '100%', 0];
  }

  return undefined;
}

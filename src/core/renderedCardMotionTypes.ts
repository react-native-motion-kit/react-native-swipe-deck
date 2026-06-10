import type {
  SwipeDeckTinderDragMode,
  SwipeDeckTinderFixedRotationOrigin,
  SwipeDeckTinderRotationDirection,
  SwipeDeckTinderRotationMode,
} from '../types';

export type SwipeDeckRenderedCardMotionConfig = {
  nextScale: number;
  nextOpacity: number;
  nextTranslateY: number;
  drag: {
    mode: SwipeDeckTinderDragMode;
    liftYFactor: number;
  };
  rotation: {
    mode: SwipeDeckTinderRotationMode;
    origin?: SwipeDeckTinderFixedRotationOrigin;
    direction?: SwipeDeckTinderRotationDirection;
    maxDegrees: number;
    inputRange: number;
  };
};

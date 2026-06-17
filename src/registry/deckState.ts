import type { SwipeDeckLayout, SwipeDeckState } from '../types';

type SwipeDeckStateInput = {
  canDismissAnyDirection?: boolean;
  dataLength: number;
  activeIndex: number;
  disabled: boolean;
  layout: SwipeDeckLayout;
  isAnimating: boolean;
  isDragging: boolean;
  hasUndoHistory: boolean;
};

export function getSwipeDeckState({
  dataLength,
  activeIndex,
  disabled,
  layout,
  isAnimating,
  isDragging,
  hasUndoHistory,
  canDismissAnyDirection = true,
}: SwipeDeckStateInput): SwipeDeckState {
  const hasActiveDeckItem = activeIndex >= 0 && activeIndex < dataLength;
  const hasMeasuredLayout = layout.width > 0 && layout.height > 0;

  return {
    activeIndex,
    count: dataLength,
    isCompleted: activeIndex >= 0 && activeIndex >= dataLength,
    canSwipe:
      hasActiveDeckItem &&
      canDismissAnyDirection &&
      !disabled &&
      hasMeasuredLayout &&
      !isAnimating &&
      !isDragging,
    canUndo: hasUndoHistory && !disabled && hasMeasuredLayout && !isAnimating && !isDragging,
  };
}

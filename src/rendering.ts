import type { SwipeRenderInfo } from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { getSwipeWindow } from './windowing';

export type SwipeRenderItem<T> = SwipeRenderInfo<T> & {
  descriptor: SwipeWindowDescriptor;
};

export function getSwipeRenderItems<T>(
  data: readonly T[],
  activeIndex: number,
): SwipeRenderItem<T>[] {
  return getSwipeWindow(data.length, activeIndex).map((descriptor) => ({
    descriptor,
    item: data[descriptor.index] as T,
    index: descriptor.index,
    role: descriptor.role,
    isActive: descriptor.isActive,
  }));
}

import type { SwipeRenderInfo } from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { getSwipeWindow } from './windowing';

export type SwipeRenderItem<T> = SwipeRenderInfo<T> & {
  descriptor: SwipeWindowDescriptor;
  itemKey: string;
};

export function getSwipeRenderItems<T>(
  data: readonly T[],
  activeIndex: number,
  getKey: (item: T, index: number) => string,
  visibleCardCount?: number,
): SwipeRenderItem<T>[] {
  return getSwipeWindow(data.length, activeIndex, visibleCardCount).map((descriptor) => {
    const item = data[descriptor.index] as T;

    return {
      descriptor,
      itemKey: getKey(item, descriptor.index),
      item,
      index: descriptor.index,
      offset: descriptor.offset,
      role: descriptor.role,
      isActive: descriptor.isActive,
    };
  });
}

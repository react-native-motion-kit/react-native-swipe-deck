import type { SwipeSlotDescriptor } from './slots';
import type { SwipeRenderInfo } from './types';
import type { SwipeWindowDescriptor } from './windowing';

import { getSwipeWindow } from './windowing';

export type SwipeRenderItem<T> = SwipeRenderInfo<T> & {
  descriptor: SwipeWindowDescriptor;
};

export type SwipeSlotRenderItem<T> = SwipeRenderItem<T> & {
  slotId: number;
  itemKey: string;
};

function getItemKey<T>(item: T, index: number, getKey?: (item: T, index: number) => string) {
  return getKey?.(item, index) ?? String(index);
}

export function getSwipeRenderItems<T>(
  data: readonly T[],
  activeIndex: number,
  visibleCardCount?: number,
): SwipeRenderItem<T>[] {
  return getSwipeWindow(data.length, activeIndex, visibleCardCount).map((descriptor) => ({
    descriptor,
    item: data[descriptor.index] as T,
    index: descriptor.index,
    offset: descriptor.offset,
    role: descriptor.role,
    isActive: descriptor.isActive,
  }));
}

export function getSwipeSlotRenderItems<T>(
  data: readonly T[],
  slots: SwipeSlotDescriptor[],
  getKey?: (item: T, index: number) => string,
): SwipeSlotRenderItem<T>[] {
  return slots
    .filter((slot) => slot.descriptor.index >= 0 && slot.descriptor.index < data.length)
    .map((slot) => {
      const descriptor = slot.descriptor;
      const item = data[descriptor.index] as T;

      return {
        slotId: slot.id,
        itemKey: getItemKey(item, descriptor.index, getKey),
        descriptor,
        item,
        index: descriptor.index,
        offset: descriptor.offset,
        role: descriptor.role,
        isActive: descriptor.isActive,
      };
    });
}

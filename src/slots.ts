import type { SwipeWindowDescriptor } from './windowing';

export type SwipeSlotDescriptor = {
  id: number;
  descriptor: SwipeWindowDescriptor;
};

export function createSwipeSlots(window: SwipeWindowDescriptor[]): SwipeSlotDescriptor[] {
  return window.map((descriptor, id) => ({ id, descriptor }));
}

function hasDescriptorIndex(slots: SwipeSlotDescriptor[], index: number): boolean {
  return slots.some((slot) => slot.descriptor.index === index);
}

export function reconcileSwipeSlots(
  currentSlots: SwipeSlotDescriptor[],
  nextWindow: SwipeWindowDescriptor[],
): SwipeSlotDescriptor[] {
  if (currentSlots.length !== nextWindow.length) {
    return createSwipeSlots(nextWindow);
  }

  const nextByIndex = new Map(
    nextWindow.map((descriptor) => [descriptor.index, descriptor] as const),
  );
  const enteringDescriptors = nextWindow.filter(
    (descriptor) => !hasDescriptorIndex(currentSlots, descriptor.index),
  );
  const leavingSlotIds = currentSlots
    .filter((slot) => !nextByIndex.has(slot.descriptor.index))
    .map((slot) => slot.id);

  return currentSlots.map((slot) => {
    const matchingDescriptor = nextByIndex.get(slot.descriptor.index);

    if (matchingDescriptor) {
      return { ...slot, descriptor: matchingDescriptor };
    }

    const descriptor = enteringDescriptors[leavingSlotIds.indexOf(slot.id)] ?? slot.descriptor;

    return { ...slot, descriptor };
  });
}

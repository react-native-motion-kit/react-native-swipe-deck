import type { GestureResponderEvent } from 'react-native';

import { describe, expect, it, jest } from '@jest/globals';

import { SwipeDeckActionMotion } from '../motion/actionMotion';
import { SwipeDeckUndoMotion } from '../motion/undoMotion';
import { createSwipeDeckRegistry } from '../registry/registry';

function createAttachedState(canUndo = false) {
  return {
    activeIndex: 0,
    count: 1,
    isCompleted: false,
    canSwipe: true,
    canUndo,
  };
}

async function flushRegistryEvictionMicrotask() {
  await Promise.resolve();
}

describe('createSwipeDeckRegistry', () => {
  it('scopes default deck ids by registry instance', () => {
    const firstRegistry = createSwipeDeckRegistry();
    const secondRegistry = createSwipeDeckRegistry();

    expect(firstRegistry.getStore()).not.toBe(secondRegistry.getStore());
  });

  it('keeps the implicit default id separate from an explicit default-looking string id', () => {
    const registry = createSwipeDeckRegistry();

    expect(registry.getStore()).not.toBe(registry.getStore('__default__'));
  });

  it('returns a safe unattached state and false-returning actions before root attach', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore();

    expect(store.getSnapshot()).toEqual({
      activeIndex: -1,
      count: 0,
      isCompleted: false,
      canSwipe: false,
      canUndo: false,
    });
    expect(store.actions.swipeLeft()).toBe(false);
    expect(store.actions.swipeRight()).toBe(false);
    expect(store.actions.swipeUp()).toBe(false);
    expect(store.actions.undo()).toBe(false);
  });

  it('keeps actions and interaction stable for hook-before-root consumers', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore('profiles');

    expect(registry.getStore('profiles').actions).toBe(store.actions);
    expect(registry.getStore('profiles').interaction).toBe(store.interaction);
    expect(store.interaction.phase.get()).toBe('idle');
    expect(store.interaction.intentDirection.get()).toBeNull();
    expect(store.interaction.dismissDirection.get()).toBeNull();
  });

  it('notifies state subscribers only when the snapshot changes', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore();
    const listener = jest.fn();
    const nextState = {
      activeIndex: 0,
      count: 1,
      isCompleted: false,
      canSwipe: true,
      canUndo: false,
    };
    const unsubscribe = store.subscribe(listener);

    store.setSnapshot(nextState);
    store.setSnapshot(nextState);
    unsubscribe();
    store.setSnapshot({ ...nextState, activeIndex: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stores latest model event snapshots and clears them on attach cleanup', () => {
    const registry = createSwipeDeckRegistry<{ id: string }>();
    const store = registry.getStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribeEventSnapshot('swipe', listener);

    store.emitEvent('swipe', {
      direction: 'right',
      index: 0,
      item: { id: 'ada' },
      source: 'gesture',
    });

    expect(store.getEventSnapshot('swipe')?.event).toEqual({
      direction: 'right',
      index: 0,
      item: { id: 'ada' },
      source: 'gesture',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    const detach = store.attach({
      getState: () => createAttachedState(),
      swipe: () => false,
      undo: () => false,
    });

    expect(store.getEventSnapshot('swipe')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    store.emitEvent('swipe', {
      direction: 'left',
      index: 0,
      item: { id: 'grace' },
      source: 'programmatic',
    });

    detach();

    expect(store.getEventSnapshot('swipe')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
  });

  it('notifies event listeners only when events are emitted', () => {
    const registry = createSwipeDeckRegistry<{ id: string }>();
    const store = registry.getStore();
    const listener = jest.fn();
    const unsubscribe = store.addEventListener('indexChange', listener);

    store.clearEvents();
    store.emitEvent('indexChange', { index: 1 });
    unsubscribe();
    store.emitEvent('indexChange', { index: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ index: 1 });
  });

  it('attaches one root per factory id and resets after detach', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore();
    const swipe = jest.fn(() => true);
    const detach = store.attach({
      getState: () => ({
        activeIndex: 0,
        count: 1,
        isCompleted: false,
        canSwipe: true,
        canUndo: false,
      }),
      swipe,
      undo: () => false,
    });

    expect(store.getSnapshot()).toEqual({
      activeIndex: 0,
      count: 1,
      isCompleted: false,
      canSwipe: true,
      canUndo: false,
    });
    expect(store.actions.swipeRight()).toBe(true);
    expect(swipe).toHaveBeenCalledWith('right', undefined);
    expect(store.actions.swipeUp()).toBe(true);
    expect(swipe).toHaveBeenCalledWith('up', undefined);

    expect(() =>
      store.attach({
        getState: () => store.getSnapshot(),
        swipe: () => false,
        undo: () => false,
      }),
    ).toThrow('SwipeDeck.Root with id "__default__" is already mounted');

    detach();

    expect(store.getSnapshot()).toEqual({
      activeIndex: -1,
      count: 0,
      isCompleted: false,
      canSwipe: false,
      canUndo: false,
    });
    expect(store.actions.swipeLeft()).toBe(false);
  });

  it('passes action motion recipes and ignores callback event arguments', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore();
    const swipe = jest.fn(() => true);
    const springboardMotion = SwipeDeckActionMotion.springboard({
      anticipationDistance: 24,
    });
    const detach = store.attach({
      getState: () => ({
        activeIndex: 0,
        count: 1,
        isCompleted: false,
        canSwipe: true,
        canUndo: true,
      }),
      swipe,
      undo: () => false,
    });

    expect(store.actions.swipeRight(springboardMotion)).toBe(true);
    expect(store.actions.swipeUp(springboardMotion)).toBe(true);
    expect(store.actions.swipeLeft({ nativeEvent: {} } as unknown as GestureResponderEvent)).toBe(
      true,
    );

    expect(swipe).toHaveBeenNthCalledWith(1, 'right', springboardMotion);
    expect(swipe).toHaveBeenNthCalledWith(2, 'up', springboardMotion);
    expect(swipe).toHaveBeenNthCalledWith(3, 'left', undefined);

    detach();
  });

  it('passes undo motion recipes and ignores callback event arguments', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore();
    const undo = jest.fn(() => true);
    const springMotion = SwipeDeckUndoMotion.spring({
      springConfig: {
        damping: 14,
      },
    });
    const detach = store.attach({
      getState: () => createAttachedState(true),
      swipe: () => false,
      undo,
    });

    expect(store.actions.undo(springMotion)).toBe(true);
    expect(store.actions.undo({ nativeEvent: {} } as unknown as GestureResponderEvent)).toBe(true);

    expect(undo).toHaveBeenNthCalledWith(1, springMotion);
    expect(undo).toHaveBeenNthCalledWith(2, undefined);

    detach();
  });

  it('allows remounting the same factory id after cleanup', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore('nearby');
    const controller = {
      getState: () => createAttachedState(),
      swipe: () => true,
      undo: () => false,
    };

    const firstDetach = store.attach(controller);
    firstDetach();

    const secondDetach = store.attach(controller);

    expect(store.getSnapshot().activeIndex).toBe(0);

    secondDetach();
  });

  it('evicts a store after the final release and returns a fresh identity on next lookup', async () => {
    const registry = createSwipeDeckRegistry();
    const firstStore = registry.getStore('route:ada');
    const release = registry.retainStore('route:ada', firstStore);

    release();
    await flushRegistryEvictionMicrotask();

    expect(registry.getStore('route:ada')).not.toBe(firstStore);
    expect(registry.getStore('route:ada').interaction).not.toBe(firstStore.interaction);
  });

  it('makes release closures idempotent and does not underflow the lifecycle count', async () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore('route:grace');
    const firstRelease = registry.retainStore('route:grace', store);
    const secondRelease = registry.retainStore('route:grace', store);

    firstRelease();
    firstRelease();
    await flushRegistryEvictionMicrotask();

    expect(registry.getStore('route:grace')).toBe(store);

    secondRelease();
    secondRelease();
    await flushRegistryEvictionMicrotask();

    expect(registry.getStore('route:grace')).not.toBe(store);
  });

  it('preserves identity when the same entry is re-retained before the eviction microtask', async () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore('route:linus');
    const firstRelease = registry.retainStore('route:linus', store);

    firstRelease();

    const secondRelease = registry.retainStore('route:linus', store);

    await flushRegistryEvictionMicrotask();

    expect(registry.getStore('route:linus')).toBe(store);

    secondRelease();
  });

  it('restores a late held store when its id is unclaimed', async () => {
    const registry = createSwipeDeckRegistry();
    const heldStore = registry.getStore('route:late');
    const firstRelease = registry.retainStore('route:late', heldStore);

    firstRelease();
    await flushRegistryEvictionMicrotask();

    const lateRelease = registry.retainStore('route:late', heldStore);

    expect(registry.getStore('route:late')).toBe(heldStore);

    lateRelease();
  });

  it('does not let a stale release delete a replacement entry for the same id', async () => {
    const registry = createSwipeDeckRegistry();
    const firstStore = registry.getStore('route:replacement');
    const firstRelease = registry.retainStore('route:replacement', firstStore);

    firstRelease();
    const replacementPromise = Promise.resolve().then(() => registry.getStore('route:replacement'));

    const secondRelease = registry.retainStore('route:replacement', firstStore);
    secondRelease();

    const replacementStore = await replacementPromise;
    await flushRegistryEvictionMicrotask();

    expect(registry.getStore('route:replacement')).toBe(replacementStore);
    expect(replacementStore).not.toBe(firstStore);
  });

  it('rejects retaining a held store when a different entry already owns the id', async () => {
    const registry = createSwipeDeckRegistry();
    const heldStore = registry.getStore('route:conflict');
    const firstRelease = registry.retainStore('route:conflict', heldStore);

    firstRelease();
    await flushRegistryEvictionMicrotask();

    const replacementStore = registry.getStore('route:conflict');
    const replacementRelease = registry.retainStore('route:conflict', replacementStore);

    expect(() => registry.retainStore('route:conflict', heldStore)).toThrow(
      /SwipeDeck registry lifecycle inconsistency/,
    );
    expect(registry.getStore('route:conflict')).toBe(replacementStore);

    replacementRelease();
  });

  it('resets interaction shared values on detach', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore();
    const detach = store.attach({
      getState: () => ({
        activeIndex: 0,
        count: 1,
        isCompleted: false,
        canSwipe: true,
        canUndo: false,
      }),
      swipe: () => true,
      undo: () => false,
    });

    store.interaction.progress.set(1);
    store.interaction.signedProgress.set(-1);
    store.interaction.direction.set(-1);
    store.interaction.intentDirection.set('left');
    store.interaction.dismissDirection.set('up');
    store.interaction.translationX.set(-120);
    store.interaction.translationY.set(24);
    store.interaction.isDragging.set(true);
    store.interaction.phase.set('dismissing');

    detach();

    expect(store.interaction.progress.get()).toBe(0);
    expect(store.interaction.signedProgress.get()).toBe(0);
    expect(store.interaction.direction.get()).toBe(0);
    expect(store.interaction.intentDirection.get()).toBeNull();
    expect(store.interaction.dismissDirection.get()).toBeNull();
    expect(store.interaction.translationX.get()).toBe(0);
    expect(store.interaction.translationY.get()).toBe(0);
    expect(store.interaction.isDragging.get()).toBe(false);
    expect(store.interaction.phase.get()).toBe('idle');
  });
});

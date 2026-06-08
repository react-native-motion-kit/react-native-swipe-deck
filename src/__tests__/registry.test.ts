import type { GestureResponderEvent } from 'react-native';

import { describe, expect, it, jest } from '@jest/globals';

import { SwipeDeckActionMotion } from '../actionMotion';
import { createSwipeDeckRegistry } from '../registry';

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
    });
    expect(store.actions.swipeLeft()).toBe(false);
    expect(store.actions.swipeRight()).toBe(false);
  });

  it('keeps actions and interaction stable for hook-before-root consumers', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore('profiles');

    expect(registry.getStore('profiles').actions).toBe(store.actions);
    expect(registry.getStore('profiles').interaction).toBe(store.interaction);
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
    };
    const unsubscribe = store.subscribe(listener);

    store.setSnapshot(nextState);
    store.setSnapshot(nextState);
    unsubscribe();
    store.setSnapshot({ ...nextState, activeIndex: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
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
      }),
      swipe,
    });

    expect(store.getSnapshot()).toEqual({
      activeIndex: 0,
      count: 1,
      isCompleted: false,
      canSwipe: true,
    });
    expect(store.actions.swipeRight()).toBe(true);
    expect(swipe).toHaveBeenCalledWith('right', undefined);

    expect(() =>
      store.attach({
        getState: () => store.getSnapshot(),
        swipe: () => false,
      }),
    ).toThrow('SwipeDeck.Root with id "__default__" is already mounted');

    detach();

    expect(store.getSnapshot()).toEqual({
      activeIndex: -1,
      count: 0,
      isCompleted: false,
      canSwipe: false,
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
      }),
      swipe,
    });

    expect(store.actions.swipeRight(springboardMotion)).toBe(true);
    expect(store.actions.swipeLeft({ nativeEvent: {} } as unknown as GestureResponderEvent)).toBe(
      true,
    );

    expect(swipe).toHaveBeenNthCalledWith(1, 'right', springboardMotion);
    expect(swipe).toHaveBeenNthCalledWith(2, 'left', undefined);

    detach();
  });

  it('allows remounting the same factory id after cleanup', () => {
    const registry = createSwipeDeckRegistry();
    const store = registry.getStore('nearby');
    const controller = {
      getState: () => ({
        activeIndex: 0,
        count: 1,
        isCompleted: false,
        canSwipe: true,
      }),
      swipe: () => true,
    };

    const firstDetach = store.attach(controller);
    firstDetach();

    const secondDetach = store.attach(controller);

    expect(store.getSnapshot().activeIndex).toBe(0);

    secondDetach();
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
      }),
      swipe: () => true,
    });

    store.interaction.progress.set(1);
    store.interaction.signedProgress.set(-1);
    store.interaction.direction.set(-1);
    store.interaction.translationX.set(-120);
    store.interaction.translationY.set(24);
    store.interaction.isDragging.set(true);

    detach();

    expect(store.interaction.progress.get()).toBe(0);
    expect(store.interaction.signedProgress.get()).toBe(0);
    expect(store.interaction.direction.get()).toBe(0);
    expect(store.interaction.translationX.get()).toBe(0);
    expect(store.interaction.translationY.get()).toBe(0);
    expect(store.interaction.isDragging.get()).toBe(false);
  });
});

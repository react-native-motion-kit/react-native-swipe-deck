import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import type {
  SwipeDeckActions,
  SwipeDeckEventHook,
  SwipeDeckEventInitialValue,
  SwipeDeckEventListenerHook,
  SwipeDeckEventMap,
  SwipeDeckInteraction,
  SwipeDeckState,
} from '../types';
import type { SwipeDeckRegistry, SwipeDeckStore } from './registry';

type RetainSwipeDeckStore<T> = (id: string | undefined, heldStore: SwipeDeckStore<T>) => () => void;
type SwipeDeckRegistryStoreAccess<T> = Pick<
  SwipeDeckRegistry<T>,
  'getStore' | 'getStoreSnapshot' | 'subscribeStore'
>;

export type SwipeDeckRegistryHooks<T> = {
  useDeckState: (id?: string) => SwipeDeckState;
  useDeckActions: (id?: string) => SwipeDeckActions;
  useDeckInteraction: (id?: string) => SwipeDeckInteraction;
  useDeckEvent: SwipeDeckEventHook<T>;
  useDeckEventListener: SwipeDeckEventListenerHook<T>;
};

export function useSwipeDeckRegistryStore<T>(
  registry: SwipeDeckRegistryStoreAccess<T>,
  id?: string,
): SwipeDeckStore<T> {
  const heldStore = useMemo(() => registry.getStore(id), [id, registry]);
  const subscribe = useCallback(
    (listener: () => void) => registry.subscribeStore(id, listener),
    [id, registry],
  );
  // Preserve an unclaimed held store so retainStore can restore it. If a
  // replacement owns the id, React observes that identity before commit and
  // rerenders the consumer with the replacement instead.
  const getSnapshot = useCallback(
    () => registry.getStoreSnapshot(id) ?? heldStore,
    [heldStore, id, registry],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function createRegistryHooks<T>(
  registry: SwipeDeckRegistryStoreAccess<T>,
  retainStore: RetainSwipeDeckStore<T>,
): SwipeDeckRegistryHooks<T> {
  function useDeckStore(id?: string): SwipeDeckStore<T> {
    const store = useSwipeDeckRegistryStore(registry, id);

    useLayoutEffect(() => retainStore(id, store), [id, store]);

    return store;
  }

  function useDeckEvent<K extends keyof SwipeDeckEventMap<T>>(
    eventName: K,
  ): SwipeDeckEventMap<T>[K] | undefined;
  function useDeckEvent<
    K extends keyof SwipeDeckEventMap<T>,
    const TInitial extends SwipeDeckEventInitialValue<T, K>,
  >(eventName: K, initialValue: TInitial, id?: string): SwipeDeckEventMap<T>[K] | TInitial;
  function useDeckEvent<K extends keyof SwipeDeckEventMap<T>>(
    eventName: K,
    id: string,
  ): SwipeDeckEventMap<T>[K] | undefined;
  function useDeckEvent<
    K extends keyof SwipeDeckEventMap<T>,
    const TInitial extends SwipeDeckEventInitialValue<T, K>,
  >(eventName: K, initialValueOrId?: TInitial | string, id?: string) {
    const usesIdShortcut = typeof initialValueOrId === 'string' && id === undefined;
    const store = useDeckStore(usesIdShortcut ? initialValueOrId : id);
    const initialValue = usesIdShortcut ? undefined : initialValueOrId;
    const subscribe = useCallback(
      (listener: () => void) => store.subscribeEventSnapshot(eventName, listener),
      [eventName, store],
    );
    const getSnapshot = useCallback(() => store.getEventSnapshot(eventName), [eventName, store]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return snapshot ? snapshot.event : initialValue;
  }

  const useDeckEventListener: SwipeDeckEventListenerHook<T> = (eventName, listener, id) => {
    const store = useDeckStore(id);
    const listenerRef = useRef(listener);

    useLayoutEffect(() => {
      listenerRef.current = listener;
    }, [listener]);

    useLayoutEffect(() => {
      return store.addEventListener(eventName, (event) => {
        listenerRef.current(event);
      });
    }, [eventName, store]);
  };

  return {
    useDeckState: (id?: string): SwipeDeckState => {
      const store = useDeckStore(id);

      return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    },
    useDeckActions: (id?: string): SwipeDeckActions => {
      const store = useDeckStore(id);

      return useMemo(() => store.actions, [store]);
    },
    useDeckInteraction: (id?: string): SwipeDeckInteraction => {
      const store = useDeckStore(id);

      return useMemo(() => store.interaction, [store]);
    },
    useDeckEvent,
    useDeckEventListener,
  };
}

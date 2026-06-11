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
import type { SwipeDeckStore } from './registry';

type GetSwipeDeckStore<T> = (id?: string) => SwipeDeckStore<T>;

export type SwipeDeckRegistryHooks<T> = {
  useDeckState: (id?: string) => SwipeDeckState;
  useDeckActions: (id?: string) => SwipeDeckActions;
  useDeckInteraction: (id?: string) => SwipeDeckInteraction;
  useDeckEvent: SwipeDeckEventHook<T>;
  useDeckEventListener: SwipeDeckEventListenerHook<T>;
};

export function createRegistryHooks<T>(getStore: GetSwipeDeckStore<T>): SwipeDeckRegistryHooks<T> {
  function useDeckStore(id?: string): SwipeDeckStore<T> {
    return useMemo(() => getStore(id), [id]);
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

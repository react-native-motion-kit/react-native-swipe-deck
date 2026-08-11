import { makeMutable } from 'react-native-reanimated';

import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckActions,
  SwipeDeckEventMap,
  SwipeDeckInteraction,
  SwipeDeckInteractionPhase,
  SwipeDeckState,
  SwipeDirection,
  SwipeDeckUndoMotionRecipe,
} from '../types';

import { createEventStore, type EventStore } from '../events/eventStore';
import { isSwipeDeckActionMotionRecipe } from '../motion/actionMotion';
import { isSwipeDeckUndoMotionRecipe } from '../motion/undoMotion';
import { createRegistryHooks, type SwipeDeckRegistryHooks } from './registryHooks';

const DEFAULT_DECK_KEY = Symbol('default-deck');
const DEFAULT_DECK_LABEL = '__default__';

type SwipeDeckRootController = {
  getState: () => SwipeDeckState;
  swipe: (direction: SwipeDirection, motion?: SwipeDeckActionMotionRecipe) => boolean;
  undo: (motion?: SwipeDeckUndoMotionRecipe) => boolean;
};

export type SwipeDeckStore<T> = {
  readonly interaction: SwipeDeckInteraction;
  readonly actions: SwipeDeckActions;
  addEventListener: EventStore<SwipeDeckEventMap<T>>['addListener'];
  attach: (controller: SwipeDeckRootController) => () => void;
  clearEvents: EventStore<SwipeDeckEventMap<T>>['clear'];
  emitEvent: EventStore<SwipeDeckEventMap<T>>['emit'];
  getEventSnapshot: EventStore<SwipeDeckEventMap<T>>['getSnapshot'];
  getSnapshot: () => SwipeDeckState;
  setSnapshot: (nextState: SwipeDeckState) => void;
  subscribe: (listener: () => void) => () => void;
  subscribeEventSnapshot: EventStore<SwipeDeckEventMap<T>>['subscribeSnapshot'];
};

type DeckStoreKey = string | typeof DEFAULT_DECK_KEY;

type GetSwipeDeckStore<T> = (id?: string) => SwipeDeckStore<T>;
type SwipeDeckStoreRelease = () => void;
type SwipeDeckStoreListener = () => void;

type SwipeDeckStoreEntry<T> = {
  referenceCount: number;
  store: SwipeDeckStore<T>;
};

export type SwipeDeckRegistry<T> = SwipeDeckRegistryHooks<T> & {
  getStore: GetSwipeDeckStore<T>;
  getStoreSnapshot: (id?: string) => SwipeDeckStore<T> | undefined;
  retainStore: (id: string | undefined, heldStore: SwipeDeckStore<T>) => SwipeDeckStoreRelease;
  subscribeStore: (id: string | undefined, listener: SwipeDeckStoreListener) => () => void;
};

function getDeckStoreKey(id?: string): DeckStoreKey {
  return id ?? DEFAULT_DECK_KEY;
}

function getDeckStoreLabel(id?: string): string {
  return id ?? DEFAULT_DECK_LABEL;
}

function createInitialState(): SwipeDeckState {
  return {
    activeIndex: -1,
    count: 0,
    isCompleted: false,
    canSwipe: false,
    canUndo: false,
  };
}

function createInteraction(): SwipeDeckInteraction {
  return {
    progress: makeMutable(0),
    signedProgress: makeMutable(0),
    direction: makeMutable<-1 | 0 | 1>(0),
    intentDirection: makeMutable<SwipeDirection | null>(null),
    dismissDirection: makeMutable<SwipeDirection | null>(null),
    translationX: makeMutable(0),
    translationY: makeMutable(0),
    isDragging: makeMutable(false),
    phase: makeMutable<SwipeDeckInteractionPhase>('idle'),
  };
}

function resetInteraction(interaction: SwipeDeckInteraction) {
  interaction.progress.set(0);
  interaction.signedProgress.set(0);
  interaction.direction.set(0);
  interaction.intentDirection.set(null);
  interaction.dismissDirection.set(null);
  interaction.translationX.set(0);
  interaction.translationY.set(0);
  interaction.isDragging.set(false);
  interaction.phase.set('idle');
}

function isSameState(left: SwipeDeckState, right: SwipeDeckState): boolean {
  return (
    left.activeIndex === right.activeIndex &&
    left.count === right.count &&
    left.isCompleted === right.isCompleted &&
    left.canSwipe === right.canSwipe &&
    left.canUndo === right.canUndo
  );
}

function createSnapshotStore() {
  let snapshot = createInitialState();
  const listeners = new Set<() => void>();

  const setSnapshot = (nextSnapshot: SwipeDeckState) => {
    if (isSameState(snapshot, nextSnapshot)) {
      return;
    }

    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    setSnapshot,
    resetSnapshot: () => setSnapshot(createInitialState()),
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createControllerSlot(label: string) {
  let controller: SwipeDeckRootController | null = null;

  return {
    getController: () => controller,
    attachController: (nextController: SwipeDeckRootController) => {
      if (controller) {
        throw new Error(
          `SwipeDeck.Root with id "${label}" is already mounted for this factory. Use a unique id for multiple decks.`,
        );
      }

      controller = nextController;
    },
    detachController: (nextController: SwipeDeckRootController) => {
      if (controller !== nextController) {
        return false;
      }

      controller = null;
      return true;
    },
  };
}

function createStore<T>(label: string): SwipeDeckStore<T> {
  const snapshotStore = createSnapshotStore();
  const controllerSlot = createControllerSlot(label);
  const interaction = createInteraction();
  const eventStore = createEventStore<SwipeDeckEventMap<T>>();
  const actions: SwipeDeckActions = {
    swipeLeft: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckActionMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.swipe('left', motion) ?? false;
    },
    swipeRight: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckActionMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.swipe('right', motion) ?? false;
    },
    swipeUp: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckActionMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.swipe('up', motion) ?? false;
    },
    undo: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckUndoMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.undo(motion) ?? false;
    },
  };

  return {
    interaction,
    actions,
    addEventListener: eventStore.addListener,
    attach: (nextController) => {
      controllerSlot.attachController(nextController);
      eventStore.clear();
      snapshotStore.setSnapshot(nextController.getState());

      return () => {
        if (!controllerSlot.detachController(nextController)) {
          return;
        }

        resetInteraction(interaction);
        eventStore.clear();
        snapshotStore.resetSnapshot();
      };
    },
    clearEvents: eventStore.clear,
    emitEvent: eventStore.emit,
    getEventSnapshot: eventStore.getSnapshot,
    getSnapshot: snapshotStore.getSnapshot,
    setSnapshot: snapshotStore.setSnapshot,
    subscribe: snapshotStore.subscribe,
    subscribeEventSnapshot: eventStore.subscribeSnapshot,
  };
}

export function createSwipeDeckRegistry<T = never>(): SwipeDeckRegistry<T> {
  const stores = new Map<DeckStoreKey, SwipeDeckStoreEntry<T>>();
  const storeListeners = new Map<DeckStoreKey, Set<SwipeDeckStoreListener>>();
  const pendingStoreNotifications = new Set<DeckStoreKey>();

  const createEntry = (store: SwipeDeckStore<T>): SwipeDeckStoreEntry<T> => ({
    referenceCount: 0,
    store,
  });

  const scheduleStoreNotification = (deckStoreKey: DeckStoreKey) => {
    if (pendingStoreNotifications.has(deckStoreKey)) {
      return;
    }

    pendingStoreNotifications.add(deckStoreKey);

    // getStore can create an entry during render, so registry subscribers must
    // not be notified synchronously from that render.
    Promise.resolve().then(() => {
      pendingStoreNotifications.delete(deckStoreKey);
      storeListeners.get(deckStoreKey)?.forEach((listener) => listener());
    });
  };

  const scheduleEntryEviction = (deckStoreKey: DeckStoreKey, entry: SwipeDeckStoreEntry<T>) => {
    Promise.resolve().then(() => {
      if (stores.get(deckStoreKey) === entry && entry.referenceCount === 0) {
        stores.delete(deckStoreKey);
        scheduleStoreNotification(deckStoreKey);
      }
    });
  };

  const getStoreSnapshot = (id?: string) => stores.get(getDeckStoreKey(id))?.store;

  const getStore = (id?: string) => {
    const deckStoreKey = getDeckStoreKey(id);
    const existingEntry = stores.get(deckStoreKey);

    if (existingEntry) {
      return existingEntry.store;
    }

    const entry = createEntry(createStore<T>(getDeckStoreLabel(id)));

    stores.set(deckStoreKey, entry);
    scheduleStoreNotification(deckStoreKey);

    return entry.store;
  };

  const retainStore = (id: string | undefined, heldStore: SwipeDeckStore<T>) => {
    const deckStoreKey = getDeckStoreKey(id);
    const existingEntry = stores.get(deckStoreKey);

    if (existingEntry && existingEntry.store !== heldStore) {
      throw new Error(
        `SwipeDeck registry lifecycle inconsistency for id "${getDeckStoreLabel(id)}": a different store already owns this id.`,
      );
    }

    const entry = existingEntry ?? createEntry(heldStore);

    if (!existingEntry) {
      stores.set(deckStoreKey, entry);
      scheduleStoreNotification(deckStoreKey);
    }

    entry.referenceCount += 1;

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      entry.referenceCount -= 1;

      if (entry.referenceCount === 0) {
        scheduleEntryEviction(deckStoreKey, entry);
      }
    };
  };

  const subscribeStore = (id: string | undefined, listener: SwipeDeckStoreListener) => {
    const deckStoreKey = getDeckStoreKey(id);
    const listeners = storeListeners.get(deckStoreKey) ?? new Set<SwipeDeckStoreListener>();

    listeners.add(listener);
    storeListeners.set(deckStoreKey, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        storeListeners.delete(deckStoreKey);
      }
    };
  };

  const storeAccess = {
    getStore,
    getStoreSnapshot,
    subscribeStore,
  };
  const hooks = createRegistryHooks(storeAccess, retainStore);

  return {
    getStore,
    getStoreSnapshot,
    retainStore,
    subscribeStore,
    useDeckState: hooks.useDeckState,
    useDeckActions: hooks.useDeckActions,
    useDeckInteraction: hooks.useDeckInteraction,
    useDeckEvent: hooks.useDeckEvent,
    useDeckEventListener: hooks.useDeckEventListener,
  };
}

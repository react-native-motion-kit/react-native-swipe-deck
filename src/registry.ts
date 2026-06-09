import { useMemo, useSyncExternalStore } from 'react';
import { makeMutable } from 'react-native-reanimated';

import type {
  SwipeDeckActionMotionRecipe,
  SwipeDeckActions,
  SwipeDeckInteraction,
  SwipeDeckState,
  SwipeDirection,
  SwipeDeckUndoMotionRecipe,
} from './types';

import { isSwipeDeckActionMotionRecipe } from './actionMotion';
import { isSwipeDeckUndoMotionRecipe } from './undoMotion';

const DEFAULT_DECK_KEY = Symbol('default-deck');
const DEFAULT_DECK_LABEL = '__default__';

type SwipeDeckRootController = {
  getState: () => SwipeDeckState;
  swipe: (direction: SwipeDirection, motion?: SwipeDeckActionMotionRecipe) => boolean;
  undo: (motion?: SwipeDeckUndoMotionRecipe) => boolean;
};

type SwipeDeckStore = {
  readonly interaction: SwipeDeckInteraction;
  readonly actions: SwipeDeckActions;
  attach: (controller: SwipeDeckRootController) => () => void;
  getSnapshot: () => SwipeDeckState;
  setSnapshot: (nextState: SwipeDeckState) => void;
  subscribe: (listener: () => void) => () => void;
};

type DeckStoreKey = string | typeof DEFAULT_DECK_KEY;

type GetSwipeDeckStore = (id?: string) => SwipeDeckStore;

export type SwipeDeckRegistry = {
  getStore: GetSwipeDeckStore;
  useDeckState: (id?: string) => SwipeDeckState;
  useDeckActions: (id?: string) => SwipeDeckActions;
  useDeckInteraction: (id?: string) => SwipeDeckInteraction;
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
    translationX: makeMutable(0),
    translationY: makeMutable(0),
    isDragging: makeMutable(false),
  };
}

function resetInteraction(interaction: SwipeDeckInteraction) {
  interaction.progress.set(0);
  interaction.signedProgress.set(0);
  interaction.direction.set(0);
  interaction.translationX.set(0);
  interaction.translationY.set(0);
  interaction.isDragging.set(false);
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

function createStore(label: string): SwipeDeckStore {
  const snapshotStore = createSnapshotStore();
  const controllerSlot = createControllerSlot(label);
  const interaction = createInteraction();
  const actions: SwipeDeckActions = {
    swipeLeft: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckActionMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.swipe('left', motion) ?? false;
    },
    swipeRight: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckActionMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.swipe('right', motion) ?? false;
    },
    undo: (motionOrEvent?: unknown) => {
      const motion = isSwipeDeckUndoMotionRecipe(motionOrEvent) ? motionOrEvent : undefined;

      return controllerSlot.getController()?.undo(motion) ?? false;
    },
  };

  return {
    interaction,
    actions,
    attach: (nextController) => {
      controllerSlot.attachController(nextController);
      snapshotStore.setSnapshot(nextController.getState());

      return () => {
        if (!controllerSlot.detachController(nextController)) {
          return;
        }

        resetInteraction(interaction);
        snapshotStore.resetSnapshot();
      };
    },
    getSnapshot: snapshotStore.getSnapshot,
    setSnapshot: snapshotStore.setSnapshot,
    subscribe: snapshotStore.subscribe,
  };
}

function createRegistryHooks(getStore: GetSwipeDeckStore) {
  function useDeckStore(id?: string): SwipeDeckStore {
    return useMemo(() => getStore(id), [id]);
  }

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
  };
}

export function createSwipeDeckRegistry(): SwipeDeckRegistry {
  const stores = new Map<DeckStoreKey, SwipeDeckStore>();

  const getStore = (id?: string) => {
    const deckStoreKey = getDeckStoreKey(id);
    const existingStore = stores.get(deckStoreKey);

    if (existingStore) {
      return existingStore;
    }

    const store = createStore(getDeckStoreLabel(id));
    stores.set(deckStoreKey, store);

    return store;
  };

  const hooks = createRegistryHooks(getStore);

  return {
    getStore,
    useDeckState: hooks.useDeckState,
    useDeckActions: hooks.useDeckActions,
    useDeckInteraction: hooks.useDeckInteraction,
  };
}

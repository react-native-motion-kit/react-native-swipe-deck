export type EventSnapshot<T> = {
  readonly event: T;
  readonly id: number;
};

export type EventStore<TEvents> = {
  addListener: <K extends keyof TEvents>(
    eventName: K,
    listener: (event: TEvents[K]) => void,
  ) => () => void;
  clear: () => void;
  emit: <K extends keyof TEvents>(eventName: K, event: TEvents[K]) => void;
  getSnapshot: <K extends keyof TEvents>(eventName: K) => EventSnapshot<TEvents[K]> | null;
  subscribeSnapshot: <K extends keyof TEvents>(eventName: K, listener: () => void) => () => void;
};

export function createEventStore<TEvents>(): EventStore<TEvents> {
  let snapshotId = 0;
  const snapshots = new Map<keyof TEvents, EventSnapshot<TEvents[keyof TEvents]>>();
  const listenersByEvent = new Map<keyof TEvents, Set<(event: TEvents[keyof TEvents]) => void>>();
  const snapshotListenersByEvent = new Map<keyof TEvents, Set<() => void>>();

  const notifySnapshotListeners = (eventName: keyof TEvents) => {
    const listeners = snapshotListenersByEvent.get(eventName);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener();
    }
  };

  return {
    addListener: (eventName, listener) => {
      const listeners = listenersByEvent.get(eventName) ?? new Set();

      listeners.add(listener as (event: TEvents[keyof TEvents]) => void);
      listenersByEvent.set(eventName, listeners);

      return () => {
        listeners.delete(listener as (event: TEvents[keyof TEvents]) => void);

        if (listeners.size === 0) {
          listenersByEvent.delete(eventName);
        }
      };
    },
    clear: () => {
      if (snapshots.size === 0) {
        return;
      }

      const eventNames = Array.from(snapshots.keys());

      snapshots.clear();

      for (const eventName of eventNames) {
        notifySnapshotListeners(eventName);
      }
    },
    emit: (eventName, event) => {
      snapshotId += 1;
      snapshots.set(eventName, { event, id: snapshotId });
      notifySnapshotListeners(eventName);

      const listeners = listenersByEvent.get(eventName);

      if (!listeners) {
        return;
      }

      for (const listener of listeners) {
        listener(event);
      }
    },
    getSnapshot: (eventName) => {
      return (
        (snapshots.get(eventName) as EventSnapshot<TEvents[typeof eventName]> | undefined) ?? null
      );
    },
    subscribeSnapshot: (eventName, listener) => {
      const listeners = snapshotListenersByEvent.get(eventName) ?? new Set();

      listeners.add(listener);
      snapshotListenersByEvent.set(eventName, listeners);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          snapshotListenersByEvent.delete(eventName);
        }
      };
    },
  };
}

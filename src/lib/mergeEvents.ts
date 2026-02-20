type MergeEvent =
  | { status: "done"; r2Key: string }
  | { status: "error"; error: string };

type Listener = (event: MergeEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export const onMergeComplete = (
  perspectiveId: string,
  listener: Listener,
): (() => void) => {
  let set = listeners.get(perspectiveId);
  if (!set) {
    set = new Set();
    listeners.set(perspectiveId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(perspectiveId);
  };
};

export const emitMergeComplete = (
  perspectiveId: string,
  event: MergeEvent,
) => {
  const set = listeners.get(perspectiveId);
  if (!set) return;
  for (const listener of set) {
    listener(event);
  }
  listeners.delete(perspectiveId);
};

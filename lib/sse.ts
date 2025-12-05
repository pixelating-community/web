type ConnectionController = ReadableStreamDefaultController;

const connections = new Map<string, Set<ConnectionController>>();

export function addSseConnection(
  perspectiveId: string,
  controller: ConnectionController,
) {
  if (!connections.has(perspectiveId)) {
    connections.set(perspectiveId, new Set());
  }
  connections.get(perspectiveId)?.add(controller);
}

export function removeSseConnection(
  perspectiveId: string,
  controller: ConnectionController,
) {
  const set = connections.get(perspectiveId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) connections.delete(perspectiveId);
}

export function broadcastSse(perspectiveId: string, event: unknown) {
  const set = connections.get(perspectiveId);
  if (!set) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = new TextEncoder().encode(data);

  for (const controller of set) {
    try {
      controller.enqueue(encoded);
    } catch {
      set.delete(controller);
    }
  }

  if (set.size === 0) connections.delete(perspectiveId);
}

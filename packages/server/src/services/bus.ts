/**
 * In-process event bus for live toasts (GDD §10). A single-process pub/sub keyed by
 * account id — the SSE stream route subscribes a writer, emit points publish. This is
 * deliberately in-memory (one app process at launch scale); a Redis fan-out is the
 * multi-node upgrade. Events are best-effort: a dropped toast is never a correctness
 * problem (the durable record is the inbox/feed row).
 */

export interface LiveEvent {
  kind: string;
  body: string;
}

type Sink = (event: LiveEvent) => void;

const subscribers = new Map<string, Set<Sink>>();

/** Register a writer for an account's live events; returns an unsubscribe fn. */
export function subscribe(accountId: string, sink: Sink): () => void {
  let set = subscribers.get(accountId);
  if (!set) {
    set = new Set();
    subscribers.set(accountId, set);
  }
  set.add(sink);
  return () => {
    const s = subscribers.get(accountId);
    if (!s) return;
    s.delete(sink);
    if (s.size === 0) subscribers.delete(accountId);
  };
}

/** Push an event to every open stream for an account (no-op if none). */
export function publish(accountId: string, event: LiveEvent): void {
  const set = subscribers.get(accountId);
  if (!set) return;
  for (const sink of set) {
    try {
      sink(event);
    } catch {
      /* a broken pipe is dropped; the inbox/feed row is the source of truth */
    }
  }
}

/** Test/introspection helper: how many live streams an account currently has. */
export function subscriberCount(accountId: string): number {
  return subscribers.get(accountId)?.size ?? 0;
}

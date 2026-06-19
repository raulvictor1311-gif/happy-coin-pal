// Offline sync queue for transactions added while offline.
// Items are persisted to localStorage and flushed automatically when the
// connection returns. Since this app has no remote backend yet, "sync" simply
// marks the item as synced — when a backend is added, replace `syncItem`
// with the real network call. The queue itself, retries, and online-trigger
// stay the same.

import { useSyncExternalStore } from "react";
import { isOnline, subscribeNetwork, checkOnline } from "./network-status";

export interface QueueItem {
  id: string;
  txId: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const KEY = "finlux:sync-queue:v1";
const listeners = new Set<() => void>();
let queue: QueueItem[] = [];
let loaded = false;
let flushing = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) queue = JSON.parse(raw);
  } catch {}
  subscribeNetwork((online) => {
    if (online) void flush();
  });
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {}
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function enqueueTx(txId: string) {
  load();
  queue = [
    ...queue,
    { id: crypto.randomUUID(), txId, createdAt: new Date().toISOString(), attempts: 0 },
  ];
  emit();
  if (isOnline()) void flush();
}

async function syncItem(_item: QueueItem): Promise<void> {
  // Placeholder: this is where a real POST /transactions would go.
  // For now we treat "online" as a successful sync so the queue can drain.
  const ok = await checkOnline();
  if (!ok) throw new Error("offline");
}

export async function flush() {
  load();
  if (flushing || queue.length === 0) return;
  if (!(await checkOnline())) return;
  flushing = true;
  try {
    const pending = [...queue];
    for (const item of pending) {
      try {
        await syncItem(item);
        queue = queue.filter((q) => q.id !== item.id);
        emit();
      } catch (err) {
        const i = queue.findIndex((q) => q.id === item.id);
        if (i >= 0) {
          queue[i] = {
            ...queue[i],
            attempts: queue[i].attempts + 1,
            lastError: err instanceof Error ? err.message : "unknown",
          };
          emit();
        }
        break; // stop on first failure; we'll retry when back online
      }
    }
  } finally {
    flushing = false;
  }
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  load();
  return queue;
}

function getServerSnapshot(): QueueItem[] {
  return [];
}

export function useSyncQueue() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

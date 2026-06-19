// Robust online detection: combines navigator.onLine with a real network probe.
// navigator.onLine returns true even when the connection is captive/broken,
// so we also do a small periodic HEAD ping and listen to fetch failures.

import { useEffect, useState } from "react";

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();
let currentOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

const PING_URL = "/favicon.ico";
const PING_INTERVAL_MS = 20_000;
const PING_TIMEOUT_MS = 5_000;

function emit(next: boolean) {
  if (next === currentOnline) return;
  currentOnline = next;
  listeners.forEach((l) => l(next));
}

async function probe(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) return false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    const res = await fetch(`${PING_URL}?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(to);
    return res.ok || res.status === 0 || res.type === "opaque";
  } catch {
    return false;
  }
}

export async function checkOnline(): Promise<boolean> {
  const ok = await probe();
  emit(ok);
  return ok;
}

export function reportNetworkFailure() {
  // Called by app code when a fetch/request fails — triggers an immediate recheck.
  void checkOnline();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void checkOnline());
  window.addEventListener("offline", () => emit(false));
  window.addEventListener("focus", () => void checkOnline());
  pingTimer = setInterval(() => void checkOnline(), PING_INTERVAL_MS);
  void checkOnline();
}

export function subscribeNetwork(l: Listener) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isOnline() {
  return currentOnline;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(currentOnline);
  useEffect(() => {
    const unsub = subscribeNetwork(setOnline);
    return () => {
      unsub();
    };
  }, []);
  return online;
}

export function stopNetworkStatus() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
  started = false;
}

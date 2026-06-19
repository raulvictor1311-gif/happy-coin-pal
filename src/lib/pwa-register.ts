// Guarded service worker registration for Finlux PWA.
// Never registers in dev or inside Lovable preview/editor iframes.
// Supports ?sw=off as a kill-switch.

const SW_PATH = "/sw.js";

function shouldSkipRegistration(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }

  if (new URL(window.location.href).searchParams.get("sw") === "off") {
    return true;
  }

  return false;
}

async function unregisterMatching(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export function registerPwa(): void {
  if (shouldSkipRegistration()) {
    void unregisterMatching();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch((err) => {
      console.warn("[pwa] registration failed", err);
    });
  });
}

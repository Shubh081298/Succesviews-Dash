/**
 * storage.js
 * ─────────────────────────────────────────────────────────────
 * Thin persistence layer. Prefers a host-provided `window.storage`
 * API (get/set) if present — e.g. when embedded in a platform shell
 * — and falls back to an in-memory store otherwise (good enough for
 * a single browser session; swap in localStorage/a real backend
 * here if you need persistence across reloads in plain-browser use).
 */

const memoryStore = {};

export async function storageGet(key) {
  try {
    if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
      const res = await window.storage.get(key);
      return res ? res.value : null;
    }
  } catch (e) {
    /* fall through to memory store */
  }
  return memoryStore[key] || null;
}

export async function storageSet(key, jsonString) {
  memoryStore[key] = jsonString;
  try {
    if (typeof window !== "undefined" && window.storage && typeof window.storage.set === "function") {
      await window.storage.set(key, jsonString);
    }
  } catch (e) {
    /* memory store already updated above */
  }
}

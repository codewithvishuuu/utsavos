import { useRef } from "react";

interface PendingKey {
  fingerprint: string;
  key: string;
  at: number;
}

interface StoredRecord {
  fp: string;
  key: string;
  at: number;
}

type StoredMap = Record<string, StoredRecord>;

let fallbackCounter = 0;

const STORAGE_KEY = "utsavos.idempotency.v1";
// Matches the backend replay window (idempotency records expire after 24 hours).
const TTL_MS = 24 * 60 * 60 * 1000;

export function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `mutation-${Date.now()}-${fallbackCounter}`;
}

/**
 * Sync, dependency-free fingerprint digest (two 32-bit FNV-1a lanes = 64 bits).
 * Only this digest is stored, never the payload itself, so submitted values
 * (for example guest contact data) never land in sessionStorage.
 */
function fingerprintHash(value: string): string {
  let lane1 = 0x811c9dc5;
  let lane2 = 0x27d4eb2f;
  for (let index = 0; index < value.length; index += 1) {
    const byte = value.charCodeAt(index);
    lane1 = Math.imul(lane1 ^ byte, 0x01000193) >>> 0;
    lane2 = Math.imul(lane2 ^ (byte + index), 0x85ebca6b) >>> 0;
  }
  return lane1.toString(16).padStart(8, "0") + lane2.toString(16).padStart(8, "0");
}

/**
 * Per-tab discriminator for "the authenticated user": a digest of the CSRF
 * cookie, which is bound to the current session (and changes after re-login).
 * Stored hashed, so no token material reaches sessionStorage.
 */
function sessionScope(): string {
  try {
    const match = document.cookie.match(/(?:^|;\s*)utsavos_csrf=([^;]+)/);
    return match ? fingerprintHash(match[1]).slice(0, 12) : "anon";
  } catch {
    return "anon";
  }
}

function readStore(): StoredMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const entries: StoredMap = {};
    for (const [scope, value] of Object.entries(parsed as Record<string, unknown>)) {
      const record = value as Partial<StoredRecord> | null;
      if (
        typeof record?.key === "string" &&
        typeof record?.fp === "string" &&
        typeof record?.at === "number"
      ) {
        entries[scope] = { fp: record.fp, key: record.key, at: record.at };
      }
    }
    return entries;
  } catch {
    // Storage unavailable (disabled, quota, privacy mode): fall back to memory.
    return {};
  }
}

function writeStore(entries: StoredMap): void {
  try {
    const now = Date.now();
    const live = Object.fromEntries(
      Object.entries(entries).filter(([, record]) => now - record.at < TTL_MS)
    );
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(live));
  } catch {
    // Storage unavailable: the in-memory ref still covers this tab session.
  }
}

/**
 * One key follows one logical mutation until the server confirms success.
 * The pending key and fingerprint are mirrored to sessionStorage so a retry
 * after reload or navigation reuses the same key for the same payload.
 * Editing the payload starts a new logical mutation and therefore a new key.
 *
 * @param scope identifies the form/action, e.g. `event:<id>:quotes` or `account:events`.
 */
export function useIdempotencyMutation(scope: string) {
  const pending = useRef<PendingKey | null>(null);
  const fullScope = `${sessionScope()}|${scope}`;

  function keyFor(payload: unknown): string {
    const fingerprint = fingerprintHash(JSON.stringify(payload));
    if (pending.current?.fingerprint === fingerprint) return pending.current.key;
    const stored = readStore()[fullScope];
    if (stored && Date.now() - stored.at < TTL_MS && stored.fp === fingerprint) {
      pending.current = { fingerprint: stored.fp, key: stored.key, at: stored.at };
      return stored.key;
    }
    const key = newIdempotencyKey();
    pending.current = { fingerprint, key, at: Date.now() };
    const entries = readStore();
    entries[fullScope] = { fp: fingerprint, key, at: pending.current.at };
    writeStore(entries);
    return key;
  }

  function clear(): void {
    pending.current = null;
    const entries = readStore();
    if (entries[fullScope]) {
      delete entries[fullScope];
      writeStore(entries);
    }
  }

  function errorMessage(caught: unknown, fallback: string): string {
    const code =
      typeof caught === "object" && caught !== null && "code" in caught
        ? String(caught.code)
        : "";
    if (code === "idempotency_conflict") {
      // The next submit must use a new key, not repeat the conflicted one.
      clear();
    }
    return caught instanceof Error ? caught.message : fallback;
  }

  return { keyFor, clear, errorMessage };
}

const FALLBACK_USER_KEY = "guest";

export function resolveUserKey(userId?: string | null) {
  return userId && userId.trim().length > 0 ? userId : FALLBACK_USER_KEY;
}

export function timerStorageKey(userId?: string | null) {
  return `arcadia:timer:v1:${resolveUserKey(userId)}`;
}

export function pinnedFlashcardsStorageKey(userId?: string | null) {
  return `arcadia:pinned-flashcards:v1:${resolveUserKey(userId)}`;
}

export function clearUserLocalState(userId?: string | null) {
  if (typeof window === "undefined") return;
  const key = resolveUserKey(userId);
  window.localStorage.removeItem(timerStorageKey(key));
  window.localStorage.removeItem(pinnedFlashcardsStorageKey(key));
}

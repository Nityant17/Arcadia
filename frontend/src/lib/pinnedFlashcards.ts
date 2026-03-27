import { pinnedFlashcardsStorageKey } from "./userStorage";

export interface PinnedFlashcardItem {
  id: string;
  documentId: string;
  question: string;
  answer: string;
  language: string;
  createdAt: number;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildPinnedFlashcardId(documentId: string, question: string, answer: string) {
  return `fc_${hashString(`${documentId}::${question}::${answer}`)}`;
}

export function getPinnedFlashcards(userId?: string | null) {
  if (typeof window === "undefined") return [] as PinnedFlashcardItem[];

  try {
    const storageKey = pinnedFlashcardsStorageKey(userId);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is PinnedFlashcardItem =>
          typeof item?.id === "string" &&
          typeof item?.documentId === "string" &&
          typeof item?.question === "string" &&
          typeof item?.answer === "string" &&
          typeof item?.language === "string" &&
          typeof item?.createdAt === "number",
      )
      .sort((first, second) => second.createdAt - first.createdAt);
  } catch {
    return [];
  }
}

function savePinnedFlashcards(items: PinnedFlashcardItem[], userId?: string | null) {
  if (typeof window === "undefined") return;
  const storageKey = pinnedFlashcardsStorageKey(userId);
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function togglePinnedFlashcard(item: PinnedFlashcardItem, userId?: string | null) {
  const current = getPinnedFlashcards(userId);
  const existingIndex = current.findIndex((entry) => entry.id === item.id);

  if (existingIndex >= 0) {
    const next = current.filter((entry) => entry.id !== item.id);
    savePinnedFlashcards(next, userId);
    return false;
  }

  const next = [item, ...current];
  savePinnedFlashcards(next, userId);
  return true;
}

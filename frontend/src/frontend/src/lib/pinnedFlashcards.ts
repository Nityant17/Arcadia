export interface PinnedFlashcardItem {
  id: string;
  documentId: string;
  question: string;
  answer: string;
  language: string;
  createdAt: number;
}

const STORAGE_KEY = "arcadia:pinned-flashcards:v1";

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

export function getPinnedFlashcards() {
  if (typeof window === "undefined") return [] as PinnedFlashcardItem[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

function savePinnedFlashcards(items: PinnedFlashcardItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function togglePinnedFlashcard(item: PinnedFlashcardItem) {
  const current = getPinnedFlashcards();
  const existingIndex = current.findIndex((entry) => entry.id === item.id);

  if (existingIndex >= 0) {
    const next = current.filter((entry) => entry.id !== item.id);
    savePinnedFlashcards(next);
    return false;
  }

  const next = [item, ...current];
  savePinnedFlashcards(next);
  return true;
}
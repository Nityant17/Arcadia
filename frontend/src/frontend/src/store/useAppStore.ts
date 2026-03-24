import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/services/api";

export interface Language {
  id: string;
  name: string;
  flag: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export interface PinnedItem {
  id: string;
  label: string;
  to: string;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  hi: "🇮🇳",
  ta: "🇮🇳",
  te: "🇮🇳",
  mr: "🇮🇳",
  bn: "🇮🇳",
  gu: "🇮🇳",
  kn: "🇮🇳",
  ml: "🇮🇳",
};

const FALLBACK_LANGUAGES: Language[] = [
  { id: "en", name: "English", flag: "🇺🇸" },
  { id: "hi", name: "Hindi", flag: "🇮🇳" },
  { id: "ta", name: "Tamil", flag: "🇮🇳" },
  { id: "te", name: "Telugu", flag: "🇮🇳" },
  { id: "mr", name: "Marathi", flag: "🇮🇳" },
  { id: "bn", name: "Bengali", flag: "🇮🇳" },
  { id: "gu", name: "Gujarati", flag: "🇮🇳" },
  { id: "kn", name: "Kannada", flag: "🇮🇳" },
  { id: "ml", name: "Malayalam", flag: "🇮🇳" },
];

interface AppState {
  authToken: string | null;
  currentUser: CurrentUser | null;
  currentLanguage: Language | null;
  languages: Language[];
  pinnedItems: PinnedItem[];
  // actions
  setAuthToken: (token: string | null) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  setCurrentLanguage: (lang: Language | null) => void;
  setLanguages: (langs: Language[]) => void;
  setPinnedItems: (items: PinnedItem[]) => void;
  refreshPinnedItems: () => Promise<void>;
  logout: () => void;
  initLanguages: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      authToken: null,
      currentUser: null,
      currentLanguage: null,
      languages: FALLBACK_LANGUAGES,
      pinnedItems: [],

      setAuthToken: (token) => set({ authToken: token }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentLanguage: (lang) => set({ currentLanguage: lang }),
      setLanguages: (langs) => set({ languages: langs }),
      setPinnedItems: (items) => set({ pinnedItems: items }),

      refreshPinnedItems: async () => {
        try {
          const response = await apiClient.listPinnedDocuments();
          set({ pinnedItems: response.data });
        } catch {
          set({ pinnedItems: [] });
        }
      },

      logout: () =>
        set({
          authToken: null,
          currentUser: null,
          currentLanguage: null,
        }),

      initLanguages: async () => {
        try {
          const response = await apiClient.getLanguages();
          const backendLanguages = Object.entries(response.data).map(
            ([id, name]) => ({
              id,
              name,
              flag: LANGUAGE_FLAGS[id] ?? "🌐",
            }),
          );

          const current = get().currentLanguage;
          const selected =
            backendLanguages.find((lang) => lang.id === current?.id) ??
            backendLanguages[0] ??
            FALLBACK_LANGUAGES[0];

          set({
            languages: backendLanguages.length
              ? backendLanguages
              : FALLBACK_LANGUAGES,
            currentLanguage: selected,
          });
        } catch {
          const current = get().currentLanguage;
          if (!current) {
            set({ currentLanguage: FALLBACK_LANGUAGES[0] });
          }
          set({
            languages: FALLBACK_LANGUAGES,
            currentLanguage: current ?? FALLBACK_LANGUAGES[0],
          });
        }
      },
    }),
    {
      name: "arcadia-app-store",
      partialize: (state) => ({
        authToken: state.authToken,
        currentUser: state.currentUser,
        currentLanguage: state.currentLanguage,
      }),
    },
  ),
);

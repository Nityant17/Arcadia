import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/services/api";
import { clearUserLocalState } from "@/lib/userStorage";

export interface Language {
  id: string;
  name: string;
  flag: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  authProvider?: string;
  emailVerified?: boolean;
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
  uiOverlayActive: boolean;
  // actions
  setAuthToken: (token: string | null) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  setCurrentLanguage: (lang: Language | null) => void;
  setLanguages: (langs: Language[]) => void;
  setPinnedItems: (items: PinnedItem[]) => void;
  setUiOverlayActive: (active: boolean) => void;
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
      uiOverlayActive: false,

      setAuthToken: (token) => set({ authToken: token }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentLanguage: (lang) => set({ currentLanguage: lang }),
      setLanguages: (langs) => set({ languages: langs }),
      setPinnedItems: (items) => set({ pinnedItems: items }),
      setUiOverlayActive: (active) => set({ uiOverlayActive: active }),

      refreshPinnedItems: async () => {
        try {
          const response = await apiClient.listPinnedDocuments();
          set({ pinnedItems: response.data });
        } catch {
          set({ pinnedItems: [] });
        }
      },

      logout: () => {
        const currentUser = get().currentUser;
        clearUserLocalState(currentUser?.id);
        set({
          authToken: null,
          currentUser: null,
          currentLanguage: null,
          uiOverlayActive: false,
        });
      },

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
            backendLanguages.find((lang) => lang.id === "en") ??
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

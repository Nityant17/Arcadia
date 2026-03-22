import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/services/api";

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

const MOCK_LANGUAGES: Language[] = [
  { id: "ja", name: "Japanese", flag: "🇯🇵" },
  { id: "es", name: "Spanish", flag: "🇪🇸" },
  { id: "fr", name: "French", flag: "🇫🇷" },
  { id: "zh", name: "Mandarin", flag: "🇨🇳" },
  { id: "ko", name: "Korean", flag: "🇰🇷" },
  { id: "de", name: "German", flag: "🇩🇪" },
];

interface AppState {
  authToken: string | null;
  currentUser: CurrentUser | null;
  currentLanguage: Language | null;
  languages: Language[];
  // actions
  setAuthToken: (token: string | null) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  setCurrentLanguage: (lang: Language | null) => void;
  setLanguages: (langs: Language[]) => void;
  logout: () => void;
  initLanguages: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      authToken: null,
      currentUser: null,
      currentLanguage: null,
      languages: MOCK_LANGUAGES,

      setAuthToken: (token) => set({ authToken: token }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentLanguage: (lang) => set({ currentLanguage: lang }),
      setLanguages: (langs) => set({ languages: langs }),

      logout: () =>
        set({
          authToken: null,
          currentUser: null,
          currentLanguage: null,
        }),

      initLanguages: async () => {
        try {
          const response = await api.languages.list();
          const backendLanguages = response.data ?? {};

          const mappedLanguages: Language[] = Object.entries(backendLanguages).map(
            ([id, name]) => ({
              id,
              name: String(name),
              flag: "🌐",
            }),
          );

          if (mappedLanguages.length > 0) {
            const current = get().currentLanguage;
            set({
              languages: mappedLanguages,
              currentLanguage:
                current && mappedLanguages.some((lang) => lang.id === current.id)
                  ? current
                  : mappedLanguages[0],
            });
            return;
          }

          const current = get().currentLanguage;
          if (!current) {
            set({ currentLanguage: MOCK_LANGUAGES[0] });
          }
        } catch {
          set({
            languages: MOCK_LANGUAGES,
            currentLanguage: MOCK_LANGUAGES[0],
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

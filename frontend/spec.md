# Arcadia — Phase 2: Full Feature Parity

## Current State
Phase 1 delivered: routing shell (9 routes via TanStack Router), AppShell with glassmorphic nav + language selector + auth guard, AuthPage (Login/Register with loading states), HomePage with hero + BentoGrid (8 cards), and 7 placeholder page stubs. Zustand store persists authToken, currentUser, currentLanguage.

## Requested Changes (Diff)

### Add
- `src/frontend/src/hooks/useAudioPlayer.ts` — robust TTS hook wrapping an HTMLAudioElement. Must: abort in-flight audio before starting new playback (race condition prevention), expose `play(text)`, `stop()`, `isPlaying`, and accept an `onComplete` callback.
- `src/frontend/src/hooks/useChatMessages.ts` — manages note-scoped chat messages array in component state. Exposes a `retranslateAll(newLang)` function that iterates assistant messages and calls `POST /api/translate` for each, updating them in place.
- Full NotesPage: two-panel layout — left panel is a scrollable note list with Create/Delete actions; right panel splits vertically into a note editor (textarea) and a note-scoped chat panel. Chat messages are local state. When `currentLanguage` changes (useEffect dep), call `retranslateAll` to re-translate all assistant messages. Each chat message has a TTS play button wired to `useAudioPlayer`.
- Full ChatPage: standalone full-height AI conversation UI (no note scope). Message bubbles, TTS play button per assistant message, input field with send. Uses `useAudioPlayer`. API: `POST /api/chat`.
- Full QuizPage: Step 1 — difficulty selector (3 tiers: Recall, Application, Analysis). Step 2 — quiz in progress (4-option MCQ, one question at a time, progress indicator). Step 3 — detailed review panel showing each question with selected answer vs correct answer + explanation. Includes an Interactive Whiteboard Canvas panel (HTML5 canvas, draw with mouse/touch, clear button) as a hint aid. API: `POST /api/quiz/generate`.
- Full StudyPage: tabbed layout with 3 tabs — Cheatsheets (formatted card with key grammar rules), Flashcards (flip animation cards front/back, prev/next controls), Mermaid.js Diagrams (renders diagram from mermaid DSL string using the `mermaid` npm package).
- Full PlannerPage: weekly timetable grid — 7 columns (Mon–Sun), time rows (8 AM–9 PM in 1-hour slots). Cells are clickable to add/remove study sessions. Session blocks shown as colored badges inside cells. No external calendar library.
- Full ChallengePage: Lobby system with two flows — Create Room (generates a 6-char room code, shows participant list with status badges: waiting/ready) and Join Room (enter room code, join participant list). Participants can toggle Ready. Host can Start when all ready. Uses local state to simulate participant tracking.
- Full DashboardPage: full-width bento grid with — Topic Mastery panel (list of topics with progress bar per topic, sourced from `GET /api/progress`), Stats row (total docs, current streak, words learned), Progress Reset action button (`DELETE /api/progress` with confirmation dialog, loading/error/success states).

### Modify
- `useAppStore.ts` — no changes needed; language state already present.
- `vite.config.js` — proxy already has `/api` → 4943. Add `/static` proxy entry pointing to same target.

### Remove
- All 7 placeholder page stub contents (NotesPage, ChatPage, QuizPage, StudyPage, PlannerPage, ChallengePage, DashboardPage) — replaced with full implementations.

## Implementation Plan
1. Add `mermaid` to frontend package.json dependencies.
2. Update vite.config.js to also proxy `/static`.
3. Create `useAudioPlayer` hook: manages single HTMLAudioElement ref, stop-before-play, onComplete callback.
4. Create `useChatMessages` hook: local message array + retranslateAll loop.
5. Implement NotesPage (two-panel, note-scoped chat, language re-translation, TTS).
6. Implement ChatPage (full-page chat, TTS).
7. Implement QuizPage (3-tier, MCQ, review panel, whiteboard canvas).
8. Implement StudyPage (tabs: Cheatsheets, Flashcards with CSS flip, Mermaid diagrams).
9. Implement PlannerPage (timetable grid, click-to-add).
10. Implement ChallengePage (lobby: create/join, participant status).
11. Implement DashboardPage (bento grid, mastery bars, reset action).
12. Every API call must have loading/error/success states. Graceful fallback to mock data when API returns non-OK (since FastAPI backend may not be reachable in ICP production).
13. Validate (lint + typecheck + build).

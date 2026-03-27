import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { timerStorageKey } from "@/lib/userStorage";

type TimerContextType = {
  timeLeft: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setTime: (seconds: number) => void;
};

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const currentUserId = useAppStore((s) => s.currentUser?.id);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const storageKey = useMemo(() => timerStorageKey(currentUserId), [currentUserId]);

    useEffect(() => {
        if (!isRunning) return;

    const interval = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                setIsRunning(false);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

        return () => clearInterval(interval);
    }, [isRunning]);

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        setTimeLeft(saved ? Number(saved) : 0);
        setIsRunning(false);
    }, [storageKey]);

    useEffect(() => {
        localStorage.setItem(storageKey, String(timeLeft));
    }, [storageKey, timeLeft]);

  return (
    <TimerContext.Provider
      value={{
        timeLeft,
        isRunning,
        start: () => setIsRunning(true),
        pause: () => setIsRunning(false),
        reset: () => {
          setIsRunning(false);
          setTimeLeft(0);
        },
        setTime: setTimeLeft,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
};

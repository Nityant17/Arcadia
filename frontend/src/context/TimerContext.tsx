import { createContext, useContext, useEffect, useState } from "react";

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
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

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
        const saved = localStorage.getItem("timer");
        if (saved) setTimeLeft(Number(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem("timer", String(timeLeft));
    }, [timeLeft]);

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

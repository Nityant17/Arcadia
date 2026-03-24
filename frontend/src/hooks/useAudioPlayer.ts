import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/services/api";
import { toast } from "sonner";

let sharedAudio: HTMLAudioElement | null = null;
let sharedPlayingId: string | null = null;
let sharedLoadingId: string | null = null;
const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach((listener) => listener());
}

function cleanupAudio() {
  if (!sharedAudio) return;
  sharedAudio.pause();
  sharedAudio.currentTime = 0;
  sharedAudio = null;
}

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(sharedPlayingId);
  const [loadingId, setLoadingId] = useState<string | null>(sharedLoadingId);

  useEffect(() => {
    const sync = () => {
      setPlayingId(sharedPlayingId);
      setLoadingId(sharedLoadingId);
    };
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    sharedPlayingId = null;
    sharedLoadingId = null;
    notifyAll();
  }, []);

  const play = useCallback(
    async (text: string, messageId: string, language: string) => {
      if (!text.trim()) return;

      if (sharedPlayingId && sharedPlayingId !== messageId) {
        cleanupAudio();
      }

      if (sharedPlayingId === messageId && sharedAudio) {
        stop();
        return;
      }

      sharedLoadingId = messageId;
      sharedPlayingId = null;
      notifyAll();

      try {
        const response = await apiClient.tts(text, language);
        const audioUrl = response.data.audio_url;

        cleanupAudio();

        sharedAudio = new Audio(audioUrl);
        sharedPlayingId = messageId;
        sharedLoadingId = null;
        notifyAll();

        sharedAudio.onended = () => {
          sharedPlayingId = null;
          sharedLoadingId = null;
          cleanupAudio();
          notifyAll();
        };

        sharedAudio.onerror = () => {
          sharedPlayingId = null;
          sharedLoadingId = null;
          cleanupAudio();
          notifyAll();
          toast.error("Failed to generate audio: The browser could not play the generated audio.");
        };

        await sharedAudio.play();
      } catch (error) {
        sharedPlayingId = null;
        sharedLoadingId = null;
        cleanupAudio();
        notifyAll();
        toast.error(getApiErrorMessage(error, "Failed to generate audio"));
      }
    },
    [stop],
  );

  return {
    play,
    stop,
    playingId,
    loadingId,
    isPlaying: Boolean(playingId),
  };
}

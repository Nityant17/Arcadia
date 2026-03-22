import { api } from "@/services/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

let activeAudio: HTMLAudioElement | null = null;
let activeAudioId: string | null = null;

function stopActiveAudio() {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
  activeAudioId = null;
}

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const lastPlayRequestRef = useRef(0);

  const stop = useCallback(() => {
    stopActiveAudio();
    setIsPlaying(false);
    setPlayingId(null);
  }, []);

  const play = useCallback(
    async (text: string, id: string, language = "en") => {
      if (!text.trim()) {
        return;
      }

      const requestId = Date.now();
      lastPlayRequestRef.current = requestId;

      stop();

      try {
        const response = await api.tts.synthesize({ text, language });
        const audioUrl = response.data?.audio_url;

        if (!audioUrl) {
          throw new Error("Audio URL not received");
        }

        if (lastPlayRequestRef.current !== requestId) {
          return;
        }

        const resolvedUrl =
          audioUrl.startsWith("http://") || audioUrl.startsWith("https://")
            ? audioUrl
            : `${window.location.origin}${audioUrl}`;

        const audio = new Audio(resolvedUrl);
        activeAudio = audio;
        activeAudioId = id;
        setPlayingId(id);

        audio.onended = () => {
          if (activeAudioId === id) {
            stop();
          }
        };

        audio.onerror = () => {
          if (activeAudioId === id) {
            stop();
            toast.error("Unable to play generated audio");
          }
        };

        await audio.play();
        if (activeAudioId === id) {
          setIsPlaying(true);
        }
      } catch {
        if (lastPlayRequestRef.current === requestId) {
          stop();
        }
        toast.error("Text-to-speech failed");
      }
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { play, stop, isPlaying, playingId };
}

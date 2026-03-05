/**
 * React hook for the Music File player. Uses the RN-only MusicFilePlayer library;
 * no direct NativeModules in your component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MusicFilePlayer,
  type MusicFileEventCallbacks,
} from '../lib/MusicFilePlayer';

export interface UseMusicFilePlayerOptions {
  /** Called when volume level (0–100) updates during playback. */
  onVolume?: (level: number) => void;
  /** Called when playback finishes. */
  onComplete?: () => void;
  /** Called when playback errors. */
  onError?: (message: string) => void;
}

export interface UseMusicFilePlayerResult {
  /** Whether the native player is available (Android). */
  isAvailable: boolean;
  /** Start playback for the given file URI. */
  startPlayback: (uri: string) => void;
  /** Stop playback. */
  stopPlayback: () => void;
  /** Current volume level 0–100 (from native events). */
  volume: number;
  /** Whether playback is active (you set this when calling start/stop). */
  isPlaying: boolean;
  /** Last error message, if any. */
  error: string | null;
  /** Set isPlaying (e.g. after start/complete/error). */
  setIsPlaying: (playing: boolean) => void;
}

/**
 * Hook to control the Music File player from React. All native (Kotlin) usage
 * is encapsulated; use this so your component code stays fully in RN.
 */
export function useMusicFilePlayer(
  options: UseMusicFilePlayerOptions = {}
): UseMusicFilePlayerResult {
  const [volume, setVolume] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stopPlayback = useCallback(() => {
    MusicFilePlayer.stopPlayback();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setVolume(0);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const startPlayback = useCallback(
    (uri: string) => {
      if (!MusicFilePlayer.isAvailable()) return;

      unsubscribeRef.current?.();

      const callbacks: MusicFileEventCallbacks = {
        onVolume: (level) => {
          setVolume(level);
          optionsRef.current.onVolume?.(level);
        },
        onComplete: () => {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          setIsPlaying(false);
          setVolume(0);
          optionsRef.current.onComplete?.();
        },
        onError: (message) => {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          setError(message);
          setIsPlaying(false);
          setVolume(0);
          optionsRef.current.onError?.(message);
        },
      };

      unsubscribeRef.current = MusicFilePlayer.subscribe(callbacks);
      setError(null);
      MusicFilePlayer.startPlayback(uri);
    },
    []
  );

  return {
    isAvailable: MusicFilePlayer.isAvailable(),
    startPlayback,
    stopPlayback,
    volume,
    isPlaying,
    error,
    setIsPlaying,
  };
}

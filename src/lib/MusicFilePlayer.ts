/**
 * React Native API for the native Music File player (ExoPlayer + volume analysis).
 * All native (Kotlin) code lives in the Android module; this module is the only
 * place that touches NativeModules / NativeEventEmitter. Use this from your
 * React components so your app code stays fully in RN (TypeScript).
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const nativeModule =
  Platform.OS === 'android'
    ? (NativeModules as { MusicFileModule?: NativeMusicFileModule }).MusicFileModule
    : null;

interface NativeMusicFileModule {
  startPlayback: (uri: string) => void;
  stopPlayback: () => void;
}

export const MusicFileEvents = {
  Volume: 'MusicFileVolume',
  Complete: 'MusicFileComplete',
  Error: 'MusicFileError',
} as const;

export type MusicFileEventCallbacks = {
  onVolume?: (level: number) => void;
  onComplete?: () => void;
  onError?: (message: string) => void;
};

/**
 * Whether the native Music File player is available (Android only).
 */
export function isMusicFilePlayerAvailable(): boolean {
  return Platform.OS === 'android' && nativeModule != null;
}

/**
 * Start playing an audio file by URI. Events are delivered to the current
 * subscription (see subscribe).
 */
export function startPlayback(uri: string): void {
  if (!nativeModule) return;
  const normalizedUri =
    uri.startsWith('content://') || uri.startsWith('file://')
      ? uri
      : `file://${uri}`;
  nativeModule.startPlayback(normalizedUri);
}

/**
 * Stop playback and release the player.
 */
export function stopPlayback(): void {
  if (!nativeModule) return;
  nativeModule.stopPlayback();
}

type Subscription = { remove: () => void };

/**
 * Subscribe to Music File player events. Returns an unsubscribe function.
 * Only one subscription is active at a time per app; calling subscribe
 * again replaces the previous subscription.
 */
export function subscribe(callbacks: MusicFileEventCallbacks): () => void {
  if (!nativeModule) return () => {};

  const emitter = new NativeEventEmitter(nativeModule as any);
  const subs: Subscription[] = [];

  if (callbacks.onVolume) {
    subs.push(
      emitter.addListener(MusicFileEvents.Volume, (level: number) => {
        callbacks.onVolume?.(Math.max(0, Math.min(100, Math.round(level))));
      })
    );
  }
  if (callbacks.onComplete) {
    subs.push(emitter.addListener(MusicFileEvents.Complete, callbacks.onComplete));
  }
  if (callbacks.onError) {
    subs.push(emitter.addListener(MusicFileEvents.Error, callbacks.onError));
  }

  return () => {
    subs.forEach((s) => s.remove());
  };
}

export const MusicFilePlayer = {
  isAvailable: isMusicFilePlayerAvailable,
  startPlayback,
  stopPlayback,
  subscribe,
  Events: MusicFileEvents,
} as const;

export default MusicFilePlayer;

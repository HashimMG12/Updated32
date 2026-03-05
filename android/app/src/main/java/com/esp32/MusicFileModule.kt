package com.esp32

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Native module: play an audio file with ExoPlayer and emit volume levels (0-100)
 * to JS via PCM analysis (TeeAudioProcessor). Works when Visualizer does not
 * deliver data on the device.
 */
class MusicFileModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val TAG = "MusicFileModule"

    override fun getName(): String = "MusicFileModule"

    private val mainHandler = Handler(Looper.getMainLooper())
    private var exoPlayer: ExoPlayer? = null
    private var isPlaying = false

    private fun emitVolume(volume: Int) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_VOLUME, volume.coerceIn(0, 100))
    }

    private fun emitEvent(eventName: String, value: String) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, value)
    }

    @ReactMethod
    fun startPlayback(uri: String) {
        mainHandler.post {
            if (isPlaying) {
                stopPlayback()
            }
            val ctx = reactApplicationContext ?: return@post
            try {
                val renderersFactory = VolumeRenderersFactory(ctx) { level ->
                    mainHandler.post { emitVolume(level) }
                }
                val player = ExoPlayer.Builder(ctx)
                    .setRenderersFactory(renderersFactory)
                    .build()
                    .also {
                        it.addListener(object : Player.Listener {
                            override fun onPlaybackStateChanged(playbackState: Int) {
                                if (playbackState == Player.STATE_ENDED) {
                                    releasePlayer()
                                    emitEvent(EVENT_COMPLETE, "done")
                                }
                            }
                            override fun onPlayerError(error: PlaybackException) {
                                emitEvent(EVENT_ERROR, error.message ?: "Playback error")
                            }
                        })
                    }
                val mediaUri = when {
                    uri.startsWith("content://") || uri.startsWith("file://") -> Uri.parse(uri)
                    else -> Uri.parse("file://$uri")
                }
                player.setMediaItem(MediaItem.fromUri(mediaUri))
                player.prepare()
                player.playWhenReady = true
                isPlaying = true
                exoPlayer = player
                Log.d(TAG, "startPlayback (ExoPlayer): uri=$uri")
            } catch (e: Exception) {
                Log.e(TAG, "startPlayback error", e)
                emitEvent(EVENT_ERROR, e.message ?: "Failed to start playback")
            }
        }
    }

    private fun releasePlayer() {
        isPlaying = false
        try {
            exoPlayer?.release()
        } catch (_: Exception) { }
        exoPlayer = null
    }

    @ReactMethod
    fun stopPlayback() {
        mainHandler.post {
            releasePlayer()
            emitVolume(0)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        const val EVENT_VOLUME = "MusicFileVolume"
        const val EVENT_ERROR = "MusicFileError"
        const val EVENT_COMPLETE = "MusicFileComplete"
    }
}

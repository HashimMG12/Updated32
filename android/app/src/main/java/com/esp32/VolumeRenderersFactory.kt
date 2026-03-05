package com.esp32

import android.content.Context
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.audio.TeeAudioProcessor

/**
 * RenderersFactory that adds a TeeAudioProcessor to tap PCM and report volume (0-100)
 * so the app can emit MusicFileVolume events when Visualizer is not available.
 */
class VolumeRenderersFactory(
    context: Context,
    private val onLevel: (Int) -> Unit
) : DefaultRenderersFactory(context) {

    private val volumeSink = VolumeAnalyzerSink(onLevel)
    private val teeProcessor = TeeAudioProcessor(volumeSink)

    override fun buildAudioSink(
        context: Context,
        enableAudioTrackPlaybackParams: Boolean,
        enableOffload: Boolean
    ): DefaultAudioSink {
        return DefaultAudioSink.Builder(context)
            .setAudioProcessors(arrayOf(teeProcessor))
            .build()
    }
}

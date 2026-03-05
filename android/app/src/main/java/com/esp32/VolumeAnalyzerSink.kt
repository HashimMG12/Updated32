package com.esp32

import androidx.media3.exoplayer.audio.TeeAudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Sink for TeeAudioProcessor: receives every PCM buffer from ExoPlayer,
 * computes RMS level (0-100), and invokes [onLevel] for MusicFileVolume events.
 */
class VolumeAnalyzerSink(
    private val onLevel: (Int) -> Unit
) : TeeAudioProcessor.AudioBufferSink {

    override fun flush(sampleRateHz: Int, channelCount: Int, encoding: Int) {}

    override fun handleBuffer(buffer: ByteBuffer) {
        val size = buffer.remaining()
        if (size < 2) {
            onLevel(0)
            return
        }
        buffer.mark()
        val order = buffer.order()
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        val sampleCount = size / 2
        var sumSq = 0.0
        for (i in 0 until sampleCount) {
            val sample = buffer.short.toInt()
            sumSq += sample * sample
        }
        buffer.reset()
        buffer.order(order)

        val rms = if (sampleCount > 0) kotlin.math.sqrt(sumSq / sampleCount) else 0.0
        val normalized = (rms / 32768.0).toFloat().coerceIn(0f, 1f)
        val db = if (normalized <= 0f) -60f else 20f * kotlin.math.log10(normalized.toDouble()).toFloat()
        val clampedDb = db.coerceIn(-60f, 0f)
        val noiseFloor = -42f
        val level = if (clampedDb < noiseFloor) {
            0
        } else {
            val norm = ((clampedDb - noiseFloor) / (0f - noiseFloor)).coerceIn(0f, 1f)
            (norm * 100f).toInt().coerceIn(0, 100)
        }
        onLevel(level)
    }
}

import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, Platform, PermissionsAndroid} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';
import {
  checkConnection,
  setMode,
  setBrightnessPercent,
  sendBeat,
  sendColorByHex,
} from '../MqttService';
import {
  pick,
  types,
  errorCodes,
} from '@react-native-documents/picker';
import {useMusicFilePlayer} from '../hooks/useMusicFilePlayer';

const MAX_COMMANDS_PER_SECOND = 25;
const MIN_COMMAND_INTERVAL_MS = 1000 / MAX_COMMANDS_PER_SECOND; // ~40 ms

interface PickedFile {
  uri: string;
  name?: string;
}

const CameraScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);

  const lastSendTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const lastBeatTimeRef = useRef<number>(0);
  const lastVolumeRef = useRef<number>(0);
  const lastColorHexRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    checkConnectionStatus();

    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      stopPlaybackInternal();
    };
  }, []);

  const checkConnectionStatus = async () => {
    const connected = await checkConnection();
    if (!isMountedRef.current) {
      return;
    }
    setIsConnected(connected);
    if (!connected && isPlaying) {
      stopPlaybackInternal();
      setIsPlaying(false);
    }
  };

  const {
    isAvailable: isMusicFilePlayerAvailable,
    startPlayback: startMusicPlayback,
    stopPlayback: stopMusicPlayback,
    volume: volumePercent,
    isPlaying,
    setIsPlaying,
  } = useMusicFilePlayer({
    onVolume: (level) => {
      if (!isMountedRef.current) return;
      const now = Date.now();
      if (now - lastSendTimeRef.current < MIN_COMMAND_INTERVAL_MS) {
        return;
      }
      lastSendTimeRef.current = now;

      // level 0-100 -> brightness percent over MQTT
      setBrightnessPercent(level);
      let colorHex: string | null = null;

      // Pick from small palettes so we see more than two colors
      const loudPalette = ['#FFFFFF', '#FFD700', '#FFA500']; // white / gold / orange
      const midPalette = ['#32CD32', '#00CED1', '#1E90FF']; // green / cyan / blue
      const quietPalette = ['#8A2BE2', '#FF69B4', '#FF1493']; // purples / pinks

      const pickFrom = (palette: string[]) =>
        palette[Math.floor(level) % palette.length];

      let paletteName = 'none';
      if (level >= 85) {
        sendBeat();
        colorHex = pickFrom(loudPalette);
        paletteName = 'loud';
      } else if (level >= 70) {
        colorHex = pickFrom(loudPalette);
        paletteName = 'loud';
      } else if (level >= 55) {
        colorHex = pickFrom(midPalette);
        paletteName = 'mid';
      } else if (level >= 40) {
        colorHex = pickFrom(quietPalette);
        paletteName = 'quiet';
      }

      console.log(
        `[MusicFile] level=${level.toFixed(1)}% | palette=${paletteName} | color=${colorHex ?? 'none'} | prevColor=${lastColorHexRef.current ?? 'none'}`,
      );

      if (colorHex && colorHex !== lastColorHexRef.current) {
        console.log(
          `[MusicFile] COLOR CHANGE: ${lastColorHexRef.current ?? 'none'} -> ${colorHex}`,
        );
        sendColorByHex(colorHex);
        lastColorHexRef.current = colorHex;
      }
      const currentTime = Date.now();
      const lastVolume = lastVolumeRef.current;
      const risingFast = level - lastVolume > 25;
      const loudEnough = level > 40;
      const beatCooldownOk = currentTime - lastBeatTimeRef.current > 200;
      if (risingFast && loudEnough && beatCooldownOk) {
        console.log(
          `[MusicFile] BEAT detected: rise=${(level - lastVolume).toFixed(1)} | level=${level.toFixed(1)}`,
        );
        sendBeat();
        lastBeatTimeRef.current = currentTime;
      }
      lastVolumeRef.current = level;
    },
    onComplete: () => {
      if (!isMountedRef.current) return;
      setBrightnessPercent(10);
    },
    onError: (message: string) => {
      if (!isMountedRef.current) return;
      setBrightnessPercent(10);
      Alert.alert('Playback error', message ?? 'Failed to play audio file');
    },
  });

  const handlePickFile = async () => {
    try {
      const [res] = await pick({
        type: [types.audio],
      });

      if (!res) {
        return;
      }

      setSelectedFile({uri: res.uri, name: res.name ?? undefined});
    } catch (err: any) {
      if (err?.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.log('File pick error', err);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const startPlaybackInternal = async () => {
    if (!selectedFile) {
      Alert.alert('Select file', 'Please pick a music file first.');
      return;
    }

    if (!isMusicFilePlayerAvailable) {
      Alert.alert('Error', 'Music file playback is only available on Android.');
      return;
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone permission',
            message:
              'Required to analyze the music file so lights can react to the beat and volume.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission required',
            'Audio analysis needs this permission for music reactive lights.',
          );
          throw new Error('RECORD_AUDIO denied');
        }
      } catch (err) {
        console.log('RECORD_AUDIO permission error', err);
        return;
      }
    }

    try {
      setMode('manual');
      sendColorByHex('#00FFAA');
      startMusicPlayback(selectedFile.uri);
      setIsPlaying(true);
    } catch (error) {
      console.log('startPlaybackInternal error', error);
      Alert.alert('Error', 'Failed to start playback');
    }
  };

  const stopPlaybackInternal = () => {
    try {
      stopMusicPlayback();
      setBrightnessPercent(10);
    } catch (error) {
      console.log('stopPlaybackInternal error', error);
    }
  };

  const handleTogglePlayback = () => {
    if (!isConnected) {
      Alert.alert(
        'Not connected',
        'Please connect to the ESP32 hotspot or Wi‑Fi first.',
      );
      return;
    }

    if (isPlaying) {
      stopPlaybackInternal();
      setIsPlaying(false);
    } else {
      startPlaybackInternal()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Music File Reactive Lights</Text>
          <Text style={styles.subtitle}>
            Pick a music file and let ESP32 react to it. ESP code and UDP
            protocol stay the same.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {backgroundColor: isConnected ? '#4CAF50' : '#f44336'},
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? 'Connected to ESP32' : 'Not connected'}
            </Text>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileLabel}>Selected file</Text>
            <Text style={styles.fileName}>
              {selectedFile?.name || 'None'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.pickButton}
            activeOpacity={0.85}
            onPress={handlePickFile}>
            <Text style={styles.pickButtonText}>Pick Music File</Text>
          </TouchableOpacity>

          <View style={styles.volumeRow}>
            <Text style={styles.volumeLabel}>Music-driven level</Text>
            <Text style={styles.volumeValue}>{volumePercent}%</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.playButton,
              isPlaying ? styles.playButtonActive : styles.playButtonIdle,
              (!isConnected || !selectedFile) && styles.buttonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleTogglePlayback}
            disabled={!isConnected || !selectedFile}>
            <Text style={styles.playButtonText}>
              {isPlaying ? 'Stop Music File Mode' : 'Start Music File Mode'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Keep this screen open while music file mode is active. The app
            plays your selected file and sends UDP commands to 192.168.4.1:8888
            just like mic mode, but driven by the track instead of the
            microphone.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    paddingHorizontal: rw(24),
    paddingTop: rh(20),
  },
  header: {
    marginBottom: rh(20),
  },
  title: {
    fontSize: rh(24),
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: rh(8),
  },
  subtitle: {
    fontSize: rh(13),
    color: '#a0a0a0',
  },
  card: {
    paddingVertical: rh(20),
    paddingHorizontal: rw(18),
    backgroundColor: '#252542',
    borderRadius: rw(18),
    borderWidth: 1,
    borderColor: '#3d3d6b',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rh(12),
  },
  statusDot: {
    width: rw(12),
    height: rh(12),
    borderRadius: rw(6),
    marginRight: rw(8),
  },
  statusText: {
    fontSize: rh(14),
    fontWeight: '600',
    color: '#ffffff',
  },
  fileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: rh(8),
    marginBottom: rh(12),
  },
  fileLabel: {
    fontSize: rh(14),
    color: '#a0a0a0',
  },
  fileName: {
    flex: 1,
    marginLeft: rw(12),
    fontSize: rh(13),
    color: '#ffffff',
    textAlign: 'right',
  },
  pickButton: {
    marginTop: rh(4),
    marginBottom: rh(16),
    paddingVertical: rh(10),
    borderRadius: rw(999),
    backgroundColor: '#3498db',
    alignItems: 'center',
  },
  pickButtonText: {
    fontSize: rh(14),
    fontWeight: '600',
    color: '#ffffff',
  },
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: rh(4),
    marginBottom: rh(16),
  },
  volumeLabel: {
    fontSize: rh(14),
    color: '#a0a0a0',
  },
  volumeValue: {
    fontSize: rh(20),
    fontWeight: '700',
    color: '#00e0ff',
  },
  playButton: {
    marginTop: rh(4),
    paddingVertical: rh(14),
    borderRadius: rw(999),
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonIdle: {
    backgroundColor: '#00c853',
  },
  playButtonActive: {
    backgroundColor: '#f44336',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  playButtonText: {
    fontSize: rh(16),
    fontWeight: '700',
    color: '#ffffff',
  },
  hintText: {
    marginTop: rh(16),
    fontSize: rh(11),
    color: '#a0a0a0',
  },
});

export default CameraScreen;

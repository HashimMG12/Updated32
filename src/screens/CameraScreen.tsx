import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Buffer} from 'buffer';
import {rw, rh} from '../utils/responsive';
import {checkConnection, getEsp32IpAddress} from '../HttpService';
import {
  pick,
  types,
  errorCodes,
} from '@react-native-documents/picker';

declare const global: any;

if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

const MusicFileModule =
  Platform.OS === 'android'
    ? (NativeModules as any).MusicFileModule
    : null;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dgram = require('react-native-udp');

const UDP_PORT = 8888;
const MAX_COMMANDS_PER_SECOND = 25;
const MIN_COMMAND_INTERVAL_MS = 1000 / MAX_COMMANDS_PER_SECOND; // ~40 ms

interface PickedFile {
  uri: string;
  name?: string;
}

const CameraScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumePercent, setVolumePercent] = useState(0);
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);

  const socketRef = useRef<any | null>(null);
  const socketReadyRef = useRef<boolean>(false);
  const lastSendTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const volumeSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const completeSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const errorSubscriptionRef = useRef<{remove: () => void} | null>(null);
  const lastBeatTimeRef = useRef<number>(0);
  const lastVolumeRef = useRef<number>(0);
  const lastColorCategoryRef = useRef<string | null>(null);

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
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
        socketRef.current = null;
      }
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

  const ensureSocket = () => {
    if (socketRef.current) {
      return socketRef.current;
    }
    const socket = dgram.createSocket('udp4');
    socketReadyRef.current = false;
    try {
      socket.bind(0);
      socket.once('listening', () => {
        console.log('UDP socket listening (music file mode)');
        socketReadyRef.current = true;
      });
      socket.on('error', (err: any) => {
        console.log('UDP socket error', err);
      });
    } catch (err) {
      console.log('UDP bind error', err);
    }
    socketRef.current = socket;
    return socket;
  };

  const sendUdpCommand = (command: string, force: boolean = false) => {
    try {
      const now = Date.now();
      if (!force && now - lastSendTimeRef.current < MIN_COMMAND_INTERVAL_MS) {
        return;
      }
      lastSendTimeRef.current = now;

      const ip = getEsp32IpAddress();
      const socket = ensureSocket();
      if (!socketReadyRef.current) {
        // Socket not ready yet; skip this frame
        return;
      }
      const message = Buffer.from(command, 'utf8');

      console.log('UDP_FILE_DEBUG', {
        command,
        ip,
        UDP_PORT,
      });

      socket.send(message, 0, message.length, UDP_PORT, ip, (err: any) => {
        if (err) {
          console.log('UDP send error', err);
        }
      });
    } catch (error) {
      console.log('sendUdpCommand error', error);
    }
  };

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

  const removeEventSubscriptions = () => {
    volumeSubscriptionRef.current?.remove();
    volumeSubscriptionRef.current = null;
    completeSubscriptionRef.current?.remove();
    completeSubscriptionRef.current = null;
    errorSubscriptionRef.current?.remove();
    errorSubscriptionRef.current = null;
  };

  const startPlaybackInternal = async () => {
    if (!selectedFile) {
      Alert.alert('Select file', 'Please pick a music file first.');
      return;
    }

    if (Platform.OS !== 'android' || !MusicFileModule) {
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
      sendUdpCommand('MODE:MANUAL', true);
      sendUdpCommand('COLOR:00FFAA', true);

      removeEventSubscriptions();
      const emitter = new NativeEventEmitter(MusicFileModule);

      volumeSubscriptionRef.current = emitter.addListener(
        'MusicFileVolume',
        (level: number) => {
          if (!isMountedRef.current) {
            return;
          }

          const volume = Math.max(0, Math.min(100, Math.round(level)));
          setVolumePercent(volume);
          sendUdpCommand(`VOLUME:${volume}`);

          // Match mic screen behaviour: color-reactive bands + BEAT pulses
          let category: string | null = null;
          let colorCommand: string | null = null;

          if (volume >= 85) {
            // Loud hit – bass flash
            category = 'bass';
            colorCommand = null;
            sendUdpCommand('BASS');
          } else if (volume >= 70) {
            // Full chorus – warm white / gold
            category = 'full';
            colorCommand = 'RGB:200,150,100';
          } else if (volume >= 55) {
            // Strong mid – guitar solo (green)
            category = 'mid';
            colorCommand = 'COLOR:32CD32';
          } else if (volume >= 40) {
            // Strong treble – vocals (purple)
            category = 'treble';
            colorCommand = 'COLOR:8A2BE2';
          } else {
            category = 'quiet';
            colorCommand = null;
          }

          if (
            category &&
            category !== lastColorCategoryRef.current &&
            colorCommand
          ) {
            // Force send color even if we just sent a VOLUME command
            sendUdpCommand(colorCommand, true);
            lastColorCategoryRef.current = category;
          } else if (!colorCommand) {
            lastColorCategoryRef.current = category;
          }

          // Beat detection: sharp rising edge + cooldown (copied from mic mode)
          const now = Date.now();
          const lastVolume = lastVolumeRef.current;
          const risingFast = volume - lastVolume > 25;
          const loudEnough = volume > 40;
          const beatCooldownOk = now - lastBeatTimeRef.current > 200;

          if (risingFast && loudEnough && beatCooldownOk) {
            sendUdpCommand('BEAT');
            lastBeatTimeRef.current = now;
          }

          lastVolumeRef.current = volume;
        },
      );

      completeSubscriptionRef.current = emitter.addListener(
        'MusicFileComplete',
        () => {
          if (!isMountedRef.current) return;
          removeEventSubscriptions();
          stopPlaybackInternal();
          setIsPlaying(false);
        },
      );

      errorSubscriptionRef.current = emitter.addListener(
        'MusicFileError',
        (message: string) => {
          if (!isMountedRef.current) return;
          removeEventSubscriptions();
          stopPlaybackInternal();
          setIsPlaying(false);
          Alert.alert('Playback error', message ?? 'Failed to play audio file');
        },
      );

      MusicFileModule.startPlayback(selectedFile.uri);
    } catch (error) {
      console.log('startPlaybackInternal error', error);
      Alert.alert('Error', 'Failed to start playback');
    }
  };

  const stopPlaybackInternal = () => {
    try {
      removeEventSubscriptions();
      if (Platform.OS === 'android' && MusicFileModule) {
        MusicFileModule.stopPlayback();
      }
      sendUdpCommand('VOLUME:10');
      setVolumePercent(0);
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

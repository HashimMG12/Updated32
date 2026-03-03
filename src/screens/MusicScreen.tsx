import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {Buffer} from 'buffer';
import {rw, rh} from '../utils/responsive';
import {checkConnection, getEsp32IpAddress} from '../HttpService';
import {PermissionsAndroid, Platform} from 'react-native';

declare const global: any;

if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Use require so TypeScript doesn't need type declarations
// for these native modules. Make sure to install them with:
//   yarn add react-native-udp react-native-sound-level
// and run pod install / rebuild the native app.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dgram = require('react-native-udp');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SoundLevel = require('react-native-sound-level');

const UDP_PORT = 8888;
const MAX_COMMANDS_PER_SECOND = 25;
const MIN_COMMAND_INTERVAL_MS = 1000 / MAX_COMMANDS_PER_SECOND; // ~40 ms

const MusicScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [volumePercent, setVolumePercent] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [colorReactive, setColorReactive] = useState(false);

  const socketRef = useRef<any | null>(null);
  const socketReadyRef = useRef<boolean>(false);
  const lastSendTimeRef = useRef<number>(0);
  const lastBeatTimeRef = useRef<number>(0);
  const lastVolumeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const lastColorCategoryRef = useRef<string | null>(null);
  const colorReactiveRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    checkConnectionStatus();

    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      stopListeningInternal();
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
    if (!connected && isListening) {
      stopListeningInternal();
      setIsListening(false);
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
        console.log('UDP socket listening');
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

      console.log('UDP_DEBUG', {
        command,
        ip,
        UDP_PORT,
        typeOfPort: typeof UDP_PORT,
        typeOfIp: typeof ip,
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

  const handleAudioFrame = (rawDb: number) => {
    // rawDb is typically negative (e.g. -60..0)
    const clampedDb = Math.max(-60, Math.min(0, rawDb));

    // Dynamic noise floor: lower sensitivity -> higher floor (ignores more distant/quiet sounds)
    // When sensitivity = 1   => noiseFloor ≈ -50 dB (quite sensitive)
    // When sensitivity = 0   => noiseFloor ≈ -30 dB (only close/loud sounds)
    const minFloor = -30;
    const maxFloor = -50;
    const noiseFloor = maxFloor + (1 - sensitivity) * (minFloor - maxFloor);

    if (clampedDb < noiseFloor) {
      // Treat as silence; only send VOLUME:0 when we transition from non-zero
      const lastVol = lastVolumeRef.current;
      if (lastVol !== 0) {
        setVolumePercent(0);
        sendUdpCommand('VOLUME:0');
        lastVolumeRef.current = 0;
      }
      return;
    }

    // Map [noiseFloor .. 0] dB to [0 .. 1]
    let normalized = (clampedDb - noiseFloor) / (0 - noiseFloor);
    normalized = Math.max(0, Math.min(1, normalized));

    const volume = Math.round(normalized * 100);
    setVolumePercent(volume);

    // Map volume 0-100 to brightness via VOLUME command (ESP maps internally)
    sendUdpCommand(`VOLUME:${volume}`);

    // Optional: color reacts to volume bands when enabled
    if (colorReactiveRef.current) {
      let category: string | null = null;
      let colorCommand: string | null = null;

      if (volume >= 85) {
        // Loud bass / full hit: keep current color, add bass flash
        category = 'bass';
        colorCommand = null; // color unchanged, bass handled below
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
        colorCommand = null; // keep current color for quiet parts
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
    }

    // Very simple beat detection: sharp rising edge + cooldown
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
  };

  const startListeningInternal = () => {
    try {
      // Put ESP in manual mode so mic controls brightness cleanly
      sendUdpCommand('MODE:MANUAL');
      // Set a pleasant base color for music mode
      sendUdpCommand('COLOR:00FFAA');

      SoundLevel.start();
      SoundLevel.onNewFrame = (data: {value: number}) => {
        handleAudioFrame(data.value);
      };
    } catch (error) {
      console.log('startListeningInternal error', error);
      Alert.alert('Error', 'Failed to start microphone listener');
    }
  };

  const stopListeningInternal = () => {
    try {
      if (SoundLevel && typeof SoundLevel.stop === 'function') {
        SoundLevel.stop();
      }
      if (SoundLevel) {
        SoundLevel.onNewFrame = null;
      }
      // Gently dim lights when stopping
      sendUdpCommand('VOLUME:10');
    } catch (error) {
      console.log('stopListeningInternal error', error);
    }
  };

  const handleToggleListening = () => {
    if (!isConnected) {
      Alert.alert(
        'Not connected',
        'Please connect to the ESP32 hotspot or Wi‑Fi first.',
      );
      return;
    }

    const startOrStop = async () => {
      if (isListening) {
        stopListeningInternal();
        setIsListening(false);
      } else {
        // On Android we must explicitly ask for mic permission
        if (Platform.OS === 'android') {
          try {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Microphone permission',
                message:
                  'This app needs access to your microphone to react lights to music.',
                buttonPositive: 'OK',
                buttonNegative: 'Cancel',
              },
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              Alert.alert(
                'Permission required',
                'Microphone access is needed for music reactive mode.',
              );
              return;
            }
          } catch (err) {
            console.log('Mic permission error', err);
            return;
          }
        }

        startListeningInternal();
        setIsListening(true);
      }
    };

    // Fire and forget
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    startOrStop();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Music Reactive Lights</Text>
          <Text style={styles.subtitle}>
            Use your phone microphone to drive the ESP32 lights in real time.
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

          <View style={styles.volumeRow}>
            <Text style={styles.volumeLabel}>Live volume</Text>
            <Text style={styles.volumeValue}>{volumePercent}%</Text>
          </View>

          <View style={styles.sliderBlock}>
            <Text style={styles.sliderLabel}>Sensitivity</Text>
            <Slider
              style={styles.slider}
              minimumValue={0.2}
              maximumValue={1}
              value={sensitivity}
              minimumTrackTintColor="#00e0ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#00e0ff"
              onValueChange={setSensitivity}
            />
            <Text style={styles.sliderValueText}>
              {Math.round(sensitivity * 100)}%
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Color reacts to music</Text>
            <Switch
              value={colorReactive}
              onValueChange={value => {
                setColorReactive(value);
                colorReactiveRef.current = value;
                lastColorCategoryRef.current = null;
              }}
              thumbColor={colorReactive ? '#00e0ff' : '#cccccc'}
              trackColor={{false: '#555555', true: '#00e0ff'}}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              isListening ? styles.buttonActive : styles.buttonIdle,
              !isConnected && styles.buttonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleToggleListening}
            disabled={!isConnected}>
            <Text style={styles.buttonText}>
              {isListening ? 'Stop Music Mode' : 'Start Music Mode'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Keep this screen open while music mode is active. The app sends UDP
            commands to 192.168.4.1:8888 based on microphone loudness.
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
  toggleRow: {
    marginTop: rh(6),
    marginBottom: rh(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: rh(13),
    color: '#a0a0a0',
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
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: rh(8),
    marginBottom: rh(12),
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
  sliderBlock: {
    marginTop: rh(10),
    marginBottom: rh(20),
  },
  sliderLabel: {
    fontSize: rh(13),
    color: '#a0a0a0',
    marginBottom: rh(6),
  },
  slider: {
    width: '100%',
    height: rh(36),
  },
  sliderValueText: {
    marginTop: rh(4),
    fontSize: rh(12),
    color: '#ffffff',
    textAlign: 'right',
  },
  button: {
    marginTop: rh(10),
    paddingVertical: rh(14),
    borderRadius: rw(999),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIdle: {
    backgroundColor: '#00c853',
  },
  buttonActive: {
    backgroundColor: '#f44336',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
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

export default MusicScreen;

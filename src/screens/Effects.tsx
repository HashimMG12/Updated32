import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';
import {checkConnection, getStatus, setMode} from '../MqttService';

const Effects: React.FC = () => {
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
    const interval = setInterval(async () => {
      await checkConnectionStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkConnectionStatus = async () => {
    const connected = await checkConnection();
    setIsConnected(connected);

    if (connected) {
      const status = await getStatus();
      if (status) {
        try {
          const parsed = JSON.parse(status);
          if (parsed && typeof parsed.mode === 'string') {
            const mode = parsed.mode.toLowerCase();
            setActiveMode(mode === 'manual' ? null : mode);
          }
        } catch {
          // Backwards compatibility
        }
      }
    }
  };

  const rhythmModes = [
    {key: 'disco', label: 'Disco'},
    {key: 'rock', label: 'Rock'},
    {key: 'heartbeat', label: 'Heartbeat'},
    {key: 'techno', label: 'Techno'},
    {key: 'waltz', label: 'Waltz'},
    {key: 'reggae', label: 'Reggae'},
  ];

  const effectModes = [
    {key: 'police', label: 'Police'},
    {key: 'rainbow', label: 'Rainbow'},
    {key: 'strobe', label: 'Strobe'},
    {key: 'fire', label: 'Fire'},
    {key: 'christmas', label: 'Christmas'},
    {key: 'party', label: 'Party'},
    {key: 'fade', label: 'Fade'},
    {key: 'pulse', label: 'Pulse'},
    {key: 'colorcycle', label: 'Color Cycle'},
    {key: 'random', label: 'Random'},
  ];

  const handleModePress = async (modeKey: string) => {
    if (!isConnected) {
      return;
    }

    const nextMode = activeMode === modeKey ? 'manual' : modeKey;
    const success = await setMode(nextMode as any);
    if (!success) {
      Alert.alert('Error', 'Failed to change mode');
      return;
    }

    setActiveMode(nextMode === 'manual' ? null : modeKey);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Party Effects</Text>
          <Text style={styles.headerSubtitle}>
            Tap a mode to start. Tap again to stop and return to manual color.
          </Text>
        </View>

        {/* EFFECT MODES Section */}
        <View style={styles.effectsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>EFFECT MODES</Text>
          </View>

          {/* Rhythm Patterns */}
          <View style={styles.modeGroup}>
            <Text style={styles.modeGroupTitle}>Rhythm Patterns</Text>
            <View style={styles.modeGrid}>
              {rhythmModes.map(mode => (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.modeButton,
                    activeMode === mode.key && styles.modeButtonActive,
                    !isConnected && styles.modeButtonDisabled,
                  ]}
                  onPress={() => handleModePress(mode.key)}
                  activeOpacity={0.8}
                  disabled={!isConnected}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      activeMode === mode.key && styles.modeButtonTextActive,
                    ]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Light Patterns & FX */}
          <View style={styles.modeGroup}>
            <Text style={styles.modeGroupTitle}>Lights & FX</Text>
            <View style={styles.modeGrid}>
              {effectModes.map(mode => (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.modeButton,
                    activeMode === mode.key && styles.modeButtonActive,
                    !isConnected && styles.modeButtonDisabled,
                  ]}
                  onPress={() => handleModePress(mode.key)}
                  activeOpacity={0.8}
                  disabled={!isConnected}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      activeMode === mode.key && styles.modeButtonTextActive,
                    ]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Stop Effects / Manual toggle */}
          <TouchableOpacity
            style={[
              styles.stopEffectsButton,
              !isConnected && styles.modeButtonDisabled,
            ]}
            onPress={async () => {
              if (!isConnected) {
                return;
              }
              const success = await setMode('manual');
              if (!success) {
                Alert.alert('Error', 'Failed to stop effects');
                return;
              }
              setActiveMode(null);
            }}
            activeOpacity={0.8}
            disabled={!isConnected}>
            <Text style={styles.stopEffectsButtonText}>
              Stop Effects (Manual Color)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              {backgroundColor: isConnected ? '#4CAF50' : '#f44336'},
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </ScrollView>
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
  },
  contentContainer: {
    paddingHorizontal: rw(24),
    paddingBottom: rh(24),
  },
  header: {
    marginTop: rh(16),
    marginBottom: rh(8),
  },
  headerTitle: {
    fontSize: rh(24),
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: rh(6),
  },
  headerSubtitle: {
    fontSize: rh(13),
    color: '#a0a0a0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rh(16),
  },
  sectionTitle: {
    fontSize: rh(14),
    fontWeight: '600',
    color: '#a0a0a0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  effectsSection: {
    marginTop: rh(20),
    padding: rh(18),
    backgroundColor: '#252542',
    borderRadius: rw(18),
    borderWidth: 1,
    borderColor: '#3d3d6b',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  modeGroup: {
    marginTop: rh(8),
  },
  modeGroupTitle: {
    fontSize: rh(12),
    fontWeight: '600',
    color: '#a0a0a0',
    marginBottom: rh(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modeButton: {
    paddingVertical: rh(9),
    paddingHorizontal: rw(14),
    borderRadius: rw(10),
    backgroundColor: '#30305a',
    marginBottom: rh(10),
    minWidth: '30%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#4CAF50',
  },
  modeButtonDisabled: {
    opacity: 0.4,
  },
  modeButtonText: {
    fontSize: rh(12),
    fontWeight: '600',
    color: '#ffffff',
  },
  modeButtonTextActive: {
    color: '#1a1a2e',
  },
  stopEffectsButton: {
    marginTop: rh(16),
    paddingVertical: rh(12),
    borderRadius: rw(999),
    backgroundColor: '#f44336',
    alignItems: 'center',
  },
  stopEffectsButtonText: {
    fontSize: rh(14),
    fontWeight: '600',
    color: '#ffffff',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rh(32),
    marginBottom: rh(24),
  },
  statusDot: {
    width: rw(12),
    height: rh(12),
    borderRadius: rw(6),
    marginRight: rw(8),
  },
  statusText: {
    fontSize: rh(16),
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default Effects;

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  setEsp32IpAddress,
  sendOn,
  sendOff,
  checkConnection,
  getStatus,
} from './HttpService';

const MainScreen: React.FC = () => {
  const [isOn, setIsOn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Auto-connect to ESP32 hotspot on mount
  useEffect(() => {
    // Set hotspot IP (192.168.4.1)
    setEsp32IpAddress('192.168.4.1');
    
    // Try to connect
    checkConnectionStatus();
    
    // Check connection status periodically
    const interval = setInterval(async () => {
      await checkConnectionStatus();
    }, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const checkConnectionStatus = async () => {
    const connected = await checkConnection();
    setIsConnected(connected);
    
    if (connected) {
      const status = await getStatus();
      if (status) {
        setIsOn(status.toUpperCase().includes('ON'));
      }
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    await checkConnectionStatus();
    setIsConnecting(false);

    if (isConnected) {
      Alert.alert('Success', 'Connected to ESP32!');
    } else {
      Alert.alert(
        'Not Connected',
        'Cannot connect to ESP32 hotspot.\n\nPlease:\n1. Go to WiFi settings\n2. Connect to ESP32 hotspot\n3. Come back and try again'
      );
    }
  };

  const handlePress = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Not connected to ESP32');
      return;
    }

    let success: boolean;
    if (isOn) {
      success = await sendOff();
      if (success) setIsOn(false);
    } else {
      success = await sendOn();
      if (success) setIsOn(true);
    }

    if (!success) {
      Alert.alert('Error', 'Failed to send command');
    }
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <View
            style={[
              styles.statusDot,
              {backgroundColor: isConnected ? '#4CAF50' : '#f44336'},
            ]}
          />
          <Text style={styles.statusText}>
            ESP32: {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Connection Info */}
      {!isConnected && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Connect to ESP32 Hotspot</Text>
          <Text style={styles.infoText}>
            1. Go to WiFi settings{'\n'}
            2. Connect to ESP32 hotspot{'\n'}
            3. Come back and tap Connect
          </Text>
          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={isConnecting}>
            <Text style={styles.connectButtonText}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connected Info */}
      {isConnected && (
        <Text style={styles.connectedIp}>
          Connected to ESP32 Hotspot (192.168.4.1)
        </Text>
      )}

      {/* Title */}
      <Text style={styles.title}>Control Panel</Text>

      {/* ON/OFF Button */}
      <TouchableOpacity
        style={[
          styles.button,
          isOn ? styles.buttonOn : styles.buttonOff,
          !isConnected && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={!isConnected}>
        <Text style={styles.buttonText}>{isOn ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>

      {/* Status Text */}
      <Text style={styles.ledStatusText}>
        LED Status: {isOn ? 'Active' : 'Inactive'}
      </Text>

      {/* Connection Warning */}
      {!isConnected && (
        <Text style={styles.warningText}>
          Connect to ESP32 hotspot first
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
  },
  statusBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  infoBox: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 22,
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  connectedIp: {
    position: 'absolute',
    top: 100,
    fontSize: 14,
    color: '#4CAF50',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 60,
  },
  button: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonOn: {
    backgroundColor: '#4CAF50',
  },
  buttonOff: {
    backgroundColor: '#f44336',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  ledStatusText: {
    fontSize: 18,
    color: '#a0a0a0',
    marginTop: 40,
  },
  warningText: {
    fontSize: 14,
    color: '#FFC107',
    marginTop: 20,
  },
});

export default MainScreen;

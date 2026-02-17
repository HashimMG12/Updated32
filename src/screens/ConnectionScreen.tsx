import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';
import {setEsp32IpAddress, checkConnection} from '../HttpService';
import {
  discoverEsp32Devices,
  getSelectedDevice,
  setSelectedDevice,
  Esp32Device,
} from '../services/DeviceDiscoveryService';

interface ConnectionScreenProps {
  onConnected: () => void;
}

const ConnectionScreen: React.FC<ConnectionScreenProps> = ({onConnected}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingSaved, setIsCheckingSaved] = useState(true);
  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [selectedDevice, setSelectedDeviceState] = useState<Esp32Device | null>(null);
  const [statusMessage, setStatusMessage] = useState('Checking saved device...');

  useEffect(() => {
    // Tier 1: Check saved device first (instant connection)
    checkSavedDevice();
  }, []);

  useEffect(() => {
    // Auto-advance when device is selected
    if (selectedDevice && !isCheckingSaved) {
      const timer = setTimeout(() => {
        handleDeviceSelected(selectedDevice);
      }, 1500); // Show success message for 1.5 seconds
      return () => clearTimeout(timer);
    }
  }, [selectedDevice, isCheckingSaved]);

  const checkSavedDevice = async () => {
    setIsCheckingSaved(true);
    setStatusMessage('Checking saved device...');

    try {
      const savedDevice = await getSelectedDevice();
      
      if (savedDevice) {
        // Set IP address first
        await setEsp32IpAddress(savedDevice.ip);
        
        // Verify device is still reachable
        const isReachable = await checkConnection();
        
        if (isReachable) {
          // Device is reachable - connect immediately!
          setStatusMessage('Connected to saved device!');
          setIsCheckingSaved(false);
          setSelectedDeviceState(savedDevice);
          // Auto-advance after short delay
          setTimeout(() => {
            handleDeviceSelected(savedDevice);
          }, 1000);
        } else {
          // Saved device not reachable - show scan option
          setStatusMessage('Saved device not reachable.\n\nTap "Scan" to find devices.');
          setIsCheckingSaved(false);
        }
      } else {
        // No saved device - show scan option
        setStatusMessage('No saved device found.\n\nTap "Scan" to find ESP32 devices.');
        setIsCheckingSaved(false);
      }
    } catch (error) {
      setStatusMessage('Error checking saved device.\n\nTap "Scan" to find devices.');
      setIsCheckingSaved(false);
    }
  };

  const scanForDevices = async () => {
    setIsScanning(true);
    setIsCheckingSaved(false);
    setStatusMessage('Scanning network for ESP32 devices...');
    setDevices([]);
    setSelectedDeviceState(null);

    try {
      const discovered = await discoverEsp32Devices();
      setDevices(discovered);

      if (discovered.length === 0) {
        setStatusMessage('No ESP32 devices found.\n\nMake sure ESP32 is powered on and on the same network.');
      } else {
        setStatusMessage(`Found ${discovered.length} ESP32 device(s)`);
        
        // If only one device found, auto-select it
        if (discovered.length === 1) {
          setSelectedDeviceState(discovered[0]);
        }
      }
    } catch (error) {
      setStatusMessage('Error scanning for devices. Please try again.');
      Alert.alert('Error', 'Failed to scan for ESP32 devices');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeviceSelected = async (device: Esp32Device) => {
    try {
      // Save the selected device IP
      await setEsp32IpAddress(device.ip);
      await setSelectedDevice(device);
      onConnected();
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to device');
    }
  };

  const selectDevice = (device: Esp32Device) => {
    setSelectedDeviceState(device);
  };

  const renderDevice = ({item}: {item: Esp32Device}) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        selectedDevice?.ip === item.ip && styles.deviceItemSelected,
      ]}
      onPress={() => selectDevice(item)}
      activeOpacity={0.7}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceIp}>{item.ip}</Text>
        {item.status && (
          <Text style={styles.deviceStatus}>Status: {item.status}</Text>
        )}
      </View>
      {selectedDevice?.ip === item.ip && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Status Icon */}
          <View
            style={[
              styles.statusCircle,
              selectedDevice && styles.statusCircleConnected,
            ]}>
            {isCheckingSaved || isScanning ? (
              <ActivityIndicator size="large" color="#3498db" />
            ) : selectedDevice ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : devices.length > 0 ? (
              <Text style={styles.infoIcon}>📡</Text>
            ) : (
              <Text style={styles.cross}>✗</Text>
            )}
          </View>

          {/* Status Text */}
          <Text style={styles.statusText}>{statusMessage}</Text>

          {/* Scan Button - Only show if not checking saved device and not scanning */}
          {!isCheckingSaved && !isScanning && (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={scanForDevices}
              activeOpacity={0.7}>
              <Text style={styles.scanButtonText}>
                {devices.length > 0 ? 'Scan Again' : 'Scan for Devices'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Device List */}
          {devices.length > 0 && (
            <View style={styles.deviceListContainer}>
              <Text style={styles.deviceListTitle}>Select ESP32 Device:</Text>
              <FlatList
                data={devices}
                renderItem={renderDevice}
                keyExtractor={item => item.ip}
                style={styles.deviceList}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Selected Device Info */}
          {selectedDevice && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Connected to: {selectedDevice.ip}
              </Text>
              <Text style={styles.infoSubtext}>
                Moving to control panel...
              </Text>
            </View>
          )}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: rw(24),
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  statusCircle: {
    width: rw(120),
    height: rh(120),
    borderRadius: rw(60),
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rh(32),
    borderWidth: rw(4),
    borderColor: '#f44336',
  },
  statusCircleConnected: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3a1a',
  },
  checkmark: {
    fontSize: rh(60),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  infoIcon: {
    fontSize: rh(50),
  },
  cross: {
    fontSize: rh(60),
    color: '#f44336',
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: rh(18),
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: rh(24),
    lineHeight: rh(26),
  },
  scanButton: {
    backgroundColor: '#3498db',
    paddingVertical: rh(16),
    paddingHorizontal: rw(32),
    borderRadius: rw(12),
    marginBottom: rh(24),
  },
  scanButtonText: {
    fontSize: rh(16),
    fontWeight: '600',
    color: '#ffffff',
  },
  deviceListContainer: {
    width: '100%',
    marginTop: rh(20),
  },
  deviceListTitle: {
    fontSize: rh(16),
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: rh(12),
    textAlign: 'center',
  },
  deviceList: {
    maxHeight: rh(300),
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2d2d44',
    padding: rw(16),
    borderRadius: rw(12),
    marginBottom: rh(12),
  },
  deviceItemSelected: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#2d4d2d',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceIp: {
    fontSize: rh(18),
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: rh(4),
  },
  deviceStatus: {
    fontSize: rh(14),
    color: '#a0a0a0',
  },
  infoBox: {
    backgroundColor: '#2d2d44',
    padding: rw(20),
    borderRadius: rw(12),
    width: '100%',
    alignItems: 'center',
    marginTop: rh(20),
  },
  infoText: {
    fontSize: rh(16),
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: rh(8),
  },
  infoSubtext: {
    fontSize: rh(14),
    color: '#a0a0a0',
  },
});

export default ConnectionScreen;

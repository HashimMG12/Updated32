import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';
import {
  discoverEsp32Devices,
  getDiscoveredDevices,
  setSelectedDevice,
  Esp32Device,
} from '../services/DeviceDiscoveryService';
import {setEsp32IpAddress} from '../HttpService';

interface DeviceSelectionScreenProps {
  onDeviceSelected: () => void;
}

const DeviceSelectionScreen: React.FC<DeviceSelectionScreenProps> = ({
  onDeviceSelected,
}) => {
  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);

  useEffect(() => {
    loadSavedDevices();
  }, []);

  const loadSavedDevices = async () => {
    const savedDevices = await getDiscoveredDevices();
    setDevices(savedDevices);
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const discovered = await discoverEsp32Devices();
      setDevices(discovered);
      
      if (discovered.length === 0) {
        Alert.alert(
          'No Devices Found',
          'No ESP32 devices found on the network.\n\nMake sure:\n• ESP32 is powered on\n• ESP32 is on the same WiFi network\n• Try scanning again'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to scan for devices');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDevice = async (device: Esp32Device) => {
    try {
      setSelectedIp(device.ip);
      await setSelectedDevice(device);
      await setEsp32IpAddress(device.ip);
      
      Alert.alert(
        'Device Selected',
        `Connected to ESP32 at ${device.ip}`,
        [
          {
            text: 'OK',
            onPress: onDeviceSelected,
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to select device');
    }
  };

  const renderDevice = ({item}: {item: Esp32Device}) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        selectedIp === item.ip && styles.deviceItemSelected,
      ]}
      onPress={() => handleSelectDevice(item)}
      activeOpacity={0.7}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceIp}>{item.ip}</Text>
        {item.status && (
          <Text style={styles.deviceStatus}>Status: {item.status}</Text>
        )}
        {item.name && <Text style={styles.deviceName}>{item.name}</Text>}
      </View>
      <View
        style={[
          styles.statusDot,
          {backgroundColor: selectedIp === item.ip ? '#4CAF50' : '#3498db'},
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>Select ESP32 Device</Text>
        <Text style={styles.subtitle}>
          {devices.length === 0
            ? 'No devices found. Tap scan to discover ESP32 modules.'
            : `Found ${devices.length} device(s)`}
        </Text>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
          onPress={handleScan}
          disabled={isScanning}>
          {isScanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanButtonText}>Scan for Devices</Text>
          )}
        </TouchableOpacity>

        {devices.length > 0 && (
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={item => item.ip}
            style={styles.deviceList}
            contentContainerStyle={styles.deviceListContent}
          />
        )}

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onDeviceSelected}>
          <Text style={styles.skipText}>Skip (Use Default IP)</Text>
        </TouchableOpacity>
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
  title: {
    fontSize: rh(28),
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: rh(8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: rh(16),
    color: '#a0a0a0',
    marginBottom: rh(24),
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: '#3498db',
    paddingVertical: rh(16),
    borderRadius: rw(12),
    alignItems: 'center',
    marginBottom: rh(24),
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    fontSize: rh(16),
    fontWeight: '600',
    color: '#ffffff',
  },
  deviceList: {
    flex: 1,
  },
  deviceListContent: {
    paddingBottom: rh(20),
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
  deviceName: {
    fontSize: rh(12),
    color: '#3498db',
    marginTop: rh(4),
  },
  statusDot: {
    width: rw(12),
    height: rh(12),
    borderRadius: rw(6),
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: rh(16),
    marginTop: rh(12),
  },
  skipText: {
    fontSize: rh(14),
    color: '#666',
  },
});

export default DeviceSelectionScreen;

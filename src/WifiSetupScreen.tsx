import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
} from 'react-native';
import {BluetoothDevice} from 'react-native-bluetooth-classic';
import {
  requestBluetoothPermissions,
  isBluetoothEnabled,
  requestBluetoothEnable,
  getPairedDevices,
  connectToDevice,
  sendWifiCredentials,
  disconnectFromDevice,
} from './BluetoothService';

interface WifiSetupScreenProps {
  onSetupComplete: () => void;
}

type ConnectionStatus =
  | 'idle'
  | 'checking'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

const WifiSetupScreen: React.FC<WifiSetupScreenProps> = ({onSetupComplete}) => {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    initBluetooth();
  }, []);

  const initBluetooth = async () => {
    setStatus('checking');
    setStatusMessage('Requesting permissions...');

    // Request permissions
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      setStatus('error');
      setStatusMessage('Bluetooth permissions denied');
      return;
    }

    // Check if Bluetooth is enabled
    const enabled = await isBluetoothEnabled();
    if (!enabled) {
      setStatusMessage('Enabling Bluetooth...');
      const wasEnabled = await requestBluetoothEnable();
      if (!wasEnabled) {
        setStatus('error');
        setStatusMessage('Please enable Bluetooth');
        return;
      }
    }

    setStatus('idle');
    setStatusMessage('Ready to scan');
  };

  const handleScanDevices = async () => {
    setStatus('scanning');
    setStatusMessage('Scanning paired devices...');
    setPairedDevices([]);

    const devices = await getPairedDevices();
    
    if (devices.length === 0) {
      setStatus('error');
      setStatusMessage('No paired devices found. Please pair your ESP32 in Bluetooth settings first.');
    } else {
      setPairedDevices(devices);
      setStatus('idle');
      setStatusMessage(`Found ${devices.length} paired device(s)`);
    }
  };

  const handleSelectDevice = async (device: BluetoothDevice) => {
    setSelectedDevice(device);
    setStatus('connecting');
    setStatusMessage(`Connecting to ${device.name || device.address}...`);

    const connected = await connectToDevice(device);
    if (connected) {
      setStatus('connected');
      setStatusMessage(`Connected to ${device.name || device.address}`);
    } else {
      setSelectedDevice(null);
      setStatus('error');
      setStatusMessage('Failed to connect. Make sure ESP32 is in config mode.');
    }
  };

  const handleSendCredentials = async () => {
    if (!selectedDevice) {
      Alert.alert('Error', 'Not connected to any device');
      return;
    }

    if (!ssid.trim()) {
      Alert.alert('Error', 'Please enter WiFi SSID');
      return;
    }

    setSending(true);

    try {
      const success = await sendWifiCredentials(selectedDevice, ssid.trim(), password);
      if (success) {
        Alert.alert(
          'Success',
          'WiFi credentials sent! ESP32 will restart and connect to WiFi.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await disconnectFromDevice(selectedDevice);
                // Navigation disabled for now
                // onSetupComplete();
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to send credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send credentials');
    } finally {
      setSending(false);
    }
  };

  const handleDisconnect = async () => {
    if (selectedDevice) {
      await disconnectFromDevice(selectedDevice);
      setSelectedDevice(null);
      setStatus('idle');
      setStatusMessage('Disconnected');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Setup',
      'Are you sure? You can configure WiFi later.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Skip', onPress: onSetupComplete},
      ],
    );
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4CAF50';
      case 'error':
        return '#f44336';
      case 'checking':
      case 'scanning':
      case 'connecting':
        return '#FFC107';
      default:
        return '#a0a0a0';
    }
  };

  const renderDeviceItem = ({item}: {item: BluetoothDevice}) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleSelectDevice(item)}>
      <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
      <Text style={styles.deviceAddress}>{item.address}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>WiFi Setup</Text>
      <Text style={styles.subtitle}>Connect ESP32 to your WiFi network</Text>

      {/* Status Section */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, {backgroundColor: getStatusColor()}]} />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Scan Button - Show when not connected */}
      {status !== 'connected' && (
        <TouchableOpacity
          style={[
            styles.button,
            styles.scanButton,
            (status === 'checking' || status === 'scanning' || status === 'connecting') &&
              styles.buttonDisabled,
          ]}
          onPress={handleScanDevices}
          disabled={status === 'checking' || status === 'scanning' || status === 'connecting'}>
          {status === 'scanning' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Scan Paired Devices</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Device List */}
      {pairedDevices.length > 0 && status !== 'connected' && (
        <View style={styles.deviceListContainer}>
          <Text style={styles.listTitle}>Select your ESP32:</Text>
          <FlatList
            data={pairedDevices}
            renderItem={renderDeviceItem}
            keyExtractor={item => item.address}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Connected Device Info */}
      {status === 'connected' && selectedDevice && (
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedTitle}>Connected to:</Text>
          <Text style={styles.connectedDevice}>
            {selectedDevice.name || selectedDevice.address}
          </Text>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WiFi Credentials Form */}
      {status === 'connected' && (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="WiFi SSID"
            placeholderTextColor="#666"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="WiFi Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[
              styles.button,
              styles.sendButton,
              sending && styles.buttonDisabled,
            ]}
            onPress={handleSendCredentials}
            disabled={sending}>
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Credentials</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Go to Control Panel Button */}
      <TouchableOpacity style={styles.controlPanelButton} onPress={onSetupComplete}>
        <Text style={styles.controlPanelButtonText}>Go to Control Panel</Text>
      </TouchableOpacity>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instructions:</Text>
        <Text style={styles.instructionsText}>
          1. Pair your ESP32 in Android Bluetooth settings{'\n'}
          2. Put ESP32 in config mode (double reset){'\n'}
          3. Tap "Scan Paired Devices" above{'\n'}
          4. Select your ESP32 from the list{'\n'}
          5. Enter your WiFi credentials
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#3498db',
  },
  sendButton: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  deviceListContainer: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  deviceItem: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  connectedContainer: {
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  connectedTitle: {
    fontSize: 14,
    color: '#666',
  },
  connectedDevice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 4,
  },
  disconnectButton: {
    marginTop: 12,
  },
  disconnectText: {
    fontSize: 14,
    color: '#f44336',
    textDecorationLine: 'underline',
  },
  formContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  controlPanelButton: {
    backgroundColor: '#9b59b6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  controlPanelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  instructionsContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
});

export default WifiSetupScreen;

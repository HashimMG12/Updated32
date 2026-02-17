import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

interface WifiProvisioningScreenProps {
  onSetupComplete: () => void;
}

// ESP32 Access Point (Hotspot) IP - usually 192.168.4.1
const ESP32_AP_IP = '192.168.4.1';

const WifiProvisioningScreen: React.FC<WifiProvisioningScreenProps> = ({
  onSetupComplete,
}) => {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnectedToAP, setIsConnectedToAP] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 15));
  };

  const checkConnection = async () => {
    setIsConnecting(true);
    addLog('Checking connection to ESP32 hotspot...');

    try {
      const response = await fetch(`http://${ESP32_AP_IP}/status`, {
        method: 'GET',
      });

      if (response.ok) {
        setIsConnectedToAP(true);
        addLog('Connected to ESP32 hotspot!');
        Alert.alert('Success', 'Connected to ESP32 hotspot!');
      } else {
        addLog(`Connection failed: ${response.status}`);
        Alert.alert('Error', 'Cannot connect to ESP32. Make sure you are connected to ESP32 hotspot.');
      }
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert(
        'Not Connected',
        'Cannot reach ESP32. Please:\n\n1. Go to WiFi settings\n2. Connect to ESP32 hotspot\n3. Come back and try again'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const sendWifiCredentials = async () => {
    if (!ssid.trim()) {
      Alert.alert('Error', 'Please enter WiFi SSID');
      return;
    }

    setIsSending(true);
    addLog(`Sending WiFi credentials...`);
    addLog(`SSID: ${ssid}`);

    try {
      // Send credentials to ESP32
      const response = await fetch(`http://${ESP32_AP_IP}/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(password)}`,
      });

      if (response.ok) {
        const text = await response.text();
        addLog(`Response: ${text}`);
        addLog('Credentials sent successfully!');
        
        Alert.alert(
          'Success',
          'WiFi credentials sent!\n\nESP32 will now connect to your WiFi.\n\nPlease:\n1. Connect your phone to the same WiFi\n2. Note the ESP32 IP address\n3. Continue to Control Panel',
          [
            {
              text: 'Continue',
              onPress: onSetupComplete,
            },
          ]
        );
      } else {
        addLog(`Failed: ${response.status}`);
        Alert.alert('Error', 'Failed to send credentials');
      }
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', `Failed to send credentials: ${error}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>WiFi Setup</Text>
      <Text style={styles.subtitle}>Configure ESP32 WiFi connection</Text>

      {/* Instructions */}
      <View style={styles.instructionsBox}>
        <Text style={styles.instructionsTitle}>Step 1: Connect to ESP32 Hotspot</Text>
        <Text style={styles.instructionsText}>
          1. Go to your phone's WiFi settings{'\n'}
          2. Connect to ESP32's hotspot{'\n'}
          3. Come back to this app{'\n'}
          4. Tap "Check Connection" below
        </Text>
      </View>

      {/* Check Connection Button */}
      <TouchableOpacity
        style={[styles.button, styles.checkButton, isConnecting && styles.buttonDisabled]}
        onPress={checkConnection}
        disabled={isConnecting}>
        {isConnecting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Check Connection</Text>
        )}
      </TouchableOpacity>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            {backgroundColor: isConnectedToAP ? '#4CAF50' : '#f44336'},
          ]}
        />
        <Text style={styles.statusText}>
          {isConnectedToAP ? 'Connected to ESP32 Hotspot' : 'Not Connected'}
        </Text>
      </View>

      {/* WiFi Credentials Form - Only show when connected */}
      {isConnectedToAP && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Step 2: Enter Your WiFi Credentials</Text>
          
          <Text style={styles.label}>WiFi Name (SSID)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your WiFi name"
            placeholderTextColor="#666"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
          />

          <Text style={styles.label}>WiFi Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your WiFi password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, styles.sendButton, isSending && styles.buttonDisabled]}
            onPress={sendWifiCredentials}
            disabled={isSending}>
            {isSending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send WiFi Credentials</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={onSetupComplete}>
        <Text style={styles.skipText}>Skip to Control Panel</Text>
      </TouchableOpacity>

      {/* Debug Log */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Log</Text>
        <View style={styles.debugBox}>
          {debugLogs.length === 0 ? (
            <Text style={styles.debugEmpty}>No logs yet...</Text>
          ) : (
            debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugText}>{log}</Text>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  instructionsBox: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 22,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkButton: {
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
    color: '#fff',
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
    color: '#a0a0a0',
  },
  formContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3d3d5c',
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
  debugContainer: {
    marginTop: 24,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  debugBox: {
    backgroundColor: '#0d0d1a',
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
  },
  debugEmpty: {
    color: '#666',
    fontStyle: 'italic',
  },
  debugText: {
    fontSize: 11,
    color: '#4CAF50',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

export default WifiProvisioningScreen;

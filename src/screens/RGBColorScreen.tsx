import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import ColorPicker from 'react-native-wheel-color-picker';
import {rw, rh} from '../utils/responsive';
import {
  sendOn,
  sendOff,
  checkConnection,
  getStatus,
  sendColorByHex,
  setMode,
} from '../HttpService';

const RGBColorScreen: React.FC = () => {
  const [selectedColor, setSelectedColor] = useState('#3498db'); // Blue as default
  const [isOn, setIsOn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const colorPickerRef = useRef<any>(null);
  const isInitialMount = useRef(true);
  const lastAlertTime = useRef<number>(0);

  useEffect(() => {
    checkConnectionStatus();
    // Check connection status periodically
    const interval = setInterval(async () => {
      await checkConnectionStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkConnectionStatus = async () => {
    setIsCheckingConnection(true);
    const connected = await checkConnection();
    setIsConnected(connected);
    
    if (connected) {
      const status = await getStatus();
      if (status) {
        try {
          // New firmware returns JSON status
          const parsed = JSON.parse(status);
          if (parsed && typeof parsed.state === 'string') {
            setIsOn(parsed.state.toUpperCase().includes('ON'));
          } else {
            setIsOn(status.toUpperCase().includes('ON'));
          }
        } catch {
          // Backwards compatibility if status is plain text
          setIsOn(status.toUpperCase().includes('ON'));
        }
      }
    }
    setIsCheckingConnection(false);
    // Mark initial mount as complete after first connection check
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  };

  const ensureManualMode = async (): Promise<boolean> => {
    if (!isConnected || isCheckingConnection) {
      return false;
    }
    return setMode('manual');
  };

  const handlePress = async () => {
    if (isCheckingConnection || !isConnected) {
      return; // Silently return if not connected
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

  const solidColors = [
    {name: 'Red', hex: '#FF0000'},
    {name: 'Green', hex: '#00FF00'},
    {name: 'Blue', hex: '#0000FF'},
    {name: 'Yellow', hex: '#FFFF00'},
    {name: 'Pink', hex: '#FF00FF'},
    {name: 'Cyan', hex: '#00FFFF'},
    {name: 'White', hex: '#FFFFFF'},
    {name: 'Orange', hex: '#FF8800'},
  ];

  const handleColorSelect = async (hex: string) => {
    if (isCheckingConnection || !isConnected) {
      return; // Silently return if not connected
    }

    // Switch to manual mode before sending color, so effects don't override it
    const manualOk = await ensureManualMode();
    if (!manualOk) {
      return;
    }

    setSelectedColor(hex);
    
    // Send color command to ESP32
    // Note: /setcolor already turns on the LED if RGB > 0, so we don't call /on
    // Calling /on after /setcolor would reset the color to white!
    const success = await sendColorByHex(hex);
    if (success) {
      // LED is already on if color has any RGB value > 0
      setIsOn(true);
    } else {
      Alert.alert('Error', 'Failed to send color command');
    }
  };

  // Handle color change from wheel picker (while dragging)
  const onColorChange = (color: string) => {
    setSelectedColor(color);
  };

  // Handle color change complete (when user releases)
  const onColorChangeComplete = async (color: string) => {
    // Prevent alerts during initial mount or connection check
    if (isInitialMount.current || isCheckingConnection) {
      return; // Don't show error during initial mount or while checking connection
    }
    if (!isConnected) {
      // Prevent duplicate alerts within 1 second
      const now = Date.now();
      if (now - lastAlertTime.current < 1000) {
        return; // Don't show duplicate alert
      }
      lastAlertTime.current = now;
      Alert.alert('Error', 'Not connected to ESP32');
      return;
    }

    // Switch to manual mode before sending color, so effects don't override it
    const manualOk = await ensureManualMode();
    if (!manualOk) {
      return;
    }
    
    // Send RGB color command to ESP32 using /setcolor endpoint
    // Note: /setcolor already turns on the LED if RGB > 0, so we don't call /on
    // Calling /on after /setcolor would reset the color to white!
    const success = await sendColorByHex(color);
    if (success) {
      // LED is already on if color has any RGB value > 0
      setIsOn(true);
    } else {
      Alert.alert('Error', 'Failed to send color command');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}>
        {/* COLOR PICKER WHEEL Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COLOR PICKER</Text>
          </View>
          <View style={styles.colorPickerContainer}>
            <ColorPicker
              ref={colorPickerRef}
              color={selectedColor}
              onColorChange={onColorChange}
              onColorChangeComplete={onColorChangeComplete}
              thumbSize={rw(40)}
              sliderSize={rw(40)}
              noSnap={true}
              row={false}
              swatchesLast={false}
              swatches={false}
              discrete={false}
            />
          </View>
        </View>

        {/* SOLID COLORS Section */}
        <View style={styles.solid}>
          <View style={styles.solidHeader}>
            <Text style={styles.solidTitle}>SOLID COLORS</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.colorSwatches}>
            {solidColors.map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color.hex,
                    borderWidth: selectedColor === color.hex ? rw(3) : 0,
                    borderColor: '#ffffff',
                  },
                ]}
                onPress={() => handleColorSelect(color.hex)}
                activeOpacity={0.8}>
                {selectedColor === color.hex && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Selected Color Display */}
        <View style={styles.selectedColorContainer}>
          <View
            style={[
              styles.selectedColorPreview,
              {backgroundColor: selectedColor},
            ]}
          />
          <Text style={styles.selectedColorText}>{selectedColor}</Text>
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

        {/* ON/OFF Button - Commented out */}
        {/* <TouchableOpacity
          style={[
            styles.button,
            isOn ? styles.buttonOn : styles.buttonOff,
            !isConnected && styles.buttonDisabled,
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
          disabled={!isConnected}>
          <Text style={styles.buttonText}>{isOn ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity> */}

        {/* Status Text - Commented out */}
        {/* <Text style={styles.statusLabel}>
          Status: {isOn ? 'Active' : 'Inactive'}
        </Text> */}

        {/* Revert Button */}
        {/* <TouchableOpacity
          style={styles.revertButton}
          onPress={() => {
            if (colorPickerRef.current) {
              colorPickerRef.current.revert();
            }
            setSelectedColor('#3498db');
          }}
          activeOpacity={0.8}>
          <Text style={styles.revertButtonText}>Reset to Default</Text>
        </TouchableOpacity> */}
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
    // paddingTop: rh(20),
    // paddingBottom: rh(40),
  },
  section: {
    marginBottom: rh(10),
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
  solidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rh(16),
  },
  solidTitle: {
    fontSize: rh(14),
    fontWeight: '600',
    color: '#a0a0a0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  solid: {
    marginBottom: rh(5),
  },
  viewAllText: {
    fontSize: rh(14),
    fontWeight: '600',
    color: '#3498db',
  },
  colorSwatches: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorSwatch: {
    width: rw(50),
    height: rh(50),
    borderRadius: rw(25),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: rh(24),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  selectedColorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rh(20),
    paddingVertical: rh(5),
    paddingHorizontal: rw(20),
    backgroundColor: '#2d2d44',
    borderRadius: rw(12),
  },
  selectedColorPreview: {
    width: rw(40),
    height: rh(40),
    borderRadius: rw(20),
    marginRight: rw(16),
    borderWidth: rw(2),
    borderColor: '#ffffff',
  },
  selectedColorText: {
    fontSize: rh(18),
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
  // button: {
  //   width: rw(200),
  //   height: rh(200),
  //   borderRadius: rw(100),
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   alignSelf: 'center',
  //   elevation: 8,
  //   shadowColor: '#000',
  //   shadowOffset: {width: 0, height: 4},
  //   shadowOpacity: 0.3,
  //   shadowRadius: 5,
  //   marginBottom: rh(16),
  // },
  // buttonOn: {
  //   backgroundColor: '#4CAF50',
  // },
  // buttonOff: {
  //   backgroundColor: '#f44336',
  // },
  // buttonDisabled: {
  //   opacity: 0.5,
  // },
  buttonText: {
    fontSize: rh(48),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusLabel: {
    fontSize: rh(18),
    color: '#a0a0a0',
    textAlign: 'center',
  },
  colorPickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // paddingVertical: rh(20),
    backgroundColor: '#2d2d44',
    borderRadius: rw(12),
    minHeight: rh(250),
  },
  // revertButton: {
  //   marginTop: rh(24),
  //   paddingVertical: rh(12),
  //   paddingHorizontal: rw(24),
  //   backgroundColor: '#3498db',
  //   borderRadius: rw(8),
  //   alignSelf: 'center',
  // },
  // revertButtonText: {
  //   fontSize: rh(16),
  //   fontWeight: '600',
  //   color: '#ffffff',
  // },
});

export default RGBColorScreen;

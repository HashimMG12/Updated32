import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';
import wifiIcon from '../assets/wifi.png';
import buttonIcon from '../assets/Button.png';
import {sendOn, sendOff, checkConnection, getStatus} from '../HttpService';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftIcon?: any;
  rightIcon?: any;
  onRightIconPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  leftIcon = wifiIcon,
  rightIcon = buttonIcon,
  onRightIconPress,
}) => {
  const [isOn, setIsOn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
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

  const handleRightButtonPress = async () => {
    if (onRightIconPress) {
      onRightIconPress();
      return;
    }

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Left Icon */}
        {leftIcon ? (
          <View style={styles.leftIconContainer}>
            <Image source={leftIcon} style={styles.icon} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.leftIconContainer} />
        )}

        {/* Title and Subtitle - Centered */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Right Icon */}
        {rightIcon ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={handleRightButtonPress}
            activeOpacity={0.7}>
            <Image
              source={rightIcon}
              style={[
                styles.rightIcon,
                isOn && styles.rightIconActive,
              ]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.rightIconContainer} />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#1a1a2e',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rw(20),
    paddingVertical: rh(16),
    backgroundColor: '#1a1a2e',
  },
  leftIconContainer: {
    width: rw(44),
    height: rh(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    width: rw(60),
    height: rh(60),
    // justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: rw(24),
    height: rh(24),
  },
  rightIcon: {
    alignItems: 'center',
    width: rw(70),
    height: rh(70),
  },
  rightIconActive: {
    opacity: 1,
    tintColor: '#4CAF50',
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: rw(16),
  },
  title: {
    fontSize: rh(20),
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: rh(12),
    fontWeight: '600',
    color: '#3498db',
    textAlign: 'center',
    marginTop: rh(4),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default Header;

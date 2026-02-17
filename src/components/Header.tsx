import React from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';
import wifiIcon from '../assets/wifi.png';
import buttonIcon from '../assets/Button.png';

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
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Left Icon */}
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Image source={leftIcon} style={styles.icon} resizeMode="contain" />
          </View>
        )}

        {/* Title and Subtitle */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Right Icon */}
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            activeOpacity={0.7}>
            <Image
              source={rightIcon}
              style={styles.icon}
              resizeMode="contain"
            />
          </TouchableOpacity>
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
    borderRadius: rw(22),
    backgroundColor: '#3d3d5c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    width: rw(44),
    height: rh(44),
    borderRadius: rw(22),
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: rw(24),
    height: rh(24),
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

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';

const CameraScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>Camera</Text>
        <Text style={styles.subtitle}>Camera controls will be here</Text>
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
  title: {
    fontSize: rh(28),
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: rh(16),
  },
  subtitle: {
    fontSize: rh(16),
    color: '#a0a0a0',
  },
});

export default CameraScreen;

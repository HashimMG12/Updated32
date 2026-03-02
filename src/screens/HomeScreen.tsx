import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import BottomNavigation, {TabType} from '../components/BottomNavigation';
import Header from '../components/Header';
import RGBColorScreen from './RGBColorScreen';
import Effects from './Effects';
import MusicScreen from './MusicScreen';
import CameraScreen from './CameraScreen';

const HomeScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('rgb');

  const renderScreen = () => {
    switch (activeTab) {
      case 'rgb':
        return <RGBColorScreen />;
      case 'color':
        return <Effects />;
      case 'music':
        return <MusicScreen />;
      case 'camera':
        return <CameraScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="Control your Lights"
      />

      {/* Main Content Area */}
      <View style={styles.content}>{renderScreen()}</View>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
  },
});

export default HomeScreen;

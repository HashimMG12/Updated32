import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {rw, rh} from '../utils/responsive';

export type TabType = 'rgb' | 'color' | 'music' | 'camera';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs: {key: TabType; label: string}[] = [
    {key: 'rgb', label: 'RGB'},
    {key: 'color', label: 'EFFECTS'},
    {key: 'music', label: 'MIC'},
    {key: 'camera', label: 'MUSIC'},
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#2d2d44',
  },
  container: {
    flexDirection: 'row',
    height: rh(60),
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
    backgroundColor: '#2d2d44',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: rh(12),
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: '#3498db',
  },
  tabText: {
    fontSize: rh(12),
    fontWeight: '600',
    color: '#a0a0a0',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#3498db',
  },
});

export default BottomNavigation;

/**
 * ESP32 React Native App
 * Flow: Splash -> Connection Check -> Home Screen
 * DEV: Connection flow commented out – app goes Splash -> Home. Uncomment when ready.
 */

import React, {useState, useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import SplashScreen from './src/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';

type Screen = 'splash' | 'home';

function App() {
    const [currentScreen, setCurrentScreen] = useState<Screen>('splash');

    const handleSplashFinish = () => {
        // New flow: go directly to Home, which connects to MQTT server.
        setCurrentScreen('home');
    };

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
            {currentScreen === 'splash' && (
                <SplashScreen onFinish={handleSplashFinish} />
            )}
            {currentScreen === 'home' && <HomeScreen />}
        </SafeAreaProvider>
    );
}

export default App;

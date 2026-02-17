/**
 * ESP32 React Native App
 * Flow: Splash -> Connection Check -> Home Screen
 */

import React, {useState, useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import SplashScreen from './src/SplashScreen';
import ConnectionScreen from './src/screens/ConnectionScreen';
import HomeScreen from './src/screens/HomeScreen';
import {initializeEsp32Ip} from './src/HttpService';

type Screen = 'splash' | 'connection' | 'home';

function App() {
    const [currentScreen, setCurrentScreen] = useState<Screen>('splash');

    useEffect(() => {
        // Initialize IP address from stored device
        initializeEsp32Ip();
    }, []);

    const handleSplashFinish = () => {
        setCurrentScreen('connection');
    };

    const handleConnected = () => {
        setCurrentScreen('home');
    };

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
            {currentScreen === 'splash' && (
                <SplashScreen onFinish={handleSplashFinish} />
            )}
            {currentScreen === 'connection' && (
                <ConnectionScreen onConnected={handleConnected} />
            )}
            {currentScreen === 'home' && <HomeScreen />}
        </SafeAreaProvider>
    );
}

export default App;

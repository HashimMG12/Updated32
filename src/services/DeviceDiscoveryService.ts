import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Esp32Device {
  ip: string;
  name?: string;
  lastSeen: number;
  status?: string;
}

const STORAGE_KEY = '@esp32_devices';
const SELECTED_DEVICE_KEY = '@esp32_selected_device';

// ============ DISCOVER ESP32 DEVICES ON NETWORK ============
export async function discoverEsp32Devices(): Promise<Esp32Device[]> {
  const discoveredDevices: Esp32Device[] = [];
  
  try {
    // Get device's local IP (we'll scan common subnets)
    const commonSubnets = [
      '192.168.1',   // Most common home router
      '192.168.0',   // Alternative home router
      '192.168.4',   // ESP32 hotspot
      '192.168.43',  // Mobile hotspot
      '10.0.0',      // Some routers
    ];

    console.log('Starting ESP32 device discovery...');

    // Scan each subnet
    for (const subnet of commonSubnets) {
      const promises: Promise<void>[] = [];
      
      // Scan IPs 1-254 in parallel (but limit concurrent requests)
      for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        
        // Limit concurrent requests to avoid overwhelming
        if (promises.length >= 20) {
          await Promise.race(promises);
          promises.splice(0, promises.length);
        }
        
        const promise = checkEsp32Device(ip).then(device => {
          if (device) {
            discoveredDevices.push(device);
          }
        });
        
        promises.push(promise);
      }
      
      // Wait for remaining promises
      await Promise.all(promises);
    }

    console.log(`Discovery complete. Found ${discoveredDevices.length} ESP32 device(s)`);
    
    // Save discovered devices
    if (discoveredDevices.length > 0) {
      await saveDiscoveredDevices(discoveredDevices);
    }
    
    return discoveredDevices;
  } catch (error) {
    console.log('Discovery error:', error);
    return discoveredDevices;
  }
}

// ============ CHECK IF IP IS ESP32 DEVICE ============
async function checkEsp32Device(ip: string): Promise<Esp32Device | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout per IP
    
    const response = await fetch(`http://${ip}/status`, {
      method: 'GET',
      signal: controller.signal,
    } as RequestInit);
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const status = await response.text();
      console.log(`Found ESP32 at ${ip}: ${status}`);
      
      return {
        ip,
        status,
        lastSeen: Date.now(),
      };
    }
  } catch (error) {
    // Not an ESP32 device or not reachable - silently continue
  }
  
  return null;
}

// ============ SAVE DISCOVERED DEVICES ============
async function saveDiscoveredDevices(devices: Esp32Device[]): Promise<void> {
  try {
    const existingDevices = await getDiscoveredDevices();
    
    // Merge with existing devices (update if IP exists, add if new)
    const mergedDevices = [...existingDevices];
    
    devices.forEach(newDevice => {
      const existingIndex = mergedDevices.findIndex(d => d.ip === newDevice.ip);
      if (existingIndex >= 0) {
        // Update existing device
        mergedDevices[existingIndex] = {
          ...mergedDevices[existingIndex],
          ...newDevice,
          lastSeen: Date.now(),
        };
      } else {
        // Add new device
        mergedDevices.push(newDevice);
      }
    });
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedDevices));
  } catch (error) {
    console.log('Error saving devices:', error);
  }
}

// ============ GET DISCOVERED DEVICES ============
export async function getDiscoveredDevices(): Promise<Esp32Device[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Error getting devices:', error);
  }
  return [];
}

// ============ SET SELECTED DEVICE ============
export async function setSelectedDevice(device: Esp32Device): Promise<void> {
  try {
    await AsyncStorage.setItem(SELECTED_DEVICE_KEY, JSON.stringify(device));
  } catch (error) {
    console.log('Error saving selected device:', error);
  }
}

// ============ GET SELECTED DEVICE ============
export async function getSelectedDevice(): Promise<Esp32Device | null> {
  try {
    const data = await AsyncStorage.getItem(SELECTED_DEVICE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Error getting selected device:', error);
  }
  return null;
}

// ============ REMOVE DEVICE ============
export async function removeDevice(ip: string): Promise<void> {
  try {
    const devices = await getDiscoveredDevices();
    const filtered = devices.filter(d => d.ip !== ip);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    
    // If removed device was selected, clear selection
    const selected = await getSelectedDevice();
    if (selected && selected.ip === ip) {
      await AsyncStorage.removeItem(SELECTED_DEVICE_KEY);
    }
  } catch (error) {
    console.log('Error removing device:', error);
  }
}

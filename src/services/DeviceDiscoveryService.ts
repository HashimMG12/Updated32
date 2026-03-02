import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Esp32Device {
  ip: string;
  name?: string;
  lastSeen: number;
  status?: string;
}

const STORAGE_KEY = '@esp32_devices';
const SELECTED_DEVICE_KEY = '@esp32_selected_device';

// Default ESP32 hotspot IP (no network scan - fast connection)
const DEFAULT_ESP32_IP = '192.168.4.1';

// ============ DISCOVER ESP32 DEVICES ON NETWORK ============
// Only checks default ESP32 hotspot IP (192.168.4.1) for fast connection.
export async function discoverEsp32Devices(): Promise<Esp32Device[]> {
  const discoveredDevices: Esp32Device[] = [];

  try {
    console.log('Checking default ESP32 IP:', DEFAULT_ESP32_IP);

    const device = await checkEsp32Device(DEFAULT_ESP32_IP);
    if (device) {
      discoveredDevices.push(device);
      await saveDiscoveredDevices(discoveredDevices);
    }

    console.log(`Discovery complete. Found ${discoveredDevices.length} ESP32 device(s)`);
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

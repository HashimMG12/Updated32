import {Platform, PermissionsAndroid} from 'react-native';
import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';

/**
 * Request Bluetooth and Location permissions (Android only)
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    const allGranted =
      granted['android.permission.BLUETOOTH_CONNECT'] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_SCAN'] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.ACCESS_FINE_LOCATION'] ===
        PermissionsAndroid.RESULTS.GRANTED;

    return allGranted;
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
}

/**
 * Check if Bluetooth is enabled
 */
export async function isBluetoothEnabled(): Promise<boolean> {
  try {
    return await RNBluetoothClassic.isBluetoothEnabled();
  } catch (error) {
    console.error('Bluetooth check error:', error);
    return false;
  }
}

/**
 * Request to enable Bluetooth
 */
export async function requestBluetoothEnable(): Promise<boolean> {
  try {
    return await RNBluetoothClassic.requestBluetoothEnabled();
  } catch (error) {
    console.error('Bluetooth enable error:', error);
    return false;
  }
}

/**
 * Get list of paired/bonded devices
 */
export async function getPairedDevices(): Promise<BluetoothDevice[]> {
  try {
    return await RNBluetoothClassic.getBondedDevices();
  } catch (error) {
    console.error('Get paired devices error:', error);
    return [];
  }
}

/**
 * Find a device by name in paired devices
 */
export async function findDeviceByName(
  name: string,
): Promise<BluetoothDevice | null> {
  const devices = await getPairedDevices();
  const device = devices.find(d => d.name === name);
  return device || null;
}

/**
 * Find a device by address in paired devices
 */
export async function findDeviceByAddress(
  address: string,
): Promise<BluetoothDevice | null> {
  const devices = await getPairedDevices();
  const device = devices.find(d => d.address === address);
  return device || null;
}

/**
 * Connect to a Bluetooth device
 */
export async function connectToDevice(
  device: BluetoothDevice,
): Promise<boolean> {
  try {
    const isConnected = await device.isConnected();
    if (isConnected) {
      return true;
    }
    return await device.connect();
  } catch (error) {
    console.error('Connect error:', error);
    return false;
  }
}

/**
 * Disconnect from a Bluetooth device
 */
export async function disconnectFromDevice(
  device: BluetoothDevice,
): Promise<boolean> {
  try {
    return await device.disconnect();
  } catch (error) {
    console.error('Disconnect error:', error);
    return false;
  }
}

/**
 * Send WiFi credentials to ESP32
 * Format: "SSID,Password"
 */
export async function sendWifiCredentials(
  device: BluetoothDevice,
  ssid: string,
  password: string,
): Promise<boolean> {
  try {
    const data = `${ssid},${password}\n`;
    return await device.write(data);
  } catch (error) {
    console.error('Send data error:', error);
    return false;
  }
}

/**
 * Send raw data to ESP32
 */
export async function sendData(
  device: BluetoothDevice,
  data: string,
): Promise<boolean> {
  try {
    return await device.write(data + '\n');
  } catch (error) {
    console.error('Send data error:', error);
    return false;
  }
}

/**
 * Check if a device is currently connected
 */
export async function isDeviceConnected(
  device: BluetoothDevice,
): Promise<boolean> {
  try {
    return await device.isConnected();
  } catch (error) {
    console.error('Check connection error:', error);
    return false;
  }
}

/**
 * Get all currently connected devices from paired list
 */
export async function getConnectedDevices(): Promise<BluetoothDevice[]> {
  try {
    const devices = await getPairedDevices();
    const connectedDevices: BluetoothDevice[] = [];
    
    for (const device of devices) {
      const connected = await device.isConnected();
      if (connected) {
        connectedDevices.push(device);
      }
    }
    
    return connectedDevices;
  } catch (error) {
    console.error('Get connected devices error:', error);
    return [];
  }
}

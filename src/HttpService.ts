import {getSelectedDevice, setSelectedDevice} from './services/DeviceDiscoveryService';

// ============ CONFIGURATION ============
// ESP32's IP address - can be hotspot (192.168.4.1) or WiFi IP
let esp32IpAddress: string | null = null; // Will be loaded from selected device

// ============ INITIALIZE IP ADDRESS ============
export async function initializeEsp32Ip(): Promise<void> {
  try {
    const selectedDevice = await getSelectedDevice();
    if (selectedDevice) {
      esp32IpAddress = selectedDevice.ip;
      console.log('ESP32 IP loaded from storage:', esp32IpAddress);
    } else {
      // Fallback to hotspot IP if no device selected
      esp32IpAddress = '192.168.4.1';
      console.log('No device selected, using default hotspot IP');
    }
  } catch (error) {
    console.log('Error initializing IP:', error);
    esp32IpAddress = '192.168.4.1';
  }
}

// ============ SET IP ADDRESS ============
export async function setEsp32IpAddress(ip: string): Promise<void> {
  esp32IpAddress = ip;
  console.log('ESP32 IP set to:', ip);
  
  // Also save as selected device
  await setSelectedDevice({
    ip,
    lastSeen: Date.now(),
  });
}

export function getEsp32IpAddress(): string {
  return esp32IpAddress || '192.168.4.1';
}

// ============ BUILD URL ============
function buildUrl(endpoint: string): string {
  if (!esp32IpAddress) {
    throw new Error('ESP32 IP address not set');
  }
  return `http://${esp32IpAddress}${endpoint}`;
}

// ============ SEND COMMANDS ============
export async function sendOn(): Promise<boolean> {
  return sendCommand('/on');
}

export async function sendOff(): Promise<boolean> {
  return sendCommand('/off');
}

export async function sendToggle(): Promise<boolean> {
  return sendCommand('/toggle');
}

// ============ COLOR COMMANDS ============
export async function sendColorRed(): Promise<boolean> {
  return sendCommand('/red');
}

export async function sendColorGreen(): Promise<boolean> {
  return sendCommand('/green');
}

export async function sendColorBlue(): Promise<boolean> {
  return sendCommand('/blue');
}

export async function sendColorCyan(): Promise<boolean> {
  return sendCommand('/cyan');
}

export async function sendColorMagenta(): Promise<boolean> {
  return sendCommand('/magenta');
}

export async function sendColorYellow(): Promise<boolean> {
  return sendCommand('/yellow');
}

export async function sendColorWhite(): Promise<boolean> {
  return sendCommand('/white');
}

// ============ SEND COLOR BY RGB ============
export async function sendColorRGB(r: number, g: number, b: number): Promise<boolean> {
  try {
    const url = buildUrl(`/setcolor?r=${r}&g=${g}&b=${b}`);
    console.log('Sending RGB color to:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);
    
    if (response.ok) {
      const text = await response.text();
      console.log('RGB color response:', text);
      return true;
    }
    console.log('RGB color command failed:', response.status);
    return false;
  } catch (error) {
    console.log('Send RGB color error:', error);
    return false;
  }
}

// ============ CONVERT HEX TO RGB ============
function hexToRgb(hex: string): {r: number; g: number; b: number} | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return {r, g, b};
  }
  
  // Handle 6-digit hex
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return {r, g, b};
  }
  
  return null;
}

// ============ SEND COLOR BY HEX ============
export async function sendColorByHex(hex: string): Promise<boolean> {
  // Convert hex to RGB
  const rgb = hexToRgb(hex);
  
  if (rgb) {
    // Use RGB endpoint for full color support
    return sendColorRGB(rgb.r, rgb.g, rgb.b);
  }
  
  // Fallback to white if hex conversion fails
  console.log(`Invalid hex color ${hex}, using white`);
  return sendColorWhite();
}

export async function getStatus(): Promise<string | null> {
  try {
    const url = buildUrl('/status');
    console.log('Getting status from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);
    
    if (response.ok) {
      const text = await response.text();
      console.log('Status:', text);
      return text;
    }
    return null;
  } catch (error) {
    console.log('Get status error:', error);
    return null;
  }
}

async function sendCommand(endpoint: string): Promise<boolean> {
  try {
    const url = buildUrl(endpoint);
    console.log('Sending command to:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);
    
    if (response.ok) {
      const text = await response.text();
      console.log('Response:', text);
      return true;
    }
    console.log('Command failed:', response.status);
    return false;
  } catch (error) {
    console.log('Send command error:', error);
    return false;
  }
}

// ============ CHECK CONNECTION ============
export async function checkConnection(): Promise<boolean> {
  try {
    if (!esp32IpAddress) {
      return false;
    }
    
    const url = buildUrl('/status');
    const response = await fetch(url, {
      method: 'GET',
      timeout: 3000,
    } as RequestInit);
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

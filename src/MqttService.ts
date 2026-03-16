/**
 * MQTT service – matches ESP32 firmware topics and payloads.
 * App connects via native MQTT over TCP using sp-react-native-mqtt.
 *
 * IMPORTANT:
 * - ESP32 uses TCP MQTT on 182.191.116.32:1994.
 * - The app now also uses TCP MQTT (NOT WebSockets), so no ws:// port is needed.
 *
 * Make sure port 1994 on 182.191.116.32 is reachable from the phone
 * (same way it already works for the ESP32 and mosquitto_pub).
 */

import MQTT, {IMqttClient} from 'sp-react-native-mqtt';

// ============ CONFIG (match broker; use TCP MQTT URL for app) ============
const MQTT_CONFIG = {
  // Native TCP MQTT URI – same as ESP32/mosquitto_pub
  uri: 'mqtt://182.191.116.32:1994',
  username: '',
  password: '',
};

// Topics – must match ESP32 firmware exactly
const TOPICS = {
  color: 'esp32/rgb/color',
  mode: 'esp32/rgb/mode',
  brightness: 'esp32/rgb/brightness',
  command: 'esp32/rgb/command',
  beat: 'esp32/rgb/beat',
  status: 'esp32/rgb/status',
  availability: 'esp32/rgb/available',
};

export type EspMode =
  | 'manual'
  | 'disco'
  | 'rock'
  | 'heartbeat'
  | 'techno'
  | 'waltz'
  | 'reggae'
  | 'police'
  | 'rainbow'
  | 'strobe'
  | 'fire'
  | 'christmas'
  | 'party'
  | 'fade'
  | 'pulse'
  | 'colorcycle'
  | 'random';

export interface Esp32Status {
  state?: string;
  mode?: string;
  mode_id?: number;
  red?: number;
  green?: number;
  blue?: number;
  brightness?: number;
  rssi?: number;
  ip?: string;
}

// ============ STATE ============
let client: IMqttClient | null = null;
let isConnected = false;
let lastStatus: Esp32Status | null = null;
let lastStatusJson: string | null = null;

type ConnectionCallback = (connected: boolean) => void;
type StatusCallback = (status: Esp32Status) => void;
type AvailabilityCallback = (online: boolean) => void;

let onConnectionCallback: ConnectionCallback | null = null;
let onStatusCallback: StatusCallback | null = null;
let onAvailabilityCallback: AvailabilityCallback | null = null;

// ============ CONNECT ============
export function connectMqtt(): void {
  if (client) {
    // Already created (auto-reconnect handled by native client)
    return;
  }

  try {
    MQTT.createClient({
      uri: MQTT_CONFIG.uri,
      clientId: `app_${Math.random().toString(16).slice(2, 10)}`,
      user: MQTT_CONFIG.username || undefined,
      pass: MQTT_CONFIG.password || undefined,
      clean: true,
      keepalive: 60,
      auth: !!MQTT_CONFIG.username,
      automaticReconnect: true,
    }).then(createdClient => {
      client = createdClient;

      client?.on('connect', () => {
        isConnected = true;
        onConnectionCallback?.(true);

        client?.subscribe(TOPICS.status, 0);
        client?.subscribe(TOPICS.availability, 0);
      });

      client?.on('message', msg => {
        const topic = msg.topic;
        const message = msg.data;

        if (topic === TOPICS.status) {
          try {
            const status = JSON.parse(message) as Esp32Status;
            lastStatus = status;
            lastStatusJson = message;
            onStatusCallback?.(status);
          } catch {
            lastStatusJson = message;
          }
        }

        if (topic === TOPICS.availability) {
          const online = message.toLowerCase() === 'online';
          onAvailabilityCallback?.(online);
        }
      });

      client?.on('error', error => {
        console.warn('MQTT error:', error);
        isConnected = false;
        onConnectionCallback?.(false);
      });

      client?.on('closed', () => {
        isConnected = false;
        onConnectionCallback?.(false);
      });

      client?.connect();
    }).catch(error => {
      console.warn('MQTT createClient error:', error);
      isConnected = false;
      onConnectionCallback?.(false);
    });
  } catch (error) {
    console.warn('MQTT connect error:', error);
    isConnected = false;
    onConnectionCallback?.(false);
  }
}

// ============ DISCONNECT ============
export function disconnectMqtt(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
  isConnected = false;
  onConnectionCallback?.(false);
}

// ============ PUBLISH HELPERS ============
function publish(topic: string, payload: string): boolean {
  if (!client || !isConnected) {
    return false;
  }
  try {
    client.publish(topic, payload, 0, false);
    return true;
  } catch {
    return false;
  }
}

// ============ COMMANDS (match ESP32 handlers) – return Promise for HttpService compatibility ============
export function sendOn(): Promise<boolean> {
  return Promise.resolve(publish(TOPICS.command, 'on'));
}

export function sendOff(): Promise<boolean> {
  return Promise.resolve(publish(TOPICS.command, 'off'));
}

export function sendCommand(cmd: string): boolean {
  return publish(TOPICS.command, cmd.trim().toLowerCase());
}

/** Send color: hex #RRGGBB → payload RRGGBB (no comma). */
export function sendColorByHex(hex: string): Promise<boolean> {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    return Promise.resolve(publish(TOPICS.color, clean));
  }
  if (clean.length === 3) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return Promise.resolve(publish(TOPICS.color, r + g + b));
  }
  return Promise.resolve(publish(TOPICS.color, 'FFFFFF'));
}

/** Send color as R,G,B (ESP32 accepts this). */
export function sendColorRGB(r: number, g: number, b: number): boolean {
  const payload = `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
  return publish(TOPICS.color, payload);
}

export function setMode(mode: EspMode): Promise<boolean> {
  return Promise.resolve(publish(TOPICS.mode, mode));
}

export function setBrightness(value: number): boolean {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return publish(TOPICS.brightness, String(clamped));
}

export function setBrightnessPercent(percent: number): boolean {
  const value = Math.round((percent / 100) * 255);
  return setBrightness(value);
}

export function sendBeat(): boolean {
  return publish(TOPICS.beat, '1');
}

// ============ STATUS (from subscription; no request/response) ============
export function getLastStatus(): Esp32Status | null {
  return lastStatus;
}

/** Last status as JSON string (for compatibility with getStatus()). */
export function getStatusJson(): string | null {
  return lastStatusJson;
}

/** Async check for use in screens – matches HttpService.checkConnection(). */
export function checkConnection(): Promise<boolean> {
  return Promise.resolve(isMqttConnected());
}

/** Async get last status JSON – matches HttpService.getStatus(). */
export function getStatus(): Promise<string | null> {
  return Promise.resolve(getStatusJson());
}

// ============ CALLBACKS ============
export function onConnectionChange(cb: ConnectionCallback): void {
  onConnectionCallback = cb;
}

export function onStatusChange(cb: StatusCallback): void {
  onStatusCallback = cb;
}

export function onAvailabilityChange(cb: AvailabilityCallback): void {
  onAvailabilityCallback = cb;
}

// ============ GETTERS ============
export function isMqttConnected(): boolean {
  return isConnected;
}

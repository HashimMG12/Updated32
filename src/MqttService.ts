// import mqtt, {MqttClient} from 'mqtt';


// const MQTT_CONFIG = {
//   // Using websocket URL - adjust port if broker uses different ws port
//   url: 'ws://182.191.116.32:1994',
//   deviceId: 'esp32-CC04E3498CD4',
// };

// // ============ TOPICS ============
// const TOPICS = {
//   commands: `devices/${MQTT_CONFIG.deviceId}/commands`,
//   ledState: `devices/${MQTT_CONFIG.deviceId}/state/led`,
//   status: `devices/${MQTT_CONFIG.deviceId}/status`,
// };

// // ============ STATE ============
// let client: MqttClient | null = null;
// let isConnected = false;
// let onLedStateCallback: ((state: boolean) => void) | null = null;
// let onConnectionCallback: ((connected: boolean) => void) | null = null;
// let onDeviceStatusCallback: ((online: boolean) => void) | null = null;

// // ============ CONNECT ============
// export function connectMqtt(): void {
//   console.log('Connecting to MQTT...');
//   console.log('URL:', MQTT_CONFIG.url);

//   try {
//     client = mqtt.connect(MQTT_CONFIG.url, {
//       clientId: `app_${Math.random().toString(16).substr(2, 8)}`,
//       reconnectPeriod: 5000,
//       connectTimeout: 10000,
//     });

//     client.on('connect', () => {
//       console.log('MQTT Connected!');
//       isConnected = true;
//       onConnectionCallback?.(true);

//       // Subscribe to topics
//       client?.subscribe([TOPICS.ledState, TOPICS.status], (err) => {
//         if (err) {
//           console.log('Subscribe error:', err);
//         } else {
//           console.log('Subscribed to topics');
//         }
//       });
//     });

//     client.on('message', (topic: string, payload: Buffer) => {
//       const message = payload.toString();
//       console.log(`Received: ${topic} = ${message}`);

//       if (topic === TOPICS.ledState) {
//         const isOn = message.toUpperCase() === 'ON';
//         onLedStateCallback?.(isOn);
//       }

//       if (topic === TOPICS.status) {
//         const isOnline = message.toUpperCase() === 'ONLINE';
//         onDeviceStatusCallback?.(isOnline);
//       }
//     });

//     client.on('error', (err) => {
//       console.log('MQTT Error:', err.message);
//       isConnected = false;
//       onConnectionCallback?.(false);
//     });

//     client.on('close', () => {
//       console.log('MQTT Connection closed');
//       isConnected = false;
//       onConnectionCallback?.(false);
//     });

//     client.on('offline', () => {
//       console.log('MQTT Offline');
//       isConnected = false;
//       onConnectionCallback?.(false);
//     });

//   } catch (error) {
//     console.log('MQTT Connect error:', error);
//     isConnected = false;
//     onConnectionCallback?.(false);
//   }
// }

// // ============ DISCONNECT ============
// export function disconnectMqtt(): void {
//   if (client) {
//     client.end();
//     client = null;
//     isConnected = false;
//     onConnectionCallback?.(false);
//   }
// }

// // ============ SEND COMMANDS ============
// export function sendOn(): void {
//   publishCommand('ON');
// }

// export function sendOff(): void {
//   publishCommand('OFF');
// }

// export function sendToggle(): void {
//   publishCommand('TOGGLE');
// }

// function publishCommand(command: string): void {
//   if (!client || !isConnected) {
//     console.log('MQTT not connected, cannot send:', command);
//     return;
//   }

//   client.publish(TOPICS.commands, command, (err) => {
//     if (err) {
//       console.log('Publish error:', err);
//     } else {
//       console.log(`Sent: ${command}`);
//     }
//   });
// }

// // ============ LISTENERS ============
// export function onLedStateChange(callback: (state: boolean) => void): void {
//   onLedStateCallback = callback;
// }

// export function onConnectionChange(callback: (connected: boolean) => void): void {
//   onConnectionCallback = callback;
// }

// export function onDeviceStatus(callback: (online: boolean) => void): void {
//   onDeviceStatusCallback = callback;
// }

// // ============ GETTERS ============
// export function isMqttConnected(): boolean {
//   return isConnected;
// }

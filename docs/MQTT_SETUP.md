# What to do now: run the app and connect to the server

Follow these steps in order.

---

## Step 1: Make sure the MQTT server has WebSocket turned on

The server is at **182.191.116.32**. Right now the ESP32 connects to it on port **1994** (normal MQTT). Your phone app needs **WebSocket** on the same server.

- **If you control the server (you or Asim):**  
  On that machine, enable a **WebSocket** listener for MQTT.  
  - **Mosquitto:** In `mosquitto.conf` add:
    ```conf
    listener 8083
    protocol websockets
    allow_anonymous true
    ```
    Then restart Mosquitto.  
  - **EMQX / other:** In its config or dashboard, enable “MQTT over WebSocket” and note the **port** (e.g. 8083 or 8084).

- **If someone else controls the server:**  
  Ask them to enable **MQTT over WebSocket** and tell you the **port** (and path like `/mqtt` if they use one).

Without this, the app will not connect. Port **1994** is for the ESP32 only; the app needs a **different** port for WebSocket (e.g. **8083**).

---

## Step 2: Set the app’s server address (if needed)

Open this file in your project:

**`src/MqttService.ts`**

Find this part (near the top):

```ts
url: 'ws://182.191.116.32:8083',
```

- If the server’s WebSocket is on **port 8083** and IP **182.191.116.32**, leave it as is.
- If they gave you a **different port** (e.g. 9001), change it to:
  ```ts
  url: 'ws://182.191.116.32:9001',
  ```
- If they said the URL has a **path** (e.g. `/mqtt`), use:
  ```ts
  url: 'ws://182.191.116.32:8083/mqtt',
  ```
- If the server has a **domain name** instead of IP, use that:
  ```ts
  url: 'ws://your-server.com:8083',
  ```

Save the file.

---

## Step 3: Run the app

In the project folder:

```bash
npm install
npm start
```

In another terminal (or from the Metro UI), run on your device/emulator:

```bash
npm run android
```

or

```bash
npm run ios
```

When the app opens and you go to the home screen, it will try to connect to **ws://182.191.116.32:8083** (or whatever you set in Step 2).  
If the server has WebSocket enabled and the URL is correct, the app will connect and you can control the light.  
If it doesn’t connect, check: (1) WebSocket is enabled on the server, (2) the URL/port/path in `MqttService.ts` match the server, (3) your phone and the server can reach each other (same Wi‑Fi or server is on the internet and firewall allows the WebSocket port).

---

## Quick checklist

| # | What to do |
|---|------------|
| 1 | On the machine at 182.191.116.32: enable MQTT WebSocket (e.g. port 8083). |
| 2 | In `src/MqttService.ts`: set `url` to that WebSocket address (and port/path if needed). |
| 3 | Run the app: `npm start` then `npm run android` or `npm run ios`. |

That’s all you need to run the app and connect it to the server.

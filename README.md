# Agent Broker UI

Web UI for conversing with an Agent Broker via JSON-RPC. Enter your broker URL and message; the app proxies the request and displays the broker’s answer with state and timestamp.

## Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Configurable broker URL** – Default is the clinical-trial broker; change it in Settings to use another broker.
- **Dynamic IDs** – Each request uses a generated `id` and `messageId` (UUID).
- **Response display** – Broker answer text is highlighted; **State** and **Timestamp** are shown as tags.
- **CORS** – The server sends CORS headers so the app can be used from any origin.

## API

The frontend sends `POST /api/broker` with JSON:

```json
{
  "brokerUrl": "https://...",
  "payload": { "jsonrpc": "2.0", "id": ..., "method": "message/send", "params": { ... } }
}
```

The server forwards `payload` to `brokerUrl` with `Content-Type` and `x-anypoint-api-instance-id` (default `20551771` in `server.js`) and returns the broker response.

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

// CORS for all origins so the app works from anywhere
app.use(cors({ origin: true }));
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Proxy: forward JSON-RPC to the user's broker URL
app.post('/api/broker', async (req, res) => {
  const { brokerUrl, payload, apiInstanceId } = req.body;

  if (!brokerUrl || !payload) {
    return res.status(400).json({
      error: 'Missing brokerUrl or payload',
      jsonrpc: '2.0',
      id: payload?.id ?? null
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-anypoint-api-instance-id': apiInstanceId || '20551771'
  };

  try {
    const response = await fetch(brokerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json(
        data.error ? data : { error: response.statusText, ...data }
      );
    }

    res.json(data);
  } catch (err) {
    res.status(502).json({
      jsonrpc: '2.0',
      id: payload.id ?? null,
      error: { message: err.message || 'Proxy request failed' }
    });
  }
});

function tryListen(port) {
  const server = app.listen(port, () => {
    console.log(`Agent Broker UI running at http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
}

tryListen(DEFAULT_PORT);

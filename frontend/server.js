const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 9212;
const BACKEND_URL = process.env.BACKEND_URL || 'http://157.173.101.159:8212';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '' }
}));

const frontendPath = path.resolve(__dirname, 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const io = new Server(server, {
  cors: { origin: '*' }
});

const backendSocket = require('socket.io-client')(BACKEND_URL);

backendSocket.on('connect', () => {
  console.log('Connected to backend WebSocket');
});

backendSocket.on('disconnect', () => {
  console.log('Disconnected from backend WebSocket');
});

backendSocket.on('card-scanned', (data) => {
  io.emit('card-scanned', data);
});

backendSocket.on('payment-confirmed', (data) => {
  io.emit('payment-confirmed', data);
});

backendSocket.on('balance-updated', (data) => {
  io.emit('balance-updated', data);
});

backendSocket.on('topup-success', (data) => {
  io.emit('topup-success', data);
});

backendSocket.on('payment-success', (data) => {
  io.emit('payment-success', data);
});

backendSocket.on('payment-declined', (data) => {
  io.emit('payment-declined', data);
});

io.on('connection', (socket) => {
  console.log(`Frontend WebSocket client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Frontend WebSocket client disconnected: ${socket.id}`);
  });

  socket.on('request-balance', async (data) => {
    try {
      const response = await fetch(`${BACKEND_URL}/balance/${data.uid}`);
      const result = await response.json();
      socket.emit('balance-response', result);
    } catch (error) {
      socket.emit('balance-response', { success: false, error: error.message });
    }
  });

  socket.on('request-products', async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/products`);
      const result = await response.json();
      socket.emit('products-response', result);
    } catch (error) {
      socket.emit('products-response', { success: false, error: error.message });
    }
  });

  socket.on('request-history', async (data) => {
    try {
      const response = await fetch(`${BACKEND_URL}/transactions/${data.uid}?limit=${data.limit || 10}`);
      const result = await response.json();
      socket.emit('history-response', result);
    } catch (error) {
      socket.emit('history-response', { success: false, error: error.message });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on http://157.173.101.159:${PORT}`);
  console.log(`Backend proxy: ${BACKEND_URL}`);
});

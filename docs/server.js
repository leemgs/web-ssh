'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { Client } = require('ssh2');
const { MAX_KEY_SIZE, validateConnection } = require('./config');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_FILES = new Set(['/styles.css', '/app.js']);
function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function attachTerminal(socket) {
  let client;
  let stream;
  let connected = false;

  const close = () => {
    stream?.end();
    client?.end();
    stream = undefined;
    client = undefined;
    connected = false;
  };

  socket.on('message', (buffer) => {
    let message;
    try { message = JSON.parse(buffer.toString()); } catch { return send(socket, { type: 'error', message: '잘못된 요청입니다.' }); }

    if (message.type === 'connect') {
      if (connected || client) return send(socket, { type: 'error', message: '이미 연결을 시도하고 있습니다.' });
      let config;
      try { config = validateConnection(message); } catch (error) { return send(socket, { type: 'error', message: error.message }); }
      client = new Client();
      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        finish(prompts.map(() => config.password || ''));
      });
      client.once('ready', () => {
        connected = true;
        client.shell({ term: 'xterm-256color', cols: 100, rows: 30 }, (error, shell) => {
          if (error) {
            send(socket, { type: 'error', message: `터미널을 열 수 없습니다: ${error.message}` });
            return close();
          }
          stream = shell;
          send(socket, { type: 'ready' });
          shell.on('data', (data) => send(socket, { type: 'data', data: data.toString('utf8') }));
          shell.stderr.on('data', (data) => send(socket, { type: 'data', data: data.toString('utf8') }));
          shell.once('close', () => { send(socket, { type: 'closed' }); close(); });
        });
      });
      client.on('error', (error) => { send(socket, { type: 'error', message: `SSH 연결 실패: ${error.message}` }); close(); });
      client.connect(config);
      return;
    }
    if (message.type === 'input' && stream) stream.write(String(message.data || '').slice(0, 64 * 1024));
    if (message.type === 'resize' && stream) {
      const cols = Math.max(20, Math.min(500, Number(message.cols) || 80));
      const rows = Math.max(5, Math.min(200, Number(message.rows) || 24));
      stream.setWindow(rows, cols, 0, 0);
    }
    if (message.type === 'disconnect') close();
  });
  socket.once('close', close);
}

function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.get([...PUBLIC_FILES], (req, res) => res.sendFile(path.join(__dirname, req.path)));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  const server = http.createServer(app);
  const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  const sockets = new WebSocketServer({
    server,
    path: '/ssh',
    maxPayload: MAX_KEY_SIZE + 4096,
    verifyClient: ({ origin }, done) => done(allowedOrigins.size === 0 || allowedOrigins.has(origin), 403, 'Origin not allowed')
  });
  sockets.on('connection', attachTerminal);
  return server;
}

if (require.main === module) createServer().listen(PORT, () => console.log(`Web SSH: http://localhost:${PORT}`));
module.exports = { createServer };

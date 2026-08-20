'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConnection } = require('../config');

test('validates and normalizes connection details', () => {
  assert.deepEqual(validateConnection({ host: ' server.local ', username: 'root', password: 'secret', port: '2222' }), {
    host: 'server.local', username: 'root', password: 'secret', privateKey: undefined,
    passphrase: undefined, port: 2222, readyTimeout: 15000,
    keepaliveInterval: 10000, keepaliveCountMax: 3, tryKeyboard: true
  });
});
test('rejects invalid connection details', () => {
  assert.throws(() => validateConnection(null), /접속 정보/);
  assert.throws(() => validateConnection([]), /접속 정보/);
  assert.throws(() => validateConnection({ host: 'bad host', username: 'root', password: 'x' }), /호스트/);
  assert.throws(() => validateConnection({ host: 'host', username: 'root', port: 70000, password: 'x' }), /포트/);
  assert.throws(() => validateConnection({ host: 'host', username: 'root' }), /비밀번호/);
  assert.throws(() => validateConnection({ host: 'host', username: 'root', password: 'x'.repeat(16 * 1024 + 1) }), /너무 깁니다/);
  assert.throws(() => validateConnection({ host: 'host', username: 'root', privateKey: 'key', passphrase: 'x'.repeat(16 * 1024 + 1) }), /너무 깁니다/);
});

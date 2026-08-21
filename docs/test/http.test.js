'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

test('serves the application and health endpoint', async (context) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise(resolve => server.close(resolve)));

  const { port } = server.address();
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const home = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(home.status, 200);
  const markup = await home.text();
  assert.match(markup, /ORBIT <b>\(Web SSH\)<\/b>/);
  assert.match(markup, /새 SSH 연결/);
  assert.match(markup, /id="host"[^>]+value="leemgs\.mooo\.com"/);
  assert.match(markup, /id="username"[^>]+value="ubuntu"/);

  const app = await fetch(`http://127.0.0.1:${port}/app.js`);
  assert.equal(app.status, 200);
  assert.match(await app.text(), /wss:\/\/leemgs\.mooo\.com\/ssh/);
});

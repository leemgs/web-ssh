/* global Terminal, FitAddon */
'use strict';
const form = document.querySelector('#connect-form');
const keyInput = document.querySelector('#key');
const errorBox = document.querySelector('#error');
const status = document.querySelector('#status');
const section = document.querySelector('#terminal-section');
let socket;
let terminal;
let fit;

const defaultGateway = location.hostname.endsWith('github.io') ? '' : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh`;
const gatewayInput = document.querySelector('#gateway');
gatewayInput.value = new URLSearchParams(location.search).get('gateway') || localStorage.getItem('orbit-ssh-gateway') || defaultGateway;

keyInput.addEventListener('change', () => {
  document.querySelector('#key-name').textContent = keyInput.files[0]?.name || 'SSH 인증서 / 개인 키 업로드';
});

const readKey = (file) => file ? file.text() : Promise.resolve('');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  if (keyInput.files[0]?.size > 1024 * 1024) return errorBox.textContent = '개인 키는 1MB 이하만 사용할 수 있습니다.';
  const gateway = gatewayInput.value.trim();
  if (!gateway || !/^wss?:\/\//i.test(gateway)) return errorBox.textContent = 'GitHub Pages에서 사용할 SSH 중계 서버(wss://) 주소를 입력해 주세요.';
  if (location.protocol === 'https:' && !gateway.startsWith('wss://')) return errorBox.textContent = 'HTTPS 페이지에서는 보안 중계 서버(wss://)만 사용할 수 있습니다.';
  localStorage.setItem('orbit-ssh-gateway', gateway);
  status.textContent = '연결 중';
  socket = new WebSocket(gateway);
  socket.addEventListener('open', async () => socket.send(JSON.stringify({
    type: 'connect', host: form.host.value, port: form.port.value,
    username: form.username.value, password: form.password.value,
    privateKey: await readKey(keyInput.files[0])
  })));
  socket.addEventListener('message', ({ data }) => handleMessage(JSON.parse(data)));
  socket.addEventListener('close', () => { status.textContent = '연결 종료'; terminal?.writeln('\r\n\x1b[33m[세션이 종료되었습니다]\x1b[0m'); });
  socket.addEventListener('error', () => { errorBox.textContent = '서버에 연결할 수 없습니다.'; status.textContent = '오류'; });
});

function handleMessage(message) {
  if (message.type === 'error') { errorBox.textContent = message.message; status.textContent = '오류'; return; }
  if (message.type === 'ready') {
    status.textContent = '연결됨';
    section.hidden = false;
    document.querySelector('#session-title').textContent = `${form.username.value}@${form.host.value}:${form.port.value}`;
    if (!terminal) {
      terminal = new Terminal({ cursorBlink: true, fontFamily: 'DM Mono, monospace', fontSize: 14, theme: { background: '#11130e', foreground: '#e8ebdf', cursor: '#c8ff3d', selectionBackground: '#6c7e42' } });
      fit = new FitAddon.FitAddon(); terminal.loadAddon(fit); terminal.open(document.querySelector('#terminal'));
      terminal.onData(data => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: 'input', data })));
    }
    fit.fit(); terminal.focus(); section.scrollIntoView({ behavior: 'smooth' }); resize();
  }
  if (message.type === 'data') terminal?.write(message.data);
}

function resize() { if (terminal && socket?.readyState === WebSocket.OPEN) { fit.fit(); socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows })); } }
window.addEventListener('resize', resize);
document.querySelector('#disconnect').addEventListener('click', () => { socket?.send(JSON.stringify({ type: 'disconnect' })); socket?.close(); });

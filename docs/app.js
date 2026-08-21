/* global Terminal, FitAddon */
'use strict';
const form = document.querySelector('#connect-form');
const keyInput = document.querySelector('#key');
const errorBox = document.querySelector('#error');
const status = document.querySelector('#status');
const section = document.querySelector('#terminal-section');
const connectButton = document.querySelector('#connect');
let socket;
let terminal;
let fit;
let connectionSequence = 0;

const defaultGateway = location.hostname.endsWith('github.io')
  ? 'wss://leemgs.mooo.com/ssh'
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh`;
const gatewayInput = document.querySelector('#gateway');
gatewayInput.value = new URLSearchParams(location.search).get('gateway') || localStorage.getItem('orbit-ssh-gateway') || defaultGateway;

keyInput.addEventListener('change', () => {
  document.querySelector('#key-name').textContent = keyInput.files[0]?.name || 'SSH 인증서 / 개인 키 업로드';
  document.querySelector('#passphrase-field').hidden = !keyInput.files[0];
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
  socket?.close();
  const sequence = ++connectionSequence;
  connectButton.disabled = true;
  status.textContent = '연결 중';
  const connection = new WebSocket(gateway);
  socket = connection;
  const connectionTimeout = window.setTimeout(() => {
    if (connection.readyState === WebSocket.CONNECTING) connection.close();
  }, 15_000);
  connection.addEventListener('open', async () => {
    window.clearTimeout(connectionTimeout);
    try {
      const privateKey = await readKey(keyInput.files[0]);
      if (connection.readyState !== WebSocket.OPEN || sequence !== connectionSequence) return;
      connection.send(JSON.stringify({
        type: 'connect', host: form.host.value, port: form.port.value,
        username: form.username.value, password: form.password.value,
        privateKey, passphrase: form.passphrase.value
      }));
    } catch {
      errorBox.textContent = '개인 키 파일을 읽을 수 없습니다.';
      connection.close();
    }
  });
  connection.addEventListener('message', ({ data }) => {
    if (sequence !== connectionSequence) return;
    try { handleMessage(JSON.parse(data)); } catch { errorBox.textContent = '중계 서버가 올바르지 않은 응답을 보냈습니다.'; }
  });
  connection.addEventListener('close', () => {
    window.clearTimeout(connectionTimeout);
    if (sequence !== connectionSequence) return;
    connectButton.disabled = false;
    status.textContent = '연결 종료';
    terminal?.writeln('\r\n\x1b[33m[세션이 종료되었습니다]\x1b[0m');
  });
  connection.addEventListener('error', () => {
    if (sequence !== connectionSequence) return;
    connectButton.disabled = false;
    errorBox.textContent = '중계 서버에 연결할 수 없습니다. 주소와 서버 상태를 확인해 주세요.';
    status.textContent = '오류';
  });
});

function handleMessage(message) {
  if (message.type === 'error') {
    errorBox.textContent = message.message;
    status.textContent = '오류';
    connectButton.disabled = false;
    return;
  }
  if (message.type === 'ready') {
    status.textContent = '연결됨';
    connectButton.disabled = false;
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
  if (message.type === 'closed') socket?.close();
}

function resize() { if (terminal && socket?.readyState === WebSocket.OPEN) { fit.fit(); socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows })); } }
window.addEventListener('resize', resize);
document.querySelector('#disconnect').addEventListener('click', () => { socket?.send(JSON.stringify({ type: 'disconnect' })); socket?.close(); });
document.querySelector('#clear').addEventListener('click', () => terminal?.clear());
document.querySelector('#copy').addEventListener('click', async () => {
  const selection = terminal?.getSelection();
  try {
    if (selection) await navigator.clipboard.writeText(selection);
  } catch { errorBox.textContent = '클립보드 복사 권한을 확인해 주세요.'; }
  terminal?.focus();
});
document.querySelector('#paste').addEventListener('click', async () => {
  try {
    const content = await navigator.clipboard.readText();
    if (content && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data: content }));
  } catch { errorBox.textContent = '클립보드 붙여넣기 권한을 확인해 주세요.'; }
  terminal?.focus();
});
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await section.requestFullscreen();
  } catch { errorBox.textContent = '전체 화면을 시작할 수 없습니다.'; }
  window.setTimeout(resize, 50);
});
document.addEventListener('fullscreenchange', resize);

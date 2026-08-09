'use strict';

const CONNECT_TIMEOUT = 15_000;
const MAX_KEY_SIZE = 1024 * 1024;

function validateConnection(raw = {}) {
  const host = String(raw.host || '').trim();
  const username = String(raw.username || '').trim();
  const port = Number(raw.port || 22);
  const password = typeof raw.password === 'string' ? raw.password : undefined;
  const privateKey = typeof raw.privateKey === 'string' ? raw.privateKey : undefined;
  if (!host || host.length > 253 || /[\s/]/.test(host)) throw new Error('올바른 SSH 호스트를 입력해 주세요.');
  if (!username || username.length > 128) throw new Error('SSH 아이디를 입력해 주세요.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('포트는 1~65535 사이여야 합니다.');
  if (!password && !privateKey) throw new Error('비밀번호 또는 개인 키가 필요합니다.');
  if (privateKey && Buffer.byteLength(privateKey) > MAX_KEY_SIZE) throw new Error('개인 키는 1MB 이하여야 합니다.');
  return { host, port, username, password, privateKey, readyTimeout: CONNECT_TIMEOUT };
}

module.exports = { CONNECT_TIMEOUT, MAX_KEY_SIZE, validateConnection };

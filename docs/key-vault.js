'use strict';

// The non-extractable AES key and ciphertext stay in IndexedDB on this browser.
window.KeyVault = (() => {
  const DATABASE = 'orbit-ssh-key-vault';
  const STORE = 'vault';
  const KEY_ID = 'encryption-key';
  const RECORD_ID = 'private-key';

  const request = (operation) => new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });

  async function open() {
    const operation = indexedDB.open(DATABASE, 1);
    operation.onupgradeneeded = () => operation.result.createObjectStore(STORE);
    return request(operation);
  }

  async function run(mode, operation) {
    const database = await open();
    try {
      const transaction = database.transaction(STORE, mode);
      return await request(operation(transaction.objectStore(STORE)));
    } finally {
      database.close();
    }
  }

  async function encryptionKey() {
    let key = await run('readonly', store => store.get(KEY_ID));
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await run('readwrite', store => store.put(key, KEY_ID));
    }
    return key;
  }

  async function save(name, privateKey) {
    const key = await encryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(privateKey));
    await run('readwrite', store => store.put({ name, iv, ciphertext, savedAt: Date.now() }, RECORD_ID));
  }

  async function load() {
    const [record, key] = await Promise.all([
      run('readonly', store => store.get(RECORD_ID)),
      run('readonly', store => store.get(KEY_ID))
    ]);
    if (!record || !key) return null;
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.ciphertext);
    return { name: record.name, privateKey: new TextDecoder().decode(plaintext), savedAt: record.savedAt };
  }

  async function remove() {
    return run('readwrite', store => store.delete(RECORD_ID));
  }

  return { load, remove, save };
})();

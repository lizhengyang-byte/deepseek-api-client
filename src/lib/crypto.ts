const SECRET_DB = 'deepseek-api-client-secrets';
const SECRET_STORE = 'keys';
const KEY_ID = 'master';
const SECRET_PREFIX = 'secret:';

function openSecretDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SECRET_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SECRET_STORE)) db.createObjectStore(SECRET_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openSecretDb();
  const tx = db.transaction(SECRET_STORE, mode);
  const store = tx.objectStore(SECRET_STORE);
  return new Promise<T>((resolve, reject) => {
    const req = run(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 不可导出的 AES-GCM 主密钥，存于独立库，明文密钥不入 localStorage */
async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const existing = await withStore<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await withStore('readwrite', (s) => s.put(key, KEY_ID));
  return key;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function saveSecret(name: string, value: string): Promise<void> {
  const key = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  );
  const payload = `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
  await withStore('readwrite', (s) => s.put(payload, SECRET_PREFIX + name));
}

export async function readSecret(name: string): Promise<string | null> {
  const payload = await withStore<string | undefined>('readonly', (s) =>
    s.get(SECRET_PREFIX + name),
  );
  if (!payload) return null;
  try {
    const [ivText, cipherText] = payload.split('.');
    const key = await getOrCreateMasterKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivText) },
      key,
      fromBase64(cipherText),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function removeSecret(name: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(SECRET_PREFIX + name));
}

export async function clearAllSecrets(): Promise<void> {
  await withStore('readwrite', (s) => s.clear());
  await withStore('readwrite', (s) => s.delete(KEY_ID));
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

import { describe, it, expect, beforeEach, vi } from 'vitest';

// storage.ts usa los globales `localStorage` y `window` (que no existen en el
// entorno node de los tests): se simulan aquí. Como el módulo cachea si el
// cifrado está disponible, se reimporta limpio en cada test.

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

// Cifrado simulado reversible (suficiente para probar el flujo, no la criptografía).
const fakeCrypto = {
  isEncryptionAvailable: async () => true,
  encrypt: async (plain: string) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: async (b64: string) => Buffer.from(b64, 'base64').toString('utf8'),
};

const importStorage = async (electronAPI: unknown) => {
  vi.resetModules();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('window', { electronAPI });
  return await import('./storage');
};

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

describe('storage sin Electron (navegador)', () => {
  it('guarda y recupera en texto plano', async () => {
    const s = await importStorage(undefined);
    await s.saveJSON('k', { a: 1 });
    expect(store.get('k')).toBe('{"a":1}'); // sin cifrar
    expect(await s.loadJSON('k')).toEqual({ a: 1 });
  });

  it('hasKey y removeKey funcionan', async () => {
    const s = await importStorage(undefined);
    expect(s.hasKey('k')).toBe(false);
    await s.saveJSON('k', 'v');
    expect(s.hasKey('k')).toBe(true);
    s.removeKey('k');
    expect(s.hasKey('k')).toBe(false);
  });

  it('devuelve null si no hay nada guardado', async () => {
    const s = await importStorage(undefined);
    expect(await s.loadJSON('nada')).toBeNull();
  });
});

describe('storage con cifrado (Electron)', () => {
  it('guarda cifrado (envelope) y descifra al leer', async () => {
    const s = await importStorage(fakeCrypto);
    await s.saveJSON('k', { saldo: 500 });
    const raw = JSON.parse(store.get('k')!);
    expect(raw.__enc).toBe(1); // en disco va el sobre cifrado, no el dato
    expect(raw.d).not.toContain('saldo');
    expect(await s.loadJSON('k')).toEqual({ saldo: 500 });
  });

  it('migra datos heredados en texto plano a cifrado', async () => {
    store.set('k', JSON.stringify({ viejo: true }));
    const s = await importStorage(fakeCrypto);
    expect(await s.loadJSON('k')).toEqual({ viejo: true });
    const raw = JSON.parse(store.get('k')!);
    expect(raw.__enc).toBe(1); // tras leer, queda re-guardado cifrado
  });

  it('devuelve null si el descifrado falla (datos de otro equipo/usuario)', async () => {
    const broken = {
      ...fakeCrypto,
      decrypt: async () => {
        throw new Error('fallo de safeStorage');
      },
    };
    const s = await importStorage(broken);
    store.set('k', JSON.stringify({ __enc: 1, d: 'xxxx' }));
    expect(await s.loadJSON('k')).toBeNull();
    expect(s.hasKey('k')).toBe(true); // el dato sigue ahí, solo que ilegible
  });
});

describe('saveEncryptedJSON (secretos)', () => {
  it('guarda cifrado y se lee con loadJSON', async () => {
    const s = await importStorage(fakeCrypto);
    await s.saveEncryptedJSON('k', { token: 'secreto' });
    expect(store.get('k')).not.toContain('secreto');
    expect(await s.loadJSON('k')).toEqual({ token: 'secreto' });
  });

  it('sin cifrado disponible lanza un error y no guarda nada en texto plano', async () => {
    const s = await importStorage(undefined);
    await expect(s.saveEncryptedJSON('k', { token: 'secreto' })).rejects.toThrow();
    expect(store.has('k')).toBe(false);
  });
});

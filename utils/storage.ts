// Capa de persistencia local con cifrado opcional.
//
// En la app de escritorio (Electron) los datos se cifran con `safeStorage`, que
// usa el almacén de credenciales del sistema operativo y ata el cifrado a la
// cuenta de usuario del equipo. En el navegador (modo desarrollo) se guarda en
// texto plano como alternativa. Los datos antiguos sin cifrar se migran solos.

interface EncryptedEnvelope {
  __enc: 1;
  d: string; // texto cifrado en base64
}

const isEnvelope = (value: unknown): value is EncryptedEnvelope =>
  typeof value === 'object' && value !== null && (value as EncryptedEnvelope).__enc === 1;

let encryptionAvailable: boolean | null = null;

const canEncrypt = async (): Promise<boolean> => {
  if (!window.electronAPI?.isEncryptionAvailable) return false;
  if (encryptionAvailable === null) {
    try {
      encryptionAvailable = await window.electronAPI.isEncryptionAvailable();
    } catch {
      encryptionAvailable = false;
    }
  }
  return encryptionAvailable;
};

export async function saveJSON(key: string, value: unknown): Promise<void> {
  const plain = JSON.stringify(value);
  if (await canEncrypt()) {
    const encrypted = await window.electronAPI!.encrypt!(plain);
    if (encrypted) {
      const envelope: EncryptedEnvelope = { __enc: 1, d: encrypted };
      localStorage.setItem(key, JSON.stringify(envelope));
      return;
    }
  }
  localStorage.setItem(key, plain);
}

export async function loadJSON<T>(key: string): Promise<T | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (isEnvelope(parsed)) {
    if (!window.electronAPI?.decrypt) return null;
    try {
      const decrypted = await window.electronAPI.decrypt(parsed.d);
      return decrypted ? (JSON.parse(decrypted) as T) : null;
    } catch {
      return null;
    }
  }

  // Datos heredados en texto plano: migrar a cifrado si es posible.
  if (await canEncrypt()) {
    await saveJSON(key, parsed);
  }
  return parsed as T;
}

export function removeKey(key: string): void {
  localStorage.removeItem(key);
}

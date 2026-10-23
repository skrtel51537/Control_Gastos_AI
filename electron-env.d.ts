// Estado del actualizador que envía el proceso principal (electron/main.js).
export interface UpdateStatus {
  state: 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string; // versión nueva (si la hay)
  percent?: number; // progreso de la descarga (0-100)
  message?: string; // error explicado para el usuario
  detail?: string; // error técnico (primera línea), para diagnóstico
  at?: string; // momento del último cambio (ISO 8601)
}

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  isPackaged: boolean;
  update: UpdateStatus;
}

export interface ElectronAPI {
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
  restartApp: () => void;
  checkForUpdates: () => Promise<UpdateStatus | null>;
  getAppInfo?: () => Promise<AppInfo | null>;
  isEncryptionAvailable?: () => Promise<boolean>;
  encrypt?: (plain: string) => Promise<string | null>;
  decrypt?: (b64: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
  // Inyectada por Vite (define) desde package.json al compilar.
  const __APP_VERSION__: string;
}

export {};

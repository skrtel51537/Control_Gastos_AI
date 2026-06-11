export interface ElectronAPI {
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  restartApp: () => void;
  checkForUpdates: () => Promise<unknown>;
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

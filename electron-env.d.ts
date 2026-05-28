export interface ElectronAPI {
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  restartApp: () => void;
  checkForUpdates: () => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

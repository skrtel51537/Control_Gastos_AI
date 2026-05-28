const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro entre la ventana (renderer) y el proceso principal.
// Solo se expone lo estrictamente necesario; el renderer NO tiene acceso a Node.
contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update_available', () => callback());
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update_downloaded', () => callback());
    },
    restartApp: () => ipcRenderer.send('restart_app'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});

import { app, BrowserWindow, ipcMain, dialog, safeStorage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Global error handler to catch startup crashes
process.on('uncaughtException', (error) => {
    dialog.showErrorBox('Startup Error', `An error occurred: ${error.stack}`);
});

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

const sendToRenderer = (channel) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel);
    }
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        // Comprobar actualizaciones solo en la app empaquetada
        autoUpdater.checkForUpdatesAndNotify();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Auto-updater events
autoUpdater.on('update-available', () => {
    log.info('Update available.');
    sendToRenderer('update_available');
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded.');
    sendToRenderer('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', () => {
    return autoUpdater.checkForUpdatesAndNotify();
});

// Cifrado local de datos financieros mediante el almacén seguro del sistema
ipcMain.handle('secure-available', () => safeStorage.isEncryptionAvailable());

ipcMain.handle('secure-encrypt', (_event, plain) => {
    if (!safeStorage.isEncryptionAvailable() || typeof plain !== 'string') return null;
    return safeStorage.encryptString(plain).toString('base64');
});

ipcMain.handle('secure-decrypt', (_event, b64) => {
    if (!safeStorage.isEncryptionAvailable() || typeof b64 !== 'string') return null;
    return safeStorage.decryptString(Buffer.from(b64, 'base64'));
});

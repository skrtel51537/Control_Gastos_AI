import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
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

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simple local file access requirements
        },
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
    mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded.');
    mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', () => {
    // This triggers the check. If "autoupdate" is desired upon vuln detection,
    // we can call this programmatically.
    autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('check-react-vulnerabilities', async () => {
    console.log('[Main] Checking for React vulnerabilities...');
    try {
        // Dynamic version detection
        const packageJsonPath = path.join(__dirname, '../../package.json'); // Adjust path based on build structure (dist-electron/../package.json)
        // In dev: electron/main.js -> ../package.json
        // In prod: resources/app/dist-electron/main.js -> ../../package.json? 
        // Safer: app.getAppPath()

        let reactVersion = '0.0.0';
        try {
            const appPath = app.getAppPath();
            const pkgPath = path.join(appPath, 'package.json');
            const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            reactVersion = pkgData.dependencies.react.replace('^', '').replace('~', '');
        } catch (e) {
            console.error('[Main] Failed to read package.json, falling back to process.versions:', e);
            // Fallback generally not possible for client-side dep, but we catch it.
        }

        console.log(`[Main] Querying OSV for React version: ${reactVersion}`);

        const response = await fetch('https://api.osv.dev/v1/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                package: {
                    name: 'react',
                    ecosystem: 'npm'
                },
                version: reactVersion
            })
        });

        if (!response.ok) {
            console.error(`[Main] OSV API Error: ${response.status} ${response.statusText}`);
            throw new Error(`OSV API error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[Main] OSV API Response:`, JSON.stringify(data));

        return data.vulns || [];
    } catch (error) {
        console.error('[Main] Failed to check vulnerabilities:', error);
        return [];
    }
});

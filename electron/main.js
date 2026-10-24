import { app, BrowserWindow, ipcMain, dialog, safeStorage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { fetchBotMovements } from './botClient.js';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Global error handler to catch startup crashes
process.on('uncaughtException', (error) => {
    // El detalle (stack) va al log; al usuario solo un mensaje genérico,
    // sin exponer rutas internas del sistema.
    log.error('Error no controlado:', error);
    dialog.showErrorBox(
        'Error inesperado',
        'La aplicación ha encontrado un error inesperado y puede no funcionar correctamente.\n' +
        'El detalle ha quedado registrado en el archivo de logs de la aplicación.'
    );
});

// Configure logging
log.transports.file.level = 'info';
// Rotación: evita que el archivo de log crezca sin límite con los años.
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
autoUpdater.logger = log;
// Solo instalador completo (NSIS normal); nunca el "web installer".
autoUpdater.disableWebInstaller = true;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// En desarrollo, carpeta de datos propia: así las pruebas nunca abren ni
// modifican los archivos de la app instalada. Debe hacerse antes de 'ready'.
if (isDev) {
    app.setPath('userData', path.join(app.getPath('appData'), 'dashboard-gastos-mensuales-dev'));
}

let mainWindow;

const sendToRenderer = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
    }
};

// Solo se atienden mensajes del marco principal de nuestra ventana y con la
// interfaz de la propia app cargada (defensa en profundidad ante un XSS o un
// marco inesperado).
const isTrustedSender = (event) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
    if (event.senderFrame !== mainWindow.webContents.mainFrame) return false;
    const url = event.senderFrame?.url ?? '';
    return url.startsWith('file://') || (isDev && url.startsWith('http://localhost:3000'));
};

// Estado de la última comprobación de actualizaciones, para el panel
// "Acerca de". Se guarda aquí para mostrarlo aunque el panel se abra después.
let updateStatus = { state: 'idle' };

const setUpdateStatus = (status) => {
    updateStatus = { ...status, at: new Date().toISOString() };
    sendToRenderer('update_status', updateStatus);
};

// Traduce los errores del actualizador a un mensaje comprensible.
const describeUpdateError = (error) => {
    const text = String(error?.message ?? error);
    if (/app-update\.yml/.test(text)) {
        return 'Esta copia de la aplicación no puede actualizarse sola porque no es la instalada. Ábrela desde el menú Inicio.';
    }
    if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_NETWORK|ERR_TIMED_OUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT/.test(text)) {
        return 'No se ha podido conectar con GitHub. Comprueba la conexión a Internet e inténtalo más tarde.';
    }
    if (/sha512 checksum mismatch/i.test(text)) {
        return 'La actualización se descargó dañada y se ha descartado. Se volverá a intentar más tarde.';
    }
    if (/\b(403|429)\b|rate limit/i.test(text)) {
        return 'GitHub ha limitado las consultas temporalmente. Inténtalo dentro de un rato.';
    }
    if (/\b404\b/.test(text)) {
        return 'No se ha encontrado la información de la última versión en GitHub.';
    }
    return 'No se ha podido comprobar si hay actualizaciones.';
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

    // La app es 100% local: denegar la apertura de ventanas nuevas y cualquier
    // navegación fuera de la propia app (defensa en profundidad ante un XSS).
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const allowed = url.startsWith('file://') || (isDev && url.startsWith('http://localhost:3000'));
        if (!allowed) event.preventDefault();
    });

    // La app no usa cámara, micrófono, ubicación, etc.: denegar todo permiso.
    mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
        callback(false);
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        // Comprobar actualizaciones solo en la app empaquetada. Los errores
        // llegan también por el evento 'error' (se muestran en "Acerca de").
        autoUpdater.checkForUpdatesAndNotify().catch(() => {});
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

// Eventos del actualizador: se reenvían a la interfaz como estado.
autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({ state: 'checking' });
});

autoUpdater.on('update-not-available', () => {
    setUpdateStatus({ state: 'not-available' });
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available.');
    setUpdateStatus({ state: 'available', version: info?.version });
    sendToRenderer('update_available');
});

autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress?.percent ?? 0);
    // Solo avisar cuando cambia el porcentaje entero, no en cada bloque.
    if (updateStatus.state !== 'downloading' || updateStatus.percent !== percent) {
        setUpdateStatus({ state: 'downloading', version: updateStatus.version, percent });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded.');
    setUpdateStatus({ state: 'downloaded', version: info?.version });
    sendToRenderer('update_downloaded');
});

autoUpdater.on('error', (error) => {
    log.error('Error del actualizador:', error);
    setUpdateStatus({
        state: 'error',
        message: describeUpdateError(error),
        // Primera línea del error técnico, por si hay que diagnosticarlo.
        detail: String(error?.message ?? error).split('\n')[0].slice(0, 300),
    });
});

ipcMain.on('restart_app', (event) => {
    if (!isTrustedSender(event)) return log.warn('IPC restart_app rechazado: remitente no válido.');
    if (updateStatus.state !== 'downloaded') return;
    autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', async (event) => {
    if (!isTrustedSender(event)) return null;
    if (!app.isPackaged) {
        setUpdateStatus({ state: 'error', message: 'Las actualizaciones solo funcionan en la aplicación instalada.' });
        return updateStatus;
    }
    try {
        await autoUpdater.checkForUpdates();
    } catch {
        // El evento 'error' ya ha registrado el fallo y actualizado el estado.
    }
    return updateStatus;
});

ipcMain.handle('get-app-info', (event) => {
    if (!isTrustedSender(event)) return null;
    return {
        version: app.getVersion(),
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        isPackaged: app.isPackaged,
        update: updateStatus,
    };
});

// Cifrado local de datos financieros mediante el almacén seguro del sistema.
// Se usan las funciones asíncronas: las síncronas están obsoletas desde
// Electron 45 y desaparecen en la 46. Lo cifrado con las antiguas se sigue
// pudiendo descifrar con las nuevas.
ipcMain.handle('secure-available', (event) => {
    if (!isTrustedSender(event)) return false;
    return safeStorage.isAsyncEncryptionAvailable();
});

ipcMain.handle('secure-encrypt', async (event, plain) => {
    if (!isTrustedSender(event)) return null;
    if (typeof plain !== 'string' || !(await safeStorage.isAsyncEncryptionAvailable())) return null;
    return (await safeStorage.encryptStringAsync(plain)).toString('base64');
});

ipcMain.handle('secure-decrypt', async (event, b64) => {
    if (!isTrustedSender(event)) return null;
    if (typeof b64 !== 'string' || !(await safeStorage.isAsyncEncryptionAvailable())) return null;
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(b64, 'base64'));
    if (shouldReEncrypt) log.info('safeStorage: la clave ha cambiado; los datos se recifrarán al guardar.');
    return result;
});

// Lectura de movimientos desde la API del bot de gastos. La petición se hace
// aquí y no en la ventana para no relajar la CSP (connect-src 'self'). En el
// log solo queda el tipo de error: nunca el token.
ipcMain.handle('bot-fetch-movements', async (event, url, token) => {
    if (!isTrustedSender(event)) return null;
    const result = await fetchBotMovements(url, token);
    if (!result.ok) log.warn(`Bot: no se han podido cargar los movimientos (${result.error}).`);
    return result;
});

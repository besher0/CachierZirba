const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const isDev = !app.isPackaged;
const logPath = path.join(os.tmpdir(), 'zirba-desktop.log');
let mainWindow;
let staticServer;

function log(message, error) {
  const details = error?.stack ?? error?.message ?? error ?? '';
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message} ${details}\n`);
}

process.on('uncaughtException', (error) => {
  log('uncaughtException', error);
});

process.on('unhandledRejection', (error) => {
  log('unhandledRejection', error);
});

function getIndexPath() {
  return path.join(getWebRootPath(), 'index.html');
}

function getWebRootPath() {
  if (app.isPackaged) {
    return path.join(__dirname, 'mobile-dist');
  }

  return path.join(__dirname, '..', 'mobile', 'dist');
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
  };

  return contentTypes[extension] ?? 'application/octet-stream';
}

function resolveStaticFile(requestUrl) {
  const webRootPath = getWebRootPath();
  const parsedUrl = new URL(requestUrl, 'http://127.0.0.1');
  const decodedPathname = decodeURIComponent(parsedUrl.pathname);
  const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.slice(1);
  const requestedPath = path.resolve(webRootPath, relativePath);
  const resolvedWebRoot = path.resolve(webRootPath);

  if (requestedPath !== resolvedWebRoot && !requestedPath.startsWith(`${resolvedWebRoot}${path.sep}`)) {
    return null;
  }

  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return getIndexPath();
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    staticServer = http.createServer((request, response) => {
      try {
        const filePath = resolveStaticFile(request.url ?? '/');

        if (!filePath) {
          response.writeHead(403);
          response.end('Forbidden');
          return;
        }

        response.writeHead(200, {
          'Cache-Control': 'no-store',
          'Content-Type': getContentType(filePath),
        });

        fs.createReadStream(filePath).pipe(response);
      } catch (error) {
        log('static server request failed', error);
        response.writeHead(500);
        response.end('Internal Server Error');
      }
    });

    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      const address = staticServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to read static server address.'));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function createWindow() {
  const appUrl = await startStaticServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#fff0f7',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(appUrl).catch((error) => {
    log('loadURL failed', error);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  staticServer?.close();
});

'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, session } = require('electron');
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const update = require('./update.cjs');
const rel = require('../release.config.json'), pkg = require('../package.json');
const jwk = JSON.parse(fs.readFileSync(path.join(__dirname, '../www/assets/update-public.json'), 'utf8'));
const MAX = 80 * 1024 * 1024;
let win, pendingInstaller = null, validManifest = null;

app.setAppUserModelId(rel.appId);
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

const dataFile = () => path.join(app.getPath('userData'), 'ledger-data.json');
const readSafe = f => { try { const s = fs.statSync(f); if (!s.isFile() || s.size > MAX) return null; return fs.readFileSync(f, 'utf8'); } catch { return null; } };

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 600, show: false, backgroundColor: '#141416', title: 'Koluva Ledger', titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../www/assets/app-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '../www/index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('maximize', () => win.webContents.send('ledger:win:state', true)); win.on('unmaximize', () => win.webContents.send('ledger:win:state', false));
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'notifications'));
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ----- datos: escritura atómica con copia .bak ----- */
ipcMain.handle('ledger:load', () => readSafe(dataFile()));
ipcMain.handle('ledger:loadBak', () => readSafe(dataFile() + '.bak'));
ipcMain.handle('ledger:save', (_e, text) => {
  if (typeof text !== 'string' || text.length > MAX) throw Error('save');
  const f = dataFile(), tmp = f + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  if (fs.existsSync(f)) { try { fs.copyFileSync(f, f + '.bak'); } catch {} }
  fs.renameSync(tmp, f); return true;
});
ipcMain.handle('ledger:saveFile', async (_e, name, text, mime) => {
  if (typeof name !== 'string' || typeof text !== 'string' || text.length > MAX) throw Error('save');
  const safe = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const ext = path.extname(safe).slice(1) || 'txt';
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), safe), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return false; fs.writeFileSync(r.filePath, text, 'utf8'); return true;
});
ipcMain.handle('ledger:openFile', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Ledger / CSV', extensions: ['json', 'kledger', 'csv', 'txt'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const f = r.filePaths[0], s = fs.statSync(f); if (!s.isFile() || s.size > 60 * 1024 * 1024) return null;
  return { name: path.basename(f), text: fs.readFileSync(f, 'utf8') };
});
ipcMain.handle('ledger:openExternal', (_e, url) => {
  let u; try { u = new URL(url); } catch { return false; }
  const ok = u.protocol === 'https:' && (u.hostname === 'koluva.com' || u.hostname === 'www.koluva.com' || (u.hostname === 'github.com' && u.pathname.startsWith('/' + rel.repo)));
  if (ok) shell.openExternal(u.href); return ok;
});
ipcMain.on('ledger:win', (_e, cmd) => {
  if (!win) return;
  if (cmd === 'min') win.minimize(); else if (cmd === 'max') { if (win.isMaximized()) win.unmaximize(); else win.maximize(); } else if (cmd === 'close') win.close();
});
ipcMain.handle('ledger:win:isMax', () => !!win && win.isMaximized());
ipcMain.on('ledger:version', e => { e.returnValue = pkg.version; });

/* ----- actualizaciones ----- */
ipcMain.handle('ledger:upd:check', async () => {
  const r = await update.check({ jwk, repo: rel.repo, channel: rel.channelTag, current: pkg.version });
  validManifest = r.status === 'available' ? r.manifest : null; return r;
});
ipcMain.handle('ledger:upd:download', async (e, manifest) => {
  // se usa el manifiesto ya verificado en memoria, nunca el que envía el renderer
  if (!validManifest || !manifest || manifest.version !== validManifest.version) throw Error('Comprobá primero las actualizaciones.');
  pendingInstaller = await update.download(validManifest, path.join(app.getPath('userData'), 'updates'), p => e.sender.send('ledger:upd:progress', p));
  return true;
});
ipcMain.handle('ledger:upd:install', () => {
  if (!pendingInstaller || !fs.existsSync(pendingInstaller)) throw Error('No hay instalador verificado.');
  const child = spawn(pendingInstaller, ['/S', '--updated', '--force-run', '/currentuser'], { detached: true, stdio: 'ignore', windowsHide: true }); child.unref(); setTimeout(() => app.quit(), 400); return true;
});

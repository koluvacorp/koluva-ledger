'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke('ledger:' + c, ...a);
contextBridge.exposeInMainWorld('ledgerHost', Object.freeze({
  version: ipcRenderer.sendSync('ledger:version'),
  load: () => inv('load'), loadBak: () => inv('loadBak'), save: t => inv('save', t),
  saveFile: (n, t, m) => inv('saveFile', n, t, m), openFile: () => inv('openFile'), openExternal: u => inv('openExternal', u),
  update: Object.freeze({
    check: () => inv('upd:check'), download: m => inv('upd:download', m), install: () => inv('upd:install'),
    onProgress: cb => { ipcRenderer.removeAllListeners('ledger:upd:progress'); ipcRenderer.on('ledger:upd:progress', (_e, p) => cb(p)); },
  }),
}));

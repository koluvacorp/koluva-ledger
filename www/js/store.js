'use strict';
/* Adaptadores de plataforma (Windows/Electron, Android/Capacitor, navegador) + persistencia local. */
(function () {
  const C = window.LedgerCore;
  const cfg = window.LEDGER_CFG;
  const E = window.ledgerHost;
  const isCap = !E && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
  // En Android el puente nativo expone los plugins en Capacitor.Plugins; registerPlugin solo existe si se empaqueta @capacitor/core.
  const N = isCap ? ((window.Capacitor.Plugins && window.Capacitor.Plugins.LedgerNative) || (typeof window.Capacitor.registerPlugin === 'function' ? window.Capacitor.registerPlugin('LedgerNative') : null)) : null;
  const KEY = 'koluva-ledger-state';

  async function verifyManifest(text) {
    if (text.length > 65536) throw Error('big');
    const env = JSON.parse(text); if (!env || typeof env.payload !== 'string' || typeof env.signature !== 'string') throw Error('sig');
    const jwk = await (await fetch('assets/update-public.json')).json();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, C.unb64(env.signature), new TextEncoder().encode(env.payload));
    if (!ok) throw Error('sig');
    const d = JSON.parse(env.payload); C.versionParts(d.version);
    const a = d.android || {};
    const url = `https://github.com/${cfg.repo}/releases/download/ledger-v${d.version}/KoluvaLedger-${d.version}-Android.apk`;
    if (a.url !== url || !/^[a-f0-9]{64}$/.test(a.sha256 || '') || !Number.isSafeInteger(a.size) || a.size <= 0 || a.size > 400 * 1048576) throw Error('data');
    return d;
  }

  const web = {
    kind: 'web', version: cfg.version, canUpdate: false,
    async load() { try { return localStorage.getItem(KEY); } catch { return null; } },
    async loadBak() { try { return localStorage.getItem(KEY + '.bak'); } catch { return null; } },
    async save(t) { try { const old = localStorage.getItem(KEY); if (old) localStorage.setItem(KEY + '.bak', old); localStorage.setItem(KEY, t); } catch { throw Error('save'); } },
    async saveFile(name, text, mime) { const u = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return true; },
    openFile() { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.csv,.kledger,.txt'; i.onchange = async () => { const f = i.files[0]; if (!f || f.size > 60 * 1048576) return res(null); res({ name: f.name, text: await f.text() }); }; i.oncancel = () => res(null); i.click(); }); },
    openExternal(u) { window.open(u, '_blank', 'noopener'); },
    async notify(title, body) { try { if (Notification.permission === 'default') await Notification.requestPermission(); if (Notification.permission === 'granted') new Notification(title, { body, icon: 'assets/app-icon-256.png' }); } catch {} },
    async schedule() {}, update: null,
  };

  const win = E && {
    kind: 'win', version: E.version, canUpdate: true,
    load: () => E.load(), loadBak: () => E.loadBak(), save: t => E.save(t),
    saveFile: (n, t, m) => E.saveFile(n, t, m), openFile: () => E.openFile(),
    openExternal: u => E.openExternal(u),
    notify: async (t, b) => { try { new Notification(t, { body: b, icon: 'assets/app-icon-256.png' }); } catch {} },
    async schedule() {},
    update: { check: () => E.update.check(), download: (m, cb) => { E.update.onProgress(cb); return E.update.download(m); }, install: () => E.update.install() },
  };

  const android = N && {
    kind: 'android', version: cfg.version, canUpdate: true,
    async load() { return (await N.load()).text || null; }, async loadBak() { return (await N.loadBak()).text || null; },
    save: t => N.save({ text: t }),
    async saveFile(n, t, m) { await N.exportFile({ name: n, text: t, mime: m }); return true; },
    async openFile() { const r = await N.importFile(); return r && r.text != null ? r : null; },
    openExternal: u => N.openUrl({ url: u }),
    async notify(t, b) { await N.notifyNow({ title: t, body: b }); },
    async schedule(list) { try { await N.schedule({ items: JSON.stringify(list) }); } catch {} },
    update: {
      async check() {
        let r; try { r = await N.fetchText({ url: `https://github.com/${cfg.repo}/releases/download/ledger-stable/latest.json` }); } catch (e) { if (/404/.test(String(e.message))) return { status: 'unpublished' }; throw e; }
        const m = await verifyManifest(r.text);
        return C.newer(m.version, cfg.version) ? { status: 'available', manifest: m } : { status: 'current' };
      },
      async download(m, cb) { const h = await N.addListener('progress', e => cb && cb(e)); try { await N.downloadApk({ url: m.android.url, size: m.android.size, sha256: m.android.sha256 }); } finally { h.remove(); } },
      install: () => N.installApk(),
    },
  };

  const Host = win || android || web;

  /* ----- estado persistente ----- */
  let state = null, timer = null, dirty = false, onStatus = () => {};
  async function init(lang) {
    let raw = await Host.load(), parsed = null, recovered = false;
    if (raw) { try { parsed = C.sanitize(JSON.parse(raw)); } catch { parsed = null; } }
    if (!parsed && raw) { const bak = await Host.loadBak(); if (bak) { try { parsed = C.sanitize(JSON.parse(bak)); recovered = true; } catch {} } }
    state = parsed || C.emptyState(lang);
    return { fresh: !parsed, recovered, corrupt: !parsed && !!raw };
  }
  async function write() {
    if (!dirty) return; dirty = false; onStatus('saving');
    try { await Host.save(JSON.stringify(state)); onStatus('saved'); } catch { dirty = true; onStatus('error'); }
  }
  function touch() { dirty = true; onStatus('pending'); clearTimeout(timer); timer = setTimeout(write, 350); }
  async function flush() { clearTimeout(timer); await write(); }
  function replace(s) { state = s; touch(); }
  window.LedgerStore = { Host, init, touch, flush, replace, get state() { return state; }, set onStatus(f) { onStatus = f; }, verifyManifest };
  addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  addEventListener('pagehide', () => { flush(); });
})();

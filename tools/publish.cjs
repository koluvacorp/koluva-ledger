'use strict';
// Publica en GitHub Releases: ledger-v<version> (instalador, APK, checksums) y el canal ledger-stable (latest.json firmado).
// Credencial: GH_TOKEN, o `gh auth token`, o Git Credential Manager. Nunca se guarda ni se imprime.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { verifyInstallerVersion, verifyPackagedVersion } = require('./verify-packaged-version.cjs');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json'), rel = require('../release.config.json'), v = pkg.version, REPO = rel.repo;
function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try { const t = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); if (t) return t; } catch {}
  try { const raw = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, stdio: ['pipe', 'pipe', 'ignore'] }); const l = raw.split('\n').find(x => x.startsWith('password=')); if (l) return l.slice(9); } catch {}
  throw Error('Iniciá sesión en GitHub primero: gh auth login');
}
(async () => {
  const headers = { Authorization: `Bearer ${token()}`, 'User-Agent': 'KoluvaLedger-release', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const api = async (route, method = 'GET', body) => {
    const r = await fetch(`https://api.github.com/repos/${REPO}${route}`, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    if (r.status === 404) return null; if (r.status === 204) return true; const d = await r.json(); if (!r.ok) throw Error(`GitHub ${r.status}: ${d.message}`); return d;
  };
  const repo = await api(''); assert.ok(repo, `El repositorio ${REPO} no existe. Crealo público primero.`); assert.ok(repo.permissions && repo.permissions.push, 'Sin permiso de escritura.'); assert.equal(repo.private, false, 'El repositorio debe ser público.');
  const rd = path.join(root, 'release'), exe = `KoluvaLedger-${v}-Windows-x64-Setup.exe`, apk = `KoluvaLedger-${v}-Android.apk`, chan = path.join(rd, 'ledger-stable', 'latest.json');
  for (const f of [exe, apk, 'SHA256SUMS.txt']) assert.ok(fs.existsSync(path.join(rd, f)), `Falta release/${f}`);
  const unpackedAsar = path.join(rd, 'win-unpacked', 'resources', 'app.asar');
  assert.ok(fs.existsSync(unpackedAsar), 'Falta el app.asar generado para Windows; recompilá antes de publicar.');
  assert.ok(fs.statSync(path.join(rd, exe)).mtimeMs >= fs.statSync(unpackedAsar).mtimeMs, 'El instalador Windows es anterior al ASAR compilado; reconstruí el instalador antes de publicar.');
  verifyPackagedVersion({ archive: unpackedAsar, expected: v, asarCli: path.join(root, 'node_modules/@electron/asar/bin/asar.js') });
  const sevenZip = await require('app-builder-lib/out/toolsets/7zip').getPath7za();
  verifyInstallerVersion({ installer: path.join(rd, exe), expected: v, asarCli: path.join(root, 'node_modules/@electron/asar/bin/asar.js'), sevenZip });
  const man = JSON.parse(JSON.parse(fs.readFileSync(chan, 'utf8')).payload); assert.equal(man.version, v);
  const notes = man.notes.es;
  const getOrCreate = async (tag, name, body) => await api(`/releases/tags/${tag}`) || await api('/releases', 'POST', { tag_name: tag, target_commitish: repo.default_branch, name, body, draft: true, prerelease: false });
  const upload = async (release, file, name, ctype, replace) => {
    const ex = (release.assets || []).find(a => a.name === name);
    if (ex) { if (!replace && !release.draft) return ex; await api(`/releases/assets/${ex.id}`, 'DELETE'); }
    const r = await fetch(`https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...headers, 'Content-Type': ctype, 'Content-Length': String(fs.statSync(file).size) }, body: fs.createReadStream(file), duplex: 'half', signal: AbortSignal.timeout(900000) });
    const d = await r.json(); if (!r.ok) throw Error(`No se pudo subir ${name}: ${r.status} ${d.message || ''}`); return d;
  };
  const publish = async (r, latest) => { if (r.draft) await api(`/releases/${r.id}`, 'PATCH', { draft: false, make_latest: latest ? 'true' : 'false' }); };
  const vr = await getOrCreate(`ledger-v${v}`, `Koluva Ledger ${v}`, notes);
  await upload(vr, path.join(rd, exe), exe, 'application/octet-stream'); await upload(vr, path.join(rd, apk), apk, 'application/vnd.android.package-archive'); await upload(vr, path.join(rd, 'SHA256SUMS.txt'), 'SHA256SUMS.txt', 'text/plain');
  await publish(vr, true);
  const cr = await getOrCreate('ledger-stable', 'Canal estable de Koluva Ledger', 'Manifiesto firmado de actualización de Koluva Ledger.');
  await upload(cr, chan, 'latest.json', 'application/json', true); await publish(cr, false);
  for (const [n, size, sha] of [[exe, man.windows.size, man.windows.sha256], [apk, man.android.size, man.android.sha256]]) {
    const h = await fetch(`https://github.com/${REPO}/releases/download/ledger-v${v}/${n}`, { method: 'HEAD', redirect: 'follow' });
    if (!h.ok) throw Error(`La descarga pública de ${n} respondió HTTP ${h.status}.`); assert.equal(Number(h.headers.get('content-length')), size);
    console.log(`OK ${h.status}: https://github.com/${REPO}/releases/download/ledger-v${v}/${n}`);
  }
  const lj = await fetch(`https://github.com/${REPO}/releases/download/ledger-stable/latest.json`, { cache: 'no-store' }); assert.ok(lj.ok, `Canal HTTP ${lj.status}`);
  console.log('Canal: https://github.com/' + REPO + '/releases/download/ledger-stable/latest.json');
})().catch(e => { console.error(e.message); process.exitCode = 1; });

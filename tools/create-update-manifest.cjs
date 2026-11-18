'use strict';
// Firma el manifiesto de actualización (ECDSA P-256 / SHA-256, formato P1363) con la clave privada de la bóveda.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json'), rel = require('../release.config.json'), v = pkg.version;
const keyFile = process.env.KOLUVA_LEDGER_UPDATE_PRIVATE_KEY || 'D:/KoluvaVault/06 Seguridad/Koluva Ledger/ledger-update-private.pem';
const sha = f => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', c => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej); });
(async () => {
  const notes = JSON.parse(fs.readFileSync(path.join(root, 'docs/release-notes.json'), 'utf8'))[v];
  if (!notes || !['es', 'en', 'pt', 'fr'].every(l => typeof notes[l] === 'string' && notes[l])) throw Error(`docs/release-notes.json necesita notas es/en/pt/fr para ${v}.`);
  const exe = path.join(root, 'release', `KoluvaLedger-${v}-Windows-x64-Setup.exe`), apk = path.join(root, 'release', `KoluvaLedger-${v}-Android.apk`);
  for (const f of [exe, apk]) if (!fs.existsSync(f)) throw Error(`Falta ${path.basename(f)} en release/.`);
  const base = `https://github.com/${rel.repo}/releases/download/ledger-v${v}`;
  const payload = { version: v, publishedAt: new Date().toISOString(), notes,
    windows: { url: `${base}/KoluvaLedger-${v}-Windows-x64-Setup.exe`, size: fs.statSync(exe).size, sha256: await sha(exe) },
    android: { url: `${base}/KoluvaLedger-${v}-Android.apk`, size: fs.statSync(apk).size, sha256: await sha(apk) } };
  const canonical = JSON.stringify(payload), key = fs.readFileSync(keyFile);
  const signature = crypto.sign('sha256', Buffer.from(canonical), { key, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const pub = crypto.createPublicKey({ key: JSON.parse(fs.readFileSync(path.join(root, 'www/assets/update-public.json'), 'utf8')), format: 'jwk' });
  if (!crypto.verify('sha256', Buffer.from(canonical), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64'))) throw Error('La clave privada no corresponde a la pública incluida en la app.');
  const out = path.join(root, 'release', 'ledger-stable', 'latest.json'); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ payload: canonical, signature }, null, 2));
  fs.writeFileSync(path.join(root, 'release', 'SHA256SUMS.txt'), `${payload.windows.sha256}  ${path.basename(exe)}\n${payload.android.sha256}  ${path.basename(apk)}\n`);
  console.log(`Manifiesto firmado para Koluva Ledger ${v}: release/ledger-stable/latest.json`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });

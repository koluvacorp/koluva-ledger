'use strict';
// Crea el par ECDSA P-256 del canal de actualización. La clave privada va FUERA del repo (bóveda); nunca se sobrescribe.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const dir = process.env.KOLUVA_LEDGER_KEY_DIR || 'D:/KoluvaVault/06 Seguridad/Koluva Ledger';
const priv = path.join(dir, 'ledger-update-private.pem');
if (fs.existsSync(priv)) { console.log('La clave ya existe; no se toca:', priv); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
fs.writeFileSync(path.join(__dirname, '../www/assets/update-public.json'), JSON.stringify(publicKey.export({ format: 'jwk' })));
console.log('Clave privada:', priv);

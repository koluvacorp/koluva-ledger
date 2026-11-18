'use strict';
// Genera www/js/config.js (versión y repo) desde package.json + release.config.json y verifica la marca.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json'), rel = require('../release.config.json');
fs.writeFileSync(path.join(root, 'www/js/config.js'), `window.LEDGER_CFG=${JSON.stringify({ version: pkg.version, repo: rel.repo })};\n`);
for (const f of ['koluva-ledger-isotipo-color.svg', 'koluva-ledger-imagotipo-white.svg', 'koluva-ledger-imagotipo-ink.svg', 'app-icon.png', 'app-icon.svg', 'update-public.json'])
  if (!fs.existsSync(path.join(root, 'www/assets', f))) throw Error(`Falta el recurso: www/assets/${f}`);
console.log(`config.js listo · v${pkg.version} · ${rel.repo}`);

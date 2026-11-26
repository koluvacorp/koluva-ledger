'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function verifyPackagedVersion({ archive, expected, asarCli }) {
  archive = path.resolve(archive); asarCli = path.resolve(asarCli);
  if (typeof expected !== 'string' || !fs.existsSync(archive) || !fs.existsSync(asarCli)) throw Error('Falta la versión esperada o el ASAR/herramienta de inspección.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-asar-check-'));
  try {
    execFileSync(process.execPath, [asarCli, 'extract-file', archive, 'package.json'], { cwd: dir, stdio: 'ignore' });
    const actual = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
    if (actual !== expected) throw Error(`La versión interna de app.asar (${actual}) no coincide con package.json (${expected}). No se publicará un instalador mal rotulado.`);
    return actual;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function verifyInstallerVersion({ installer, expected, asarCli, sevenZip }) {
  installer = path.resolve(installer); asarCli = path.resolve(asarCli); sevenZip = path.resolve(sevenZip);
  if (![installer, asarCli, sevenZip].every(file => fs.existsSync(file))) throw Error('Falta el instalador o las herramientas de inspección.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-installer-check-'));
  const extracted = path.join(dir, 'resources'); fs.mkdirSync(extracted);
  try {
    execFileSync(sevenZip, ['x', '-y', `-o${dir}`, installer, 'resources/app.asar'], { cwd: dir, stdio: 'ignore' });
    const archive = path.join(extracted, 'app.asar');
    if (!fs.existsSync(archive)) throw Error('El instalador no contiene resources/app.asar.');
    return verifyPackagedVersion({ archive, expected, asarCli });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { verifyPackagedVersion, verifyInstallerVersion };

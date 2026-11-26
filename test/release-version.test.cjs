'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { verifyInstallerVersion, verifyPackagedVersion } = require('../tools/verify-packaged-version.cjs');
const asarCli = path.resolve(__dirname, '../node_modules/@electron/asar/bin/asar.js');
const get7z = () => require('app-builder-lib/out/toolsets/7zip').getPath7za();

function archive(version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-asar-fixture-'));
  const src = path.join(dir, 'src'), file = path.join(dir, 'test.asar');
  fs.mkdirSync(src); fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ version }));
  execFileSync(process.execPath, [asarCli, 'pack', src, file], { stdio: 'ignore' });
  return { dir, file };
}

test('el guard acepta el ASAR con la misma versión del release', () => {
  const a = archive('1.3.3');
  try { assert.equal(verifyPackagedVersion({ archive: a.file, expected: '1.3.3', asarCli }), '1.3.3'); }
  finally { fs.rmSync(a.dir, { recursive: true, force: true }); }
});

test('el guard bloquea un ASAR antiguo rotulado con una versión nueva', () => {
  const a = archive('1.3.1');
  try { assert.throws(() => verifyPackagedVersion({ archive: a.file, expected: '1.3.3', asarCli }), /no coincide.*No se publicará/); }
  finally { fs.rmSync(a.dir, { recursive: true, force: true }); }
});

test('el guard lee el ASAR del instalador y rechaza el EXE rotulado con otra versión', async () => {
  const a = archive('1.3.1'), sevenZip = await get7z(), resources = path.join(a.dir, 'resources'), installer = path.join(a.dir, 'setup.exe');
  fs.mkdirSync(resources); fs.copyFileSync(a.file, path.join(resources, 'app.asar'));
  try {
    execFileSync(sevenZip, ['a', '-t7z', '-y', installer, 'resources/app.asar'], { cwd: a.dir, stdio: 'ignore' });
    assert.throws(() => verifyInstallerVersion({ installer, expected: '1.3.3', asarCli, sevenZip }), /no coincide.*No se publicará/);
  } finally { fs.rmSync(a.dir, { recursive: true, force: true }); }
});

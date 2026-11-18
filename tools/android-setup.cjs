'use strict';
// Aplica a android/ (generado por `cap add android`) el plugin nativo, permisos, firma y versión. Idempotente.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), A = path.join(root, 'android'), main = path.join(A, 'app/src/main'), pkg = require('../package.json');
const vault = process.env.KOLUVA_LEDGER_KEY_DIR || 'D:/KoluvaVault/06 Seguridad/Koluva Ledger';
const fwd = f => f.split(String.fromCharCode(92)).join('/');
const put = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

put(path.join(root, 'android-src/java/LedgerNative.java'), path.join(main, 'java/com/koluva/ledger/LedgerNative.java'));
put(path.join(root, 'android-src/java/ReminderReceiver.java'), path.join(main, 'java/com/koluva/ledger/ReminderReceiver.java'));
put(path.join(root, 'android-src/java/MainActivity.java'), path.join(main, 'java/com/koluva/ledger/MainActivity.java'));
put(path.join(root, 'android-src/res/xml/file_paths.xml'), path.join(main, 'res/xml/file_paths.xml'));
put(path.join(root, 'android-src/res/drawable/ic_stat_ledger.xml'), path.join(main, 'res/drawable/ic_stat_ledger.xml'));

// manifiesto
const mf = path.join(main, 'AndroidManifest.xml'); let m = fs.readFileSync(mf, 'utf8');
m = m.replace('android:allowBackup="true"', 'android:allowBackup="false"');
if (!m.includes('ReminderReceiver')) m = m.replace('</application>', '    <receiver android:name=".ReminderReceiver" android:exported="false" />\n    </application>');
for (const p of ['REQUEST_INSTALL_PACKAGES', 'POST_NOTIFICATIONS']) if (!m.includes(p)) m = m.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
fs.writeFileSync(mf, m);

// clave de firma del APK (una sola vez; se guarda fuera del repo)
const jks = path.join(vault, 'ledger-release.jks'), props = path.join(vault, 'keystore.properties');
if (!fs.existsSync(jks)) {
  fs.mkdirSync(vault, { recursive: true });
  const pw = crypto.randomBytes(18).toString('base64url');
  execFileSync('keytool', ['-genkeypair', '-keystore', jks, '-alias', 'ledger', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '36500', '-storepass', pw, '-keypass', pw, '-dname', 'CN=Koluva Ledger, O=Koluva'], { stdio: 'ignore' });
  fs.writeFileSync(props, `storeFile=${fwd(jks)}\nstorePassword=${pw}\nkeyAlias=ledger\nkeyPassword=${pw}\n`, { mode: 0o600 });
  console.log('Keystore creado en la bóveda:', jks);
}

// gradle: versión desde package.json + firma release
const gf = path.join(A, 'app/build.gradle'); let g = fs.readFileSync(gf, 'utf8');
const [maj, min, pat] = pkg.version.split('.').map(Number);
g = g.replace(/versionCode \d+/, `versionCode ${maj * 10000 + min * 100 + pat}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}"`);
if (!g.includes('ksProps')) {
  g = g.replace('android {', `def ksProps = new Properties()
def ksFile = file(System.getenv('KOLUVA_LEDGER_KEYSTORE_PROPS') ?: '${fwd(props)}')
if (ksFile.exists()) ksFile.withInputStream { ksProps.load(it) }

android {
    signingConfigs {
        release {
            if (ksFile.exists()) {
                storeFile file(ksProps['storeFile'])
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }
    }`);
  g = g.replace("release {\n            minifyEnabled false", "release {\n            signingConfig signingConfigs.release\n            minifyEnabled false");
}
fs.writeFileSync(gf, g);
console.log('Android listo · versión', pkg.version);

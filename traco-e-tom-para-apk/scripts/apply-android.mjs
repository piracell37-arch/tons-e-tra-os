/* Ajusta o projeto Android gerado pelo Capacitor (`npx cap add android`).
   Rode depois de `npm run android:sync`:  node scripts/apply-android.mjs
   Idempotente: pode rodar quantas vezes quiser. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const manifestPath = join(root, 'android/app/src/main/AndroidManifest.xml');
const gradlePath = join(root, 'android/app/build.gradle');
const stringsPath = join(root, 'android/app/src/main/res/values/strings.xml');

if (!existsSync(manifestPath)) {
  console.error('android/ ainda nao existe. Rode primeiro:  npx cap add android');
  process.exit(1);
}

const ADMOB_ID = cfg.plugins?.AdMob?.appId || '';
const VERSION_NAME = pkg.version || '1.0.0';
const VERSION_CODE = Number(process.env.VERSION_CODE || (VERSION_NAME.split('.').reduce((a, p) => a * 100 + Number(p || 0), 0)));

let m = readFileSync(manifestPath, 'utf8');
const before = m;

/* permissoes necessarias */
for (const perm of ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.VIBRATE']) {
  if (!m.includes(perm)) m = m.replace(/(<uses-permission[^>]*>[\s\S]*?<\/manifest>|<manifest[\s\S]*?>)/, `$1\n    <uses-permission android:name="${perm}" />`);
  if (!m.includes(perm)) m = m.replace(/(<application)/, `    <uses-permission android:name="${perm}" />\n    $1`);
}
/* AdMob: APPLICATION_ID dentro de <application> e <queries> para o navegador de publicidade */
if (ADMOB_ID && !m.includes('com.google.android.gms.ads.APPLICATION_ID')) {
  m = m.replace(/<application/, `<application\n        android:usesCleartextTraffic="false"`);
  m = m.replace(/(<application[^>]*>)/, `$1\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="${ADMOB_ID}" />`);
}
if (!m.includes('com.google.android.gms.ads.mobileads')) {
  m = m.replace(/(<application)/, `    <queries>\n        <intent>\n            <action android:name="com.google.android.gms.ads.intent.AD_VIEW" />\n            <category android:name="android.intent.category.BROWSABLE" />\n            <data android:scheme="https" />\n        </intent>\n        <package android:name="com.google.android.gms" />\n    </queries>\n\n    $1`);
}
/* tela apenas retrato, como o manifest.webmanifest declara */
if (!m.includes('android:screenOrientation="portrait"')) {
  m = m.replace(/(<activity[\s\S]*?android:configChanges[^>]*>)/, '$1\n                android:screenOrientation="portrait"'.trim());
  m = m.replace(/android:configChanges="[^"]*">/, 'android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation" android:screenOrientation="portrait">');
}
if (m !== before) { writeFileSync(manifestPath, m); console.log('OK  AndroidManifest.xml'); }
else console.log('--  AndroidManifest.xml ja estava certo');

/* nome do app na launcher — o nome tem &, entao precisa escapar: senao o strings.xml
   vira XML malformado e o Gradle quebra no merge de recursos */
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
if (existsSync(stringsPath)) {
  let s = readFileSync(stringsPath, 'utf8');
  const want = `<string name="app_name">${xml(cfg.appName)}</string>`;
  if (!s.includes(want)) {
    s = s.replace(/<string name="app_name">[^<]*<\/string>/, want);
    writeFileSync(stringsPath, s);
    console.log('OK  strings.xml -> ' + cfg.appName);
  } else console.log('--  strings.xml ja estava certa');
}

/* versao do bundle */
if (existsSync(gradlePath)) {
  let g = readFileSync(gradlePath, 'utf8');
  g = g.replace(/versionCode\s+\d+/, 'versionCode ' + VERSION_CODE);
  g = g.replace(/versionName\s+"[^"]*"/, 'versionName "' + VERSION_NAME + '"');
  writeFileSync(gradlePath, g);
  console.log('OK  build.gradle -> versionCode ' + VERSION_CODE + ' / versionName ' + VERSION_NAME);
}

console.log('\nProximos passos:');
console.log('  1. confira android/app/src/main/AndroidManifest.xml');
console.log('  2. npm run android:open   (abre o Android Studio)');
console.log('  3. Build > Generate Signed Bundle > AAB');
